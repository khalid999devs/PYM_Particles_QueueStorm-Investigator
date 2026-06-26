import { z } from "zod";
import { caseTypeValues, departmentValues, severityValues } from "../modules/analyze-ticket/analyze.types";

export const aiEnhancementSchema = z
  .object({
    case_type: z.enum(caseTypeValues).optional(),
    severity: z.enum(severityValues).optional(),
    department: z.enum(departmentValues).optional(),
    agent_summary: z.string().min(1).max(500).optional(),
    recommended_next_action: z.string().min(1).max(500).optional(),
    customer_reply: z.string().min(1).max(700).optional(),
    confidence: z.number().min(0).max(1).optional(),
    reason_codes: z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).optional()
  })
  .strict();

export type AiEnhancement = z.infer<typeof aiEnhancementSchema>;
