// import { Router } from "express";
// import { asyncHandler } from "../middleware/asyncHandler.js";
// import {
//   listParkings,
//   exportParkings,
//   overviewStats,
//   byParkingStats,
//   lastForParking,
//   historyForParking,
//   // apiUrl,
//   historyMany, // <— NOVO
//   apiUrlCanon,
//   listSnapshots,
// } from "../controllers/parkings.controller.js";

// const r = Router();
// r.get("/parkings", asyncHandler(listParkings));
// r.get("/parkings/history", asyncHandler(historyMany));
// r.get("/export", asyncHandler(exportParkings));
// r.get("/stats/overview", asyncHandler(overviewStats));
// r.get("/stats/by-parking", asyncHandler(byParkingStats));
// r.get("/parkings/:parkingId/last", asyncHandler(lastForParking));
// r.get("/parkings/:parkingId/history", asyncHandler(historyForParking));
// // r.get("/api-url", asyncHandler(apiUrl)); // <— OVO dodaj
// r.get("/api-url", asyncHandler(apiUrlCanon));
// r.get("/snapshots", asyncHandler(listSnapshots));
// export default r;

// src/routes/parkings.routes.js
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listParkings,
  exportParkings,
  overviewStats,
  byParkingStats,
  peaks,
  lastForParking,
  historyForParking,
  snapshotsList,
  exportSnapshots,
  metadata,
  apiUrl,
} from "../controllers/parkings.controller.js";

const r = Router();

// LIST & EXPORT (zadnje stanje)
r.get("/parkings", asyncHandler(listParkings));
r.get("/export", asyncHandler(exportParkings));

// SNAPSHOTS (više parkinga + period) & EXPORT
r.get("/snapshots", asyncHandler(snapshotsList));
r.get("/export-snapshots", asyncHandler(exportSnapshots));

// STATS
r.get("/stats/overview", asyncHandler(overviewStats));
r.get("/stats/by-parking", asyncHandler(byParkingStats));
r.get("/stats/peaks", asyncHandler(peaks));

// SINGLE parking
r.get("/parkings/:parkingId/last", asyncHandler(lastForParking));
r.get("/parkings/:parkingId/history", asyncHandler(historyForParking));

// METADATA & API-URL helper
r.get("/metadata", asyncHandler(metadata));
r.get("/api-url", asyncHandler(apiUrl));

export default r;
