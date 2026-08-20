import ApiError from "../../common/ApiError.js";
import { ORDER_STATUS } from "../../common/constants.js";
import env from "../../config/env.js";
import {
  buildSepayCheckoutFields,
  buildSepayQrPayload,
  fetchSepayTransactions,
  normalizeSepayTransaction,
  verifySepayIpnSecret,
  verifySepaySignature,
} from "../../services/sepay.service.js";
import PaymentOrder from "./payment.model.js";
import {
  sendTopUpFailedNotification,
  sendTopUpSuccessNotification,
} from "../notifications/notification.service.js";
import User from "../users/user.model.js";
import {
  buildLockedTopupPromotionFields,
  refreshTopupPromotionFields,
} from "./topup-promotion.service.js";
import { creditWalletTopUp } from "./wallet.service.js";
import { createMomoPayment, verifyMomoIpn } from "../../services/momo.service.js";

const PACKAGE_CATALOG = Object.freeze([
  { code: "basic_7d", name: "Gói Basic 7 ngày", amount: 49_000 },
  { code: "premium_30d", name: "Gói Premium 30 ngày", amount: 199_000 },
]);

function getPackageByCode(packageCode) {
  return PACKAGE_CATALOG.find((item) => item.code === packageCode) ?? null;
}

function createPaymentExpiryDate() {
  return new Date(Date.now() + env.SEPAY_PAYMENT_EXPIRY_MINUTES * 60 * 1000);
}

function normalizeCallbackOrigin(origin) {
  if (typeof origin !== "string") return "";
  const trimmedOrigin = origin.trim().replace(/\/+$/, "");
  if (!trimmedOrigin) return "";
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
  const errorUrl = new URL(baseUrl);
  const cancelUrl = new URL(baseUrl);
  successUrl.searchParams.set("payment", "success");
  errorUrl.searchParams.set("payment", "error");
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

async function buildTopupFields(userId, amount, options = {}) {
  const promotionFields = await buildLockedTopupPromotionFields(
    userId,
    amount,
    {
      promotionIds: options.promotionIds,
    },
  );
  return {
    transactionType: "topup",
    orderType: "wallet_top_up",
    amount,
    baseAmount: amount,
    ...promotionFields,
  };
}

async function assertUniqueProviderTransaction(order, transactionId) {
  if (!transactionId) return;
  const duplicate = await PaymentOrder.findOne({
    providerTransactionId: String(transactionId),
    _id: { $ne: order._id },
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "Giao dịch từ cổng thanh toán đã được ghi nhận cho đơn khác.",
    );
  }
}

function isWalletTopUpOrder(order) {
  return (
    order.transactionType === "topup" || order.orderType === "wallet_top_up"
  );
}

function mapFailedOrderStatus(status) {
  return ["cancel", "cancelled", "canceled"].includes(
    String(status ?? "").toLowerCase(),
  )
    ? ORDER_STATUS.CANCELED
    : ORDER_STATUS.FAILED;
}

async function finalizeFailedOrder(order, transaction, providerOrderId = null) {
  if (order.status === ORDER_STATUS.PAID) {
    return order;
  }

  const shouldNotify = ![ORDER_STATUS.FAILED, ORDER_STATUS.CANCELED].includes(
    order.status,
  );

  order.status = mapFailedOrderStatus(transaction.status);
  order.providerOrderId = providerOrderId ?? order.providerOrderId;
  order.providerTransactionId =
    transaction.transactionId ?? order.providerTransactionId;
  order.rawWebhookPayload = transaction.rawPayload;
  await order.save();

  if (!shouldNotify || !isWalletTopUpOrder(order)) {
    return order;
  }

  const user = await User.findById(order.user);
  await sendTopUpFailedNotification(user, order).catch(() => null);
  return order;
}

async function finalizePaidOrder(order) {
  if (!isWalletTopUpOrder(order)) {
    order.creditedAt = order.creditedAt ?? order.paidAt ?? new Date();
    await order.save();
    return order;
  }

  if (order.creditedAt) {
    return order;
  }

  await refreshTopupPromotionFields(order);
  await order.save();
  const totals = await creditWalletTopUp(order);
  const balanceAfter =
    (totals.walletBalance ?? 0) + (totals.walletPromotionBalance ?? 0);
  order.balanceAfter = balanceAfter;
  order.balanceBefore = balanceAfter - (order.totalCredit || order.amount);
  order.creditedAt = order.creditedAt ?? new Date();
  await order.save();

  const user = await User.findById(order.user);
  await sendTopUpSuccessNotification(user, order).catch(() => null);

  return order;
}

async function findSepayTransactionByOrderCode(orderCode) {
  const transactions = await fetchSepayTransactions({ q: orderCode });
  const matchedTransaction = transactions.find((transaction) => {
    const normalized = normalizeSepayTransaction(transaction);
    return normalized.orderCode === orderCode;
  });

  return matchedTransaction
    ? normalizeSepayTransaction(matchedTransaction)
    : null;
}

export async function reconcileTopupOrder(userId, orderCode) {
  const order = await PaymentOrder.findOne({ user: userId, orderCode });

  if (!order) {
    throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  }

  if (!isWalletTopUpOrder(order)) {
    throw new ApiError(400, "Chỉ hỗ trợ đối soát cho giao dịch nạp tiền ví.");
  }

  if (order.status === ORDER_STATUS.PAID && order.creditedAt) {
    return { order, reconciled: true, matched: false };
  }

  if (!env.SEPAY_API_TOKEN) {
    return { order, reconciled: false, matched: false, skipped: true };
  }

  const transaction = await findSepayTransactionByOrderCode(orderCode);

  if (!transaction) {
    return { order, reconciled: false, matched: false };
  }

  if (transaction.status !== "paid") {
    return { order, reconciled: false, matched: true };
  }

  if (Number(transaction.amount) < Number(order.amount)) {
    throw new ApiError(400, "Số tiền nhận được không đủ cho giao dịch.");
  }

  const paidAt = new Date();
  const claimedOrder = await PaymentOrder.findOneAndUpdate(
    { _id: order._id, status: { $ne: ORDER_STATUS.PAID } },
    {
      $set: {
        status: ORDER_STATUS.PAID,
        paidAt,
        confirmedAt: paidAt,
        providerTransactionId: transaction.transactionId,
        rawWebhookPayload: transaction.rawPayload,
      },
    },
    { returnDocument: "after" },
  );

  const finalizedOrder = await finalizePaidOrder(
    claimedOrder ?? (await PaymentOrder.findById(order._id)),
  );

  return { order: finalizedOrder, reconciled: true, matched: true };
}

export function listPackages() {
  return PACKAGE_CATALOG;
}

export async function createOrder(userId, payload) {
  const selectedPackage = getPackageByCode(payload.packageCode);
  if (!selectedPackage)
    throw new ApiError(404, "Không tìm thấy gói thanh toán.");
  return PaymentOrder.create({
    user: userId,
    packageCode: selectedPackage.code,
    packageName: selectedPackage.name,
    amount: selectedPackage.amount,
    baseAmount: selectedPackage.amount,
    bonusAmount: 0,
    totalCredit: 0,
    transactionType: "package_payment",
    orderType: "package",
    orderCode: `WR-${Date.now()}`,
    expiresAt: createPaymentExpiryDate(),
  });
}

export async function createWalletTopUpCheckout(user, payload, options = {}) {
  const orderCode = buildWalletTopUpOrderCode();
  const note = payload.note?.trim() ?? "";
  const topupFields = await buildTopupFields(user._id, payload.amount, {
    promotionIds: payload.promotionIds,
  });
  const order = await PaymentOrder.create({
    ...topupFields,
    user: user._id,
    packageCode: "wallet_top_up",
    packageName: "Nạp tiền ví WeRent",
    orderCode,
    note,
    paymentMethod: payload.paymentMethod === "momo" ? "MOMO" : "BANK_TRANSFER",
    provider: payload.paymentMethod === "momo" ? "momo" : "sepay",
    expiresAt: createPaymentExpiryDate(),
  });
  const callbackUrls = buildWalletCallbackUrls(options.origin, order.orderCode);
  if (payload.paymentMethod === "momo") {
    try {
      const momo = await createMomoPayment({
        amount: order.amount,
        orderId: order.orderCode,
        orderInfo: note || `Nap tien vi WeRent ${order.orderCode}`,
        redirectUrl: callbackUrls.successUrl,
      });
      order.providerOrderId = momo.requestId;
      await order.save();
      return { order, checkout: { method: "REDIRECT", redirectUrl: momo.payUrl, deeplink: momo.deeplink, qrCodeUrl: momo.qrCodeUrl, expiresAt: order.expiresAt } };
    } catch (error) {
      order.status = ORDER_STATUS.FAILED;
      await order.save();
      throw error;
    }
  }
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

export async function handleMomoIpn(payload) {
  if (!verifyMomoIpn(payload)) throw new ApiError(401, "Chữ ký IPN MoMo không hợp lệ.");
  const order = await PaymentOrder.findOne({ orderCode: payload.orderId, provider: "momo" });
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thanh toán MoMo.");
  if (String(payload.partnerCode) !== String(env.MOMO_PARTNER_CODE) || Number(payload.amount) !== Number(order.amount)) {
    throw new ApiError(400, "Thông tin giao dịch MoMo không khớp với đơn hàng.");
  }
  await assertUniqueProviderTransaction(order, payload.transId);
  order.providerTransactionId = payload.transId ? String(payload.transId) : order.providerTransactionId;
  order.rawWebhookPayload = payload;
  if (Number(payload.resultCode) !== 0) {
    if (order.status !== ORDER_STATUS.PAID) order.status = ORDER_STATUS.FAILED;
    await order.save();
    return order;
  }
  if (order.status === ORDER_STATUS.PAID && order.creditedAt) return order;
  order.status = ORDER_STATUS.PAID;
  order.paidAt = order.paidAt ?? new Date();
  order.confirmedAt = order.confirmedAt ?? order.paidAt;
  await order.save();
  return finalizePaidOrder(order);
}

export async function createTopupOrder(userId, payload) {
  const topupFields = await buildTopupFields(userId, payload.amount);
  return PaymentOrder.create({
    ...topupFields,
    user: userId,
    packageCode: "WALLET_TOPUP",
    packageName: "Nạp tiền vào ví WeRent",
    orderCode: `TOPUP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    provider: payload.provider,
    expiresAt: createPaymentExpiryDate(),
  });
}

export async function getOrderQr(userId, orderId) {
  const order = await PaymentOrder.findOne({ _id: orderId, user: userId });
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  return { order, qr: buildSepayQrPayload(order) };
}

export function getPaymentHistory(userId) {
  return PaymentOrder.find({ user: userId }).sort({ createdAt: -1 });
}

export async function handleSepayWebhook(
  payload,
  signature,
  signedPayload = payload,
) {
  if (!verifySepaySignature(signedPayload, signature))
    throw new ApiError(401, "Webhook signature không hợp lệ.");
  const transaction = normalizeSepayTransaction(payload);
  if (!transaction.orderCode)
    throw new ApiError(400, "Webhook không có orderCode.");
  const order = await PaymentOrder.findOne({
    orderCode: transaction.orderCode,
  });
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  await assertUniqueProviderTransaction(order, transaction.transactionId);

  if (transaction.status !== "paid") {
    return finalizeFailedOrder(order, transaction);
  }
  if (Number(transaction.amount) < Number(order.amount))
    throw new ApiError(400, "Số tiền nhận được không đủ cho giao dịch.");
  if (order.status === ORDER_STATUS.PAID && order.creditedAt) return order;

  const paidAt = new Date();
  const claimedOrder = await PaymentOrder.findOneAndUpdate(
    { _id: order._id, status: { $ne: ORDER_STATUS.PAID } },
    {
      $set: {
        status: ORDER_STATUS.PAID,
        paidAt,
        confirmedAt: paidAt,
        providerTransactionId: transaction.transactionId,
        rawWebhookPayload: transaction.rawPayload,
      },
    },
    { returnDocument: "after" },
  );
  return finalizePaidOrder(
    claimedOrder ?? (await PaymentOrder.findById(order._id)),
  );
}

export async function handleSepayIpn(payload, secret) {
  if (!verifySepayIpnSecret(secret))
    throw new ApiError(401, "IPN secret không hợp lệ.");
  const transaction = normalizeSepayTransaction(payload);
  if (!transaction.orderCode)
    throw new ApiError(400, "IPN không có mã đơn hàng.");
  const order = await PaymentOrder.findOne({
    orderCode: transaction.orderCode,
  });
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thanh toán.");
  if (Number(transaction.amount) !== Number(order.amount))
    throw new ApiError(400, "Số tiền IPN không khớp với đơn thanh toán.");
  await assertUniqueProviderTransaction(order, transaction.transactionId);

  if (transaction.status !== "paid") {
    return finalizeFailedOrder(order, transaction, payload.order?.id ?? null);
  }

  order.providerOrderId = payload.order?.id ?? order.providerOrderId;
  order.providerTransactionId =
    transaction.transactionId ?? order.providerTransactionId;
  order.rawWebhookPayload = transaction.rawPayload;
  if (order.status === ORDER_STATUS.PAID && order.creditedAt) return order;
  order.status = ORDER_STATUS.PAID;
  order.paidAt = order.paidAt ?? new Date();
  order.confirmedAt = order.confirmedAt ?? order.paidAt;
  await order.save();
  return finalizePaidOrder(order);
}
