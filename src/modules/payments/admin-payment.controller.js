import asyncHandler from "../../common/asyncHandler.js";
import * as service from "./admin-payment.service.js";

export const getAdminTransactions = asyncHandler(async (req, res) => {
  const data = await service.listAdminTransactions(req.query);
  res.json({ success: true, message: "Lấy danh sách giao dịch thành công.", data });
});
export const getAdminTransactionDetail = asyncHandler(async (req, res) => {
  const item = await service.getAdminTransaction(req.params.transactionId);
  res.json({ success: true, message: "Lấy chi tiết giao dịch thành công.", data: { item } });
});
export const createBalanceAdjustment = asyncHandler(async (req, res) => {
  const item = await service.adjustBalance(req.user._id, req.body);
  res.status(201).json({ success: true, message: "Điều chỉnh số dư thành công và đã ghi nhật ký.", data: { item } });
});
export const getPromotions = asyncHandler(async (req, res) => {
  const items = await service.listPromotions();
  res.json({ success: true, message: "Lấy danh sách khuyến mãi thành công.", data: { items } });
});
export const postPromotion = asyncHandler(async (req, res) => {
  const item = await service.createPromotion(req.user._id, req.body);
  res.status(201).json({ success: true, message: "Tạo khuyến mãi nạp tiền thành công.", data: { item } });
});
export const patchPromotion = asyncHandler(async (req, res) => {
  const item = await service.updatePromotion(req.params.promotionId, req.body);
  res.json({ success: true, message: "Cập nhật khuyến mãi thành công.", data: { item } });
});
