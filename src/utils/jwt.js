// src/utils/jwt.js
import jwt from "jsonwebtoken";

const { JWT_SECRET = "dev-secret" } = process.env;

export function signJwt(payload, opts = {}) {
  const { expiresIn = "12h" } = opts;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJwt(token) {
  return jwt.verify(token, JWT_SECRET);
}
