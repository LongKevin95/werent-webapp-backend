import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requireRegularUser from "../../middleware/regularUser.js";
import { webhookRateLimit } from "../../middleware/rateLimit.js";
import validate from "../../middleware/validate.js";
import {
  createPaymentOrder,
  createTopUpCheckout,
  createTopupOrder,
  getCurrentTopUpPromotions,
  getMyPaymentHistory,
  getMyWallet,
  getPackages,
  getPaymentQr,
  reconcileTopUpOrder,
  sepayIpn,
  sepayWebhook,
  momoIpn,
  confirmMomoMockPayment,
} from "./payment.controller.js";
import {
  createPaymentOrderSchema,
  createTopupOrderSchema,
  createWalletTopUpCheckoutSchema,
  reconcileTopupOrderSchema,
  sepayWebhookSchema,
  momoIpnSchema,
} from "./payment.schema.js";

const router = Router();

router.get("/packages", getPackages);
router.get("/wallet", requireAuth, requireRegularUser, getMyWallet);
router.get(
  "/top-up/promotions",
  requireAuth,
  requireRegularUser,
  getCurrentTopUpPromotions,
);
router.get("/history", requireAuth, requireRegularUser, getMyPaymentHistory);
router.post(
  "/orders",
  requireAuth,
  requireRegularUser,
  validate(createPaymentOrderSchema),
  createPaymentOrder,
);
router.post(
  "/top-up/checkout",
  requireAuth,
  requireRegularUser,
  validate(createWalletTopUpCheckoutSchema),
  createTopUpCheckout,
);
router.post(
  "/top-up/reconcile",
  requireAuth,
  requireRegularUser,
  validate(reconcileTopupOrderSchema),
  reconcileTopUpOrder,
);
router.post(
  "/top-up/momo-mock/confirm",
  requireAuth,
  requireRegularUser,
  validate(reconcileTopupOrderSchema),
  confirmMomoMockPayment,
);
router.post(
  "/topups",
  requireAuth,
  requireRegularUser,
  validate(createTopupOrderSchema),
  createTopupOrder,
);
router.get("/orders/:orderId/qr", requireAuth, requireRegularUser, getPaymentQr);
router.post(
  "/webhook/sepay",
  webhookRateLimit,
  validate(sepayWebhookSchema),
  sepayWebhook,
);
router.post(
  "/ipn/sepay",
  webhookRateLimit,
  validate(sepayWebhookSchema),
  sepayIpn,
);
router.post(
  "/ipn/momo",
  webhookRateLimit,
  validate(momoIpnSchema),
  momoIpn,
);

export default router;
