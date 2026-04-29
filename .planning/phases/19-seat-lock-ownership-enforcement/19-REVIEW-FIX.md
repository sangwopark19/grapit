---
phase: 19-seat-lock-ownership-enforcement
fixed_at: 2026-04-29T10:07:10Z
review_path: .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
iteration: 3
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-04-29T10:07:10Z
**Source review:** .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: BLOCKER - Post-Toss confirm-lock refresh exception skips compensation cancel

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** 04e6b78
**Applied fix:** Wrapped the post-Toss `refreshPaymentConfirmLock()` call in a compensation path. If Redis refresh throws after Toss approval, the service logs the failure, attempts Toss cancellation with a dedicated reason, and throws `InternalServerErrorException` before any DB sold transition. Added a regression test that verifies `cancelPayment()` runs and `db.transaction()` does not.

### WR-01: WARNING - InMemoryRedis SET keeps stale TTL when overwriting without EX/PX

**Status:** fixed
**Files modified:** `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`
**Commit:** d1a958d
**Applied fix:** `InMemoryRedis.set()` now clears any previous timeout and expiry metadata before storing the new value, then only registers a new TTL when EX/PX is supplied. Added provider coverage proving `SET key value` clears a previous TTL like real Redis.

### WR-02: WARNING - Valkey integration spec does not exercise the production Lua scripts it claims to verify

**Status:** fixed
**Files modified:** `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts`
**Commit:** e01f3c6
**Applied fix:** Replaced copied Lua script execution with real Valkey-backed `BookingService.lockSeat()`, `getSeatStatus()`, and `unlockSeat()` calls so production scripts are exercised through the service path. Added a source guard that fails if copied Lua constants are reintroduced into the integration spec.

## Verification

- Passed: `pnpm --filter @grabit/api test -- reservation.service --reporter=verbose` (29 files, 369 tests)
- Passed: `pnpm --filter @grabit/api test -- redis.provider --reporter=verbose` (29 files, 370 tests)
- Passed: `pnpm --filter @grabit/api test:integration -- booking.service.integration --reporter=verbose` (4 files, 36 tests)
- Passed: `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider --reporter=verbose` (29 files, 370 tests)
- Passed: `pnpm --filter @grabit/shared build`
- Passed: `pnpm --filter @grabit/api typecheck`

## Skipped Issues

None.

---

_Fixed: 2026-04-29T10:07:10Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
