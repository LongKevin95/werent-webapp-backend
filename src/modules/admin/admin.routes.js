import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminDashboard,
  getAdminProperties,
  getAdminUser,
  getAdminUsers,
  reviewPropertyByAdmin,
  updateAdminUser,
} from "./admin.controller.js";
import {
  getAdminAccountKycRequest,
  getAdminAccountKycRequests,
  getAdminListingVerificationRequest,
  getAdminListingVerificationRequests,
  reviewAdminAccountKyc,
  reviewAdminListingVerification,
} from "../kyc/kyc.controller.js";
import {
  reviewAccountKycSchema,
  reviewListingVerificationSchema,
} from "../kyc/kyc.schema.js";
import {
  createBalanceAdjustment,
  createDemoTopUp,
  getDemoTopUpQuote,
  getAdminTransactionDetail,
  getAdminTransactions,
  getPromotions,
  patchPromotion,
  postPromotion,
} from "../payments/admin-payment.controller.js";
import {
  adminPaymentQuerySchema,
  balanceAdjustmentSchema,
  createPromotionSchema,
  demoTopUpQuoteSchema,
  demoTopUpSchema,
  updatePromotionSchema,
} from "../payments/admin-payment.schema.js";
import {
  createAdminUserSchema,
  adminPropertyQuerySchema,
  reviewPropertySchema,
  updateAdminUserSchema,
} from "./admin.schema.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/dashboard", getAdminDashboard);
router.get(
  "/properties",
  validate(adminPropertyQuerySchema, "query"),
  getAdminProperties,
);
router.get("/users", getAdminUsers);
router.post("/users", validate(createAdminUserSchema), createAdminUser);
router.get("/users/:userId", getAdminUser);
router.patch("/users/:userId", validate(updateAdminUserSchema), updateAdminUser);
router.delete("/users/:userId", deleteAdminUser);
router.patch("/properties/:propertyId/review", validate(reviewPropertySchema), reviewPropertyByAdmin);
router.get("/kyc/accounts", getAdminAccountKycRequests);
router.get("/kyc/accounts/:requestId", getAdminAccountKycRequest);
router.patch(
  "/kyc/accounts/:requestId/review",
  validate(reviewAccountKycSchema),
  reviewAdminAccountKyc,
);
router.get("/kyc/listings", getAdminListingVerificationRequests);
router.get("/kyc/listings/:requestId", getAdminListingVerificationRequest);
router.patch(
  "/kyc/listings/:requestId/review",
  validate(reviewListingVerificationSchema),
  reviewAdminListingVerification,
);
router.get(
  "/payments/transactions",
  validate(adminPaymentQuerySchema, "query"),
  getAdminTransactions,
);
router.get("/payments/transactions/:transactionId", getAdminTransactionDetail);
router.post(
  "/payments/adjustments",
  validate(balanceAdjustmentSchema),
  createBalanceAdjustment,
);
router.get(
  "/payments/demo-topups/quote",
  validate(demoTopUpQuoteSchema, "query"),
  getDemoTopUpQuote,
);
router.post(
  "/payments/demo-topups",
  validate(demoTopUpSchema),
  createDemoTopUp,
);
router.get("/payments/promotions", getPromotions);
router.post("/payments/promotions", validate(createPromotionSchema), postPromotion);
router.patch(
  "/payments/promotions/:promotionId",
  validate(updatePromotionSchema),
  patchPromotion,
);

export default router;
