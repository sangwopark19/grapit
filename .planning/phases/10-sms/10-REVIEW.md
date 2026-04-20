---
phase: 10-sms
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - apps/api/package.json
  - apps/api/src/app.module.spec.ts
  - apps/api/src/app.module.ts
  - apps/api/src/modules/sms/__fixtures__/infobip-send-response.json
  - apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json
  - apps/api/src/modules/sms/infobip-client.spec.ts
  - apps/api/src/modules/sms/infobip-client.ts
  - apps/api/src/modules/sms/phone.util.spec.ts
  - apps/api/src/modules/sms/phone.util.ts
  - apps/api/src/modules/sms/sms.module.ts
  - apps/api/src/modules/sms/sms.service.spec.ts
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/test/sms-throttle.integration.spec.ts
  - apps/api/vitest.integration.config.ts
  - apps/web/components/auth/__tests__/phone-verification.test.tsx
  - apps/web/components/auth/phone-verification.tsx
  - apps/web/e2e/signup-sms.spec.ts
  - apps/web/package.json
  - packages/shared/src/constants/index.ts
  - apps/api/src/modules/sms/sms.controller.ts
findings:
  critical: 1
  warning: 5
  info: 9
  total: 15
status: issues_found
---

# Phase 10: Code Review Report (SMS Twilio → Infobip Migration)

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 10.1 migrates the SMS verification path from Twilio to Infobip `/sms/3/messages` v3 and replaces the provider-managed PIN verification with a Valkey Lua atomic script. The architecture is sound: CSPRNG OTP generation, pipelined OTP + attempts reset, groupId=5 rejection handling, rollback policy split along 4xx vs 5xx boundaries, phone-axis counter ordered before the `sms:verified` short-circuit (WR-02), and KISA-numeric sender format validation (WR-03). Previous review items (WR-01/02/03) are visibly addressed in the source.

One security concern survived from the WR-02 remediation as a documented TODO and should be the primary takeaway of this review: **`verifyCode` accepts any user-supplied code when the `sms:verified:{e164}` flag is live** (see CR-01). The inline comments and controller docblock acknowledge the issue, but the production behavior is exploitable today if the flag TTL has not expired.

A handful of medium-impact correctness issues (pipeline `results` null-entry handling, silent rollback failures, sender-masking leak at length ≤ 3, retry-counter not decremented on Valkey eval failure) and code-quality issues (source-string regex tests, unused test imports, misleading integration-test name, wasteful setInterval churn) round out the findings.

## Critical Issues

### CR-01: `verifyCode` accepts ANY code when `sms:verified` flag is live (impersonation)

**File:** `apps/api/src/modules/sms/sms.service.ts:320-323`
**Issue:**
After the phone-axis counter increments (WR-02 fix), the handler short-circuits to `{ verified: true }` whenever `sms:verified:{e164}` is `'1'`, regardless of the `code` the caller supplied. The TTL is 600s. During that window, any unauthenticated caller that knows a phone number which recently completed verification can POST `/api/v1/sms/verify-code` with arbitrary `code` (including `"000000"`) and the server returns `{ verified: true }`. Signup, password-reset, and any other consumer of this endpoint that uses the response as proof of possession is impersonable.

The file's own docblock (lines 266-282) and the controller's docblock (`sms.controller.ts:45-56`) explicitly call out that `verifyCode` is "NOT a standalone authentication primitive" and that downstream consumers "MUST correlate the verify response with the session/state that initiated `/send-code`." That correlation does not exist today — `signup-sms.spec.ts` drives the real end-to-end signup flow against this very endpoint.

The phone-axis counter (10/900s) bounds enumeration but does not prevent exploitation against a single known-verified phone: an attacker only needs 1 request. The 10-minute flag TTL is the actual attack window.

**Fix:**
Two options; the current TODO favours (B).

A. Short-term mitigation (deploy before exposing signup to untrusted clients): remove the short-circuit entirely and require the Lua script to be evaluated every time. Idempotent re-verify then returns `EXPIRED` (the OTP was DEL'd on success), which downstream callers must treat as "already verified" via a separate explicit check OR by re-sending. This costs UX on the double-submit case but closes the impersonation window.

B. Long-term (the documented plan): replace the phone-global `sms:verified:{e164}` flag with a server-issued opaque token bound at verify-time. Return the token from the initial verify response. Signup/password-reset endpoints must accept the token instead of raw `{ phone, verified: true }`. Store server-side as `sms:vtoken:{opaqueToken}` → `{e164, issuedAt}` with matching TTL; invalidate on consumption.

```typescript
// Option B sketch (sms.service.ts)
async verifyCode(phone, code): Promise<VerifyResult> {
  // ... rate limit + Lua eval as today ...
  if (status === 'VERIFIED') {
    const token = randomUUID();
    await this.redis.set(
      `sms:vtoken:${token}`,
      JSON.stringify({ e164, issuedAt: Date.now() }),
      'EX', VERIFIED_FLAG_TTL_SEC,
    );
    return { verified: true, verificationToken: token };
  }
  // remove sms:verified flag branch entirely
}
```

Track the mitigation under WR-02 follow-up before Phase 10 is allowed to serve non-mock Infobip traffic.

## Warnings

### WR-01: Pipeline result-entry destructuring crashes if any entry is null

**File:** `apps/api/src/modules/sms/sms.service.ts:222`
**Issue:**
`results.some(([opErr]) => opErr)` assumes every element of `results` is a `[Error | null, unknown]` tuple. `ioredis`'s documented return type for `pipeline.exec()` is `Array<[Error | null, unknown]> | null`. In practice individual entries are always tuples, but the TS type `Array<[...] | null>` (observed in older `@types/ioredis` and defensive code elsewhere in the repo) allows `null` per-entry. If Valkey ever returned `null` for a single op (e.g., connection reset mid-pipeline), destructuring would throw a `TypeError: Cannot destructure property '0' of null` inside `.some`, skipping the intended "pipeline failed → don't send SMS" guard and instead falling into the catch block that reports the destructuring error to Sentry. The OTP state at that moment is undefined (the SET may or may not have landed), but `sendSms` is still guarded by the throw — so the user impact is limited to a confusing Sentry trace.

**Fix:**
```typescript
if (!results || results.some((r) => !r || r[0])) {
  throw new Error('Failed to store OTP / reset attempts in Valkey');
}
```

### WR-02: Silent rollback failures lose counter/cooldown reconciliation signal

**File:** `apps/api/src/modules/sms/sms.service.ts:240-246`
**Issue:**
On 5xx/network rollback, both `redis.del(cooldownKey)` and `redis.decr('sms:phone:send:{e164}')` are wrapped with `.catch(() => { /* best effort */ })`. If either call fails (Valkey degraded, network blip), the user is stuck in the 30s cooldown despite Infobip failing, OR retains the phone-axis slot despite the rollback intent. No log is emitted, so ops cannot detect the stuck-quota state in Sentry/logs. The existing Sentry capture a few lines later only records the original Infobip error, not the rollback outcomes.

**Fix:**
```typescript
const rollbackResults = await Promise.allSettled([
  this.redis.del(cooldownKey),
  this.redis.decr(`sms:phone:send:${e164}`),
]);
rollbackResults.forEach((r, i) => {
  if (r.status === 'rejected') {
    this.logger.warn({
      event: 'sms.rollback_failed',
      phone: e164,
      op: i === 0 ? 'cooldown_del' : 'counter_decr',
      err: (r.reason as Error).message,
    });
  }
});
```

### WR-03: Sender masking leaks full value when `INFOBIP_SENDER.length === 3`

**File:** `apps/api/src/modules/sms/sms.service.ts:121`
**Issue:**
`sender.length <= 3 ? sender : \`${sender.slice(0, 2)}***\``. When a misconfigured sender is exactly 1-3 chars (e.g., `'abc'`, `'12'`), the error message contains the full value. The error is thrown at boot and goes into Cloud Run stdout logs → Cloud Logging → potentially long-lived retention. Spec test `'[WR-03] production에서 INFOBIP_SENDER가 4자리 미만의 숫자이면 throw'` (line 146-156) uses `'123'` but does not assert on masking for this branch, so regression is not caught.

This is low-severity in practice because a 1-3 char sender rarely encodes a secret (sender IDs are tenant-facing). But the stated intent in the comment ("로그 유출 방지") is not enforced for the shortest case. Given KISA numeric senders are ≥ 4 chars, a length-3 sender is always invalid input — masking it uniformly costs nothing.

**Fix:**
```typescript
// Always mask to the first 2 chars + ***. For values shorter than 2 chars,
// emit only '***' since the prefix would be the entire value.
const masked = sender.length <= 2 ? '***' : `${sender.slice(0, 2)}***`;
```

Add a regression test covering the 3-char case.

### WR-04: Phone-axis verify counter is not decremented on Valkey eval failure

**File:** `apps/api/src/modules/sms/sms.service.ts:300-311, 357-367`
**Issue:**
`verifyCode` increments `sms:phone:verify:{e164}` via `atomicIncr` before calling the Lua script. If `redis.eval(VERIFY_AND_INCREMENT_LUA, ...)` throws (Valkey transient error, network blip), the catch block at line 357-367 logs to Sentry and returns `{ verified: false, message: '인증번호 확인에 실패했습니다...' }`. The counter remains incremented. Each such failure burns one of the user's 10/15min verify attempts without producing any verification outcome.

Compare with `sendVerificationCode` which at least decrements the phone send counter on network-class errors (line 237-246). The verify path should mirror this.

**Fix:**
```typescript
} catch (err) {
  if (err instanceof GoneException) throw err;
  // Transient Valkey failure: release the verify slot — the user never
  // got a verification outcome.
  await this.redis.decr(`sms:phone:verify:${e164}`).catch((rollbackErr) => {
    this.logger.warn({
      event: 'sms.rollback_failed',
      phone: e164,
      op: 'verify_counter_decr',
      err: (rollbackErr as Error).message,
    });
  });
  // ... existing Sentry capture + return ...
}
```

### WR-05: `00` prefix unconditionally rewritten to `+` misparses non-intl KR sequences

**File:** `apps/api/src/modules/sms/phone.util.ts:28-31`
**Issue:**
```typescript
const withPlus = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
```
This rewrites any input starting with two zeros. The KR local fast-path regex `^01[016789]\d{7,8}$` runs AFTER this rewrite, so legitimate KR locals are unaffected (they start with `01`). However, inputs like:
- `"0082 10-1234-5678"` (rare but valid intl-prefixed KR input) → `"+8210..."` parsed fine (OK).
- `"00 (random garbage)"` → `"+(garbage)"` → likely ParseError. Fine.
- `"007 anything"` (KR intl-call prefix `00700`) → rewritten to `+7...` (Russia). Then `parsePhoneNumberWithError` may accept a Russian shape.

In practice, Zod validation in `sms.controller.ts` (`^(01[016789]\d{7,8}|\+[1-9]\d{6,14})$`) rejects any input that didn't already match KR local or E.164 format at the controller layer — so this utility is only reached with pre-validated input. However, `phone.util.ts` is exported and could be called from other call sites in the future, and its unit tests only cover the happy-path `"0086..."` case. Without regex re-validation, a typo or future misuse is silent.

**Fix:**
Restrict the `00` rewrite to patterns that plausibly represent international dialing prefixes (country code 1-3 digits, followed by subscriber number of plausible length), OR call `isValidPhoneNumber` on the parsed result:

```typescript
try {
  const toParse = digits.startsWith('+') ? digits : `+${digits}`;
  const parsed = parsePhoneNumberWithError(toParse);
  if (!parsed.isValid()) {
    throw new Error('올바른 휴대폰 번호를 입력해주세요');
  }
  return parsed.number;
} catch (err: unknown) {
  if (err instanceof ParseError) {
    throw new Error('올바른 휴대폰 번호를 입력해주세요');
  }
  throw err;
}
```

Add spec coverage for `"00700..."` and other KR intl-prefix patterns that must be rejected (or explicitly supported).

## Info

### IN-01: `app.module.spec.ts` asserts on source-file string patterns, not runtime behavior

**File:** `apps/api/src/app.module.spec.ts:16-86`
**Issue:**
Every test reads `app.module.ts` as a string and runs regex against the source text. Renaming `isRealRedis`, swapping `typeof redis.incr === 'function'` for an equivalent check, or reformatting the `60_000` literal to `60000` breaks the tests despite the behavior being identical. This is effectively a lint rule disguised as a test and does not exercise the TypeScript runtime.

Additionally, lines 2-5 import `ThrottlerModule`, `ThrottlerGuard`, `APP_GUARD`, and `AppModule` — none of these symbols are used; only the source string is inspected. Unused imports.

**Fix:**
Convert to behavioral tests that build a `TestingModule` with a `ThrottlerModule` factory and inject a fake `REDIS_CLIENT` provider (one without `incr`, one with). Assert that `Reflect.getMetadata('throttler:options', module.get(ThrottlerGuard))` carries the expected `{ storage?, throttlers: [{...ttl: 60_000, limit: 60}] }` shape. Remove the unused imports, or drop the source-pattern assertions entirely if the integration test at `apps/api/test/sms-throttle.integration.spec.ts` already covers the Valkey path.

### IN-02: Integration test description says "phone axis" but exercises IP axis

**File:** `apps/api/test/sms-throttle.integration.spec.ts:125-147`
**Issue:**
The `it(...)` name reads "phone axis: 동일 phone + 서로 다른 IP axis는 @Throttle default로 동일 IP에서 test". The actual test loops 20 requests with the same phone payload from the same in-process supertest client (same IP) and asserts 429 on the 21st. This is a pure IP-axis test and the inline comment correctly points out "Phone-axis throttling (5/3600s) is done in SmsService via Lua script." The `it` description is misleading and would confuse a future engineer skimming test names.

**Fix:**
Rename to something like `IP axis: 동일 IP 21번째 요청에서 429` and delete the "phone axis"-prefixed copy entirely.

### IN-03: `vi.mock('node:crypto', ...)` is a passthrough no-op

**File:** `apps/api/src/modules/sms/sms.service.spec.ts:16-19`
**Issue:**
```typescript
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: actual.randomInt };
});
```
This re-exports every binding from the actual module unchanged. It exists solely to make `vi.spyOn(nodeCrypto, 'randomInt')` work on ESM (Vite transforms ESM bindings into read-only live bindings unless a mock intercepts). Once the reason is understood, the code is correct but easy to delete accidentally. Consider adding a one-line comment explaining the ESM-spyOn rationale, or dropping the mock if `vi.mock({ spy: true })` mode is in use.

### IN-04: Wasteful setInterval tear-down/setup every tick

**File:** `apps/web/components/auth/phone-verification.tsx:67-101`
**Issue:**
Both `useEffect`s for `timeLeft` (line 67-84) and `resendCooldown` (line 87-101) list the countdown value itself as a dependency. Each state update inside the interval triggers a re-render, which runs cleanup (clearInterval) and immediately re-creates a new interval. Over a 180s OTP window this is ~180 `setInterval`/`clearInterval` pairs for the expiry timer plus ~30 for the cooldown. Functionally correct but wasteful and makes the effect dependency graph harder to reason about.

**Fix:**
Switch to a single `useEffect` that starts the interval once when the timer starts and uses a functional state update + ref-guarded condition to stop when the counter hits 0:

```typescript
useEffect(() => {
  if (timeLeft === 0) return;
  const id = setInterval(() => {
    setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
  }, 1000);
  return () => clearInterval(id);
}, [codeSent]); // start only on new send, not on each tick
```

Apply the same pattern to `resendCooldown`.

### IN-05: Unused imports across test/source files

**File:** `apps/api/src/app.module.spec.ts:2-5`
**Issue:**
`Test` from `@nestjs/testing`, `ThrottlerModule`, `ThrottlerGuard` from `@nestjs/throttler`, `APP_GUARD` from `@nestjs/core`, and `AppModule` from `./app.module.js` are all imported but never referenced — every test inspects the file as a string via `fs/promises`.

**Fix:**
Delete the unused imports. If you keep the source-string tests per IN-01, the only needed imports are `describe`, `it`, `expect` from `vitest`.

### IN-06: Infobip client error body propagates into `Error.message` → Sentry

**File:** `apps/api/src/modules/sms/infobip-client.ts:12`
**Issue:**
`super(\`Infobip API ${status}: ${body}\`)` — the raw response body is concatenated into the Error message. `sms.service.ts` later does `Sentry.captureException(err)` which captures `err.message` verbatim. If Infobip error bodies include account identifiers, customer phone numbers, or the sender ID at some point in the future, those land in Sentry events. Sentry's PII scrubbing does not cover free-form error messages by default.

Today the body is opaque to the user, so this is Info-level. But it's worth being deliberate about: either truncate to a length budget (e.g., 256 chars) and strip digit runs ≥ 8 (potential phone numbers), or store the body in a separate field and reference it from `scope.setExtra('body', err.body)` with Sentry PII scrubbing configured.

**Fix:**
```typescript
export class InfobipApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Infobip API ${status}`); // no body in the message
    this.name = 'InfobipApiError';
  }
}
// and in sms.service.ts:
Sentry.withScope((scope) => {
  if (err instanceof InfobipApiError) {
    scope.setExtra('infobip_body', err.body.slice(0, 256));
  }
  // ...
});
```

### IN-07: `InfobipClient.sendSms` does not null-check JSON body

**File:** `apps/api/src/modules/sms/infobip-client.ts:56-72`
**Issue:**
```typescript
const data = (await res.json()) as { messages?: Array<...> };
const msg = data.messages?.[0];
```
If Infobip returns a bare `null` body (RFC 7159 allows this for 2xx responses), `data` is `null` and `data.messages` throws `TypeError: Cannot read properties of null (reading 'messages')` BEFORE the `undefined` check runs. The user sees a 500 instead of the intended `InfobipApiError(500, 'missing messages[0].messageId')`.

**Fix:**
```typescript
const data = (await res.json().catch(() => null)) as
  | { messages?: Array<...> }
  | null;
const msg = data?.messages?.[0];
if (!msg || !msg.messageId) {
  throw new InfobipApiError(500, 'Infobip response missing messages[0].messageId');
}
```

### IN-08: `infobip-verify-response.json` retained as a tombstone

**File:** `apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json`
**Issue:**
The file contains only `{"_deprecated": "...retained to avoid broken imports during transition; remove after all spec imports are cleaned."}`. A grep across `apps/api/src/modules/sms` shows no remaining imports of the fixture. Leaving the tombstone adds noise and risks a future developer resurrecting it without realizing it's meaningless.

**Fix:**
Delete the file in the next cleanup commit. Confirm no imports remain via `grep -r infobip-verify-response`.

### IN-09: `SmsModule` imports `BookingModule` purely for `REDIS_CLIENT` re-export

**File:** `apps/api/src/modules/sms/sms.module.ts:7`
**Issue:**
```typescript
imports: [BookingModule],  // REDIS_CLIENT re-export를 통해 SmsService에 주입 가능
```
Two unrelated modules (SMS and Booking) are coupled only because `REDIS_CLIENT` is defined inside the booking tree. The same coupling repeats in `app.module.ts:33` where `ThrottlerModule.forRootAsync` imports `BookingModule` to inject Redis. If booking-side refactors ever make `BookingModule` heavier (more providers, circular DI), SMS cold-start and test-boot cost inherits it.

**Fix (non-urgent):**
Extract the Redis provider into a standalone `RedisModule` (e.g., `apps/api/src/database/redis.module.ts` or similar), export `REDIS_CLIENT`, and import that module from both `BookingModule` and `SmsModule`. The `app.module.ts` Throttler factory likewise imports `RedisModule` directly. Breaks the SMS → Booking architectural dependency entirely.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
