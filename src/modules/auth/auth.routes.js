import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import validate from "../../middleware/validate.js";
import {
  getCurrentUser,
  login,
  logout,
  register,
  verifyToken,
} from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", authRateLimit, validate(registerSchema), register);
router.post("/login", authRateLimit, validate(loginSchema), login);
router.post("/logout", requireAuth, logout);
router.get("/verify-token", requireAuth, verifyToken);
router.get("/me", requireAuth, getCurrentUser);

export default router;
