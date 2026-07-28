import asyncHandler from "../../common/asyncHandler.js";
import { loginUser, registerUser, serializeUser } from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const data = await registerUser(req.body);

  return res.status(201).json({
    success: true,
    message: "Đăng ký thành công.",
    data,
  });
});

export const login = asyncHandler(async (req, res) => {
  const data = await loginUser(req.body);

  return res.status(200).json({
    success: true,
    message: "Đăng nhập thành công.",
    data,
  });
});

export const logout = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Đăng xuất thành công.",
  });
});

export const verifyToken = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Access token hợp lệ.",
    data: {
      user: serializeUser(req.user),
      auth: req.auth,
    },
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Lấy thông tin người dùng thành công.",
    data: {
      user: serializeUser(req.user),
    },
  });
});
