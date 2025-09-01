// src/jobs/fetchJob.js
import { fetchParkingsFindAll } from "../externalClient.js";
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";

/**
 * Mapira novi format (parking-templates/find-all-info) na stari interni shape.
 * Zadržavamo ista imena kolona koja koristi ostatak aplikacije/exporta.
 */
function normalizeExternalRow(row) {
  // Novi API ima ova polja:
  // numberOfSpot, numberOfRegularSpot, numberOfSpecialSpot, numberOfPrivateSpot
  // freeRegularSpot, freeSpecialSpot, freePrivateSpot, totalFreeSpots
  const hasNewShape =
    row.numberOfSpot != null ||
    row.numberOfRegularSpot != null ||
    row.freeRegularSpot != null;

  if (hasNewShape) {
    const totalRegular = Number(row.numberOfRegularSpot ?? 0);
    const totalSpecial = Number(row.numberOfSpecialSpot ?? 0);
    const totalPrivate = Number(row.numberOfPrivateSpot ?? 0);

    const totalAll =
      Number(row.numberOfSpot ?? 0) ||
      totalRegular + totalSpecial + totalPrivate;

    const freeRegular = Number(row.freeRegularSpot ?? 0);
    const freeSpecial = Number(row.freeSpecialSpot ?? 0);
    const freePrivate = Number(row.freePrivateSpot ?? 0);

    const freeAll =
      Number(row.totalFreeSpots ?? 0) ||
      freeRegular + freeSpecial + freePrivate;

    return {
      // identitet
      parkingId: String(row.parkingId ?? row.id ?? ""),
      parkingName: row.parkingName || row.name || String(row.parkingId ?? ""),

      // polja koja ostatak sistema očekuje
      numberOfParkingPlaces: totalAll,

      totalNumberOfRegularPlaces: totalRegular,
      freeNumberOfRegularPlaces: freeRegular,

      totalNumberOfSpecialPlaces: totalSpecial,
      freeNumberOfSpecialPlaces: freeSpecial,

      // korisno za prikaz/aggregate
      freeTotal: freeAll,
      occupied: Math.max(0, totalAll - freeAll),

      // polja kojih više nema – ostavljamo null (schema kompatibilnost)
      cityName: null,
      zoneName: null,
      zoneColor: null,
      parkingTypeId: null,
      locationId: null,
      longitude: null,
      latitude: null,
      parkingAddress: null,
    };
  }

  // Fallback ako ikad dobiješ stari format sa istog URL-a
  const total = Number(row.numberOfParkingPlaces ?? 0);
  const freeReg = Number(row.freeNumberOfRegularPlaces ?? 0);
  const freeSpec = Number(row.freeNumberOfSpecialPlaces ?? 0);
  return {
    parkingId: String(row.parkingId ?? row.id ?? ""),
    parkingName: row.parkingName ?? row.name ?? "",
    numberOfParkingPlaces: total,

    totalNumberOfRegularPlaces: Number(row.totalNumberOfRegularPlaces ?? 0),
    freeNumberOfRegularPlaces: freeReg,

    totalNumberOfSpecialPlaces: Number(row.totalNumberOfSpecialPlaces ?? 0),
    freeNumberOfSpecialPlaces: freeSpec,

    freeTotal: freeReg + freeSpec,
    occupied: Math.max(0, total - (freeReg + freeSpec)),

    cityName: row.cityName ?? null,
    zoneName: row.zoneName ?? null,
    zoneColor: row.zoneColor ?? null,
    parkingTypeId: row.parkingTypeId ?? null,
    locationId: row.locationId ?? null,
    longitude: row.longitude ?? null,
    latitude: row.latitude ?? null,
    parkingAddress: row.parkingAddress ?? null,
  };
}

/** Brzi cache da ne pingamo DB za isti parking u jednoj iteraciji */
const parkingRefCache = new Map();

/** Na osnovu parkingId/name osigura Parking red i vrati njegov PK (id) */
async function ensureParkingRefId(it) {
  const key = String(it.parkingId);
  if (parkingRefCache.has(key)) return parkingRefCache.get(key);

  // probaj naći po parkingId
  let p = await Parking.findOne({ where: { parkingId: key } });

  // ako ne postoji – kreiraj minimalno (ostalo je opcionalno)
  if (!p) {
    p = await Parking.create({
      parkingId: key,
      parkingName: it.parkingName || key,
      cityName: it.cityName ?? null,
      zoneName: it.zoneName ?? null,
      zoneColor: it.zoneColor ?? null,
      parkingTypeId: it.parkingTypeId ?? null,
      locationId: it.locationId ?? null,
      longitude: it.longitude ?? null,
      latitude: it.latitude ?? null,
      parkingAddress: it.parkingAddress ?? null,
      numberOfParkingPlaces: it.numberOfParkingPlaces ?? 0,
      totalNumberOfRegularPlaces: it.totalNumberOfRegularPlaces ?? 0,
      totalNumberOfSpecialPlaces: it.totalNumberOfSpecialPlaces ?? 0,
    });
  } else {
    // (best-effort) osvježi naziv/broj mjesta ako se promijenio
    const patch = {};
    if (it.parkingName && it.parkingName !== p.parkingName)
      patch.parkingName = it.parkingName;
    if (
      typeof it.numberOfParkingPlaces === "number" &&
      it.numberOfParkingPlaces !== p.numberOfParkingPlaces
    )
      patch.numberOfParkingPlaces = it.numberOfParkingPlaces;

    if (Object.keys(patch).length) {
      await p.update(patch);
    }
  }

  parkingRefCache.set(key, p.id);
  return p.id;
}

/**
 * Fetch sa novog eksternog API-ja, mapiranje i upis u ParkingSnapshot.
 */
export async function runFetchOnce() {
  // 1) povuci podatke sa auth wrapperom
  const raw = await fetchParkingsFindAll();
  if (!Array.isArray(raw)) throw new Error("Unexpected external response");

  // 2) normalizuj u “stari” oblik
  const mapped = raw.map(normalizeExternalRow);

  // 3) (opcionalno) filter dozvoljenih parkinga iz ENV-a
  const allowedSet = new Set(
    String(process.env.ALLOWED_PUBLIC_PARKINGS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const filtered = allowedSet.size
    ? mapped.filter((it) => allowedSet.has(String(it.parkingId)))
    : mapped;

  // 4) upis — obavezno popuni parkingRefId
  const now = new Date();
  const payload = [];
  for (const it of filtered) {
    try {
      const parkingRefId = await ensureParkingRefId(it);
      payload.push({
        parkingRefId,
        parkingId: it.parkingId,
        parkingName: it.parkingName,

        numberOfParkingPlaces: it.numberOfParkingPlaces,

        totalNumberOfRegularPlaces: it.totalNumberOfRegularPlaces,
        freeNumberOfRegularPlaces: it.freeNumberOfRegularPlaces,

        totalNumberOfSpecialPlaces: it.totalNumberOfSpecialPlaces,
        freeNumberOfSpecialPlaces: it.freeNumberOfSpecialPlaces,

        // ova polja će Sequelize ignorirati ako ne postoje u modelu (safe)
        freeTotal: it.freeTotal,
        occupied: it.occupied,

        createdAt: now, // može i default, ali ovako jasno bilježimo batch
        updatedAt: now,
      });
    } catch (e) {
      console.warn(
        "[fetchJob] ensure/prepare failed for parkingId=",
        it.parkingId,
        e.message
      );
    }
  }

  // 5) bulk insert (brže), fallback na pojedinačno ako baš treba
  if (payload.length) {
    try {
      await ParkingSnapshot.bulkCreate(payload, { ignoreDuplicates: false });
    } catch (e) {
      console.warn("[fetchJob] bulkCreate failed -> per-row insert", e.message);
      for (const row of payload) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await ParkingSnapshot.create(row);
        } catch (e2) {
          console.warn(
            "[fetchJob] insert failed parkingId=",
            row.parkingId,
            e2.message
          );
        }
      }
    }
  }

  return { count: payload.length, at: now.toISOString() };
}
