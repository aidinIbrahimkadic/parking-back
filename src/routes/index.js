// import { Op } from "sequelize";
// import express from "express";
// import { toCSV, toXLSX, toXML } from "./utils/exports.js";
// import helmet from "helmet";
// // import cors from "cors";
// import rateLimit from "express-rate-limit";
// import dotenv from "dotenv";
// import { connectDB, sequelize } from "./db.js";
// import { Parking } from "./models/Parking.js";
// import { ParkingSnapshot } from "./models/ParkingSnapshot.js";
// import { Document } from "./models/Document.js";
// import swaggerUi from "swagger-ui-express";
// import { openapiSpec } from "./openapi.js";

// import cron from "node-cron";
// import { runFetchOnce } from "./jobs/fetchJob.js";

// import compression from "compression";
// import morgan from "morgan";
// import { randomUUID } from "node:crypto";
// import { corsAllowlist } from "./middleware/cors.js";
// import { applyCacheHeaders } from "./utils/httpCache.js";
// import { setPaginationLinks } from "./utils/pagination.js";

// dotenv.config();

// const app = express();

// app.use((req, res, next) => {
//   req.id = req.headers["x-request-id"] || randomUUID();
//   res.setHeader("X-Request-Id", req.id);
//   next();
// });
// morgan.token("reqid", (req) => req.id);
// app.use(
//   morgan(
//     "[:date[iso]] :method :url :status :res[content-length] - :response-time ms reqid=:reqid"
//   )
// );

// app.use(compression());
// app.use(corsAllowlist());

// app.use(helmet());
// // app.use(cors());
// app.use(express.json({ limit: "10mb" }));

// // Lagani rate limit na public API
// app.use("/api/v1", rateLimit({ windowMs: 60 * 1000, max: 120 }));

// // Health
// app.get("/health", (_req, res) => res.json({ ok: true }));

// // Minimalna public lista (posljednji snapshot po parkingu)
// app.get("/api/v1/parkings", async (req, res) => {
//   try {
//     const {
//       q = "",
//       cityName,
//       zoneName,
//       parkingTypeId,
//       minFree,
//       sort = "createdAt", // 'parkingName' | 'cityName' | 'zoneName' | 'createdAt' | 'free' | 'occupancyRatio'
//       order = "desc", // 'asc' | 'desc'
//       page = "1",
//       pageSize = "20",
//     } = req.query;

//     // 1) Parking-level filter (jeftin, prije join-a)
//     const where = {};
//     if (q)
//       where[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     if (cityName) where.cityName = cityName;
//     if (zoneName) where.zoneName = zoneName;
//     if (parkingTypeId) where.parkingTypeId = parkingTypeId;

//     // 2) Učitaj parkings + NAJNOVIJI snapshot (separate+limit=1 radi performansi i korektnosti)
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

//     // 3) Flatten u striktni payload (samo dozvoljena polja + createdAt)
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

//     // 4) Dodatni filter koji zavisi od snapshot-a (minFree)
//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) {
//         flat = flat.filter(
//           (r) => r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces >= mf
//         );
//       }
//     }

//     // 5) Sort (interno računamo vrijednosti, ali NE vraćamo nove kolone)
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
//       return new Date(r.createdAt).getTime() || 0; // default
//     };
//     flat.sort((a, b) => {
//       const va = val(a, key),
//         vb = val(b, key);
//       if (typeof va === "string" && typeof vb === "string")
//         return va.localeCompare(vb) * dir;
//       return ((va > vb) - (va < vb)) * dir;
//     });

//     // 6) Paginate
//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
//     const total = flat.length;
//     const start = (pageNum - 1) * size;
//     const rowsPage = flat.slice(start, start + size);

//     const lastUpdated = rowsPage.length
//       ? new Date(
//           Math.max(...rowsPage.map((r) => +new Date(r.createdAt)))
//         ).toISOString()
//       : null;

//     // 1) Cache headers (304 ako nema promjene)
//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated}`,
//         maxAge: 60,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     // 2) Link paginate header
//     setPaginationLinks(req, res, pageNum, size, total);

//     res.json({ page: pageNum, pageSize: size, total, rows: rowsPage });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// app.get("/api/v1/stats/overview", async (req, res) => {
//   try {
//     // --- preuzmi isti skup kao /api/v1/parkings, ali bez sortiranja/paginacije ---
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

//     // --- agregati ---
//     const total = flat.reduce((acc, r) => acc + r.numberOfParkingPlaces, 0);
//     const free = flat.reduce(
//       (acc, r) =>
//         acc + (r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces),
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
// });

// app.get("/api/v1/stats/by-parking", async (req, res) => {
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
//       const total = p.numberOfParkingPlaces;
//       return {
//         // originalna polja:
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

//         // agregati za graf:
//         occupied: total - free,
//         freeTotal: free,
//       };
//     });

//     if (minFree !== undefined) {
//       const mf = parseInt(minFree, 10);
//       if (!Number.isNaN(mf)) out = out.filter((r) => r.freeTotal >= mf);
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
// });

// app.get("/api/v1/export", async (req, res) => {
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

//     // Sort (isto kao /parkings)
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
//       return new Date(r.createdAt).getTime() || 0; // default
//     };
//     flat.sort((a, b) => {
//       const va = val(a, key),
//         vb = val(b, key);
//       if (typeof va === "string" && typeof vb === "string")
//         return va.localeCompare(vb) * dir;
//       return ((va > vb) - (va < vb)) * dir;
//     });

//     // >>> Cache headers (ETag/Last-Modified) – 5 min
//     const lastUpdated = flat.length
//       ? new Date(
//           Math.max(...flat.map((r) => +new Date(r.createdAt)))
//         ).toISOString()
//       : null;

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated ?? 0}`,
//         maxAge: 300,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     // Export
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
//     // default CSV
//     const csv = toCSV(flat);
//     res.setHeader("Content-Type", "text/csv");
//     res.setHeader("Content-Disposition", 'attachment; filename="parkings.csv"');
//     return res.send(csv);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// app.get("/api/v1/metadata", async (req, res) => {
//   try {
//     // max(createdAt) iz snapshotova (ako nema, uzmi max iz parkings)
//     const lastSnap = await ParkingSnapshot.findOne({
//       attributes: ["createdAt"],
//       order: [["createdAt", "DESC"]],
//     });
//     const lastMeta = await Parking.findOne({
//       attributes: ["createdAt"],
//       order: [["createdAt", "DESC"]],
//     });
//     const lastUpdated = lastSnap?.createdAt || lastMeta?.createdAt || null;

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated ?? 0}`,
//         maxAge: 300,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     res.json({
//       title: "Open Data – Parking Occupancy (hourly snapshots)",
//       description:
//         "Satni snapshotovi zauzetosti javnih parkinga (broj mjesta, slobodna mjesta, zauzetost).",
//       license: "CC BY 4.0",
//       last_updated: lastUpdated,
//       fields: [
//         { name: "parkingId", type: "string" },
//         { name: "parkingName", type: "string" },
//         { name: "cityName", type: "string" },
//         { name: "zoneName", type: "string" },
//         { name: "zoneColor", type: "string" },
//         { name: "numberOfParkingPlaces", type: "integer" },
//         { name: "totalNumberOfRegularPlaces", type: "integer" },
//         { name: "freeNumberOfRegularPlaces", type: "integer" },
//         { name: "totalNumberOfSpecialPlaces", type: "integer" },
//         { name: "freeNumberOfSpecialPlaces", type: "integer" },
//         { name: "parkingTypeId", type: "string" },
//         { name: "locationId", type: "string" },
//         { name: "longitude", type: "number" },
//         { name: "latitude", type: "number" },
//         { name: "parkingAddress", type: "string" },
//         {
//           name: "createdAt",
//           type: "datetime",
//           description: "Vrijeme prijema podatka u bazu",
//         },
//       ],
//     });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// app.get("/api/v1/parkings/:parkingId/history", async (req, res) => {
//   try {
//     const { parkingId } = req.params;
//     const { from, to } = req.query;

//     const p = await Parking.findOne({ where: { parkingId } });
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
//         // isključivo dozvoljena polja + createdAt
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
// });

// app.get("/api/v1/api-url", (req, res) => {
//   const url = new URL(`${req.protocol}://${req.get("host")}/api/v1/parkings`);
//   for (const [k, v] of Object.entries(req.query)) {
//     if (v !== undefined && v !== "") url.searchParams.set(k, v);
//   }
//   res.json({ url: url.toString() });
// });

// // SATNI PROSJEK + DNEVNI MAKS, sa filtrima i periodom
// app.get("/api/v1/stats/peaks", async (req, res) => {
//   try {
//     const { q = "", cityName, zoneName, parkingTypeId, from, to } = req.query;

//     // 1) Filtriraj parkinge po metapodacima
//     const pWhere = {};
//     if (q)
//       pWhere[Op.or] = [
//         { parkingName: { [Op.like]: `%${q}%` } },
//         { parkingAddress: { [Op.like]: `%${q}%` } },
//       ];
//     if (cityName) pWhere.cityName = cityName;
//     if (zoneName) pWhere.zoneName = zoneName;
//     if (parkingTypeId) pWhere.parkingTypeId = parkingTypeId;

//     const parks = await Parking.findAll({ where: pWhere, attributes: ["id"] });
//     if (!parks.length) {
//       return res.json({
//         hourly: Array.from({ length: 24 }, (_, h) => ({
//           hour: String(h).padStart(2, "0"),
//           occupancyRatioAvg: 0,
//           samples: 0,
//         })),
//         daily: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"].map(
//           (d, i) => ({ dow: i, day: d, occupancyRatioMax: 0, samples: 0 })
//         ),
//         from: from || null,
//         to: to || null,
//         lastUpdated: null,
//       });
//     }
//     const ids = parks.map((p) => p.id);

//     // 2) Filtriraj snapshotove po parkingRefId + period
//     const sWhere = { parkingRefId: ids };
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

//     const snaps = await ParkingSnapshot.findAll({
//       where: sWhere,
//       attributes: [
//         "totalNumberOfRegularPlaces",
//         "freeNumberOfRegularPlaces",
//         "totalNumberOfSpecialPlaces",
//         "freeNumberOfSpecialPlaces",
//         "createdAt",
//       ],
//       order: [["createdAt", "ASC"]],
//     });

//     // 3) Izračun
//     const hourly = Array.from({ length: 24 }, (_, h) => ({
//       hour: String(h).padStart(2, "0"),
//       sum: 0,
//       n: 0,
//     }));
//     const days = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"];
//     const daily = Array.from({ length: 7 }, (_, i) => ({
//       dow: i,
//       day: days[i],
//       max: 0,
//       n: 0,
//     }));

//     for (const s of snaps) {
//       const tot =
//         s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces || 0;
//       const free =
//         s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces || 0;
//       const occ = tot ? (tot - free) / tot : 0;

//       const d = new Date(s.createdAt);
//       const h = d.getHours();
//       const w = d.getDay();

//       hourly[h].sum += occ;
//       hourly[h].n += 1;
//       if (occ > daily[w].max) daily[w].max = occ;
//       daily[w].n += 1;
//     }

//     const hourlyOut = hourly.map((b) => ({
//       hour: b.hour,
//       occupancyRatioAvg: b.n ? b.sum / b.n : 0,
//       samples: b.n,
//     }));
//     const dailyOut = daily.map((b) => ({
//       dow: b.dow,
//       day: b.day,
//       occupancyRatioMax: b.max,
//       samples: b.n,
//     }));

//     const lastUpdated = snaps.length ? snaps[snaps.length - 1].createdAt : null;

//     if (
//       applyCacheHeaders(req, res, {
//         key: `${req.originalUrl}|${lastUpdated ?? 0}`,
//         maxAge: 60,
//         lastModified: lastUpdated,
//       })
//     )
//       return;

//     res.json({
//       hourly: hourlyOut,
//       daily: dailyOut,
//       from: from || null,
//       to: to || null,
//       lastUpdated,
//     });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// app.get("/api/v1/documents", async (req, res) => {
//   try {
//     const {
//       q = "",
//       doc_type,
//       sort = "published_at",
//       order = "desc",
//       page = "1",
//       pageSize = "20",
//     } = req.query;

//     const where = {};
//     if (q)
//       where[Op.or] = [
//         { title: { [Op.like]: `%${q}%` } },
//         { description: { [Op.like]: `%${q}%` } },
//       ];
//     if (doc_type) where.doc_type = doc_type;

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
//     const offset = (pageNum - 1) * size;

//     const { rows, count } = await Document.findAndCountAll({
//       where,
//       order: [
//         [sort, order.toUpperCase() === "ASC" ? "ASC" : "DESC"],
//         ["id", "DESC"],
//       ],
//       limit: size,
//       offset,
//       attributes: [
//         "id",
//         "title",
//         "doc_type",
//         "description",
//         "file_url",
//         "published_at",
//         "createdAt",
//       ],
//     });

//     res.json({ page: pageNum, pageSize: size, total: count, rows });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// // DETALJ dokumenta
// app.get("/api/v1/documents/:id", async (req, res) => {
//   try {
//     const doc = await Document.findByPk(req.params.id, {
//       attributes: [
//         "id",
//         "title",
//         "doc_type",
//         "description",
//         "file_url",
//         "published_at",
//         "createdAt",
//       ],
//     });
//     if (!doc) return res.status(404).json({ error: "Not found" });
//     res.json(doc);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Internal error" });
//   }
// });

// cron.schedule(
//   "0 * * * *",
//   async () => {
//     try {
//       console.log("[cron] Fetching parkings…");
//       const res = await runFetchOnce();
//       console.log("[cron] Done:", res);
//     } catch (e) {
//       console.error("[cron] Error:", e.message);
//     }
//   },
//   { timezone: "Europe/Sarajevo" }
// );

// app.get("/api/v1/parkings/:parkingId/last", async (req, res) => {
//   try {
//     const p = await Parking.findOne({
//       where: { parkingId: req.params.parkingId },
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

//     // Cache (ETag) po URL-u + createdAt zadnjeg snapshota
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
// });

// app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// const port = process.env.PORT || 4000;

// (async function bootstrap() {
//   try {
//     await connectDB();
//     // Kreiranje tablica (dev): koristi alter u ranoj fazi
//     await sequelize.sync({ alter: true });
//     app.listen(port, () =>
//       console.log(`API listening on http://localhost:${port}`)
//     );
//   } catch (e) {
//     console.error("Failed to start:", e);
//     process.exit(1);
//   }
// })();

// app.use((err, _req, res, _next) => {
//   console.error("[unhandled]", err);
//   res.status(500).json({ error: "Internal error" });
// });

// routes/index.js (agregator za /api/v1 i root)
import { Router } from "express";
// import parkings from "./parkings.routes.js";
import parkingsRoutes from "./parkings.routes.js";
import stats from "./stats.routes.js";
import documents from "./documents.routes.js";
import meta from "./meta.routes.js";
import dumps from "./dumps.routes.js";
import aggregates from "./aggregates.routes.js";

const api = Router();
api.use(parkingsRoutes);
api.use(stats);
api.use(documents);
api.use(meta);
api.use(dumps);
api.use(aggregates);

export { api };
