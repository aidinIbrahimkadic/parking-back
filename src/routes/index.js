import { Router } from "express";
import auth from "./auth.routes.js";
import parkingsRoutes from "./parkings.routes.js";
import stats from "./stats.routes.js";
import documents from "./documents.routes.js";
import meta from "./meta.routes.js";
import dumps from "./dumps.routes.js";
import aggregates from "./aggregates.routes.js";

const api = Router();

// važno: mount-aj i auth rute!
api.use(auth);

api.use(parkingsRoutes);
api.use(stats);
api.use(documents);
api.use(meta);
api.use(dumps);
api.use(aggregates);

export { api };
