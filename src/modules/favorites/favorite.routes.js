import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requireRegularUser from "../../middleware/regularUser.js";
import validate from "../../middleware/validate.js";
import {
  createFavorite,
  deleteFavorite,
  getFavorites,
} from "./favorite.controller.js";
import { favoritePropertySchema } from "./favorite.schema.js";

const router = Router();

router.use(requireAuth);
router.use(requireRegularUser);
router.get("/", getFavorites);
router.post("/", validate(favoritePropertySchema), createFavorite);
router.delete("/:propertyId", deleteFavorite);

export default router;
