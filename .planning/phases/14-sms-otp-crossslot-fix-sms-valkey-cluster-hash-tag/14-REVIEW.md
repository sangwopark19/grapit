---
phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
  - apps/api/test/sms-throttle.integration.spec.ts
  - apps/api/test/sms-cluster-crossslot.integration.spec.ts
  - .github/workflows/ci.yml
  - apps/web/components/auth/phone-verification.tsx
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 14 applies Valkey Cluster hash-tags (`{sms:<e164>}:otp|:attempts|:verified`) to the
3-key set consumed by `VERIFY_AND_INCREMENT_LUA`, eliminating the `CROSSSLOT` failure that
would hit Memorystore Cluster in production. The change is surgical, well-documented, and
backed by a proper regression guard (`sms-cluster-crossslot.integration.spec.ts`) which
stands up a real single-shard Valkey cluster via testcontainers, dynamically builds a
`natMap` from `CLUSTER SLOTS`, asserts the legacy scheme now throws `CROSSSLOT`, covers
all four Lua branches on hash-tagged keys, proves `CLUSTER KEYSLOT` equality across three
E.164 formats, and validates the `pipeline.set().del()` shape used by
`sendVerificationCode`. The integration spec is wired into CI via
`pnpm --filter @grabit/api test:integration`, so regressions are permanently blocked.

Security-sensitive surface area (Lua atomicity, counter rollback policy, enumeration
resistance via counter-first ordering, short-circuit removal on the `:verified` flag, SMS
sender-ID masking) is preserved unchanged — the hash-tag migration is a pure key-scheme
refactor plus test coverage additions. No critical issues found. Two warnings flag
ergonomic/consistency gaps worth addressing; four info items are polish suggestions.

## Warnings

### WR-01: Non-OTP Valkey keys remain un-hash-tagged — inconsistent cluster-safety envelope

**File:** `apps/api/src/modules/sms/sms.service.ts:188,201,271,338,410`
**Issue:** The 3-key OTP set (`otp`, `attempts`, `verified`) is now hash-tagged, but the
sibling counter keys used by the same flow are not:
- `sms:resend:${e164}` (cooldown, SET NX + PTTL + DEL — line 188, 270)
- `sms:phone:send:${e164}` (D-06 hourly send counter, EVAL INCR+EXPIRE + DECR — line 201, 271)
- `sms:phone:verify:${e164}` (D-07 15-min verify counter, EVAL INCR+EXPIRE + DECR — line 338, 410)

This is not a bug today because each of those keys is only ever touched by single-key
commands (`SET`, `DECR`, Lua EVAL with a single KEY, `DEL`, `PTTL`) — none of them run in
a multi-key transaction or Lua script with the OTP keys, so cluster slot divergence never
surfaces. However:
1. The rollback path (line 269-272) uses `Promise.allSettled([DEL cooldown, DECR counter])`
   which works on two independently-hashed keys. If a future change converts that to a
   `MULTI/EXEC` or pipelined Lua for atomicity (tempting, and a common review suggestion),
   it would immediately resurrect the CROSSSLOT failure mode this phase just fixed.
2. The key-naming scheme is now visibly split — consumers see
   `{sms:<e164>}:otp` vs. `sms:phone:send:<e164>`, which is jarring and makes the
   hash-tag contract feel incidental rather than a deliberate project-wide convention.

**Fix:** Either (a) unify all per-phone SMS keys under the same hash-tag
`{sms:<e164>}:<role>` via builder helpers so the cluster invariant is uniform and
future-proof, or (b) add a code comment at each counter-key definition explicitly noting
"single-key only — do NOT pipeline with OTP keys; see Phase 14 hash-tag contract" so the
next reviewer understands why these look different. Preferred (a):
```ts
export const smsResendKey        = (e164: string) => `{sms:${e164}}:resend`;
export const smsSendCounterKey   = (e164: string) => `{sms:${e164}}:send-count`;
export const smsVerifyCounterKey = (e164: string) => `{sms:${e164}}:verify-count`;
```
Note: changing key names is a deploy-time counter reset (old keys in production expire
naturally via TTL), which is acceptable at a phase boundary.

### WR-02: Hash-tag builders accept untrusted E.164 without character whitelisting

**File:** `apps/api/src/modules/sms/sms.service.ts:89-91`
**Issue:** `smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey` interpolate the e164 string
directly inside the `{sms:${e164}}` hash-tag. If `parseE164()` is ever bypassed (e.g. a
future endpoint calls these builders with raw user input, or a test fixture passes a
malformed value), characters like `}` or `{` inside the string would terminate the
hash-tag early, causing the 3 keys to hash to different slots and silently resurrecting
the CROSSSLOT bug. Redis cluster uses only the content between the first `{` and the
next `}`; a payload like `phone = "}x:"+"+821012345678"` could split the tag.
`parseE164()` currently rejects any `{`/`}` so the risk is theoretical, but the defense
is a single assertion.

**Fix:** Add an invariant assertion in each key builder that the e164 matches
ITU-T E.164 (`/^\+\d{6,15}$/`) so any caller that forgets `parseE164()` fails fast:
```ts
const E164_RE = /^\+\d{6,15}$/;
function assertE164(s: string): void {
  if (!E164_RE.test(s)) throw new Error(`[sms] non-E164 key input: ${s.slice(0, 4)}***`);
}
export const smsOtpKey      = (e164: string) => { assertE164(e164); return `{sms:${e164}}:otp`; };
export const smsAttemptsKey = (e164: string) => { assertE164(e164); return `{sms:${e164}}:attempts`; };
export const smsVerifiedKey = (e164: string) => { assertE164(e164); return `{sms:${e164}}:verified`; };
```
This also formalizes the "keys must be sourced from `parseE164()`" contract at the
boundary rather than implicitly.

## Info

### IN-01: Lua attempts-key EXPIRE is hard-coded to 900 instead of parameterized

**File:** `apps/api/src/modules/sms/sms.service.ts:57-81`
**Issue:** The Lua doc-comment describes ARGV as `[1]=user code, [2]=max attempts,
[3]=verified TTL seconds`, and the service passes `String(OTP_MAX_ATTEMPTS)` as ARGV[2]
(line 379). However, the `EXPIRE` on the attempts key at line 65 is hard-coded to `900`
rather than parameterized. This is functionally fine but couples the Lua to a specific
constant — if `VERIFY_PHONE_WINDOW_SEC` ever changes (e.g. different policy per locale),
the Lua will silently use the old value.

**Fix:** Either document that `900` is intentionally pinned with a build-time assert
`VERIFY_PHONE_WINDOW_SEC === 900` in a module-load check, or pass it as ARGV[4] and use
`redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))`. Low priority; purely maintenance.

### IN-02: Pipeline error detection discards op identity and error message

**File:** `apps/api/src/modules/sms/sms.service.ts:247-249`
**Issue:** The pipeline-error detection (`results.some((r) => !r || r[0])`) discards which
op failed and what the error message was. When `sms.send_failed` is logged (line 295) the
operator sees only `"Failed to store OTP / reset attempts in Valkey"`, not whether the
failure came from `SET otp` or `DEL attempts` or what Valkey returned. For a
CROSSSLOT-style regression this matters — the operator would wrongly suspect network or
timeout rather than a cluster slot mismatch.

**Fix:** Capture the first failed op and surface it in the thrown message so Sentry has
enough context:
```ts
const failedIdx = results?.findIndex((r) => !r || r[0]) ?? -1;
if (!results || failedIdx !== -1) {
  const op = failedIdx === 0 ? 'SET otp' : failedIdx === 1 ? 'DEL attempts' : 'unknown';
  const cause = results?.[failedIdx]?.[0]?.message ?? 'null entry';
  throw new Error(`Failed to store OTP / reset attempts in Valkey (op=${op}): ${cause}`);
}
```

### IN-03: `smsVerifiedKey` is never read by any consumer — dead write

**File:** `apps/api/src/modules/sms/sms.service.ts:76, 91, 350-368`
**Issue:** The CR-01 fix removed the short-circuit that read `{sms:<e164>}:verified`. The
Lua script still `SETEX`'s this key on VERIFIED (line 76) and the service still exports
`smsVerifiedKey`. The comment says "it remains available for downstream consumers to
query explicitly" — but no such consumer exists anywhere in the repo (verified by grep).
This is fine today, but without a consumer the key is dead-written state: 600s TTL per
successful verify, visible in key-space scans, and easy to misinterpret as authoritative
"is-verified" truth for a future implementer.

**Fix:** Either (a) leave a `@todo` / plan-link comment explicitly noting "no current
consumer — kept for planned session-bound token (WR-02 follow-up)", or (b) drop the
`SETEX` and the `smsVerifiedKey` export until a consumer materializes. Option (a) matches
the existing phase plan; just be explicit so a future cleanup PR doesn't accidentally
remove it.

### IN-04: `retryAfterMs` returns the full window length, not the remaining interval

**File:** `apps/api/src/modules/sms/sms.service.ts:208, 345`
**Issue:** When rate-limited, the 429 response returns
`retryAfterMs: SEND_PHONE_WINDOW_SEC * 1000` (3 600 000 ms = 1 h) or
`VERIFY_PHONE_WINDOW_SEC * 1000` (900 000 ms = 15 min). This is the worst-case time
until the counter resets, not the actual time remaining. A user hitting the 6th send at
minute 55 would see "retry in 1 hour" when the actual unlock is ~5 min away. Currently
`phone-verification.tsx` does not surface `retryAfterMs` in the UI (it shows a static
"잠시 후 다시 시도해주세요"), so the UX is not wrong today — but the number in the payload
is misleading and will bite if the frontend ever starts honoring it.

**Fix:** Read the actual TTL of the counter key and return the remaining window, mirroring
the D-11 cooldown path (already correct at line 191-196):
```ts
const ttl = await this.redis.pttl(`sms:phone:send:${e164}`);
throw new HttpException(
  { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: Math.max(ttl, 0) },
  HttpStatus.TOO_MANY_REQUESTS,
);
```

---

## Positive Observations

- `VERIFY_AND_INCREMENT_LUA` is a genuine atomic script: INCR + conditional EXPIRE +
  branch run in a single round trip under Valkey's single-threaded command loop, so the
  4-branch state machine is race-free.
- Test source-of-truth: `sms-throttle.integration.spec.ts` imports
  `VERIFY_AND_INCREMENT_LUA`, `smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey` directly
  from the service module (line 11-17) rather than duplicating. Any future key/schema
  change propagates automatically.
- `sms-cluster-crossslot.integration.spec.ts` includes a NEGATIVE-GUARD test
  (line 161-176) that asserts the old scheme still throws `CROSSSLOT` in cluster mode —
  exactly the regression harness needed. If someone ever reverts the hash-tag change, CI
  fails immediately.
- `buildNatMap` (line 39-70) correctly handles the testcontainers
  `--cluster-announce-ip` timing issue and dumps the raw `CLUSTER SLOTS` reply on
  bootstrap failure for post-mortem.
- OTP generation uses `crypto.randomInt(100000, 1000000)` (CSPRNG, OWASP A02 compliant),
  unit-tested.
- The CR-01 short-circuit fix (line 350-368) with accompanying tests (line 730-782 of
  sms.service.spec.ts) closes a real impersonation vector.
- Counter-first ordering for enumeration resistance (line 332-336 of sms.service.ts,
  regression tested at line 685-727 of sms.service.spec.ts) is sound.
- Frontend `phone-verification.tsx`: D-07 server-message priority with D-08 empty-string
  guard (line 149-154) correctly distinguishes "wrong OTP" from "Valkey eval failure"
  for the user. `autoComplete="one-time-code"` (line 232), `inputMode="numeric"`
  (line 231), and `role="alert"` (line 277) are appropriate accessibility affordances.
  Numeric sanitization on input (line 237) prevents non-digit characters from entering
  the OTP field.
- CI wire-up (`.github/workflows/ci.yml` line 57-58) runs the cluster integration test
  on every PR/push. Docker daemon on `ubuntu-latest` is sufficient for testcontainers.

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
