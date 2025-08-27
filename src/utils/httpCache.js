import { createHash } from "node:crypto";

function etagFor(key) {
  return '"' + createHash("sha1").update(String(key)).digest("hex") + '"';
}

/**
 * Primijeni ETag/Cache-Control/Last-Modified. Vrati true ako je poslat 304.
 */
export function applyCacheHeaders(
  req,
  res,
  { key, maxAge = 60, lastModified }
) {
  const etag = etagFor(key);
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
  if (lastModified)
    res.setHeader("Last-Modified", new Date(lastModified).toUTCString());

  const inm = req.headers["if-none-match"];
  if (
    inm &&
    inm
      .split(",")
      .map((s) => s.trim())
      .includes(etag)
  ) {
    res.status(304).end();
    return true;
  }
  return false;
}
