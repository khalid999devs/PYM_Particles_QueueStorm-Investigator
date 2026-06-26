import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("malformed input handling", () => {
  it("rejects invalid JSON with a controlled response", async () => {
    const response = await request(createApp())
      .post("/analyze-ticket")
      .set("Content-Type", "application/json")
      .send("{ bad json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing ticket_id", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send({
      complaint: "Payment failed"
    });

    expect(response.status).toBe(400);
  });

  it("rejects missing complaint", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-MISSING"
    });

    expect(response.status).toBe(400);
  });

  it("rejects empty complaint", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-EMPTY",
      complaint: "   "
    });

    expect(response.status).toBe(400);
  });

  it("rejects unsupported optional enum values", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-ENUM",
      complaint: "Payment failed",
      language: "fr"
    });

    expect(response.status).toBe(400);
  });

  it("accepts missing and empty transaction history", async () => {
    const missing = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-NOHISTORY",
      complaint: "I need a refund for a payment."
    });
    const empty = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-EMPTYHISTORY",
      complaint: "I need a refund for a payment.",
      transaction_history: []
    });

    expect(missing.status).toBe(200);
    expect(empty.status).toBe(200);
    expect(missing.body.evidence_verdict).toBe("insufficient_data");
    expect(empty.body.evidence_verdict).toBe("insufficient_data");
  });

  it("does not crash on malformed transaction entries", async () => {
    const response = await request(createApp()).post("/analyze-ticket").send({
      ticket_id: "TKT-BADROW",
      complaint: "My 500 taka payment failed.",
      transaction_history: [
        {
          transaction_id: "BROKEN",
          timestamp: "not-a-date",
          type: "payment",
          amount: "not-a-number",
          status: "failed"
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.relevant_transaction_id).toBeNull();
  });
});
