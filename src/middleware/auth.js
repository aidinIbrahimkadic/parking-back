// src/middleware/auth.js
import { verifyJwt } from "../utils/jwt.js";
import { User } from "../models/User.js";

export function authRequired() {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization || "";
      const [, token] = hdr.split(" ");
      if (!token) return res.status(401).json({ error: "Missing token" });

      const decoded = verifyJwt(token);
      // opcionalno: provjeri usera u bazi
      const user = await User.findByPk(decoded.sub);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid user" });
      }

      req.auth = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

export function requireSuperadmin() {
  return (req, res, next) => {
    if (req.auth?.role !== "superadmin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
