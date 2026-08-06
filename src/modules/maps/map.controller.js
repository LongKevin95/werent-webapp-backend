import asyncHandler from "../../common/asyncHandler.js";
import { autocompletePlaces, reverseGeocodeLocation } from "./map.service.js";

export const autocompleteMapPlaces = asyncHandler(async (req, res) => {
  const places = await autocompletePlaces(req.query);

  return res.status(200).json({
    success: true,
    message: "Lấy gợi ý vị trí thành công.",
    data: { places },
  });
});

export const reverseGeocodeMapLocation = asyncHandler(async (req, res) => {
  const place = await reverseGeocodeLocation(req.query);

  return res.status(200).json({
    success: true,
    message: "Lấy địa chỉ từ tọa độ thành công.",
    data: { place },
  });
});
