import OpenAI from "openai";
import { env } from "../config/env";

export const createOpenAIClient = (): OpenAI | null => {
  if (!env.USE_OPENAI || !env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.OPENAI_TIMEOUT_MS
  });
};
