---
phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - .github/workflows/ci.yml
  - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/test/sms-cluster-crossslot.integration.spec.ts
  - apps/api/test/sms-throttle.integration.spec.ts
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
  - apps/web/components/auth/phone-verification.tsx
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

Phase 14 correctly fixes the CROSSSLOT regression by introducing three hash-tag key
builders (`smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey`) that all share the
`{sms:${e164}}` tag, so every `VERIFY_AND_INCREMENT_LUA` EVAL hashes to a single
slot. The Lua body itself is untouched (per D-05) and its KEYS[1..3] / ARGV[1..3]
interface matches both the call site in `sms.service.ts#verifyCode` and all test
spec usages.

Test drift is cleanly eliminated: `sms-throttle.integration.spec.ts` imports the
key builders and Lua body from `sms.service.ts` (no duplicate copy),
`sms.service.spec.ts` imports the same exports, and `redis.provider.spec.ts`
exercises the new hash-tag form in its pipeline mock surface test. The cluster
regression guard (`sms-cluster-crossslot.integration.spec.ts`) correctly uses
`--cluster-enabled` + `cluster-announce-ip` + dynamic natMap bootstrap and includes
all four Lua outcome branches, a negative CROSSSLOT guard using the legacy scheme,
and multi-locale slot-equality assertions. CI is wired to run `pnpm test:integration`
(SC-2 guard) before the Playwright stage.

Frontend `handleVerifyCode` implements the D-07/D-08 server-message precedence
with proper undefined + empty-string guards; `phone-verification.test.tsx` covers
SC-4a / SC-4b-1 / SC-4b-2 / SC-4c. React's default text-node escaping means the
server `message` field cannot introduce XSS.

Core logic is correct. Findings below are hardening nits and one documented
mismatch between Lua behavior and its accompanying comment.

## Warnings

### WR-01: Lua comment is stale — `VERIFIED` branch does NOT `DEL KEYS[2]`

**File:** `apps/api/src/modules/sms/sms.service.ts:50`
**Issue:** The docstring comment on the Lua script says:

> `{'VERIFIED', attempts}        -- correct. otp/attempts DEL, verified SETEX.`

…but the Lua body on lines 74-77 only runs `redis.call('DEL', KEYS[1], KEYS[2])`
at the surface level, which DOES delete both. Re-reading the actual behavior:
attempts IS deleted on VERIFIED via the same `DEL KEYS[1], KEYS[2]` call. This
part of the comment is accurate.

However, the integration-test assertion at
`apps/api/test/sms-throttle.integration.spec.ts:329` correctly expects
`smsAttemptsKey` to be `null` after VERIFIED — which only passes because the
Lua does delete KEYS[2]. Cross-checked against the integration spec proof.

**Status:** On close re-inspection this is actually CORRECT — withdrawing the
comment-drift concern. Leaving this entry as an explicit note so future readers
don't mis-read the docstring. No code change required.

**Fix:** No change needed; retained for audit trail.

### WR-02: Integration test swallows `cluster.quit()` / `container.stop()` rejections

**File:** `apps/api/test/sms-cluster-crossslot.integration.spec.ts:146-149`
**Issue:** `afterAll` uses optional-chaining but does not await-catch:

```ts
afterAll(async () => {
  await cluster?.quit();
  await container?.stop();
});
```

If `cluster.quit()` rejects (e.g., the master shard died mid-test), `container.stop()`
never runs and the Docker container leaks across test runs, consuming port 6379
mappings on a CI runner that may process multiple phases in the same job. The
same pattern is used in `sms-throttle.integration.spec.ts:102-106` (three
independent resources: `app.close`, `redis.quit`, `container.stop`) — if any
earlier teardown throws, all subsequent resources leak.

**Fix:** Use `Promise.allSettled` so every teardown runs regardless of prior failures:

```ts
afterAll(async () => {
  await Promise.allSettled([
    cluster?.quit(),
    container?.stop(),
  ]);
});
```

And for `sms-throttle.integration.spec.ts`:

```ts
afterAll(async () => {
  await Promise.allSettled([
    app?.close(),
    redis?.quit(),
    container?.stop(),
  ]);
});
```

This matches the defensive rollback pattern already used in `sms.service.ts:269-282`
(`Promise.allSettled` around rollback ops with per-op failure logging) and avoids
testcontainers leaks that fatally degrade CI throughput.

## Info

### IN-01: Empty-string `set()` default in redis mock obscures config intent

**File:** `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts:18-21`
**Issue:** `createMockConfig(url)` returns empty string `''` when `url === ''` and
the passed `defaultValue` is undefined:

```ts
if (url === '') return defaultValue ?? '';
```

`ConfigService.get('REDIS_URL', '')` would receive `''` — which is the current
factory contract — but `ConfigService.get('NODE_ENV')` (no default) also returns
`''`, not `undefined`. This happens to work for the current assertions but could
silently hide a future regression where a factory reads `NODE_ENV` via the config
service (the factory currently reads `process.env['NODE_ENV']` directly).

**Fix:** Return `defaultValue` unchanged and let callers supply the contract:

```ts
get: vi.fn().mockImplementation((_key: string, defaultValue?: string) => {
  // Only REDIS_URL is parameterized; everything else returns its passed default.
  if (_key === 'REDIS_URL') return url || (defaultValue ?? '');
  return defaultValue;
}),
```

Low priority — tests currently pass and the factory does not consult ConfigService
for NODE_ENV.

### IN-02: CI integration-test step has no timeout ceiling

**File:** `.github/workflows/ci.yml:57-58`
**Issue:** The `Integration tests (testcontainers — SC-2 ...)` step runs
`pnpm --filter @grabit/api test:integration` with no `timeout-minutes`. Vitest is
configured with `hookTimeout: 120000` / `testTimeout: 60000`
(`apps/api/vitest.integration.config.ts`), so a single stuck container can burn up
to GitHub's default 360-minute job budget if the testcontainers setup hook hangs
before the hookTimeout fires (e.g., image pull stall).

**Fix:** Add `timeout-minutes` to bound the step:

```yaml
- name: Integration tests (testcontainers — SC-2 Valkey Cluster CROSSSLOT guard)
  timeout-minutes: 10
  run: pnpm --filter @grabit/api test:integration
```

10 min = 2× expected worst-case (cold image pull ~60s + 2 × hookTimeout ~240s).

### IN-03: Masking inconsistency in sender-ID error — test at line 199 asserts `"***"` but code always wraps in quotes

**File:** `apps/api/src/modules/sms/sms.service.ts:138-140`
**Issue:** The error message always wraps the masked sender in quotes:

```ts
const masked = sender.length <= 2 ? '***' : `${sender.slice(0, 2)}***`;
throw new Error(`[sms] INFOBIP_SENDER must be ... (got "${masked}"). ...`);
```

The test at `sms.service.spec.ts:199` checks `msg.toContain('"***"')` and at
line 181 checks `msg.toContain('ab***')` — the latter is satisfied by the
substring match (prefix without quotes), but the full literal emitted is
`"ab***"`. This works today because both assertions pass. A stricter test
would assert the full quoted form `"ab***"` to detect accidental re-formatting
of the error template.

**Fix:** Consider tightening spec assertions to quoted form `msg.toContain('"ab***"')`
so any future rework that drops the quotes (and inadvertently logs the raw prefix
alongside other tokens) is caught. Optional — current tests already cover the
security requirement ("full value never appears").

### IN-04: Unused `set()` default-value shim in `createMockConfig` returns `''` for non-REDIS_URL keys

**File:** `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts:17-22`
**Issue:** Same as IN-01 but distinct angle: if the factory is ever extended to
call `configService.get('SOME_NEW_KEY', 'fallback')`, the mock will return `''`
instead of `'fallback'` when `url === ''`. The fallback would be silently
swallowed. Duplicate of IN-01 spirit; combine into one fix.

**Fix:** Combine with IN-01 — single `defaultValue` passthrough implementation.

---

## Positive Observations (not findings; recorded for phase audit)

- **E.164 injection surface is closed.** `phone.util.ts:parseE164` runs every
  input through `libphonenumber-js` `parsePhoneNumberWithError` and rejects
  invalid numbers before the value reaches `smsOtpKey(e164)`. The returned string
  always matches `^\+\d{1,15}$`, so no hash-tag metacharacters (`{`, `}`, `:`)
  can be injected into Redis key namespace. Key-injection risk = 0.
- **Lua KEYS/ARGV alignment is correct.** Call site passes `(LUA, 3, smsOtpKey,
  smsAttemptsKey, smsVerifiedKey, code, '5', '600')`; Lua consumes
  `KEYS[1]=otp / KEYS[2]=attempts / KEYS[3]=verified` and
  `ARGV[1]=code / ARGV[2]=max / ARGV[3]=ttl`. 4-branch semantics (VERIFIED /
  WRONG / EXPIRED / NO_MORE_ATTEMPTS) match both the service switch statement
  and the integration-test assertions.
- **All three keys share the same CLUSTER KEYSLOT** — proven mechanically by
  `sms-cluster-crossslot.integration.spec.ts:259-274` with multiple e164
  formats (`+82`, `+1`, `+86`) in `describe.each`.
- **Frontend message contract is XSS-safe.** `verifyError` is rendered as a
  JSX text node (`{verifyError}` inside `<p role="alert">`), not via
  `dangerouslySetInnerHTML`. React auto-escapes. Server-controlled `message`
  cannot inject HTML/JS.
- **D-07/D-08 branch correctly uses `typeof === 'string' && length > 0`**, so
  both `undefined` and `''` fall through to the hardcoded fallback
  ("인증번호가 일치하지 않습니다"). Test coverage: SC-4a (server msg), SC-4b-1
  (undefined), SC-4b-2 (empty string), SC-4c (verified=true).
- **CI gate is hardcoded before the Playwright stage**, ensuring the cluster
  regression guard blocks merges that would re-introduce CROSSSLOT.
- **Pipeline atomicity is observable.** `sendVerificationCode` uses
  `pipeline().set().del().exec()` and validates every per-op result with
  `results.some((r) => !r || r[0])` — prevents SMS delivery when OTP storage
  failed (the "unverifiable code" security nit called out in the source
  comment on line 238).
- **Rate-limit counter ordering preserved**: `atomicIncr` runs BEFORE the Lua
  verify in `verifyCode`, closing the enumeration oracle on the
  `{sms:...}:verified` flag (WR-02 regression guard test present at
  `sms.service.spec.ts:685-727`).

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
