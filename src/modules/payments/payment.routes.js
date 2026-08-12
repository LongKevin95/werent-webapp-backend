import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import { webhookRateLimit } from "../../middleware/rateLimit.js";
import validate from "../../middleware/validate.js";
import {
  createTopUpCheckout,
  createPaymentOrder,
  getMyWallet,
  getMyPaymentHistory,
  getPackages,
  getPaymentQr,
  sepayIpn,
  sepayWebhook,
} from "./payment.controller.js";
import {
  createPaymentOrderSchema,
  createWalletTopUpCheckoutSchema,
  sepayWebhookSchema,
} from "./payment.schema.js";

const router = Router();

router.get("/packages", getPackages);
router.get("/wallet", requireAuth, getMyWallet);
router.get("/history", requireAuth, getMyPaymentHistory);
router.post("/orders", requireAuth, validate(createPaymentOrderSchema), createPaymentOrder);
router.post(
  "/top-up/checkout",
  requireAuth,
  validate(createWalletTopUpCheckoutSchema),
  createTopUpCheckout,
);
router.get("/orders/:orderId/qr", requireAuth, getPaymentQr);
router.post("/webhook/sepay", webhookRateLimit, validate(sepayWebhookSchema), sepayWebhook);
router.post("/ipn/sepay", webhookRateLimit, validate(sepayWebhookSchema), sepayIpn);

export default router;
