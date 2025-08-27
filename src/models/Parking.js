import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";

export class Parking extends Model {}

Parking.init(
  {
    // Interni PK (DB-only)
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // Tvoja polja (vanjski identifikator)
    parkingId: { type: DataTypes.STRING(64), allowNull: false },
    parkingName: { type: DataTypes.STRING(255), allowNull: false },
    cityName: { type: DataTypes.STRING(120) },
    zoneName: { type: DataTypes.STRING(120) },
    zoneColor: { type: DataTypes.STRING(32) },

    numberOfParkingPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalNumberOfRegularPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalNumberOfSpecialPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    parkingTypeId: { type: DataTypes.STRING(64) },
    locationId: { type: DataTypes.STRING(64) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    parkingAddress: { type: DataTypes.STRING(255) },

    // Dozvoljen sistemski datum (kada je meta zapis kreiran)
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
    tableName: "parkings",
    indexes: [
      { name: "ux_parkings_parkingId", unique: true, fields: ["parkingId"] },
      { name: "ix_parkings_cityName", fields: ["cityName"] },
      { name: "ix_parkings_zoneName", fields: ["zoneName"] },
      { name: "ix_parkings_parkingTypeId", fields: ["parkingTypeId"] },
      { name: "ix_parkings_createdAt", fields: ["createdAt"] },
    ],
  }
);
