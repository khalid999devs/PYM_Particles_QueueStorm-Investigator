import type {
  AnalyzeTicketNormalizedInput,
  AnalyzeTicketResponse,
  CaseType,
  EvidenceVerdict,
  Transaction
} from "../modules/analyze-ticket/analyze.types";
import { roundConfidence } from "../shared/utils/number";
import { safeReasonCode, uniqueStrings } from "../shared/utils/text";
import type { ComplaintFacts } from "./extraction";
import type { RoutingDecision } from "./severity-router";
import {
  buildAgentSummary,
  buildCustomerReply,
  buildRecommendedAction
} from "./templates";

const confidenceFor = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  score: number,
  ambiguous: boolean
): number => {
  if (caseType === "phishing_or_social_engineering") {
    return 0.92;
  }

  if (ambiguous) {
    return 0.6;
  }

  if (verdict === "consistent") {
    if (score >= 14) {
      return 0.93;
    }

    if (score >= 10) {
      return 0.88;
    }

    return 0.8;
  }

  if (verdict === "inconsistent") {
    return 0.72;
  }

  return 0.55;
};

export interface ResponseBuilderInput {
  input: AnalyzeTicketNormalizedInput;
  facts: ComplaintFacts;
  caseType: CaseType;
  verdict: EvidenceVerdict;
  transaction: Transaction | null;
  matchScore: number;
  ambiguous: boolean;
  routing: RoutingDecision;
  reasonCodes: string[];
}

export const buildInvestigationResponse = ({
  input,
  facts,
  caseType,
  verdict,
  transaction,
  matchScore,
  ambiguous,
  routing,
  reasonCodes
}: ResponseBuilderInput): AnalyzeTicketResponse => {
  const allReasonCodes = uniqueStrings(
    [
      caseType,
      verdict,
      ...reasonCodes,
      ...routing.reasonCodes
    ]
      .map(safeReasonCode)
      .filter(Boolean)
  );

  return {
    ticket_id: input.ticket_id,
    relevant_transaction_id: transaction?.transaction_id ?? null,
    evidence_verdict: verdict,
    case_type: caseType,
    severity: routing.severity,
    department: routing.department,
    agent_summary: buildAgentSummary(caseType, verdict, transaction, facts),
    recommended_next_action: buildRecommendedAction(
      caseType,
      verdict,
      transaction,
      routing.department
    ),
    customer_reply: buildCustomerReply(caseType, transaction, input.language),
    human_review_required: routing.humanReviewRequired,
    confidence: roundConfidence(confidenceFor(caseType, verdict, matchScore, ambiguous)),
    reason_codes: allReasonCodes
  };
};
