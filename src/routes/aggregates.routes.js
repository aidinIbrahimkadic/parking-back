import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listDaily,
  listMonthly,
} from "../controllers/aggregates.controller.js";

const r = Router();

r.get("/stats/daily", asyncHandler(listDaily));
r.get("/stats/monthly", asyncHandler(listMonthly));

export default r;
