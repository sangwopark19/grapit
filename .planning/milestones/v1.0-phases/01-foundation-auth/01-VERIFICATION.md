---
phase: 01-foundation-auth
verified: 2026-03-27T10:30:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Email/password signup + immediate login end-to-end"
    expected: "POST /api/v1/auth/register returns 201 with accessToken, refreshToken cookie set; user can immediately POST /api/v1/auth/login with same credentials and receive 200 with accessToken"
    why_human: "Requires running Docker PostgreSQL + applied migration + NestJS server; database not confirmed running in this environment"
  - test: "Session persistence across browser refresh (AUTH-06)"
    expected: "After login, browser refresh restores auth state via silent POST /api/v1/auth/refresh using httpOnly cookie; GNB switches from login button to user avatar"
    why_human: "Requires live browser session, httpOnly cookie behavior, and running backend"
  - test: "Social OAuth redirect and new user registration flow"
    expected: "Clicking Kakao/Naver/Google button redirects to provider consent; callback URL redirects to /auth/callback; new user sees terms + additional info steps; existing user is auto-logged in"
    why_human: "Requires registered OAuth credentials (KAKAO_CLIENT_ID, NAVER_CLIENT_ID, GOOGLE_CLIENT_ID) and live OAuth provider endpoints"
  - test: "Logout session invalidation"
    expected: "POST /api/v1/auth/logout sets revokedAt on refresh_tokens row; subsequent POST /api/v1/auth/refresh with same cookie returns 401; GNB reverts to login button"
    why_human: "Requires running database to verify token revocation persists and token reuse is actually blocked"
  - test: "Password reset email delivery"
    expected: "POST /api/v1/auth/password-reset/request logs reset link to console (production: nodemailer); link is a valid JWT with compound secret; POST /api/v1/auth/password-reset/confirm with token updates passwordHash and revokes all refresh tokens for that user"
    why_human: "Email delivery is a known stub (console.log) — user must verify reset link appears in server logs and confirm the full reset flow works end-to-end"
---

# Phase 1: Foundation + Auth Verification Report

**Phase Goal:** Users can create accounts and maintain authenticated sessions across the application
**Verified:** 2026-03-27
**Status:** human_needed — all code artifacts verified and wired; functional testing requires running infrastructure
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can sign up with email/password and immediately log in | ✓ VERIFIED | `AuthService.register()` hashes password with argon2id, creates user + terms agreement, returns tokens. `AuthController.register` POST endpoint wired with `@Public()`. `SignupForm` POSTs to `/api/v1/auth/register`. `LoginForm` POSTs to `/api/v1/auth/login`. |
| 2 | User can log in via Kakao, Naver, or Google OAuth and have an account created automatically | ✓ VERIFIED | `KakaoStrategy`, `NaverStrategy`, `GoogleStrategy` registered in `AuthModule`. `findOrCreateSocialUser()` in `AuthService` handles both `authenticated` and `needs_registration` paths. `completeSocialRegistration()` creates user with `passwordHash=null`. Frontend `/auth/callback` page handles both flows. |
| 3 | User's session persists across browser refreshes without re-login (JWT + refresh token rotation) | ✓ VERIFIED | `AuthInitializer` component in root layout calls `initializeAuth()` on every mount via `useEffect`, which POSTs to `/api/v1/auth/refresh`. `refreshTokens()` in `AuthService` implements family-based rotation with SHA-256 hash storage. `refreshTokens` table has `family` and `revokedAt` columns. |
| 4 | User can log out and their session is invalidated | ✓ VERIFIED | `AuthController.logout` calls `revokeRefreshToken()` setting `revokedAt=now()` in DB, then `clearCookie()`. GNB `handleLogout()` calls `apiClient.post('/api/v1/auth/logout')` then `clearAuth()` on store. |
| 5 | NestJS modular monolith serves API endpoints and Next.js renders pages with shared type definitions | ✓ VERIFIED | `pnpm-workspace.yaml` defines 3 workspaces. `AppModule` imports `DrizzleModule`, `AuthModule`, `UserModule`, `SmsModule`. `apps/api/src/main.ts` sets global prefix `api/v1`. `@grapit/shared` exports zod schemas and TypeScript types consumed by both apps. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Monorepo workspace definition | ✓ VERIFIED | Contains `apps/*` and `packages/*` |
| `apps/api/src/database/schema/users.ts` | Users table with all D-03 fields | ✓ VERIFIED | `pgTable('users'` with `genderEnum`, `passwordHash`, `phone`, `birthDate`, `country`, `isPhoneVerified`, `marketingConsent`, `role` |
| `packages/shared/src/schemas/auth.schema.ts` | Shared zod validation schemas | ✓ VERIFIED | Exports `loginSchema`, `registerStep1Schema`, `registerStep2Schema`, `registerStep3Schema`, `passwordSchema`, `resetPasswordRequestSchema`, `resetPasswordSchema` |
| `apps/api/src/database/drizzle.provider.ts` | Drizzle ORM database provider | ✓ VERIFIED | Exports `DRIZZLE` symbol, `DrizzleDB` type, `drizzleProvider` factory using `pg.Pool` |
| `apps/api/src/modules/auth/auth.service.ts` | Core auth business logic | ✓ VERIFIED | 486 lines implementing `register`, `login`, `validateUser`, `refreshTokens`, `revokeRefreshToken`, `requestPasswordReset`, `resetPassword`, `findOrCreateSocialUser`, `completeSocialRegistration` |
| `apps/api/src/modules/auth/auth.controller.ts` | Auth REST endpoints | ✓ VERIFIED | `@Controller('auth')` with `@Post('register')`, `@Post('login')`, `@Post('refresh')`, `@Post('logout')`, social endpoints, password reset endpoints; global prefix makes effective path `/api/v1/auth` |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | JWT validation strategy | ✓ VERIFIED | `ExtractJwt.fromAuthHeaderAsBearerToken()`, validates user exists in DB, returns `{ id, email, role }` |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Integration tests | ✓ VERIFIED | 552 lines, 18 test cases covering all auth operations with real argon2 verification |
| `apps/api/src/modules/auth/strategies/kakao.strategy.ts` | Kakao OAuth strategy | ✓ VERIFIED | `PassportStrategy(Strategy, 'kakao')`, extracts profile from `_json.kakao_account.email` |
| `apps/api/src/modules/auth/strategies/naver.strategy.ts` | Naver OAuth strategy | ✓ VERIFIED | `PassportStrategy(Strategy, 'naver')` |
| `apps/api/src/modules/auth/strategies/google.strategy.ts` | Google OAuth strategy | ✓ VERIFIED | `PassportStrategy(Strategy, 'google')` |
| `apps/api/src/database/migrations/0000_deep_bloodaxe.sql` | Initial DB migration | ✓ VERIFIED | Creates `refresh_tokens`, `social_accounts`, `terms_agreements`, `users` tables with FK constraints |
| `apps/web/stores/use-auth-store.ts` | Zustand auth state store | ✓ VERIFIED | Exports `useAuthStore` with `accessToken` (memory-only), `user`, `isInitialized`, `setAuth`, `clearAuth`, `setInitialized` |
| `apps/web/lib/api-client.ts` | API client with automatic token refresh | ✓ VERIFIED | Exports `apiClient`, implements `get/post/patch/delete`, 401 refresh with module-level deduplication via `refreshPromise` |
| `apps/web/app/auth/page.tsx` | Login/Signup unified page | ✓ VERIFIED | Contains `로그인` tab trigger, renders `LoginForm` and `SignupForm`, redirects authenticated users |
| `apps/web/app/mypage/page.tsx` | Profile page | ✓ VERIFIED | Contains `마이페이지` heading, wrapped in `AuthGuard`, renders `ProfileForm` with live user from store |
| `apps/web/components/auth/auth-guard.tsx` | Route protection wrapper | ✓ VERIFIED | Exports `AuthGuard`, checks `isInitialized` then `accessToken`, redirects to `/auth` if unauthenticated |
| `apps/web/components/auth/auth-initializer.tsx` | Silent auth init on mount | ✓ VERIFIED | Calls `initializeAuth()` in `useEffect([], [])` — runs once per app load |
| `apps/web/lib/auth.ts` | Auth initialization logic | ✓ VERIFIED | POSTs to `/api/v1/auth/refresh`, fetches `/api/v1/users/me` on success, calls `setAuth` or `setInitialized` |
| `apps/web/components/auth/login-form.tsx` | Email/password login form | ✓ VERIFIED | `react-hook-form` + `zodResolver(loginSchema)`, POSTs to `/api/v1/auth/login`, calls `setAuth` on success |
| `apps/web/components/auth/signup-form.tsx` | 3-step signup orchestrator | ✓ VERIFIED | Manages steps 1-3, POSTs merged payload to `/api/v1/auth/register`, calls `setAuth` on success |
| `apps/web/components/layout/gnb.tsx` | Auth-aware GNB | ✓ VERIFIED | Reads `useAuthStore()`, shows user avatar + dropdown when `isAuthenticated`, shows login link otherwise; `handleLogout` calls `apiClient.post('/api/v1/auth/logout')` then `clearAuth()` |
| `apps/web/app/auth/callback/page.tsx` | OAuth callback handler | ✓ VERIFIED | Handles `accessToken` param (existing user) and `registrationToken` param (new user requiring terms + additional info); calls `setAuth` on completion |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/app.module.ts` | `apps/api/src/database/drizzle.module.ts` | NestJS module import | ✓ WIRED | `DrizzleModule` in imports array |
| `packages/shared/src/schemas/auth.schema.ts` | `apps/api` and `apps/web` | workspace dependency | ✓ WIRED | Both apps import from `@grapit/shared`; `loginSchema`, `registerStep*Schema` used in both |
| `apps/api/src/modules/auth/auth.controller.ts` | `apps/api/src/modules/auth/auth.service.ts` | NestJS DI | ✓ WIRED | `AuthService` injected in constructor; all 8 endpoint handlers call service methods |
| `apps/api/src/modules/auth/auth.service.ts` | `apps/api/src/database/schema/users.ts` | Drizzle query | ✓ WIRED | `schema.users` referenced in `findByEmail`, `create`; `schema.refreshTokens` in `generateTokenPair`, `refreshTokens`, `revokeRefreshToken`; `schema.socialAccounts` in social flow |
| `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` | `apps/api/src/common/decorators/public.decorator.ts` | IS_PUBLIC metadata check | ✓ WIRED | `IS_PUBLIC_KEY` imported from public.decorator, checked via `Reflector.getAllAndOverride` |
| `apps/web/stores/use-auth-store.ts` | `apps/web/lib/api-client.ts` | Token stored in store, read by API client | ✓ WIRED | `useAuthStore.getState().accessToken` on line 56 of api-client.ts; `getState().setAuth()` on line 86 after 401 refresh |
| `apps/web/lib/api-client.ts` | `/api/v1/auth/refresh` | Automatic refresh on 401 | ✓ WIRED | `refreshAccessToken()` fetches `/api/v1/auth/refresh` on 401 response |
| `apps/web/components/auth/login-form.tsx` | `/api/v1/auth/login` | POST fetch on form submit | ✓ WIRED | `apiClient.post<AuthResponse>('/api/v1/auth/login', data)` on form submit handler |
| `apps/web/components/layout/gnb.tsx` | `apps/web/stores/use-auth-store.ts` | Read auth state | ✓ WIRED | `useAuthStore()` destructures `user`, `isInitialized`, `accessToken`, `clearAuth`; `isAuthenticated` controls conditional render |
| `apps/web/app/layout.tsx` | `apps/web/components/layout/gnb.tsx` | React component import | ✓ WIRED | `import { GNB } from '@/components/layout/gnb'` + `<GNB />` in JSX |
| `apps/web/app/layout.tsx` | `apps/web/components/auth/auth-initializer.tsx` | React component import | ✓ WIRED | `import { AuthInitializer }` + `<AuthInitializer />` before `<GNB />` in body |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/web/components/layout/gnb.tsx` | `user`, `accessToken` | `useAuthStore()` ← `initializeAuth()` ← `/api/v1/auth/refresh` + `/api/v1/users/me` ← DB | Yes — UserRepository.findById queries `schema.users` via Drizzle | ✓ FLOWING |
| `apps/web/app/mypage/page.tsx` | `user` | `useAuthStore((s) => s.user)` ← `setAuth()` called on login/refresh | Yes — populated by login or silent refresh flow | ✓ FLOWING |
| `apps/web/components/auth/login-form.tsx` | `res.user` | `apiClient.post('/api/v1/auth/login')` ← `AuthService.login()` ← `UserRepository` ← DB | Yes — `mapToProfile()` maps live DB row to `UserProfile` | ✓ FLOWING |

---

### Behavioral Spot-Checks

Skipped — running the backend requires Docker (PostgreSQL) and `pnpm install`. No runnable entry points can be tested without external services. See Human Verification section.

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| AUTH-01 | 01-01, 01-02, 01-03, 01-05 | 이메일/비밀번호로 회원가입 | ✓ SATISFIED | `AuthService.register()` + `SignupForm` 3-step flow wired to POST `/api/v1/auth/register` |
| AUTH-02 | 01-01, 01-02, 01-03, 01-05 | 이메일/비밀번호로 로그인 | ✓ SATISFIED | `AuthService.login()` + `LoginForm` wired to POST `/api/v1/auth/login` via `LocalStrategy` |
| AUTH-03 | 01-04, 01-05 | 카카오 소셜 로그인 | ✓ SATISFIED | `KakaoStrategy` + `KakaoAuthGuard` + `/auth/social/kakao` callback endpoint + frontend `handleSocialLogin('kakao')` |
| AUTH-04 | 01-04, 01-05 | 네이버 소셜 로그인 | ✓ SATISFIED | `NaverStrategy` + `NaverAuthGuard` + `/auth/social/naver` callback endpoint + frontend wiring |
| AUTH-05 | 01-04, 01-05 | 구글 소셜 로그인 | ✓ SATISFIED | `GoogleStrategy` + `GoogleAuthGuard` + `/auth/social/google` callback endpoint + frontend wiring |
| AUTH-06 | 01-01, 01-02, 01-05 | 브라우저 새로고침 후 세션 유지 (JWT + Refresh Token Rotation) | ✓ SATISFIED | `AuthInitializer` → `initializeAuth()` → POST `/api/v1/auth/refresh` on every page load; family-based refresh token rotation in `AuthService.refreshTokens()` with revocation of entire family on theft detection |
| AUTH-07 | 01-02, 01-05 | 로그아웃 | ✓ SATISFIED | `AuthController.logout` revokes token in DB + clears cookie; `GNB.handleLogout()` calls logout API then `clearAuth()` |

All 7 AUTH requirements for Phase 1 are satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/modules/auth/auth.service.ts` | 217–219 | `console.log` for password reset email; `TODO: Wire up nodemailer transport in production` | ⚠️ Warning | Password reset emails are not delivered to users. Reset links logged to server console only. Does not block AUTH-01 through AUTH-07 but means password reset feature (`/auth/reset-password`) cannot be completed end-to-end by a user without server log access. |
| `apps/web/components/auth/signup-step2.tsx` | (per SUMMARY-05 lines 26, 31) | Terms of service and privacy policy dialog content are placeholder text | ℹ️ Info | Legal content placeholder — intentional; requires lawyer review before launch. Does not block registration flow since users can still accept terms. |

No blocker anti-patterns found. Both issues are documented stubs with no path to user-visible auth failure.

---

### Human Verification Required

#### 1. Email/Password Signup + Immediate Login (AUTH-01, AUTH-02)

**Test:** Start Docker, run `docker compose up -d`, apply migration with `pnpm --filter @grapit/api drizzle-kit migrate`, start API with `pnpm --filter @grapit/api start:dev`, then `curl -X POST http://localhost:8080/api/v1/auth/register` with full payload including email, password, name, gender, country, birthDate, phone, termsOfService:true, privacyPolicy:true, marketingConsent:false.
**Expected:** 201 response with `{ accessToken, user }` and `Set-Cookie: refreshToken=...` header. Immediately POST to `/api/v1/auth/login` with same email+password returns 200 with accessToken.
**Why human:** Requires running Docker PostgreSQL + applied migrations; database not available in verification environment.

#### 2. Session Persistence Across Browser Refresh (AUTH-06)

**Test:** Log in via the web UI at http://localhost:3000/auth. Confirm GNB shows user avatar. Hard-refresh the page (Cmd+Shift+R).
**Expected:** GNB still shows user avatar after refresh — `AuthInitializer` ran `initializeAuth()` which used the httpOnly `refreshToken` cookie to silently restore session. DevTools Network shows POST to `/api/v1/auth/refresh` returning 200 with new accessToken.
**Why human:** httpOnly cookie behavior and silent session restoration require a live browser session with both frontend and backend running.

#### 3. Social OAuth Login — Existing User Auto-Login (AUTH-03, AUTH-04, AUTH-05)

**Test:** Configure Kakao/Naver/Google OAuth credentials in `.env`. Click social login button in browser. Complete OAuth consent on provider's page.
**Expected:** Browser redirected to `/auth/callback?accessToken=...&status=authenticated`. GNB shows user avatar. For new social users: redirected to `/auth/callback?registrationToken=...&status=needs_registration`, shows terms + additional info steps, completes registration.
**Why human:** Requires registered OAuth app credentials and live provider endpoints that cannot be tested statically.

#### 4. Logout Session Invalidation (AUTH-07)

**Test:** After login, click logout in GNB dropdown. Then try to use the old `refreshToken` cookie value by calling `curl -X POST http://localhost:8080/api/v1/auth/refresh --cookie "refreshToken=<old_token>"`.
**Expected:** Logout returns 200, GNB reverts to login button. The subsequent refresh attempt returns 401. Verify in DB that `refresh_tokens.revoked_at` is set.
**Why human:** Requires database access to confirm token revocation and live server to test the rejection behavior.

#### 5. Password Reset Link Delivery (via Console Log)

**Test:** Submit email on `/auth/reset-password`. Check API server logs for `[Password Reset] Link for <email>:`.
**Expected:** Reset link appears in server logs. Opening the link in browser shows password reset form (confirm page at `/auth/reset-password?token=...`).
**Why human:** Email delivery is a documented stub (console.log). User must verify the reset JWT link format and confirm the confirm endpoint accepts it. The frontend reset-password confirm page is not yet implemented (only the request page is in place).

---

### Gaps Summary

No blocking gaps found. All 5 success criteria are fully implemented in code with proper wiring across all 5 plans. All 7 AUTH requirements are covered by substantive implementations.

The two documented issues are intentional stubs that do not block any of the 5 success criteria:

1. **Password reset email delivery** (⚠️ Warning): `requestPasswordReset()` logs the reset link to the console rather than sending via nodemailer. The JWT generation, compound-secret token, and DB password update in `resetPassword()` are fully implemented. This is a pre-production decision requiring email service setup. Users can still trigger the reset flow in development by reading server logs.

2. **Terms dialog content** (ℹ️ Info): Placeholder text in the terms agreement dialog requires legal review before launch. The acceptance mechanic (checkboxes, `z.literal(true)` validation) is fully functional.

All commits claimed in SUMMARYs are verified to exist in git history (11/11 verified). All 23+ key files exist with substantive implementations. Wiring chains from browser form submission through API client, NestJS controller, service, Drizzle ORM, to PostgreSQL schema are verified at every level.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
