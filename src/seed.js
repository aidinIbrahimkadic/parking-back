import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "./db.js";
import { Parking } from "./models/Parking.js";
import { ParkingSnapshot } from "./models/ParkingSnapshot.js";
import { Document } from "./models/Document.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

async function run() {
  await sequelize.sync({ alter: true });

  await Document.bulkCreate(
    [
      {
        title: "Odluka o organizaciji parkiranja",
        doc_type: "Odluka",
        description: "Zone i cijene",
        file_url: "#",
        published_at: new Date(Date.now() - 30 * 864e5),
      },
      {
        title: "Pravilnik o povlaštenim kartama",
        doc_type: "Pravilnik",
        description: "Kriteriji i prava",
        file_url: "#",
        published_at: new Date(Date.now() - 10 * 864e5),
      },
      {
        title: "Uputstvo za mobilnu aplikaciju",
        doc_type: "Uputstvo",
        description: "Kako platiti i provjeriti status",
        file_url: "#",
        published_at: new Date(Date.now() - 2 * 864e5),
      },
    ],
    { ignoreDuplicates: true }
  );

  // ---- 1) META PARKINZI (strogo tvoja polja) ----
  const parkings = [
    {
      parkingId: "P-001",
      parkingName: "Gradski Parking Centar",
      cityName: "Tešanj",
      zoneName: "Crvena",
      zoneColor: "#ef4444",
      numberOfParkingPlaces: 120,
      totalNumberOfRegularPlaces: 102,
      totalNumberOfSpecialPlaces: 18,
      parkingTypeId: "Ulica",
      locationId: "LOC-001",
      longitude: 17.985,
      latitude: 44.615,
      parkingAddress: "Ul. Titova 1",
    },
    {
      parkingId: "P-002",
      parkingName: "Bazeni",
      cityName: "Tešanj",
      zoneName: "Žuta",
      zoneColor: "#f59e0b",
      numberOfParkingPlaces: 80,
      totalNumberOfRegularPlaces: 68,
      totalNumberOfSpecialPlaces: 12,
      parkingTypeId: "Otvoreni",
      locationId: "LOC-002",
      longitude: 17.99,
      latitude: 44.62,
      parkingAddress: "Kiseljak bb",
    },
    {
      parkingId: "P-003",
      parkingName: "Tržnica",
      cityName: "Tešanj",
      zoneName: "Plava",
      zoneColor: "#3b82f6",
      numberOfParkingPlaces: 60,
      totalNumberOfRegularPlaces: 51,
      totalNumberOfSpecialPlaces: 9,
      parkingTypeId: "Ulica",
      locationId: "LOC-003",
      longitude: 17.975,
      latitude: 44.61,
      parkingAddress: "Ul. H. Ibre 7",
    },
    {
      parkingId: "P-004",
      parkingName: "Bolnica",
      cityName: "Doboj Jug",
      zoneName: "Žuta",
      zoneColor: "#f59e0b",
      numberOfParkingPlaces: 200,
      totalNumberOfRegularPlaces: 170,
      totalNumberOfSpecialPlaces: 30,
      parkingTypeId: "Garaža",
      locationId: "LOC-004",
      longitude: 18.09,
      latitude: 44.66,
      parkingAddress: "H. Zmaja 12",
    },
    {
      parkingId: "P-005",
      parkingName: "Stadion",
      cityName: "Maglaj",
      zoneName: "Crvena",
      zoneColor: "#ef4444",
      numberOfParkingPlaces: 150,
      totalNumberOfRegularPlaces: 128,
      totalNumberOfSpecialPlaces: 22,
      parkingTypeId: "Otvoreni",
      locationId: "LOC-005",
      longitude: 18.1,
      latitude: 44.53,
      parkingAddress: "Sportskih 3",
    },
  ];

  // upsert meta
  for (const p of parkings) {
    await Parking.upsert(p);
  }
  const meta = await Parking.findAll();

  // ---- 2) SNAPSHOTOVI (zadnja 3 dana, po satu) ----
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  for (const p of meta) {
    for (
      let t = new Date(start);
      t <= now;
      t = new Date(t.getTime() + 60 * 60 * 1000)
    ) {
      const hour = t.getHours();
      const base =
        (hour >= 9 && hour <= 17
          ? 0.75
          : hour >= 18 && hour <= 21
          ? 0.55
          : 0.25) +
        (p.zoneName === "Crvena"
          ? 0.08
          : p.zoneName === "Žuta"
          ? 0.03
          : -0.02) +
        (p.cityName === "Tešanj" ? 0.05 : 0);
      const noise = (Math.random() - 0.5) * 0.12;
      const occRatio = clamp(base + noise, 0.05, 0.98);

      const total = p.numberOfParkingPlaces;
      const occ = Math.round(total * occRatio);
      const freeTotal = clamp(total - occ, 0, total);
      const freeReg = clamp(
        Math.round(
          freeTotal * (p.totalNumberOfRegularPlaces / total) +
            (Math.random() - 0.5) * 2
        ),
        0,
        p.totalNumberOfRegularPlaces
      );
      const freeSpec = clamp(
        freeTotal - freeReg,
        0,
        p.totalNumberOfSpecialPlaces
      );

      await ParkingSnapshot.create({
        parkingRefId: p.id, // interni FK
        // striktna polja:
        parkingId: p.parkingId,
        parkingName: p.parkingName,
        cityName: p.cityName,
        zoneName: p.zoneName,
        zoneColor: p.zoneColor,
        numberOfParkingPlaces: p.numberOfParkingPlaces,
        totalNumberOfRegularPlaces: p.totalNumberOfRegularPlaces,
        freeNumberOfRegularPlaces: freeReg,
        totalNumberOfSpecialPlaces: p.totalNumberOfSpecialPlaces,
        freeNumberOfSpecialPlaces: freeSpec,
        parkingTypeId: p.parkingTypeId,
        locationId: p.locationId,
        longitude: p.longitude,
        latitude: p.latitude,
        parkingAddress: p.parkingAddress,
        // Dozvoljeni datum prijema:
        createdAt: t,
      });
    }
  }

  console.log("Seed gotovo ✅");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
