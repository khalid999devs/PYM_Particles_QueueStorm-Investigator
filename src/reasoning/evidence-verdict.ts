import type {
  CaseType,
  EvidenceVerdict,
  Transaction
} from "../modules/analyze-ticket/analyze.types";
import { amountsEqual } from "../shared/utils/number";
import type { ComplaintFacts } from "./extraction";
import type { TransactionMatchResult } from "./transaction-matcher";
import { hasEstablishedRecipientPattern } from "./transaction-matcher";

export interface VerdictInput {
  caseType: CaseType;
  transactions: Transaction[];
  facts: ComplaintFacts;
  match: TransactionMatchResult;
}

const hasSingleMatchingCompletedPayment = (
  transactions: Transaction[],
  facts: ComplaintFacts
): boolean => {
  if (facts.amounts.length === 0) {
    return false;
  }

  const matches = transactions.filter(
    (transaction) =>
      transaction.type === "payment" &&
      transaction.status === "completed" &&
      facts.amounts.some((amount) => amountsEqual(amount, transaction.amount))
  );

  return matches.length === 1;
};

export const determineEvidenceVerdict = ({
  caseType,
  transactions,
  facts,
  match
}: VerdictInput): EvidenceVerdict => {
  const transaction = match.relevantTransaction;

  if (caseType === "phishing_or_social_engineering") {
    return "insufficient_data";
  }

  if (match.ambiguous) {
    return "insufficient_data";
  }

  if (!transaction) {
    if (caseType === "duplicate_payment" && hasSingleMatchingCompletedPayment(transactions, facts)) {
      return "inconsistent";
    }

    return "insufficient_data";
  }

  if (caseType === "wrong_transfer") {
    if (hasEstablishedRecipientPattern(transactions, transaction)) {
      return "inconsistent";
    }

    return transaction.status === "completed" && transaction.type === "transfer"
      ? "consistent"
      : "inconsistent";
  }

  if (caseType === "payment_failed") {
    return transaction.type === "payment" &&
      (transaction.status === "failed" || transaction.status === "pending")
      ? "consistent"
      : "inconsistent";
  }

  if (caseType === "duplicate_payment") {
    return match.reasonCodes.includes("duplicate_pattern") ? "consistent" : "inconsistent";
  }

  if (caseType === "merchant_settlement_delay") {
    return transaction.type === "settlement" && transaction.status === "pending"
      ? "consistent"
      : "inconsistent";
  }

  if (caseType === "agent_cash_in_issue") {
    return transaction.type === "cash_in" && transaction.status === "pending"
      ? "consistent"
      : "inconsistent";
  }

  if (caseType === "refund_request") {
    return transaction.type === "payment" || transaction.type === "refund"
      ? "consistent"
      : "insufficient_data";
  }

  return "insufficient_data";
};
