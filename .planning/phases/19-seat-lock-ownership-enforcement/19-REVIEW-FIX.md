---
phase: 19-seat-lock-ownership-enforcement
fixed_at: 2026-04-29T09:20:24Z
review_path: .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-04-29T09:20:24Z
**Source review:** .planning/phases/19-seat-lock-ownership-enforcement/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: BLOCKER - Redis lock을 DB sold 전환 전에 삭제해 double booking 창을 만듭니다

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** 15fe852
**Applied fix:** Toss confirm 이후 좌석 lock consume을 DB sold 전환 뒤 best-effort cleanup으로 이동했고, sold 전환은 조건부 insert/update 결과를 확인해 이미 판매된 좌석이면 reservation commit 전에 중단하도록 강화했습니다.

### CR-02: BLOCKER - 같은 orderId confirm을 서버에서 serialize하지 않습니다

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`, `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`, `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** e0c3c4f
**Applied fix:** `orderId` 단위 Redis `NX` lock을 추가해 confirm path를 serialize하고, token 비교 Lua release 및 in-memory Redis 회귀 테스트를 추가했습니다.

### CR-03: BLOCKER - 서버가 좌석 tier/metadata를 클라이언트 payload에서 신뢰합니다

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** b6d7d3a
**Applied fix:** duplicate `seatId`를 거부하고, 가능한 경우 `seat_maps.seat_config`와 `price_tiers`에서 canonical `tierName`/`price`를 도출해 prepare amount와 `reservation_seats` insert에 사용하도록 변경했습니다.

### WR-01: WARNING - `getMyLocks()`가 잘못된 Redis key로 TTL을 조회합니다

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/booking/booking.service.ts`, `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`
**Commit:** 804ff33
**Applied fix:** TTL 조회 key를 실제 lock key인 `{showtimeId}:seat:{seatId}` 형식으로 맞추고, 여러 owned seat 중 가장 이른 만료 시각을 반환하도록 회귀 테스트를 추가했습니다.

### WR-02: WARNING - complete page가 `amount` 누락/비정상 값에서 무한 loading에 빠집니다

**Status:** fixed: requires human verification
**Files modified:** `apps/web/app/booking/[performanceId]/complete/page.tsx`, `apps/web/e2e/toss-payment.spec.ts`
**Commit:** 3d20e0e
**Applied fix:** `amount` query param을 finite positive number로 검증한 뒤에만 confirm mutation을 실행하고, 누락/비정상 값은 invalid access 상태로 렌더링하도록 변경했습니다.

### WR-03: WARNING - InMemoryRedis `del()`이 set key와 TTL timer를 삭제하지 않습니다

**Status:** fixed
**Files modified:** `apps/api/src/modules/booking/providers/redis.provider.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`
**Commit:** 528222c
**Applied fix:** in-memory Redis `del()`이 string store, set store, TTL timer, expiry metadata를 모두 정리하고 삭제 count를 반환하도록 구현했습니다.

### WR-04: WARNING - prepare idempotency가 기존 reservation의 상태와 요청 일치 여부를 검증하지 않습니다

**Status:** fixed: requires human verification
**Files modified:** `apps/api/src/modules/reservation/reservation.service.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
**Commit:** 764ab47
**Applied fix:** 기존 `orderId`가 `PENDING_PAYMENT` 상태인지, showtime/amount/canonical seats가 요청과 동일한지 확인한 뒤에만 idempotent response를 반환하도록 강화했습니다.

## Verification

- Passed: `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider --reporter=verbose` (29 files, 355 tests)
- Passed: `pnpm --filter @grabit/shared build`
- Passed: `pnpm --filter @grabit/api typecheck`
- Passed: `pnpm --filter @grabit/api test:integration -- booking.service.integration --reporter=verbose` (4 files, 35 tests)
- Passed: `pnpm --filter @grabit/web typecheck`
- Passed: `pnpm --filter @grabit/web test -- --reporter=verbose` (27 files, 190 tests)
- Skipped by env gate: `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` (6 skipped; `TOSS_CLIENT_KEY_TEST` not set)

---

_Fixed: 2026-04-29T09:20:24Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
