import asyncHandler from "../../common/asyncHandler.js";
import { listAdministrativeDivisions } from "./administrative-division.service.js";

export const getAdministrativeDivisions = asyncHandler(async (req, res) => {
  const data = await listAdministrativeDivisions();

  return res.status(200).json({
    success: true,
    message: "Lấy dữ liệu địa giới hành chính thành công.",
    data,
  });
});
