# Phase 18: Password reset production API origin fix - Research

**Researched:** 2026-04-29 [VERIFIED: system current_date]  
**Domain:** Next.js client API origin contract + password reset production smoke [VERIFIED: .planning/ROADMAP.md]  
**Confidence:** HIGH for codebase diagnosis, MEDIUM for preview environment contract because no preview deployment workflow exists in repo [VERIFIED: rg preview/staging/CLOUD_RUN_API_URL]

## User Constraints

- Phase 18 has no `18-CONTEXT.md`; there are no discuss-phase locked decisions to copy verbatim. [VERIFIED: `gsd-sdk query init.phase-op 18`]
- The phase goal is to make password reset email -> confirm submission use the correct public API origin in production Cloud Run instead of depending on the `localhost:8080` `/api` rewrite. [VERIFIED: .planning/ROADMAP.md:270-279]
- Phase 18 must address `DEBT-01` and `CUTOVER-01` through `CUTOVER-06`. [VERIFIED: .planning/ROADMAP.md:272-279]
- The phase closes the v1.1 audit gap where `apps/web/app/auth/reset-password/page.tsx` uses relative `fetch('/api/v1/auth/password-reset/confirm')` while `apps/web/next.config.ts` rewrites `/api/*` to `http://localhost:8080`. [VERIFIED: .planning/v1.1-MILESTONE-AUDIT.md:56,98,221]
- Only the research artifact should be written for this turn; source code and unrelated planning files must not be modified. [VERIFIED: user prompt]

## Project Constraints (from AGENTS.md)

- All responses and planning prose should be Korean, while technical identifiers and code names remain in English. [VERIFIED: AGENTS.md]
- Do not edit Claude-specific config, files, or workflows. [VERIFIED: AGENTS.md]
- The project is a 1-person monolith-first ticketing platform, so plans should minimize complexity and avoid unnecessary service splits. [VERIFIED: AGENTS.md]
- The project stack follows `docs/03-ARCHITECTURE.md` / AGENTS stack rather than introducing alternative framework choices. [VERIFIED: AGENTS.md]
- Local development ports are `web:3000` and `api:8080`. [VERIFIED: AGENTS.md]
- The monorepo root `.env` is the canonical local env file; `apps/web/next.config.ts` explicitly loads it with `loadEnvConfig(resolve(__dirname, '../..'))`. [VERIFIED: AGENTS.md, apps/web/next.config.ts:6-9]
- Cloud Run production does not use `.env`; deploy-time env vars and Secret Manager bindings are the production source of truth. [VERIFIED: AGENTS.md, .github/workflows/deploy.yml:98-126,150-156]
- GSD workflow says direct repo edits should go through a GSD entry point; this invocation is itself a GSD phase research operation and only writes the required research artifact. [VERIFIED: AGENTS.md, user prompt]

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | Password reset email 기능 실구현과 confirm/login happy path가 production에서도 동작해야 한다. [VERIFIED: .planning/REQUIREMENTS.md] | Existing backend/email flow is implemented; the remaining break is frontend confirm origin. [VERIFIED: auth.controller.ts:118-141, auth.service.ts:226-323, reset-password/page.tsx:171-176] |
| CUTOVER-01 | Resend `heygrabit.com` domain is Verified. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | Phase 15 recorded `heygrabit.com` verified at 2026-04-27 11:41 KST. [VERIFIED: 15-HUMAN-UAT.md] |
| CUTOVER-02 | Secret Manager `resend-from-email` value is `no-reply@heygrabit.com`. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | Phase 15 found `resend-from-email` v1 already equals `no-reply@heygrabit.com`; Phase 18 should smoke, not redo this cutover. [VERIFIED: 15-03-SUMMARY.md] |
| CUTOVER-03 | Cloud Run `grabit-api` serves a revision with the transactional email secrets. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | Phase 15 final serving revision was `grabit-api-00013-lkx` with real `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. [VERIFIED: 15-03-SUMMARY.md] |
| CUTOVER-04 | Resend failure branch emits Sentry events. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | `EmailService` already uses `Sentry.withScope` and `captureException` on final/non-retryable Resend failure. [VERIFIED: email.service.ts:103-119] |
| CUTOVER-05 | Transactional email reaches inbox, not spam. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | Phase 15 verified direct Resend Gmail delivery; Phase 18 must add the missing full auth flow smoke from web request -> email link -> confirm -> login. [VERIFIED: 15-HUMAN-UAT.md, .planning/v1.1-MILESTONE-AUDIT.md:98] |
| CUTOVER-06 | Email service regressions stay green. [VERIFIED: Phase 15 requirement text in ROADMAP.md:235] | Phase 18 should run focused API auth/email tests even though the primary code change is web origin handling. [VERIFIED: apps/api/src/modules/auth/auth.service.spec.ts, apps/api/src/modules/auth/email/email.service.ts] |

</phase_requirements>

## Summary

The root cause is narrow: the request-mode password reset form uses `apiClient.post('/api/v1/auth/password-reset/request')`, which prepends `NEXT_PUBLIC_API_URL`, but the confirm-mode submit bypasses `apiClient` and calls `fetch('/api/v1/auth/password-reset/confirm')` directly. [VERIFIED: reset-password/page.tsx:60-64,168-176, api-client.ts:8,81] In production this can hit the Next.js `/api` rewrite, whose current destination is hard-coded to `http://localhost:8080/api/:path*`. [VERIFIED: next.config.ts:35-45] The v1.1 audit already classified this as the remaining DEBT-01 / CUTOVER break. [VERIFIED: .planning/v1.1-MILESTONE-AUDIT.md:56,98,221]

The correct plan is to make the public API origin a shared frontend contract and to make localhost rewrites dev-only. [VERIFIED: Phase 13 chose `api.heygrabit.com` as the API source of truth; 13-DISCUSSION-LOG.md:98-108] Next.js officially supports rewrites to external URLs, so the existing dev proxy is a valid local-dev tool, but `NEXT_PUBLIC_*` values are inlined into browser bundles at `next build`, so Cloud Run production must receive the API origin as a Docker build arg. [CITED: Context7 /websites/nextjs rewrites docs, Context7 /websites/nextjs environment variables docs] The deploy workflow already passes `--build-arg NEXT_PUBLIC_API_URL=${{ vars.CLOUD_RUN_API_URL }}` and Phase 13 records `CLOUD_RUN_API_URL=https://api.heygrabit.com`. [VERIFIED: deploy.yml:147-156, 13-HANDOFF.md]

**Primary recommendation:** add a small `apps/web/lib/api-url.ts` helper, use it from `api-client`, `lib/auth`, `login-form`, and reset-password confirm raw fetch, and change `next.config.ts` rewrites so `localhost:8080` is only returned outside production. [VERIFIED: current duplicate API base constants in api-client.ts:8, lib/auth.ts:4, login-form.tsx:26; current unsafe relative fetch at reset-password/page.tsx:171]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Password reset email link generation | API / Backend | External Resend | Backend signs the token, builds `${FRONTEND_URL}/auth/reset-password?token=...`, and sends via `EmailService`. [VERIFIED: auth.service.ts:226-251] |
| Password reset confirm form rendering | Browser / Client | Frontend Server for static delivery | The page reads `useSearchParams().get('token')`, renders `ConfirmView`, and submits from the browser. [VERIFIED: reset-password/page.tsx:30-45,156-176] |
| Public API origin selection | Browser / Client build config | CI/CD deploy config | Browser fetch URLs depend on `NEXT_PUBLIC_API_URL`, which Next.js inlines at build time. [CITED: Context7 /websites/nextjs environment variables docs; VERIFIED: Dockerfile:5-6, deploy.yml:151-156] |
| Local `/api` proxy | Frontend Server (Next.js dev/server) | API / Backend | Next.js rewrites can proxy to external URLs; here it is only safe as local-dev proxy to `localhost:8080`. [CITED: Context7 /websites/nextjs rewrites docs; VERIFIED: next.config.ts:35-45] |
| Confirm token validation | API / Backend | Database | Backend decodes `sub` for UUID guard, then verifies with `jwtSecret + passwordHash`, updates password, and revokes refresh tokens. [VERIFIED: auth.service.ts:254-323] |
| Production UAT evidence | Operator / External | Browser + Cloud Run logs | Inbox delivery, browser network origin, and login success require live production state. [VERIFIED: Phase 15 HUMAN-UAT pattern and Phase 18 success criteria] |

## Standard Stack

### Core

| Library / Tool | Installed Version | Registry Current | Purpose | Why Standard |
|----------------|-------------------|------------------|---------|--------------|
| Next.js | 16.2.1 [VERIFIED: node_modules package] | 16.2.4, modified 2026-04-29 [VERIFIED: npm registry] | App Router, standalone Cloud Run web build, rewrites. | Existing framework; no replacement needed. [VERIFIED: apps/web/package.json, next.config.ts] |
| React | 19.1.0 in web package range [VERIFIED: apps/web/package.json] | Project-pinned through Next/web deps. [VERIFIED: apps/web/package.json] | Client form rendering. | Existing UI runtime. [VERIFIED: reset-password/page.tsx] |
| react-hook-form | 7.72.0 installed [VERIFIED: node_modules package] | 7.74.0, modified 2026-04-25 [VERIFIED: npm registry] | Reset password request/confirm forms. | Existing pattern in reset-password page. [VERIFIED: reset-password/page.tsx:3-5,53-58,161-166] |
| zod | 3.25.76 installed via shared workspace [VERIFIED: node_modules package] | 4.3.6, modified 2026-01-25 [VERIFIED: npm registry] | Shared reset-password schemas. | Existing shared contract; do not upgrade during this bugfix. [VERIFIED: packages/shared/package.json, auth.schema.ts:63-81] |
| NestJS auth module | `@nestjs/common` 11.1.17 installed, `@nestjs/jwt` 11.0.2 installed [VERIFIED: node_modules package] | `@nestjs/common` 11.1.19, `@nestjs/jwt` 11.0.2 [VERIFIED: npm registry] | Existing password reset backend. | Backend behavior is already implemented and tested; phase should not rewrite it. [VERIFIED: auth.controller.ts, auth.service.ts] |

### Supporting

| Library / Tool | Installed Version | Registry Current | Purpose | When to Use |
|----------------|-------------------|------------------|---------|-------------|
| Vitest | 3.2.4 installed [VERIFIED: node_modules package] | 4.1.5, modified 2026-04-23 [VERIFIED: npm registry] | Unit regression tests for API URL helper, reset page, and next config. | Use existing `pnpm --filter @grabit/web test`; no runner migration. [VERIFIED: apps/web/package.json, vitest.config.ts] |
| @testing-library/react | 16.3.2 installed/current [VERIFIED: node_modules package, npm registry] | 16.3.2, modified 2026-01-19 [VERIFIED: npm registry] | Reset page DOM tests. | Extend existing reset-password tests. [VERIFIED: reset-password.test.tsx] |
| @sentry/nestjs / @sentry/nextjs | 10.47.0 installed [VERIFIED: node_modules package] | 10.50.0, modified 2026-04-28 [VERIFIED: npm registry] | Observability for email and web. | Use only for UAT/log checks; no new Sentry implementation needed. [VERIFIED: email.service.ts:4,107-118] |
| gcloud CLI | 564.0.0 available locally [VERIFIED: `gcloud --version`] | N/A | Production revision/log inspection. | Use for UAT evidence and Cloud Run smoke, not for source changes. [VERIFIED: Phase 15 HUMAN-UAT pattern] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared `api-url.ts` helper | Inline `${process.env.NEXT_PUBLIC_API_URL || ''}` in `reset-password/page.tsx` | Inline fix is smaller but keeps duplicate origin logic in `api-client`, `lib/auth`, `login-form`, and reset confirm. [VERIFIED: rg output for duplicate constants] |
| Raw fetch with `apiUrl()` | `apiClient.post` in confirm flow | `apiClient` can redirect/refresh on 401 when an access token exists, while reset-token 401 should show "유효하지 않은 링크"; raw fetch preserves the Phase 09 decision. [VERIFIED: 09-04-SUMMARY.md, api-client.ts:83-105] |
| Dev-only Next rewrites | Production rewrite to `api.heygrabit.com` | Production rewrite adds web->api double-hop and contradicts Phase 13's selected browser -> `api.heygrabit.com` contract. [VERIFIED: 13-DISCUSSION-LOG.md:98-108] |

**Installation:** no new package install is required. [VERIFIED: package.json and package usage]

## Architecture Patterns

### System Architecture Diagram

```text
[User clicks reset email link]
        |
        v
https://heygrabit.com/auth/reset-password?token=JWT
        |
        v
Next.js client page reads token
        |
        v
ConfirmView submit
        |
        +-- local dev: apiUrl('/api/v1/auth/password-reset/confirm')
        |       -> '/api/v1/auth/password-reset/confirm'
        |       -> Next dev rewrite -> http://localhost:8080/api/v1/auth/password-reset/confirm
        |
        +-- preview/prod: apiUrl('/api/v1/auth/password-reset/confirm')
                -> https://api.heygrabit.com/api/v1/auth/password-reset/confirm
                -> Global HTTPS LB / Cloud Run grabit-api
                        |
                        v
                AuthController.confirmReset
                        |
                        v
                AuthService.resetPassword
                        |
                        +-- 200 -> toast success -> /auth login
                        +-- 401 -> token error UI + retry link
                        +-- 400/429/network -> existing toast copy
```

All arrows and branch behavior above reflect existing files plus the recommended `apiUrl()` helper. [VERIFIED: reset-password/page.tsx, auth.controller.ts, auth.service.ts, next.config.ts, deploy.yml]

### Recommended Project Structure

```text
apps/web/
├── lib/
│   ├── api-url.ts                  # new: shared public API origin helper
│   ├── api-client.ts               # use apiUrl(path)
│   ├── auth.ts                     # use apiUrl(path)
│   └── __tests__/api-url.test.ts   # new: local/preview/prod contract
├── app/auth/reset-password/
│   ├── page.tsx                    # use apiUrl() for raw confirm fetch
│   └── __tests__/reset-password.test.tsx
└── next.config.ts                  # localhost rewrites only outside production
```

This structure keeps the change inside the web/API-origin boundary and avoids backend password-token changes. [VERIFIED: current affected files]

### Pattern 1: Shared API URL Builder

**What:** Resolve API request URLs in one helper so local dev can keep relative `/api` while preview/production use an absolute public API origin. [VERIFIED: api-client.ts currently uses `NEXT_PUBLIC_API_URL || ''`; deploy.yml injects `NEXT_PUBLIC_API_URL`]

**When to use:** Any browser/client code that calls the Grabit REST API, including raw fetch paths that intentionally bypass `apiClient`. [VERIFIED: reset-password confirm raw fetch bypass exists at page.tsx:171]

**Example:**

```typescript
// apps/web/lib/api-url.ts
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
}

export function apiUrl(path: `/${string}`): string {
  const baseUrl = getApiBaseUrl();
  if (process.env.NODE_ENV === 'production' && LOCALHOST_RE.test(baseUrl)) {
    throw new Error('NEXT_PUBLIC_API_URL must not point to localhost in production');
  }
  return baseUrl ? `${baseUrl}${path}` : path;
}
```

The runtime `process.env` access keeps Vitest env stubbing simple; Next.js still inlines `NEXT_PUBLIC_*` at build time for browser bundles. [CITED: Context7 /websites/nextjs environment variables docs; CITED: Context7 /vitest-dev/vitest vi.stubEnv docs]

### Pattern 2: Preserve Raw Fetch Semantics for Reset Confirm

**What:** Keep `ConfirmView` on raw fetch, but replace the relative URL with `apiUrl('/api/v1/auth/password-reset/confirm')`. [VERIFIED: 09-04-SUMMARY.md says raw fetch was chosen to avoid `apiClient` 401 redirect semantics]

**Example:**

```typescript
import { apiUrl } from '@/lib/api-url';

const res = await fetch(apiUrl('/api/v1/auth/password-reset/confirm'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data),
});
```

This keeps 401 mapped to the token-specific error UI instead of a generic auth-session redirect. [VERIFIED: reset-password/page.tsx:184-186, api-client.ts:83-105]

### Pattern 3: Dev-Only Localhost Rewrites

**What:** Keep Next rewrites for local development only; production must not contain any rewrite destination with `localhost:8080`. [VERIFIED: current rewrite leak at next.config.ts:35-45]

**Example:**

```typescript
async rewrites() {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }
  return [
    { source: '/api/:path*', destination: 'http://localhost:8080/api/:path*' },
    { source: '/socket.io/:path*', destination: 'http://localhost:8080/socket.io/:path*' },
  ];
}
```

Next.js supports external URL rewrites, so this is not a framework limitation; it is an environment scoping issue. [CITED: Context7 /websites/nextjs rewrites docs]

### Anti-Patterns to Avoid

- **Hard-code `https://api.heygrabit.com` inside component code:** use deploy-provided `NEXT_PUBLIC_API_URL` so preview/staging can use their own public API origin later. [VERIFIED: deploy.yml uses `vars.CLOUD_RUN_API_URL`]
- **Use `window.location.origin` as API origin:** production web origin is `https://heygrabit.com`, while the selected API origin is `https://api.heygrabit.com`; same-origin `/api` is not the production contract. [VERIFIED: 13-DISCUSSION-LOG.md:98-108]
- **Switch reset confirm to `apiClient.post` without preserving 401 token-error behavior:** `apiClient` owns authenticated-session refresh behavior, while reset confirm owns token validity UX. [VERIFIED: api-client.ts:83-105, reset-password/page.tsx:184-186]
- **Leave production `/api` rewrite as a fallback:** if `NEXT_PUBLIC_API_URL` is missing in production, the build should fail or the test should fail; falling back to localhost hides deployment misconfiguration. [VERIFIED: v1.1 audit gap]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API origin concatenation across components | Repeated inline `process.env.NEXT_PUBLIC_API_URL || ''` constants | `apiUrl()` helper | Current duplication already allowed the confirm flow to drift from request flow. [VERIFIED: rg duplicate constants] |
| Production proxying | Custom Next rewrite proxy to `api.heygrabit.com` | Direct browser calls to `NEXT_PUBLIC_API_URL` | Phase 13 selected `api.heygrabit.com` as browser-visible API SoT; rewrite proxy adds a double-hop. [VERIFIED: 13-DISCUSSION-LOG.md:98-108] |
| Password reset token validation | New frontend token precheck or custom token parsing | Existing `AuthService.resetPassword` endpoint | Backend already implements rotation-aware JWT verification and one-time passwordHash secret. [VERIFIED: auth.service.ts:254-323] |
| Email deliverability instrumentation | New custom metrics system | Existing Sentry + Cloud Logging checks | Phase 15 already wired Sentry capture for Resend failures. [VERIFIED: email.service.ts:107-118] |

**Key insight:** the phase should fix the frontend origin boundary, not reopen password-token, Resend, or backend auth semantics. [VERIFIED: codebase evidence and Phase 09/15 summaries]

## Common Pitfalls

### Pitfall 1: Fixing only `reset-password/page.tsx`

**What goes wrong:** The immediate symptom disappears, but API origin rules remain duplicated and future raw fetches can regress. [VERIFIED: duplicate API base constants in `api-client.ts`, `lib/auth.ts`, `login-form.tsx`, and raw reset fetch]  
**Why it happens:** The request path uses `apiClient`, but confirm path intentionally bypassed it for 401 UX. [VERIFIED: 09-04-SUMMARY.md]  
**How to avoid:** Add shared `api-url.ts` and use it in both `apiClient` and raw fetch sites. [VERIFIED: recommended from current code shape]  
**Warning signs:** tests only assert `String(url).toContain('/api/v1/...')`, which passes for both relative and absolute URLs. [VERIFIED: reset-password.test.tsx:99-100]

### Pitfall 2: Production still returns localhost rewrites

**What goes wrong:** A missing `NEXT_PUBLIC_API_URL` build arg silently routes browser `/api/*` through the web container to `localhost:8080`, which is not the API service inside the web Cloud Run container. [VERIFIED: next.config.ts:35-45, deploy topology in deploy.yml]  
**Why it happens:** The current `rewrites()` function is unconditional. [VERIFIED: next.config.ts:35-45]  
**How to avoid:** Add a test that imports `next.config.ts` under `NODE_ENV=production` and asserts no rewrite destination contains `localhost:8080`. [CITED: Vitest `vi.stubEnv` and `vi.resetModules` docs]  
**Warning signs:** `next.config.ts` still contains an unconditional `destination: 'http://localhost:8080...'` block after the phase. [VERIFIED: current source]

### Pitfall 3: Preview/staging CORS and reset-link origin are conflated

**What goes wrong:** `main.ts` can split comma-separated `FRONTEND_URL` for CORS, but `auth.service.ts` uses the raw `FRONTEND_URL` string to build reset links; comma-separated values would produce a malformed email link. [VERIFIED: main.ts:20-43,58-64; auth.service.ts:247-249]  
**Why it happens:** The same env var currently serves both CORS origins and canonical reset-link origin. [VERIFIED: main.ts and auth.service.ts]  
**How to avoid:** For Phase 18, keep production `FRONTEND_URL` as a single canonical web URL and document preview API testing as either same production web origin or a future separate CORS env split. [ASSUMED: no preview workflow exists in repo]  
**Warning signs:** `FRONTEND_URL=https://heygrabit.com,https://preview...` appears in Cloud Run env. [VERIFIED: current code would interpolate the full string into resetLink]

### Pitfall 4: UAT uses a social-only or unregistered email

**What goes wrong:** The request endpoint returns success-looking UX, but `AuthService.requestPasswordReset` silently returns without sending an email when the user is absent or has no `passwordHash`. [VERIFIED: auth.service.ts:226-235]  
**Why it happens:** Enumeration defense intentionally hides whether an email exists. [VERIFIED: auth.service.ts comments at 229-233 and RequestView catch/finally at reset-password/page.tsx:60-70]  
**How to avoid:** UAT must use a password-based account known to have `passwordHash`, or create one before the smoke. [VERIFIED: auth.service.ts behavior]  
**Warning signs:** "메일 발송 완료" UI appears but no `EmailService` log/Sentry/Resend event exists. [VERIFIED: enumeration design]

## Code Examples

### API URL Contract Tests

```typescript
// apps/web/lib/__tests__/api-url.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('local dev keeps relative /api path for Next dev rewrite', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const { apiUrl } = await import('../api-url');
    expect(apiUrl('/api/v1/auth/password-reset/confirm')).toBe(
      '/api/v1/auth/password-reset/confirm',
    );
  });

  it('production/preview uses configured public API origin and trims trailing slash', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.heygrabit.com/');
    const { apiUrl } = await import('../api-url');
    expect(apiUrl('/api/v1/auth/password-reset/confirm')).toBe(
      'https://api.heygrabit.com/api/v1/auth/password-reset/confirm',
    );
  });
});
```

This test shape follows Vitest's documented `vi.stubEnv`, `vi.unstubAllEnvs`, and `vi.resetModules` patterns. [CITED: Context7 /vitest-dev/vitest docs]

### Reset Confirm Regression Test Update

```typescript
it('confirm 제출은 NEXT_PUBLIC_API_URL public origin 으로 호출한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.heygrabit.com');
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
  vi.stubGlobal('fetch', fetchMock);

  // existing render/type/click steps...

  const [url] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.heygrabit.com/api/v1/auth/password-reset/confirm');
});
```

The current test only checks `.toContain('/api/v1/auth/password-reset/confirm')`, so it cannot distinguish relative from absolute production-safe URLs. [VERIFIED: reset-password.test.tsx:99-100]

### Next Config Rewrite Regression Test

```typescript
it('production rewrites never point /api to localhost:8080', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.resetModules();
  const config = (await import('../../next.config')).default;
  const rewrites = typeof config.rewrites === 'function' ? await config.rewrites() : [];
  expect(JSON.stringify(rewrites)).not.toContain('localhost:8080');
});
```

This test locks the audit's exact failure mode instead of relying on manual review. [VERIFIED: v1.1 audit finding; CITED: Vitest resetModules docs]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser calls same-origin `/api/*` and relies on Next rewrites. | Browser calls `NEXT_PUBLIC_API_URL` public API origin; local dev alone may use same-origin `/api` rewrite. | Phase 13 discussion selected `api.heygrabit.com`; deploy workflow now injects `CLOUD_RUN_API_URL`. [VERIFIED: 13-DISCUSSION-LOG.md, deploy.yml] | Production password reset confirm must call `https://api.heygrabit.com/...`, not same-origin `/api`. |
| Password reset confirm path had no frontend UI. | `ResetPasswordPage` has request/confirm dual mode using `useSearchParams` and `Suspense`. | Phase 09 Plan 04, completed 2026-04-15. [VERIFIED: 09-04-SUMMARY.md] | Do not replace the UI; fix only the API origin. |
| Resend/domain cutover was incomplete. | Resend `heygrabit.com` is verified, `resend-api-key` real key is deployed, and Gmail direct smoke passed. | Phase 15, 2026-04-27. [VERIFIED: 15-03-SUMMARY.md, 15-HUMAN-UAT.md] | Phase 18 should verify the full auth flow rather than redo DNS/secret work. |

**Deprecated/outdated:**

- Treating `next.config.ts` rewrites as production API routing is outdated for this project after Phase 13's `api.heygrabit.com` decision. [VERIFIED: 13-DISCUSSION-LOG.md]
- Assuming `NEXT_PUBLIC_API_URL` can be changed at Cloud Run runtime is unsafe because Next.js inlines public env variables during `next build`. [CITED: Context7 /websites/nextjs environment variables docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Preview/staging should use a non-local public API origin through `NEXT_PUBLIC_API_URL`, but the repo has no concrete preview deploy workflow to verify the exact URL. [ASSUMED] | Summary, Pitfall 3 | Planner may over-specify preview behavior that does not exist yet; document as contract rather than implementing preview infra. |
| A2 | Phase 18 UAT can use an existing password-based production account. [ASSUMED] | Validation Architecture | If no such account exists, the plan must add a manual precondition to create one before smoke. |

## Open Questions (RESOLVED)

1. **What is the actual preview/staging API URL?**  
   - What we know: Production uses `CLOUD_RUN_API_URL=https://api.heygrabit.com`, and deploy passes it as `NEXT_PUBLIC_API_URL`. [VERIFIED: deploy.yml, 13-HANDOFF.md]  
   - What's unclear: No active preview deployment workflow defines a separate preview API origin. [VERIFIED: rg preview/staging/CLOUD_RUN_API_URL]  
   - RESOLVED: Phase 18 treats preview/staging as a contract only. Preview must set `NEXT_PUBLIC_API_URL` to that environment's public API origin and must not rely on `/api` rewrite, but Phase 18 does not implement preview infrastructure. [ASSUMED]

2. **Should production build hard-fail when `NEXT_PUBLIC_API_URL` is empty?**  
   - What we know: Missing production API URL caused this class of risk, and Next public env is build-time. [VERIFIED: audit gap, Context7 Next docs]  
   - What's unclear: Local `NODE_ENV=production pnpm build` workflows may currently depend on an empty value. [ASSUMED]  
   - RESOLVED: Phase 18 guards localhost production origins in `apiUrl()` and production rewrites, and records the deploy build-arg contract, but it does not make empty `NEXT_PUBLIC_API_URL` a build failure. [ASSUMED]

3. **Should CORS origins split from reset-link origin?**  
   - What we know: `main.ts` treats `FRONTEND_URL` as comma-separated CORS origins, but `auth.service.ts` treats it as a single reset-link prefix. [VERIFIED: main.ts:20-43, auth.service.ts:247-249]  
   - What's unclear: Whether preview requires cross-origin API calls before a dedicated env split exists. [ASSUMED]  
   - RESOLVED: CORS/reset-link env separation is out of Phase 18 unless preview UAT is blocked. Production `FRONTEND_URL` remains a single canonical web URL for reset-link generation. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | pnpm scripts, Vitest, Next build | Yes | v25.9.0 local; CI uses Node 22. [VERIFIED: `node --version`, ci.yml:43-46] | Use CI Node 22 for release-equivalent verification. |
| pnpm | project scripts | Yes | 10.28.1 [VERIFIED: `pnpm --version`] | None needed. |
| npm | package version verification | Yes | 11.12.1 [VERIFIED: `npm --version`] | None needed. |
| gcloud | production smoke/log evidence | Yes | Google Cloud SDK 564.0.0 [VERIFIED: `gcloud --version`] | If auth unavailable, record manual operator commands in `18-HUMAN-UAT.md`. |
| gh CLI | GitHub variable/deploy inspection if needed | Yes | 2.89.0 [VERIFIED: `gh --version`] | Use GitHub UI if CLI auth unavailable. |
| Docker | CI/integration parity if needed | Yes | 29.1.3 [VERIFIED: `docker --version`] | Not required for the narrow web unit tests. |

**Missing dependencies with no fallback:** none found. [VERIFIED: environment audit commands]  
**Missing dependencies with fallback:** production account credentials and mailbox access are human/operator resources, not local CLI dependencies. [ASSUMED]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 for web unit/component tests. [VERIFIED: node_modules package, apps/web/package.json] |
| Config file | `apps/web/vitest.config.ts` with jsdom and `test-setup.ts`. [VERIFIED: apps/web/vitest.config.ts] |
| Quick run command | `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx` [VERIFIED: existing script in apps/web/package.json] |
| Full web command | `pnpm --filter @grabit/web test` [VERIFIED: apps/web/package.json] |
| API regression command | `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` [VERIFIED: apps/api/package.json and existing spec files] |
| Phase gate command | `pnpm --filter @grabit/web typecheck && pnpm --filter @grabit/web test && pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` [VERIFIED: package scripts] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEBT-01 | Confirm submit calls public API origin in production-like env. [VERIFIED: phase goal] | unit/component | `pnpm --filter @grabit/web test -- app/auth/reset-password/__tests__/reset-password.test.tsx` | Existing file; needs assertion update. [VERIFIED: reset-password.test.tsx] |
| DEBT-01 | Local dev with empty `NEXT_PUBLIC_API_URL` still returns relative `/api` for dev rewrite. [VERIFIED: local env contract] | unit | `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts` | New Wave 0/1 file. |
| DEBT-01 | Production `next.config.ts` rewrites do not contain `localhost:8080`. [VERIFIED: audit failure mode] | unit/static config | `pnpm --filter @grabit/web test -- lib/__tests__/next-config.test.ts` | New Wave 0/1 file. |
| CUTOVER-01..06 | Production email -> confirm -> login happy path works with `heygrabit.com` email sender and `api.heygrabit.com` confirm POST. [VERIFIED: phase success criteria] | manual UAT / smoke | Record in `.planning/phases/18.../18-HUMAN-UAT.md`; optional browser devtools/network or Playwright trace evidence. | New artifact required. |
| CUTOVER-06 | Existing backend reset token and email tests stay green. [VERIFIED: CUTOVER-06] | unit | `pnpm --filter @grabit/api test -- src/modules/auth/auth.service.spec.ts src/modules/auth/email/email.service.spec.ts` | Existing files. [VERIFIED: auth.service.spec.ts, email.service.ts] |

### Sampling Rate

- **Per task commit:** focused web test for the touched helper/page/config plus `pnpm --filter @grabit/web typecheck`. [VERIFIED: package scripts]
- **Per wave merge:** full `pnpm --filter @grabit/web test` and focused API auth/email tests. [VERIFIED: package scripts]
- **Phase gate:** automated suite green plus `18-HUMAN-UAT.md` with production smoke evidence. [VERIFIED: Phase 18 success criteria]

### Wave 0 Gaps

- [ ] `apps/web/lib/api-url.ts` - central URL helper. [VERIFIED: file absent by rg/read]
- [ ] `apps/web/lib/__tests__/api-url.test.ts` - local/preview/prod URL contract. [VERIFIED: file absent by find]
- [ ] `apps/web/lib/__tests__/next-config.test.ts` or equivalent config test - production rewrite excludes localhost. [VERIFIED: current test gap]
- [ ] Update `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` to assert exact absolute URL when `NEXT_PUBLIC_API_URL` is set. [VERIFIED: current assertion only uses `.toContain()`]
- [ ] `18-HUMAN-UAT.md` - production smoke evidence template. [VERIFIED: phase success criteria requires artifact evidence]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not explicitly set `security_enforcement: false`. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Keep existing reset-token validation in `AuthService.resetPassword`; do not add frontend token parsing as authority. [VERIFIED: auth.service.ts:254-323] |
| V3 Session Management | Yes | Existing reset success revokes all refresh tokens for the user; do not weaken this path. [VERIFIED: auth.service.ts:319-323] |
| V4 Access Control | Limited | Endpoints are `@Public()` by design, but token possession and backend verification control reset authority. [VERIFIED: auth.controller.ts:118-141, auth.service.ts:254-323] |
| V5 Input Validation | Yes | Shared zod reset schemas validate token/password/confirm on frontend and backend DTOs. [VERIFIED: auth.schema.ts:63-81, reset-password.dto.ts] |
| V6 Cryptography | Yes | Password hashing uses `argon2id`; reset tokens use JWT secret plus current password hash for one-time rotation. [VERIFIED: auth.service.ts:238-244,290-323] |
| V10 Server-Side Request Forgery / Network | Yes | Do not route production browser API calls through `localhost:8080` rewrite; use public API origin. [VERIFIED: audit gap, next.config.ts:35-45] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Account enumeration through password reset request | Information Disclosure | Keep request UI success regardless of backend send/no-send outcome. [VERIFIED: reset-password/page.tsx:60-70, auth.service.ts:226-235] |
| Reset token replay | Elevation of Privilege | Keep passwordHash-derived JWT secret and refresh-token revocation. [VERIFIED: auth.service.ts:238-244,290-323] |
| Production API origin downgrade to localhost | Tampering / Denial of Service | Shared `apiUrl()` helper, production rewrite guard, exact URL regression tests. [VERIFIED: audit gap] |
| CORS drift for preview origins | Denial of Service | Require environment-specific public API origin and explicit backend CORS origin strategy before preview smoke. [VERIFIED: main.ts:58-64; ASSUMED preview infra absent] |
| PII leakage in email failure telemetry | Information Disclosure | Existing EmailService logs `toDomain`, not full recipient, in Sentry context. [VERIFIED: email.service.ts:81,103-119] |

## Sources

### Primary (HIGH confidence)

- `gsd-sdk query init.phase-op 18` - phase directory, no context file, config flags. [VERIFIED]
- `.planning/ROADMAP.md` - Phase 18 goal, requirements, success criteria, dependency. [VERIFIED]
- `.planning/REQUIREMENTS.md` - `DEBT-01` mapping. [VERIFIED]
- `.planning/STATE.md` - Phase 15/17 recent state and operational decisions. [VERIFIED]
- `.planning/v1.1-MILESTONE-AUDIT.md` - exact production origin gap. [VERIFIED]
- `.planning/phases/09-tech-debt/09-VERIFICATION.md` and `09-04-SUMMARY.md` - prior reset UI/raw fetch rationale and DEBT-01 evidence. [VERIFIED]
- `.planning/phases/15.../15-RESEARCH.md`, `15-03-SUMMARY.md`, `15-HUMAN-UAT.md` - CUTOVER evidence and UAT pattern. [VERIFIED]
- `apps/web/next.config.ts`, `apps/web/lib/api-client.ts`, `apps/web/app/auth/reset-password/page.tsx`, reset-password tests. [VERIFIED]
- `apps/api/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `email.service.ts`, `auth.service.spec.ts`. [VERIFIED]
- Context7 `/websites/nextjs` - rewrites and environment variable docs. [CITED: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites, https://nextjs.org/docs/app/guides/environment-variables]
- Context7 `/vitest-dev/vitest/v3_2_4` - `vi.stubEnv`, `vi.unstubAllEnvs`, `vi.resetModules`. [CITED: Vitest docs]
- npm registry - current versions for Next, NestJS, Vitest, Testing Library, zod, react-hook-form, Resend, Sentry. [VERIFIED: npm view]

### Secondary (MEDIUM confidence)

- Phase 13 discussion/handoff/summary docs for `api.heygrabit.com` source-of-truth and GitHub variable state. [VERIFIED: local planning docs, but external GCP/GitHub state can drift]
- `.github/workflows/deploy.yml` for production build arg and env/secret injection. [VERIFIED: repo file; actual repo variables can drift]

### Tertiary (LOW confidence)

- Preview/staging URL behavior beyond the contract is LOW confidence because no active preview deploy workflow defines it. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - versions were checked from installed packages and npm registry. [VERIFIED: node/npm commands]
- Architecture: HIGH for current production code path and Phase 13 API domain decision; MEDIUM for preview because no concrete workflow exists. [VERIFIED: code/planning docs; ASSUMED preview]
- Pitfalls: HIGH for reset confirm origin, rewrite leak, and UAT social-only trap; MEDIUM for preview CORS split because it depends on future preview deployment shape. [VERIFIED: code; ASSUMED preview]

**Research date:** 2026-04-29 [VERIFIED: system current_date]  
**Valid until:** 2026-05-29 for codebase architecture; re-check npm/Next docs before changing framework behavior after that date. [ASSUMED]

## RESEARCH COMPLETE
