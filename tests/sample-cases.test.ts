import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { analyzeTicket } from "../src/modules/analyze-ticket/analyze.service";
import { analyzeTicketRequestSchema } from "../src/modules/analyze-ticket/analyze.schema";
import {
  caseTypeValues,
  departmentValues,
  evidenceVerdictValues,
  severityValues
} from "../src/modules/analyze-ticket/analyze.types";
import { containsUnsafeText } from "../src/safety/safe-text";

const sampleCaseSchema = z.object({
  id: z.string(),
  input: analyzeTicketRequestSchema,
  expected: z.object({
    ticket_id: z.string(),
    relevant_transaction_id: z.string().nullable(),
    evidence_verdict: z.enum(evidenceVerdictValues),
    case_type: z.enum(caseTypeValues),
    department: z.enum(departmentValues),
    severity: z.enum(severityValues),
    human_review_required: z.boolean()
  })
});

const sampleCases = z
  .array(sampleCaseSchema)
  .parse(
    JSON.parse(
      readFileSync(join(process.cwd(), "samples", "public-sample-cases.json"), "utf8")
    ) as unknown
  );

describe("public sample cases", () => {
  for (const sample of sampleCases) {
    it(`passes ${sample.id}`, async () => {
      const output = await analyzeTicket(sample.input, { useAi: false });

      expect(output.ticket_id).toBe(sample.expected.ticket_id);
      expect(output.relevant_transaction_id).toBe(sample.expected.relevant_transaction_id);
      expect(output.evidence_verdict).toBe(sample.expected.evidence_verdict);
      expect(output.case_type).toBe(sample.expected.case_type);
      expect(output.department).toBe(sample.expected.department);
      expect(output.severity).toBe(sample.expected.severity);
      expect(output.human_review_required).toBe(sample.expected.human_review_required);
      expect(containsUnsafeText(output.customer_reply)).toBe(false);
      expect(containsUnsafeText(output.recommended_next_action)).toBe(false);
    });
  }
});
