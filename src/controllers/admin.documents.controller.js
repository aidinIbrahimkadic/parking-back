// src/controllers/admin.documents.controller.js
import fs from "node:fs/promises";
import { Document } from "../models/Document.js";
import { toPublicUrl, fromPublicUrl } from "../middleware/upload.js";

/**
 * NOTE:
 * - upload single("file") koristi se u rutama (ne ovdje)
 * - toPublicUrl(req.file.path) daje "/uploads/..."
 * - fromPublicUrl(doc.file_url) vraća apsolutnu putanju za brisanje
 */

export async function createAdminDocument(req, res) {
  const { title, doc_type, description, published_at } = req.body || {};

  if (!title) return res.status(400).json({ error: "Naslov je obavezan." });
  if (!req.file) return res.status(400).json({ error: "Fajl je obavezan." });

  const file_url = toPublicUrl(req.file.path);

  const doc = await Document.create({
    title,
    doc_type: doc_type || null,
    description: description || null,
    file_url,
    published_at: published_at ? new Date(published_at) : null,
  });

  return res.status(201).json({
    id: doc.id,
    title: doc.title,
    doc_type: doc.doc_type,
    description: doc.description,
    file_url: doc.file_url,
    published_at: doc.published_at,
    createdAt: doc.createdAt,
  });
}

export async function updateAdminDocument(req, res) {
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
    // postavi novi URL
    doc.file_url = toPublicUrl(req.file.path);
  }

  await doc.save();

  return res.json({
    id: doc.id,
    title: doc.title,
    doc_type: doc.doc_type,
    description: doc.description,
    file_url: doc.file_url,
    published_at: doc.published_at,
    createdAt: doc.createdAt,
  });
}

export async function deleteAdminDocument(req, res) {
  const id = req.params.id;
  const doc = await Document.findByPk(id);
  if (!doc) return res.status(404).json({ error: "Dokument ne postoji." });

  // obriši red
  await doc.destroy();

  // obriši fajl (best-effort)
  try {
    const abs = fromPublicUrl(doc.file_url);
    await fs.unlink(abs);
  } catch (_) {}

  return res.json({ ok: true });
}
