import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import upload from "../../middleware/upload.js";
import validate from "../../middleware/validate.js";
import {
  createPropertyListing,
  getProperties,
  getProperty,
  reviewPropertyListing,
  updatePropertyListing,
} from "./property.controller.js";
import {
  createPropertySchema,
  propertyQuerySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
} from "./property.schema.js";

const router = Router();

router.get("/", validate(propertyQuerySchema, "query"), getProperties);
router.get("/:propertyId", getProperty);
router.post(
  "/",
  requireAuth,
  upload.array("images", 10),
  validate(createPropertySchema),
  createPropertyListing,
);
router.patch(
  "/:propertyId",
  requireAuth,
  upload.array("images", 10),
  validate(updatePropertySchema),
  updatePropertyListing,
);
router.patch(
  "/:propertyId/status",
  requireAuth,
  requireAdmin,
  validate(updatePropertyStatusSchema),
  reviewPropertyListing,
);

export default router;
