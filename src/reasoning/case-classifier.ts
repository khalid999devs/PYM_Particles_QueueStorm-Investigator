import type { CaseType, UserType } from "../modules/analyze-ticket/analyze.types";
import type { ComplaintFacts } from "./extraction";

export interface CaseClassification {
  caseType: CaseType;
  reasonCodes: string[];
}

const hasAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const phishingPatterns = [
  /\botp\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /\bcvv\b/i,
  /\bfull card number\b/i,
  /\bscam\b/i,
  /\bfraud\b/i,
  /\bsuspicious (?:call|link|message)\b/i,
  /\bfake (?:agent|support|call)\b/i,
  /\baccount (?:block|blocked|unblock)\b/i,
  /ওটিপি/i,
  /পিন/i,
  /পাসওয়ার্ড/i,
  /প্রতারণা/i,
  /স্ক্যাম/i
];

const duplicatePatterns = [
  /\b(?:deducted|charged|paid)\s+twice\b/i,
  /\btwice\b/i,
  /\bdouble (?:charge|payment|deduction)\b/i,
  /দুইবার/i,
  /ডাবল/i
];

const merchantSettlementPatterns = [
  /\bmerchant\b/i,
  /\bshop\b/i,
  /\bsettlement\b/i,
  /\bbatch\b/i,
  /\bsales amount\b/i,
  /সেটেলমেন্ট/i,
  /মার্চেন্ট/i
];

const agentCashInPatterns = [
  /\bcash[\s-]?in\b/i,
  /\bagent\b/i,
  /\bbalance not (?:updated|reflected|received)\b/i,
  /ক্যাশ ইন/i,
  /এজেন্ট/i,
  /ব্যালেন্সে টাকা আসেনি/i
];

const paymentFailedPatterns = [
  /\bpayment failed\b/i,
  /\btransaction failed\b/i,
  /\bfailed payment\b/i,
  /\bbalance deducted\b/i,
  /\bmerchant did not receive\b/i,
  /\bpayment not successful\b/i,
  /পেমেন্ট হয়নি/i,
  /পেমেন্ট ফেল/i,
  /ট্রানজেকশন ফেল/i,
  /ব্যালেন্স কেটে গেছে/i,
  /টাকা কেটে গেছে/i
];

const wrongTransferPatterns = [
  /\bwrong (?:number|person|recipient|account)\b/i,
  /\bsent (?:money )?(?:by mistake|to wrong)\b/i,
  /\bmistaken transfer\b/i,
  /\bwrongly sent\b/i,
  /ভুল নম্বর/i,
  /ভুল নাম্বার/i,
  /ভুলে পাঠিয়েছি/i,
  /ভুল একাউন্ট/i
];

const refundPatterns = [
  /\brefund\b/i,
  /\bmoney back\b/i,
  /\bcancel(?:led)?\b/i,
  /\bchanged my mind\b/i,
  /রিফান্ড/i,
  /টাকা ফেরত/i,
  /ফেরত চাই/i
];

export const classifyCase = (
  facts: ComplaintFacts,
  userType: UserType = "unknown"
): CaseClassification => {
  const text = facts.normalizedText;

  if (hasAny(text, phishingPatterns)) {
    return { caseType: "phishing_or_social_engineering", reasonCodes: ["phishing_signal"] };
  }

  if (hasAny(text, duplicatePatterns)) {
    return { caseType: "duplicate_payment", reasonCodes: ["duplicate_payment_claim"] };
  }

  if (
    userType === "merchant" ||
    (hasAny(text, merchantSettlementPatterns) && /\b(?:settlement|delayed|pending|not received)\b|সেটেলমেন্ট/i.test(text))
  ) {
    return { caseType: "merchant_settlement_delay", reasonCodes: ["merchant_settlement_signal"] };
  }

  if (userType === "agent" || hasAny(text, agentCashInPatterns)) {
    return { caseType: "agent_cash_in_issue", reasonCodes: ["agent_cash_in_signal"] };
  }

  if (hasAny(text, paymentFailedPatterns)) {
    return { caseType: "payment_failed", reasonCodes: ["payment_failure_signal"] };
  }

  if (hasAny(text, wrongTransferPatterns)) {
    return { caseType: "wrong_transfer", reasonCodes: ["wrong_transfer_signal"] };
  }

  if (hasAny(text, refundPatterns)) {
    return { caseType: "refund_request", reasonCodes: ["refund_request_signal"] };
  }

  return { caseType: "other", reasonCodes: ["unclassified_complaint"] };
};
