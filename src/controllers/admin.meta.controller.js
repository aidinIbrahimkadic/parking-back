import { MetaSettings } from "../models/MetaSettings.js";

export async function getMetaSettings(_req, res) {
  const s = await MetaSettings.findByPk(1);
  res.json(s || null);
}

export async function updateMetaSettings(req, res) {
  const payload = req.body || {};
  const allowed = [
    "title",
    "description",
    "license",
    "contact_email",
    "source_url",
    "terms_url",
  ];
  const patch = {};
  for (const k of allowed) if (payload[k] !== undefined) patch[k] = payload[k];

  let s = await MetaSettings.findByPk(1);
  if (!s) s = await MetaSettings.create({ id: 1, ...patch });
  else await s.update(patch);

  res.json(s);
}
