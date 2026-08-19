import crypto from "node:crypto";
import env from "../config/env.js";

const SEPAY_SIGNED_CHECKOUT_FIELDS = [
  "order_amount",
  "merchant",
  "currency",
  "operation",
  "order_description",
  "order_invoice_number",
  "customer_id",
  "payment_method",
  "success_url",
  "error_url",
  "cancel_url",
];

export function verifySepaySignature(payload, signature = "") {
  if (!env.SEPAY_WEBHOOK_SECRET) {
    return true;
  }

  const rawPayload = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const digest = crypto
    .createHmac("sha256", env.SEPAY_WEBHOOK_SECRET)
    .update(rawPayload)
    .digest("hex");

  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(String(signature), "utf8");
  return (
    digestBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(digestBuffer, signatureBuffer)
  );
}

export function verifySepayIpnSecret(secret = "") {
  if (!env.SEPAY_IPN_SECRET) {
    return true;
  }

  const expectedSecret = Buffer.from(env.SEPAY_IPN_SECRET);
  const receivedSecret = Buffer.from(secret);

  if (expectedSecret.length !== receivedSecret.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedSecret, receivedSecret);
}

export function signSepayCheckoutFields(fields) {
  if (!env.SEPAY_SECRET_KEY) {
    throw new Error("SEPAY_SECRET_KEY is required to create checkout fields.");
  }

  const signedString = SEPAY_SIGNED_CHECKOUT_FIELDS.filter(
    (field) => fields[field] !== undefined && fields[field] !== null,
  )
    .map((field) => `${field}=${fields[field]}`)
    .join(",");

  return crypto
    .createHmac("sha256", env.SEPAY_SECRET_KEY)
    .update(signedString)
    .digest("base64");
}

export function buildSepayCheckoutFields({
  amount,
  cancelUrl,
  customerId,
  description,
  errorUrl,
  invoiceNumber,
  paymentMethod = "BANK_TRANSFER",
  successUrl,
}) {
  if (!env.SEPAY_MERCHANT_ID) {
    throw new Error("SEPAY_MERCHANT_ID is required to create checkout fields.");
  }

  const fields = {
    order_amount: String(amount),
    merchant: env.SEPAY_MERCHANT_ID,
    currency: env.SEPAY_CURRENCY,
    operation: "PURCHASE",
    order_description: description,
    order_invoice_number: invoiceNumber,
    customer_id: customerId,
    payment_method: paymentMethod,
    success_url: successUrl,
    error_url: errorUrl,
    cancel_url: cancelUrl,
  };

  return {
    ...fields,
    signature: signSepayCheckoutFields(fields),
  };
}

export function normalizeSepayTransaction(payload = {}) {
  if (payload.order || payload.transaction) {
    return {
      orderCode: payload.order?.order_invoice_number ?? null,
      transactionId:
        payload.transaction?.transaction_id ?? payload.transaction?.id ?? null,
      amount: Number(
        payload.transaction?.transaction_amount ??
          payload.order?.order_amount ??
          0,
      ),
      status:
        payload.notification_type === "ORDER_PAID" ||
        payload.order?.order_status === "CAPTURED" ||
        payload.transaction?.transaction_status === "APPROVED"
          ? "paid"
          : "failed",
      content: payload.order?.order_description ?? "",
      rawPayload: payload,
    };
  }

  return {
    orderCode:
      payload.orderCode ?? payload.code ?? payload.reference ?? payload.content ?? null,
    transactionId:
      payload.transactionId ?? payload.gatewayTransactionId ?? payload.id ?? null,
    amount: Number(payload.amount ?? payload.transferAmount ?? 0),
    status: String(payload.status ?? "paid").toLowerCase(),
    content: payload.content ?? payload.description ?? "",
    rawPayload: payload,
  };
}

export function buildSepayQrPayload(order) {
  return {
    bankBin: env.SEPAY_BANK_BIN ?? null,
    bankAccount: env.SEPAY_BANK_ACCOUNT ?? null,
    accountName: env.SEPAY_BANK_ACCOUNT_NAME ?? null,
    amount: order.amount,
    content: order.orderCode,
  };
}
