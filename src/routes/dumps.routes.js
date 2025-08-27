import { Router } from "express";
import { listDumps } from "../jobs/dumpMonth.js";

const r = Router();

// lista dumpova (za UI i za open data katalog)
r.get("/dumps", async (_req, res) => {
  const files = await listDumps();
  res.json({ files });
});

export default r;
