import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";

export class ParkingMonthly extends Model {}

ParkingMonthly.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    parkingRefId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    month: { type: DataTypes.STRING(7), allowNull: false }, // "YYYY-MM"

    samples: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    occ_avg: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0,
    },
    occ_max: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0,
    },
    occ_min: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0,
    },

    free_total_avg: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    free_total_min: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    free_total_max: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

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
    tableName: "parking_monthly",
    indexes: [
      { unique: true, fields: ["parkingRefId", "month"] },
      { fields: ["month"] },
      { fields: ["parkingRefId"] },
    ],
  }
);
