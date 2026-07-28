import asyncHandler from "../../common/asyncHandler.js";
import { addFavorite, listFavorites, removeFavorite } from "./favorite.service.js";

export const getFavorites = asyncHandler(async (req, res) => {
  const items = await listFavorites(req.user._id);

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách tin yêu thích thành công.",
    data: { items },
  });
});

export const createFavorite = asyncHandler(async (req, res) => {
  const favorite = await addFavorite(req.user._id, req.body.propertyId);

  return res.status(201).json({
    success: true,
    message: "Lưu tin thành công.",
    data: { favorite },
  });
});

export const deleteFavorite = asyncHandler(async (req, res) => {
  await removeFavorite(req.user._id, req.params.propertyId);

  return res.status(200).json({
    success: true,
    message: "Bỏ lưu tin thành công.",
  });
});
