import { fetchParkingsFindAll } from "../externalClient.js";
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";

export async function runFetchOnce() {
  const arr = await fetchParkingsFindAll();
  const cityNameDefault = process.env.CITY_NAME || "";

  const now = new Date();
  let upserted = 0,
    snap = 0,
    skipped = 0;

  for (const p of arr) {
    const mapped = {
      parkingId: String(p.parkingId),
      parkingName: p.parkingName,
      cityName: cityNameDefault,
      zoneName: p.zoneName,
      zoneColor: p.zoneColor,
      numberOfParkingPlaces:
        p.numberOfParkingPlaces ??
        (p.totalNumberOfRegularPlaces || 0) +
          (p.totalNumberOfSpecialPlaces || 0),
      totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces ?? 0,
      freeNumberOfRegularPlaces: p.freeNumberOfRegularPlaces ?? 0,
      totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces ?? 0,
      freeNumberOfSpecialPlaces: p.freeNumberOfSpecialPlaces ?? 0,
      parkingTypeId: String(p.parkingTypeId ?? ""),
      locationId: String(p.locationId ?? ""),
      longitude: p.longitude,
      latitude: p.latitude,
      parkingAddress: p.parkingAddress,
    };

    await Parking.upsert(mapped);
    upserted++;

    const meta = await Parking.findOne({
      where: { parkingId: mapped.parkingId },
      attributes: ["id"],
    });

    // —— DEDUP: ako se ništa nije promijenilo, preskoči insert
    const last = await ParkingSnapshot.findOne({
      where: { parkingRefId: meta.id },
      order: [["createdAt", "DESC"]],
      attributes: [
        "freeNumberOfRegularPlaces",
        "freeNumberOfSpecialPlaces",
        "totalNumberOfRegularPlaces",
        "totalNumberOfSpecialPlaces",
        "numberOfParkingPlaces",
      ],
    });
    const same =
      last &&
      last.freeNumberOfRegularPlaces === mapped.freeNumberOfRegularPlaces &&
      last.freeNumberOfSpecialPlaces === mapped.freeNumberOfSpecialPlaces &&
      last.totalNumberOfRegularPlaces === mapped.totalNumberOfRegularPlaces &&
      last.totalNumberOfSpecialPlaces === mapped.totalNumberOfSpecialPlaces &&
      last.numberOfParkingPlaces === mapped.numberOfParkingPlaces;

    if (same) {
      skipped++;
      continue;
    }

    await ParkingSnapshot.create({
      parkingRefId: meta.id,
      ...mapped,
      createdAt: now,
    });
    snap++;
  }

  return { upserted, snapshots: snap, skipped, at: now.toISOString() };
}
