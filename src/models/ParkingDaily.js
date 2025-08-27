import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";

export class ParkingDaily extends Model {}

ParkingDaily.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    parkingRefId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    day: { type: DataTypes.DATEONLY, allowNull: false }, // YYYY-MM-DD

    samples: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    occ_avg: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0,
    }, // 0..1
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
      type: DataTypes.INTEGER,
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
    tableName: "parking_daily",
    indexes: [
      { unique: true, fields: ["parkingRefId", "day"] },
      { fields: ["day"] },
      { fields: ["parkingRefId"] },
    ],
  }
);
