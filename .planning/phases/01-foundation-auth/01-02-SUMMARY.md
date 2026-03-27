---
phase: 01-foundation-auth
plan: 02
subsystem: auth, api
tags: [nestjs, jwt, argon2, passport, refresh-token-rotation, zod, drizzle]

# Dependency graph
requires:
  - phase: 01-01
    provides: Monorepo scaffold, Drizzle schema (4 auth tables), shared zod schemas, NestJS common utilities
provides:
  - NestJS AuthService with register, login, JWT refresh rotation (family-based theft detection), logout, password reset
  - AuthController with 6 REST endpoints under /api/v1/auth
  - UserController with GET/PATCH /api/v1/users/me
  - Passport local + JWT strategies
  - Global JwtAuthGuard with @Public() opt-out
  - UserRepository (Drizzle-based) + UserService data access layer
  - 13 unit tests covering all auth operations
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: [@nestjs/jwt@10, @nestjs/passport@11, passport@0.7, passport-local@1, passport-jwt@4, argon2@0.44, nodemailer]
  patterns: [passport-strategy-pattern, jwt-refresh-rotation-with-family, global-jwt-guard-with-public-decorator, controller-service-repository-pattern, direct-instantiation-unit-tests]

key-files:
  created:
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/auth.controller.ts
    - apps/api/src/modules/auth/auth.service.spec.ts
    - apps/api/src/modules/auth/auth.module.ts
    - apps/api/src/modules/auth/dto/register.dto.ts
    - apps/api/src/modules/auth/dto/login.dto.ts
    - apps/api/src/modules/auth/dto/reset-password.dto.ts
    - apps/api/src/modules/auth/strategies/local.strategy.ts
    - apps/api/src/modules/auth/strategies/jwt.strategy.ts
    - apps/api/src/modules/auth/guards/jwt-auth.guard.ts
    - apps/api/src/modules/user/user.repository.ts
    - apps/api/src/modules/user/user.service.ts
    - apps/api/src/modules/user/user.module.ts
    - apps/api/src/modules/user/user.controller.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/package.json
    - apps/api/vitest.config.ts
    - package.json

key-decisions:
  - "Direct instantiation for unit tests instead of NestJS TestingModule (TestingModule compile hangs with mock providers)"
  - "argon2 hashed once in beforeAll for test perf (single hash ~500ms, avoids 13x repeated hashing)"
  - "Password reset uses JWT with user.passwordHash as additional entropy (token auto-invalidates on password change)"
  - "Refresh token stored as SHA-256 hash in DB (raw token in httpOnly cookie)"
  - "ConfigModule.forRoot loads authConfig namespace for typed JWT config access"

patterns-established:
  - "Auth module pattern: Controller -> Service -> Repository with Drizzle"
  - "Refresh token rotation: family-based grouping, SHA-256 hashing, theft detection via revoked-token reuse"
  - "Global JWT guard: APP_GUARD with @Public() decorator opt-out for public endpoints"
  - "Password hashing: argon2id with memoryCost=19456, timeCost=2, parallelism=1"
  - "Cookie security: httpOnly, secure in production, sameSite strict, path-scoped to /api/v1/auth"
  - "Unit test pattern: direct class instantiation with vi.fn() mocks (avoids NestJS DI overhead)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-06, AUTH-07]

# Metrics
duration: 17min
completed: 2026-03-27
---

# Phase 1 Plan 2: Auth Backend Summary

**NestJS auth backend with email register/login, argon2id password hashing, JWT access tokens (15m), refresh token rotation with family-based theft detection, logout with cookie revocation, and password reset via email link**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-27T08:03:01Z
- **Completed:** 2026-03-27T08:20:00Z
- **Tasks:** 2/2
- **Files modified:** 18

## Accomplishments
- Complete auth service with register, login, validateUser, refreshTokens, revokeRefreshToken, requestPasswordReset, resetPassword
- 6 REST endpoints: POST register, login, refresh, logout, password-reset/request, password-reset/confirm
- User profile endpoints: GET /users/me, PATCH /users/me
- Refresh token rotation with family-based theft detection (revoked token reuse revokes entire family)
- Global JwtAuthGuard protecting all routes by default, @Public() for opt-out
- 13 unit tests all passing with real argon2 verification

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests** - `79fdec7` (test)
2. **Task 1 GREEN: Implement AuthService, strategies, guards, DTOs, user module** - `9236272` (feat)
3. **Task 2: Add AuthController, UserController, wire app module** - `70dc173` (feat)

## Files Created/Modified
- `apps/api/src/modules/auth/auth.service.ts` - Core auth business logic (register, login, refresh rotation, logout, password reset)
- `apps/api/src/modules/auth/auth.controller.ts` - REST endpoints with cookie management and zod validation
- `apps/api/src/modules/auth/auth.service.spec.ts` - 13 unit tests covering all auth operations
- `apps/api/src/modules/auth/auth.module.ts` - Auth module with JwtModule, PassportModule, strategies
- `apps/api/src/modules/auth/dto/register.dto.ts` - Registration DTO with zod schema (merged 3-step fields)
- `apps/api/src/modules/auth/dto/login.dto.ts` - Login DTO re-exporting shared schema
- `apps/api/src/modules/auth/dto/reset-password.dto.ts` - Password reset DTOs
- `apps/api/src/modules/auth/strategies/local.strategy.ts` - Passport local strategy (email+password)
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` - Passport JWT strategy (Bearer token extraction)
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` - Global JWT guard with @Public() support via Reflector
- `apps/api/src/modules/user/user.repository.ts` - Drizzle-based user data access (findByEmail, findById, create, updatePassword, updateProfile)
- `apps/api/src/modules/user/user.service.ts` - User business logic with DB-to-UserProfile mapping
- `apps/api/src/modules/user/user.module.ts` - User module with controller, service, repository
- `apps/api/src/modules/user/user.controller.ts` - GET/PATCH /users/me with @CurrentUser() decorator
- `apps/api/src/app.module.ts` - Updated with AuthModule, UserModule, global JwtAuthGuard
- `apps/api/package.json` - Added auth dependencies
- `apps/api/vitest.config.ts` - Added hookTimeout/testTimeout for argon2 test perf
- `package.json` - Added argon2 to onlyBuiltDependencies

## Decisions Made
- Used direct class instantiation for unit tests instead of NestJS TestingModule -- TestingModule.compile() hangs (>30s timeout) with mock providers when emitDecoratorMetadata is enabled
- Pre-hash argon2 password once in beforeAll (instead of beforeEach) for test performance -- single hash takes ~500ms, 13 tests would waste 6.5s in setup
- Password reset uses compound JWT secret (JWT_SECRET + user.passwordHash) so token auto-invalidates when password changes
- AuthController uses `@Controller('auth')` (without prefix) because NestJS global prefix `api/v1` is set in main.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] NestJS TestingModule compilation timeout**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test.createTestingModule().compile() with mock providers hung for >30s per test run, causing all 13 tests to timeout (10s hookTimeout default)
- **Fix:** Switched to direct AuthService instantiation with vi.fn() mocks passed to constructor. Avoids NestJS DI resolution overhead entirely.
- **Files modified:** apps/api/src/modules/auth/auth.service.spec.ts
- **Verification:** All 13 tests pass in <1s total
- **Committed in:** 9236272

**2. [Rule 3 - Blocking] argon2 native build script blocked by pnpm**
- **Found during:** Task 1 (dependency installation)
- **Issue:** pnpm onlyBuiltDependencies did not include argon2, blocking native binary compilation
- **Fix:** Added argon2 to pnpm.onlyBuiltDependencies in root package.json
- **Files modified:** package.json
- **Committed in:** 9236272

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to unblock test execution. No scope creep.

## Issues Encountered
- NestJS TestingModule with emitDecoratorMetadata causes extremely slow compilation when providers include Symbol-based injection tokens (DRIZZLE). Resolved by using direct instantiation pattern for unit tests.

## Known Stubs
- `requestPasswordReset()` logs reset link to console instead of sending email via nodemailer (email transport not configured yet). Documented with TODO comment. Will be wired in production setup phase.

## User Setup Required
- Set JWT_SECRET and JWT_REFRESH_SECRET environment variables (see .env.example)
- Database must be running with migrations applied (from Plan 01)

## Next Phase Readiness
- Auth backend complete -- Plan 03 (frontend auth UI) can consume these endpoints
- All auth endpoints protected by default, @Public routes accessible without JWT
- UserProfile type matches shared/types/user.types.ts contract
- Cookie-based refresh token ready for frontend integration

## Self-Check: PASSED

- All 14 key files verified present
- Commit 79fdec7 (Task 1 RED) verified in git log
- Commit 9236272 (Task 1 GREEN) verified in git log
- Commit 70dc173 (Task 2) verified in git log
- 13/13 tests passing

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-27*
