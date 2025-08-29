import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../controllers/documents.controller.js";
import { authRequired, requireSuperadmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const r = Router();

// Public
r.get("/documents", asyncHandler(listDocuments));
r.get("/documents/:id", asyncHandler(getDocument));

// Admin (JWT + superadmin)
r.post(
  "/admin/documents",
  authRequired(),
  requireSuperadmin(),
  upload.single("file"),
  asyncHandler(createDocument)
);

r.put(
  "/admin/documents/:id",
  authRequired(),
  requireSuperadmin(),
  upload.single("file"),
  asyncHandler(updateDocument)
);

r.delete(
  "/admin/documents/:id",
  authRequired(),
  requireSuperadmin(),
  asyncHandler(deleteDocument)
);

export default r;
