import express from "express";
import { sendTestNotification } from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/test", sendTestNotification);

export default router;
