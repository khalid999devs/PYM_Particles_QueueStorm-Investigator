import type { AnalyzeTicketResponse } from "../modules/analyze-ticket/analyze.types";
import { applySafetyToResponse, containsUnsafeText } from "./safe-text";

export const ensureSafeResponse = (
  response: AnalyzeTicketResponse,
  language?: string
): AnalyzeTicketResponse => {
  const rewritten = applySafetyToResponse(response, language);

  if (
    containsUnsafeText(rewritten.customer_reply) ||
    containsUnsafeText(rewritten.recommended_next_action)
  ) {
    return {
      ...rewritten,
      recommended_next_action:
        "Route the case to the appropriate operations team and continue only through official support channels.",
      customer_reply:
        "Thank you for reaching out. Our support team will review the case and contact you through official support channels. Please do not share your PIN or OTP with anyone.",
      reason_codes: [...new Set([...rewritten.reason_codes, "safety_rules_enforced"])]
    };
  }

  return rewritten;
};
