import ApiError from "../../common/ApiError.js";
import { ORDER_STATUS } from "../../common/constants.js";
import {
  buildSepayQrPayload,
  normalizeSepayTransaction,
  verifySepaySignature,
} from "../../services/sepay.service.js";
import PaymentOrder from "./payment.model.js";

const PACKAGE_CATALOG = Object.freeze([
  {
    code: "basic_7d",
    name: "Gói Basic 7 ngày",
    amount: 49000,
  },
  {
    code: "premium_30d",
    name: "Gói Premium 30 ngày",
    amount: 199000,
  },
]);

function getPackageByCode(packageCode) {
  return PACKAGE_CATALOG.find((item) => item.code === packageCode) ?? null;
}

export function listPackages() {
  return PACKAGE_CATALOG;
}

export async function createOrder(userId, payload) {
  const selectedPackage = getPackageByCode(payload.packageCode);

  if (!selectedPackage) {
    throw new ApiError(404, "Không tìm thấy gói thanh toán.");
  }

  const orderCode = `WR-${Date.now()}`;

  return PaymentOrder.create({
    user: userId,
    packageCode: selectedPackage.code,
    packageName: selectedPackage.name,
    amount: selectedPackage.amount,
    orderCode,
  });
}

export async function getOrderQr(userId, orderId) {
  const order = await PaymentOrder.findOne({ _id: orderId, user: userId });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  }

  return {
    order,
    qr: buildSepayQrPayload(order),
  };
}

export async function getPaymentHistory(userId) {
  return PaymentOrder.find({ user: userId }).sort({ createdAt: -1 });
}

export async function handleSepayWebhook(payload, signature) {
  if (!verifySepaySignature(payload, signature)) {
    throw new ApiError(401, "Webhook signature không hợp lệ.");
  }

  const transaction = normalizeSepayTransaction(payload);

  if (!transaction.orderCode) {
    throw new ApiError(400, "Webhook không có orderCode.");
  }

  const order = await PaymentOrder.findOne({ orderCode: transaction.orderCode });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  }

  order.providerTransactionId = transaction.transactionId;
  order.rawWebhookPayload = transaction.rawPayload;
  order.status = transaction.status === "paid" ? ORDER_STATUS.PAID : ORDER_STATUS.FAILED;
  await order.save();

  return order;
}
