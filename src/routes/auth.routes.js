import { Router } from "express";
import { login, me, changePassword } from "../controllers/auth.controller.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();

r.post("/auth/login", asyncHandler(login));
r.get("/auth/me", authRequired(), asyncHandler(me));
r.post("/auth/change-password", authRequired(), asyncHandler(changePassword));

export default r;
