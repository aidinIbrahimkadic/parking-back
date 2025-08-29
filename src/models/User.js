// src/models/User.js
import { DataTypes, UUIDV4 } from "sequelize";
import { sequelize } from "../db.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(190),
      allowNull: false,
      validate: { isEmail: true },
      // NAPOMENA: NE stavljamo unique: true ovdje — radimo to preko indexes (imenovani)
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "superadmin",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    underscored: true,
    indexes: [
      // stabilan, imenovani UNIQUE indeks nad email kolonom
      { name: "users_email_unique", unique: true, fields: ["email"] },
    ],
  }
);

export { User };
