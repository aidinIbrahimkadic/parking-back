import { Op } from "sequelize";
import { Parking } from "../models/Parking.js";
import { ParkingDaily } from "../models/ParkingDaily.js";
import { ParkingMonthly } from "../models/ParkingMonthly.js";
import { applyCacheHeaders } from "../utils/httpCache.js";
import { setPaginationLinks } from "../utils/pagination.js";

const S_NUM = new Set([
  "samples",
  "occ_avg",
  "occ_max",
  "occ_min",
  "free_total_avg",
  "free_total_min",
  "free_total_max",
]);

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseCsvIds(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePagination(query, defSize = 50, maxSize = 200) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const size = Math.min(
    maxSize,
    Math.max(1, parseInt(query.pageSize, 10) || defSize)
  );
  const start = (page - 1) * size;
  return { page, size, start };
}

function defaultDailyRange() {
  // zadnjih 30 dana (UTC granice dana)
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to.getTime() - 30 * 864e5);
  return { from, to };
}

function yyyymm(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}
function defaultMonthlyRange() {
  // zadnjih 12 mjeseci (YYYY-MM inkluzivno)
  const end = new Date();
  const endYm = yyyymm(end);
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1)
  );
  const startYm = yyyymm(start);
  return { startYm, endYm };
}

function sanitizeSort(sort, allowed) {
  return allowed.includes(sort) ? sort : allowed[0];
}

function sortRows(rows, sort, order) {
  const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const va = a[sort];
    const vb = b[sort];
    if (typeof va === "string" && typeof vb === "string")
      return va.localeCompare(vb) * dir;
    return ((va > vb) - (va < vb)) * dir;
  });
}

export async function listDaily(req, res) {
  const {
    q = "",
    parkingId,
    zoneName,
    parkingTypeId,
    from,
    to,
    sort = "day",
    order = "asc",
  } = req.query;

  const { page, size, start } = parsePagination(req.query, 100);

  // 1) Filtriraj parkinge (meta)
  const pWhere = {};
  if (q)
    pWhere[Op.or] = [
      { parkingName: { [Op.like]: `%${q}%` } },
      { parkingAddress: { [Op.like]: `%${q}%` } },
    ];
  if (zoneName) pWhere.zoneName = zoneName;
  if (parkingTypeId) pWhere.parkingTypeId = parkingTypeId;

  const idsFilter = parseCsvIds(parkingId);
  if (idsFilter) pWhere.parkingId = { [Op.in]: idsFilter };

  const parks = await Parking.findAll({
    where: pWhere,
    attributes: ["id", "parkingId", "parkingName"],
  });
  if (!parks.length) {
    return res.json({ page, pageSize: size, total: 0, rows: [] });
  }
  const idToMeta = new Map(parks.map((p) => [p.id, p]));
  const refIds = parks.map((p) => p.id);

  // 2) Date range
  let f = from ? new Date(from) : defaultDailyRange().from;
  let t = to ? new Date(to) : defaultDailyRange().to;

  // 3) Učitaj agregate
  const rowsDb = await ParkingDaily.findAll({
    where: {
      parkingRefId: { [Op.in]: refIds },
      day: {
        ...(f ? { [Op.gte]: f } : {}),
        ...(t ? { [Op.lt]: t } : {}),
      },
    },
  });

  // 4) Mapiraj u javni payload
  const out = rowsDb.map((r) => {
    const meta = idToMeta.get(r.parkingRefId);
    return {
      parkingId: meta?.parkingId ?? "",
      parkingName: meta?.parkingName ?? "",
      day: r.day, // YYYY-MM-DD
      samples: Number(r.samples),
      occ_avg: toNum(r.occ_avg),
      occ_max: toNum(r.occ_max),
      occ_min: toNum(r.occ_min),
      free_total_avg: toNum(r.free_total_avg),
      free_total_min: Number(r.free_total_min),
      free_total_max: Number(r.free_total_max),
      updatedAt: r.updatedAt,
    };
  });

  // 5) Sort + paginate
  const allowed = ["day", "parkingName", "parkingId", ...S_NUM];
  const sortKey = sanitizeSort(String(sort), allowed);
  sortRows(out, sortKey, order);

  const total = out.length;
  const pageRows = out.slice(start, start + size);

  const lastUpdated =
    out.length && out[0].updatedAt
      ? new Date(
          Math.max(...out.map((r) => +new Date(r.updatedAt)))
        ).toISOString()
      : null;

  if (
    applyCacheHeaders(req, res, {
      key: `${req.originalUrl}|${lastUpdated ?? 0}`,
      maxAge: 300,
      lastModified: lastUpdated,
    })
  )
    return;

  setPaginationLinks(req, res, page, size, total);
  res.json({ page, pageSize: size, total, rows: pageRows });
}

export async function listMonthly(req, res) {
  const {
    q = "",
    parkingId,
    zoneName,
    parkingTypeId,
    from, // moze biti "YYYY-MM" ili datum
    to,
    sort = "month",
    order = "asc",
  } = req.query;

  const { page, size, start } = parsePagination(req.query, 100);

  // 1) Filtriraj parkinge (meta)
  const pWhere = {};
  if (q)
    pWhere[Op.or] = [
      { parkingName: { [Op.like]: `%${q}%` } },
      { parkingAddress: { [Op.like]: `%${q}%` } },
    ];
  if (zoneName) pWhere.zoneName = zoneName;
  if (parkingTypeId) pWhere.parkingTypeId = parkingTypeId;

  const idsFilter = parseCsvIds(parkingId);
  if (idsFilter) pWhere.parkingId = { [Op.in]: idsFilter };

  const parks = await Parking.findAll({
    where: pWhere,
    attributes: ["id", "parkingId", "parkingName"],
  });
  if (!parks.length) {
    return res.json({ page, pageSize: size, total: 0, rows: [] });
  }
  const idToMeta = new Map(parks.map((p) => [p.id, p]));
  const refIds = parks.map((p) => p.id);

  // 2) Month range ("YYYY-MM")
  const def = defaultMonthlyRange();
  const parseYm = (v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (Number.isNaN(+d)) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;
  };
  const startYm = parseYm(from) || def.startYm;
  const endYm = parseYm(to) || def.endYm;

  // 3) Učitaj agregate
  const rowsDb = await ParkingMonthly.findAll({
    where: {
      parkingRefId: { [Op.in]: refIds },
      month: { [Op.gte]: startYm, [Op]: undefined }, // dummy; see below
    },
  });

  // MySQL string compare radi za "YYYY-MM", pa možemo filtrirati u JS ako želiš preciznije:
  const filtered = rowsDb.filter((r) => r.month >= startYm && r.month <= endYm);

  const out = filtered.map((r) => {
    const meta = idToMeta.get(r.parkingRefId);
    return {
      parkingId: meta?.parkingId ?? "",
      parkingName: meta?.parkingName ?? "",
      month: r.month, // "YYYY-MM"
      samples: Number(r.samples),
      occ_avg: toNum(r.occ_avg),
      occ_max: toNum(r.occ_max),
      occ_min: toNum(r.occ_min),
      free_total_avg: toNum(r.free_total_avg),
      free_total_min: Number(r.free_total_min),
      free_total_max: Number(r.free_total_max),
      updatedAt: r.updatedAt,
    };
  });

  const allowed = ["month", "parkingName", "parkingId", ...S_NUM];
  const sortKey = sanitizeSort(String(sort), allowed);
  sortRows(out, sortKey, order);

  const total = out.length;
  const pageRows = out.slice(start, start + size);

  const lastUpdated =
    out.length && out[0].updatedAt
      ? new Date(
          Math.max(...out.map((r) => +new Date(r.updatedAt)))
        ).toISOString()
      : null;

  if (
    applyCacheHeaders(req, res, {
      key: `${req.originalUrl}|${lastUpdated ?? 0}`,
      maxAge: 600,
      lastModified: lastUpdated,
    })
  )
    return;

  setPaginationLinks(req, res, page, size, total);
  res.json({ page, pageSize: size, total, rows: pageRows });
}
