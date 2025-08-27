import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";

export class Document extends Model {}

Document.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    doc_type: { type: DataTypes.STRING(64) }, // Odluka|Pravilnik|Uputstvo...
    description: { type: DataTypes.TEXT },
    file_url: { type: DataTypes.STRING(1024), allowNull: false },

    // datum objave (ručni unos)
    published_at: { type: DataTypes.DATE },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "documents",
    indexes: [
      { name: "ix_documents_doc_type", fields: ["doc_type"] },
      { name: "ix_documents_published_at", fields: ["published_at"] },
      { name: "ix_documents_createdAt", fields: ["createdAt"] },
    ],
  }
);
