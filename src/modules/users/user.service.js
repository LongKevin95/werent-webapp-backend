import bcrypt from "bcryptjs";
import ApiError from "../../common/ApiError.js";
import { deleteAsset, uploadFiles } from "../../services/cloudinary.service.js";
import { serializeUser } from "../auth/auth.service.js";
import User from "./user.model.js";

export async function getProfile(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  return serializeUser(user);
}

export async function updateProfile(userId, payload) {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  const nextEmail = User.normalizeEmail(payload.email);
  const nextPhone = User.normalizePhone(payload.phone);
  const effectiveEmail =
    payload.email !== undefined ? nextEmail : user.email;
  const effectivePhone =
    payload.phone !== undefined ? nextPhone : user.phone;
  const duplicateConditions = [];

  if (!effectiveEmail && !effectivePhone) {
    throw new ApiError(
      400,
      "Hồ sơ phải có ít nhất một email hoặc số điện thoại.",
    );
  }

  if (nextEmail && nextEmail !== user.email) {
    duplicateConditions.push({ email: nextEmail });
  }

  if (nextPhone && nextPhone !== user.phone) {
    duplicateConditions.push({ phone: nextPhone });
  }

  if (duplicateConditions.length > 0) {
    const duplicateUser = await User.findOne({
      _id: { $ne: userId },
      $or: duplicateConditions,
    });

    if (duplicateUser) {
      if (nextPhone && duplicateUser.phone === nextPhone) {
        throw new ApiError(
          409,
          "Số điện thoại đã được sử dụng. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
        );
      }

      if (nextEmail && duplicateUser.email === nextEmail) {
        throw new ApiError(
          409,
          "Email đã được sử dụng. Vui lòng đăng nhập hoặc khôi phục mật khẩu.",
        );
      }

      throw new ApiError(409, "Email hoặc số điện thoại đã được sử dụng.");
    }
  }

  const identityChanged =
    user.kycStatus === "verified" &&
    ((payload.fullName !== undefined && payload.fullName.trim() !== user.fullName) ||
      (payload.email !== undefined && nextEmail !== user.email) ||
      (payload.phone !== undefined && nextPhone !== user.phone));

  if (payload.fullName !== undefined) {
    user.fullName = payload.fullName.trim();
  }

  if (payload.email !== undefined) {
    user.email = nextEmail;
  }

  if (payload.phone !== undefined) {
    user.phone = nextPhone;
  }

  if (identityChanged) {
    user.kycStatus = "unverified";
    user.canPostListing = false;
    user.verifiedAt = null;
    user.verifiedBy = null;
  }

  await user.save();
  return serializeUser(user);
}

export async function changePassword(userId, payload) {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  const isCurrentPasswordValid = await user.comparePassword(
    payload.currentPassword,
  );

  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
  }

  user.passwordHash = await bcrypt.hash(payload.newPassword, 10);
  await user.save();

  return serializeUser(user);
}

export async function updateAvatar(userId, file) {
  if (!file) {
    throw new ApiError(400, "Vui lòng gửi lên một ảnh đại diện.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "Không tìm thấy người dùng.");
  }

  const [uploadedFile] = await uploadFiles([file], {
    folder: "werent/users/avatar",
    transformation: [
      {
        width: 512,
        height: 512,
        crop: "fill",
        gravity: "face",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });

  const previousAvatarPublicId = user.avatarPublicId;
  user.avatarUrl = uploadedFile.secureUrl;
  user.avatarPublicId = uploadedFile.publicId;

  try {
    await user.save();
  } catch (error) {
    await deleteAsset(uploadedFile.publicId).catch(() => null);
    throw error;
  }

  if (
    previousAvatarPublicId &&
    previousAvatarPublicId !== uploadedFile.publicId
  ) {
    await deleteAsset(previousAvatarPublicId).catch(() => null);
  }

  return serializeUser(user);
}
