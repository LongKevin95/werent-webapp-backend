import asyncHandler from "../../common/asyncHandler.js";
import {
  createOrder,
  createWalletTopUpCheckout,
  getOrderQr,
  getPaymentHistory,
  handleSepayIpn,
  handleSepayWebhook,
  listPackages,
} from "./payment.service.js";
import { getWalletOverview } from "./wallet.service.js";

export const getPackages = asyncHandler(async (req, res) => {
  const items = listPackages();

  return res.status(200).json({
    success: true,
    message: "Lấy danh sách gói thanh toán thành công.",
    data: { items },
  });
});

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const order = await createOrder(req.user._id, req.body);

  return res.status(201).json({
    success: true,
    message: "Tạo đơn thanh toán thành công.",
    data: { order },
  });
});

export const createTopUpCheckout = asyncHandler(async (req, res) => {
  const data = await createWalletTopUpCheckout(req.user, req.body, {
    origin: req.get("origin"),
  });

  return res.status(201).json({
    success: true,
    message: "Tạo yêu cầu nạp tiền thành công.",
    data,
  });
});

export const getMyPaymentHistory = asyncHandler(async (req, res) => {
  const items = await getPaymentHistory(req.user._id);

  return res.status(200).json({
    success: true,
    message: "Lấy lịch sử thanh toán thành công.",
    data: { items },
  });
});

export const getMyWallet = asyncHandler(async (req, res) => {
  const data = await getWalletOverview(req.user._id);

  return res.status(200).json({
    success: true,
    message: "Lấy thông tin ví thành công.",
    data,
  });
});

export const getPaymentQr = asyncHandler(async (req, res) => {
  const data = await getOrderQr(req.user._id, req.params.orderId);

  return res.status(200).json({
    success: true,
    message: "Tạo thông tin QR thanh toán thành công.",
    data,
  });
});

export const sepayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-sepay-signature"] ?? "";
  const order = await handleSepayWebhook(req.body, String(signature));

  return res.status(200).json({
    success: true,
    message: "Xử lý webhook SePay thành công.",
    data: { order },
  });
});

export const sepayIpn = asyncHandler(async (req, res) => {
  const secret = req.headers["x-secret-key"] ?? "";
  const order = await handleSepayIpn(req.body, String(secret));

  return res.status(200).json({
    success: true,
    message: "Xử lý IPN SePay thành công.",
    data: { order },
  });
});
