import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "OPENAI_API_KEY",
      "*.OPENAI_API_KEY"
    ],
    censor: "[redacted]"
  }
});
