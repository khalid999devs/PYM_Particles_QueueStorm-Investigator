import type {
  CaseType,
  Department,
  EvidenceVerdict,
  Language,
  Transaction
} from "../modules/analyze-ticket/analyze.types";
import { formatAmount } from "../shared/utils/number";
import { minutesBetween } from "../shared/utils/time";
import type { ComplaintFacts } from "./extraction";

const transactionRef = (transaction: Transaction | null): string =>
  transaction ? transaction.transaction_id : "no single transaction";

const joinEvidence = (items: string[]): string => items.filter(Boolean).join(", ");

const statusText = (transaction: Transaction | null): string =>
  transaction ? `status is ${transaction.status}` : "status is unavailable";

const findNearbyDuplicate = (
  transaction: Transaction | null,
  transactions: Transaction[]
): Transaction | null => {
  if (!transaction || transaction.type !== "payment") {
    return null;
  }

  return (
    transactions.find(
      (candidate) =>
        candidate.transaction_id !== transaction.transaction_id &&
        candidate.type === "payment" &&
        candidate.status === "completed" &&
        candidate.amount === transaction.amount &&
        candidate.counterparty === transaction.counterparty &&
        minutesBetween(candidate.timestamp, transaction.timestamp) <= 15
    ) ?? null
  );
};

const amountRef = (transaction: Transaction | null, facts: ComplaintFacts): string => {
  if (transaction) {
    return formatAmount(transaction.amount);
  }

  if (facts.amounts[0]) {
    return formatAmount(facts.amounts[0]);
  }

  return "an unspecified amount";
};

export const buildAgentSummary = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  transaction: Transaction | null,
  facts: ComplaintFacts,
  options: { ambiguous?: boolean; reasonCodes?: string[]; transactions?: Transaction[] } = {}
): string => {
  const target = transactionRef(transaction);
  const amount = amountRef(transaction, facts);

  if (caseType === "phishing_or_social_engineering") {
    const contactEvidence = [
      ...facts.phones.map((phone) => `reported phone ${phone}`),
      ...facts.senderIds.map((senderId) => `sender ID ${senderId}`),
      ...facts.agentIds.map((agentId) => `agent ID ${agentId}`),
      ...facts.links.map((link) => `reported link ${link}`),
      ...facts.transactionIds.map((transactionId) => `referenced transaction ${transactionId}`)
    ];
    const evidenceText =
      contactEvidence.length > 0 ? ` Evidence cited: ${joinEvidence(contactEvidence)}.` : "";

    const notShared = /haven'?t shared|not shared|did not share|শেয়ার করিনি/i.test(
      facts.originalText
    )
      ? " Customer indicates credentials were not shared."
      : "";

    return `Customer reports a possible phishing or social-engineering attempt involving sensitive credentials or suspicious contact.${notShared}${evidenceText}`;
  }

  if (caseType === "wrong_transfer") {
    const details = [
      `amount ${amount}`,
      transaction ? `transaction ${target}` : "",
      transaction?.counterparty ? `counterparty ${transaction.counterparty}` : "",
      facts.phones.length > 0
        ? `complaint referenced intended or wrong number(s) ${joinEvidence(facts.phones)}`
        : ""
    ];
    const notes = [];

    if (verdict === "inconsistent" && options.reasonCodes?.includes("established_recipient_pattern")) {
      notes.push("transaction history shows repeated prior completed transfers to the same counterparty");
    }

    if (verdict === "insufficient_data" && options.ambiguous) {
      notes.push("multiple plausible transactions match and a recipient number or transaction ID is needed");
    }

    const noteText = notes.length > 0 ? ` ${notes.join(". ")}.` : "";
    return `Customer reports a possible wrong transfer; ${joinEvidence(details)}. Evidence verdict is ${verdict}.${noteText}`;
  }

  if (caseType === "payment_failed") {
    const counterparty = transaction?.counterparty ? ` with ${transaction.counterparty}` : "";
    return `Customer reports a failed or deducted payment involving ${amount}${counterparty}; evidence verdict is ${verdict} for ${target}, and ${statusText(transaction)}.`;
  }

  if (caseType === "duplicate_payment") {
    const duplicate = findNearbyDuplicate(transaction, options.transactions ?? []);
    if (transaction && duplicate) {
      const secondsApart = Math.round(minutesBetween(duplicate.timestamp, transaction.timestamp) * 60);
      return `Customer reports a duplicate payment involving ${amount}. Two identical payments to ${transaction.counterparty} were completed ${secondsApart} seconds apart (${duplicate.transaction_id} and ${transaction.transaction_id}); ${transaction.transaction_id} is the suspected duplicate.`;
    }

    return `Customer reports a duplicate payment involving ${amount}; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `Merchant reports delayed settlement involving ${amount}; evidence verdict is ${verdict} for ${target}, and ${statusText(transaction)}.`;
  }

  if (caseType === "agent_cash_in_issue") {
    const agent = transaction?.counterparty ? ` via ${transaction.counterparty}` : "";
    return `Customer reports ${amount} cash-in${agent} not reflected in balance; evidence verdict is ${verdict} for ${target}, and ${statusText(transaction)}.`;
  }

  if (caseType === "refund_request") {
    const counterparty = transaction?.counterparty ? ` for merchant ${transaction.counterparty}` : "";
    return `Customer requests refund review involving ${amount}${counterparty}; evidence verdict is ${verdict} for ${target}.`;
  }

  return "Customer complaint does not contain enough structured evidence to identify a specific financial case.";
};

export const buildRecommendedAction = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  transaction: Transaction | null,
  department: Department,
  options: { ambiguous?: boolean } = {}
): string => {
  const target = transactionRef(transaction);

  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to fraud risk, record suspicious contact details, and continue communication only through official support channels.";
  }

  if (caseType === "wrong_transfer") {
    if (options.ambiguous) {
      return "Ask for the intended recipient number or transaction ID before opening a dispute; do not select a transaction until the match is confirmed.";
    }

    if (verdict === "inconsistent") {
      return `Flag for human review and verify whether ${target} was genuinely a wrong transfer given the established recipient pattern.`;
    }

    return `Verify ${target} details and initiate the wrong-transfer dispute workflow per policy.`;
  }

  if (caseType === "payment_failed") {
    return `Investigate ${target} ledger status, balance impact, and merchant confirmation; if deduction is confirmed on a failed payment, start the reversal review flow per policy.`;
  }

  if (caseType === "duplicate_payment") {
    return `Compare ${target} with nearby payments and verify with payments operations and the biller before starting any eligible reversal workflow.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `Route ${target} to merchant operations to verify settlement batch status and communicate a revised ETA if the batch is delayed.`;
  }

  if (caseType === "agent_cash_in_issue") {
    return `Investigate ${target} cash-in status with agent operations, confirm settlement state, and resolve through the standard cash-in SLA.`;
  }

  if (caseType === "refund_request") {
    return `Review ${target} against refund policy and explain that eligibility depends on merchant policy and official support review.`;
  }

  if (verdict === "insufficient_data") {
    return "Request non-secret clarification such as transaction ID, amount, date, and a short issue description.";
  }

  return `Route the case to ${department} for operational review.`;
};

export const buildCustomerReply = (
  caseType: CaseType,
  transaction: Transaction | null,
  language?: Language,
  options: { ambiguous?: boolean } = {}
): string => {
  const target = transactionRef(transaction);

  if (caseType === "agent_cash_in_issue" && language === "bn") {
    return `আপনার লেনদেন ${target} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি দ্রুত যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
  }

  if (caseType === "phishing_or_social_engineering") {
    return "Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud team will review the incident and contact you through official support channels.";
  }

  if (caseType === "wrong_transfer") {
    if (options.ambiguous) {
      return "Thank you for reaching out. We found multiple possible transactions, so please share the recipient number or transaction ID to identify the right one. Please do not share your PIN or OTP with anyone.";
    }

    return `We have noted your concern about transaction ${target}. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.`;
  }

  if (caseType === "payment_failed") {
    return `We have noted that transaction ${target} may have caused an unexpected balance deduction. Our payments team will review the case and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
  }

  if (caseType === "duplicate_payment") {
    return `We have noted the possible duplicate payment for transaction ${target}. Our payments team will verify with the biller and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `We have noted your concern about settlement ${target}. Our merchant operations team will check the batch status and update you on the expected settlement time through official channels.`;
  }

  if (caseType === "refund_request") {
    return "Thank you for reaching out. Refund eligibility for completed merchant payments depends on the merchant policy and applicable support process. Our support team will guide you through official channels. Please do not share your PIN or OTP with anyone.";
  }

  return "Thank you for reaching out. To help you faster, please share the transaction ID, amount involved, and a short description of what went wrong. Please do not share your PIN or OTP with anyone.";
};
