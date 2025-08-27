import cors from "cors";

export function corsAllowlist() {
  const origins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.length === 0) return cors(); // dev: dozvoli sve

  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    maxAge: 86400,
  });
}
