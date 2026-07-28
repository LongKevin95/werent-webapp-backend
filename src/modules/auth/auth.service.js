import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ApiError from "../../common/ApiError.js";
import { ROLES } from "../../common/constants.js";
import env from "../../config/env.js";
import User from "../users/user.model.js";

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    roles: user.roles,
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
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
