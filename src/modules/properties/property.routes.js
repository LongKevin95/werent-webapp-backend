import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import requireRegularUser from "../../middleware/regularUser.js";
import upload from "../../middleware/upload.js";
import validate from "../../middleware/validate.js";
import {
  createPropertyListing,
  deletePropertyListing,
  getMyProperties,
  getProperties,
  getProperty,
  reviewPropertyListing,
  updatePropertyListing,
} from "./property.controller.js";
import {
  createPropertySchema,
  myPropertyQuerySchema,
  propertyQuerySchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
} from "./property.schema.js";

const router = Router();

router.get("/", validate(propertyQuerySchema, "query"), getProperties);
router.get(
  "/my-listings",
  requireAuth,
  requireRegularUser,
  validate(myPropertyQuerySchema, "query"),
  getMyProperties,
);
router.get("/:propertyId", getProperty);
router.post(
  "/",
  requireAuth,
  requireRegularUser,
  upload.array("images", 10),
  validate(createPropertySchema),
  createPropertyListing,
);
router.patch(
  "/:propertyId",
  requireAuth,
  requireRegularUser,
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
router.delete("/:propertyId", requireAuth, requireRegularUser, deletePropertyListing);

export default router;
