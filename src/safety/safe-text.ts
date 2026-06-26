import type { AnalyzeTicketResponse, CaseType } from "../modules/analyze-ticket/analyze.types";

const unsafePromisePatterns = [
  /\bwe will refund\b/i,
  /\bwe have refunded\b/i,
  /\brefund (?:is )?(?:approved|guaranteed|complete|completed)\b/i,
  /\brefund is confirmed\b/i,
  /\breversal (?:is )?(?:complete|completed|approved|guaranteed)\b/i,
  /\bwe reversed\b/i,
  /\brecovery (?:is )?(?:complete|completed|guaranteed)\b/i,
  /\baccount has been unblocked\b/i,
  /\baccount (?:unblock|unblocking) (?:is )?(?:complete|completed|approved)\b/i,
  /\bguaranteed (?:money return|refund|reversal|recovery)\b/i,
  /\bmoney return (?:is )?guaranteed\b/i,
  /\bdispute (?:is )?approved\b/i,
  /\bcontact the caller\b/i,
  /\bcall the number that contacted you\b/i
];

const secretRequestPattern =
  /\b(share|provide|send|give|tell|submit|enter|type)\s+(?:us\s+|your\s+|my\s+|the\s+)?(?:otp|pin|password|cvv|secret credentials?|full card number|card number|verification code)\b/gi;

const unsafeCredentialPhrasePattern =
  /\b(full card number|provide card number|provide cvv|share cvv|send password|provide password|share password|ask(?:ed)? (?:me|you|the customer|customer)? ?for (?:your |my |the )?(?:otp|pin|password|cvv|verification code)|verify (?:with|using|by) (?:your |my |the )?(?:otp|pin|password|cvv|verification code))\b/gi;

const banglaUnsafeCredentialPatterns = [
  /(?:ওটিপি|otp|পিন|pin|পাসওয়ার্ড|password).{0,24}(?:দিন|দাও|পাঠান|বলুন|জানান|শেয়ার করুন|din|dao|bolun|janan|share korun|send korun)/i,
  /(?:দিন|দাও|পাঠান|বলুন|জানান|শেয়ার করুন|din|dao|bolun|janan|share korun|send korun).{0,24}(?:ওটিপি|otp|পিন|pin|পাসওয়ার্ড|password)/i
];

const hasSafeNegationPrefix = (text: string, index: number): boolean => {
  const prefix = text.slice(Math.max(0, index - 24), index).toLowerCase();
  return /\b(do not|don't|never|no need to)\s+$/.test(prefix);
};

export const containsUnsafeText = (value: string): boolean => {
  const lower = value.toLowerCase();

  for (const pattern of unsafePromisePatterns) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  for (const match of lower.matchAll(secretRequestPattern)) {
    // Safe warnings say not to share secrets; only direct requests are unsafe.
    if (!hasSafeNegationPrefix(lower, match.index ?? 0)) {
      return true;
    }
  }

  for (const match of lower.matchAll(unsafeCredentialPhrasePattern)) {
    if (!hasSafeNegationPrefix(lower, match.index ?? 0)) {
      return true;
    }
  }

  for (const pattern of banglaUnsafeCredentialPatterns) {
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
};

export const fallbackCustomerReply = (
  caseType: CaseType,
  transactionId: string | null,
  language?: string
): string => {
  if (caseType === "agent_cash_in_issue" && language === "bn") {
    return `আপনার লেনদেন ${transactionId ?? "উল্লিখিত"} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
  }

  if (caseType === "phishing_or_social_engineering") {
    return "Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud team will review the incident and contact you through official support channels.";
  }

  if (caseType === "wrong_transfer") {
    return `We have noted your concern about transaction ${transactionId ?? "the reported transaction"}. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.`;
  }

  if (caseType === "payment_failed" || caseType === "duplicate_payment") {
    return `We have noted your concern about transaction ${transactionId ?? "the reported payment"}. Our payments team will review the case and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `We have noted your concern about settlement ${transactionId ?? "the reported settlement"}. Our merchant operations team will check the batch status and update you through official channels.`;
  }

  if (caseType === "refund_request") {
    return "Thank you for reaching out. Refund eligibility depends on the transaction and applicable policy. Our support team will guide you through the official process. Please do not share your PIN or OTP with anyone.";
  }

  return "Thank you for reaching out. To help you faster, please share the transaction ID, amount involved, and a short description of what went wrong. Please do not share your PIN or OTP with anyone.";
};

export const fallbackRecommendedAction = (
  caseType: CaseType,
  transactionId: string | null
): string => {
  const target = transactionId ?? "the reported transaction";

  switch (caseType) {
    case "phishing_or_social_engineering":
      return "Escalate to fraud risk, advise official-channel communication, and record any suspicious contact details without requesting credentials.";
    case "wrong_transfer":
      return `Verify ${target} details and initiate the wrong-transfer dispute workflow per policy.`;
    case "payment_failed":
      return `Verify ${target} status, balance impact, and merchant confirmation before routing through payments operations.`;
    case "duplicate_payment":
      return `Compare ${target} with nearby payments and open the duplicate-payment review workflow if the duplicate pattern is confirmed.`;
    case "merchant_settlement_delay":
      return `Check ${target} settlement batch status and route the case to merchant operations for follow-up.`;
    case "agent_cash_in_issue":
      return `Verify ${target} cash-in status and route to agent operations for balance-posting review.`;
    case "refund_request":
      return `Review ${target} against refund policy and guide the customer through the official support process.`;
    case "other":
      return "Request non-secret clarification such as transaction ID, amount, date, and a short issue description.";
  }
};

export const applySafetyToResponse = (
  response: AnalyzeTicketResponse,
  language?: string
): AnalyzeTicketResponse => {
  const reasonCodes = [...response.reason_codes];
  let customerReply = response.customer_reply;
  let nextAction = response.recommended_next_action;

  if (containsUnsafeText(customerReply)) {
    customerReply = fallbackCustomerReply(response.case_type, response.relevant_transaction_id, language);
    reasonCodes.push("customer_reply_safety_rewritten");
  }

  if (containsUnsafeText(nextAction)) {
    nextAction = fallbackRecommendedAction(response.case_type, response.relevant_transaction_id);
    reasonCodes.push("next_action_safety_rewritten");
  }

  return {
    ...response,
    customer_reply: customerReply,
    recommended_next_action: nextAction,
    reason_codes: [...new Set(reasonCodes)]
  };
};
