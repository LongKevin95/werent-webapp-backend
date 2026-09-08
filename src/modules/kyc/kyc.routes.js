import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requireRegularUser from "../../middleware/regularUser.js";
import { verificationUpload } from "../../middleware/upload.js";
import validate from "../../middleware/validate.js";
import {
  getMyAccountKyc,
  getMyListingVerification,
  submitMyAccountKyc,
  submitMyListingVerification,
} from "./kyc.controller.js";
import { submitAccountKycSchema, submitListingVerificationSchema } from "./kyc.schema.js";

const router = Router();
router.use(requireAuth);
router.use(requireRegularUser);
router.get("/account", getMyAccountKyc);
router.post(
  "/account",
  verificationUpload.fields([
    { name: "identityFront", maxCount: 1 },
    { name: "identityBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]),
  validate(submitAccountKycSchema),
  submitMyAccountKyc,
);
router.get("/listings/:propertyId", getMyListingVerification);
router.post(
  "/listings/:propertyId",
  verificationUpload.array("documents", 10),
  validate(submitListingVerificationSchema),
  submitMyListingVerification,
);
export default router;
