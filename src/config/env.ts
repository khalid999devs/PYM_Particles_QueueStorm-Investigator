import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanStringSchema = z
  .string()
  .default("false")
  .transform((value) => value.toLowerCase() === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  USE_OPENAI: booleanStringSchema,
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-5.4"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().max(7000).default(7000),
  LOG_LEVEL: z.string().default("info")
});

export const env = envSchema.parse(process.env);
