import dotenv from "dotenv";
dotenv.config();
import { createApp } from "./app.js";
import { connectDB, sequelize } from "./db.js";
import "./models/index.js"; // <-- NOVO: registruje modele
import cron from "node-cron";
import { runFetchOnce } from "./jobs/fetchJob.js";
import { aggregateDaily } from "./jobs/aggregateDaily.js";
import { aggregateMonthly } from "./jobs/aggregateMonthly.js";
import { dumpMonth } from "./jobs/dumpMonth.js";
import { cleanupSnapshots } from "./jobs/cleanup.js";
import { ensureAdmin } from "./seed/ensureAdmin.js"; // <-- NOVO

import { MetaSettings } from "./models/MetaSettings.js";
// import "./models/SiteMeta.js";
import { resetAdminPasswordIfFlag } from "./seed/resetAdminPassword.js";

const port = process.env.PORT || 4000;

async function ensureMetaDefaults() {
  const found = await MetaSettings.findByPk(1);
  if (!found) {
    await MetaSettings.create({ id: 1 });
  }
}

(async function bootstrap() {
  try {
    await connectDB();
    const ALTER_SYNC = String(process.env.SYNC_ALTER || "0") === "1";
    await sequelize.sync({ alter: ALTER_SYNC });

    await ensureMetaDefaults();
    // seed admin
    await ensureAdmin();

    await resetAdminPasswordIfFlag();
    const app = createApp();

    // FETCH – svakih 15 minuta
    let fetching = false;
    cron.schedule(
      "*/15 * * * *",
      async () => {
        if (fetching) {
          console.warn("[cron] fetch overlap -> skip");
          return;
        }
        fetching = true;
        try {
          const res = await runFetchOnce();
          console.log("[cron] fetch:", res);
        } catch (e) {
          console.error("[cron] fetch error:", e.message);
        } finally {
          fetching = false;
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // Dnevni agregat
    cron.schedule(
      "5 0 * * *",
      async () => {
        try {
          const r = await aggregateDaily();
          console.log("[cron] daily:", r);
        } catch (e) {
          console.error("[cron] daily error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // Mjesečni agregat
    cron.schedule(
      "8 0 1 * *",
      async () => {
        try {
          const r = await aggregateMonthly();
          console.log("[cron] monthly:", r);
        } catch (e) {
          console.error("[cron] monthly error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // Dump
    cron.schedule(
      "10 0 1 * *",
      async () => {
        try {
          const out = await dumpMonth();
          console.log("[cron] dump:", out);
        } catch (e) {
          console.error("[cron] dump error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // Cleanup
    cron.schedule(
      "20 0 1 * *",
      async () => {
        try {
          const out = await cleanupSnapshots(
            parseInt(process.env.RETENTION_MONTHS || "12", 10)
          );
          console.log("[cron] cleanup:", out);
        } catch (e) {
          console.error("[cron] cleanup error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    app.listen(port, () =>
      console.log(`API listening on http://localhost:${port}`)
    );
  } catch (e) {
    console.error("Failed to start:", e);
    process.exit(1);
  }
})();
