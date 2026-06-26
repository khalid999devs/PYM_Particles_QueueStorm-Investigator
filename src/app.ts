import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middlewares/error.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import { analyzeRoutes } from "./modules/analyze-ticket/analyze.routes";
import { healthRoutes } from "./modules/health/health.routes";

export const createApp = (): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: false,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "X-Request-Id"]
    })
  );
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id
    })
  );
  app.use(express.json({ limit: "128kb" }));

  app.use("/health", healthRoutes);
  app.use("/analyze-ticket", analyzeRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
