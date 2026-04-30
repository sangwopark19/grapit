---
phase: 18-password-reset-production-api-origin-fix
plan: 01
subsystem: web
tags: [nextjs, vitest, password-reset, api-origin, github-actions]

requires:
  - phase: 09-tech-debt
    provides: reset-password confirm UI and raw fetch semantics for reset-token-specific 401 UX
  - phase: 15-resend-heygrabit-com-cutover-transactional-email-secret-mana
    provides: production transactional email cutover context for password reset flow
provides:
  - Shared browser API origin helper with production fail-loud guards
  - Password reset confirm submission to configured public API origin
  - Production Next rewrite guard preventing localhost API fallback
  - Deploy-web fail-fast validation for empty or loopback CLOUD_RUN_API_URL
affects: [18-02-production-uat, phase-24-operational-hardening, password-reset, api-origin]

tech-stack:
  added: []
  patterns:
    - "apiUrl(path: `/${string}`) centralizes browser REST API origin construction."
    - "Production NEXT_PUBLIC_API_URL misconfiguration fails loudly instead of falling through to localhost rewrites."
    - "Reset confirm keeps raw fetch to preserve reset-token 401 UX."

key-files:
  created:
    - apps/web/lib/api-url.ts
    - apps/web/lib/__tests__/api-url.test.ts
    - apps/web/lib/__tests__/next-config.test.ts
  modified:
    - apps/web/lib/api-client.ts
    - apps/web/lib/auth.ts
    - apps/web/components/auth/login-form.tsx
    - apps/web/app/auth/reset-password/page.tsx
    - apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx
    - apps/web/next.config.ts
    - .github/workflows/deploy.yml

key-decisions:
  - "Keep reset-password confirm on raw fetch rather than apiClient.post so token-invalid 401 stays on the invalid-link UI."
  - "Return no Next rewrites in production; local /api and /socket.io rewrites remain development-only."
  - "Validate CLOUD_RUN_API_URL before the web Docker build to block empty and loopback public API origins."

patterns-established:
  - "Browser API calls use `apiUrl('/api/...')`; local dev can still resolve relative `/api` paths through Next rewrites."
  - "Config regression tests import `next.config.ts` dynamically with env stubs and isolate the Sentry wrapper."

requirements-completed: [DEBT-01, CUTOVER-06]

duration: 9min
completed: 2026-04-29
---

# Phase 18 Plan 01: Password Reset Production API Origin Fix Summary

**Password reset confirm now uses the configured public API origin, while production rewrites and deploy builds fail before localhost fallback can mask misconfiguration.**

## Performance

- **Duration:** 9min
- **Started:** 2026-04-29T05:01:40Z
- **Completed:** 2026-04-29T05:10:24Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added `apiUrl()` / `getApiBaseUrl()` as the shared frontend REST API origin contract.
- Routed web API callers through `apiUrl()` without changing reset-token-specific 401 UX.
- Made production Next rewrites return `[]`, keeping localhost `/api` and `/socket.io` rewrites dev-only.
- Added a `deploy-web` guard that fails before `Build Web image` when `CLOUD_RUN_API_URL` is empty or local.

## Task Commits

Each task followed RED/GREEN TDD commits:

1. **Task 1 RED: API URL contract tests** - `a844bbc` (test)
2. **Task 1 GREEN: Shared API URL helper** - `3e1f14d` (feat)
3. **Task 2 RED: Reset confirm public origin test** - `47d2f8c` (test)
4. **Task 2 GREEN: Web caller apiUrl wiring** - `e35d511` (feat)
5. **Task 3 RED: Production rewrite guard test** - `4294a80` (test)
6. **Task 3 GREEN: Production rewrite and deploy guard** - `9606008` (fix)

## Files Created/Modified

- `apps/web/lib/api-url.ts` - Shared `getApiBaseUrl()` and `apiUrl(path)` helper with production empty/localhost/invalid URL guards.
- `apps/web/lib/__tests__/api-url.test.ts` - Local, public origin, production empty, and production loopback contract tests.
- `apps/web/lib/__tests__/next-config.test.ts` - Production no-localhost rewrite guard and development rewrite positive assertions.
- `apps/web/lib/api-client.ts` - Auth refresh, primary request, and retry request use `apiUrl()`.
- `apps/web/lib/auth.ts` - Auth initialization refresh and `/users/me` fetches use `apiUrl()`.
- `apps/web/components/auth/login-form.tsx` - Social login redirects use `apiUrl()`.
- `apps/web/app/auth/reset-password/page.tsx` - Reset confirm raw fetch posts to `apiUrl('/api/v1/auth/password-reset/confirm')`.
- `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` - Exact `https://api.heygrabit.com/api/v1/auth/password-reset/confirm` assertion plus credentials/header/body contract.
- `apps/web/next.config.ts` - Production rewrites return `[]`; development keeps localhost `/api` and `/socket.io`.
- `.github/workflows/deploy.yml` - `Validate production public API URL` step blocks empty and loopback `CLOUD_RUN_API_URL`.

## Verification Evidence

- `pnpm --filter @grabit/web typecheck` -> exit 0
- `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts` -> exit 0, 25 files / 178 tests passed
- `pnpm --filter @grabit/web test -- app/auth/reset-password/__tests__/reset-password.test.tsx` -> exit 0, 25 files / 178 tests passed
- `pnpm --filter @grabit/web test -- lib/__tests__/next-config.test.ts` -> exit 0, 26 files / 180 tests passed
- `pnpm --filter @grabit/web test -- lib/__tests__/api-url.test.ts lib/__tests__/next-config.test.ts app/auth/reset-password/__tests__/reset-password.test.tsx` -> exit 0, 26 files / 180 tests passed
- Deploy guard grep for `Validate production public API URL`, both error messages, and `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` build args -> exit 0

Existing jsdom warnings for navigation, `window.scrollTo`, and React `act(...)` appeared in unrelated suites, but the commands exited 0.

## Decisions Made

- Reset confirm remains raw `fetch`, not `apiClient.post`, preserving the Phase 09 token-invalid UX.
- `socket-client.ts` remains intentionally unchanged per plan review decision; WebSocket origin hardening stays deferred to Phase 24 or a dedicated websocket-origin phase.
- `next-config.test.ts` mocks `withSentryConfig` as an identity wrapper so the test verifies the routing config contract without Sentry wrapper side effects.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TDD RED failures matched expected missing implementation / old behavior:

- Task 1 RED failed because `apps/web/lib/api-url.ts` did not exist.
- Task 2 RED failed because reset confirm still called relative `/api/v1/auth/password-reset/confirm`.
- Task 3 RED failed because production rewrites still contained `localhost:8080`.

Post-summary state update note: `requirements.mark-complete` marked `DEBT-01`; `CUTOVER-06` is listed in this plan frontmatter but is not defined in `.planning/REQUIREMENTS.md`, so the SDK reported it as `not_found`.

## User Setup Required

None - no external service configuration required for this code plan.

## Next Phase Readiness

Ready for `18-02-PLAN.md`: production UAT can now verify password reset email -> confirm POST to `api.heygrabit.com` -> login success against a deployed revision containing this plan.

## Self-Check: PASSED

- Found `apps/web/lib/api-url.ts`
- Found `apps/web/lib/__tests__/api-url.test.ts`
- Found `apps/web/lib/__tests__/next-config.test.ts`
- Found `.planning/phases/18-password-reset-production-api-origin-fix/18-01-SUMMARY.md`
- Found commits `a844bbc`, `3e1f14d`, `47d2f8c`, `e35d511`, `4294a80`, `9606008`

---
*Phase: 18-password-reset-production-api-origin-fix*
*Completed: 2026-04-29*
