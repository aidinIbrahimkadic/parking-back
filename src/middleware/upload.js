import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PUBLIC_BASE = process.env.UPLOADS_PUBLIC_BASE || "/uploads";
const UPLOAD_ROOT = path.resolve(process.cwd(), PUBLIC_BASE.replace(/^\//, ""));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join(
      UPLOAD_ROOT,
      "documents",
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, "0")
    );
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const name = crypto.randomBytes(10).toString("hex") + ext.toLowerCase();
    cb(null, name);
  },
});

export const upload = multer({ storage });

/** Pretvori apsolutnu putanju u relativni public URL (npr. "/uploads/...") */
export function toPublicUrl(absPath) {
  const relFromCwd = path
    .relative(path.resolve(process.cwd()), absPath)
    .replace(/\\/g, "/");
  return "/" + relFromCwd;
}

/** Iz public URL-a vrati apsolutnu putanju na disku (za brisanje fajla) */
export function fromPublicUrl(publicUrl) {
  const clean = String(publicUrl || "").replace(/^\/+/, "");
  return path.resolve(path.resolve(process.cwd()), clean);
}

/** Napravi apsolutni URL (sa shemom i hostom) iz public URL-a */
export function publicUrlAbs(req, publicUrl) {
  if (!publicUrl) return publicUrl;
  // Ako već izgleda apsolutno, ostavi tako
  if (/^https?:\/\//i.test(publicUrl)) return publicUrl;

  const proto =
    (req.headers["x-forwarded-proto"] &&
      String(req.headers["x-forwarded-proto"]).split(",")[0]) ||
    req.protocol ||
    "http";
  const host =
    (req.headers["x-forwarded-host"] &&
      String(req.headers["x-forwarded-host"]).split(",")[0]) ||
    req.get("host");

  return `${proto}://${host}${publicUrl}`;
}
