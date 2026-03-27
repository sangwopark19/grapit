---
phase: 01-foundation-auth
plan: 05
subsystem: auth
tags: [zustand, react-hook-form, zod, next.js, auth, frontend, oauth, sms, jwt]

requires:
  - phase: 01-foundation-auth plan 01
    provides: Shared schemas (loginSchema, registerStep*Schema, resetPasswordRequestSchema) and types (AuthResponse, UserProfile, SocialAuthResult)
  - phase: 01-foundation-auth plan 02
    provides: Backend auth API endpoints (login, register, refresh, logout, password-reset, users/me)
  - phase: 01-foundation-auth plan 03
    provides: UI primitives (SocialLoginButton, StepIndicator, PasswordInput, GNB, Footer, shadcn components)
  - phase: 01-foundation-auth plan 04
    provides: Social OAuth endpoints and SMS verification endpoints

provides:
  - Zustand auth store (useAuthStore) with in-memory access token
  - API client with automatic 401 token refresh and request deduplication
  - AuthGuard component for protected route wrapping
  - Auth initialization (silent refresh) on app load
  - /auth page with login/signup tabs
  - 3-step signup form (email/password, terms, additional info + SMS)
  - /auth/reset-password page
  - /auth/callback page for OAuth redirect handling
  - /mypage page with profile view/edit and logout
  - GNB wired to auth state (avatar, dropdown, login link)

affects: [phase-02, booking-flow, admin]

tech-stack:
  added: [zustand]
  patterns: [zustand-store-pattern, api-client-with-refresh, auth-guard-pattern, silent-auth-init]

key-files:
  created:
    - apps/web/stores/use-auth-store.ts
    - apps/web/lib/api-client.ts
    - apps/web/lib/auth.ts
    - apps/web/components/auth/auth-guard.tsx
    - apps/web/components/auth/auth-initializer.tsx
    - apps/web/components/auth/login-form.tsx
    - apps/web/components/auth/signup-form.tsx
    - apps/web/components/auth/signup-step1.tsx
    - apps/web/components/auth/signup-step2.tsx
    - apps/web/components/auth/signup-step3.tsx
    - apps/web/components/auth/phone-verification.tsx
    - apps/web/components/auth/profile-form.tsx
    - apps/web/app/auth/page.tsx
    - apps/web/app/auth/reset-password/page.tsx
    - apps/web/app/auth/callback/page.tsx
    - apps/web/app/mypage/page.tsx
  modified:
    - apps/web/app/layout.tsx
    - apps/web/components/layout/gnb.tsx
    - apps/web/next.config.ts
    - apps/web/package.json
    - packages/shared/src/index.ts
    - packages/shared/src/types/auth.types.ts

key-decisions:
  - "Access token stored in Zustand (memory-only), never localStorage -- follows security best practice"
  - "API client uses module-level promise deduplication for concurrent 401 refresh requests"
  - "AuthInitializer runs in root layout via useEffect for silent session restoration on every page load"
  - "Password reset always shows success state regardless of email existence (prevents enumeration)"
  - "OAuth callback page handles both existing users (direct login) and new users (terms + additional info flow)"
  - "Fixed shared package imports from .js to extensionless for Turbopack compatibility"

patterns-established:
  - "Zustand store pattern: 'use client' directive, create<T>() with typed interface, getState() for non-React contexts"
  - "API client pattern: typed generic methods (get<T>, post<T>, patch<T>), automatic Bearer token injection, 401 refresh with deduplication"
  - "AuthGuard pattern: check isInitialized then accessToken, show spinner during init, redirect to /auth if unauthenticated"
  - "Form pattern: react-hook-form + zodResolver with shared schema, onBlur mode then onChange revalidation"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07]

duration: 17min
completed: 2026-03-27
---

# Phase 01 Plan 05: Frontend Auth Pages Summary

**Complete frontend auth flow with Zustand store, API client with token refresh, 5 pages (/auth login+signup, /auth/reset-password, /auth/callback, /mypage), and auth-aware GNB**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-27T09:10:47Z
- **Completed:** 2026-03-27T09:28:46Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- Zustand auth store managing access tokens in memory with silent refresh on page load for session persistence (AUTH-06)
- API client with automatic 401 refresh and concurrent request deduplication -- all API calls go through this typed wrapper
- Complete login flow: email/password form with zod validation, social login buttons redirecting to OAuth, inline error messages per D-08
- 3-step signup flow: email/password (Step 1), terms agreement with "select all" and individual view dialogs (Step 2), additional info with gender/country/birthdate/phone SMS verification (Step 3)
- Phone verification component with countdown timer, code input, re-send, and verified state indicator
- OAuth callback handling for both existing users (auto-login) and new social users (terms + additional info)
- Profile page with editable name/phone (re-verification required) and read-only email/gender/birthdate
- GNB wired to auth store showing user avatar + dropdown when authenticated, login link when not

## Task Commits

Each task was committed atomically:

1. **Task 1: Build API client with token refresh, Zustand auth store, and AuthGuard** - `7d7a5af` (feat)
2. **Task 2: Build /auth page (login/signup tabs), /auth/reset-password, /auth/callback, and /mypage** - `8213dfb` (feat)

## Files Created/Modified

- `apps/web/stores/use-auth-store.ts` - Zustand auth store with accessToken, user, isInitialized
- `apps/web/lib/api-client.ts` - Fetch wrapper with Bearer token, 401 refresh, request deduplication
- `apps/web/lib/auth.ts` - initializeAuth() for silent session restoration
- `apps/web/components/auth/auth-guard.tsx` - Protected route wrapper (redirect to /auth)
- `apps/web/components/auth/auth-initializer.tsx` - Root layout client component calling initializeAuth on mount
- `apps/web/components/auth/login-form.tsx` - Email/password form with social login buttons
- `apps/web/components/auth/signup-form.tsx` - 3-step signup orchestrator with StepIndicator
- `apps/web/components/auth/signup-step1.tsx` - Email + password + confirm step
- `apps/web/components/auth/signup-step2.tsx` - Terms agreement with select all and view dialogs
- `apps/web/components/auth/signup-step3.tsx` - Additional info (name, gender, country, birthdate, phone)
- `apps/web/components/auth/phone-verification.tsx` - SMS code send, countdown timer, verify, re-send
- `apps/web/components/auth/profile-form.tsx` - Profile view/edit with phone re-verification
- `apps/web/app/auth/page.tsx` - Login/signup tabs page
- `apps/web/app/auth/reset-password/page.tsx` - Password reset request page
- `apps/web/app/auth/callback/page.tsx` - OAuth redirect handler (existing + new users)
- `apps/web/app/mypage/page.tsx` - Profile page with AuthGuard
- `apps/web/app/layout.tsx` - Added AuthInitializer
- `apps/web/components/layout/gnb.tsx` - Wired to useAuthStore for auth-aware rendering
- `apps/web/next.config.ts` - Added turbopack.root for worktree resolution
- `apps/web/package.json` - Added zustand dependency
- `packages/shared/src/index.ts` - Fixed imports to extensionless for Turbopack
- `packages/shared/src/types/auth.types.ts` - Fixed import to extensionless

## Decisions Made

- **Memory-only token storage:** Access token in Zustand store (never localStorage). Refresh token is httpOnly cookie managed by browser. Follows OWASP best practice.
- **Refresh deduplication:** Module-level promise variable ensures concurrent 401 responses share a single refresh call, preventing token race conditions.
- **Email enumeration prevention:** Password reset always shows success message regardless of whether email exists in the system.
- **Extensionless imports for shared package:** Changed `.js` extensions to extensionless in shared/src/index.ts and auth.types.ts for Turbopack compatibility. NestJS API still uses deep path imports with `.js` which remain unaffected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed shared package imports for Turbopack bundler**
- **Found during:** Task 2 (build verification)
- **Issue:** Turbopack could not resolve `.js` extension imports in packages/shared/src/index.ts (e.g., `./schemas/auth.schema.js`). The `moduleResolution: "bundler"` setting in tsconfig supports this for tsc, but Turbopack's module resolution in the Next.js build context failed to map `.js` to `.ts` for workspace packages.
- **Fix:** Changed all imports in shared/src/index.ts and shared/src/types/auth.types.ts from `.js` extensions to extensionless imports. Also set `turbopack.root` in next.config.ts to the monorepo root for correct workspace resolution.
- **Files modified:** packages/shared/src/index.ts, packages/shared/src/types/auth.types.ts, apps/web/next.config.ts
- **Verification:** `pnpm --filter @grapit/web build` passes, `pnpm --filter @grapit/shared typecheck` passes
- **Committed in:** 8213dfb (Task 2 commit)

**2. [Rule 3 - Blocking] Installed zustand dependency**
- **Found during:** Task 1 (pre-implementation)
- **Issue:** zustand was not yet installed in the web app package.json despite being in the tech stack
- **Fix:** Ran `pnpm --filter @grapit/web add zustand`
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** Import resolves, build passes
- **Committed in:** 7d7a5af (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were necessary for the build to succeed. No scope creep.

## Known Stubs

- `apps/web/components/auth/signup-step2.tsx` lines 26, 31: Terms of service and privacy policy dialog content are placeholder text ("...내용이 여기에 표시됩니다. 실제 서비스 런칭 전에 법률 검토를 거친 약관으로 교체해야 합니다."). This is intentional per plan -- actual legal content requires lawyer review before launch. Not blocking any functionality.

## Issues Encountered

- Turbopack root inference was incorrect due to worktree setup (detecting a lockfile in a parent directory). Resolved by explicitly setting `turbopack.root` in next.config.ts.

## User Setup Required

None - no external service configuration required. All API calls target `NEXT_PUBLIC_API_URL` which defaults to `http://localhost:8080`.

## Next Phase Readiness

- Complete auth frontend flow ready for integration testing with backend
- All 7 AUTH requirements covered (AUTH-01 through AUTH-07)
- Phase 1 foundation-auth is fully complete (5/5 plans)
- Ready for Phase 2 development (performance catalog, search, etc.)

## Self-Check: PASSED

- All 16 created files verified on disk
- Commit 7d7a5af (Task 1) verified in git log
- Commit 8213dfb (Task 2) verified in git log
- `pnpm --filter @grapit/web build` passes with all 5 auth pages generated

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-27*
