---
phase: 05-polish-launch
plan: 04
subsystem: infra
tags: [sentry, docker, github-actions, cloud-run, ci-cd, observability]

# Dependency graph
requires:
  - phase: 05-03
    provides: error handling UX (error interceptor, error codes, network banner)
provides:
  - Sentry error tracking for frontend (client/server/edge) and backend (NestJS)
  - Docker multi-stage builds for web and api services
  - GitHub Actions CI pipeline (PR lint+typecheck+test)
  - GitHub Actions deploy pipeline (OIDC auth, Docker build, Cloud Run deploy)
  - .dockerignore for secure Docker builds
affects: [production-deployment, monitoring, cloud-run]

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs@^10", "@sentry/nestjs@^10"]
  patterns: ["withSentryConfig wrapper for Next.js", "instrument.ts first-import pattern for NestJS", "SentryExceptionCaptured decorator on existing filters", "3-stage Docker multi-stage build", "OIDC workload identity federation for GCP auth"]

key-files:
  created:
    - apps/web/instrumentation-client.ts
    - apps/web/instrumentation.ts
    - apps/web/sentry.server.config.ts
    - apps/web/sentry.edge.config.ts
    - apps/web/app/global-error.tsx
    - apps/api/src/instrument.ts
    - apps/web/Dockerfile
    - apps/api/Dockerfile
    - .github/workflows/ci.yml
    - .github/workflows/deploy.yml
    - .dockerignore
  modified:
    - apps/web/next.config.ts
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/api/src/common/filters/http-exception.filter.ts
    - apps/web/package.json
    - apps/api/package.json
    - .env.example

key-decisions:
  - "Used google-github-actions/auth@v3 and deploy-cloudrun@v3 instead of v2 (research recommended v3 released Aug 2025)"
  - "Added @SentryExceptionCaptured() decorator to existing HttpExceptionFilter instead of SentryGlobalFilter (avoids filter conflict)"
  - "Added outputFileTracingRoot for monorepo standalone builds"
  - "Pinned pnpm@10.28.1 in Dockerfiles to match packageManager field"
  - "tracesSampleRate 0.1 (10%) to preserve free tier quota"

patterns-established:
  - "Sentry frontend: instrumentation-client.ts + instrumentation.ts + sentry.server.config.ts + sentry.edge.config.ts"
  - "Sentry backend: instrument.ts as first import in main.ts + SentryModule.forRoot() first in AppModule imports"
  - "Docker: 3-stage multi-stage (deps -> builder -> runner) with non-root user"
  - "CI/CD: ci.yml for PR validation, deploy.yml for main merge deployment"

requirements-completed: [INFR-03]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 5 Plan 4: Production Infrastructure Summary

**Sentry error tracking (frontend 4-file + backend 3-file), Docker multi-stage builds, GitHub Actions CI/CD with OIDC Cloud Run deployment**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T00:54:04Z
- **Completed:** 2026-04-08T00:58:30Z
- **Tasks:** 2 completed, 1 checkpoint (awaiting verification)
- **Files modified:** 19

## Accomplishments
- Sentry configured for frontend (client/server/edge) and backend with 0.1 sampling rate
- Docker multi-stage builds for both web (standalone) and api (NestJS) services
- CI workflow validates PRs with lint + typecheck + test
- Deploy workflow automates Docker build + Cloud Run deployment via OIDC auth
- @SentryExceptionCaptured decorator on existing HttpExceptionFilter for error capture

## Task Commits

Each task was committed atomically:

1. **Task 1: Sentry frontend + backend setup** - `141ebbe` (feat)
2. **Task 2: Dockerfiles + GitHub Actions CI/CD + .dockerignore** - `edf3a0d` (feat)
3. **Task 3: Production infra verification** - checkpoint (awaiting human review)

## Files Created/Modified
- `apps/web/instrumentation-client.ts` - Sentry client init with onRouterTransitionStart
- `apps/web/instrumentation.ts` - Sentry server/edge init wrapper with onRequestError
- `apps/web/sentry.server.config.ts` - Sentry server runtime config
- `apps/web/sentry.edge.config.ts` - Sentry edge runtime config
- `apps/web/app/global-error.tsx` - Root layout error boundary with Sentry capture
- `apps/web/next.config.ts` - Added withSentryConfig wrapper + outputFileTracingRoot
- `apps/api/src/instrument.ts` - Sentry backend init (first import in main.ts)
- `apps/api/src/main.ts` - Added instrument.js import as first line
- `apps/api/src/app.module.ts` - Added SentryModule.forRoot() as first module import
- `apps/api/src/common/filters/http-exception.filter.ts` - Added @SentryExceptionCaptured() decorator
- `apps/web/Dockerfile` - Next.js standalone 3-stage multi-stage build
- `apps/api/Dockerfile` - NestJS 3-stage multi-stage build
- `.github/workflows/ci.yml` - PR validation pipeline (lint+typecheck+test)
- `.github/workflows/deploy.yml` - Main merge deploy pipeline (OIDC + Docker + Cloud Run)
- `.dockerignore` - Excludes .env, node_modules, .git from Docker context
- `apps/web/package.json` - Added @sentry/nextjs dependency
- `apps/api/package.json` - Added @sentry/nestjs dependency
- `.env.example` - Added Sentry environment variable placeholders
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used google-github-actions/auth@v3 and deploy-cloudrun@v3 (research recommended v3 over plan's v2)
- Added @SentryExceptionCaptured() decorator to existing HttpExceptionFilter (per research Pattern 4, avoids filter conflict)
- Added outputFileTracingRoot to next.config.ts for monorepo standalone build compatibility
- Pinned pnpm version in Dockerfiles to 10.28.1 matching root package.json packageManager field
- Set tracesSampleRate to 0.1 (10%) to preserve Sentry free tier quota
- Set automaticVercelMonitors to false since this project deploys to Cloud Run

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added @SentryExceptionCaptured() decorator to HttpExceptionFilter**
- **Found during:** Task 1 (Sentry backend setup)
- **Issue:** Plan did not include decorator on existing filter; without it, HTTP exceptions won't be captured by Sentry
- **Fix:** Added `@SentryExceptionCaptured()` decorator to HttpExceptionFilter.catch() method per research Pattern 4
- **Files modified:** apps/api/src/common/filters/http-exception.filter.ts
- **Verification:** tsc --noEmit shows no Sentry-related type errors
- **Committed in:** 141ebbe (Task 1 commit)

**2. [Rule 2 - Missing Critical] Upgraded GHA actions from v2 to v3**
- **Found during:** Task 2 (GitHub Actions workflows)
- **Issue:** Plan specified auth@v2 and deploy-cloudrun@v2; research documented v3 released Aug 2025 with Node 24 support
- **Fix:** Used google-github-actions/auth@v3 and deploy-cloudrun@v3 in deploy.yml
- **Files modified:** .github/workflows/deploy.yml
- **Committed in:** edf3a0d (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added onRouterTransitionStart export**
- **Found during:** Task 1 (Sentry frontend setup)
- **Issue:** Plan omitted onRouterTransitionStart export required for route navigation instrumentation (SDK 9.12.0+)
- **Fix:** Added `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` to instrumentation-client.ts per research Pattern 3
- **Files modified:** apps/web/instrumentation-client.ts
- **Committed in:** 141ebbe (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in both web and api projects (shared package not built in worktree, admin component type issues) prevented full tsc --noEmit pass, but no Sentry-related errors were found

## Threat Surface Scan

No new threat surfaces introduced beyond what's documented in the plan's threat model.

## User Setup Required

External services require manual configuration before deployment:
- **Sentry:** Create Next.js project (grapit-web) and Node.js project (grapit-api) in Sentry Dashboard. Set NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT.
- **GCP:** Create Artifact Registry repository, Workload Identity Pool + Provider, Service Account with Cloud Run Admin + AR Writer roles. Set GCP_PROJECT_ID, GCP_WIF_PROVIDER, GCP_SERVICE_ACCOUNT as GitHub secrets.
- **GCP Secret Manager:** Create secrets for DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET and mount to Cloud Run services.

## Next Phase Readiness
- Sentry configuration is complete pending DSN environment variable setup
- Docker builds need local testing with `docker build -f apps/web/Dockerfile .`
- CI/CD pipeline needs GCP Workload Identity Federation configured before first deploy
- All infrastructure files are in place for production deployment

---
*Phase: 05-polish-launch*
*Completed: 2026-04-08*
