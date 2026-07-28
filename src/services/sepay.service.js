import crypto from "node:crypto";
import env from "../config/env.js";

export function verifySepaySignature(payload, signature = "") {
  if (!env.SEPAY_WEBHOOK_SECRET) {
    return true;
  }

  const rawPayload = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  const digest = crypto
    .createHmac("sha256", env.SEPAY_WEBHOOK_SECRET)
    .update(rawPayload)
    .digest("hex");

  return digest === signature;
}

export function normalizeSepayTransaction(payload = {}) {
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
