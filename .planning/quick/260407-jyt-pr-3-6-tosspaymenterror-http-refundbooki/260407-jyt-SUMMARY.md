# Quick Task 260407-jyt: Summary

**Task:** PR #3 코드리뷰 6개 이슈 수정
**Date:** 2026-04-07
**Duration:** ~7min

## Commits

| Hash | Message |
|------|---------|
| 21e5afd | fix(quick-260407-jyt): add Toss confirm compensation pattern + TossPaymentExceptionFilter |
| ab7995e | fix(quick-260407-jyt): restore seats on admin refund + unlock Redis on confirm expire |
| b92bc1f | refactor(quick-260407-jyt): eliminate N+1 queries in getMyReservations and getBookings |

## Issues Resolved

### Issue 1: Toss confirm 후 DB 실패 시 복구 경로 없음
- `confirmAndCreateReservation()`에 try-catch 보상 패턴 추가
- DB 트랜잭션 실패 시 `tossClient.cancelPayment()` 자동 호출
- 보상 취소도 실패 시 CRITICAL 로그로 수동 환불 추적 가능

### Issue 2: TossPaymentError가 500으로 반환
- `TossPaymentExceptionFilter` 생성 (`apps/api/src/common/filters/`)
- Toss 에러 코드별 HTTP 상태 매핑: 400 (카드거절 등), 409 (중복결제), 502 (기타)
- `main.ts`에 전역 필터 등록

### Issue 3: refundBooking() 좌석 복원/WS 브로드캐스트 누락
- DB 트랜잭션 내에서 `seatInventories`를 `available`로 복원
- 트랜잭션 후 `BookingGateway.broadcastSeatUpdate()` 호출
- `AdminModule`에 `BookingModule` import 추가로 DI 해결

### Issue 5: confirm 페이지 handleExpire Redis 잠금 미해제
- `useUnlockAllSeats` hook import 및 호출
- `handleExpire`에서 `unlockAll.mutate()` fire-and-forget 호출 후 redirect

### Issue 6: N+1 쿼리 (getMyReservations + getBookings)
- 개별 루프 쿼리를 `inArray` 일괄 조회 + Map 그룹핑으로 교체
- 빈 결과 방어 (reservationIds.length > 0 체크)

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/modules/reservation/reservation.service.ts` | 보상 패턴 + N+1 해소 |
| `apps/api/src/common/filters/toss-payment-exception.filter.ts` | 신규: Toss 에러 HTTP 매핑 |
| `apps/api/src/main.ts` | 전역 필터 등록 |
| `apps/api/src/modules/admin/admin-booking.service.ts` | 좌석 복원 + N+1 해소 |
| `apps/api/src/modules/admin/admin.module.ts` | BookingModule import |
| `apps/web/app/booking/[performanceId]/confirm/page.tsx` | Redis 해제 |
