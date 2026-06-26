import type {
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
  Transaction
} from "../modules/analyze-ticket/analyze.types";

export interface RoutingDecision {
  severity: Severity;
  department: Department;
  humanReviewRequired: boolean;
  reasonCodes: string[];
}

const highValueThreshold = 10000;

const isHighValue = (transaction: Transaction | null): boolean =>
  Boolean(transaction && transaction.amount >= highValueThreshold);

export const departmentForCase = (
  caseType: CaseType,
  verdict: EvidenceVerdict
): Department => {
  if (caseType === "phishing_or_social_engineering") {
    return "fraud_risk";
  }

  if (caseType === "wrong_transfer") {
    return "dispute_resolution";
  }

  if (caseType === "payment_failed" || caseType === "duplicate_payment") {
    return "payments_ops";
  }

  if (caseType === "merchant_settlement_delay") {
    return "merchant_operations";
  }

  if (caseType === "agent_cash_in_issue") {
    return "agent_operations";
  }

  if (caseType === "refund_request" && verdict === "consistent") {
    return "customer_support";
  }

  if (caseType === "refund_request") {
    return "dispute_resolution";
  }

  return "customer_support";
};

export const severityForCase = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  transaction: Transaction | null
): Severity => {
  if (caseType === "phishing_or_social_engineering") {
    return "critical";
  }

  if (isHighValue(transaction) && caseType !== "merchant_settlement_delay") {
    return "high";
  }

  if (caseType === "wrong_transfer") {
    return verdict === "consistent" ? "high" : "medium";
  }

  if (caseType === "duplicate_payment") {
    return verdict === "consistent" ? "high" : "medium";
  }

  if (caseType === "payment_failed") {
    return verdict === "consistent" ? "high" : "medium";
  }

  if (caseType === "agent_cash_in_issue") {
    return verdict === "consistent" ? "high" : "medium";
  }

  if (caseType === "merchant_settlement_delay") {
    return "medium";
  }

  if (caseType === "refund_request") {
    return verdict === "consistent" && !isHighValue(transaction) ? "low" : "medium";
  }

  return "low";
};

export const routeCase = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  transaction: Transaction | null
): RoutingDecision => {
  const severity = severityForCase(caseType, verdict, transaction);
  const department = departmentForCase(caseType, verdict);
  const reasonCodes: string[] = [`department_${department}`, `severity_${severity}`];
  const reviewBecauseHighRisk =
    caseType === "phishing_or_social_engineering" ||
    caseType === "wrong_transfer" ||
    caseType === "duplicate_payment" ||
    severity === "critical" ||
    isHighValue(transaction);
  const reviewBecauseAmbiguousFinancial =
    verdict !== "consistent" &&
    !["other", "phishing_or_social_engineering"].includes(caseType);
  const reviewBecauseAgentPending =
    caseType === "agent_cash_in_issue" &&
    (!transaction || transaction.status === "pending");

  const humanReviewRequired =
    reviewBecauseHighRisk || reviewBecauseAmbiguousFinancial || reviewBecauseAgentPending;

  if (humanReviewRequired) {
    reasonCodes.push("human_review_required");
  }

  return {
    severity,
    department,
    humanReviewRequired,
    reasonCodes
  };
};
