export const languageValues = ["en", "bn", "mixed"] as const;
export const channelValues = [
  "in_app_chat",
  "call_center",
  "email",
  "merchant_portal",
  "field_agent"
] as const;
export const userTypeValues = ["customer", "merchant", "agent", "unknown"] as const;
export const transactionTypeValues = [
  "transfer",
  "payment",
  "cash_in",
  "cash_out",
  "settlement",
  "refund"
] as const;
export const transactionStatusValues = ["completed", "failed", "pending", "reversed"] as const;
export const evidenceVerdictValues = ["consistent", "inconsistent", "insufficient_data"] as const;
export const caseTypeValues = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other"
] as const;
export const severityValues = ["low", "medium", "high", "critical"] as const;
export const departmentValues = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk"
] as const;

export type Language = (typeof languageValues)[number];
export type Channel = (typeof channelValues)[number];
export type UserType = (typeof userTypeValues)[number];
export type TransactionType = (typeof transactionTypeValues)[number];
export type TransactionStatus = (typeof transactionStatusValues)[number];
export type EvidenceVerdict = (typeof evidenceVerdictValues)[number];
export type CaseType = (typeof caseTypeValues)[number];
export type Severity = (typeof severityValues)[number];
export type Department = (typeof departmentValues)[number];

export interface RawTransactionInput {
  transaction_id: string | null;
  timestamp: string | null;
  type: TransactionType | null;
  amount: number | null;
  counterparty: string;
  status: TransactionStatus | null;
}

export interface Transaction {
  transaction_id: string;
  timestamp: string;
  type: TransactionType;
  amount: number;
  counterparty: string;
  status: TransactionStatus;
}

export interface AnalyzeTicketRequest {
  ticket_id: string;
  complaint: string;
  language?: Language;
  channel?: Channel;
  user_type?: UserType;
  campaign_context?: string;
  transaction_history: RawTransactionInput[];
  metadata: Record<string, unknown>;
}

export interface AnalyzeTicketNormalizedInput
  extends Omit<AnalyzeTicketRequest, "transaction_history"> {
  transaction_history: Transaction[];
}

export interface AnalyzeTicketResponse {
  ticket_id: string;
  relevant_transaction_id: string | null;
  evidence_verdict: EvidenceVerdict;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  human_review_required: boolean;
  confidence: number;
  reason_codes: string[];
}
