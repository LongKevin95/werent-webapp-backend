import asyncHandler from "../../common/asyncHandler.js";
import { updatePropertyStatus } from "../properties/property.service.js";
import {
  createUser,
  deleteUser,
  getDashboardSummary,
  getUserById,
  listUsers,
  updateUser,
} from "./admin.service.js";

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary();

  return res.status(200).json({
    success: true,
    message: "Lấy thống kê admin thành công.",
    data: { summary },
  });
});

export const getAdminUsers = asyncHandler(async (req, res) => {
  const result = await listUsers(req.query);

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách người dùng thành công.",
    data: result,
  });
});

export const getAdminUser = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.userId);

  return res.status(200).json({
    success: true,
    message: "Lấy thông tin người dùng thành công.",
    data: { user },
  });
});

export const createAdminUser = asyncHandler(async (req, res) => {
  const user = await createUser(req.body);

  return res.status(201).json({
    success: true,
    message: "Tạo tài khoản thành công.",
    data: { user },
  });
});

export const updateAdminUser = asyncHandler(async (req, res) => {
  const user = await updateUser(req.params.userId, req.user._id, req.body);

  return res.status(200).json({
    success: true,
    message: "Cập nhật tài khoản thành công.",
    data: { user },
  });
});

export const deleteAdminUser = asyncHandler(async (req, res) => {
  const user = await deleteUser(req.params.userId, req.user._id);

  return res.status(200).json({
    success: true,
    message: "Xóa tài khoản thành công.",
    data: { user },
  });
});

export const reviewPropertyByAdmin = asyncHandler(async (req, res) => {
  const property = await updatePropertyStatus(req.params.propertyId, req.user._id, req.body);

  return res.status(200).json({
    success: true,
    message: "Duyệt tin thành công.",
    data: { property },
  });
});
