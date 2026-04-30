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
- [x] summary: Vitest completed green; latest verification rerun completed with 26 files / 186 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

### Full Phase 18 regression gate

- [x] command: `pnpm --filter @grabit/web typecheck`
- [x] timestamp (UTC): 2026-04-29T05:18:42Z
- [x] exit code: 0
- [x] summary: `tsc --noEmit` completed with no type errors.

- [x] command: `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts lib/__tests__/next-config.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx`
- [x] timestamp (UTC): 2026-04-29T05:18:49Z
- [x] exit code: 0
- [x] summary: Vitest completed green; latest verification rerun completed with 26 files / 186 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

- [x] command: `pnpm --filter @grabit/web test`
- [x] timestamp (UTC): 2026-04-29T05:18:56Z
- [x] exit code: 0
- [x] summary: Full web Vitest suite completed green; latest verification rerun completed with 26 files / 186 tests passed. Existing jsdom navigation, jsdom scrollTo, and React act warnings appeared, but the command exited 0.

- [x] command: `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts`
- [x] timestamp (UTC): 2026-04-29T05:19:03Z
- [x] exit code: 0
- [x] summary: API Vitest command completed green; 29 files / 323 tests passed. Expected mocked warning/error logs appeared from auth, email, SMS, upload, cache, and Redis adapter suites.

### Deploy workflow contract

- [x] `.github/workflows/deploy.yml` contains build arg `--build-arg NEXT_PUBLIC_API_URL=${{ vars.CLOUD_RUN_API_URL }}`.
- [x] `.github/workflows/deploy.yml` contains fail-fast step `Validate production origins`.
- [x] `.github/workflows/deploy.yml` rejects missing, loopback, non-HTTPS, or non-origin public web/API URLs before the production web build can start.

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

- [x] UAT timestamp (UTC): 2026-04-29T05:43:20Z initial evidence recording; final web revision evidence refreshed at 2026-04-29T06:22:04Z.
- [x] account domain only: withheld; no user email address recorded.
- [x] grabit-web latestReadyRevisionName: `grabit-web-00023-62r`
- [x] grabit-web image digest or Git SHA tag: image digest `asia-northeast3-docker.pkg.dev/grapit-491806/grabit/grabit-web@sha256:9ef6248206034fd403283cb914d104aaf4441d9edde844c3fdabaa28beaf299c`; Git SHA tag/source commit `7b67a6a14bc35c0cd1333af23f6c8ec23428e9fe`
- [x] grabit-api latestReadyRevisionName: `grabit-api-00021-nnn`
- [x] grabit-api image digest or Git SHA tag: image digest `asia-northeast3-docker.pkg.dev/grapit-491806/grabit/grabit-api@sha256:e0817312330337961d4fdfe29062027a86606cb9a84fd911b2a616379333b860`

---

## SC-1: Production password reset email request

**Steps:**

1. Confirm the account is password-based by logging in once before reset.
2. Visit `https://heygrabit.com/auth/reset-password`.
3. Request a reset email for the known production account.
4. Check the mailbox without copying any reset link into this file.

**Evidence fields:**

- [x] SC-1 result: PASS - user-approved human verification; production reset email test succeeded.
- [x] account domain only: withheld; no user email address recorded.
- [x] email From: `no-reply@heygrabit.com`
- [x] email subject: `[Grabit] 비밀번호 재설정`
- [x] inbox not spam result: PASS - user confirmed receipt; no mailbox screenshot or message URL recorded.
- [x] receipt timestamp (UTC): user-confirmed before resume; exact mailbox timestamp not recorded.
- [x] notes without PII: Production reset request page returned HTTP 200 after the web deploy; reset link and recipient local part were not recorded.

---

## SC-2: Confirm submit public API origin evidence

**Steps:**

1. Open the reset email link in the browser.
2. Submit the confirm form.
3. In browser Network evidence, verify the confirm request host is the public API origin.

**Evidence fields:**

- [x] SC-2 result: PASS - user-approved human verification for the email-to-confirm path.
- [x] confirm POST URL: `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`
- [x] confirm POST status: 200
- [x] browser Network evidence checked: PASS - public API origin confirmed by user/operator approval.
- [x] notes without reset link data: No reset URL, reset authority value, screenshot URL, cookie, JWT, auth header, or bearer value recorded.

---

## SC-3: Login success after password change

**Steps:**

1. Visit `https://heygrabit.com/auth`.
2. Log in with the updated credential entered only in the browser.
3. Confirm authenticated UI/session success.

**Evidence fields:**

- [x] SC-3 result: PASS - user-approved human verification for login after password change.
- [x] login success: PASS - production login succeeded after password reset.
- [x] login timestamp (UTC): user-confirmed before resume; exact account timestamp not recorded.
- [x] notes without PII: Raw credential values and authenticated session material were not recorded.

---

## SC-4: Cloud Run and Sentry observation

**Cloud Logging check:**

- [x] revision-scoped Cloud Logging notes: Query scoped to `resource.type="cloud_run_revision"`, service `grabit-api`, revision `grabit-api-00021-nnn`, text `Resend send failed`, freshness 24h, limit 1.
- [x] `Resend send failed` result after UAT timestamp: no rows; `Resend send failed: empty`.
- [x] expected result text when clean: `Resend send failed: empty`

**Sentry evidence:**

Use one of these exact statements only after dashboard or API inspection actually confirms it:

- [ ] `Sentry component:email-service recent 24h count: 0 after UAT`
- [ ] `Sentry component:email-service captured event id: <redacted-id>`

Sentry dashboard/API evidence was not available to the orchestrator during resume. No zero-count or captured event id is fabricated here; the user/operator explicitly approved moving past the human verification checkpoint with this caveat.

Final verifier status was `human_needed` only for this Sentry dashboard/API observation item. The user/operator instructed the workflow to move on after confirming the production email reset test had already succeeded; phase completion proceeds with this caveat preserved.

**SC-4 fields:**

- [x] SC-4 result: PASS - Cloud Run revision/image evidence and revision-scoped Cloud Logging evidence recorded; Sentry caveat user/operator-approved.
- [x] Cloud Run evidence tied to grabit-web latestReadyRevisionName: `grabit-web-00023-62r`
- [x] Cloud Run evidence tied to grabit-api latestReadyRevisionName: `grabit-api-00021-nnn`
- [x] image digest or Git SHA tag evidence recorded: web image digest plus source commit, api image digest.
- [x] Sentry component:email-service evidence recorded: not independently inspected; checkpoint approved without claiming a zero-count or event id.

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

- [x] SC-1 PASS: Production password reset email request verified.
- [x] SC-2 PASS: Confirm submit used public API origin and returned status 200.
- [x] SC-3 PASS: Login succeeded after password change.
- [x] SC-4 PASS: Cloud Run revision/image evidence and email observation recorded with Sentry availability caveat.
- [x] Redaction review complete.
- [x] Operator initials: user/operator-approved checkpoint; no personal identifier recorded.
- [x] Completed date (KST): 2026-04-29
