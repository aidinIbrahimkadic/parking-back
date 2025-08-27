import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { metadata } from "../controllers/meta.controller.js";

const r = Router();
r.get("/metadata", asyncHandler(metadata));
export default r;
