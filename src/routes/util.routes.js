import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { health, apiUrl } from "../controllers/util.controller.js";

const r = Router();
r.get("/health", asyncHandler(health));
r.get("/api-url", asyncHandler(apiUrl));
export default r;
