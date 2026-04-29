---
phase: 19-seat-lock-ownership-enforcement
fixed_at: 2026-04-29T09:51:15Z
review_path: .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-04-29T09:51:15Z
**Source review:** .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: BLOCKER - Confirm can sell seats after the user's lock expired during Toss confirm

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`, `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`, `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** ba626c1
**Applied fix:** Added `extendOwnedSeatLocks()` backed by Lua to atomically verify and extend all owned seat locks before Toss confirm, then re-checks ownership after Toss and cancels the Toss payment without marking seats sold if ownership is lost.

### CR-02: BLOCKER - The same-order confirm lock can expire before the request finishes

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`, `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`, `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** c06e60b
**Applied fix:** Added token-checked confirm-lock refresh/heartbeat around the confirm request and Toss boundary. The DB error path now re-reads committed payment state before compensation so duplicate/idempotent insert races do not cancel a payment that already committed.

### CR-03: BLOCKER - Missing seat map config still lets clients choose tier and price metadata

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** 50fc4ea
**Applied fix:** Removed client payload fallback when `seat_maps.seat_config` is missing, malformed, or empty. Canonical seat pricing now fails closed with `BadRequestException('좌석 배치 정보가 유효하지 않습니다')`.

### WR-01: WARNING - Complete page recovery failures still fall into an endless spinner

**Status:** fixed: requires human verification
**Files modified:** `apps/web/app/booking/[performanceId]/complete/page.tsx`, `apps/web/e2e/toss-payment.spec.ts`
**Commit:** 7bd9c52
**Applied fix:** Complete page recovery now observes `isFetched`/`isError` from `useReservationByOrderId()` and renders a terminal failed state when no confirmed reservation can be recovered. Added an E2E regression for non-lock confirm failure followed by recovery failure.

## Verification

- Passed: `pnpm --filter @grabit/shared build`
- Passed: `pnpm --filter @grabit/api typecheck`
- Passed: `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider --reporter=verbose` (29 files, 368 tests)
- Passed: `pnpm --filter @grabit/api test:integration -- booking.service.integration --reporter=verbose` (4 files, 35 tests)
- Passed: `pnpm --filter @grabit/web typecheck`
- Passed: `pnpm --filter @grabit/web test -- --reporter=verbose` (27 files, 190 tests)
- Skipped by env gate: `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` (7 skipped; `TOSS_CLIENT_KEY_TEST` not set)

## Skipped Issues

None.

---

_Fixed: 2026-04-29T09:51:15Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
