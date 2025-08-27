import dotenv from "dotenv";
dotenv.config();
import { createApp } from "./app.js";
import { connectDB, sequelize } from "./db.js";
import cron from "node-cron";
import { runFetchOnce } from "./jobs/fetchJob.js";
import { aggregateDaily } from "./jobs/aggregateDaily.js";
import { aggregateMonthly } from "./jobs/aggregateMonthly.js";
import { dumpMonth } from "./jobs/dumpMonth.js";
import { cleanupSnapshots } from "./jobs/cleanup.js";

const port = process.env.PORT || 4000;

(async function bootstrap() {
  try {
    await connectDB();
    await sequelize.sync({ alter: true });

    const app = createApp();

    // FETCH – svakih 15 minuta, sa anti-overlap zaštitom
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

    // DNEVNI AGREGAT – svaku noć malo poslije ponoći (00:05)
    cron.schedule(
      "5 0 * * *",
      async () => {
        try {
          const r = await aggregateDaily(); // auto: od zadnjeg dana do juče
          console.log("[cron] daily:", r);
        } catch (e) {
          console.error("[cron] daily error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // MJESEČNI AGREGAT – 1. u mjesecu 00:08
    cron.schedule(
      "8 0 1 * *",
      async () => {
        try {
          const r = await aggregateMonthly(); // default opseg – tekuća godina
          console.log("[cron] monthly:", r);
        } catch (e) {
          console.error("[cron] monthly error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // MJESEČNI DUMP – 1. u mjesecu 00:10 (dump za prethodni mjesec)
    cron.schedule(
      "10 0 1 * *",
      async () => {
        try {
          const out = await dumpMonth(); // auto prev month
          console.log("[cron] dump:", out);
        } catch (e) {
          console.error("[cron] dump error:", e.message);
        }
      },
      { timezone: "Europe/Sarajevo" }
    );

    // MJESEČNI CLEANUP – 1. u mjesecu 00:20 (npr. čuvaj 12 mjeseci raw)
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
