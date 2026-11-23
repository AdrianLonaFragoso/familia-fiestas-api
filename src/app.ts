import { optionalAdmin } from "./middleware/auth.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";

import { corsOrigins, getEnv } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { logger } from "./lib/logger.js";
import { forbidden } from "./lib/http-error.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.routes.js";
import { invitationRouter } from "./routes/invitation.routes.js";
import { publicRouter } from "./routes/public.routes.js";

export function createApp(): express.Express {
  const app = express();
  const env = getEnv();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins().includes(origin)) {
          callback(null, true);
          return;
        }
        callback(forbidden(`Origen no permitido por CORS: ${origin}`));
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Admin-Key"],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  if (env.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger,
        autoLogging: true,
      }),
    );
  }

  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Familia Fiestas API",
    }),
  );

  app.use("/api/v1", optionalAdmin);
  app.use("/api/v1", publicRouter);
  app.use("/api/v1/invitations", invitationRouter);
  app.use("/api/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
