import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let token = null;
let tokenExpiresAt = 0;

function logDebug(...args) {
  if (process.env.DEBUG_AUTH === "1") {
    // Pazimo da ne logamo lozinku
    console.log("[auth]", ...args);
  }
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeToken(raw) {
  if (!raw) throw new Error("No token in login response");

  let t = String(raw).trim();

  // Ako je JSON string sa navodnicima, skini ih:  e.g.  "\"eyJhbGci...\""
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // Ako je objekat "Bearer xxx" – ne dodaj ponovo prefix
  if (/^Bearer\s+/i.test(t)) return t;

  return `Bearer ${t}`;
}

function decodeJwtExp(authHeaderValue) {
  // prima "Bearer xxx.yyy.zzz" ili "xxx.yyy.zzz"
  const parts = authHeaderValue.replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    if (payload && typeof payload.exp === "number") {
      return payload.exp * 1000; // ms
    }
  } catch {}
  return null;
}

async function login() {
  const res = await fetch(process.env.EXT_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      username: process.env.EXT_USERNAME,
      password: process.env.EXT_PASSWORD,
    }),
  });

  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!res.ok) {
    logDebug("login failed", res.status, raw.slice(0, 200));
    throw new Error(`Login failed: ${res.status}`);
  }

  // Podržimo više formata: plain string, JSON string, ili JSON objekt sa poljem
  let tok;
  if (ct.includes("application/json")) {
    const parsed = tryParseJSON(raw);
    if (typeof parsed === "string") tok = parsed;
    else if (
      parsed &&
      (parsed.token || parsed.jwt || parsed.access_token || parsed.accessToken)
    ) {
      tok =
        parsed.token || parsed.jwt || parsed.access_token || parsed.accessToken;
    } else {
      // ako je ipak plain tekst sa JSON headerom
      tok = raw;
    }
  } else {
    tok = raw;
  }

  const authHeader = normalizeToken(tok);
  token = authHeader;

  // expiraciju odredi iz JWT-a, ako može; fallback 50 min
  const expMS = decodeJwtExp(authHeader);
  tokenExpiresAt =
    expMS && expMS > Date.now()
      ? expMS - 30 * 1000
      : Date.now() + 50 * 60 * 1000;

  logDebug(
    "login ok; header:",
    authHeader.slice(0, 16) + "...",
    "expAt:",
    new Date(tokenExpiresAt).toISOString()
  );
  return token;
}

async function getToken() {
  if (token && Date.now() < tokenExpiresAt) return token;
  return login();
}

async function authFetch(url, opts = {}, retryOnce = true) {
  const tk = await getToken();
  const headers = {
    ...(opts.headers || {}),
    Accept: "application/json",
    Authorization: tk, // već uključuje "Bearer "
  };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401 && retryOnce) {
    logDebug("401 on", url, "→ retrying with fresh login");
    await login();
    const headers2 = {
      ...(opts.headers || {}),
      Accept: "application/json",
      Authorization: token,
    };
    return fetch(url, { ...opts, headers: headers2 });
  }
  return res;
}

/**
 * Očekuješ array objekata sa TVOJIM poljima:
 *   parkingId, parkingName, cityName, zoneName, zoneColor,
 *   numberOfParkingPlaces, totalNumberOfRegularPlaces, freeNumberOfRegularPlaces,
 *   totalNumberOfSpecialPlaces, freeNumberOfSpecialPlaces,
 *   parkingTypeId, locationId, longitude, latitude, parkingAddress
 */
export async function fetchParkingsFromSource() {
  const res = await authFetch(process.env.EXT_DATA_URL);
  const text = await res.text();
  if (!res.ok) {
    logDebug("data fetch failed", res.status, text.slice(0, 200));
    throw new Error(`Data fetch failed: ${res.status}`);
  }
  const data = tryParseJSON(text);
  if (!Array.isArray(data)) throw new Error("Expected array of parkings");
  return data;
}

export async function fetchParkingsFindAll() {
  const res = await authFetch(process.env.EXT_DATA_URL);
  const text = await res.text();
  if (!res.ok) {
    logDebug("find-all failed", res.status, text.slice(0, 200));
    throw new Error(`Data fetch failed: ${res.status}`);
  }
  const data = tryParseJSON(text);
  if (!Array.isArray(data))
    throw new Error("Expected array from /parking/find-all");
  return data;
}

export async function fetchParkingById(parkingId) {
  const url = `${process.env.EXT_FIND_BY_ID_URL}?parkingId=${encodeURIComponent(
    parkingId
  )}`;
  const res = await authFetch(url);
  const text = await res.text();
  if (!res.ok) {
    logDebug("find-by-id failed", res.status, text.slice(0, 200));
    throw new Error(`find-by-id failed: ${res.status}`);
  }
  const data = tryParseJSON(text);
  return data ?? text;
}
