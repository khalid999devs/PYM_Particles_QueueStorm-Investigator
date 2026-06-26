import type {
  CaseType,
  Department,
  EvidenceVerdict,
  Language,
  Transaction
} from "../modules/analyze-ticket/analyze.types";
import { formatAmount } from "../shared/utils/number";
import type { ComplaintFacts } from "./extraction";

const transactionRef = (transaction: Transaction | null): string =>
  transaction ? transaction.transaction_id : "no single transaction";

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
  facts: ComplaintFacts
): string => {
  const target = transactionRef(transaction);
  const amount = amountRef(transaction, facts);

  if (caseType === "phishing_or_social_engineering") {
    return "Customer reports a possible phishing or social-engineering attempt involving sensitive credentials or suspicious contact.";
  }

  if (caseType === "wrong_transfer") {
    return `Customer reports a possible wrong transfer involving ${amount}; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "payment_failed") {
    return `Customer reports a failed or deducted payment involving ${amount}; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "duplicate_payment") {
    return `Customer reports a duplicate payment involving ${amount}; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `Merchant reports delayed settlement; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "agent_cash_in_issue") {
    return `Customer reports cash-in balance not reflected; evidence verdict is ${verdict} for ${target}.`;
  }

  if (caseType === "refund_request") {
    return `Customer requests refund review involving ${amount}; evidence verdict is ${verdict} for ${target}.`;
  }

  return "Customer complaint does not contain enough structured evidence to identify a specific financial case.";
};

export const buildRecommendedAction = (
  caseType: CaseType,
  verdict: EvidenceVerdict,
  transaction: Transaction | null,
  department: Department
): string => {
  const target = transactionRef(transaction);

  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to fraud risk, record suspicious contact details, and continue communication only through official support channels.";
  }

  if (caseType === "wrong_transfer") {
    return `Verify ${target} details and initiate the wrong-transfer dispute workflow per policy.`;
  }

  if (caseType === "payment_failed") {
    return `Verify ${target} status, balance impact, and merchant confirmation before routing through payments operations.`;
  }

  if (caseType === "duplicate_payment") {
    return `Compare ${target} with nearby payments and open the duplicate-payment review workflow if the duplicate pattern is confirmed.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `Check ${target} settlement batch status and route the case to merchant operations for follow-up.`;
  }

  if (caseType === "agent_cash_in_issue") {
    return `Verify ${target} cash-in status and route to agent operations for balance-posting review.`;
  }

  if (caseType === "refund_request") {
    return `Review ${target} against refund policy and guide the customer through the official support process.`;
  }

  if (verdict === "insufficient_data") {
    return "Request non-secret clarification such as transaction ID, amount, date, and a short issue description.";
  }

  return `Route the case to ${department} for operational review.`;
};

export const buildCustomerReply = (
  caseType: CaseType,
  transaction: Transaction | null,
  language?: Language
): string => {
  const target = transactionRef(transaction);

  if (caseType === "agent_cash_in_issue" && language === "bn") {
    return `আপনার লেনদেন ${target} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
  }

  if (caseType === "phishing_or_social_engineering") {
    return "Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud team will review the incident and contact you through official support channels.";
  }

  if (caseType === "wrong_transfer") {
    return `We have noted your concern about transaction ${target}. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.`;
  }

  if (caseType === "payment_failed") {
    return `We have noted that transaction ${target} may have caused an unexpected balance deduction. Our payments team will review the case and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
  }

  if (caseType === "duplicate_payment") {
    return `We have noted your concern about transaction ${target}. Our payments team will compare nearby payments and review the case through official channels. Please do not share your PIN or OTP with anyone.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `We have noted your concern about settlement ${target}. Our merchant operations team will check the batch status and update you through official channels.`;
  }

  if (caseType === "refund_request") {
    return "Thank you for reaching out. Refund eligibility depends on the transaction and applicable policy. Our support team will guide you through the official process. Please do not share your PIN or OTP with anyone.";
  }

  return "Thank you for reaching out. To help you faster, please share the transaction ID, amount involved, and a short description of what went wrong. Please do not share your PIN or OTP with anyone.";
};
