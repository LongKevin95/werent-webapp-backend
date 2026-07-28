import { Router } from "express";
import requireAdmin from "../../middleware/admin.js";
import requireAuth from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import { createPropertyReport, getReports } from "./report.controller.js";
import { createReportSchema } from "./report.schema.js";

const router = Router();

router.post("/", requireAuth, validate(createReportSchema), createPropertyReport);
router.get("/", requireAuth, requireAdmin, getReports);

export default router;
