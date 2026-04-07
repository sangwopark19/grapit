# Quick Task 260407-fbi: 결제 완료된 좌석이 다시 결제 가능한 버그 수정

**Date:** 2026-04-07
**Status:** Complete

## Root Cause

`confirmAndCreateReservation()` 트랜잭션이 `seat_inventories` 테이블을 전혀 업데이트하지 않았음. 결제 확인 시 `reservations.status`만 `CONFIRMED`로 변경하고, `seat_inventories.status`는 `available` 상태로 방치. Redis 잠금도 10분 TTL 만료 후 자동 소멸되어 결제 완료된 좌석이 다시 선택/결제 가능해지는 치명적 버그.

## Changes

### Task 1: 결제 확인/취소 시 seat_inventories 상태 전환

**Files modified:**
- `apps/api/src/modules/reservation/reservation.service.ts` — confirmAndCreateReservation 트랜잭션에 seat_inventories sold 업데이트 + Redis 해제 + WS 브로드캐스트 추가. cancelReservation에 seat_inventories available 복원 + WS 브로드캐스트 추가.
- `apps/api/src/modules/reservation/reservation.module.ts` — BookingModule import 추가
- `apps/api/src/modules/booking/booking.module.ts` — BookingGateway export 추가
- `apps/api/src/modules/reservation/reservation.service.spec.ts` — 5개 신규 테스트 추가

**Commits:**
- `61ebc9e` test(quick-260407-fbi): add failing tests for seat sold marking and cancel restoration
- `ce44ed9` fix(quick-260407-fbi): seat_inventories sold marking + Redis unlock + WS broadcast on confirm/cancel

### Task 2: lockSeat() DB sold 방어 로직

**Files modified:**
- `apps/api/src/modules/booking/booking.service.ts` — Redis Lua 실행 전 DB sold 체크 추가
- `apps/api/src/modules/booking/booking.service.spec.ts` — 3개 신규 테스트 (새 파일)
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — mockNoSoldRecord helper 추가

**Commits:**
- `9244d9e` test(quick-260407-fbi): add failing test for lockSeat DB sold defense
- `ce3178b` fix(quick-260407-fbi): add DB sold check defense to lockSeat before Redis lock

## Verification

- 8개 신규 테스트 모두 통과
- 기존 테스트 회귀 없음
