# Quick Task 260408-oow: Phase 04 코드리뷰 이슈 6건 수정

**Date:** 2026-04-08
**Status:** Complete

## Changes

### Task 1: cancelReservation 보상 트랜잭션 + SELECT FOR UPDATE (Issue 1, 3)
- `cancelReservation()`을 전면 리팩토링: 모든 검증과 Toss 호출을 DB 트랜잭션 내부로 이동
- `SELECT ... FOR UPDATE`로 reservation 행 잠금 → 동시 이중 취소 방지
- DB 실패 시 CRITICAL 로그 + InternalServerErrorException
- 테스트 업데이트: tx.execute mock 추가, 새 구조에 맞춘 테스트 수정

### Task 2: refundBooking 보상 트랜잭션 + toss-payments.client 타입 안전 (Issue 2, 4)
- `refundBooking()`에 try-catch 보상 패턴 적용 (CRITICAL 로그 + InternalServerError)
- Logger 인스턴스 추가
- `toss-payments.client.ts`: `response.json()` → `unknown` 타입 + typeof 타입 가드
- 암묵적 `any` 완전 제거

### Task 3: PENDING_PAYMENT 클린업 + 중복 테스트 통합 (Issue 5, 6)
- `cancelPendingReservation()` 서비스 메서드 + PUT 엔드포인트 추가
- `useCancelPendingReservation` hook 추가
- `handleExpire`에서 reservationIdRef가 있으면 cancel-pending API 호출
- `booking.service.spec.ts` 루트 파일 삭제, sold defense 테스트를 `__tests__/` 파일에 통합

## Commits
- `828d32b` fix(quick-260408-oow): cancelReservation SELECT FOR UPDATE + compensation transaction
- `461483d` fix(quick-260408-oow): refundBooking compensation + toss-payments.client type safety
- `e56b95f` feat(quick-260408-oow): cancelPendingReservation API + handleExpire cleanup + test consolidation

## Files Modified (9)
- `apps/api/src/modules/reservation/reservation.service.ts`
- `apps/api/src/modules/reservation/reservation.controller.ts`
- `apps/api/src/modules/reservation/reservation.service.spec.ts`
- `apps/api/src/modules/admin/admin-booking.service.ts`
- `apps/api/src/modules/payment/toss-payments.client.ts`
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`
- `apps/api/src/modules/booking/booking.service.spec.ts` (deleted)
- `apps/web/app/booking/[performanceId]/confirm/page.tsx`
- `apps/web/hooks/use-booking.ts`
