// // src/controllers/parkings.controller.js
// import { Op } from "sequelize";
// import { Parking } from "../models/Parking.js";
// import { ParkingSnapshot } from "../models/ParkingSnapshot.js";
// import { applyCacheHeaders } from "../utils/httpCache.js";
// import { setPaginationLinks } from "../utils/pagination.js";
// import { toCSV, toXLSX, toXML } from "../utils/exports.js";
// import { getAllowedPublicParkings } from "../config/public.js";

// /* -------------------------------- Helpers ------------------------------- */

// function allowedList() {
//   return getAllowedPublicParkings().map((x) => String(x));
// }

// /**
//  * Enforce that queries are limited to allowed public parkingIds.
//  * Mutates `where` in-place.
//  */
// function enforceAllowed(where, field = "parkingId") {
//   const allowed = allowedList();

//   // nothing specified -> restrict to allowed
//   if (where[field] === undefined) {
//     where[field] = { [Op.in]: allowed };
//     return;
//   }

//   // string value specified
//   if (typeof where[field] === "string" || typeof where[field] === "number") {
//     const v = String(where[field]);
//     if (!allowed.includes(v)) {
//       // force no results
//       where[field] = { [Op.in]: [] };
//     }
//     return;
//   }

//   // array (treat as IN)
//   if (Array.isArray(where[field])) {
//     const filtered = where[field]
//       .map(String)
//       .filter((v) => allowed.includes(v));
//     where[field] = { [Op.in]: filtered };
//     return;
//   }

//   // Sequelize operator object
//   const v = where[field];
//   if (v && v[Op.in]) {
//     v[Op.in] = v[Op.in].map(String).filter((x) => allowed.includes(x));
//   } else if (v && v[Op.eq]) {
//     v[Op.eq] = String(v[Op.eq]);
//     if (!allowed.includes(v[Op.eq])) where[field] = { [Op.in]: [] };
//   } else {
//     // fallback: replace with allowed IN
//     where[field] = { [Op.in]: allowed };
//   }
// }

// /* ------------------------------ Controllers ----------------------------- */

// /**
//  * GET /api/v1/parkings
//  * Zadnje stanje za allowed parkinge + filteri, sort, paginacija
//  */
// export async function listParkings(req, res) {
//   try {
//     const {
//       q = "",
//       cityName,
//       zoneName,
//       parkingTypeId,
//       minFree,
//       sort = "createdAt",
//       order = "desc",
//       page = "1",
//       pageSize = "20",
//       parkingIdIn = "", // <— NOVO
//     } = req.query;

//     const where = {};
//     if (q) {
//       where[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     }
//     if (cityName) where.cityName = cityName;
//     if (zoneName) where.zoneName = zoneName;
//     if (parkingTypeId) where.parkingTypeId = parkingTypeId;

//     // NOVO: allow list filter (samo 3 parkinga koje želiš prikazivati)
//     if (parkingIdIn) {
//       const ids = String(parkingIdIn)
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean);
//       if (ids.length) where.parkingId = ids;
//     }

//     const rows = await Parking.findAll({
//       where,
//       include: [
//         {
//           model: ParkingSnapshot,
//           as: "snapshots",
//           separate: true,
//           limit: 1,
//           order: [["createdAt", "DESC"]],
//           attributes: [
//             "freeNumberOfRegularPlaces",
//             "freeNumberOfSpecialPlaces",
//             "createdAt",
//             "totalNumberOfRegularPlaces",
//             "totalNumberOfSpecialPlaces",
//             "numberOfParkingPlaces",
//           ],
//         },
//       ],
//     });

//     let flat = rows.map((p) => {
//       const s = p.snapshots?.[0];
//       return {
//         parkingId: p.parkingId,
//         parkingName: p.parkingName,
//         cityName: p.cityName,
//         zoneName: p.zoneName,
//         zoneColor: p.zoneColor,
//         numberOfParkingPlaces: p.numberOfParkingPlaces,
//         totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
//         freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
//         totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
//         freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
//         parkingTypeId: p.parkingTypeId,
//         locationId: p.locationId,
//         longitude: p.longitude,
//         latitude: p.latitude,
//         parkingAddress: p.parkingAddress,
//         createdAt: s ? s.createdAt : p.createdAt,
//       };
//     });

//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) {
//         flat = flat.filter(
//           (r) => r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces >= mf
//         );
//       }
//     }

//     const key = String(sort);
//     const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
//     const val = (r, k) => {
//       if (k === "parkingName") return r.parkingName || "";
//       if (k === "cityName") return r.cityName || "";
//       if (k === "zoneName") return r.zoneName || "";
//       if (k === "createdAt") return new Date(r.createdAt).getTime() || 0;
//       if (k === "free")
//         return r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
//       if (k === "occupancyRatio") {
//         const total =
//           r.totalNumberOfRegularPlaces + r.totalNumberOfSpecialPlaces || 0;
//         const free =
//           r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
//         return total ? (total - free) / total : 0;
//       }
//       return new Date(r.createdAt).getTime() || 0;
//     };
//     flat.sort((a, b) => {
//       const va = val(a, key),
//         vb = val(b, key);
//       if (typeof va === "string" && typeof vb === "string")
//         return va.localeCompare(vb) * dir;
//       return ((va > vb) - (va < vb)) * dir;
//     });

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
//     const total = flat.length;
//     const start = (pageNum - 1) * size;
//     const rowsPage = flat.slice(start, start + size);

//     res.json({ page: pageNum, pageSize: size, total, rows: rowsPage });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/stats/overview
//  * Agregirani KPI za allowed i filtrirane parkinge
//  */
// export async function overviewStats(req, res) {
//   try {
//     const { q = "", cityName, zoneName, parkingTypeId, minFree } = req.query;

//     const where = {};
//     if (q)
//       where[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     if (cityName) where.cityName = cityName;
//     if (zoneName) where.zoneName = zoneName;
//     if (parkingTypeId) where.parkingTypeId = parkingTypeId;

//     enforceAllowed(where, "parkingId");

//     const rows = await Parking.findAll({
//       where,
//       include: [
//         {
//           model: ParkingSnapshot,
//           as: "snapshots",
//           separate: true,
//           limit: 1,
//           order: [["createdAt", "DESC"]],
//           attributes: [
//             "freeNumberOfRegularPlaces",
//             "freeNumberOfSpecialPlaces",
//             "createdAt",
//             "totalNumberOfRegularPlaces",
//             "totalNumberOfSpecialPlaces",
//             "numberOfParkingPlaces",
//           ],
//         },
//       ],
//     });

//     let flat = rows.map((p) => {
//       const s = p.snapshots?.[0];
//       return {
//         numberOfParkingPlaces: p.numberOfParkingPlaces,
//         totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
//         freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
//         totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
//         freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
//         createdAt: s ? s.createdAt : p.createdAt,
//       };
//     });

//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) {
//         flat = flat.filter(
//           (r) => r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces >= mf
//         );
//       }
//     }

//     const total = flat.reduce(
//       (acc, r) => acc + (r.numberOfParkingPlaces || 0),
//       0
//     );
//     const free = flat.reduce(
//       (acc, r) =>
//         acc +
//         ((r.freeNumberOfRegularPlaces || 0) +
//           (r.freeNumberOfSpecialPlaces || 0)),
//       0
//     );
//     const occupied = total - free;
//     const occupancyRatio = total ? occupied / total : 0;
//     const lastUpdated = flat.length
//       ? new Date(
//           Math.max(...flat.map((r) => +new Date(r.createdAt)))
//         ).toISOString()
//       : null;

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated ?? 0}`,
//         maxAge: 60,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     res.json({ total, free, occupied, occupancyRatio, lastUpdated });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/stats/by-parking
//  * Po parkingu (zadnji snapshot) + agregati (occupied, freeTotal)
//  */
// export async function byParkingStats(req, res) {
//   try {
//     const { q = "", cityName, zoneName, parkingTypeId, minFree } = req.query;

//     const where = {};
//     if (q)
//       where[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     if (cityName) where.cityName = cityName;
//     if (zoneName) where.zoneName = zoneName;
//     if (parkingTypeId) where.parkingTypeId = parkingTypeId;

//     enforceAllowed(where, "parkingId");

//     const rows = await Parking.findAll({
//       where,
//       include: [
//         {
//           model: ParkingSnapshot,
//           as: "snapshots",
//           separate: true,
//           limit: 1,
//           order: [["createdAt", "DESC"]],
//           attributes: [
//             "freeNumberOfRegularPlaces",
//             "freeNumberOfSpecialPlaces",
//             "createdAt",
//             "totalNumberOfRegularPlaces",
//             "totalNumberOfSpecialPlaces",
//             "numberOfParkingPlaces",
//           ],
//         },
//       ],
//       order: [["parkingName", "ASC"]],
//     });

//     let out = rows.map((p) => {
//       const s = p.snapshots?.[0];
//       const free =
//         (s ? s.freeNumberOfRegularPlaces : 0) +
//         (s ? s.freeNumberOfSpecialPlaces : 0);
//       const total = p.numberOfParkingPlaces || 0;
//       return {
//         parkingId: p.parkingId,
//         parkingName: p.parkingName,
//         cityName: p.cityName,
//         zoneName: p.zoneName,
//         zoneColor: p.zoneColor,
//         numberOfParkingPlaces: p.numberOfParkingPlaces,
//         totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
//         freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
//         totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
//         freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
//         parkingTypeId: p.parkingTypeId,
//         locationId: p.locationId,
//         longitude: p.longitude,
//         latitude: p.latitude,
//         parkingAddress: p.parkingAddress,
//         createdAt: s ? s.createdAt : p.createdAt,
//         occupied: Math.max(0, total - free),
//         freeTotal: free,
//       };
//     });

//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) out = out.filter((r) => (r.freeTotal || 0) >= mf);
//     }

//     const lastUpdated = out.length
//       ? new Date(
//           Math.max(...out.map((r) => +new Date(r.createdAt)))
//         ).toISOString()
//       : null;

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated ?? 0}`,
//         maxAge: 60,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     res.json(out);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/parkings/:parkingId/last
//  */
// export async function lastForParking(req, res) {
//   try {
//     const { parkingId } = req.params;
//     const allowed = allowedList();
//     if (!allowed.includes(String(parkingId))) {
//       return res.status(404).json({ error: "Not found" });
//     }

//     const p = await Parking.findOne({
//       where: { parkingId: String(parkingId) },
//       include: [
//         {
//           model: ParkingSnapshot,
//           as: "snapshots",
//           separate: true,
//           limit: 1,
//           order: [["createdAt", "DESC"]],
//           attributes: [
//             "freeNumberOfRegularPlaces",
//             "freeNumberOfSpecialPlaces",
//             "createdAt",
//           ],
//         },
//       ],
//     });
//     if (!p) return res.status(404).json({ error: "Not found" });

//     const s = p.snapshots?.[0];
//     const row = {
//       parkingId: p.parkingId,
//       parkingName: p.parkingName,
//       cityName: p.cityName,
//       zoneName: p.zoneName,
//       zoneColor: p.zoneColor,
//       numberOfParkingPlaces: p.numberOfParkingPlaces,
//       totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
//       freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
//       totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
//       freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
//       parkingTypeId: p.parkingTypeId,
//       locationId: p.locationId,
//       longitude: p.longitude,
//       latitude: p.latitude,
//       parkingAddress: p.parkingAddress,
//       createdAt: s ? s.createdAt : p.createdAt,
//     };

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${row.createdAt}`,
//         maxAge: 60,
//         lastModified: row.createdAt,
//       })
//     )
//       return;

//     res.json(row);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/parkings/:parkingId/history
//  * (Jedan parking, cijeli period ili from/to)
//  */
// export async function historyForParking(req, res) {
//   try {
//     const { parkingId } = req.params;
//     const { from, to } = req.query;

//     const allowed = allowedList();
//     if (!allowed.includes(String(parkingId))) {
//       return res.status(404).json({ error: "Parking not found" });
//     }

//     const p = await Parking.findOne({
//       where: { parkingId: String(parkingId) },
//     });
//     if (!p) return res.status(404).json({ error: "Parking not found" });

//     const where = { parkingRefId: p.id };
//     if (from)
//       where.createdAt = {
//         ...(where.createdAt || {}),
//         [Op.gte]: new Date(from),
//       };
//     if (to)
//       where.createdAt = { ...(where.createdAt || {}), [Op.lte]: new Date(to) };

//     const snaps = await ParkingSnapshot.findAll({
//       where,
//       order: [["createdAt", "ASC"]],
//       attributes: [
//         "parkingId",
//         "parkingName",
//         "cityName",
//         "zoneName",
//         "zoneColor",
//         "numberOfParkingPlaces",
//         "totalNumberOfRegularPlaces",
//         "freeNumberOfRegularPlaces",
//         "totalNumberOfSpecialPlaces",
//         "freeNumberOfSpecialPlaces",
//         "parkingTypeId",
//         "locationId",
//         "longitude",
//         "latitude",
//         "parkingAddress",
//         "createdAt",
//       ],
//     });

//     res.json(snaps);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/parkings/history
//  * (Više snapshotova preko allowed parkinga, opcionalno 1 parkingId)
//  * Query: parkingId?, from?, to?, page?, pageSize?, order=asc|desc
//  */
// export async function historyMany(req, res) {
//   try {
//     const {
//       parkingId,
//       from,
//       to,
//       page = "1",
//       pageSize = "100",
//       order = "asc",
//     } = req.query;

//     const pWhere = {};
//     if (parkingId) pWhere.parkingId = String(parkingId);
//     enforceAllowed(pWhere, "parkingId");

//     const parks = await Parking.findAll({
//       where: pWhere,
//       attributes: ["id", "parkingId"],
//     });
//     if (!parks.length)
//       return res.json({ page: 1, pageSize: 0, total: 0, rows: [] });

//     const ids = parks.map((p) => p.id);

//     const sWhere = { parkingRefId: { [Op.in]: ids } };
//     if (from)
//       sWhere.createdAt = {
//         ...(sWhere.createdAt || {}),
//         [Op.gte]: new Date(from),
//       };
//     if (to)
//       sWhere.createdAt = {
//         ...(sWhere.createdAt || {}),
//         [Op.lte]: new Date(to),
//       };

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const size = Math.min(2000, Math.max(1, parseInt(pageSize, 10) || 100));
//     const offset = (pageNum - 1) * size;

//     const { rows, count } = await ParkingSnapshot.findAndCountAll({
//       where: sWhere,
//       order: [["createdAt", order?.toUpperCase() === "DESC" ? "DESC" : "ASC"]],
//       limit: size,
//       offset,
//       attributes: [
//         "parkingId",
//         "parkingName",
//         "cityName",
//         "zoneName",
//         "zoneColor",
//         "numberOfParkingPlaces",
//         "totalNumberOfRegularPlaces",
//         "freeNumberOfRegularPlaces",
//         "totalNumberOfSpecialPlaces",
//         "freeNumberOfSpecialPlaces",
//         "parkingTypeId",
//         "locationId",
//         "longitude",
//         "latitude",
//         "parkingAddress",
//         "createdAt",
//       ],
//     });

//     res.json({ page: pageNum, pageSize: size, total: count, rows });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/export
//  * - Bez from/to: export zadnjeg stanja (listParkings)
//  * - Sa from/to: export historije (historyMany)
//  */
// export async function exportParkings(req, res) {
//   try {
//     const {
//       q = "",
//       cityName,
//       zoneName,
//       parkingTypeId,
//       minFree,
//       format = "csv",
//       sort = "createdAt",
//       order = "desc",
//       parkingId,
//       from,
//       to,
//     } = req.query;

//     const isHistory = Boolean(from || to);

//     if (isHistory) {
//       // === HISTORIJSKI EXPORT ===
//       const pWhere = {};
//       if (parkingId) pWhere.parkingId = String(parkingId);
//       enforceAllowed(pWhere, "parkingId");

//       const parks = await Parking.findAll({
//         where: pWhere,
//         attributes: ["id"],
//       });
//       if (!parks.length) {
//         res.setHeader("Content-Type", "text/csv");
//         return res.send("no,data\n");
//       }
//       const ids = parks.map((p) => p.id);

//       const sWhere = { parkingRefId: { [Op.in]: ids } };
//       if (from)
//         sWhere.createdAt = {
//           ...(sWhere.createdAt || {}),
//           [Op.gte]: new Date(from),
//         };
//       if (to)
//         sWhere.createdAt = {
//           ...(sWhere.createdAt || {}),
//           [Op.lte]: new Date(to),
//         };

//       const snaps = await ParkingSnapshot.findAll({
//         where: sWhere,
//         order: [
//           ["createdAt", order?.toUpperCase() === "DESC" ? "DESC" : "ASC"],
//         ],
//         attributes: [
//           "parkingId",
//           "parkingName",
//           "cityName",
//           "zoneName",
//           "zoneColor",
//           "numberOfParkingPlaces",
//           "totalNumberOfRegularPlaces",
//           "freeNumberOfRegularPlaces",
//           "totalNumberOfSpecialPlaces",
//           "freeNumberOfSpecialPlaces",
//           "parkingTypeId",
//           "locationId",
//           "longitude",
//           "latitude",
//           "parkingAddress",
//           "createdAt",
//         ],
//       });

//       const flat = snaps.map((s) => s.get({ plain: true }));

//       const fmt = String(format).toLowerCase();
//       if (fmt === "json") {
//         res.setHeader("Content-Type", "application/json");
//         return res.send(JSON.stringify(flat));
//       }
//       if (fmt === "xlsx") {
//         const buf = await toXLSX(flat, "history");
//         res.setHeader(
//           "Content-Type",
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//         );
//         res.setHeader(
//           "Content-Disposition",
//           'attachment; filename="history.xlsx"'
//         );
//         return res.send(buf);
//       }
//       if (fmt === "xml") {
//         const xml = toXML(flat, "history", "snapshot");
//         res.setHeader("Content-Type", "application/xml");
//         return res.send(xml);
//       }
//       const csv = toCSV(flat);
//       res.setHeader("Content-Type", "text/csv");
//       res.setHeader(
//         "Content-Disposition",
//         'attachment; filename="history.csv"'
//       );
//       return res.send(csv);
//     }

//     // === ZADNJE STANJE EXPORT ===
//     const where = {};
//     if (q)
//       where[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     if (cityName) where.cityName = cityName;
//     if (zoneName) where.zoneName = zoneName;
//     if (parkingTypeId) where.parkingTypeId = parkingTypeId;
//     if (parkingId) where.parkingId = String(parkingId);

//     enforceAllowed(where, "parkingId");

//     const rows = await Parking.findAll({
//       where,
//       include: [
//         {
//           model: ParkingSnapshot,
//           as: "snapshots",
//           separate: true,
//           limit: 1,
//           order: [["createdAt", "DESC"]],
//           attributes: [
//             "freeNumberOfRegularPlaces",
//             "freeNumberOfSpecialPlaces",
//             "createdAt",
//           ],
//         },
//       ],
//     });

//     let flat = rows.map((p) => {
//       const s = p.snapshots?.[0];
//       return {
//         parkingId: p.parkingId,
//         parkingName: p.parkingName,
//         cityName: p.cityName,
//         zoneName: p.zoneName,
//         zoneColor: p.zoneColor,
//         numberOfParkingPlaces: p.numberOfParkingPlaces,
//         totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
//         freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
//         totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
//         freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
//         parkingTypeId: p.parkingTypeId,
//         locationId: p.locationId,
//         longitude: p.longitude,
//         latitude: p.latitude,
//         parkingAddress: p.parkingAddress,
//         createdAt: s ? s.createdAt : p.createdAt,
//       };
//     });

//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) {
//         flat = flat.filter(
//           (r) => r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces >= mf
//         );
//       }
//     }

//     // Sortiranje (isti kriterij kao list)
//     const key = String(sort);
//     const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
//     const val = (r, k) => {
//       if (k === "parkingName") return r.parkingName || "";
//       if (k === "cityName") return r.cityName || "";
//       if (k === "zoneName") return r.zoneName || "";
//       if (k === "createdAt") return new Date(r.createdAt).getTime() || 0;
//       if (k === "free")
//         return r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
//       if (k === "occupancyRatio") {
//         const total =
//           r.totalNumberOfRegularPlaces + r.totalNumberOfSpecialPlaces || 0;
//         const free =
//           r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
//         return total ? (total - free) / total : 0;
//       }
//       return new Date(r.createdAt).getTime() || 0;
//     };
//     flat.sort((a, b) => {
//       const va = val(a, key),
//         vb = val(b, key);
//       if (typeof va === "string" && typeof vb === "string")
//         return va.localeCompare(vb) * dir;
//       return ((va > vb) - (va < vb)) * dir;
//     });

//     const fmt = String(format).toLowerCase();
//     if (fmt === "json") {
//       res.setHeader("Content-Type", "application/json");
//       return res.send(JSON.stringify(flat));
//     }
//     if (fmt === "xlsx") {
//       const buf = await toXLSX(flat, "parkings");
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       res.setHeader(
//         "Content-Disposition",
//         'attachment; filename="parkings.xlsx"'
//       );
//       return res.send(buf);
//     }
//     if (fmt === "xml") {
//       const xml = toXML(flat, "parkings", "parking");
//       res.setHeader("Content-Type", "application/xml");
//       return res.send(xml);
//     }
//     const csv = toCSV(flat);
//     res.setHeader("Content-Type", "text/csv");
//     res.setHeader("Content-Disposition", 'attachment; filename="parkings.csv"');
//     return res.send(csv);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// /**
//  * GET /api/v1/api-url
//  * Kanonski API URL za copy (last | history)
//  * ?type=last|history + prosleđeni filteri
//  */
// export async function apiUrlCanon(req, res) {
//   const { type = "last" } = req.query;
//   const base = new URL(`${req.protocol}://${req.get("host")}`);
//   if (type === "history") {
//     base.pathname = "/api/v1/parkings/history";
//     copyIf(base, req.query, [
//       "parkingId",
//       "from",
//       "to",
//       "page",
//       "pageSize",
//       "order",
//     ]);
//   } else {
//     base.pathname = "/api/v1/parkings";
//     copyIf(base, req.query, [
//       "parkingId",
//       "q",
//       "zoneName",
//       "parkingTypeId",
//       "page",
//       "pageSize",
//       "sort",
//       "order",
//     ]);
//   }
//   return res.json({ url: base.toString() });
// }

// function copyIf(url, src, keys) {
//   for (const k of keys) {
//     const v = src[k];
//     if (v !== undefined && v !== "") url.searchParams.set(k, v);
//   }
// }

// export async function listSnapshots(req, res) {
//   try {
//     const {
//       parkingIdIn = "", // comma-separated (obavezno: 1–3 allowed ID-a)
//       from,
//       to,
//       order = "asc", // asc|desc po createdAt
//       page = "1",
//       pageSize = "100",
//     } = req.query;

//     const ids = String(parkingIdIn)
//       .split(",")
//       .map((s) => s.trim())
//       .filter(Boolean);

//     if (!ids.length) {
//       return res.json({ page: 1, pageSize: 0, total: 0, rows: [] });
//     }

//     const where = { parkingId: ids };
//     if (from)
//       where.createdAt = {
//         ...(where.createdAt || {}),
//         [Op.gte]: new Date(from),
//       };
//     if (to)
//       where.createdAt = { ...(where.createdAt || {}), [Op.lte]: new Date(to) };

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const size = Math.min(1000, Math.max(1, parseInt(pageSize, 10) || 100));
//     const offset = (pageNum - 1) * size;

//     const { rows, count } = await ParkingSnapshot.findAndCountAll({
//       where,
//       order: [["createdAt", order.toUpperCase() === "DESC" ? "DESC" : "ASC"]],
//       limit: size,
//       offset,
//       attributes: [
//         "parkingId",
//         "parkingName",
//         "cityName",
//         "zoneName",
//         "zoneColor",
//         "numberOfParkingPlaces",
//         "totalNumberOfRegularPlaces",
//         "freeNumberOfRegularPlaces",
//         "totalNumberOfSpecialPlaces",
//         "freeNumberOfSpecialPlaces",
//         "parkingTypeId",
//         "locationId",
//         "longitude",
//         "latitude",
//         "parkingAddress",
//         "createdAt",
//       ],
//     });

//     res.json({ page: pageNum, pageSize: size, total: count, rows });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// }

// src/controllers/parkings.controller.js
import { Op } from "sequelize";
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";
import { toCSV, toXLSX, toXML } from "../utils/exports.js";
import { applyCacheHeaders } from "../utils/httpCache.js";
import { setPaginationLinks } from "../utils/pagination.js";

/* ----------------- helpers ----------------- */

function parseCsvIds(csv) {
  if (!csv) return [];
  return String(csv)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toFlatRow(p, s) {
  // p: Parking instance, s: last snapshot (or null)
  return {
    parkingId: p.parkingId,
    parkingName: p.parkingName,
    cityName: p.cityName,
    zoneName: p.zoneName,
    zoneColor: p.zoneColor,
    numberOfParkingPlaces: p.numberOfParkingPlaces,
    totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
    freeNumberOfRegularPlaces: s ? s.freeNumberOfRegularPlaces : 0,
    totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
    freeNumberOfSpecialPlaces: s ? s.freeNumberOfSpecialPlaces : 0,
    parkingTypeId: p.parkingTypeId,
    locationId: p.locationId,
    longitude: p.longitude != null ? Number(p.longitude) : null,
    latitude: p.latitude != null ? Number(p.latitude) : null,
    parkingAddress: p.parkingAddress,
    createdAt: s ? s.createdAt : p.createdAt,
  };
}

function toFlatFromSnapshot(s) {
  // koristimo denormalizovana polja snapshot-a (kako već koristimo u /:id/history)
  return {
    parkingId: s.parkingId,
    parkingName: s.parkingName,
    cityName: s.cityName,
    zoneName: s.zoneName,
    zoneColor: s.zoneColor,
    numberOfParkingPlaces: s.numberOfParkingPlaces,
    totalNumberOfRegularPlaces: s.totalNumberOfRegularPlaces,
    freeNumberOfRegularPlaces: s.freeNumberOfRegularPlaces,
    totalNumberOfSpecialPlaces: s.totalNumberOfSpecialPlaces,
    freeNumberOfSpecialPlaces: s.freeNumberOfSpecialPlaces,
    parkingTypeId: s.parkingTypeId,
    locationId: s.locationId,
    longitude: s.longitude != null ? Number(s.longitude) : null,
    latitude: s.latitude != null ? Number(s.latitude) : null,
    parkingAddress: s.parkingAddress,
    createdAt: s.createdAt,
  };
}

/* ----------------- controllers ----------------- */

// GET /api/v1/parkings
export async function listParkings(req, res) {
  try {
    const {
      q = "",
      cityName,
      zoneName,
      parkingTypeId,
      minFree,
      sort = "createdAt",
      order = "desc",
      page = "1",
      pageSize = "20",
      parkingIdIn = "", // CSV poslovnih ID-eva (npr "67,66,70")
    } = req.query;

    const idsFilter = parseCsvIds(parkingIdIn);

    const where = {};
    if (q)
      where[Op.or] = [
        { parkingName: { [Op.like]: `%${q}%` } },
        { parkingAddress: { [Op.like]: `%${q}%` } },
      ];
    if (cityName) where.cityName = cityName;
    if (zoneName) where.zoneName = zoneName;
    if (parkingTypeId) where.parkingTypeId = parkingTypeId;
    if (idsFilter.length) where.parkingId = idsFilter;

    const rows = await Parking.findAll({
      where,
      include: [
        {
          model: ParkingSnapshot,
          as: "snapshots",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          attributes: [
            "freeNumberOfRegularPlaces",
            "freeNumberOfSpecialPlaces",
            "createdAt",
            "totalNumberOfRegularPlaces",
            "totalNumberOfSpecialPlaces",
            "numberOfParkingPlaces",
          ],
        },
      ],
    });

    let flat = rows.map((p) => toFlatRow(p, p.snapshots?.[0]));

    if (minFree !== undefined) {
      const mf = parseInt(minFree, 10);
      if (!Number.isNaN(mf)) {
        flat = flat.filter(
          (r) =>
            (r.freeNumberOfRegularPlaces || 0) +
              (r.freeNumberOfSpecialPlaces || 0) >=
            mf
        );
      }
    }

    // sortiranje – samo po podržanim ključevima
    const key = String(sort);
    const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
    const getVal = (r) => {
      if (key === "parkingName") return r.parkingName || "";
      if (key === "cityName") return r.cityName || "";
      if (key === "zoneName") return r.zoneName || "";
      if (key === "createdAt") return new Date(r.createdAt).getTime() || 0;
      if (key === "free")
        return (
          (r.freeNumberOfRegularPlaces || 0) +
          (r.freeNumberOfSpecialPlaces || 0)
        );
      if (key === "occupancyRatio") {
        const total =
          (r.totalNumberOfRegularPlaces || 0) +
          (r.totalNumberOfSpecialPlaces || 0);
        const free =
          (r.freeNumberOfRegularPlaces || 0) +
          (r.freeNumberOfSpecialPlaces || 0);
        return total ? (total - free) / total : 0;
      }
      return new Date(r.createdAt).getTime() || 0;
    };
    flat.sort((a, b) => {
      const va = getVal(a),
        vb = getVal(b);
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * dir;
      return ((va > vb) - (va < vb)) * dir;
    });

    // paginacija
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
    const total = flat.length;
    const start = (pageNum - 1) * size;
    const rowsPage = flat.slice(start, start + size);

    const lastUpdated = rowsPage.length
      ? new Date(
          Math.max(...rowsPage.map((r) => +new Date(r.createdAt)))
        ).toISOString()
      : null;

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${lastUpdated ?? 0}`,
        maxAge: 60,
        lastModified: lastUpdated,
      })
    )
      return;

    setPaginationLinks(req, res, pageNum, size, total);
    res.json({ page: pageNum, pageSize: size, total, rows: rowsPage });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/stats/overview
export async function overviewStats(req, res) {
  try {
    const {
      q = "",
      cityName,
      zoneName,
      parkingTypeId,
      minFree,
      parkingIdIn = "",
    } = req.query;
    const idsFilter = parseCsvIds(parkingIdIn);

    const where = {};
    if (q)
      where[Op.or] = [
        { parkingName: { [Op.like]: `%${q}%` } },
        { parkingAddress: { [Op.like]: `%${q}%` } },
      ];
    if (cityName) where.cityName = cityName;
    if (zoneName) where.zoneName = zoneName;
    if (parkingTypeId) where.parkingTypeId = parkingTypeId;
    if (idsFilter.length) where.parkingId = idsFilter;

    const rows = await Parking.findAll({
      where,
      include: [
        {
          model: ParkingSnapshot,
          as: "snapshots",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          attributes: [
            "freeNumberOfRegularPlaces",
            "freeNumberOfSpecialPlaces",
            "createdAt",
            "totalNumberOfRegularPlaces",
            "totalNumberOfSpecialPlaces",
            "numberOfParkingPlaces",
          ],
        },
      ],
    });

    let flat = rows.map((p) => toFlatRow(p, p.snapshots?.[0]));

    if (minFree !== undefined) {
      const mf = parseInt(minFree, 10);
      if (!Number.isNaN(mf)) {
        flat = flat.filter(
          (r) =>
            (r.freeNumberOfRegularPlaces || 0) +
              (r.freeNumberOfSpecialPlaces || 0) >=
            mf
        );
      }
    }

    const total = flat.reduce(
      (acc, r) => acc + (r.numberOfParkingPlaces || 0),
      0
    );
    const free = flat.reduce(
      (acc, r) =>
        acc +
        ((r.freeNumberOfRegularPlaces || 0) +
          (r.freeNumberOfSpecialPlaces || 0)),
      0
    );
    const occupied = total - free;
    const occupancyRatio = total ? occupied / total : 0;
    const lastUpdated = flat.length
      ? new Date(
          Math.max(...flat.map((r) => +new Date(r.createdAt)))
        ).toISOString()
      : null;

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${lastUpdated ?? 0}`,
        maxAge: 60,
        lastModified: lastUpdated,
      })
    )
      return;

    res.json({ total, free, occupied, occupancyRatio, lastUpdated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/stats/by-parking
export async function byParkingStats(req, res) {
  try {
    const {
      q = "",
      cityName,
      zoneName,
      parkingTypeId,
      minFree,
      parkingIdIn = "",
    } = req.query;
    const idsFilter = parseCsvIds(parkingIdIn);

    const where = {};
    if (q)
      where[Op.or] = [
        { parkingName: { [Op.like]: `%${q}%` } },
        { parkingAddress: { [Op.like]: `%${q}%` } },
      ];
    if (cityName) where.cityName = cityName;
    if (zoneName) where.zoneName = zoneName;
    if (parkingTypeId) where.parkingTypeId = parkingTypeId;
    if (idsFilter.length) where.parkingId = idsFilter;

    const rows = await Parking.findAll({
      where,
      include: [
        {
          model: ParkingSnapshot,
          as: "snapshots",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          attributes: [
            "freeNumberOfRegularPlaces",
            "freeNumberOfSpecialPlaces",
            "createdAt",
            "totalNumberOfRegularPlaces",
            "totalNumberOfSpecialPlaces",
            "numberOfParkingPlaces",
          ],
        },
      ],
      order: [["parkingName", "ASC"]],
    });

    let out = rows.map((p) => {
      const s = p.snapshots?.[0];
      const free =
        (s ? s.freeNumberOfRegularPlaces : 0) +
        (s ? s.freeNumberOfSpecialPlaces : 0);
      const total = p.numberOfParkingPlaces || 0;
      return {
        ...toFlatRow(p, s),
        occupied: total - free,
        freeTotal: free,
      };
    });

    if (minFree !== undefined) {
      const mf = parseInt(minFree, 10);
      if (!Number.isNaN(mf)) out = out.filter((r) => r.freeTotal >= mf);
    }

    const lastUpdated = out.length
      ? new Date(
          Math.max(...out.map((r) => +new Date(r.createdAt)))
        ).toISOString()
      : null;

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${lastUpdated ?? 0}`,
        maxAge: 60,
        lastModified: lastUpdated,
      })
    )
      return;

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/stats/peaks
export async function peaks(req, res) {
  try {
    const {
      q = "",
      cityName,
      zoneName,
      parkingTypeId,
      from,
      to,
      parkingIdIn = "",
    } = req.query;

    const pWhere = {};
    if (q)
      pWhere[Op.or] = [
        { parkingName: { [Op.like]: `%${q}%` } },
        { parkingAddress: { [Op.like]: `%${q}%` } },
      ];
    if (cityName) pWhere.cityName = cityName;
    if (zoneName) pWhere.zoneName = zoneName;
    if (parkingTypeId) pWhere.parkingTypeId = parkingTypeId;

    const idsFilter = parseCsvIds(parkingIdIn);
    if (idsFilter.length) pWhere.parkingId = idsFilter;

    const parks = await Parking.findAll({ where: pWhere, attributes: ["id"] });
    if (!parks.length) {
      return res.json({
        hourly: Array.from({ length: 24 }, (_, h) => ({
          hour: String(h).padStart(2, "0"),
          occupancyRatioAvg: 0,
          samples: 0,
        })),
        daily: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"].map(
          (d, i) => ({
            dow: i,
            day: d,
            occupancyRatioMax: 0,
            samples: 0,
          })
        ),
        from: from || null,
        to: to || null,
        lastUpdated: null,
      });
    }
    const ids = parks.map((p) => p.id);

    const sWhere = { parkingRefId: ids };
    if (from)
      sWhere.createdAt = {
        ...(sWhere.createdAt || {}),
        [Op.gte]: new Date(from),
      };
    if (to)
      sWhere.createdAt = {
        ...(sWhere.createdAt || {}),
        [Op.lte]: new Date(to),
      };

    const snaps = await ParkingSnapshot.findAll({
      where: sWhere,
      attributes: [
        "totalNumberOfRegularPlaces",
        "freeNumberOfRegularPlaces",
        "totalNumberOfSpecialPlaces",
        "freeNumberOfSpecialPlaces",
        "createdAt",
      ],
      order: [["createdAt", "ASC"]],
    });

    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, "0"),
      sum: 0,
      n: 0,
    }));
    const days = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"];
    const daily = Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      day: days[i],
      max: 0,
      n: 0,
    }));

    for (const s of snaps) {
      const tot =
        (s.totalNumberOfRegularPlaces || 0) +
        (s.totalNumberOfSpecialPlaces || 0);
      const free =
        (s.freeNumberOfRegularPlaces || 0) + (s.freeNumberOfSpecialPlaces || 0);
      const occ = tot ? (tot - free) / tot : 0;

      const d = new Date(s.createdAt);
      const h = d.getHours();
      const w = d.getDay();

      hourly[h].sum += occ;
      hourly[h].n += 1;
      if (occ > daily[w].max) daily[w].max = occ;
      daily[w].n += 1;
    }

    const hourlyOut = hourly.map((b) => ({
      hour: b.hour,
      occupancyRatioAvg: b.n ? b.sum / b.n : 0,
      samples: b.n,
    }));
    const dailyOut = daily.map((b) => ({
      dow: b.dow,
      day: b.day,
      occupancyRatioMax: b.max,
      samples: b.n,
    }));

    const lastUpdated = snaps.length ? snaps[snaps.length - 1].createdAt : null;

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${lastUpdated ?? 0}`,
        maxAge: 60,
        lastModified: lastUpdated,
      })
    )
      return;

    res.json({
      hourly: hourlyOut,
      daily: dailyOut,
      from: from || null,
      to: to || null,
      lastUpdated,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/parkings/:parkingId/last
export async function lastForParking(req, res) {
  try {
    const p = await Parking.findOne({
      where: { parkingId: req.params.parkingId },
      include: [
        {
          model: ParkingSnapshot,
          as: "snapshots",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          attributes: [
            "freeNumberOfRegularPlaces",
            "freeNumberOfSpecialPlaces",
            "createdAt",
          ],
        },
      ],
    });
    if (!p) return res.status(404).json({ error: "Not found" });

    const s = p.snapshots?.[0];
    const row = toFlatRow(p, s);

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${row.createdAt}`,
        maxAge: 60,
        lastModified: row.createdAt,
      })
    )
      return;

    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/parkings/:parkingId/history
export async function historyForParking(req, res) {
  try {
    const { parkingId } = req.params;
    const { from, to, order = "ASC" } = req.query;

    const p = await Parking.findOne({ where: { parkingId } });
    if (!p) return res.status(404).json({ error: "Parking not found" });

    const where = { parkingRefId: p.id };
    if (from)
      where.createdAt = {
        ...(where.createdAt || {}),
        [Op.gte]: new Date(from),
      };
    if (to)
      where.createdAt = { ...(where.createdAt || {}), [Op.lte]: new Date(to) };

    const snaps = await ParkingSnapshot.findAll({
      where,
      order: [["createdAt", order.toUpperCase() === "ASC" ? "ASC" : "DESC"]],
      attributes: [
        "parkingId",
        "parkingName",
        "cityName",
        "zoneName",
        "zoneColor",
        "numberOfParkingPlaces",
        "totalNumberOfRegularPlaces",
        "freeNumberOfRegularPlaces",
        "totalNumberOfSpecialPlaces",
        "freeNumberOfSpecialPlaces",
        "parkingTypeId",
        "locationId",
        "longitude",
        "latitude",
        "parkingAddress",
        "createdAt",
      ],
    });

    res.json(snaps);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/snapshots   (više parkinga + period, paginirano)
export async function snapshotsList(req, res) {
  try {
    const {
      parkingIdIn = "", // CSV poslovnih ID-eva
      from,
      to,
      order = "desc",
      page = "1",
      pageSize = "100",
    } = req.query;

    const ids = parseCsvIds(parkingIdIn);
    if (!ids.length)
      return res.json({ page: 1, pageSize: 0, total: 0, rows: [] });

    // mapiraj poslovne parkingId → PK id
    const parks = await Parking.findAll({
      where: { parkingId: ids },
      attributes: ["id"],
    });
    const refIds = parks.map((p) => p.id);
    if (!refIds.length)
      return res.json({ page: 1, pageSize: 0, total: 0, rows: [] });

    const where = { parkingRefId: refIds };
    if (from)
      where.createdAt = {
        ...(where.createdAt || {}),
        [Op.gte]: new Date(from),
      };
    if (to)
      where.createdAt = { ...(where.createdAt || {}), [Op.lte]: new Date(to) };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(1000, Math.max(1, parseInt(pageSize, 10) || 100));
    const offset = (pageNum - 1) * size;

    const { rows, count } = await ParkingSnapshot.findAndCountAll({
      where,
      order: [["createdAt", order.toUpperCase() === "ASC" ? "ASC" : "DESC"]],
      limit: size,
      offset,
      attributes: [
        "parkingId",
        "parkingName",
        "cityName",
        "zoneName",
        "zoneColor",
        "numberOfParkingPlaces",
        "totalNumberOfRegularPlaces",
        "freeNumberOfRegularPlaces",
        "totalNumberOfSpecialPlaces",
        "freeNumberOfSpecialPlaces",
        "parkingTypeId",
        "locationId",
        "longitude",
        "latitude",
        "parkingAddress",
        "createdAt",
      ],
    });

    res.json({
      page: pageNum,
      pageSize: size,
      total: count,
      rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/export
export async function exportParkings(req, res) {
  try {
    const {
      q = "",
      cityName,
      zoneName,
      parkingTypeId,
      minFree,
      format = "csv",
      sort = "createdAt",
      order = "desc",
      parkingIdIn = "",
    } = req.query;

    const idsFilter = parseCsvIds(parkingIdIn);

    const where = {};
    if (q)
      where[Op.or] = [
        { parkingName: { [Op.like]: `%${q}%` } },
        { parkingAddress: { [Op.like]: `%${q}%` } },
      ];
    if (cityName) where.cityName = cityName;
    if (zoneName) where.zoneName = zoneName;
    if (parkingTypeId) where.parkingTypeId = parkingTypeId;
    if (idsFilter.length) where.parkingId = idsFilter;

    const rows = await Parking.findAll({
      where,
      include: [
        {
          model: ParkingSnapshot,
          as: "snapshots",
          separate: true,
          limit: 1,
          order: [["createdAt", "DESC"]],
          attributes: [
            "freeNumberOfRegularPlaces",
            "freeNumberOfSpecialPlaces",
            "createdAt",
          ],
        },
      ],
    });

    let flat = rows.map((p) => toFlatRow(p, p.snapshots?.[0]));

    if (minFree !== undefined) {
      const mf = parseInt(minFree, 10);
      if (!Number.isNaN(mf)) {
        flat = flat.filter(
          (r) =>
            (r.freeNumberOfRegularPlaces || 0) +
              (r.freeNumberOfSpecialPlaces || 0) >=
            mf
        );
      }
    }

    // sort kao u /parkings
    const key = String(sort);
    const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
    const val = (r) => {
      if (key === "parkingName") return r.parkingName || "";
      if (key === "cityName") return r.cityName || "";
      if (key === "zoneName") return r.zoneName || "";
      if (key === "createdAt") return new Date(r.createdAt).getTime() || 0;
      if (key === "free")
        return (
          (r.freeNumberOfRegularPlaces || 0) +
          (r.freeNumberOfSpecialPlaces || 0)
        );
      if (key === "occupancyRatio") {
        const total =
          (r.totalNumberOfRegularPlaces || 0) +
          (r.totalNumberOfSpecialPlaces || 0);
        const free =
          (r.freeNumberOfRegularPlaces || 0) +
          (r.freeNumberOfSpecialPlaces || 0);
        return total ? (total - free) / total : 0;
      }
      return new Date(r.createdAt).getTime() || 0;
    };
    flat.sort((a, b) => {
      const va = val(a),
        vb = val(b);
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * dir;
      return ((va > vb) - (va < vb)) * dir;
    });

    // cache 5 min
    const lastUpdated = flat.length
      ? new Date(
          Math.max(...flat.map((r) => +new Date(r.createdAt)))
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

    const fmt = String(format).toLowerCase();
    if (fmt === "json") {
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(flat));
    }
    if (fmt === "xlsx") {
      const buf = await toXLSX(flat, "parkings");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="parkings.xlsx"'
      );
      return res.send(buf);
    }
    if (fmt === "xml") {
      const xml = toXML(flat, "parkings", "parking");
      res.setHeader("Content-Type", "application/xml");
      return res.send(xml);
    }
    // default CSV
    const csv = toCSV(flat);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="parkings.csv"');
    return res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/export-snapshots  (historija za više parkinga, bez paginacije)
export async function exportSnapshots(req, res) {
  try {
    const {
      parkingIdIn = "",
      from,
      to,
      order = "desc",
      format = "csv",
    } = req.query;

    const ids = parseCsvIds(parkingIdIn);
    if (!ids.length)
      return res.status(400).json({ error: "parkingIdIn required (CSV)" });

    const parks = await Parking.findAll({
      where: { parkingId: ids },
      attributes: ["id"],
    });
    const refIds = parks.map((p) => p.id);
    if (!refIds.length) return res.json([]);

    const where = { parkingRefId: refIds };
    if (from)
      where.createdAt = {
        ...(where.createdAt || {}),
        [Op.gte]: new Date(from),
      };
    if (to)
      where.createdAt = { ...(where.createdAt || {}), [Op.lte]: new Date(to) };

    const snaps = await ParkingSnapshot.findAll({
      where,
      order: [["createdAt", order.toUpperCase() === "ASC" ? "ASC" : "DESC"]],
      attributes: [
        "parkingId",
        "parkingName",
        "cityName",
        "zoneName",
        "zoneColor",
        "numberOfParkingPlaces",
        "totalNumberOfRegularPlaces",
        "freeNumberOfRegularPlaces",
        "totalNumberOfSpecialPlaces",
        "freeNumberOfSpecialPlaces",
        "parkingTypeId",
        "locationId",
        "longitude",
        "latitude",
        "parkingAddress",
        "createdAt",
      ],
    });

    const flat = snaps.map(toFlatFromSnapshot);

    const fmt = String(format).toLowerCase();
    if (fmt === "json") {
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(flat));
    }
    if (fmt === "xlsx") {
      const buf = await toXLSX(flat, "snapshots");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="snapshots.xlsx"'
      );
      return res.send(buf);
    }
    if (fmt === "xml") {
      const xml = toXML(flat, "snapshots", "snapshot");
      res.setHeader("Content-Type", "application/xml");
      return res.send(xml);
    }
    // default CSV
    const csv = toCSV(flat);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="snapshots.csv"'
    );
    return res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/metadata
export async function metadata(req, res) {
  try {
    const lastSnap = await ParkingSnapshot.findOne({
      attributes: ["createdAt"],
      order: [["createdAt", "DESC"]],
    });
    const lastMeta = await Parking.findOne({
      attributes: ["createdAt"],
      order: [["createdAt", "DESC"]],
    });
    const lastUpdated = lastSnap?.createdAt || lastMeta?.createdAt || null;

    if (
      applyCacheHeaders(req, res, {
        key: `${req.originalUrl}|${lastUpdated ?? 0}`,
        maxAge: 300,
        lastModified: lastUpdated,
      })
    )
      return;

    res.json({
      title: "Open Data – Parking Occupancy (hourly snapshots)",
      description:
        "Satni snapshotovi zauzetosti javnih parkinga (broj mjesta, slobodna mjesta, zauzetost).",
      license: "CC BY 4.0",
      last_updated: lastUpdated,
      fields: [
        { name: "parkingId", type: "string" },
        { name: "parkingName", type: "string" },
        { name: "cityName", type: "string" },
        { name: "zoneName", type: "string" },
        { name: "zoneColor", type: "string" },
        { name: "numberOfParkingPlaces", type: "integer" },
        { name: "totalNumberOfRegularPlaces", type: "integer" },
        { name: "freeNumberOfRegularPlaces", type: "integer" },
        { name: "totalNumberOfSpecialPlaces", type: "integer" },
        { name: "freeNumberOfSpecialPlaces", type: "integer" },
        { name: "parkingTypeId", type: "string" },
        { name: "locationId", type: "string" },
        { name: "longitude", type: "number" },
        { name: "latitude", type: "number" },
        { name: "parkingAddress", type: "string" },
        {
          name: "createdAt",
          type: "datetime",
          description: "Vrijeme prijema podatka u bazu",
        },
      ],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
}

// GET /api/v1/api-url  (utility – gradi apsolutni URL za /parkings)
export async function apiUrl(req, res) {
  const url = new URL(`${req.protocol}://${req.get("host")}/api/v1/parkings`);
  for (const [k, v] of Object.entries(req.query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  res.json({ url: url.toString() });
}
