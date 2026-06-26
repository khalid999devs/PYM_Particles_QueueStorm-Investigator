import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

const app = createApp();

const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT }, "QueueStorm Investigator API running");
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, "Shutting down QueueStorm Investigator API");
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
