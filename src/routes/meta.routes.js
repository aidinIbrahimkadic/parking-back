// src/routes/meta.routes.js
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  metadata,
  getAdminMetadata,
  updateAdminMetadata,
  publicSiteMetadata,
} from "../controllers/meta.controller.js";
import { authRequired, requireSuperadmin } from "../middleware/auth.js";

const r = Router();

// PUBLIC
r.get("/metadata", asyncHandler(metadata));
// PUBLIC (novi "čisti" meta endpoint – ovo koristi FE)
r.get("/site-metadata", asyncHandler(publicSiteMetadata));
// ADMIN (zaštićeno)
r.get(
  "/admin/metadata",
  authRequired(),
  requireSuperadmin(),
  asyncHandler(getAdminMetadata)
);
r.put(
  "/admin/metadata",
  authRequired(),
  requireSuperadmin(),
  asyncHandler(updateAdminMetadata)
);

export default r;
