import { Router } from "express";
import validate from "../../middleware/validate.js";
import {
  autocompleteMapPlaces,
  reverseGeocodeMapLocation,
} from "./map.controller.js";
import {
  mapAutocompleteQuerySchema,
  mapReverseQuerySchema,
} from "./map.schema.js";

const router = Router();

router.get(
  "/autocomplete",
  validate(mapAutocompleteQuerySchema, "query"),
  autocompleteMapPlaces,
);
router.get(
  "/reverse",
  validate(mapReverseQuerySchema, "query"),
  reverseGeocodeMapLocation,
);

export default router;
