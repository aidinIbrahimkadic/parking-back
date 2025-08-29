import { Router } from "express";
import { authRequired, requireSuperadmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createAdminDocument,
  updateAdminDocument,
  deleteAdminDocument,
} from "../controllers/admin.documents.controller.js";

const r = Router();

// CREATE
r.post(
  "/admin/documents",
  authRequired(),
  requireSuperadmin(),
  upload.single("file"), // << VAŽNO: multipart
  createAdminDocument
);

// UPDATE (fajl je opcionalan; ako pošalješ novi - zamijeni)
r.put(
  "/admin/documents/:id",
  authRequired(),
  requireSuperadmin(),
  upload.single("file"), // << VAŽNO: multipart
  updateAdminDocument
);

// DELETE
r.delete(
  "/admin/documents/:id",
  authRequired(),
  requireSuperadmin(),
  deleteAdminDocument
);

export default r;
