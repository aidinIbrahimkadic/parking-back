// src/controllers/meta.controller.js
import { Parking } from "../models/Parking.js";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";
import { MetaSettings } from "../models/MetaSettings.js";
import { applyCacheHeaders } from "../utils/httpCache.js";

/** Vrati (ili kreiraj) singleton meta record (id=1) */
async function getOrCreateMeta() {
  let row = await MetaSettings.findByPk(1);
  if (!row) {
    row = await MetaSettings.create({
      id: 1,
      title: "Open Data – Parking Tešanj",
      description:
        "Otvoreni podaci o zauzetosti javnih parkinga (broj mjesta, slobodna mjesta, zauzetost).",
      license: "CC BY 4.0",
      contact_email: process.env.META_CONTACT_EMAIL || null,
      source_url: process.env.META_SOURCE_URL || null,
      homepage_url: process.env.META_HOMEPAGE_URL || null,
      public_base_url: process.env.META_PUBLIC_BASE_URL || null,
      notes: null,
    });
  }
  return row;
}

/** PUBLIC: /api/v1/metadata */
export const metadata = async (req, res) => {
  // zadnje ažuriranje iz podataka (snapshots / metadata)
  const lastSnap = await ParkingSnapshot.findOne({
    attributes: ["createdAt"],
    order: [["createdAt", "DESC"]],
  });
  const lastMeta = await Parking.findOne({
    attributes: ["createdAt"],
    order: [["createdAt", "DESC"]],
  });
  const lastUpdated = lastSnap?.createdAt || lastMeta?.createdAt || null;

  // cache headers
  if (
    applyCacheHeaders(req, res, {
      key: `${req.originalUrl}|${lastUpdated ?? 0}`,
      maxAge: 300,
      lastModified: lastUpdated,
    })
  ) {
    return;
  }

  const meta = await getOrCreateMeta();

  res.json({
    title: meta.title,
    description: meta.description,
    license: meta.license,
    contact_email: meta.contact_email || null,
    source_url: meta.source_url || null,
    homepage_url: meta.homepage_url || null,
    public_base_url: meta.public_base_url || null,
    notes: meta.notes || null,

    last_updated: lastUpdated,

    // opis polja ostaje isti
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

export const publicSiteMetadata = async (req, res) => {
  const meta = await getOrCreateMeta();

  // Cache prema updatedAt meta zapisa
  if (
    applyCacheHeaders(req, res, {
      key: `${req.originalUrl}|${meta.updatedAt?.getTime?.() ?? 0}`,
      maxAge: 300,
      lastModified: meta.updatedAt,
    })
  ) {
    return;
  }

  res.json({
    title: meta.title,
    description: meta.description,
    license: meta.license,
    contact_email: meta.contact_email,
    source_url: meta.source_url,
    homepage_url: meta.homepage_url,
    public_base_url: meta.public_base_url,
    notes: meta.notes,
    updatedAt: meta.updatedAt,
  });
};

/** ADMIN GET: /api/v1/admin/metadata */
export const getAdminMetadata = async (_req, res) => {
  const meta = await getOrCreateMeta();
  res.json({
    id: meta.id,
    title: meta.title,
    description: meta.description,
    license: meta.license,
    contact_email: meta.contact_email,
    source_url: meta.source_url,
    homepage_url: meta.homepage_url,
    public_base_url: meta.public_base_url,
    notes: meta.notes,
    updatedAt: meta.updatedAt,
  });
};

/** ADMIN PUT: /api/v1/admin/metadata */
export const updateAdminMetadata = async (req, res) => {
  const allowed = [
    "title",
    "description",
    "license",
    "contact_email",
    "source_url",
    "homepage_url",
    "public_base_url",
    "notes",
  ];
  const payload = {};
  for (const k of allowed) {
    if (k in (req.body || {})) payload[k] = req.body[k];
  }

  const meta = await getOrCreateMeta();
  await meta.update(payload);
  await meta.reload();

  res.json({
    id: meta.id,
    title: meta.title,
    description: meta.description,
    license: meta.license,
    contact_email: meta.contact_email,
    source_url: meta.source_url,
    homepage_url: meta.homepage_url,
    public_base_url: meta.public_base_url,
    notes: meta.notes,
    updatedAt: meta.updatedAt,
  });
};
