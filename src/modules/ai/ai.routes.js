import { Router } from "express";
import validate from "../../middleware/validate.js";
import {
  searchPropertiesWithAi,
  sendSupportChatMessage,
} from "./ai.controller.js";
import { propertySearchChatSchema, supportChatSchema } from "./ai.schema.js";

const router = Router();

router.post("/chat", validate(supportChatSchema), sendSupportChatMessage);
router.post(
  "/search",
  validate(propertySearchChatSchema),
  searchPropertiesWithAi,
);

export default router;
