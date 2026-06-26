# Test Results Documentation

**Project:** QueueStorm Investigator  
**Repository:** PYM_Particles_QueueStorm-Investigator  
**Test Runner:** Vitest 3.2.6  
**Last Run:** June 26, 2026  
**Overall Status:** ✅ **37/37 tests passed (7/7 files)**

---

## 1. Summary Table

| # | Test File | Tests | Status | Duration |
|---|-----------|-------|--------|----------|
| 1 | [`tests/health.test.ts`](tests/health.test.ts) | 1 | ✅ Pass | 27 ms |
| 2 | [`tests/safety.test.ts`](tests/safety.test.ts) | 4 | ✅ Pass | 11 ms |
| 3 | [`tests/ai-fallback.test.ts`](tests/ai-fallback.test.ts) | 3 | ✅ Pass | 156 ms |
| 4 | [`tests/reasoning.test.ts`](tests/reasoning.test.ts) | 10 | ✅ Pass | 22 ms |
| 5 | [`tests/sample-cases.test.ts`](tests/sample-cases.test.ts) | 10 | ✅ Pass | 19 ms |
| 6 | [`tests/analyze.contract.test.ts`](tests/analyze.contract.test.ts) | 2 | ✅ Pass | 59 ms |
| 7 | [`tests/malformed-input.test.ts`](tests/malformed-input.test.ts) | 7 | ✅ Pass | 105 ms |
| | **TOTAL** | **37** | **✅ 100%** | **~1.54 s** |

**Aggregate:** Test Files 7 passed (7) · Tests 37 passed (37)

---

## 2. How to Reproduce

Run the full suite:

```bash
npm test
```

Run a single file:

```bash
npx vitest run tests/health.test.ts
```

Run with verbose reporter:

```bash
npx vitest run --reporter=verbose
```

---

## 3. Test Suite Details

### 3.1 [`tests/health.test.ts`](tests/health.test.ts)

**Purpose:** Verify the `/health` endpoint conforms to the contract.

| Test | Description | Expected | Actual | Result |
|------|-------------|----------|--------|--------|
| `returns exactly the required health body` | `GET /health` returns the spec-compliant body `{ status: "ok" }` | 200, `{ status: "ok" }` | 200, `{ status: "ok" }` | ✅ |

**What it covers:** Spec §4.2 health contract — minimal, fixed-shape response.

---

### 3.2 [`tests/safety.test.ts`](tests/safety.test.ts)

**Purpose:** Verify the safety guardrails (`containsUnsafeText`, `ensureSafeResponse`) detect and rewrite sensitive content.

| # | Test | Description | Result |
|---|------|-------------|--------|
| 1 | `allows safe credential warnings` | A polite "do not share your PIN/OTP" message is recognized as safe | ✅ |
| 2 | `detects credential requests and refund promises` | Identifies "send OTP", "refund today", "reversal is complete" as unsafe | ✅ |
| 3 | `detects final-checklist adversarial safety phrasing` | 9 phrases (English + Bangla) are all flagged as unsafe | ✅ |
| 4 | `rewrites unsafe customer reply and next action` | `ensureSafeResponse` rewrites both fields and tags `customer_reply_safety_rewritten` / `next_action_safety_rewritten` reason codes | ✅ |

**What it covers:** Spec §5 evidence reasoning & §6 safety guardrails — credential/OTP/PIN detection, refund-promise blocking, multilingual phrase detection, automatic rewrite.

---

### 3.3 [`tests/ai-fallback.test.ts`](tests/ai-fallback.test.ts)

**Purpose:** Verify the AI enhancement layer degrades gracefully when the provider fails or returns unsafe content.

| # | Test | Description | Result |
|---|------|-------------|--------|
| 1 | `keeps deterministic output when AI returns null` | When AI returns `null`, response stays deterministic and does **not** include `ai_enhanced` reason code; relevant transaction is still `TXN-AI-1` | ✅ |
| 2 | `keeps deterministic output when AI throws` | When AI rejects with an error, service still produces a valid response with `case_type: "wrong_transfer"` | ✅ |
| 3 | `safety-rewrites unsafe AI text before returning` | Unsafe AI draft is rewritten by the safety layer; final response includes `ai_enhanced`, `customer_reply_safety_rewritten`, `next_action_safety_rewritten`; customer_reply contains the safe "do not share PIN/OTP" warning | ✅ |

**What it covers:** Spec §6 safety — AI failure must never break the response; AI output must be re-validated.

---

### 3.4 [`tests/reasoning.test.ts`](tests/reasoning.test.ts)

**Purpose:** Validate the deterministic reasoning pipeline (`investigateTicket`, Bangla utilities, extraction, prompt-injection detection).

| # | Test | Description | Result |
|---|------|-------------|--------|
| 1 | `normalizes Bangla digits and extracts amount without treating phone as amount` | `"৫০০০"` → `"5000"`; amount extraction returns `[5000]`, ignoring the phone number | ✅ |
| 2 | `detects duplicate completed payment and selects the later transaction` | Two identical 900 taka payments → `case_type: "duplicate_payment"`, `relevant_transaction_id: "PAY-2"` | ✅ |
| 3 | `marks repeated recipient wrong-transfer claim as inconsistent` | Repeated transfers to same number → `evidence_verdict: "inconsistent"`, reason code `established_recipient_pattern` | ✅ |
| 4 | `does not guess between ambiguous same-amount payments` | Two 1500 taka payments to different merchants → `relevant_transaction_id: null`, `evidence_verdict: "insufficient_data"`, `human_review_required: false` | ✅ |
| 5 | `detects phishing and prompt injection attempts` | Prompt-injection text → `case_type: "phishing_or_social_engineering"`, reason code `prompt_injection_ignored`, agent_summary is safe | ✅ |
| 6 | `includes matched wrong-transfer transaction evidence in agent summary` | `agent_summary` includes `TXN-SUMMARY-1`, `5000 BDT`, `+8801719876543` | ✅ |
| 7 | `includes complaint-referenced intended number in wrong-transfer summary` | `agent_summary` includes the intended recipient `8801712345678` | ✅ |
| 8 | `mentions ambiguity in wrong-transfer summary when multiple transactions match` | When ambiguous, summary includes "multiple plausible transactions" + "recipient number or transaction ID is needed" | ✅ |
| 9 | `includes suspicious caller number in phishing summary without setting transaction id` | Phishing case → `agent_summary` contains `8801711112222`, `relevant_transaction_id: null` | ✅ |
| 10 | `keeps phishing customer reply safe and avoids suspicious contact instructions` | Phishing reply contains no OTP/PIN request, does not echo the scammer's number, does not instruct user to "call the number" or "contact the caller" | ✅ |

**What it covers:** Spec §5 evidence reasoning — case classification, transaction matching, ambiguity handling, Bangla normalization, prompt-injection resistance.

---

### 3.5 [`tests/sample-cases.test.ts`](tests/sample-cases.test.ts)

**Purpose:** Run every case in [`samples/SUST_Preli_Sample_Cases.json`](samples/SUST_Preli_Sample_Cases.json ) through `analyzeTicket` and verify the 7 critical response fields plus safety.

| # | Sample ID | Result |
|---|-----------|--------|
| 1 | (first case from sample file) | ✅ |
| 2 | (second case) | ✅ |
| 3 | (third case) | ✅ |
| 4 | (fourth case) | ✅ |
| 5 | (fifth case) | ✅ |
| 6 | (sixth case) | ✅ |
| 7 | (seventh case) | ✅ |
| 8 | (eighth case) | ✅ |
| 9 | (ninth case) | ✅ |
| 10 | (tenth case) | ✅ |

**For each case the following are verified:**

- `output.ticket_id` matches expected
- `output.relevant_transaction_id` matches expected (incl. `null`)
- `output.evidence_verdict` ∈ expected enum
- `output.case_type` ∈ expected enum
- `output.department` ∈ expected enum
- `output.severity` ∈ expected enum
- `output.human_review_required` matches expected boolean
- `containsUnsafeText(output.customer_reply)` is `false`
- `containsUnsafeText(output.recommended_next_action)` is `false`

**What it covers:** Spec §5 + §7 — official sample case validation, end-to-end deterministic reasoning.

---

### 3.6 [`tests/analyze.contract.test.ts`](tests/analyze.contract.test.ts)

**Purpose:** Verify the `/analyze-ticket` POST contract — schema shape, exact key set, no debug fields.

| # | Test | Description | Result |
|---|------|-------------|--------|
| 1 | `returns the official success schema without debug fields` | Valid request → 200; parsed body matches `analyzeTicketResponseSchema` exactly; key set equals the official list; specific known values match; `confidence` ∈ [0, 1] | ✅ |
| 2 | `returns controlled JSON 404 for other paths` | `GET /debug` → 404 with body `{ success: false, error: { message: "Route not found", code: "NOT_FOUND" } }` | ✅ |

**What it covers:** Spec §4.1 (200, 404) + §3 architecture (exact response key set, no debug leakage).

---

### 3.7 [`tests/malformed-input.test.ts`](tests/malformed-input.test.ts)

**Purpose:** Verify the service **does not crash** on malformed input and returns the correct 400/200 per spec §4.1.

| # | Test | Description | Expected | Actual | Result |
|---|------|-------------|----------|--------|--------|
| 1 | `rejects invalid JSON with a controlled response` | Body `"{ bad json"` | 400, `error.code = "VALIDATION_ERROR"` | 400, `VALIDATION_ERROR` | ✅ |
| 2 | `rejects missing ticket_id` | `{ complaint: "Payment failed" }` | 400 | 400 | ✅ |
| 3 | `rejects missing complaint` | `{ ticket_id: "TKT-MISSING" }` | 400 | 400 | ✅ |
| 4 | `rejects empty complaint` | `{ ticket_id: "TKT-EMPTY", complaint: "   " }` | 400 | 400 | ✅ |
| 5 | `rejects unsupported optional enum values` | `language: "fr"` | 400 | 400 | ✅ |
| 6 | `accepts missing and empty transaction history` | Missing `transaction_history` and `[]` | 200, `evidence_verdict: "insufficient_data"` | 200, `insufficient_data` | ✅ |
| 7 | `does not crash on malformed transaction entries` | Row with `timestamp: "not-a-date"`, `amount: "not-a-number"` | 200, `relevant_transaction_id: null` | 200, `null` | ✅ |

**What it covers:** Spec §4.1 (400 for malformed input, server must not crash) and resilience of `rawTransactionInputSchema` preprocessing.

---

## 4. HTTP Smoke Test (Spec §4.1 "Service Must Not Crash")

This test is run **outside** Vitest to verify that bad requests via real HTTP do not kill the process.

| Step | Request | Expected | Actual |
|------|---------|----------|--------|
| 1 | `GET /health` | 200, `{ status: "ok" }` | ✅ 200 |
| 2 | `POST /analyze-ticket` with invalid JSON `"{ bad"` | 400 | ✅ 400 |
| 3 | `POST /analyze-ticket` with empty body `{}` | 400 | ✅ 400 |
| 4 | `GET /health` again | 200, `{ status: "ok" }` (server still alive) | ✅ 200 |

**Verdict:** Process continues serving after every malformed input. ✅

---

## 5. Spec Coverage Matrix

| Spec Section | Requirement | Covered By |
|---|---|---|
| §4.1 | 200 success schema | [`analyze.contract.test.ts`](tests/analyze.contract.test.ts ), [`sample-cases.test.ts`](tests/sample-cases.test.ts ) |
| §4.1 | 400 malformed input | [`malformed-input.test.ts`](tests/malformed-input.test.ts ) |
| §4.1 | 404 unknown route | [`analyze.contract.test.ts`](tests/analyze.contract.test.ts ) |
| §4.1 | Service must not crash | [`malformed-input.test.ts`](tests/malformed-input.test.ts ), §4 above |
| §4.1 | Non-sensitive error messages | [`malformed-input.test.ts`](tests/malformed-input.test.ts ) — checks `error.code` only |
| §4.2 | `/health` shape | [`health.test.ts`](tests/health.test.ts ) |
| §5 | Evidence reasoning | [`reasoning.test.ts`](tests/reasoning.test.ts ) |
| §6 | Safety guardrails | [`safety.test.ts`](tests/safety.test.ts ), [`ai-fallback.test.ts`](tests/ai-fallback.test.ts ), [`reasoning.test.ts`](tests/reasoning.test.ts ) |
| §7 | AI fallback strategy | [`ai-fallback.test.ts`](tests/ai-fallback.test.ts ) |

---

## 6. Build / Typecheck Verification

| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `npm run typecheck` | ✅ Exit 0 |
| TypeScript build | `npm run build` | ✅ Exit 0 (emits `dist/`) |

---

## 7. Notes & Limitations

- All 37 tests pass deterministically with `USE_OPENAI=false` (no network calls).
- The "service must not crash" requirement is verified by both the Vitest suite and a separate HTTP smoke test.
- Sample-case IDs in [`sample-cases.test.ts`](tests/sample-cases.test.ts ) are loaded dynamically from [`samples/SUST_Preli_Sample_Cases.json`](samples/SUST_Preli_Sample_Cases.json ); see that file for the exact case identifiers.
- 422 (semantic invalid) is **not** currently used; spec marks it as optional. All invalid inputs return 400.

---

## 8. Conclusion

**Result: ✅ PASS — all spec testable requirements verified.**

- 37 / 37 unit + integration tests green
- TypeScript compiles cleanly
- HTTP smoke test confirms process resilience
- Safety, AI fallback, reasoning, contract, and malformed-input behaviours are all covered
