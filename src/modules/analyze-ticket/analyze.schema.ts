import { z } from "zod";
import {
  caseTypeValues,
  channelValues,
  departmentValues,
  evidenceVerdictValues,
  languageValues,
  severityValues,
  transactionStatusValues,
  transactionTypeValues,
  userTypeValues
} from "./analyze.types";

const nullableTrimmedStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1))
  .nullable()
  .catch(null);

const counterpartySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .catch("");

const rawTransactionInputSchema = z.preprocess(
  (value) => (typeof value === "object" && value !== null ? value : {}),
  z.object({
    transaction_id: nullableTrimmedStringSchema,
    timestamp: z.string().datetime({ offset: true }).nullable().catch(null),
    type: z.enum(transactionTypeValues).nullable().catch(null),
    amount: z.coerce.number().finite().nonnegative().nullable().catch(null),
    counterparty: counterpartySchema,
    status: z.enum(transactionStatusValues).nullable().catch(null)
  })
);

export const analyzeTicketRequestSchema = z.object({
  ticket_id: z.string().trim().min(1),
  complaint: z.string().trim().min(1),
  language: z.enum(languageValues).optional(),
  channel: z.enum(channelValues).optional(),
  user_type: z.enum(userTypeValues).optional(),
  campaign_context: z.string().trim().optional(),
  transaction_history: z.array(rawTransactionInputSchema).default([]),
  metadata: z.record(z.unknown()).default({})
});

export const analyzeTicketResponseSchema = z
  .object({
    ticket_id: z.string().min(1),
    relevant_transaction_id: z.string().min(1).nullable(),
    evidence_verdict: z.enum(evidenceVerdictValues),
    case_type: z.enum(caseTypeValues),
    severity: z.enum(severityValues),
    department: z.enum(departmentValues),
    agent_summary: z.string().min(1),
    recommended_next_action: z.string().min(1),
    customer_reply: z.string().min(1),
    human_review_required: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason_codes: z.array(z.string().regex(/^[a-z0-9_]{1,40}$/))
  })
  .strict();
