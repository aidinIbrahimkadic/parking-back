import { sequelize } from "../db.js";

const sqlMonthly = `
INSERT INTO parking_monthly (
  parkingRefId, month, samples,
  occ_avg, occ_max, occ_min,
  free_total_avg, free_total_min, free_total_max,
  createdAt, updatedAt
)
SELECT
  parkingRefId,
  DATE_FORMAT(day, '%Y-%m') AS month,
  SUM(samples) AS samples,
  SUM(samples * occ_avg) / NULLIF(SUM(samples),0) AS occ_avg,  -- težinski prosjek
  MAX(occ_max) AS occ_max,
  MIN(occ_min) AS occ_min,
  AVG(free_total_avg) AS free_total_avg,
  MIN(free_total_min) AS free_total_min,
  MAX(free_total_max) AS free_total_max,
  NOW(), NOW()
FROM parking_daily
WHERE day >= :from AND day < :to
GROUP BY parkingRefId, DATE_FORMAT(day, '%Y-%m')
ON DUPLICATE KEY UPDATE
  samples=VALUES(samples),
  occ_avg=VALUES(occ_avg), occ_max=VALUES(occ_max), occ_min=VALUES(occ_min),
  free_total_avg=VALUES(free_total_avg), free_total_min=VALUES(free_total_min), free_total_max=VALUES(free_total_max),
  updatedAt=NOW();
`;

export async function aggregateMonthly({ from, to } = {}) {
  // default: od početka tekuće godine do sljedećeg mjeseca (exclusive),
  // ali slobodno zovi sa granicama npr. prev month
  const now = new Date();
  const yStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const f = from ?? yStart.toISOString();
  const t = to ?? nextMonth.toISOString();

  await sequelize.query(sqlMonthly, { replacements: { from: f, to: t } });
  return { ok: true, from: f, to: t };
}
