import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import validate from "../../middleware/validate.js";
import {
  getCurrentUser,
  googleLogin,
  login,
  logout,
  register,
  verifyToken,
} from "./auth.controller.js";
import { googleAuthSchema, loginSchema, registerSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", authRateLimit, validate(registerSchema), register);
router.post("/login", authRateLimit, validate(loginSchema), login);
router.post("/google", authRateLimit, validate(googleAuthSchema), googleLogin);
router.post("/logout", requireAuth, logout);
router.get("/verify-token", requireAuth, verifyToken);
router.get("/me", requireAuth, getCurrentUser);

export default router;
