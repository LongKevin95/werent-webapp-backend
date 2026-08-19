import { Router } from "express";
import validate from "../../middleware/validate.js";
import { listSearchSuggestions } from "./search-suggestion.controller.js";
import { searchSuggestionQuerySchema } from "./search-suggestion.schema.js";

const router = Router();

router.get(
  "/suggestions",
  validate(searchSuggestionQuerySchema, "query"),
  listSearchSuggestions,
);

export default router;
