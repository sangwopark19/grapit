# Phase 18 HUMAN-UAT -- Password reset production API origin fix

**Created:** 2026-04-29 (KST)
**Goal:** Production password reset request -> email -> confirm submit -> login smoke proves the public API origin fix from Phase 18 Plan 01.
**Scope:** `https://heygrabit.com/auth/reset-password`, `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`, and `https://heygrabit.com/auth`.

---

## Pre-conditions

**Environment contract:**

- [ ] Local development may use relative `/api` URLs and dev-only `localhost:8080` Next rewrites.
- [ ] Preview and production must set `NEXT_PUBLIC_API_URL` to their public API origin.
- [ ] Production expected value: `https://api.heygrabit.com`.
- [ ] The deployed production web build must be from a revision that includes Phase 18 Plan 01.
- [ ] The deployed production API revision must include the Phase 15 email cutover state.

**Production account readiness:**

- [ ] UAT must use a known password-based production account.
- [ ] Do not use a social-only account because enumeration defense suppresses email sending for users without `passwordHash`.
- [ ] Prefer an existing password-based production account.
- [ ] If no known password-based account exists, create one through https://heygrabit.com/auth before UAT.
- [ ] Verify readiness by logging in once before reset.
- [ ] Record only the account email domain in this artifact.

**Known final email state from Phase 15:**

- [ ] Resend domain `heygrabit.com` verified.
- [ ] Email From expected value: `no-reply@heygrabit.com`.
- [ ] Email subject expected value: `[Grabit] 비밀번호 재설정`.

---

## Automated Gate

Record automated regression commands here. Keep output summaries short; do not paste large logs.

### Fast focused smoke

- [x] command: `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx`
- [x] timestamp (UTC): 2026-04-29T05:18:27Z
- [x] exit code: 0
- [x] summary: Vitest completed green; 26 files / 180 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

### Full Phase 18 regression gate

- [x] command: `pnpm --filter @grabit/web typecheck`
- [x] timestamp (UTC): 2026-04-29T05:18:42Z
- [x] exit code: 0
- [x] summary: `tsc --noEmit` completed with no type errors.

- [x] command: `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts lib/__tests__/next-config.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx`
- [x] timestamp (UTC): 2026-04-29T05:18:49Z
- [x] exit code: 0
- [x] summary: Vitest completed green; 26 files / 180 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

- [x] command: `pnpm --filter @grabit/web test`
- [x] timestamp (UTC): 2026-04-29T05:18:56Z
- [x] exit code: 0
- [x] summary: Full web Vitest suite completed green; 26 files / 180 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

- [x] command: `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts`
- [x] timestamp (UTC): 2026-04-29T05:19:03Z
- [x] exit code: 0
- [x] summary: API Vitest command completed green; 29 files / 323 tests passed. Expected mocked warning/error logs appeared from auth, email, SMS, upload, cache, and Redis adapter suites.

### Deploy workflow contract

- [x] `.github/workflows/deploy.yml` contains build arg `--build-arg NEXT_PUBLIC_API_URL=${{ vars.CLOUD_RUN_API_URL }}`.
- [x] `.github/workflows/deploy.yml` contains fail-fast step `Validate production public API URL`.
- [x] `.github/workflows/deploy.yml` contains failure copy `CLOUD_RUN_API_URL must be set for web production build`.

---

## Deployment Revision Evidence

Pin the exact Cloud Run revisions or image identifiers that served the production smoke before marking SC-4 PASS.

**Commands:**

```bash
gcloud run services describe grabit-web --region=asia-northeast3 --project=grapit-491806 --format='value(status.latestReadyRevisionName)'
gcloud run services describe grabit-api --region=asia-northeast3 --project=grapit-491806 --format='value(status.latestReadyRevisionName)'
gcloud run revisions describe <WEB_REVISION> --region=asia-northeast3 --project=grapit-491806 --format='value(status.imageDigest)'
gcloud run revisions describe <API_REVISION> --region=asia-northeast3 --project=grapit-491806 --format='value(status.imageDigest)'
```

If `status.imageDigest` is unavailable, record the service image string from `spec.template.spec.containers[0].image` and the Git SHA tag instead.

**Fields:**

- [ ] UAT timestamp (UTC): __________
- [ ] account domain only: __________
- [ ] grabit-web latestReadyRevisionName: __________
- [ ] grabit-web image digest or Git SHA tag: __________
- [ ] grabit-api latestReadyRevisionName: __________
- [ ] grabit-api image digest or Git SHA tag: __________

---

## SC-1: Production password reset email request

**Steps:**

1. Confirm the account is password-based by logging in once before reset.
2. Visit `https://heygrabit.com/auth/reset-password`.
3. Request a reset email for the known production account.
4. Check the mailbox without copying any reset link into this file.

**Evidence fields:**

- [ ] SC-1 result: PENDING
- [ ] account domain only: __________
- [ ] email From: `no-reply@heygrabit.com`
- [ ] email subject: `[Grabit] 비밀번호 재설정`
- [ ] inbox not spam result: __________
- [ ] receipt timestamp (UTC): __________
- [ ] notes without PII: __________

---

## SC-2: Confirm submit public API origin evidence

**Steps:**

1. Open the reset email link in the browser.
2. Submit the confirm form.
3. In browser Network evidence, verify the confirm request host is the public API origin.

**Evidence fields:**

- [ ] SC-2 result: PENDING
- [ ] confirm POST URL: `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`
- [ ] confirm POST status: `200`
- [ ] browser Network evidence checked: __________
- [ ] notes without reset link data: __________

---

## SC-3: Login success after password change

**Steps:**

1. Visit `https://heygrabit.com/auth`.
2. Log in with the updated credential entered only in the browser.
3. Confirm authenticated UI/session success.

**Evidence fields:**

- [ ] SC-3 result: PENDING
- [ ] login success: __________
- [ ] login timestamp (UTC): __________
- [ ] notes without PII: __________

---

## SC-4: Cloud Run and Sentry observation

**Cloud Logging check:**

- [ ] revision-scoped Cloud Logging notes: __________
- [ ] `Resend send failed` result after UAT timestamp: __________
- [ ] expected result text when clean: `Resend send failed: empty`

**Sentry evidence:**

Use one of these exact statements only after dashboard or API inspection actually confirms it:

- [ ] `Sentry component:email-service recent 24h count: 0 after UAT`
- [ ] `Sentry component:email-service captured event id: <redacted-id>`

**SC-4 fields:**

- [ ] SC-4 result: PENDING
- [ ] Cloud Run evidence tied to grabit-web latestReadyRevisionName: __________
- [ ] Cloud Run evidence tied to grabit-api latestReadyRevisionName: __________
- [ ] image digest or Git SHA tag evidence recorded: __________
- [ ] Sentry component:email-service evidence recorded: __________

---

## PII and Token Redaction Rules

Reset tokens MUST NOT be recorded.

Do not record full email addresses except the allowed sender `no-reply@heygrabit.com`. Do not record reset tokens, reset-link or screenshot URLs containing token query parameters, raw Resend API keys, authorization headers, bearer token values, JWTs, cookies, raw passwords, or secret values.

Allowed evidence:

- Account email domain only, such as a mailbox provider domain.
- Email From value `no-reply@heygrabit.com`.
- Subject `[Grabit] 비밀번호 재설정`.
- Public confirm endpoint `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`.
- HTTP status code and pass/fail notes without PII.
- Cloud Run revision names and image digest or Git SHA tag.
- Sentry zero-count statement or redacted event id.

---

## Sign-off

- [ ] SC-1 PASS: Production password reset email request verified.
- [ ] SC-2 PASS: Confirm submit used public API origin and returned status 200.
- [ ] SC-3 PASS: Login succeeded after password change.
- [ ] SC-4 PASS: Cloud Run revision/image evidence and Sentry email observation recorded.
- [ ] Redaction review complete.
- [ ] Operator initials: __________
- [ ] Completed date (KST): __________
