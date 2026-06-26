import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
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

const sampleCasesSchema = z.array(sampleCaseSchema);

const main = async (): Promise<void> => {
  const samplePath = join(process.cwd(), "samples", "public-sample-cases.json");
  const sampleCases = sampleCasesSchema.parse(JSON.parse(readFileSync(samplePath, "utf8")) as unknown);
  let passed = 0;

  for (const sample of sampleCases) {
    const output = await analyzeTicket(sample.input, { useAi: false });
    const fieldChecks = [
      output.ticket_id === sample.expected.ticket_id,
      output.relevant_transaction_id === sample.expected.relevant_transaction_id,
      output.evidence_verdict === sample.expected.evidence_verdict,
      output.case_type === sample.expected.case_type,
      output.department === sample.expected.department,
      output.severity === sample.expected.severity,
      output.human_review_required === sample.expected.human_review_required,
      !containsUnsafeText(output.customer_reply),
      !containsUnsafeText(output.recommended_next_action)
    ];

    if (fieldChecks.every(Boolean)) {
      passed += 1;
      console.log(`PASS ${sample.id}`);
    } else {
      console.error(`FAIL ${sample.id}`);
      console.error(JSON.stringify({ expected: sample.expected, output }, null, 2));
    }
  }

  console.log(`${passed}/${sampleCases.length} public sample cases passed`);

  if (passed !== sampleCases.length) {
    process.exitCode = 1;
  }
};

void main();
