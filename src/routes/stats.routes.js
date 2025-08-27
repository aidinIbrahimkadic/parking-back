import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { peaks } from "../controllers/stats.controller.js";

const r = Router();
r.get("/stats/peaks", asyncHandler(peaks));
export default r;
