# Phase 5: Polish + Launch - Research

**Researched:** 2026-04-07 (updated 2026-04-07)
**Domain:** Mobile Responsive / Skeleton UI / Error Handling / CI/CD + Cloud Run Deployment / Sentry Observability
**Confidence:** HIGH

## Summary

Phase 5 is a polish-and-ship phase that elevates existing code to production quality across 4 domains: (1) mobile responsive (GNB to bottom tab bar, all public pages responsive), (2) skeleton UI (component-level loading states), (3) error handling UX (API error interceptor, error code system, network banner, 404 page), (4) production infrastructure (Sentry error tracking, GitHub Actions CI/CD, Docker multi-stage, Cloud Run deployment).

The codebase already has a `Skeleton` component used across 18 files (94 occurrences), an `error.tsx` global error page, `sonner` toast configured with richColors and top-center position, and GNB with `md:` breakpoint for desktop/mobile split. The `LayoutShell` at `apps/web/app/layout-shell.tsx` already handles admin/booking route exclusion. Missing pieces: Dockerfiles, GitHub Actions workflows, Sentry config files, `not-found.tsx`, `global-error.tsx`, `NetworkBanner`, `MobileTabBar`. The `output: 'standalone'` is set in next.config.ts but `outputFileTracingRoot` is NOT set -- must be added for monorepo standalone builds.

**Primary recommendation:** Implement frontend UX plans (01-03) in parallel as Wave 1, then infrastructure plan (04) as Wave 2. Frontend plans modify existing code; infra creates new files with external service dependencies (Sentry DSN, GCP project). Use `google-github-actions/auth@v3` and `deploy-cloudrun@v3` (NOT v2 -- v3 released August 2025 with Node 24 support).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All public pages get mobile responsive treatment simultaneously. Admin remains desktop-only
- **D-02:** Complex tables (reservations, search results) convert to card-style lists on mobile
- **D-03:** GNB replaced with bottom tab bar on mobile. 4 tabs: Home / Category / Search / My Page
- **D-04:** All touch targets minimum 44px strictly enforced (WCAG criterion)
- **D-05:** Performance detail page mobile: poster full-width at top
- **D-06:** Booking flow date/round selection: collapsible at top on mobile
- **D-07:** Skeletons only for API data fetch areas
- **D-08:** Component-level skeleton granularity
- **D-09:** shadcn Skeleton default Pulse animation maintained
- **D-10:** API errors shown via sonner toast, form validation errors inline in fields, all Korean
- **D-11:** Network offline/timeout shows full-width banner at top: "Check your internet connection" + retry
- **D-12:** Error messages include error codes (ERR-{HTTP_STATUS})
- **D-13:** 404 page: "( ._.)" + "Page not found" + home button
- **D-14:** Sentry frontend(@sentry/nextjs) + backend(@sentry/nestjs) both configured
- **D-15:** GitHub Actions full pipeline: PR lint+typecheck+test -> main merge Docker -> Cloud Run
- **D-16:** Cloud Run web + api as separate services
- **D-17:** DB migration auto-executed in CI/CD
- **D-18:** Cloud Run min-instances=1
- **D-19:** Dockerfile multi-stage build
- **D-20:** Environment variables managed via GCP Secret Manager

### Claude's Discretion
- Bottom tab bar icon and animation design
- Skeleton component layout details per component
- Error code system (ERR-xxx naming/ranges)
- 404 illustration specific design
- Sentry sampling rate configuration
- GitHub Actions workflow file structure
- Dockerfile optimization details
- Cloud Run service resource settings
- GCP Secret Manager secret structure

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Mobile responsive design (touch target 44px, bottom sheet etc.) | MobileTabBar new component, all public pages breakpoint treatment, LayoutShell mobile branch with bottom padding |
| INFR-02 | Skeleton UI displayed during page loads | Existing Skeleton component (18 files), 11 component-level skeleton variants, React Query isLoading/isPending pattern |
| INFR-03 | User-friendly Korean error messages with retry buttons on API errors | api-client.ts error interceptor extension, NetworkBanner new component, not-found.tsx new, error.tsx enhancement with error codes |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^16.2.0 | SSR framework | Already installed, `output: 'standalone'` configured [VERIFIED: apps/web/next.config.ts] |
| Tailwind CSS | ^4.2.0 | Utility CSS | Responsive breakpoints `sm:`, `md:`, `lg:` already used in 30+ components [VERIFIED: codebase scan] |
| shadcn/ui | new-york | UI components | Skeleton, Sheet, Sonner already installed [VERIFIED: apps/web/components/ui/] |
| sonner | ^2.0.7 | Toast notifications | Error/success toasts in use, top-center position, richColors enabled [VERIFIED: apps/web/components/ui/sonner.tsx] |
| lucide-react | ^1.7.0 | Icons | Tab bar icons (Home, LayoutGrid, Search, User) [VERIFIED: apps/web/package.json] |

### New installs required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sentry/nextjs | ^10.47.0 | Next.js error tracking + performance monitoring | Frontend error capture, source map upload [VERIFIED: npm registry 2026-04-07] |
| @sentry/nestjs | ^10.47.0 | NestJS error tracking | Backend error capture, transaction tracing [VERIFIED: npm registry 2026-04-07] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @sentry/nextjs | Bugsnag, Datadog RUM | Sentry free tier sufficient, most mature Next.js official integration |
| sonner | react-hot-toast | sonner already installed, richColors support is better |
| navigator.onLine | Service Worker offline detection | navigator.onLine is simple and sufficient, SW adds excessive complexity for this stage |

**Installation:**
```bash
# Frontend (apps/web)
pnpm --filter @grapit/web add @sentry/nextjs@^10.47.0

# Backend (apps/api)
pnpm --filter @grapit/api add @sentry/nestjs@^10.47.0
```

## Architecture Patterns

### Frontend new file structure
```
apps/web/
├── instrumentation-client.ts        # Sentry client init + onRouterTransitionStart export
├── instrumentation.ts               # Sentry server/edge init wrapper (onRequestError export)
├── sentry.server.config.ts          # Sentry server config
├── sentry.edge.config.ts            # Sentry edge config
├── next.config.ts                   # MODIFY: wrap with withSentryConfig, add outputFileTracingRoot
├── app/
│   ├── global-error.tsx             # Sentry error boundary (root layout errors)
│   ├── not-found.tsx                # 404 page (new)
│   └── error.tsx                    # Global error page (enhance: add error code)
├── components/
│   ├── layout/
│   │   ├── gnb.tsx                  # No change needed (already md: responsive)
│   │   ├── mobile-tab-bar.tsx       # NEW: mobile bottom tab bar
│   │   ├── network-banner.tsx       # NEW: offline/timeout banner
│   │   └── layout-shell.tsx         # NOTE: lives at app/layout-shell.tsx, not components/layout/
│   └── skeletons/
│       ├── performance-card-skeleton.tsx
│       ├── banner-skeleton.tsx
│       ├── ... (11 files)
│       └── index.ts                 # barrel export
└── lib/
    ├── api-client.ts                # MODIFY: add error interceptor with toast + error codes
    └── error-messages.ts            # NEW: HTTP status to Korean message map
```
[VERIFIED: actual LayoutShell location is apps/web/app/layout-shell.tsx, NOT components/layout/]

### Backend new file structure
```
apps/api/src/
├── instrument.ts                    # Sentry init (MUST be first import in main.ts)
├── main.ts                          # MODIFY: add instrument.ts import as first line
├── app.module.ts                    # MODIFY: add SentryModule.forRoot()
└── common/filters/
    └── http-exception.filter.ts     # MODIFY: add @SentryExceptionCaptured() decorator
```
[VERIFIED: existing HttpExceptionFilter at apps/api/src/common/filters/http-exception.filter.ts]

### Infrastructure new file structure
```
(project root)
├── apps/web/Dockerfile              # Next.js standalone multi-stage build
├── apps/api/Dockerfile              # NestJS multi-stage build
├── .github/
│   └── workflows/
│       ├── ci.yml                   # PR: lint + typecheck + test
│       └── deploy.yml               # main merge: Docker build -> Cloud Run deploy
├── .dockerignore                    # Docker build optimization
└── .env.example                     # Environment variable template (no secrets)
```
[VERIFIED: none of these files exist yet]

### Pattern 1: MobileTabBar + LayoutShell integration
**What:** Add MobileTabBar to existing LayoutShell and control mobile display.
**When to use:** All public pages for mobile/desktop layout branching.
**Critical detail:** LayoutShell is at `apps/web/app/layout-shell.tsx` (NOT `components/layout/`). It is imported directly in `apps/web/app/layout.tsx`.
**Example:**
```typescript
// Source: CONTEXT.md D-03, actual apps/web/app/layout-shell.tsx
'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { GNB } from '@/components/layout/gnb';
import { Footer } from '@/components/layout/footer';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { NetworkBanner } from '@/components/layout/network-banner';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const isBookingCheckout =
    pathname.startsWith('/booking') && !pathname.endsWith('/complete');
  const hideShell = isAdmin || isBookingCheckout;

  return (
    <>
      <NetworkBanner />
      {!hideShell && <GNB />}
      <div className={cn('flex flex-1 flex-col', !hideShell && 'pb-[56px] md:pb-0')}>
        {children}
      </div>
      {!hideShell && <MobileTabBar />}
      {!hideShell && <Footer />}
    </>
  );
}
```
[VERIFIED: apps/web/app/layout-shell.tsx actual structure and import paths confirmed]

### Pattern 2: API error interceptor + error code system
**What:** Extend api-client.ts request() to classify HTTP errors and show user-friendly Korean toasts via sonner.
**When to use:** Auto-applies to all API calls.
**Critical detail:** Current api-client.ts throws `ApiClientError` but does NOT show toasts. The interceptor adds toast before throw. Must NOT add toasts for 401 (handled by redirect). Must avoid duplicate toasts with React Query onError callbacks.
**Example:**
```typescript
// Source: CONTEXT.md D-10, D-12
// apps/web/lib/error-messages.ts
export const STATUS_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  403: '접근 권한이 없습니다.',
  404: '요청하신 정보를 찾을 수 없습니다.',
  408: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export const DEFAULT_ERROR_MESSAGE = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

// apps/web/lib/api-client.ts -- in !res.ok branch:
import { toast } from 'sonner';
import { STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE } from './error-messages';

if (!res.ok) {
  const status = res.status;
  let errorMessage = STATUS_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGE;
  try {
    const errorData = await res.json() as { message?: string };
    if (errorData.message) errorMessage = errorData.message;
  } catch { /* use default */ }

  // 401 already handled above (redirect). Toast only for other errors.
  if (status !== 401) {
    toast.error(errorMessage, {
      description: `오류 코드: ERR-${status}`,
      duration: 5000,
    });
  }

  throw new ApiClientError(errorMessage, status);
}
```
[VERIFIED: sonner toast API supports description prop; current api-client.ts has no toast -- clean addition]

### Pattern 3: Sentry Next.js integration (10.x + Next.js 16 Turbopack)
**What:** `withSentryConfig` wraps next.config.ts; 4 files for client/server/edge init + onRouterTransitionStart.
**When to use:** Production error tracking and source map upload.
**Critical detail:** Sentry 10.x requires `instrumentation-client.ts` (NOT old `sentry.client.config.ts`). Must export `onRouterTransitionStart` for route navigation instrumentation (available since SDK 9.12.0). Sentry docs explicitly target "Next.js 15+ with Turbopack and App Router."
**Example:**
```typescript
// apps/web/instrumentation-client.ts
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,        // 10% sampling in production
  replaysSessionSampleRate: 0,   // Disable session replay (preserve free tier quota)
  replaysOnErrorSampleRate: 1.0, // Replay on error only
});

// Required for route navigation instrumentation (SDK 9.12.0+)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// apps/web/instrumentation.ts
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```
[CITED: docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/]
[VERIFIED: onRouterTransitionStart is required export, available since SDK 9.12.0]

### Pattern 4: Sentry NestJS integration (with existing custom filter)
**What:** `instrument.ts` imported first in main.ts, SentryModule in AppModule, `@SentryExceptionCaptured()` on existing filter.
**When to use:** Backend error tracking.
**Critical detail:** The project already has a custom `HttpExceptionFilter` registered globally via `app.useGlobalFilters()`. Do NOT use `SentryGlobalFilter` -- instead apply `@SentryExceptionCaptured()` decorator to the existing filter's `catch()` method. HttpExceptions are NOT captured by default -- the decorator enables this.
**Example:**
```typescript
// apps/api/src/instrument.ts
// Source: https://docs.sentry.io/platforms/javascript/guides/nestjs/
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// apps/api/src/main.ts -- FIRST LINE
import './instrument.js';
// ... rest of existing code

// apps/api/src/app.module.ts -- add to imports
import { SentryModule } from '@sentry/nestjs/setup';
@Module({
  imports: [SentryModule.forRoot(), /* ...existing modules */],
})

// apps/api/src/common/filters/http-exception.filter.ts -- add decorator
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: HttpException, host: ArgumentsHost) {
    // ... existing implementation unchanged
  }
}
```
[CITED: docs.sentry.io/platforms/javascript/guides/nestjs/]
[VERIFIED: existing HttpExceptionFilter confirmed at apps/api/src/common/filters/http-exception.filter.ts]

### Pattern 5: Docker multi-stage build (Next.js standalone + pnpm monorepo)
**What:** 3-stage multi-stage build: deps -> build -> production.
**When to use:** Cloud Run deployment container images.
**Critical detail:** MUST add `outputFileTracingRoot` to next.config.ts before building. Without it, standalone output won't include `@grapit/shared` package. The monorepo uses `pnpm@10.28.1` (set via `packageManager` in root package.json). Docker base image should be `node:22-alpine` (matching engines constraint `>=22.0.0`).
```typescript
// next.config.ts -- add this line
import { resolve } from 'path';
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../../'), // monorepo root
  // ... rest of config
};
```
[CITED: nextjs.org/docs/app/api-reference/config/next-config-js/output]
[CITED: github.com/vercel/next.js/discussions/38435]

### Pattern 6: GitHub Actions CI/CD (OIDC + Cloud Run) -- UPDATED v3
**What:** 2 workflows: PR validation (ci.yml) + main merge deploy (deploy.yml).
**When to use:** Automated build-test-deploy pipeline.
**Critical detail:** Use `google-github-actions/auth@v3` and `google-github-actions/deploy-cloudrun@v3` (both updated to v3 with Node 24 support as of August 2025). The v2 tags still exist but v3 is current.
**Example:**
```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```
```yaml
# .github/workflows/deploy.yml (key auth step)
- uses: google-github-actions/auth@v3
  with:
    workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
    service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

- uses: google-github-actions/deploy-cloudrun@v3
  with:
    service: grapit-web
    image: ${{ env.IMAGE }}
    region: asia-northeast3
```
[CITED: github.com/google-github-actions/auth -- v3.0.0 released August 2025]
[CITED: github.com/google-github-actions/deploy-cloudrun -- v3 is current]

### Anti-Patterns to Avoid
- **Sentry DSN hardcoded:** Use env vars. DSN is public-safe but should not be in code. `NEXT_PUBLIC_SENTRY_DSN` (frontend) / `SENTRY_DSN` (backend).
- **Global loading.tsx as skeleton replacement:** Existing `loading.tsx` shows a spinner. Per D-07/D-08, use component-level granular skeletons. Keep `loading.tsx` for Next.js route transitions; show skeletons inside components via React Query's `isPending` state.
- **Client-side state for tab bar active tab:** Use `usePathname()` so route changes stay in sync. [VERIFIED: existing GNB isActiveGenre pattern uses same approach]
- **Full monorepo COPY in Docker:** Only copy standalone output in production stage. Build context must be monorepo root (`docker build -f apps/web/Dockerfile .`).
- **Secrets as env vars in CI:** GitHub Actions should configure Cloud Run to reference GCP Secret Manager, not pass secrets as plain env vars.
- **Using SentryGlobalFilter with existing custom filters:** Use `@SentryExceptionCaptured()` decorator on existing HttpExceptionFilter instead. [CITED: docs.sentry.io/platforms/javascript/guides/nestjs/]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error tracking | Custom error logger | @sentry/nextjs + @sentry/nestjs | Source maps, performance tracing, session replay, alerts built-in |
| Toast notifications | Custom toast component | sonner (already installed) | Stacking toasts, richColors, promise toasts |
| Docker image builds | Manual build scripts | Dockerfile + GitHub Actions | Multi-stage, layer caching, automation |
| GCP auth | Service key file management | Workload Identity Federation (OIDC) | Keyless auth, auto-expiry, security best practice |
| Network state detection | WebSocket heartbeat | navigator.onLine + online/offline events | Browser built-in, no extra dependencies |
| Skeleton UI | Custom shimmer effects | shadcn Skeleton (already in use) | animate-pulse built-in, consistent design |
| Route navigation tracing | Custom performance hooks | onRouterTransitionStart export | Sentry built-in, automatic span creation |

**Key insight:** This Phase is primarily "connecting and extending existing things" rather than "building new things." Maximize use of already-installed libraries (sonner, Skeleton, Tailwind breakpoints, lucide-react).

## Common Pitfalls

### Pitfall 1: Next.js standalone + pnpm monorepo symlink issue
**What goes wrong:** pnpm uses symlink-based node_modules, and Next.js standalone output copies symlinks that break in Docker.
**Why it happens:** `@vercel/nft` (Node File Tracing) follows symlink structure and copies symlinks instead of actual files.
**How to avoid:**
1. Add `outputFileTracingRoot: resolve(__dirname, '../../')` to next.config.ts (currently NOT set -- must add). [VERIFIED: not in current next.config.ts]
2. After copying standalone directory in Dockerfile, verify node_modules is intact.
3. sharp may not auto-include in standalone -- install explicitly in production stage if needed.
**Warning signs:** Docker build succeeds but runtime throws `MODULE_NOT_FOUND`.
[CITED: github.com/vercel/next.js/discussions/38435, github.com/vercel/next.js/discussions/40482]

### Pitfall 2: Sentry withSentryConfig + Turbopack compatibility
**What goes wrong:** Sentry's `withSentryConfig` may emit warnings in Turbopack dev server or source map upload may not work during dev.
**Why it happens:** Turbopack does not support Webpack plugins; some Sentry features (source map upload) only work at build time.
**How to avoid:** Sentry 10.x docs explicitly target "Next.js 15+ with Turbopack and App Router" -- the SDK handles Turbopack natively. Source map upload runs only during `next build` (CI), not during `next dev --turbopack`. If warnings appear, set `silent: true` in withSentryConfig options for dev.
**Warning signs:** `turbo dev` shows Sentry-related warning messages.
[CITED: docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ -- "Next.js 15+ with Turbopack and App Router"]

### Pitfall 3: Cloud Run WebSocket + min-instances setting
**What goes wrong:** min-instances=1 means WebSocket connections pin to single instance; scaling adds instances that miss broadcasts.
**Why it happens:** Cloud Run spins up new instances under load; existing WebSocket connections stay on old instances.
**How to avoid:** `@socket.io/redis-adapter` is already installed. Verify Redis pub/sub relay works across instances during deployment. D-18 sets min-instances=1 so initially single instance, but test with min=2 later.
**Warning signs:** Seat status not propagated to users on different instances.
[VERIFIED: @socket.io/redis-adapter@^8.3.0 installed in apps/api/package.json]

### Pitfall 4: LayoutShell mobile bottom padding omission
**What goes wrong:** MobileTabBar is fixed-bottom positioned, so page content gets hidden behind it.
**Why it happens:** Without bottom padding equal to tab bar height (56px + safe-area), last content is invisible.
**How to avoid:** Add `pb-[56px] md:pb-0` to LayoutShell's content wrapper. Use `env(safe-area-inset-bottom)` for iOS devices via `pb-safe` utility class.
**Warning signs:** Mobile page bottom content hidden behind tab bar.
[VERIFIED: UI-SPEC specifies pb-[56px]]

### Pitfall 5: Error toast duplication
**What goes wrong:** API error interceptor shows toast AND component `onError` shows toast -- same error appears twice.
**Why it happens:** React Query's `onError` callback and api-client.ts interceptor operate independently.
**How to avoid:** Show error toasts ONLY in api-client.ts interceptor. Components should NOT add toasts in their React Query onError. 401 handled via redirect (no toast). Check existing components for any `toast.error` calls in React Query callbacks -- remove them after interceptor is added.
**Warning signs:** Single API error produces 2 stacked toasts.
[VERIFIED: current api-client.ts throws but has no toast -- clean interceptor addition. Must audit existing component-level toasts.]

### Pitfall 6: Dockerfile pnpm workspace dependency resolution failure
**What goes wrong:** Docker build cannot find `@grapit/shared` package.
**Why it happens:** pnpm workspace uses `workspace:*` protocol for local packages; Docker build context must include entire monorepo.
**How to avoid:** Set Docker build context to monorepo root (`docker build -f apps/web/Dockerfile .`). Copy pnpm-workspace.yaml and ALL package.json files first, then `pnpm install --frozen-lockfile`.
**Warning signs:** `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` error.
[ASSUMED -- standard pnpm monorepo Docker pattern, widely documented]

### Pitfall 7: NestJS Sentry filter conflict with existing global filters
**What goes wrong:** Adding `SentryGlobalFilter` alongside existing `HttpExceptionFilter` causes filter ordering issues or double error handling.
**Why it happens:** NestJS applies global filters in LIFO order. Two catch-all filters compete.
**How to avoid:** Do NOT register `SentryGlobalFilter`. Instead, add `@SentryExceptionCaptured()` decorator to the existing `HttpExceptionFilter.catch()` method. This captures exceptions to Sentry while keeping existing filter behavior unchanged.
**Warning signs:** Errors reported twice to Sentry, or error response format changes unexpectedly.
[CITED: docs.sentry.io/platforms/javascript/guides/nestjs/ -- "If you already have a catch-all filter, apply @SentryExceptionCaptured() decorator"]

## Code Examples

### MobileTabBar component
```typescript
// Source: UI-SPEC + CONTEXT.md D-03
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/', label: '홈', icon: Home },
  { href: '/genre/musical', label: '카테고리', icon: LayoutGrid },
  { href: '/search', label: '검색', icon: Search },
  { href: '/mypage', label: '마이페이지', icon: User },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav
      role="navigation"
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] border-t border-border bg-white pb-safe md:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5',
              active ? 'text-primary' : 'text-gray-400',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className={cn('text-caption', active ? 'font-semibold text-primary' : 'font-normal text-gray-500')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```
[VERIFIED: lucide-react icon names confirmed (Home, LayoutGrid, Search, User)]
[VERIFIED: cn utility at @/lib/cn confirmed]

### NetworkBanner component
```typescript
// Source: UI-SPEC + CONTEXT.md D-11
'use client';

import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOffline() { setIsOffline(true); }
    function handleOnline() { setIsOffline(false); }

    // Initial state check
    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[60] flex h-[44px] items-center justify-center gap-3 bg-error text-white"
    >
      <span className="text-caption font-semibold">인터넷 연결을 확인해주세요</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md border border-white bg-transparent px-3 h-8 text-caption text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
```
[VERIFIED: bg-error color token defined in globals.css @theme as #C62828]

### Next.js standalone Dockerfile (monorepo)
```dockerfile
# Source: nextjs.org/docs + community best practices
# apps/web/Dockerfile -- build context = monorepo root

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
# Build shared package first (turbo dependency)
RUN pnpm --filter @grapit/shared build
# Next.js build (produces .next/standalone)
RUN pnpm --filter @grapit/web build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
```
[ASSUMED -- standalone output path `apps/web/server.js` needs verification after actual build with outputFileTracingRoot set. The path depends on the monorepo root being the tracing root.]

### GitHub Actions CI Workflow
```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```
[CITED: pnpm/action-setup@v4 official docs]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.outputFileTracingRoot` | `outputFileTracingRoot` (top-level) | Next.js 15+ | Config location changed -- experimental prefix removed |
| Sentry 8.x `sentry.client.config.ts` | Sentry 10.x `instrumentation-client.ts` | 2025 | File name changed, uses Next.js instrumentation API |
| Sentry 10.x no route tracking export | `onRouterTransitionStart` export required | SDK 9.12.0+ | Must export from instrumentation-client.ts for route nav tracing |
| GCP service key JSON | Workload Identity Federation (OIDC) | 2023+ | Keyless auth is standard |
| `google-github-actions/auth@v2` | `google-github-actions/auth@v3` | August 2025 | Bumped to Node 24, removed deprecated params |
| `google-github-actions/deploy-cloudrun@v2` | `deploy-cloudrun@v3` | 2025 | Updated to match auth@v3 |
| `SentryGlobalFilter` as standalone | `@SentryExceptionCaptured()` decorator on existing filter | Sentry 10.x | Preferred when project already has custom exception filters |

**Deprecated/outdated:**
- `sentry.client.config.ts` / `sentry.server.config.ts` filenames: Sentry 10.x uses `instrumentation-client.ts` + `instrumentation.ts` wrapper [CITED: docs.sentry.io]
- GCP service key JSON: Replaced by Workload Identity Federation [CITED: cloud.google.com]
- `google-github-actions/auth@v2`: Still functional but v3 is current (August 2025) [CITED: github.com/google-github-actions/auth/releases]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pnpm workspace Docker build may hit ERR_PNPM_WORKSPACE_PKG_NOT_FOUND | Pitfall 6 | Docker build fails -- fix by adjusting build context path |
| A2 | Next.js standalone output server.js path is `apps/web/server.js` when outputFileTracingRoot is set to monorepo root | Dockerfile | Must verify after actual build; wrong path = CMD change |
| A3 | pb-safe Tailwind utility works for iOS safe area | Pattern 1 | If not available, use `pb-[env(safe-area-inset-bottom)]` directly |

**Previously assumed, now verified:**
- ~~A1 (old): Sentry withSentryConfig Turbopack warning~~ -- Sentry docs explicitly target "Next.js 15+ with Turbopack" [VERIFIED via docs.sentry.io]
- ~~A4 (old): Sentry 10.x file naming~~ -- Confirmed instrumentation-client.ts + instrumentation.ts [VERIFIED via docs.sentry.io manual setup]

## Open Questions

1. **GCP project and Workload Identity Federation setup status**
   - What we know: D-15 decided on OIDC auth
   - What's unclear: Whether GCP project ID, Workload Identity Pool, and Service Account are already created
   - Recommendation: Plan 05-04 is non-autonomous (user_setup required). User must create GCP resources before deploy.yml can work.

2. **Sentry project and DSN creation status**
   - What we know: @sentry/nextjs + @sentry/nestjs decided
   - What's unclear: Whether Sentry account has projects created and DSNs ready
   - Recommendation: Use DSN as env var placeholder. Plan 05-04 has user_setup section for this.

3. **Cloud Run service names and Artifact Registry**
   - What we know: asia-northeast3 (Seoul), web/api separate services
   - What's unclear: Service names (`grapit-web`/`grapit-api`?), Artifact Registry repository name
   - Recommendation: Use GitHub Actions vars for service names; initial deployment may need manual creation.

4. **Secret Manager secret structure**
   - What we know: Required env vars listed in CLAUDE.md (DATABASE_URL, JWT_SECRET, etc.)
   - What's unclear: Whether secrets are already created in Secret Manager, naming convention
   - Recommendation: deploy.yml uses `--update-secrets` flag to mount secrets to Cloud Run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Dockerfile local testing | YES | 29.1.3 | Build only in CI (local test unnecessary) |
| gcloud CLI | Cloud Run manual deploy | NO | -- | GitHub Actions auto-deploy via google-github-actions |
| GitHub CLI (gh) | PR creation, Actions check | YES | 2.89.0 | -- |
| Node.js | Build and runtime | YES | v24.13.0 (local), Docker uses 22-alpine | -- |
| pnpm | Package management | YES | 10.28.1 (corepack) | -- |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- gcloud CLI: Not installed locally, but `google-github-actions/auth@v3` handles GCP auth in CI. For local deploy, install via `brew install google-cloud-sdk`.

**Note:** Local Node.js is v24.13.0 but Docker images and CI use node:22-alpine (matching engines constraint `>=22.0.0` in root package.json). This is intentional -- LTS 22 is the production runtime.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 [VERIFIED: installed version] |
| Config file | `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/web test` |
| Full suite command | `pnpm test` (turbo runs all packages) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | MobileTabBar rendering + tab activation | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/mobile-tab-bar.test.tsx` | Wave 0 |
| INFR-01 | 44px touch target compliance | manual | Browser DevTools mobile mode visual check | manual-only (CSS) |
| INFR-02 | Skeleton component rendering | unit | `pnpm --filter @grapit/web exec vitest run components/__tests__/skeleton-variants.test.tsx` | Wave 0 |
| INFR-03 | API error interceptor with error codes | unit | `pnpm --filter @grapit/web exec vitest run lib/__tests__/api-client.test.ts` | Wave 0 |
| INFR-03 | NetworkBanner online/offline toggle | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/network-banner.test.tsx` | Wave 0 |
| INFR-03 | NotFoundPage rendering | unit | `pnpm --filter @grapit/web exec vitest run app/__tests__/not-found.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/web test` + `pnpm --filter @grapit/api test`
- **Per wave merge:** `pnpm test` (full)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` -- INFR-01
- [ ] `apps/web/lib/__tests__/api-client.test.ts` -- INFR-03 error interceptor
- [ ] `apps/web/components/layout/__tests__/network-banner.test.tsx` -- INFR-03 network banner

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Completed in previous phases |
| V3 Session Management | no | Completed in previous phases |
| V4 Access Control | no | Completed in previous phases |
| V5 Input Validation | yes | zod (existing), error messages do NOT include user input |
| V6 Cryptography | no | No crypto work in this phase |
| V7 Error Handling & Logging | yes | Sentry error tracking, error messages do NOT include stack traces |
| V10 Communications | yes | Cloud Run forces HTTPS, CORS configured |
| V14 Configuration | yes | Secret Manager, env vars, Dockerfile security |

### Known Threat Patterns for Phase 5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server internals in error messages | Information Disclosure | Korean user messages only, stack traces sent to Sentry only |
| Sentry DSN exposure | Information Disclosure | DSN is public-safe, but apply rate limiting in Sentry project settings |
| Secrets in Docker image | Information Disclosure | Multi-stage build separates build env, .dockerignore excludes .env |
| Hardcoded secrets in GitHub Actions | Elevation of Privilege | Workload Identity Federation for keyless auth, no service keys |
| Cloud Run public access | Spoofing | Cloudflare WAF in front, Cloud Run invoker permission control |
| Error toast XSS via server message | Tampering | sonner auto-escapes text content; never use dangerouslySetInnerHTML in toasts |

## Sources

### Primary (HIGH confidence)
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) - file structure, config, onRouterTransitionStart
- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/) - instrument.ts, SentryModule, @SentryExceptionCaptured decorator
- [npm registry: @sentry/nextjs@10.47.0](https://www.npmjs.com/package/@sentry/nextjs) - latest version verified 2026-04-07
- [npm registry: @sentry/nestjs@10.47.0](https://www.npmjs.com/package/@sentry/nestjs) - latest version verified 2026-04-07
- [google-github-actions/auth releases](https://github.com/google-github-actions/auth/releases) - v3.0.0 confirmed current (August 2025)
- [google-github-actions/deploy-cloudrun](https://github.com/google-github-actions/deploy-cloudrun) - v3 confirmed current
- Codebase scan: 18 files using Skeleton (94 occurrences), api-client.ts error handling, LayoutShell pattern, GNB structure, HttpExceptionFilter

### Secondary (MEDIUM confidence)
- [Next.js Standalone Output Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) - outputFileTracingRoot configuration
- [pnpm Docker Docs](https://pnpm.io/docker) - pnpm fetch, frozen-lockfile
- [Next.js pnpm Docker Discussion #38435](https://github.com/vercel/next.js/discussions/38435) - monorepo standalone issues
- [Next.js Standalone Symlinks Discussion #40482](https://github.com/vercel/next.js/discussions/40482) - pnpm symlink resolution

### Tertiary (LOW confidence)
- [Next.js Turbopack outputFileTracingRoot Issue #88579](https://github.com/vercel/next.js/issues/88579) - Turbopack path duplication (fix status unconfirmed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified on npm registry, installed packages confirmed in codebase
- Architecture: HIGH - Existing code patterns (LayoutShell, api-client, GNB, HttpExceptionFilter) analyzed, extension directions clear
- Sentry integration: HIGH - Official docs verified for both Next.js and NestJS SDKs, custom filter pattern confirmed
- CI/CD: HIGH - google-github-actions v3 confirmed via releases page, workflow patterns from official docs
- Pitfalls: MEDIUM - pnpm + standalone Docker issues based on community reports, need actual build verification
- Docker: MEDIUM - standalone server.js path assumed, needs actual build output verification

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Sentry SDK updates frequently -- 30 days)

**UPDATE LOG:**
- 2026-04-07: Initial research
- 2026-04-07 (update): Corrected google-github-actions from v2 to v3. Added onRouterTransitionStart requirement. Added @SentryExceptionCaptured decorator pattern for existing filters. Fixed LayoutShell path (app/layout-shell.tsx not components/layout/). Verified Sentry Turbopack compatibility (no longer assumed). Added Pitfall 7 (NestJS filter conflict). Updated vitest version to 3.2.4.
