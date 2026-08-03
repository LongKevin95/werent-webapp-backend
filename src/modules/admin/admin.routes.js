import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminDashboard,
  getAdminUser,
  getAdminUsers,
  reviewPropertyByAdmin,
  updateAdminUser,
} from "./admin.controller.js";
import {
  createAdminUserSchema,
  reviewPropertySchema,
  updateAdminUserSchema,
} from "./admin.schema.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/dashboard", getAdminDashboard);
router.get("/users", getAdminUsers);
router.post("/users", validate(createAdminUserSchema), createAdminUser);
router.get("/users/:userId", getAdminUser);
router.patch("/users/:userId", validate(updateAdminUserSchema), updateAdminUser);
router.delete("/users/:userId", deleteAdminUser);
router.patch("/properties/:propertyId/review", validate(reviewPropertySchema), reviewPropertyByAdmin);

export default router;
