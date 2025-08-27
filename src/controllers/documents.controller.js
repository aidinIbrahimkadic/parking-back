import { Document } from "../models/Document.js";
import { Op } from "sequelize";

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
  if (q)
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
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

  res.json({ page: pageNum, pageSize: size, total: count, rows });
};

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
  res.json(doc);
};
