---
phase: 15-resend-heygrabit-com-cutover-transactional-email-secret-mana
reviewed: 2026-04-27T06:39:50Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - apps/api/src/modules/auth/email/email.service.ts
  - apps/api/src/modules/auth/email/email.service.spec.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-27T06:39:50Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 15 cuts EmailService over to Resend with the heygrabit.com sender domain and hardens production secret handling. The implementation is solid for the focus areas:

- **Sentry capture** uses `withScope` correctly to attach component/provider tags + a redacted email context, then captures a freshly constructed `Error` so the stack trace is preserved (Resend's `error` is a plain `{ message }` object, not an `Error`).
- **Error handling** correctly avoids the `try/catch` anti-pattern (Resend SDK returns `{ data, error }` and does not throw) and propagates failure to callers via a typed result rather than throwing.
- **Secret hygiene** is good: the API key is read once from `ConfigService`, never logged. Production hard-fails on missing `RESEND_API_KEY` and on missing/invalid `RESEND_FROM_EMAIL`, preventing silent fallback to the dev sender.
- **PII discipline** is enforced — only the recipient *domain* is sent to Sentry, not the full address. The test suite explicitly asserts the absence of the full address in the serialized scope payload.
- **Test coverage** of the Sentry error branch is thorough: separate cases verify return shape, `Error`-instance wrapping of `error.message`, scope tag/level/context content, and PII redaction.

The findings below are limited to one warning about retry/idempotency semantics around transient Resend failures, plus a few info-level cleanups. Nothing blocks the cutover.

## Warnings

### WR-01: No retry on transient Resend failures; caller-side swallow makes single-attempt failures permanent

**File:** `apps/api/src/modules/auth/email/email.service.ts:71-92`
**Issue:** `sendPasswordResetEmail` makes exactly one call to `this.resend!.emails.send(...)`. The inline comment at line 80 notes that `auth.service` intentionally swallows the result for enumeration defense, which means a single transient Resend failure (rate limit, 5xx, network blip) results in a permanently undelivered password reset — the user sees the generic "이메일을 보냈습니다" response and never receives a link. Retry is the standard mitigation for this exact class of failure (Resend explicitly recommends retrying on `rate_limit_exceeded` and 5xx). The Sentry capture gives ops visibility but does not recover the user.

Note: this is not a bug introduced by Phase 15 — the single-attempt pattern predates this phase and the inline rationale documents the auth-service swallow. Flagging as a warning so the team can decide whether retry belongs in this phase or a follow-up.

**Fix:**
```ts
// Option A (lightweight, in-process): bounded exponential backoff for transient errors only.
const MAX_ATTEMPTS = 3;
const RETRYABLE = (msg: string) =>
  /rate.?limit|timeout|temporar|5\d\d|ECONN|ETIMEDOUT/i.test(msg);

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const { data, error } = await this.resend!.emails.send({ /* ... */ });
  if (!error) return { success: true, id: data?.id };
  if (attempt === MAX_ATTEMPTS || !RETRYABLE(error.message)) {
    // existing Sentry capture + return path
    // ...
    return { success: false, error: error.message };
  }
  await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
}

// Option B (preferred long-term): enqueue via pg-boss with retry policy
// — matches the project's documented job-queue stack and survives process death.
```

## Info

### IN-01: `this.resend!` non-null assertion duplicates a check already encoded in `isDevMode`

**File:** `apps/api/src/modules/auth/email/email.service.ts:71`
**Issue:** `this.resend` is typed `Resend | null` and the early `isDevMode` guard at line 64 already guarantees `this.resend !== null` on the path that reaches line 71, but the code uses the `!` non-null assertion. Non-null assertions are flagged by `@typescript-eslint/no-non-null-assertion` and the project's "strict typing everywhere — no any" stance prefers narrowing.
**Fix:**
```ts
// Replace the boolean isDevMode flag with a narrowing guard:
async sendPasswordResetEmail(to: string, resetLink: string): Promise<SendEmailResult> {
  if (this.resend === null) {
    this.logger.log(`DEV EMAIL: password reset link for ${to}: ${resetLink}`);
    return { success: true };
  }
  const { data, error } = await this.resend.emails.send({ /* ... */ });
  // ...
}
```
This removes the `!` and removes the `isDevMode` field entirely (the `null` channel already encodes the same state).

### IN-02: Reset link logged in plaintext in dev mode — fine for dev, but worth a comment

**File:** `apps/api/src/modules/auth/email/email.service.ts:65`
**Issue:** `this.logger.log(\`DEV EMAIL: password reset link for ${to}: ${resetLink}\`)` writes a working reset token to stdout. This is intentional for local dev (the token is the whole point of the dev mock), but if `NODE_ENV` is ever misset to anything other than `'production'` in a shared environment (staging, preview, CI with real users), tokens land in shared logs.

The constructor's hard-fail at line 31 (`isProd && !apiKey`) already prevents this in true production, but `isProd` is strictly `nodeEnv === 'production'`. A staging environment with `NODE_ENV=staging` would bypass both the hard-fail and end up in dev mode.
**Fix:** Either tighten the production check to "anything except `development` and `test` requires the key", or add an explicit comment on line 65 documenting that this log is only safe because the constructor hard-fails for any non-development environment that lacks the key. Recommend the former:
```ts
const isNonDev = nodeEnv !== 'development' && nodeEnv !== 'test';
if (isNonDev && !apiKey) { throw new Error(/* ... */); }
```

### IN-03: Test file mutates `process.env` snapshot but never reads it; cleanup is dead code

**File:** `apps/api/src/modules/auth/email/email.service.spec.ts:48,63-65`
**Issue:** `const originalEnv = { ...process.env }` is captured at line 48 and restored in `afterEach` at lines 63-65, but no test in the file mutates `process.env` — every test injects config via the `makeConfig` helper which constructs a `ConfigService` mock. The snapshot/restore is dead code.
**Fix:** Remove lines 48 and 63-65. If a future test does need to mutate `process.env`, reintroduce the pattern next to that test using `vi.stubEnv` (Vitest's idiomatic API, which auto-restores via `vi.unstubAllEnvs()` in afterEach).

---

_Reviewed: 2026-04-27T06:39:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
