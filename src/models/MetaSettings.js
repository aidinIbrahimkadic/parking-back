// src/models/MetaSettings.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";

export class MetaSettings extends Model {}

MetaSettings.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "Open Data – Parking Tešanj",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue:
        "Otvoreni podaci o zauzetosti javnih parkinga (broj mjesta, slobodna mjesta, zauzetost).",
    },
    license: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: "CC BY 4.0",
    },

    contact_email: { type: DataTypes.STRING(255), allowNull: true },
    source_url: { type: DataTypes.STRING(1024), allowNull: true },
    homepage_url: { type: DataTypes.STRING(1024), allowNull: true },
    public_base_url: { type: DataTypes.STRING(1024), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },

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
    tableName: "meta_settings",
    indexes: [{ fields: ["updatedAt"] }],
  }
);
