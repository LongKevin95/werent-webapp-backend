import asyncHandler from "../../common/asyncHandler.js";
import {
  createListingContentCompletion,
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

export const generateListingContentWithAi = asyncHandler(async (req, res) => {
  const result = await createListingContentCompletion(req.body);

  return res.status(200).json({
    success: true,
    message:
      req.body.mode === "title"
        ? "AI đã gợi ý tiêu đề tin đăng."
        : "AI đã viết mô tả tin đăng.",
    data: result,
  });
});
