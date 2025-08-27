import { applyCacheHeaders } from "../utils/httpCache.js";
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";
import { Op } from "sequelize";

export const peaks = async (req, res) => {
  const { q = "", cityName, zoneName, parkingTypeId, from, to } = req.query;

  const pWhere = {};
  if (q)
    pWhere[Op.or] = [
      { parkingName: { [Op.like]: `%${q}%` } },
      { parkingAddress: { [Op.like]: `%${q}%` } },
    ];
  if (cityName) pWhere.cityName = cityName;
  if (zoneName) pWhere.zoneName = zoneName;
  if (parkingTypeId) pWhere.parkingTypeId = parkingTypeId;

  const parks = await Parking.findAll({ where: pWhere, attributes: ["id"] });
  if (!parks.length) {
    return res.json({
      hourly: Array.from({ length: 24 }, (_, h) => ({
        hour: String(h).padStart(2, "0"),
        occupancyRatioAvg: 0,
        samples: 0,
      })),
      daily: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"].map((d, i) => ({
        dow: i,
        day: d,
        occupancyRatioMax: 0,
        samples: 0,
      })),
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
    sWhere.createdAt = { ...(sWhere.createdAt || {}), [Op.lte]: new Date(to) };

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
      s.totalNumberOfRegularPlaces + s.totalNumberOfSpecialPlaces || 0;
    const free = s.freeNumberOfRegularPlaces + s.freeNumberOfSpecialPlaces || 0;
    const occ = tot ? (tot - free) / tot : 0;

    const d = new Date(s.createdAt);
    const h = d.getHours(),
      w = d.getDay();

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
};
