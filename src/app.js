import express from "express";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import swaggerUi from "swagger-ui-express";
import { corsAllowlist } from "./middleware/cors.js";
import { openapiSpec } from "./openapi.js";
import { api as apiV1 } from "./routes/index.js";
import utilRoutes from "./routes/util.routes.js";
import path from "path";

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    req.id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("X-Request-Id", req.id);
    next();
  });
  morgan.token("reqid", (req) => req.id);
  app.use(
    morgan(
      "[:date[iso]] :method :url :status :res[content-length] - :response-time ms reqid=:reqid"
    )
  );

  app.use(compression());
  app.use(corsAllowlist());
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));

  // Health (na rootu) + utility
  app.use(utilRoutes);

  // Rate limit samo za API
  app.use("/api/v1", rateLimit({ windowMs: 60 * 1000, max: 120 }), apiV1);

  // Swagger
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  app.use("/dumps", express.static(path.resolve(process.cwd(), "dumps")));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // Globalni error handler
  app.use((err, _req, res, _next) => {
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
