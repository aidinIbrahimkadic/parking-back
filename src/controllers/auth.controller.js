// // src/controllers/auth.controller.js
// import { User } from "../models/User.js";
// import { verifyPassword } from "../utils/password.js";
// import { signJwt } from "../utils/jwt.js";
// import jwt from "jsonwebtoken";

// export async function login(req, res) {
//   const { email, password } = req.body || {};
//   if (!email || !password) {
//     return res.status(400).json({ error: "Email i lozinka su obavezni." });
//   }

//   const user = await User.findOne({ where: { email } });
//   if (!user || !user.isActive) {
//     return res.status(401).json({ error: "Pogrešni kredencijali." });
//   }

//   const ok = await verifyPassword(password, user.passwordHash);
//   if (!ok) return res.status(401).json({ error: "Pogrešni kredencijali." });

//   // token
//   const token = signJwt(
//     { sub: user.id, role: user.role, email: user.email },
//     { expiresIn: "12h" }
//   );
//   const decoded = jwt.decode(token);

//   // update last login (best-effort)
//   user.lastLoginAt = new Date();
//   await user.save();

//   return res.json({
//     token,
//     expAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
//     user: { id: user.id, email: user.email, role: user.role },
//   });
// }

// export async function me(req, res) {
//   return res.json({
//     user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role },
//   });
// }

// src/controllers/auth.controller.js
import { User } from "../models/User.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { signJwt } from "../utils/jwt.js";
import jwt from "jsonwebtoken";

/** POST /auth/login */
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email i lozinka su obavezni." });
  }

  const user = await User.findOne({
    where: { email: String(email).toLowerCase() },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Pogrešni kredencijali." });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Pogrešni kredencijali." });

  const token = signJwt(
    { sub: user.id, role: user.role, email: user.email },
    { expiresIn: "12h" }
  );
  const decoded = jwt.decode(token);

  user.lastLoginAt = new Date();
  await user.save();

  return res.json({
    token,
    expAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    user: { id: user.id, email: user.email, role: user.role },
  });
}

/** GET /auth/me */
export async function me(req, res) {
  return res.json({
    user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role },
  });
}

/** POST /auth/change-password (authRequired) */
export async function changePassword(req, res) {
  const userId = req.auth?.userId;
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Trenutna i nova lozinka su obavezne." });
  }
  if (String(newPassword).length < 8) {
    return res
      .status(400)
      .json({ error: "Nova lozinka mora imati najmanje 8 karaktera." });
  }

  const user = await User.findByPk(userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Korisnik nije aktivan." });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok)
    return res.status(401).json({ error: "Trenutna lozinka nije ispravna." });

  if (await verifyPassword(newPassword, user.passwordHash)) {
    return res
      .status(400)
      .json({ error: "Nova lozinka ne može biti ista kao stara." });
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  return res.json({ ok: true, message: "Lozinka uspješno promijenjena." });
}
