import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import ApiError from "../../common/ApiError.js";
import { ROLES } from "../../common/constants.js";
import env from "../../config/env.js";
import { sendWelcomeNotification } from "../notifications/notification.service.js";
import User from "../users/user.model.js";

const googleOAuthClient = new OAuth2Client();

function getAllowedGoogleEmails() {
  return new Set(
    (env.GOOGLE_AUTH_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => User.normalizeEmail(email))
      .filter(Boolean),
  );
}

function assertGoogleAuthConfigured() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, "Chưa cấu hình GOOGLE_CLIENT_ID cho đăng nhập Google.");
  }

  if (getAllowedGoogleEmails().size === 0) {
    throw new ApiError(
      503,
      "Chưa cấu hình GOOGLE_AUTH_ALLOWED_EMAILS cho đăng nhập Google.",
    );
  }
}

async function verifyGoogleCredential(credential) {
  assertGoogleAuthConfigured();

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new ApiError(401, "Google credential không hợp lệ.");
    }

    if (payload.email_verified !== true) {
      throw new ApiError(401, "Email Google chưa được xác minh.");
    }

    return {
      googleId: payload.sub,
      email: User.normalizeEmail(payload.email),
      fullName: typeof payload.name === "string" ? payload.name.trim() : "",
      avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "Google credential không hợp lệ.");
  }
}

function assertGoogleEmailAllowed(email) {
  const allowedEmails = getAllowedGoogleEmails();

  if (!allowedEmails.has(email)) {
    throw new ApiError(
      403,
      "Email Google này chưa nằm trong danh sách được phép đăng nhập.",
    );
  }
}

function resolveGoogleDisplayName(profile) {
  if (profile.fullName) {
    return profile.fullName;
  }

  return profile.email.split("@")[0];
}

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    roles: user.roles,
    avatarUrl: user.avatarUrl ?? null,
    walletBalance: user.walletBalance ?? 0,
    walletPromotionBalance: user.walletPromotionBalance ?? 0,
    isActive: user.isActive,
    dateOfBirth: user.dateOfBirth ?? null,
    address: user.address ?? "",
    identityNumber: user.identityNumber ?? "",
    identityIssuedAt: user.identityIssuedAt ?? null,
    passportNumber: user.passportNumber ?? "",
    taxCode: user.taxCode ?? "",
    kycStatus: user.kycStatus ?? "unverified",
    canPostListing: user.canPostListing === true,
    verifiedAt: user.verifiedAt ?? null,
    verifiedBy: user.verifiedBy ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      roles: user.roles,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function resolvePublicRegisterRoles() {
  return [ROLES.USER];
}

async function findExistingUser({ email, phone }) {
  const normalizedEmail = User.normalizeEmail(email);
  const normalizedPhone = User.normalizePhone(phone);
  const conditions = [];

  if (normalizedEmail) {
    conditions.push({ email: normalizedEmail });
  }

  if (normalizedPhone) {
    conditions.push({ phone: normalizedPhone });
  }

  if (conditions.length === 0) {
    return null;
  }

  return User.findOne({ $or: conditions });
}

export async function registerUser(payload) {
  const roles = resolvePublicRegisterRoles();
  const normalizedEmail = User.normalizeEmail(payload.email);
  const normalizedPhone = User.normalizePhone(payload.phone);

  if (!normalizedEmail || !normalizedPhone) {
    throw new ApiError(400, "Cần cung cấp đầy đủ email và số điện thoại.");
  }

  const existingUser = await findExistingUser(payload);

  if (existingUser) {
    if (normalizedPhone && existingUser.phone === normalizedPhone) {
      throw new ApiError(
        409,
        "Số điện thoại đã được sử dụng. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
      );
    }

    if (normalizedEmail && existingUser.email === normalizedEmail) {
      throw new ApiError(
        409,
        "Email đã được sử dụng. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
      );
    }

    throw new ApiError(409, "Email hoặc số điện thoại đã được sử dụng.");
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await User.create({
    fullName: payload.fullName.trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    passwordHash,
    roles,
    isActive: true,
  });

  await sendWelcomeNotification(user).catch(() => null);

  return {
    accessToken: signAccessToken(user),
    user: serializeUser(user),
  };
}

export async function loginUser({ identifier, password }) {
  const user = await User.findByLoginIdentifier(identifier);

  if (!user) {
    throw new ApiError(401, "Email/số điện thoại hoặc mật khẩu không đúng.");
  }

  if (user.isActive === false) {
    throw new ApiError(403, "Tài khoản đã bị khóa.");
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Email/số điện thoại hoặc mật khẩu không đúng.");
  }

  return {
    accessToken: signAccessToken(user),
    user: serializeUser(user),
  };
}

export async function loginWithGoogle({ credential }) {
  const profile = await verifyGoogleCredential(credential);
  assertGoogleEmailAllowed(profile.email);

  let user = await User.findOne({ googleId: profile.googleId });

  if (!user) {
    user = await User.findOne({ email: profile.email });
  }

  if (user) {
    if (user.isActive === false) {
      throw new ApiError(403, "Tài khoản đã bị khóa.");
    }

    if (user.googleId && user.googleId !== profile.googleId) {
      throw new ApiError(
        409,
        "Email này đã được liên kết với một tài khoản Google khác.",
      );
    }

    user.googleId = profile.googleId;
    if (profile.avatarUrl && !user.avatarUrl) {
      user.avatarUrl = profile.avatarUrl;
    }
    await user.save();
  } else {
    user = await User.create({
      fullName: resolveGoogleDisplayName(profile),
      email: profile.email,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      roles: resolvePublicRegisterRoles(),
      isActive: true,
    });

    await sendWelcomeNotification(user).catch(() => null);
  }

  return {
    accessToken: signAccessToken(user),
    user: serializeUser(user),
  };
}
