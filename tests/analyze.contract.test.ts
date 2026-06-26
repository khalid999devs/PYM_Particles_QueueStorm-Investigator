import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { analyzeTicketResponseSchema } from "../src/modules/analyze-ticket/analyze.schema";

const validRequest = {
  ticket_id: "TKT-001",
  complaint:
    "I sent 5000 taka to a wrong number around 2pm today. The number was +8801719876543.",
  language: "en",
  channel: "in_app_chat",
  user_type: "customer",
  campaign_context: "boishakh_bonanza_day_1",
  transaction_history: [
    {
      transaction_id: "TXN-9101",
      timestamp: "2026-04-14T14:08:22Z",
      type: "transfer",
      amount: 5000,
      counterparty: "+8801719876543",
      status: "completed"
    }
  ],
  metadata: {}
};

describe("POST /analyze-ticket contract", () => {
  it("returns the official success schema without debug fields", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send(validRequest);
    const parsed = analyzeTicketResponseSchema.parse(response.body as unknown);

    expect(response.status).toBe(200);
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "ticket_id",
        "relevant_transaction_id",
        "evidence_verdict",
        "case_type",
        "severity",
        "department",
        "agent_summary",
        "recommended_next_action",
        "customer_reply",
        "human_review_required",
        "confidence",
        "reason_codes"
      ].sort()
    );
    expect(parsed).toMatchObject({
      ticket_id: "TKT-001",
      relevant_transaction_id: "TXN-9101",
      evidence_verdict: "consistent",
      case_type: "wrong_transfer",
      severity: "high",
      department: "dispute_resolution",
      human_review_required: true
    });
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
  });

  it("returns controlled JSON 404 for other paths", async () => {
    const response = await request(createApp()).get("/debug");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Route not found",
        code: "NOT_FOUND"
      }
    });
  });
});
