// src/config/public.js
export function getAllowedPublicParkings() {
  const raw = process.env.ALLOWED_PUBLIC_PARKINGS || "67,66,70";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
