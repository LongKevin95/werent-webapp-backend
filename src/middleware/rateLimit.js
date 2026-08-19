import rateLimit from "express-rate-limit";
import env from "../config/env.js";

function buildRateLimit(options) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: options.message,
    },
  });
}

export const apiRateLimit = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 1000 : 100,
  message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
});

export const authRateLimit = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 100 : 20,
  message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
});

export const webhookRateLimit = buildRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "Webhook đang bị giới hạn tạm thời.",
});
