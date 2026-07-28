import asyncHandler from "../../common/asyncHandler.js";
import { updatePropertyStatus } from "../properties/property.service.js";
import { getDashboardSummary, listUsers } from "./admin.service.js";

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary();

  return res.status(200).json({
    success: true,
    message: "Lấy thống kê admin thành công.",
    data: { summary },
  });
});

export const getAdminUsers = asyncHandler(async (req, res) => {
  const items = await listUsers();

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách người dùng thành công.",
    data: { items },
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
