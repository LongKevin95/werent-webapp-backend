import ApiError from "../../common/ApiError.js";
import { ORDER_STATUS } from "../../common/constants.js";
import env from "../../config/env.js";
import {
  buildSepayCheckoutFields,
  buildSepayQrPayload,
  normalizeSepayTransaction,
  verifySepayIpnSecret,
  verifySepaySignature,
} from "../../services/sepay.service.js";
import PaymentOrder from "./payment.model.js";
import { creditWalletTopUp } from "./wallet.service.js";

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

function createPaymentExpiryDate() {
  return new Date(Date.now() + env.SEPAY_PAYMENT_EXPIRY_MINUTES * 60 * 1000);
}

function normalizeCallbackOrigin(origin) {
  if (typeof origin !== "string") {
    return "";
  }

  const trimmedOrigin = origin.trim().replace(/\/+$/, "");

  if (!trimmedOrigin) {
    return "";
  }

  try {
    return new URL(trimmedOrigin).origin;
  } catch {
    return "";
  }
}

function buildWalletCallbackUrls(origin, orderCode) {
  const fallbackOrigin =
    normalizeCallbackOrigin(env.CORS_ORIGIN?.split(",")[0]) ||
    "http://localhost:5173";
  const callbackOrigin = normalizeCallbackOrigin(origin) || fallbackOrigin;
  const baseUrl = new URL("/wallet", callbackOrigin);
  baseUrl.searchParams.set("orderCode", orderCode);

  const successUrl = new URL(baseUrl);
  successUrl.searchParams.set("payment", "success");

  const errorUrl = new URL(baseUrl);
  errorUrl.searchParams.set("payment", "error");

  const cancelUrl = new URL(baseUrl);
  cancelUrl.searchParams.set("payment", "cancel");

  return {
    successUrl: successUrl.toString(),
    errorUrl: errorUrl.toString(),
    cancelUrl: cancelUrl.toString(),
  };
}

function buildWalletTopUpOrderCode() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WRTP-${timestampPart}-${randomPart}`;
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
    expiresAt: createPaymentExpiryDate(),
  });
}

export async function createWalletTopUpCheckout(user, payload, options = {}) {
  const orderCode = buildWalletTopUpOrderCode();
  const note = payload.note?.trim() ?? "";
  const order = await PaymentOrder.create({
    user: user._id,
    packageCode: "wallet_top_up",
    packageName: "Nạp tiền ví WeRent",
    amount: payload.amount,
    orderCode,
    orderType: "wallet_top_up",
    note,
    paymentMethod: "BANK_TRANSFER",
    expiresAt: createPaymentExpiryDate(),
  });
  const callbackUrls = buildWalletCallbackUrls(options.origin, order.orderCode);
  const checkoutFields = buildSepayCheckoutFields({
    amount: order.amount,
    customerId: String(user._id),
    description: note || `Nạp tiền ví WeRent ${order.orderCode}`,
    invoiceNumber: order.orderCode,
    paymentMethod: "BANK_TRANSFER",
    ...callbackUrls,
  });

  return {
    order,
    checkout: {
      actionUrl: env.SEPAY_CHECKOUT_URL,
      method: "POST",
      fields: checkoutFields,
      expiresAt: order.expiresAt,
    },
  };
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

export async function handleSepayIpn(payload, secret) {
  if (!verifySepayIpnSecret(secret)) {
    throw new ApiError(401, "IPN secret không hợp lệ.");
  }

  const transaction = normalizeSepayTransaction(payload);

  if (!transaction.orderCode) {
    throw new ApiError(400, "IPN không có mã đơn hàng.");
  }

  const order = await PaymentOrder.findOne({ orderCode: transaction.orderCode });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  }

  if (Number(transaction.amount) !== Number(order.amount)) {
    throw new ApiError(400, "Số tiền IPN không khớp với đơn thanh toán.");
  }

  order.providerOrderId = payload.order?.id ?? order.providerOrderId;
  order.providerTransactionId =
    transaction.transactionId ?? order.providerTransactionId;
  order.rawWebhookPayload = transaction.rawPayload;

  if (transaction.status === "paid") {
    const wasAlreadyPaid = order.status === ORDER_STATUS.PAID;
    order.status = ORDER_STATUS.PAID;
    order.paidAt = order.paidAt ?? new Date();
    await order.save();

    if (!wasAlreadyPaid && order.orderType === "wallet_top_up") {
      await creditWalletTopUp(order);
    }

    return order;
  } else {
    order.status = ORDER_STATUS.FAILED;
  }

  await order.save();

  return order;
}
