import { sequelize } from "../db.js";
import { ParkingDaily } from "../models/ParkingDaily.js";

const sqlDaily = `
INSERT INTO parking_daily (
  parkingRefId, day, samples, occ_avg, occ_max, occ_min,
  free_total_avg, free_total_min, free_total_max, createdAt, updatedAt
)
SELECT
  p.id AS parkingRefId,
  DATE(s.createdAt) AS day,
  COUNT(*) AS samples,
  AVG( ((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces)
       - (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces)
      ) / NULLIF((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces),0)
     ) AS occ_avg,
  MAX( ((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces)
       - (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces)
      ) / NULLIF((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces),0)
     ) AS occ_max,
  MIN( ((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces)
       - (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces)
      ) / NULLIF((s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces),0)
     ) AS occ_min,
  AVG( (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces) ) AS free_total_avg,
  MIN( (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces) ) AS free_total_min,
  MAX( (s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces) ) AS free_total_max,
  NOW(), NOW()
FROM parking_snapshots s
JOIN parkings p ON p.id = s.parkingRefId
WHERE s.createdAt >= :from AND s.createdAt < :to
GROUP BY p.id, DATE(s.createdAt)
ON DUPLICATE KEY UPDATE
  samples=VALUES(samples),
  occ_avg=VALUES(occ_avg), occ_max=VALUES(occ_max), occ_min=VALUES(occ_min),
  free_total_avg=VALUES(free_total_avg), free_total_min=VALUES(free_total_min), free_total_max=VALUES(free_total_max),
  updatedAt=NOW();
`;

export async function aggregateDaily({ from, to } = {}) {
  // default: od zadnjeg dana u daily+1 do jučer
  const [[last]] = await sequelize.query(
    "SELECT MAX(day) AS lastDay FROM parking_daily LIMIT 1;"
  );
  const start = from
    ? new Date(from)
    : last?.lastDay
    ? new Date(new Date(last.lastDay).getTime() + 86400000)
    : null;
  const yesterday = new Date();
  yesterday.setUTCHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(yesterday.getTime()); // exclusive

  if (!start) {
    // ako nema ništa u daily, kreni od najstarijeg snapshot-a
    const [[firstSnap]] = await sequelize.query(
      "SELECT MIN(createdAt) AS minCreated FROM parking_snapshots;"
    );
    if (!firstSnap?.minCreated) return { inserted: 0, from: null, to: null };
    const s = new Date(firstSnap.minCreated);
    s.setUTCHours(0, 0, 0, 0);
    return aggregateDaily({ from: s.toISOString(), to: end.toISOString() });
  }

  if (start >= end) return { inserted: 0, from: start, to: end };

  const [result] = await sequelize.query(sqlDaily, {
    replacements: { from: start, to: end },
  });

  // affectedRows ovisi o drajveru; vratimo back-of-envelope
  return { ok: true, from: start, to: end };
}
