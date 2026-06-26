# QueueStorm Investigator — PYM_Particles

Backend-only Express + TypeScript API for the QueueStorm Investigator preliminary round. The service analyzes one complaint together with recent transaction history and returns a safe, evidence-grounded support investigation result.

## Problem Summary

The API acts as a digital finance support copilot. It identifies the likely complaint type, finds the relevant transaction when the evidence is clear, determines whether the transaction history supports the claim, routes the case to the right department, and drafts a safe customer reply.

No frontend, database, Docker setup, authentication, or external service is required for the default path.

## Architecture Overview

Request flow:

```txt
POST /analyze-ticket
  -> Zod request validation
  -> transaction normalization
  -> deterministic complaint fact extraction
  -> transaction evidence matching
  -> verdict, routing, severity, human-review decision
  -> optional OpenAI text enhancement
  -> safety guardrails
  -> final Zod response validation
```

Core folders:

- `src/modules`: Express routes, controllers, schemas, and service orchestration.
- `src/reasoning`: Pure deterministic investigation logic.
- `src/safety`: prompt-injection detection and output safety checks.
- `src/ai`: optional OpenAI adapter with timeout and fallback.
- `tests`: health, contract, reasoning, malformed input, safety, and sample tests.
- `scripts`: public sample validation and sample-output generation.

## Tech Stack

- Node.js 24 LTS-compatible runtime
- Express 5.x
- TypeScript
- Zod
- Pino and pino-http
- Helmet
- CORS
- Vitest
- Supertest
- Optional OpenAI API

## Endpoints

### `GET /health`

Returns exactly:

```json
{"status":"ok"}
```

### `POST /analyze-ticket`

Analyzes a complaint and transaction history.

Required request fields:

- `ticket_id`: non-empty string
- `complaint`: non-empty string

Optional request fields:

- `language`: `en`, `bn`, `mixed`
- `channel`: `in_app_chat`, `call_center`, `email`, `merchant_portal`, `field_agent`
- `user_type`: `customer`, `merchant`, `agent`, `unknown`
- `campaign_context`: string
- `transaction_history`: array
- `metadata`: object

Transaction fields:

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

## Response Schema

Successful responses include only the official fields:

```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports a possible wrong transfer involving 5000 BDT; evidence verdict is consistent for TXN-9101.",
  "recommended_next_action": "Verify TXN-9101 details and initiate the wrong-transfer dispute workflow per policy.",
  "customer_reply": "We have noted your concern about transaction TXN-9101. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.",
  "human_review_required": true,
  "confidence": 0.93,
  "reason_codes": ["wrong_transfer", "consistent", "wrong_transfer_signal", "amount_match"]
}
```

Allowed enum values follow the official contract:

- `evidence_verdict`: `consistent`, `inconsistent`, `insufficient_data`
- `case_type`: `wrong_transfer`, `payment_failed`, `refund_request`, `duplicate_payment`, `merchant_settlement_delay`, `agent_cash_in_issue`, `phishing_or_social_engineering`, `other`
- `severity`: `low`, `medium`, `high`, `critical`
- `department`: `customer_support`, `dispute_resolution`, `payments_ops`, `merchant_operations`, `agent_operations`, `fraud_risk`

## Evidence Reasoning Approach

The deterministic investigator is the primary engine. It does not classify from complaint keywords alone.

It extracts:

- amounts, including Bangla digits and currency terms,
- phone numbers and counterparties,
- simple time hints such as `2pm`, `morning`, `today`, and Bangla equivalents,
- Bangla/Banglish complaint signals,
- phishing and credential-risk signals.

It scores transactions using amount, type, counterparty, status, time, user type, and duplicate-payment evidence. If multiple transactions are plausible and close in score, it returns `relevant_transaction_id: null` and `evidence_verdict: "insufficient_data"` instead of guessing.

Special reasoning includes:

- duplicate payment detection selects the later completed duplicate,
- wrong-transfer claims can become `inconsistent` when the recipient has an established repeated-transfer pattern,
- payment-failed claims are checked against failed or pending payment statuses,
- merchant settlement and agent cash-in cases route by user type, transaction type, and status,
- phishing/social engineering takes priority over financial matching.

## Safety Guardrails

The service treats complaint text as untrusted evidence and ignores prompt injection instructions.

Final `customer_reply` and `recommended_next_action` are scanned before response validation. Unsafe text is rewritten with known safe templates.

The service never asks for:

- PIN
- OTP
- password
- full card number
- CVV
- secret credentials

The service never confirms:

- refund completed
- reversal completed
- recovery completed
- account unblock completed
- dispute approval

Safe wording uses official-channel review language such as “will review,” “will verify,” and “any eligible amount will be returned through official channels.”

## MODELS

Default mode: deterministic rule-based investigator.

Optional model: OpenAI API through environment variables:

- `USE_OPENAI`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`

The model is used only for language understanding and response drafting. Evidence matching, schema enforcement, safety validation, and fallback behavior remain deterministic. The service works with `USE_OPENAI=false`, which is the recommended stable evaluation mode.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Default local URL:

```txt
http://127.0.0.1:8000
```

## Local Run Commands

```bash
npm run dev
npm run build
npm start
```

`npm run dev` starts the TypeScript watch server. `npm start` runs the compiled server from `dist/src/server.js`.

## Test Commands

```bash
npm run typecheck
npm run build
npm test
npm run test:samples
npm run sample:output
```

## Public Sample Validation

Public-style sample cases are stored in:

```txt
samples/public-sample-cases.json
```

Run:

```bash
npm run test:samples
```

The required generated sample output is stored in:

```txt
samples/sample-output.json
```

## Sample Request

```bash
curl -X POST http://127.0.0.1:8000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-001",
    "complaint": "I sent 5000 taka to a wrong number around 2pm today. The number was +8801719876543.",
    "language": "en",
    "channel": "in_app_chat",
    "user_type": "customer",
    "transaction_history": [
      {
        "transaction_id": "TXN-9101",
        "timestamp": "2026-04-14T14:08:22Z",
        "type": "transfer",
        "amount": 5000,
        "counterparty": "+8801719876543",
        "status": "completed"
      }
    ],
    "metadata": {}
  }'
```

## Sample Response

```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports a possible wrong transfer involving 5000 BDT; evidence verdict is consistent for TXN-9101.",
  "recommended_next_action": "Verify TXN-9101 details and initiate the wrong-transfer dispute workflow per policy.",
  "customer_reply": "We have noted your concern about transaction TXN-9101. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.",
  "human_review_required": true,
  "confidence": 0.93,
  "reason_codes": [
    "wrong_transfer",
    "consistent",
    "wrong_transfer_signal",
    "amount_match",
    "transaction_type_match",
    "counterparty_match",
    "status_match",
    "time_hint_match",
    "transaction_match",
    "department_dispute_resolution",
    "severity_high",
    "human_review_required"
  ]
}
```

## Render Deployment

Create a direct Render Web Service.

```txt
Runtime: Node
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /health
```

The server binds to `0.0.0.0` and reads `PORT` from the environment.

After deployment:

```bash
curl https://your-service.onrender.com/health
```

Expected:

```json
{"status":"ok"}
```

Render free services may sleep after inactivity. Wake the service with `/health` before final judging checks.

## Environment Variables

```env
NODE_ENV=development
PORT=8000
USE_OPENAI=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=7000
LOG_LEVEL=debug
```

On Render, set secrets in the dashboard only. Do not commit real keys.

## Known Limitations

- Rule-based evidence matching may miss unseen phrasing or unusual transaction narratives.
- AI is disabled by default for reliability and predictable judging behavior.
- There is no integration with a real payment ledger or dispute-management system.
- There is no database because each official request contains the full stateless analysis input.
- Public sample cases are representative and do not guarantee hidden judge coverage.

## No Secrets Or Real Data

No real API keys, tokens, or customer data are committed to this repository. All sample data is synthetic.
