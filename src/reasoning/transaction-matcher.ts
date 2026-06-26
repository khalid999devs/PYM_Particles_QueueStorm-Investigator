import type {
  CaseType,
  RawTransactionInput,
  Transaction,
  TransactionType,
  UserType
} from "../modules/analyze-ticket/analyze.types";
import { amountsEqual } from "../shared/utils/number";
import { minutesBetween, transactionHourUtc } from "../shared/utils/time";
import type { ComplaintFacts, TimeHint } from "./extraction";
import { normalizePhone } from "./extraction";

export interface ScoredTransaction {
  transaction: Transaction;
  score: number;
  reasonCodes: string[];
}

export interface TransactionMatchResult {
  relevantTransaction: Transaction | null;
  ambiguous: boolean;
  score: number;
  reasonCodes: string[];
}

const alignedTypes: Record<CaseType, TransactionType[]> = {
  wrong_transfer: ["transfer"],
  payment_failed: ["payment"],
  refund_request: ["payment", "refund"],
  duplicate_payment: ["payment"],
  merchant_settlement_delay: ["settlement"],
  agent_cash_in_issue: ["cash_in"],
  phishing_or_social_engineering: [],
  other: ["transfer", "payment", "cash_in", "cash_out", "settlement", "refund"]
};

export const normalizeTransactions = (rows: RawTransactionInput[]): Transaction[] =>
  rows
    .filter(
      (row): row is Transaction =>
        Boolean(row.transaction_id) &&
        Boolean(row.timestamp) &&
        Boolean(row.type) &&
        typeof row.amount === "number" &&
        Number.isFinite(row.amount) &&
        Boolean(row.status)
    )
    .map((row) => ({
      transaction_id: row.transaction_id,
      timestamp: row.timestamp,
      type: row.type,
      amount: row.amount,
      counterparty: row.counterparty,
      status: row.status
    }));

const isTypeAligned = (caseType: CaseType, transaction: Transaction): boolean =>
  alignedTypes[caseType].includes(transaction.type);

const counterpartyMatches = (transaction: Transaction, phones: string[]): boolean => {
  if (phones.length === 0) {
    return false;
  }

  const counterparty = normalizePhone(transaction.counterparty);
  return phones.some((phone) => {
    const normalizedPhone = normalizePhone(phone);
    return (
      counterparty === normalizedPhone ||
      counterparty.endsWith(normalizedPhone.slice(-10)) ||
      normalizedPhone.endsWith(counterparty.slice(-10))
    );
  });
};

const amountMatches = (transaction: Transaction, amounts: number[]): boolean =>
  amounts.some((amount) => amountsEqual(transaction.amount, amount));

const statusAligns = (caseType: CaseType, transaction: Transaction): boolean => {
  if (caseType === "wrong_transfer") {
    return transaction.status === "completed";
  }

  if (caseType === "payment_failed") {
    return transaction.status === "failed" || transaction.status === "pending";
  }

  if (caseType === "duplicate_payment") {
    return transaction.status === "completed";
  }

  if (caseType === "merchant_settlement_delay" || caseType === "agent_cash_in_issue") {
    return transaction.status === "pending";
  }

  if (caseType === "refund_request") {
    return transaction.status === "completed" || transaction.status === "reversed";
  }

  return false;
};

const timeHintMatches = (transaction: Transaction, hints: TimeHint[]): boolean => {
  if (hints.length === 0) {
    return false;
  }

  const hour = transactionHourUtc(transaction.timestamp);

  if (hour === null) {
    return false;
  }

  return hints.some((hint) => {
    if (hint.kind === "hour" && typeof hint.hour24 === "number") {
      return Math.abs(hour - hint.hour24) <= 1;
    }

    if (hint.kind === "day_part" && hint.value === "morning") {
      return hour >= 5 && hour < 12;
    }

    if (hint.kind === "day_part" && hint.value === "afternoon") {
      return hour >= 12 && hour < 17;
    }

    return false;
  });
};

const userTypeAligns = (userType: UserType, transaction: Transaction): boolean => {
  if (userType === "merchant") {
    return transaction.type === "settlement";
  }

  if (userType === "agent") {
    return transaction.type === "cash_in" || transaction.type === "cash_out";
  }

  return false;
};

export const scoreTransaction = (
  transaction: Transaction,
  facts: ComplaintFacts,
  caseType: CaseType,
  userType: UserType = "unknown"
): ScoredTransaction => {
  const reasonCodes: string[] = [];
  let score = 0;

  if (amountMatches(transaction, facts.amounts)) {
    score += 5;
    reasonCodes.push("amount_match");
  }

  if (isTypeAligned(caseType, transaction)) {
    score += 4;
    reasonCodes.push("transaction_type_match");
  }

  if (counterpartyMatches(transaction, facts.phones)) {
    score += 6;
    reasonCodes.push("counterparty_match");
  }

  if (statusAligns(caseType, transaction)) {
    score += 3;
    reasonCodes.push("status_match");
  }

  if (timeHintMatches(transaction, facts.timeHints)) {
    score += 2;
    reasonCodes.push("time_hint_match");
  }

  if (userTypeAligns(userType, transaction)) {
    score += 2;
    reasonCodes.push("user_type_match");
  }

  return { transaction, score, reasonCodes };
};

export const findDuplicatePayment = (
  transactions: Transaction[],
  facts: ComplaintFacts
): TransactionMatchResult | null => {
  const payments = transactions
    .filter((transaction) => transaction.type === "payment" && transaction.status === "completed")
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

  for (let index = 0; index < payments.length; index += 1) {
    const first = payments[index];

    for (let nextIndex = index + 1; nextIndex < payments.length; nextIndex += 1) {
      const second = payments[nextIndex];
      const sameAmount = amountsEqual(first.amount, second.amount);
      const sameCounterparty =
        normalizePhone(first.counterparty) === normalizePhone(second.counterparty);
      const closeInTime = minutesBetween(first.timestamp, second.timestamp) <= 15;
      const complaintAmountMatches =
        facts.amounts.length === 0 || facts.amounts.some((amount) => amountsEqual(amount, second.amount));

      if (sameAmount && sameCounterparty && closeInTime && complaintAmountMatches) {
        return {
          relevantTransaction: second,
          ambiguous: false,
          score: 17,
          reasonCodes: ["duplicate_pattern", "transaction_match"]
        };
      }
    }
  }

  return null;
};

const hasAmbiguousSameAmountCandidates = (
  scored: ScoredTransaction[],
  facts: ComplaintFacts,
  caseType: CaseType
): boolean => {
  if (facts.amounts.length === 0 || facts.phones.length > 0 || facts.timeHints.length > 0) {
    return false;
  }

  const plausible = scored.filter(
    (candidate) =>
      candidate.score >= 8 &&
      isTypeAligned(caseType, candidate.transaction) &&
      amountMatches(candidate.transaction, facts.amounts)
  );

  return plausible.length > 1;
};

export const findRelevantTransaction = (
  transactions: Transaction[],
  facts: ComplaintFacts,
  caseType: CaseType,
  userType: UserType = "unknown"
): TransactionMatchResult => {
  if (transactions.length === 0 || caseType === "phishing_or_social_engineering") {
    return { relevantTransaction: null, ambiguous: false, score: 0, reasonCodes: ["no_transaction_match"] };
  }

  if (caseType === "duplicate_payment") {
    const duplicate = findDuplicatePayment(transactions, facts);
    if (duplicate) {
      return duplicate;
    }
  }

  const scored = transactions
    .map((transaction) => scoreTransaction(transaction, facts, caseType, userType))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1];

  if (!best || best.score < 6) {
    return { relevantTransaction: null, ambiguous: false, score: 0, reasonCodes: ["no_clear_transaction_match"] };
  }

  if (hasAmbiguousSameAmountCandidates(scored, facts, caseType)) {
    return {
      relevantTransaction: null,
      ambiguous: true,
      score: best.score,
      reasonCodes: ["ambiguous_transaction_match"]
    };
  }

  if (second && best.score - second.score <= 2 && second.score >= 6) {
    return {
      relevantTransaction: null,
      ambiguous: true,
      score: best.score,
      reasonCodes: ["ambiguous_transaction_match"]
    };
  }

  return {
    relevantTransaction: best.transaction,
    ambiguous: false,
    score: best.score,
    reasonCodes: [...best.reasonCodes, "transaction_match"]
  };
};

export const hasEstablishedRecipientPattern = (
  transactions: Transaction[],
  transaction: Transaction | null
): boolean => {
  if (!transaction || transaction.type !== "transfer" || !transaction.counterparty) {
    return false;
  }

  const target = normalizePhone(transaction.counterparty);
  const matchingCompletedTransfers = transactions.filter(
    (candidate) =>
      candidate.type === "transfer" &&
      candidate.status === "completed" &&
      normalizePhone(candidate.counterparty) === target
  );

  return matchingCompletedTransfers.length >= 3;
};
