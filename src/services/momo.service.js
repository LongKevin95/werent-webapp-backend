import crypto from "node:crypto";
import ApiError from "../common/ApiError.js";
import env from "../config/env.js";

function sign(value) {
  return crypto.createHmac("sha256", env.MOMO_SECRET_KEY).update(value).digest("hex");
}

function requireMomoConfig() {
  if (!env.MOMO_PARTNER_CODE || !env.MOMO_ACCESS_KEY || !env.MOMO_SECRET_KEY || !env.MOMO_IPN_URL) {
    throw new ApiError(503, "Cổng thanh toán MoMo chưa được cấu hình.");
  }
}

export async function createMomoPayment({ amount, orderId, orderInfo, redirectUrl }) {
  requireMomoConfig();
  const requestId = `${orderId}-${Date.now()}`;
  const extraData = "";
  const requestType = "captureWallet";
  const ipnUrl = env.MOMO_IPN_URL;
  const finalRedirectUrl = env.MOMO_REDIRECT_URL || redirectUrl;
  const rawSignature = `accessKey=${env.MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${env.MOMO_PARTNER_CODE}&redirectUrl=${finalRedirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const body = {
    partnerCode: env.MOMO_PARTNER_CODE, requestId, amount, orderId, orderInfo,
    redirectUrl: finalRedirectUrl, ipnUrl, requestType, extraData, lang: "vi",
    signature: sign(rawSignature),
  };
  const response = await fetch(env.MOMO_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.resultCode !== 0 || !payload.payUrl) {
    throw new ApiError(502, payload.message || "MoMo không thể tạo phiên thanh toán.");
  }
  return { requestId, payUrl: payload.payUrl, deeplink: payload.deeplink ?? null, qrCodeUrl: payload.qrCodeUrl ?? null, raw: payload };
}

export function verifyMomoIpn(payload = {}) {
  requireMomoConfig();
  const rawSignature = `accessKey=${env.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData ?? ""}&message=${payload.message ?? ""}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo ?? ""}&orderType=${payload.orderType ?? ""}&partnerCode=${payload.partnerCode}&payType=${payload.payType ?? ""}&requestId=${payload.requestId}&responseTime=${payload.responseTime}&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  const expected = Buffer.from(sign(rawSignature));
  const received = Buffer.from(String(payload.signature ?? ""));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
