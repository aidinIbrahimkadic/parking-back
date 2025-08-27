import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";
import { applyCacheHeaders } from "../utils/httpCache.js";

export const metadata = async (req, res) => {
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
};
