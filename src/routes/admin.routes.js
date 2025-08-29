import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authRequired, requireSuperadmin } from "../middleware/auth.js";
import {
  getMetaSettings,
  updateMetaSettings,
} from "../controllers/admin.meta.controller.js";

const r = Router();
r.use(authRequired(), requireSuperadmin());

r.get("/admin/metadata", asyncHandler(getMetaSettings));
r.put("/admin/metadata", asyncHandler(updateMetaSettings));

export default r;
