# QueueStorm Investigator Architecture

This document is a full implementation context note for the QueueStorm Investigator preliminary-round backend submitted by team PYM_Particles. It is written so another engineer or AI assistant can understand the codebase, constraints, request flow, reasoning logic, AI boundaries, safety rules, tests, and deployment setup without rediscovering the project from scratch.

## Project Summary

QueueStorm Investigator is a backend-only Express + TypeScript API. It analyzes a digital finance support complaint together with `transaction_history` and returns the official investigation response schema.

The service is intentionally stateless:

- no frontend
- no database
- no Docker
- no authentication layer
- no background jobs
- direct Render Web Service deployment

The public API surface for judges is only:

- `GET /health`
- `POST /analyze-ticket`

All other paths return a controlled JSON 404.

Live Render base URL:

```txt
https://pym-particles-queuestorm-investigator.onrender.com
```

## Tech Stack

- Node.js, npm
- Express 5.x
- TypeScript
- Zod for request and response validation
- Pino and pino-http for logging
- Helmet for HTTP security headers
- CORS
- Vitest and Supertest
- Optional OpenAI API enhancement

Important package scripts:

```bash
npm run dev
npm run typecheck
npm run build
npm start
npm test
npm run test:samples
npm run sample:output
npm run audit:checks
```

## Repository Map

```txt
src/
  app.ts
  server.ts
  config/
    env.ts
    logger.ts
  modules/
    health/
      health.routes.ts
      health.controller.ts
    analyze-ticket/
      analyze.routes.ts
      analyze.controller.ts
      analyze.schema.ts
      analyze.service.ts
      analyze.types.ts
  reasoning/
    bangla-utils.ts
    extraction.ts
    case-classifier.ts
    transaction-matcher.ts
    evidence-verdict.ts
    severity-router.ts
    response-builder.ts
    templates.ts
    investigator.ts
  safety/
    prompt-injection.ts
    safe-text.ts
    safety-checker.ts
  ai/
    openai-client.ts
    ai-schema.ts
    ai-classifier.ts
  middlewares/
    validate.middleware.ts
    error.middleware.ts
    not-found.middleware.ts
    request-id.middleware.ts
  shared/
    errors/AppError.ts
    utils/
      async-handler.ts
      number.ts
      response.ts
      text.ts
      time.ts
  types/
    express.d.ts

tests/
  health.test.ts
  analyze.contract.test.ts
  reasoning.test.ts
  sample-cases.test.ts
  malformed-input.test.ts
  safety.test.ts
  ai-fallback.test.ts
  setup-env.ts

scripts/
  run-sample-cases.ts
  generate-sample-output.ts
  audit-checks.ts

samples/
  SUST_Preli_Sample_Cases.json
  public-sample-cases.json
  sample-output.json

.github/workflows/ci.yml
README.md
ARCHITECTURE.md
```

## Application Boot Flow

`src/server.ts` starts the HTTP server. It imports `createApp()` from `src/app.ts`, reads `PORT` from validated environment config, and binds the app for Render.

`src/app.ts` creates the Express application:

1. disables `x-powered-by`
2. installs Helmet
3. installs CORS
4. attaches request IDs
5. installs pino-http logging
6. installs JSON body parsing with `128kb` limit
7. mounts `/health`
8. mounts `/analyze-ticket`
9. attaches controlled JSON 404 middleware
10. attaches error middleware

The route layer stays thin. Business logic belongs in services and pure reasoning modules.

## Public Endpoints

### `GET /health`

Implemented by:

- `src/modules/health/health.routes.ts`
- `src/modules/health/health.controller.ts`

Returns exactly:

```json
{"status":"ok"}
```

### `POST /analyze-ticket`

Implemented by:

- `src/modules/analyze-ticket/analyze.routes.ts`
- `src/modules/analyze-ticket/analyze.controller.ts`
- `src/modules/analyze-ticket/analyze.service.ts`

The route validates the request body with Zod, then passes typed data to the controller. The controller calls `analyzeTicket()` and returns the official JSON response.

## Request Schema

Source of truth:

- `src/modules/analyze-ticket/analyze.schema.ts`
- `src/modules/analyze-ticket/analyze.types.ts`

Required fields:

- `ticket_id`: non-empty string
- `complaint`: non-empty string

Optional fields:

- `language`: `en`, `bn`, `mixed`
- `channel`: `in_app_chat`, `call_center`, `email`, `merchant_portal`, `field_agent`
- `user_type`: `customer`, `merchant`, `agent`, `unknown`
- `campaign_context`: string
- `transaction_history`: array, default `[]`
- `metadata`: object, default `{}`

Transaction input fields:

```json
{
  "transaction_id": "TXN-9101",
  "timestamp": "2026-04-14T14:08:22Z",
  "type": "transfer",
  "amount": 5000,
  "counterparty": "+8801719876543",
  "status": "completed"
}
```

The request schema is forgiving for transaction rows. Bad transaction row fields are converted to nullable or safe defaults, then invalid rows are filtered during normalization. The top-level request still rejects missing required fields, invalid enums, empty complaints, and invalid structure.

## Response Schema

The final response is validated with Zod before sending. The response object is strict, meaning extra fields are not allowed.

Required output fields:

- `ticket_id`
- `relevant_transaction_id`
- `evidence_verdict`
- `case_type`
- `severity`
- `department`
- `agent_summary`
- `recommended_next_action`
- `customer_reply`
- `human_review_required`
- `confidence`
- `reason_codes`

Allowed enums:

```txt
evidence_verdict:
  consistent
  inconsistent
  insufficient_data

case_type:
  wrong_transfer
  payment_failed
  refund_request
  duplicate_payment
  merchant_settlement_delay
  agent_cash_in_issue
  phishing_or_social_engineering
  other

severity:
  low
  medium
  high
  critical

department:
  customer_support
  dispute_resolution
  payments_ops
  merchant_operations
  agent_operations
  fraud_risk
```

`reason_codes` must be snake_case strings matching:

```txt
^[a-z0-9_]{1,40}$
```

## Main Analyze Flow

Main service:

- `src/modules/analyze-ticket/analyze.service.ts`

Main pure reasoning entry:

- `src/reasoning/investigator.ts`

The flow is:

1. `analyzeTicket(input)` receives a validated request.
2. `investigateTicket(input)` always creates the deterministic result first.
3. If OpenAI is enabled, `getAiEnhancement()` may improve selected text fields.
4. The response is passed through safety enforcement.
5. The final response is validated with `analyzeTicketResponseSchema`.
6. If validation fails internally, the API returns a generic 500 without stack traces.

High-level pipeline:

```txt
Express route
  -> Zod request validation
  -> analyzeTicket service
  -> deterministic investigation
  -> optional OpenAI enhancement
  -> safety rewrite/check
  -> final Zod response validation
  -> JSON response
```

## Deterministic Investigation Engine

The deterministic engine is the source of truth. The service must work when `USE_OPENAI=false`.

Entry point:

- `src/reasoning/investigator.ts`

Steps:

1. Normalize transactions with `normalizeTransactions()`.
2. Extract complaint facts with `extractComplaintFacts()`.
3. Classify the case with `classifyCase()`.
4. Find the relevant transaction with `findRelevantTransaction()`.
5. Determine evidence verdict with `determineEvidenceVerdict()`.
6. Route to department/severity/review with `routeCase()`.
7. Add safety and evidence reason codes.
8. Build the final response with `buildInvestigationResponse()`.

### Transaction Normalization

Source:

- `src/reasoning/transaction-matcher.ts`

`normalizeTransactions()` removes unusable rows. A row must have:

- `transaction_id`
- `timestamp`
- `type`
- finite numeric `amount`
- `status`

`counterparty` can be an empty string, but the field is always normalized to a string.

### Complaint Fact Extraction

Source:

- `src/reasoning/extraction.ts`
- `src/reasoning/bangla-utils.ts`

Extracted facts include:

- original complaint text
- normalized complaint text
- amounts
- phone numbers
- referenced transaction IDs
- agent IDs
- sender IDs
- links
- time hints
- credential-risk terms

The extractor handles Bangla digits and common Bangla/Banglish finance phrasing. Phone numbers are normalized enough to compare local Bangladeshi forms such as `017...` against `+88017...`.

### Case Classification

Source:

- `src/reasoning/case-classifier.ts`

Classification is signal-based but not the whole investigation. It only identifies likely case type. Evidence matching still happens against `transaction_history`.

Priority order:

1. `phishing_or_social_engineering`
2. `duplicate_payment`
3. `merchant_settlement_delay`
4. `agent_cash_in_issue`
5. `payment_failed`
6. `wrong_transfer`
7. `refund_request`
8. `other`

Phishing/social engineering has highest priority because safety risk should override normal transaction matching.

### Transaction Matching

Source:

- `src/reasoning/transaction-matcher.ts`

Each transaction is scored against extracted facts and case type.

Score weights:

- amount match: `+5`
- transaction type aligned to case type: `+4`
- counterparty/phone match: `+6`
- status aligned to case type: `+3`
- time hint match: `+2`
- user type match: `+2`

Transaction type alignment:

```txt
wrong_transfer -> transfer
payment_failed -> payment
refund_request -> payment, refund
duplicate_payment -> payment
merchant_settlement_delay -> settlement
agent_cash_in_issue -> cash_in
other -> transfer, payment, cash_in, cash_out, settlement, refund
phishing_or_social_engineering -> no transaction matching
```

Status alignment:

```txt
wrong_transfer -> completed
payment_failed -> failed or pending
duplicate_payment -> completed
merchant_settlement_delay -> pending
agent_cash_in_issue -> pending
refund_request -> completed or reversed
```

No transaction is selected when:

- there are no valid transactions
- case type is phishing/social engineering
- best score is below 6
- multiple same-amount candidates are plausible with no counterparty or time clue
- the best and second-best candidates are too close, where score gap is `<= 2` and second score is at least 6

When matching is ambiguous, the response uses:

```json
{
  "relevant_transaction_id": null,
  "evidence_verdict": "insufficient_data"
}
```

This avoids unsafe guessing.

### Duplicate Payment Detection

Source:

- `findDuplicatePayment()` in `src/reasoning/transaction-matcher.ts`

The duplicate detector looks for two completed payment transactions with:

- same amount
- same counterparty
- timestamps within 15 minutes
- complaint amount either absent or matching

When found, it selects the later payment as the suspected duplicate.

### Established Recipient Pattern

Source:

- `hasEstablishedRecipientPattern()` in `src/reasoning/transaction-matcher.ts`

For wrong-transfer claims, if the selected completed transfer has at least three completed transfers to the same counterparty in history, the evidence is treated as inconsistent. This catches cases where the customer claims wrong transfer, but history suggests an established recipient.

### Evidence Verdict

Source:

- `src/reasoning/evidence-verdict.ts`

Rules:

- phishing/social engineering always returns `insufficient_data` because it is usually contact-risk evidence, not a transaction proof case.
- ambiguous matches return `insufficient_data`.
- no transaction generally returns `insufficient_data`.
- duplicate payment with one matching completed payment and no duplicate pair returns `inconsistent`.
- wrong transfer is `consistent` only for a completed transfer without established-recipient contradiction.
- payment failed is `consistent` for failed or pending payment.
- duplicate payment is `consistent` only when a duplicate pattern is detected.
- merchant settlement delay is `consistent` for pending settlement.
- agent cash-in issue is `consistent` for pending cash-in.
- refund request is `consistent` for payment or refund transaction.
- other returns `insufficient_data`.

### Routing, Severity, Human Review

Source:

- `src/reasoning/severity-router.ts`

Departments:

```txt
phishing_or_social_engineering -> fraud_risk
wrong_transfer -> dispute_resolution
payment_failed -> payments_ops
duplicate_payment -> payments_ops
merchant_settlement_delay -> merchant_operations
agent_cash_in_issue -> agent_operations
refund_request consistent -> customer_support
refund_request otherwise -> dispute_resolution
other -> customer_support
```

Severity:

- phishing/social engineering is `critical`
- high-value transactions, amount >= 10000, are generally `high`
- consistent wrong transfer, duplicate payment, payment failed, and agent cash-in issues are `high`
- merchant settlement delay is `medium`
- low-value consistent refund request is `low`
- `other` is `low`

Human review is required for:

- phishing/social engineering
- wrong transfer with a selected transaction
- duplicate payment
- critical severity
- high-value financial cases, except merchant settlement delay
- inconsistent financial evidence
- agent cash-in issue with no transaction or pending transaction

## Response Building

Source:

- `src/reasoning/response-builder.ts`
- `src/reasoning/templates.ts`

The response builder combines:

- selected transaction
- case type
- verdict
- routing decision
- extracted facts
- ambiguity flag
- reason codes
- confidence
- safe text templates

`agent_summary` is evidence-specific. It can include:

- amount
- transaction ID
- counterparty
- intended or wrong phone number from complaint
- repeated-recipient contradiction
- ambiguity and missing detail
- failed/pending/completed status
- duplicate pair details
- phishing caller/sender/agent/link/reference evidence

`recommended_next_action` is an internal operational instruction. It should not promise outcomes.

`customer_reply` is customer-facing. It must be clear, safe, and use official-channel language.

## Confidence And Reason Codes

Source:

- `src/reasoning/response-builder.ts`

Confidence is deterministic and bounded between 0 and 1. It depends on:

- case type
- verdict
- transaction match score
- ambiguity

Reason codes are collected from classification, matching, routing, safety, and optional AI enhancement. They are normalized by `safeReasonCode()` and deduplicated.

Examples:

```txt
wrong_transfer
consistent
wrong_transfer_signal
amount_match
transaction_type_match
counterparty_match
status_match
time_hint_match
transaction_match
department_dispute_resolution
severity_high
human_review_required
ai_enhanced
```

## Optional OpenAI Enhancement

Sources:

- `src/modules/analyze-ticket/analyze.service.ts`
- `src/ai/openai-client.ts`
- `src/ai/ai-classifier.ts`
- `src/ai/ai-schema.ts`

OpenAI is optional and controlled by:

```env
USE_OPENAI=true
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.4
OPENAI_TIMEOUT_MS=7000
```

Important design rule:

The deterministic investigation result is always created first. OpenAI is only an enhancement layer.

OpenAI may improve:

- `agent_summary`
- `recommended_next_action`
- `customer_reply`
- `confidence`, but the service takes the lower confidence between deterministic and AI
- extra safe `reason_codes`

OpenAI must not control:

- `ticket_id`
- `relevant_transaction_id`
- `evidence_verdict`
- `case_type`
- `severity`
- `department`
- `human_review_required`

The AI prompt requires JSON output only and repeats the safety rules. AI output is parsed with `aiEnhancementSchema`. If parsing fails, schema validation fails, unsafe text is detected, provider errors occur, or the request times out, the enhancement is skipped and the deterministic response is returned.

The service adds `ai_enhanced` to reason codes only when the enhancement is accepted.

## Safety Design

Sources:

- `src/safety/prompt-injection.ts`
- `src/safety/safe-text.ts`
- `src/safety/safety-checker.ts`

Complaint text is untrusted evidence. Prompt injection phrases are detected and converted into reason codes, but they do not alter service rules.

Unsafe output is blocked or rewritten.

The service must never ask for:

- PIN
- OTP
- password
- full card number
- CVV
- secret credentials

The service must never promise:

- refund completed
- reversal completed
- recovery completed
- account unblock completed
- dispute approval

The service also avoids telling customers to contact suspicious callers, suspicious numbers, unofficial agents, or third-party contacts in phishing cases.

Safety is applied after deterministic and optional AI generation. The final response is then schema-validated.

If safety still detects unsafe text after rewriting, `ensureSafeResponse()` falls back to generic safe templates and adds `safety_rules_enforced`.

## Error Handling And Public Surface

Sources:

- `src/middlewares/error.middleware.ts`
- `src/middlewares/not-found.middleware.ts`
- `src/shared/errors/AppError.ts`

Errors return controlled JSON responses. The API does not expose stack traces, provider errors, secrets, tokens, environment values, or internal exception details.

Unknown paths return:

```json
{
  "success": false,
  "error": {
    "message": "Route not found",
    "code": "NOT_FOUND"
  }
}
```

Malformed input returns HTTP 400 with controlled JSON.

## Logging

Sources:

- `src/config/logger.ts`
- `src/app.ts`

Pino and pino-http are used for structured request logs. `LOG_LEVEL` controls verbosity.

Production recommendation:

```env
LOG_LEVEL=info
```

Local development often uses:

```env
LOG_LEVEL=debug
```

Do not log secrets or raw environment values.

## Environment Config

Source:

- `src/config/env.ts`

Environment variables:

```env
NODE_ENV=production
PORT=8000
USE_OPENAI=true
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.4
OPENAI_TIMEOUT_MS=7000
LOG_LEVEL=info
```

`dotenv` is loaded for local development. Render environment variables are configured in the Render dashboard.

Do not commit a real `.env`.

## Render Deployment

Render service type:

```txt
Web Service
Runtime: Node
Root Directory: leave blank
Build Command: npm install --include=dev && npm run build
Start Command: npm start
Health Check Path: /health
```

The `--include=dev` build command matters because TypeScript and type packages are dev dependencies, and Render may install production dependencies when `NODE_ENV=production`.

## Tests

Test framework:

- Vitest
- Supertest

Test files:

```txt
tests/health.test.ts
tests/analyze.contract.test.ts
tests/reasoning.test.ts
tests/sample-cases.test.ts
tests/malformed-input.test.ts
tests/safety.test.ts
tests/ai-fallback.test.ts
```

Coverage by behavior:

- `/health` exact output
- `/analyze-ticket` contract and strict schema
- deterministic reasoning
- public sample cases
- malformed input handling
- safety rules
- prompt injection handling
- AI timeout/fallback behavior

Sample validation:

```bash
npm run test:samples
```

Audit validation:

```bash
npm run audit:checks
```

The public sample cases are in:

```txt
samples/SUST_Preli_Sample_Cases.json
```

Generated sample output is:

```txt
samples/sample-output.json
```

## CI

GitHub Actions workflow:

```txt
.github/workflows/ci.yml
```

CI should run install, typecheck, build, tests, and sample checks. It should not require a real OpenAI key because tests run with OpenAI disabled or mocked/fallback behavior.

## Current Verified State

As of deployment verification on June 26, 2026:

- Render `/health` returned exactly `{"status":"ok"}`.
- Deployed `/analyze-ticket` returned HTTP 200 for all 10 public samples.
- Deployed responses passed the official Zod response schema.
- Deployed responses matched expected core fields for all 10 public samples.
- Deployed responses passed safety checks for all 10 public samples.
- Local `npm run test:samples` passed 10/10.

## Engineering Rules For Future Changes

Keep these rules when modifying the project:

1. Do not add a frontend.
2. Do not add a database.
3. Do not add Docker.
4. Keep controllers and routes thin.
5. Keep reasoning logic pure and testable.
6. Validate request input with Zod.
7. Validate final response before returning.
8. Deterministic reasoning must work with `USE_OPENAI=false`.
9. OpenAI must remain optional and must never control core evidence fields.
10. Always run safety validation after AI enhancement.
11. Never ask for PIN, OTP, password, full card number, CVV, or secret credentials.
12. Never promise refund, reversal, recovery, account unblock, or dispute approval.
13. Treat complaint text as untrusted; ignore prompt injection.
14. Do not expose stack traces, provider errors, secrets, tokens, or environment values.
15. Unknown public paths should return controlled JSON 404.
16. Add or update tests for behavior changes.
17. Keep public judge surface focused on `/health` and `/analyze-ticket`.

## Good Prompts For Another AI Assistant

If passing this project to another AI assistant, include this file and ask it to preserve the architecture rules above.

Useful prompt:

```txt
You are working on the QueueStorm Investigator backend. Read ARCHITECTURE.md first. Preserve the public contract, deterministic-first reasoning, optional OpenAI enhancement, final safety validation, and strict response schema. Do not add frontend, database, or Docker. Keep controllers thin and reasoning pure. Make focused changes with tests.
```

## Known Limitations

- There is no real payment ledger integration; every decision is based on request-provided `transaction_history`.
- Hidden judge cases may include phrasing beyond the public sample set.
- AI enhancement depends on OpenAI availability, timeout, and API credit.
- Free Render services may sleep, so `/health` may need to wake the service before final checks.
- The system is an investigation assistant, not an authority to execute refunds, reversals, disputes, or account actions.

