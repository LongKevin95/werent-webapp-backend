import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import upload from "../../middleware/upload.js";
import validate from "../../middleware/validate.js";
import {
  changeMyPassword,
  getMe,
  updateMe,
  updateMyAvatar,
} from "./user.controller.js";
import { changePasswordSchema, updateProfileSchema } from "./user.schema.js";

const router = Router();

router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", validate(updateProfileSchema), updateMe);
router.patch("/me/avatar", upload.single("avatar"), updateMyAvatar);
router.patch("/me/change-password", validate(changePasswordSchema), changeMyPassword);

export default router;
