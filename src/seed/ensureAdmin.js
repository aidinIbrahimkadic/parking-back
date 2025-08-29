// // src/seed/ensureAdmin.js
// import { User } from "../models/User.js";
// import { hashPassword } from "../utils/password.js";

// export async function ensureAdmin() {
//   const email = process.env.ADMIN_EMAIL;
//   const password = process.env.ADMIN_PASSWORD;

//   if (!email || !password) {
//     console.warn(
//       "[seed] ADMIN_EMAIL/ADMIN_PASSWORD nisu postavljeni – preskačem seeding admina."
//     );
//     return { created: false, reason: "missing-env" };
//   }

//   let user = await User.findOne({ where: { email } });
//   if (user) {
//     console.log("[seed] Admin već postoji:", email);
//     return { created: false, id: user.id };
//   }

//   const passwordHash = await hashPassword(password);
//   user = await User.create({
//     email,
//     passwordHash,
//     role: "superadmin",
//     isActive: true,
//   });

//   console.log("[seed] Kreiran superadmin:", email);
//   return { created: true, id: user.id };
// }

// src/seed/ensureAdmin.js
import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export async function ensureAdmin() {
  const emailRaw = process.env.ADMIN_EMAIL || "";
  const email = emailRaw.trim().toLowerCase(); // normalize
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  const doReset = String(process.env.ADMIN_PASSWORD_RESET || "").trim() === "1";

  if (!email || !password) {
    console.warn(
      "[seed] ADMIN_EMAIL/ADMIN_PASSWORD nisu postavljeni – preskačem seeding admina."
    );
    return { created: false, updated: false, reason: "missing-env" };
  }

  let user = await User.findOne({ where: { email } });

  // 1) Kreiraj ako ne postoji
  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await User.create({
      email,
      passwordHash,
      role: "superadmin",
      isActive: true,
    });
    console.log("[seed] Kreiran superadmin:", email);
    return { created: true, updated: false, id: user.id };
  }

  // 2) Ako postoji – osiguraj status/ulogu i (opciono) reset lozinke
  let updated = false;

  if (!user.isActive || user.role !== "superadmin") {
    user.isActive = true;
    user.role = "superadmin";
    updated = true;
  }

  if (doReset) {
    // izbjegni re-hash ako je ista lozinka
    const same = await verifyPassword(password, user.passwordHash).catch(
      () => false
    );
    if (!same) {
      user.passwordHash = await hashPassword(password);
      updated = true;
      console.log("[seed] Resetovana lozinka za:", email);
    }
  }

  if (updated) {
    await user.save();
    console.log("[seed] Ažuriran superadmin:", email);
    return { created: false, updated: true, id: user.id };
  }

  console.log("[seed] Admin već postoji i uredan:", email);
  return { created: false, updated: false, id: user.id };
}
