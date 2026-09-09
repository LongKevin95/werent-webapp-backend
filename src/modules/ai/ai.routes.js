import { Router } from "express";
import validate from "../../middleware/validate.js";
import {
  generateListingContentWithAi,
  searchPropertiesWithAi,
  sendSupportChatMessage,
} from "./ai.controller.js";
import {
  listingContentSchema,
  propertySearchChatSchema,
  supportChatSchema,
} from "./ai.schema.js";

const router = Router();

router.post("/chat", validate(supportChatSchema), sendSupportChatMessage);
router.post(
  "/search",
  validate(propertySearchChatSchema),
  searchPropertiesWithAi,
);
router.post(
  "/listing-content",
  validate(listingContentSchema),
  generateListingContentWithAi,
);

export default router;
