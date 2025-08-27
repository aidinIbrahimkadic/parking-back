import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db.js";
import { Parking } from "./Parking.js";

export class ParkingSnapshot extends Model {}

ParkingSnapshot.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // veza na interni PK parkinga (DB-only)
    parkingRefId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    // Tvoja polja (kopiramo iz izvora radi konzistentnosti)
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
    freeNumberOfRegularPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalNumberOfSpecialPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    freeNumberOfSpecialPlaces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    parkingTypeId: { type: DataTypes.STRING(64) },
    locationId: { type: DataTypes.STRING(64) },
    longitude: { type: DataTypes.DECIMAL(10, 6) },
    latitude: { type: DataTypes.DECIMAL(10, 6) },
    parkingAddress: { type: DataTypes.STRING(255) },

    // Dozvoljen datum prijema snapshot-a
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
    tableName: "parking_snapshots",
    indexes: [
      {
        name: "ix_snapshots_parkingRef_createdAt",
        fields: ["parkingRefId", "createdAt"],
      },
      { name: "ix_snapshots_createdAt", fields: ["createdAt"] },
    ],
  }
);

// relacije
Parking.hasMany(ParkingSnapshot, {
  foreignKey: "parkingRefId",
  as: "snapshots",
});
ParkingSnapshot.belongsTo(Parking, {
  foreignKey: "parkingRefId",
  as: "parking",
});
