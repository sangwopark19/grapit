---
phase: 10-sms
fixed_at: 2026-04-20T11:55:00Z
review_path: .planning/phases/10-sms/10-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-04-20T11:55:00Z
**Source review:** `.planning/phases/10-sms/10-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical + 5 Warnings)
- Fixed: 6
- Skipped: 0

All in-scope Critical and Warning findings were fixed. Every fix was committed atomically with the `fix(10):` conventional prefix. Existing 262 API unit tests continue to pass; six new regression tests were added (CR-01 x2, WR-03 x2, WR-04 x2, WR-05 x2). Typecheck and ESLint are clean on the modified files.

## Fixed Issues

### CR-01: `verifyCode` accepts ANY code when `sms:verified` flag is live (impersonation)

**Files modified:** `apps/api/src/modules/sms/sms.service.ts`, `apps/api/src/modules/sms/sms.service.spec.ts`
**Commit:** 59bacba
**Applied fix:** Removed the `sms:verified:{e164}` short-circuit from `verifyCode`. Every verify call now evaluates the Lua `VERIFY_AND_INCREMENT` script against the stored OTP, so an arbitrary code (e.g. `"000000"`) can never pass against a phone whose previous verification is still within the 10-min flag window. Idempotent re-verify returns `EXPIRED` (GoneException) because the Lua script DELs the OTP on VERIFIED. The `sms:verified` flag is still SETEX'd by the Lua script for downstream consumers to query explicitly (it just no longer gates the verify response). Two regression tests added: wrong code with live flag returns `verified: false`; correct code against already-consumed OTP returns `GoneException` (no flag short-circuit). Updated the prior WR-02 test that expected short-circuit semantics to reflect the new invariant (counter-first ordering still enforced via `toHaveBeenNthCalledWith`). Corresponds to Option A in the review.

### WR-01: Pipeline result-entry destructuring crashes if any entry is null

**Files modified:** `apps/api/src/modules/sms/sms.service.ts`
**Commit:** 170d940
**Applied fix:** Replaced `results.some(([opErr]) => opErr)` with `results.some((r) => !r || r[0])`. Index access instead of destructuring handles the `[Error|null, unknown] | null` typing variant defensively; a null per-entry (e.g. mid-pipeline connection reset) is now treated as a failure and flows through the `pipeline failed -> do not send SMS` guard instead of throwing `TypeError` inside `.some`. Existing pipeline-fail regression test still covers the happy-unhappy split.

### WR-02: Silent rollback failures lose counter/cooldown reconciliation signal

**Files modified:** `apps/api/src/modules/sms/sms.service.ts`
**Commit:** 49579e7
**Applied fix:** Replaced `Promise.all([ del.catch(() => {}), decr.catch(() => {}) ])` with `Promise.allSettled([...])` plus a per-op `logger.warn({ event: 'sms.rollback_failed', phone, op, err })` loop. Ops now have an explicit signal (`sms.rollback_failed` event) when a user gets stuck in cooldown or retains a phone-axis slot because the rollback itself failed on a degraded Valkey. Existing rollback-path tests continue to pass.

### WR-03: Sender masking leaks full value when `INFOBIP_SENDER.length === 3`

**Files modified:** `apps/api/src/modules/sms/sms.service.ts`, `apps/api/src/modules/sms/sms.service.spec.ts`
**Commit:** 01b0d13
**Applied fix:** Replaced the `sender.length <= 3 ? sender : slice(0,2)+***` branch with uniform masking: `length <= 2 -> '***'`, otherwise `slice(0,2) + '***'`. 3-char inputs (`"abc"`) now emit `"ab***"`; 1-2 char inputs emit `"***"`. Added two regression tests covering both mask branches and asserting the full value never appears verbatim in the boot-time error.

### WR-04: Phone-axis verify counter is not decremented on Valkey eval failure

**Files modified:** `apps/api/src/modules/sms/sms.service.ts`, `apps/api/src/modules/sms/sms.service.spec.ts`
**Commit:** 353a94c
**Applied fix:** Added `this.redis.decr('sms:phone:verify:{e164}').catch(warn)` to the `verifyCode` catch block, gated by a `GoneException` passthrough so only transient Valkey failures (not legitimate EXPIRED / NO_MORE_ATTEMPTS outcomes) release the slot. Rollback-failure path logs `sms.rollback_failed` with `op: 'verify_counter_decr'`. Two regression tests: (1) Lua eval rejection triggers DECR; (2) Lua returning EXPIRED does NOT trigger DECR.

### WR-05: `00` prefix unconditionally rewritten to `+` misparses non-intl KR sequences

**Files modified:** `apps/api/src/modules/sms/phone.util.ts`, `apps/api/src/modules/sms/phone.util.spec.ts`
**Commit:** cf14085
**Applied fix:** Added `parsed.isValid()` validation after `parsePhoneNumberWithError`. Inputs like `007001234567` (KR carrier `00700` international-dialing prefix) that the previous `00 -> +` rewrite mangled into `+7001234567` are now rejected — libphonenumber's `isValid()` checks national-number length and country-prefix validity. Added regression test for the `00700xxx` reject case and kept the existing `0086xxx` accept case as a positive regression. The Zod schema at the controller boundary still pre-rejects these inputs, but phone.util is exported and this guards future reuse.

---

_Fixed: 2026-04-20T11:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
