import { Op } from "sequelize";
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";

export const buildWhere = ({ q, cityName, zoneName, parkingTypeId }) => {
  const where = {};
  if (q)
    where[Op.or] = [
      { parkingName: { [Op.like]: `%${q}%` } },
      { parkingAddress: { [Op.like]: `%${q}%` } },
    ];
  if (cityName) where.cityName = cityName;
  if (zoneName) where.zoneName = zoneName;
  if (parkingTypeId) where.parkingTypeId = parkingTypeId;
  return where;
};

export const snapshotInclude = {
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
};

export const flattenRows = (rows) =>
  rows.map((p) => {
    const s = p.snapshots?.[0];
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
      longitude: p.longitude,
      latitude: p.latitude,
      parkingAddress: p.parkingAddress,
      createdAt: s ? s.createdAt : p.createdAt,
    };
  });

export const filterMinFree = (arr, minFree) => {
  if (minFree === undefined) return arr;
  const mf = parseInt(minFree, 10);
  if (Number.isNaN(mf)) return arr;
  return arr.filter(
    (r) => r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces >= mf
  );
};

const valueForSort = (r, k) => {
  if (k === "parkingName") return r.parkingName || "";
  if (k === "cityName") return r.cityName || "";
  if (k === "zoneName") return r.zoneName || "";
  if (k === "createdAt") return new Date(r.createdAt).getTime() || 0;
  if (k === "free")
    return r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
  if (k === "occupancyRatio") {
    const total =
      r.totalNumberOfRegularPlaces + r.totalNumberOfSpecialPlaces || 0;
    const free = r.freeNumberOfRegularPlaces + r.freeNumberOfSpecialPlaces || 0;
    return total ? (total - free) / total : 0;
  }
  return new Date(r.createdAt).getTime() || 0;
};

export const sortFlat = (arr, sort = "createdAt", order = "desc") => {
  const key = String(sort);
  const dir = String(order).toLowerCase() === "asc" ? 1 : -1;
  return arr.sort((a, b) => {
    const va = valueForSort(a, key),
      vb = valueForSort(b, key);
    if (typeof va === "string" && typeof vb === "string")
      return va.localeCompare(vb) * dir;
    return ((va > vb) - (va < vb)) * dir;
  });
};

export const paginate = (arr, page = 1, pageSize = 20) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
  const total = arr.length;
  const start = (p - 1) * size;
  return {
    page: p,
    pageSize: size,
    total,
    rows: arr.slice(start, start + size),
  };
};

export const lastUpdatedOf = (arr) =>
  arr.length
    ? new Date(
        Math.max(...arr.map((r) => +new Date(r.createdAt)))
      ).toISOString()
    : null;

export async function findAllWithLatest(where) {
  return Parking.findAll({ where, include: [snapshotInclude] });
}
