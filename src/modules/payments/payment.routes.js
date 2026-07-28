import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import { webhookRateLimit } from "../../middleware/rateLimit.js";
import validate from "../../middleware/validate.js";
import {
  createPaymentOrder,
  getMyPaymentHistory,
  getPackages,
  getPaymentQr,
  sepayWebhook,
} from "./payment.controller.js";
import { createPaymentOrderSchema, sepayWebhookSchema } from "./payment.schema.js";

const router = Router();

router.get("/packages", getPackages);
router.get("/history", requireAuth, getMyPaymentHistory);
router.post("/orders", requireAuth, validate(createPaymentOrderSchema), createPaymentOrder);
router.get("/orders/:orderId/qr", requireAuth, getPaymentQr);
router.post("/webhook/sepay", webhookRateLimit, validate(sepayWebhookSchema), sepayWebhook);

export default router;
