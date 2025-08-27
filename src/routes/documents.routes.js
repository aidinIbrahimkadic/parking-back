import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listDocuments,
  getDocument,
} from "../controllers/documents.controller.js";

const r = Router();
r.get("/documents", asyncHandler(listDocuments));
r.get("/documents/:id", asyncHandler(getDocument));
export default r;
