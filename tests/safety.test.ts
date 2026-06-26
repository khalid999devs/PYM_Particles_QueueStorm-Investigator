import { describe, expect, it } from "vitest";
import type { AnalyzeTicketResponse } from "../src/modules/analyze-ticket/analyze.types";
import { ensureSafeResponse } from "../src/safety/safety-checker";
import { containsUnsafeText } from "../src/safety/safe-text";

const baseResponse: AnalyzeTicketResponse = {
  ticket_id: "TKT-SAFE",
  relevant_transaction_id: "TXN-SAFE",
  evidence_verdict: "consistent",
  case_type: "payment_failed",
  severity: "high",
  department: "payments_ops",
  agent_summary: "Customer reports a failed payment.",
  recommended_next_action: "Verify the payment through official operations.",
  customer_reply:
    "We have noted your concern. Please do not share your PIN or OTP with anyone.",
  human_review_required: true,
  confidence: 0.8,
  reason_codes: ["payment_failed"]
};

describe("safety guardrails", () => {
  it("allows safe credential warnings", () => {
    expect(containsUnsafeText(baseResponse.customer_reply)).toBe(false);
  });

  it("detects credential requests and refund promises", () => {
    expect(containsUnsafeText("Please send your OTP so we can verify.")).toBe(true);
    expect(containsUnsafeText("We will refund you today.")).toBe(true);
    expect(containsUnsafeText("The reversal is complete.")).toBe(true);
  });

  it("rewrites unsafe customer reply and next action", () => {
    const unsafe = ensureSafeResponse({
      ...baseResponse,
      recommended_next_action: "Ask the customer to provide password.",
      customer_reply: "We will refund you. Send your OTP."
    });

    expect(containsUnsafeText(unsafe.customer_reply)).toBe(false);
    expect(containsUnsafeText(unsafe.recommended_next_action)).toBe(false);
    expect(unsafe.reason_codes).toContain("customer_reply_safety_rewritten");
    expect(unsafe.reason_codes).toContain("next_action_safety_rewritten");
  });
});
