import fs from "node:fs/promises";
import { Op } from "sequelize";
import { Document } from "../models/Document.js";
import {
  toPublicUrl,
  fromPublicUrl,
  publicUrlAbs,
} from "../middleware/upload.js";

/* ========= PUBLIC: LIST ========= */
export const listDocuments = async (req, res) => {
  const {
    q = "",
    doc_type,
    sort = "published_at",
    order = "desc",
    page = "1",
    pageSize = "20",
  } = req.query;

  const where = {};
  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }
  if (doc_type) where.doc_type = doc_type;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (pageNum - 1) * size;

  const { rows, count } = await Document.findAndCountAll({
    where,
    order: [
      [sort, order.toUpperCase() === "ASC" ? "ASC" : "DESC"],
      ["id", "DESC"],
    ],
    limit: size,
    offset,
    attributes: [
      "id",
      "title",
      "doc_type",
      "description",
      "file_url",
      "published_at",
      "createdAt",
    ],
  });

  // mapiraj na plain + apsolutni URL
  const mapped = rows.map((r) => {
    const plain = r.get({ plain: true });
    plain.file_url = publicUrlAbs(req, plain.file_url);
    return plain;
  });

  res.json({ page: pageNum, pageSize: size, total: count, rows: mapped });
};

/* ========= PUBLIC: GET ONE ========= */
export const getDocument = async (req, res) => {
  const doc = await Document.findByPk(req.params.id, {
    attributes: [
      "id",
      "title",
      "doc_type",
      "description",
      "file_url",
      "published_at",
      "createdAt",
    ],
  });
  if (!doc) return res.status(404).json({ error: "Not found" });

  const plain = doc.get({ plain: true });
  plain.file_url = publicUrlAbs(req, plain.file_url);

  res.json(plain);
};

/* ========= ADMIN: CREATE ========= */
export async function createDocument(req, res) {
  const { title, doc_type, description, published_at } = req.body || {};
  if (!title) return res.status(400).json({ error: "Naslov je obavezan." });
  if (!req.file) return res.status(400).json({ error: "Fajl je obavezan." });

  // čuvamo relativni URL u bazi
  const relUrl = toPublicUrl(req.file.path);

  const doc = await Document.create({
    title,
    doc_type: doc_type || null,
    description: description || null,
    file_url: relUrl, // relativno u bazi
    published_at: published_at ? new Date(published_at) : null,
  });

  // ali vraćamo apsolutni URL ka klijentu
  return res.status(201).json({
    id: doc.id,
    title: doc.title,
    doc_type: doc.doc_type,
    description: doc.description,
    file_url: publicUrlAbs(req, doc.file_url),
    published_at: doc.published_at,
    createdAt: doc.createdAt,
  });
}

/* ========= ADMIN: UPDATE ========= */
export async function updateDocument(req, res) {
  const id = req.params.id;
  const doc = await Document.findByPk(id);
  if (!doc) return res.status(404).json({ error: "Dokument ne postoji." });

  const { title, doc_type, description, published_at } = req.body || {};
  if (title !== undefined) doc.title = title;
  if (doc_type !== undefined) doc.doc_type = doc_type || null;
  if (description !== undefined) doc.description = description || null;
  if (published_at !== undefined) {
    doc.published_at = published_at ? new Date(published_at) : null;
  }

  if (req.file) {
    // obriši stari fajl (best-effort)
    try {
      const oldAbs = fromPublicUrl(doc.file_url);
      await fs.unlink(oldAbs);
    } catch (_) {}
    // postavi novi relativni URL u bazi
    doc.file_url = toPublicUrl(req.file.path);
  }

  await doc.save();

  return res.json({
    id: doc.id,
    title: doc.title,
    doc_type: doc.doc_type,
    description: doc.description,
    file_url: publicUrlAbs(req, doc.file_url), // vrati apsolutni klijentu
    published_at: doc.published_at,
    createdAt: doc.createdAt,
  });
}

/* ========= ADMIN: DELETE ========= */
export async function deleteDocument(req, res) {
  const id = req.params.id;
  const doc = await Document.findByPk(id);
  if (!doc) return res.status(404).json({ error: "Dokument ne postoji." });

  await doc.destroy();

  // obriši fajl (best-effort)
  try {
    const abs = fromPublicUrl(doc.file_url);
    await fs.unlink(abs);
  } catch (_) {}

  return res.json({ ok: true });
}
