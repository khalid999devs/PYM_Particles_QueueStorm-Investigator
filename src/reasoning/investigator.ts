import type {
  AnalyzeTicketNormalizedInput,
  AnalyzeTicketRequest,
  AnalyzeTicketResponse
} from "../modules/analyze-ticket/analyze.types";
import { detectPromptInjection } from "../safety/prompt-injection";
import { classifyCase } from "./case-classifier";
import { determineEvidenceVerdict } from "./evidence-verdict";
import { extractComplaintFacts } from "./extraction";
import { buildInvestigationResponse } from "./response-builder";
import { routeCase } from "./severity-router";
import {
  findRelevantTransaction,
  hasEstablishedRecipientPattern,
  normalizeTransactions
} from "./transaction-matcher";

export const normalizeAnalyzeInput = (
  input: AnalyzeTicketRequest
): AnalyzeTicketNormalizedInput => ({
  ...input,
  transaction_history: normalizeTransactions(input.transaction_history)
});

export const investigateTicket = (input: AnalyzeTicketRequest): AnalyzeTicketResponse => {
  const normalizedInput = normalizeAnalyzeInput(input);
  const facts = extractComplaintFacts(normalizedInput.complaint);
  const classification = classifyCase(facts, normalizedInput.user_type ?? "unknown");
  const match = findRelevantTransaction(
    normalizedInput.transaction_history,
    facts,
    classification.caseType,
    normalizedInput.user_type ?? "unknown"
  );
  const verdict = determineEvidenceVerdict({
    caseType: classification.caseType,
    transactions: normalizedInput.transaction_history,
    facts,
    match
  });
  const routing = routeCase(classification.caseType, verdict, match.relevantTransaction);
  const reasonCodes = [
    ...classification.reasonCodes,
    ...match.reasonCodes
  ];

  if (detectPromptInjection(normalizedInput.complaint)) {
    reasonCodes.push("prompt_injection_ignored", "safety_rules_enforced");
  }

  if (
    classification.caseType === "wrong_transfer" &&
    hasEstablishedRecipientPattern(normalizedInput.transaction_history, match.relevantTransaction)
  ) {
    reasonCodes.push("established_recipient_pattern");
  }

  return buildInvestigationResponse({
    input: normalizedInput,
    facts,
    caseType: classification.caseType,
    verdict,
    transaction: match.relevantTransaction,
    matchScore: match.score,
    ambiguous: match.ambiguous,
    routing,
    reasonCodes
  });
};
