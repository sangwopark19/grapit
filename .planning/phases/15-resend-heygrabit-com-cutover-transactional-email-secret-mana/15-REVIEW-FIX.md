---
phase: 15-resend-heygrabit-com-cutover-transactional-email-secret-mana
fixed_at: 2026-04-27T06:58:00Z
review_path: .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-04-27T06:58:00Z
**Source review:** .planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-REVIEW.md
**Iteration:** 2 (manual user override on previously-skipped WR-01)

**Summary:**
- Findings in scope: 4 (1 warning, 3 info — fix_scope=all)
- Fixed: 4 (WR-01, IN-01, IN-02, IN-03)
- Skipped: 0

## Fixed Issues

### WR-01: Bounded in-process retry for transient Resend failures (Option A)

**Files modified:** `apps/api/src/modules/auth/email/email.service.ts`, `apps/api/src/modules/auth/email/email.service.spec.ts`
**Commit:** `0eec81d` `fix(15): WR-01 add bounded in-process retry for transient Resend failures`
**Applied fix:** Implemented Option A from the reviewer's fix block — a bounded in-process exponential backoff retry loop for transient Resend errors. The previous single-attempt path remains correct for non-retryable errors (no behavior change for those).

Key implementation details:
- Module-level constants `MAX_SEND_ATTEMPTS = 3` and `RETRY_BASE_MS = 250` keep the policy auditable.
- `RETRYABLE_ERROR(msg)` regex matches Resend's documented transient failure modes plus Node network error codes: `/rate.?limit|timeout|temporar|5\d\d|ECONN|ETIMEDOUT/i`. Non-matching errors fail fast on attempt 1.
- Retry loop uses exponential backoff (250ms after attempt 1, 500ms after attempt 2). Worst-case end-to-end retry time is ~750ms — well within Cloud Run's request lifetime, addressing the "process death mid-retry" concern that informed the prior skip rationale.
- Sentry capture happens only on terminal failure (final attempt OR non-retryable error), not on each retry, to avoid alert spam. The Sentry context now includes `attempts: <count>` for ops triage.
- Recovery on retry is logged at `log` level so ops can distinguish "transient blip absorbed" from "first-try success" in production logs.
- Loop terminates with an explicit `throw new Error('email retry loop exited unexpectedly')` to satisfy TypeScript's control flow analysis (defensive — unreachable in practice).

**Decision rationale (overrides iteration 1 skip):**
The user explicitly directed to apply the fix. Option A was chosen over Option B (pg-boss) because:
1. Option A is surgical (one method, ~30 LOC) and does not expand the cutover scope.
2. The "process death" risk for Option A was overstated — a 750ms backoff window is well within a single Cloud Run request lifetime; instances are not reaped mid-request.
3. Option B (pg-boss enqueue) remains the long-term durable solution and is preserved as a backlog item — it is materially more work (job handler, queue registration, auth flow changes) and is appropriate for a follow-up phase, not this cutover.

**Verification:**
- `pnpm --filter @grabit/api typecheck` — clean.
- `pnpm --filter @grabit/api test -- email.service.spec` — 13/13 tests pass.
- Full test suite — 312/312 pass (was 309 before, +3 retry tests).

**New tests (3, using `vi.useFakeTimers`):**
1. `rate_limit_exceeded` on attempt 1 → 250ms backoff → succeeds on attempt 2 → 2 send calls, no Sentry capture.
2. Persistent `503 service unavailable` → 3 send calls + 750ms total backoff → Sentry captured once with `attempts: 3`.
3. Non-retryable error (`invalid recipient`) → exactly 1 send call, immediate Sentry capture with `attempts: 1`.

**Updated existing tests (3):** The pre-existing tests using `'rate limit exceeded'` as the error string were renamed/restructured to "non-retryable" semantics with messages `'permanent error'` and `'invalid recipient'` (which do not match the RETRYABLE_ERROR regex), preserving their original assertions about return shape, Sentry Error wrapping, and PII redaction. The PII test's `setContext` assertion was updated to include `attempts: 1` in the expected payload.

### IN-01: `this.resend!` non-null assertion duplicates a check already encoded in `isDevMode`

**Files modified:** `apps/api/src/modules/auth/email/email.service.ts`
**Commit:** `2d5164f`
**Applied fix:** Removed the `isDevMode: boolean` field entirely and replaced the boolean guard at the top of `sendPasswordResetEmail` with a narrowing check `if (this.resend === null)`. After the narrowing branch returns, TypeScript narrows `this.resend` to `Resend` automatically, so the call site is now `this.resend.emails.send(...)` — no `!` non-null assertion. The constructor's resend-instance assignment also drops its `apiKey!` non-null assertion (uses `apiKey === undefined` narrowing instead). Net result: no non-null assertions in the file, and the `null` channel is the single source of truth for "dev-mock mode".

**Verification:**
- `pnpm --filter @grabit/api typecheck` — clean.
- `pnpm --filter @grabit/api test -- email.service.spec` — pass; full suite pass.

### IN-02: Tighten production check to "anything except development/test requires the key"

**Files modified:** `apps/api/src/modules/auth/email/email.service.ts`, `apps/api/src/modules/auth/email/email.service.spec.ts`
**Commit:** `2d5164f` (service); `340cc6a` (spec updates)
**Applied fix:** Replaced the binary `isProd = nodeEnv === 'production'` check with `isNonDev = nodeEnv !== 'development' && nodeEnv !== 'test'` (the reviewer's recommended Option A). Both hard-fail branches (missing `RESEND_API_KEY`, missing/invalid `RESEND_FROM_EMAIL`) now trigger for any environment except `development` and `test`. Error message text updated from "in production" to "outside development/test environments" to reflect the broader scope. Two tests added to lock the new behavior:
1. `STAGING misconfig (API_KEY)`: `NODE_ENV=staging` + no `RESEND_API_KEY` now throws (previously would silently fall through to dev-mock mode and log reset tokens to stdout).
2. `TEST mode`: `NODE_ENV=test` + no `RESEND_API_KEY` constructs without throwing (preserves the test-suite path).

The three pre-existing prod-misconfig tests had their regex assertions updated to match the new error messages.

**Verification:**
- Typecheck clean.
- All email.service.spec tests pass, including the two new staging/test cases.

### IN-03: Test file mutates `process.env` snapshot but never reads it; cleanup is dead code

**Files modified:** `apps/api/src/modules/auth/email/email.service.spec.ts`
**Commit:** `340cc6a`
**Applied fix:** Removed the dead `originalEnv = { ...process.env }` capture, the unused `afterEach` block that restored it, and the `afterEach` import from vitest. No test in the file mutates `process.env` (all config injection happens via the `makeConfig` helper that constructs a `ConfigService` mock), so the snapshot/restore was pure noise.

**Verification:**
- Typecheck clean.
- Full email.service.spec suite passes.

## Follow-up Backlog

WR-01 was fixed via Option A (in-process retry). Option B (pg-boss durable queue) remains a worthwhile improvement for full crash safety and survives instance reaping during pathological extended outages. Recommend a future phase: "transactional email durability via pg-boss" — would replace the inline retry with `boss.send('email.password-reset', { to, resetLink })` and a worker that calls Resend with native pg-boss retries (configurable backoff, dead-letter queue, persistence across restarts).

---

_Fixed: 2026-04-27T06:58:00Z_
_Fixer: Claude (manual override)_
_Iteration: 2_
