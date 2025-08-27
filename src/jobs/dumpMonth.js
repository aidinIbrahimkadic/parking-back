import { promises as fs } from "fs";
import path from "path";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { sequelize } from "../db.js";
import { toCSV } from "../utils/exports.js";

const DUMPS_DIR = path.resolve(process.cwd(), "dumps");

function ymRange(ym) {
  // ym: "YYYY-MM"
  const [Y, M] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(Y, M - 1, 1));
  const to = new Date(Date.UTC(Y, M, 1)); // exclusive
  return { from, to };
}

export async function ensureDumpsDir() {
  await fs.mkdir(DUMPS_DIR, { recursive: true });
  return DUMPS_DIR;
}

export async function dumpMonth(ym = null) {
  await ensureDumpsDir();

  // default: prošli mjesec
  if (!ym) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 1);
    ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }

  const { from, to } = ymRange(ym);

  const [rows] = await sequelize.query(
    `
    SELECT
      s.parkingId, s.parkingName, s.cityName, s.zoneName, s.zoneColor,
      s.numberOfParkingPlaces, s.totalNumberOfRegularPlaces, s.freeNumberOfRegularPlaces,
      s.totalNumberOfSpecialPlaces, s.freeNumberOfSpecialPlaces,
      s.parkingTypeId, s.locationId, s.longitude, s.latitude, s.parkingAddress,
      s.createdAt
    FROM parking_snapshots s
    WHERE s.createdAt >= :from AND s.createdAt < :to
    ORDER BY s.createdAt ASC
    `,
    { replacements: { from, to } }
  );

  const csv = toCSV(rows || []);
  const outPath = path.join(DUMPS_DIR, `parking_snapshots_${ym}.csv.gz`);

  // gzip write
  const gz = zlib.createGzip();
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.from(csv));
      controller.close();
    },
  }); // Node18+ web streams

  // convert WebReadable to Node stream:
  const nodeReadable = streamFromWeb(source);

  await pipeline(
    nodeReadable,
    gz,
    (await import("fs")).createWriteStream(outPath)
  );

  return { ym, rows: rows.length, file: outPath };
}

// helper: Node18+ util
import { Readable } from "stream";
function streamFromWeb(webReadable) {
  return Readable.from(webReadable);
}

export async function listDumps() {
  await ensureDumpsDir();
  const files = await fs.readdir(DUMPS_DIR);
  const out = [];
  for (const f of files.filter((x) => x.endsWith(".csv.gz"))) {
    const stat = await fs.stat(path.join(DUMPS_DIR, f));
    out.push({ file: f, size: stat.size, mtime: stat.mtime });
  }
  out.sort((a, b) => a.file.localeCompare(b.file));
  return out;
}
