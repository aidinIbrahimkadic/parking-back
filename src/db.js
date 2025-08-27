import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    timezone: "+02:00", // Europe/Sarajevo ljeti (po potrebi promijeni zimi)
    logging: false,
    dialectOptions: { decimalNumbers: true },
  }
);

export async function connectDB() {
  await sequelize.authenticate();
}
