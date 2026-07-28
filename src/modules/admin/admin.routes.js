import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import {
  getAdminDashboard,
  getAdminUsers,
  reviewPropertyByAdmin,
} from "./admin.controller.js";
import { reviewPropertySchema } from "./admin.schema.js";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/dashboard", getAdminDashboard);
router.get("/users", getAdminUsers);
router.patch("/properties/:propertyId/review", validate(reviewPropertySchema), reviewPropertyByAdmin);

export default router;
