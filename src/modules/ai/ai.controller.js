import asyncHandler from "../../common/asyncHandler.js";
import {
  createPropertySearchCompletion,
  createSupportChatCompletion,
} from "./ai.service.js";

export const sendSupportChatMessage = asyncHandler(async (req, res) => {
  const result = await createSupportChatCompletion(req.body);

  return res.status(200).json({
    success: true,
    message: "Trợ lý AI đã phản hồi.",
    data: result,
  });
});

export const searchPropertiesWithAi = asyncHandler(async (req, res) => {
  const result = await createPropertySearchCompletion(req.body);

  return res.status(200).json({
    success: true,
    message: "Đã tìm tin đăng phù hợp từ dữ liệu WeRent.",
    data: result,
  });
});
