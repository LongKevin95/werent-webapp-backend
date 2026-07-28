import asyncHandler from "../../common/asyncHandler.js";
import {
  createProperty,
  getPropertyById,
  listProperties,
  updateProperty,
  updatePropertyStatus,
} from "./property.service.js";

export const getProperties = asyncHandler(async (req, res) => {
  const data = await listProperties(req.query);

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách tin đăng thành công.",
    data,
  });
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await getPropertyById(req.params.propertyId);

  return res.status(200).json({
    success: true,
    message: "Lấy tin đăng thành công.",
    data: { property },
  });
});

export const createPropertyListing = asyncHandler(async (req, res) => {
  const property = await createProperty(req.user._id, req.body, req.files ?? []);

  return res.status(201).json({
    success: true,
    message: "Tạo tin đăng thành công.",
    data: { property },
  });
});

export const updatePropertyListing = asyncHandler(async (req, res) => {
  const property = await updateProperty(
    req.params.propertyId,
    req.user,
    req.body,
    req.files ?? [],
  );

  return res.status(200).json({
    success: true,
    message: "Cập nhật tin đăng thành công.",
    data: { property },
  });
});

export const reviewPropertyListing = asyncHandler(async (req, res) => {
  const property = await updatePropertyStatus(req.params.propertyId, req.user._id, req.body);

  return res.status(200).json({
    success: true,
    message: "Cập nhật trạng thái tin đăng thành công.",
    data: { property },
  });
});
