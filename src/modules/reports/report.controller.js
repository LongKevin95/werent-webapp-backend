import asyncHandler from "../../common/asyncHandler.js";
import { createReport, listReports } from "./report.service.js";

export const createPropertyReport = asyncHandler(async (req, res) => {
  const report = await createReport(req.user._id, req.body);

  return res.status(201).json({
    success: true,
    message: "Gửi báo cáo thành công.",
    data: { report },
  });
});

export const getReports = asyncHandler(async (req, res) => {
  const items = await listReports();

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách báo cáo thành công.",
    data: { items },
  });
});
