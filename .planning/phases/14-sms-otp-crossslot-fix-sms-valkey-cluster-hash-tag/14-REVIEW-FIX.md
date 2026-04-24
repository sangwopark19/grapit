---
phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
fixed_at: 2026-04-24T15:30:00Z
review_path: .planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-04-24T15:30:00Z
**Source review:** `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning only; 4 Info findings deferred)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Non-OTP Valkey keys remain un-hash-tagged — inconsistent cluster-safety envelope

**Files modified:**
- `apps/api/src/modules/sms/sms.service.ts`
- `apps/api/src/modules/sms/sms.service.spec.ts`
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`
- `packages/shared/src/constants/index.ts`

**Commit:** `53dd7ee`

**Applied fix:** Adopted Option (a) from the review — introduced three new
builder helpers (`smsResendKey`, `smsSendCounterKey`, `smsVerifyCounterKey`)
producing `{sms:<e164>}:resend`, `{sms:<e164>}:send-count`, and
`{sms:<e164>}:verify-count`. Replaced all five interpolated call-sites in
`sms.service.ts` (cooldown SET/DEL, send-counter INCR/DECR, verify-counter
INCR/DECR). Updated `sms.service.spec.ts` to import the new builders and
replaced `expect.stringContaining('sms:resend:')` /
`'sms:phone:send:+821012345678'` / `'sms:phone:verify:+821012345678'` string
literals with builder calls so the tests remain source-of-truth for the key
scheme. Updated `redis.provider.spec.ts` to use hash-tag form for the
illustrative fixtures that validate InMemoryRedis ioredis parity. Updated
the comment in `packages/shared/src/constants/index.ts` to reference the
new key name.

Deploy-time impact: changing key names resets counters (`cooldown` 30s,
`send-count` 1h, `verify-count` 15m) — old keys expire naturally via TTL.
Acceptable at a phase boundary and already documented in the builder
header comment.

Verification:
- Tier 1: re-read all modified ranges; builders resolve, callers reference
  them correctly.
- Tier 2: `pnpm --filter @grabit/api exec tsc --noEmit` clean; full API
  test suite `pnpm --filter @grabit/api test` → 305/305 pass.
- Tier 3 (integration): `pnpm --filter @grabit/api test:integration
  sms-cluster-crossslot` → 10/10 cluster crossslot tests pass against real
  single-shard Valkey cluster. Hash-tag slot equality continues to hold.

### WR-02: Hash-tag builders accept untrusted E.164 without character whitelisting

**Files modified:**
- `apps/api/src/modules/sms/sms.service.ts`
- `apps/api/src/modules/sms/sms.service.spec.ts`

**Commit:** `c50c91f`

**Applied fix:** Added an `E164_RE = /^\+\d{6,15}$/` regex and an
`assertE164()` helper that throws a masked error for non-conforming input
(keeps only the first 4 characters — `+` plus 2-3 digit country code — so
the subscriber number never leaks into Cloud Logging / Sentry). Every
builder (`smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey`, `smsResendKey`,
`smsSendCounterKey`, `smsVerifyCounterKey`) now runs `assertE164(e164)`
before returning the key.

Added 22 parametrized test cases in a new
`[WR-02] hash-tag key builders reject non-E.164 input` describe block,
covering:
- Empty string, missing `+` prefix, curly-brace injection (`}x:+82...`),
  letters, too-short (`+12345`), too-long (16 digits), embedded
  whitespace, embedded hyphens.
- Individual builder-level assertions so each of the 6 builders has at
  least 2 negative cases.
- A masking-shape assertion (`+821***` leak; `xBAD` suffix must be
  absent).
- A valid-input passthrough matrix for KR (`+821012345678`), US
  (`+13125551234`), and HK (`+85212345678`) — all 6 builders must accept.

Verification:
- Tier 1: re-read builder block + new test block; assertion logic is
  correct; masking logic matches test expectations.
- Tier 2: `pnpm --filter @grabit/api exec tsc --noEmit` clean; full API
  test suite → 305/305 pass (22 new cases added).
- Tier 3 (integration): `pnpm --filter @grabit/api test:integration
  sms-cluster-crossslot` → 10/10 pass; real Valkey cluster tests exercise
  builders with valid `+82/+13/+86` E.164 strings and continue to succeed.

---

_Fixed: 2026-04-24T15:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
