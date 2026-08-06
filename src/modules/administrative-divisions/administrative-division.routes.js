import { Router } from "express";
import { getAdministrativeDivisions } from "./administrative-division.controller.js";

const router = Router();

router.get("/", getAdministrativeDivisions);

export default router;
