// src/seed/resetAdminPassword.js
import { User } from "../models/User.js";
import { hashPassword } from "../utils/password.js";

export async function resetAdminPasswordIfFlag() {
  const flag = String(process.env.ADMIN_PASSWORD_RESET || "")
    .trim()
    .toLowerCase();
  if (flag !== "1" && flag !== "true") {
    return { skipped: true };
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "[reset-admin] ADMIN_EMAIL/ADMIN_PASSWORD nisu postavljeni – preskačem reset."
    );
    return { created: false, reason: "missing-env" };
  }

  let user = await User.findOne({ where: { email } });

  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await User.create({
      email,
      passwordHash,
      role: "superadmin",
      isActive: true,
    });
    console.log("[reset-admin] Admin nije postojao → kreiran:", email);
    return { created: true, id: user.id };
  }

  user.passwordHash = await hashPassword(password);
  user.lastLoginAt = null;
  await user.save();

  console.log("[reset-admin] Lozinka resetovana za:", email);
  return { ok: true, id: user.id };
}
