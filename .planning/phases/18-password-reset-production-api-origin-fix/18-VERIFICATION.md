---
phase: 18-password-reset-production-api-origin-fix
verified: 2026-04-29T06:32:43Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sentry email-service observation"
    expected: "Record either `Sentry component:email-service recent 24h count: 0 after UAT` or a redacted captured event id after dashboard/API inspection."
    why_human: "Sentry dashboard/API was not independently inspected; current UAT records an explicit caveat instead of zero-count or event-id evidence."
---

# Phase 18: Password Reset Production API Origin Fix Verification Report

**Phase Goal:** password reset email -> confirm flow가 production Cloud Run에서도 `localhost:8080` rewrite에 의존하지 않고 올바른 API origin으로 submit되어 DEBT-01과 CUTOVER flow break를 해소한다.
**Verified:** 2026-04-29T06:32:43Z
**Status:** human_needed
**Re-verification:** Yes - artifact-only re-check after UAT wording/count update

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | password reset confirm submit이 production web에서 public API origin을 사용하고 `/api` rewrite가 `localhost:8080`으로 새지 않는다. | VERIFIED | `reset-password/page.tsx:176` uses `fetch(apiUrl('/api/v1/auth/password-reset/confirm'))`; `api-url.ts:16-52` joins configured origin and rejects bad production origins; `next.config.ts:35-38` returns `[]` in production. |
| 2 | local dev, preview, production 환경별 API base URL contract가 문서화되고 regression test로 고정된다. | VERIFIED | `api-url.test.ts:16-82` covers local relative path, `https://api.heygrabit.com`, empty production, localhost, non-HTTPS, and non-origin values; `18-HUMAN-UAT.md:13-17` records the environment contract. |
| 3 | password reset email -> confirm -> login happy path smoke/UAT evidence가 phase artifact에 남는다. | VERIFIED | `18-HUMAN-UAT.md:114-118`, `134-136`, and `152-153` record SC-1/2/3 PASS, confirm POST URL/status 200, and login success without reset link data. |
| 4 | Password reset confirm submit uses the configured public API origin when `NEXT_PUBLIC_API_URL` is set. | VERIFIED | `reset-password.test.tsx:110-149` asserts exact URL `https://api.heygrabit.com/api/v1/auth/password-reset/confirm`, method, credentials, headers, token, and password body. |
| 5 | Local dev can still use the relative `/api` path and localhost:8080 Next rewrite. | VERIFIED | `api-url.test.ts:16-22` expects relative path in development; `next.config.ts:40-49` keeps `/api/:path*` and `/socket.io/:path*` destinations at `http://localhost:8080` outside production; `next-config.test.ts:34-41` locks this. |
| 6 | Production Next rewrites never route `/api` or `/socket.io` to `localhost:8080`. | VERIFIED | `next.config.ts:35-38` returns `[]` for production; `next-config.test.ts:27-32` asserts serialized production rewrites do not contain `localhost:8080`. |
| 7 | Deploy origin guards prevent bad public origins before production web build. | VERIFIED | Actual workflow uses the review-fixed stronger gate: `.github/workflows/deploy.yml:32-59` validates `CLOUD_RUN_API_URL` and `CLOUD_RUN_WEB_URL` as trimmed HTTPS origin URLs and rejects localhost; `deploy-web` has `needs: deploy-api` at `deploy.yml:162-165`, so web build at `deploy.yml:185-194` cannot run if the origin gate fails. |
| 8 | Reset-token-specific 401 UX remains on the reset-password page instead of expired-session handling. | VERIFIED | Confirm mode uses raw `fetch`, not `apiClient.post`; `reset-password/page.tsx:189-191` sets `tokenError`; `reset-password/page.tsx:214-228` renders "유효하지 않은 링크" and "다시 요청하기"; `reset-password.test.tsx:184-213` covers this path. |
| 9 | A known password-based production user receives reset email from `no-reply@heygrabit.com` and inbox/not-spam evidence is recorded. | VERIFIED | `18-HUMAN-UAT.md:114-118` records SC-1 PASS, sender `no-reply@heygrabit.com`, subject, and inbox not spam result by user/operator approval. |
| 10 | The changed password logs in successfully on `https://heygrabit.com/auth`. | VERIFIED | `18-HUMAN-UAT.md:152-153` records SC-3 PASS and login success after password reset. |
| 11 | Production UAT evidence is tied to deployed Cloud Run revisions or image digests. | VERIFIED | `18-HUMAN-UAT.md:96-99` records final web revision `grabit-web-00023-62r`, web digest `sha256:9ef6248206034fd403283cb914d104aaf4441d9edde844c3fdabaa28beaf299c`, API revision `grabit-api-00021-nnn`, and API digest `sha256:e0817312330337961d4fdfe29062027a86606cb9a84fd911b2a616379333b860`. |
| 12 | Automated web/API regression commands pass after Plan 01. | VERIFIED | Fresh verification run: web typecheck exit 0; focused web suite exit 0 with 26 files / 186 tests; full web suite exit 0 with 26 files / 186 tests; API auth/email command exit 0 with 29 files / 323 tests. |
| 13 | UAT evidence avoids full email addresses, reset tokens, reset links, cookies, JWTs, auth headers, bearer values, raw passwords, and secrets. | VERIFIED | Redaction negative grep exited 0; full-email grep exited 0 allowing only `no-reply@heygrabit.com`; `18-HUMAN-UAT.md:188-201` states the redaction rules. |
| 14 | Sentry/email observability evidence records zero-count after UAT or a specific captured event id without PII. | UNCERTAIN | `18-HUMAN-UAT.md:171-176` leaves both Sentry evidence checkboxes unchecked, states dashboard/API evidence was not available, and explicitly preserves `human_needed`; `18-HUMAN-UAT.md:184` records "not independently inspected". Needs human Sentry inspection. |

**Score:** 13/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/lib/api-url.ts` | Shared API origin builder exporting `getApiBaseUrl` and `apiUrl` | VERIFIED | 53 lines; exports both functions; production guards cover empty, invalid URL, localhost, non-HTTPS, and non-origin values. |
| `apps/web/lib/__tests__/api-url.test.ts` | Local/preview/production API URL regression tests | VERIFIED | 83 lines; tests relative local path, configured public origin, empty production, loopback, non-HTTPS, and non-origin cases. |
| `apps/web/lib/api-client.ts` | Authenticated API client URL construction through `apiUrl` | VERIFIED | Imports `apiUrl`; refresh, primary request, and retry call `fetch(apiUrl(...))`; `ApiPath = \`/${string}\`` constrains caller paths. |
| `apps/web/lib/auth.ts` | Auth initialization URL construction through `apiUrl` | VERIFIED | Refresh and `/users/me` fetches use `apiUrl`; catch branch and initialization behavior remain intact. |
| `apps/web/components/auth/login-form.tsx` | Social redirect URL construction through `apiUrl` | VERIFIED | `handleSocialLogin` sets `window.location.href = apiUrl(...)`; email/password login remains through `apiClient.post`. |
| `apps/web/app/auth/reset-password/page.tsx` | Password reset request/confirm flow using public API origin | VERIFIED | Request mode uses raw fetch with enumeration-safe success handling; confirm mode uses raw fetch and token-specific 401 UI. |
| `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` | Exact reset confirm URL and UX regression tests | VERIFIED | 215 lines; tests absolute confirm URL, request failure success UX, latest token remount, and 401 invalid-link UX. |
| `apps/web/next.config.ts` | Production no-localhost rewrite guard | VERIFIED | Production rewrites return `[]`; development keeps localhost `/api` and `/socket.io` rewrites. |
| `apps/web/lib/__tests__/next-config.test.ts` | Rewrite regression tests | VERIFIED | 42 lines; production serialized rewrites exclude `localhost:8080`; development serialized rewrites include both destinations. |
| `.github/workflows/deploy.yml` | Deployment origin guard and public API build args | VERIFIED | Review-fixed `Validate production origins` gate validates both public origins before API deploy; web job depends on API job; web Docker build args pass `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` from `vars.CLOUD_RUN_API_URL`. |
| `.planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` | Production smoke, revision, test, and redaction evidence | WARNING | Substantive and updated. Deploy workflow wording now references `Validate production origins`; web test summaries now record 26 files / 186 tests; Sentry evidence is explicitly caveated as not independently inspected. |
| `apps/api/src/modules/auth/email/email.service.spec.ts` | CUTOVER-06 email regression evidence | VERIFIED | API auth/email test command ran green with 29 files / 323 tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `apps/web/app/auth/reset-password/page.tsx` | `apps/web/lib/api-url.ts` | Raw confirm fetch uses `apiUrl('/api/v1/auth/password-reset/confirm')` | WIRED | `reset-password/page.tsx:16` imports `apiUrl`; `reset-password/page.tsx:176` uses it in raw fetch. |
| `apps/web/lib/api-client.ts` | `apps/web/lib/api-url.ts` | Authenticated request URL construction | WIRED | `api-client.ts:2` imports `apiUrl`; `api-client.ts:35`, `82`, and `97` call `fetch(apiUrl(...))`. |
| `apps/web/lib/auth.ts` | `apps/web/lib/api-url.ts` | Session refresh and user profile fetches | WIRED | `auth.ts:1`, `7`, and `17` confirm import and use. |
| `apps/web/components/auth/login-form.tsx` | `apps/web/lib/api-url.ts` | Social login redirect construction | WIRED | `login-form.tsx:10` imports `apiUrl`; `login-form.tsx:88` sets redirect with `apiUrl`. |
| `apps/web/next.config.ts` | Production Cloud Run web runtime | `rewrites()` returns `[]` in production | WIRED | `next.config.ts:35-38`; test coverage at `next-config.test.ts:27-32`. |
| `.github/workflows/deploy.yml` | Web Docker build args | Origin gate blocks bad vars before web build can start | WIRED | `deploy.yml:32-59` validates origins; `deploy.yml:162-165` makes web deployment depend on API job; `deploy.yml:188-189` passes public API/WS build args. |
| `18-HUMAN-UAT.md` | Production mailbox | Password reset request evidence | WIRED | `18-HUMAN-UAT.md:114-118` records user-approved receipt from `no-reply@heygrabit.com`, subject, and inbox not spam. |
| `18-HUMAN-UAT.md` | `https://api.heygrabit.com/api/v1/auth/password-reset/confirm` | Browser Network POST evidence | WIRED | `18-HUMAN-UAT.md:134-136` records confirm POST URL and status 200. |
| `18-HUMAN-UAT.md` | Cloud Run revisions/digests | Deployment evidence fields | WIRED | `18-HUMAN-UAT.md:96-99`, `179-181` record final revisions and digests. |
| `18-HUMAN-UAT.md` | Sentry email observability | Caveated Sentry note | PARTIAL | `18-HUMAN-UAT.md:171-176`, `184` record the caveat but not independent zero-count/event-id evidence. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `apps/web/lib/api-url.ts` | `baseUrl` | `process.env.NEXT_PUBLIC_API_URL`, with Docker build arg from `vars.CLOUD_RUN_API_URL` | Yes | FLOWING - production build receives public API origin; helper rejects missing/local/non-HTTPS/non-origin production values. |
| `apps/web/app/auth/reset-password/page.tsx` | `token`, `data` | `useSearchParams()` token and `react-hook-form` inputs | Yes | FLOWING - token is passed into form defaults, keyed by token, serialized in confirm body, and submitted to `apiUrl(...)`. |
| `apps/web/next.config.ts` | `NODE_ENV` | Next/Cloud Run runtime env | Yes | FLOWING - production returns no rewrites; development returns localhost proxy rewrites. |
| `.github/workflows/deploy.yml` | `CLOUD_RUN_API_URL`, `CLOUD_RUN_WEB_URL` | GitHub environment variables | Yes | FLOWING - Node guard validates values before deploy work; web build receives `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`. |
| `18-HUMAN-UAT.md` | UAT result fields | Human/operator smoke, gcloud evidence, Cloud Logging evidence | Partial | PARTIAL - reset flow, Cloud Run, and logging evidence recorded; Sentry evidence is caveated as not independently inspected. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Web typecheck | `pnpm --filter @grabit/web typecheck` | exit 0 | PASS |
| Focused web regression suite | `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts lib/__tests__/next-config.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx` | exit 0; 26 files / 186 tests passed | PASS |
| Full web suite | `pnpm --filter @grabit/web test` | exit 0; 26 files / 186 tests passed | PASS |
| API auth/email suite | `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` | exit 0; 29 files / 323 tests passed | PASS |
| UAT token/secret redaction | negative `rg` for reset token, JWT, cookie, auth header, bearer, raw password, and secret patterns | exit 0 | PASS |
| UAT full email redaction | negative email grep allowing only `no-reply@heygrabit.com` | exit 0 | PASS |
| UAT stale wording/count scan | negative `rg` for old deploy-step wording and `26 files / 180 tests`; positive `rg` for `Validate production origins`, `26 files / 186 tests`, and preserved Sentry caveat | exit 0 | PASS |
| Deploy guard code presence | `rg` for `Validate production origins`, origin validation errors, and web build args | exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DEBT-01 | 18-01, 18-02 | Defined in `.planning/REQUIREMENTS.md`: Password reset 이메일 기능 실구현 | SATISFIED | Reset confirm uses public API origin; production smoke records reset email, confirm POST 200, and login success; UAT redaction passed. |
| CUTOVER-01 | 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | RECORDED, NOT REQUIREMENTS-DEFINED | UAT records Phase 15 final state and sender evidence, but REQUIREMENTS.md has no CUTOVER-01 entry. |
| CUTOVER-02 | 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | RECORDED, NOT REQUIREMENTS-DEFINED | UAT records expected `no-reply@heygrabit.com`; no separate REQUIREMENTS.md definition exists. |
| CUTOVER-03 | 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | RECORDED, NOT REQUIREMENTS-DEFINED | UAT records Cloud Run web/API revisions and image digests; no separate REQUIREMENTS.md definition exists. |
| CUTOVER-04 | 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | PARTIAL, NOT REQUIREMENTS-DEFINED | Cloud Logging `Resend send failed: empty` is recorded; independent Sentry dashboard/API inspection is caveated as unavailable. |
| CUTOVER-05 | 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | RECORDED, NOT REQUIREMENTS-DEFINED | UAT records inbox/not-spam result for the Phase 18 smoke, but does not redefine the broader Phase 15 three-provider cutover requirement. |
| CUTOVER-06 | 18-01, 18-02 | Planning-only ID from ROADMAP Phase 15, not defined in `.planning/REQUIREMENTS.md` | SATISFIED FOR PHASE 18 EVIDENCE | API auth/email suite passed with 29 files / 323 tests; `.planning/REQUIREMENTS.md` has no CUTOVER-06 entry. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `.planning/phases/18-password-reset-production-api-origin-fix/18-HUMAN-UAT.md` | 174 | Sentry dashboard/API not independently inspected | WARNING | Blocks fully automated pass status; human Sentry verification remains. |

Stale UAT wording re-check: old `Validate production public API URL` / `CLOUD_RUN_API_URL must be set for web production build` text and old `26 files / 180 tests` summaries are no longer present in `18-HUMAN-UAT.md`. The only remaining warning is the preserved Sentry caveat.

False-positive scan notes from the initial code verification: `return null` occurrences are React conditional render helpers, input `placeholder` attributes are UI text, and `return []` in `next.config.ts` is the intended production rewrite guard. No blocker stub or orphaned implementation was found.

### Human Verification Required

#### 1. Sentry Email-Service Observation

**Test:** Inspect Sentry dashboard/API for `component:email-service` in the relevant post-UAT window.
**Expected:** Record either `Sentry component:email-service recent 24h count: 0 after UAT` or `Sentry component:email-service captured event id: <redacted-id>`.
**Why human:** The current artifact explicitly says Sentry was not independently inspected and does not claim zero-count/event-id evidence.

### Gaps Summary

No code blocker was found for the Phase 18 API-origin fix. The production confirm path, dev/prod rewrite split, deploy origin guard, regression tests, Cloud Run revision/digest evidence, and PII redaction gate are verified against actual code and artifacts.

The only remaining verification item is external observability: Sentry email-service evidence is caveated rather than independently inspected. Because that requires dashboard/API access, the phase status is `human_needed`, not `passed`.

---

_Verified: 2026-04-29T06:32:43Z_
_Verifier: the agent (gsd-verifier)_
