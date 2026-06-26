import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeTicketResponseSchema } from "../src/modules/analyze-ticket/analyze.schema";
import type { AnalyzeTicketRequest } from "../src/modules/analyze-ticket/analyze.types";

const getAiEnhancementMock = vi.fn();

vi.mock("../src/ai/ai-classifier", () => ({
  getAiEnhancement: getAiEnhancementMock
}));

const sampleRequest: AnalyzeTicketRequest = {
  ticket_id: "TKT-AI-FALLBACK",
  complaint: "I sent 5000 taka to a wrong number around 2pm today.",
  language: "en",
  channel: "in_app_chat",
  user_type: "customer",
  campaign_context: "qa",
  transaction_history: [
    {
      transaction_id: "TXN-AI-1",
      timestamp: "2026-04-14T14:08:22Z",
      type: "transfer",
      amount: 5000,
      counterparty: "+8801719876543",
      status: "completed"
    }
  ],
  metadata: {}
};

describe("AI enhancement fallback", () => {
  beforeEach(() => {
    getAiEnhancementMock.mockReset();
  });

  it("keeps deterministic output when AI returns null", async () => {
    getAiEnhancementMock.mockResolvedValue(null);
    const { analyzeTicket } = await import("../src/modules/analyze-ticket/analyze.service");

    const response = await analyzeTicket(sampleRequest, { useAi: true });

    expect(analyzeTicketResponseSchema.safeParse(response).success).toBe(true);
    expect(response.reason_codes).not.toContain("ai_enhanced");
    expect(response.relevant_transaction_id).toBe("TXN-AI-1");
  });

  it("keeps deterministic output when AI throws", async () => {
    getAiEnhancementMock.mockRejectedValue(new Error("provider unavailable"));
    const { analyzeTicket } = await import("../src/modules/analyze-ticket/analyze.service");

    const response = await analyzeTicket(sampleRequest, { useAi: true });

    expect(analyzeTicketResponseSchema.safeParse(response).success).toBe(true);
    expect(response.reason_codes).not.toContain("ai_enhanced");
    expect(response.case_type).toBe("wrong_transfer");
  });

  it("safety-rewrites unsafe AI text before returning", async () => {
    getAiEnhancementMock.mockResolvedValue({
      customer_reply: "We will refund you. Send your OTP.",
      recommended_next_action: "Ask the customer to provide password.",
      reason_codes: ["drafted_by_ai"]
    });
    const { analyzeTicket } = await import("../src/modules/analyze-ticket/analyze.service");

    const response = await analyzeTicket(sampleRequest, { useAi: true });

    expect(analyzeTicketResponseSchema.safeParse(response).success).toBe(true);
    expect(response.reason_codes).toContain("ai_enhanced");
    expect(response.reason_codes).toContain("customer_reply_safety_rewritten");
    expect(response.reason_codes).toContain("next_action_safety_rewritten");
    expect(response.customer_reply).toContain("Please do not share your PIN or OTP");
  });
});
