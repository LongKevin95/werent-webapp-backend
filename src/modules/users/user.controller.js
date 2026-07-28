import asyncHandler from "../../common/asyncHandler.js";
import {
  changePassword,
  getProfile,
  updateAvatar,
  updateProfile,
} from "./user.service.js";

export const getMe = asyncHandler(async (req, res) => {
  const user = await getProfile(req.user._id);

  return res.status(200).json({
    success: true,
    message: "Lấy hồ sơ thành công.",
    data: { user },
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user._id, req.body);

  return res.status(200).json({
    success: true,
    message: "Cập nhật hồ sơ thành công.",
    data: { user },
  });
});

export const updateMyAvatar = asyncHandler(async (req, res) => {
  const user = await updateAvatar(req.user._id, req.file);

  return res.status(200).json({
    success: true,
    message: "Cập nhật ảnh đại diện thành công.",
    data: { user },
  });
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  const user = await changePassword(req.user._id, req.body);

  return res.status(200).json({
    success: true,
    message: "Đổi mật khẩu thành công.",
    data: { user },
  });
});
