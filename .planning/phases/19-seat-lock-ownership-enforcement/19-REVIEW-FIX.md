---
phase: 19-seat-lock-ownership-enforcement
fixed_at: 2026-04-30T02:17:49Z
review_path: .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-04-30T02:17:49Z
**Source review:** .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Pending-cancel can overwrite a confirmed paid reservation

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`
**Commit:** 6dc595a
**Applied fix:** `cancelPendingReservation()`의 update 조건에 `reservationId`, `userId`, `PENDING_PAYMENT` status를 모두 포함하고, 조건부 update 결과가 없으면 idempotent하게 반환하도록 수정했다.

### CR-02: Cancelled reservations are treated as successful payment confirmation

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`, `apps/web/app/booking/[performanceId]/complete/page.tsx`
**Commit:** 0414964
**Applied fix:** API는 `CONFIRMED`만 idempotent success로 반환하고 `CANCELLED`/`FAILED`는 conflict로 거절한다. Complete page도 confirm 응답 status가 `CONFIRMED`가 아니면 성공 화면에 반영하지 않는다. Cancelled confirm regression test를 추가했다.

### CR-03: Failed Toss compensation is swallowed and returned as a normal conflict

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** a9f2f68
**Applied fix:** post-confirm compensation helper `cancelConfirmedPaymentOrThrow()`를 추가해 Toss 승인 후 자동 취소 실패 시 manual refund가 필요한 `InternalServerErrorException`으로 전파되도록 했다. Compensation cancel 실패 regression test를 추가했다.

### CR-04: Seat locks are consumed before seats are durably marked sold

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** 8784718
**Applied fix:** Toss 승인 후에는 먼저 seat lock ownership만 검증하고, DB transaction이 reservation/payment/seat sold 상태를 commit한 뒤 Redis lock을 cleanup하도록 순서를 바꿨다. Post-commit cleanup 실패는 warning으로만 기록하고 DB sold 상태를 source of truth로 유지한다.

### WR-01: Stale user-seat cleanup counts locks owned by other users

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`
**Commit:** 7c21e56
**Applied fix:** lock Lua와 InMemoryRedis parity가 user-seats stale member의 current owner를 확인하도록 수정했다. 다른 사용자가 현재 소유한 lock은 현재 user count에서 제외하고 user set에서만 제거하며, missing lock일 때만 locked-seats set도 정리한다.

### WR-02: Payment confirmation shortens seat locks without refreshing them

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`, `apps/api/src/modules/reservation/reservation.service.ts`
**Commit:** 9aea079
**Applied fix:** `extendOwnedSeatLocks()` Lua와 InMemoryRedis parity가 기존 TTL이 더 길면 줄이지 않도록 변경했다. Payment confirm 중에는 order-level confirm lock과 별도로 owned seat locks를 주기적으로 refresh하고, DB sold commit 이후 cleanup 전에 refresh timer를 정리한다.

## Verification

- Passed: Tier 1 re-read for every modified section.
- Passed: `git diff --check HEAD~6..HEAD`
- Passed: `pnpm --filter @grabit/api typecheck`
- Passed: `pnpm --filter @grabit/web typecheck`
- Passed: `pnpm --filter @grabit/api test -- src/modules/booking/__tests__/booking.service.spec.ts src/modules/booking/providers/__tests__/redis.provider.spec.ts src/modules/reservation/reservation.service.spec.ts --reporter=verbose` (29 files, 374 tests)
- Passed: `pnpm --filter @grabit/web test -- hooks/__tests__/use-booking.test.tsx --reporter=verbose` (27 files, 190 tests; existing jsdom navigation/scrollTo and React act warnings remained non-failing)

## Skipped Issues

None.

---

_Fixed: 2026-04-30T02:17:49Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
