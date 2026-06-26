import { env } from "../../config/env";
import { getAiEnhancement } from "../../ai/ai-classifier";
import { ensureSafeResponse } from "../../safety/safety-checker";
import { AppError } from "../../shared/errors/AppError";
import { safeReasonCode, uniqueStrings } from "../../shared/utils/text";
import { investigateTicket, normalizeAnalyzeInput } from "../../reasoning/investigator";
import { analyzeTicketResponseSchema } from "./analyze.schema";
import type { AnalyzeTicketRequest, AnalyzeTicketResponse } from "./analyze.types";

export interface AnalyzeTicketOptions {
  useAi?: boolean;
}

const applyAiEnhancement = (
  response: AnalyzeTicketResponse,
  enhancement: Awaited<ReturnType<typeof getAiEnhancement>>
): AnalyzeTicketResponse => {
  if (!enhancement) {
    return response;
  }

  const reasonCodes = uniqueStrings([
    ...response.reason_codes,
    "ai_enhanced",
    ...(enhancement.reason_codes ?? []).map(safeReasonCode).filter(Boolean)
  ]);

  return {
    ...response,
    agent_summary: enhancement.agent_summary ?? response.agent_summary,
    recommended_next_action:
      enhancement.recommended_next_action ?? response.recommended_next_action,
    customer_reply: enhancement.customer_reply ?? response.customer_reply,
    confidence:
      typeof enhancement.confidence === "number"
        ? Math.min(response.confidence, enhancement.confidence)
        : response.confidence,
    reason_codes: reasonCodes
  };
};

export const analyzeTicket = async (
  input: AnalyzeTicketRequest,
  options: AnalyzeTicketOptions = {}
): Promise<AnalyzeTicketResponse> => {
  const deterministic = investigateTicket(input);
  const shouldUseAi = options.useAi ?? env.USE_OPENAI;
  let response = deterministic;

  if (shouldUseAi) {
    const normalizedInput = normalizeAnalyzeInput(input);
    let enhancement: Awaited<ReturnType<typeof getAiEnhancement>> = null;

    try {
      enhancement = await getAiEnhancement(normalizedInput, deterministic);
    } catch {
      enhancement = null;
    }

    response = applyAiEnhancement(deterministic, enhancement);
  }

  response = ensureSafeResponse(response, input.language);
  const finalResult = analyzeTicketResponseSchema.safeParse(response);

  if (!finalResult.success) {
    throw new AppError("Internal server error", 500, "INTERNAL_ERROR");
  }

  return finalResult.data;
};
