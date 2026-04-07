---
phase: quick
plan: 260407-jyt
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1: Compensation pattern + TossPaymentExceptionFilter
  - apps/api/src/modules/reservation/reservation.service.ts
  - apps/api/src/common/filters/toss-payment-exception.filter.ts
  - apps/api/src/main.ts
  # Task 2: refundBooking seat restore + confirm handleExpire unlock
  - apps/api/src/modules/admin/admin-booking.service.ts
  - apps/api/src/modules/admin/admin.module.ts
  - apps/web/app/booking/[performanceId]/confirm/page.tsx
  # Task 3: N+1 query resolution
  - apps/api/src/modules/reservation/reservation.service.ts
  - apps/api/src/modules/admin/admin-booking.service.ts
autonomous: true
must_haves:
  truths:
    - "Toss confirm 성공 후 DB 실패 시 자동 취소 보상 발생"
    - "TossPaymentError가 적절한 HTTP 상태코드(400/409/502)로 변환됨"
    - "관리자 환불 시 좌석이 available로 복원되고 WebSocket broadcast됨"
    - "confirm 페이지 만료 시 Redis 좌석 잠금 해제됨"
    - "getMyReservations/getBookings에서 N+1 쿼리 없이 일괄 조회"
  artifacts:
    - path: "apps/api/src/common/filters/toss-payment-exception.filter.ts"
      provides: "TossPaymentError -> HTTP status mapping filter"
    - path: "apps/api/src/modules/reservation/reservation.service.ts"
      provides: "Compensation pattern in confirmPayment + batch seat query in getMyReservations"
    - path: "apps/api/src/modules/admin/admin-booking.service.ts"
      provides: "Seat restore in refundBooking + batch seat query in getBookings"
  key_links:
    - from: "toss-payment-exception.filter.ts"
      to: "main.ts"
      via: "app.useGlobalFilters()"
      pattern: "useGlobalFilters.*TossPaymentExceptionFilter"
    - from: "admin-booking.service.ts refundBooking"
      to: "BookingGateway"
      via: "broadcastSeatUpdate()"
      pattern: "bookingGateway\\.broadcastSeatUpdate"
---

<objective>
PR #3 코드리뷰에서 발견된 6개 이슈를 수정한다. 결제 보상 패턴, TossPaymentError HTTP 변환, 환불 시 좌석 복원, confirm 만료 시 Redis 해제, N+1 쿼리 해소.

Purpose: 결제 실패 시 사용자 과금 방지, 적절한 에러 응답, 좌석 상태 정합성, DB 성능 개선
Output: 6개 버그 수정 커밋
</objective>

<execution_context>
@.planning/STATE.md
</execution_context>

<context>
@apps/api/src/modules/reservation/reservation.service.ts
@apps/api/src/modules/payment/toss-payments.client.ts
@apps/api/src/modules/admin/admin-booking.service.ts
@apps/api/src/modules/admin/admin.module.ts
@apps/api/src/common/filters/http-exception.filter.ts
@apps/api/src/main.ts
@apps/api/src/modules/booking/booking.module.ts
@apps/api/src/modules/booking/booking.gateway.ts
@apps/web/app/booking/[performanceId]/confirm/page.tsx
@apps/web/hooks/use-booking.ts
@apps/web/components/booking/booking-page.tsx

<interfaces>
<!-- ReservationService DI pattern (reference for BookingGateway injection) -->
From apps/api/src/modules/reservation/reservation.service.ts:
```typescript
@Injectable()
export class ReservationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tossClient: TossPaymentsClient,
    private readonly bookingService: BookingService,
    private readonly bookingGateway: BookingGateway,
  ) {}
}
```

<!-- BookingGateway broadcast method signature -->
From apps/api/src/modules/booking/booking.gateway.ts:
```typescript
broadcastSeatUpdate(showtimeId: string, seatId: string, status: SeatState, userId?: string): void
```

<!-- BookingModule exports (available for DI) -->
From apps/api/src/modules/booking/booking.module.ts:
```typescript
exports: [BookingService, BookingGateway]
```

<!-- TossPaymentError structure -->
From apps/api/src/modules/payment/toss-payments.client.ts:
```typescript
export class TossPaymentError extends Error {
  public readonly code: string;
  constructor(code: string, message: string)
}
```

<!-- Frontend unlock hook -->
From apps/web/hooks/use-booking.ts:
```typescript
export function useUnlockAllSeats(): UseMutationResult
// mutationFn: ({ showtimeId }: { showtimeId: string }) => apiClient.delete(...)
```

<!-- Reference: cancelReservation seat restore pattern (L477-493 in reservation.service.ts) -->
```typescript
// Inside DB transaction:
const cancelledSeats = await tx
  .select({ seatId: reservationSeats.seatId })
  .from(reservationSeats)
  .where(eq(reservationSeats.reservationId, reservationId));

for (const seat of cancelledSeats) {
  await tx
    .update(seatInventories)
    .set({ status: 'available', soldAt: null, lockedBy: null, lockedUntil: null })
    .where(
      and(
        eq(seatInventories.showtimeId, reservation.showtimeId),
        eq(seatInventories.seatId, seat.seatId),
      ),
    );
}
// After transaction:
for (const seat of freedSeats) {
  this.bookingGateway.broadcastSeatUpdate(reservation.showtimeId, seat.seatId, 'available');
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Toss confirm 보상 패턴 + TossPaymentExceptionFilter</name>
  <files>
    apps/api/src/modules/reservation/reservation.service.ts
    apps/api/src/common/filters/toss-payment-exception.filter.ts
    apps/api/src/main.ts
  </files>
  <action>
**Issue 1 -- Compensation pattern (reservation.service.ts L184-244):**

`confirmPayment()` 메서드에서 L192의 `this.db.transaction()` 호출을 try-catch로 감싼다. catch 블록에서:
1. `this.tossClient.cancelPayment(tossResponse.paymentKey, '서버 오류로 인한 자동 취소')` 호출 (이것도 try-catch로 감싸고 실패 시 logger.error로 기록 -- 이 경우 수동 환불 필요)
2. `throw new InternalServerErrorException('결제는 승인되었으나 처리 중 오류가 발생했습니다. 자동 취소를 시도했습니다. 고객센터에 문의해주세요.')` 발생

구체적으로 L191-244를 아래 구조로 변경:
```typescript
// 5. Update reservation status + create payment record + mark seats sold
try {
  await this.db.transaction(async (tx) => {
    // ... 기존 트랜잭션 코드 그대로 유지 ...
  });
} catch (dbError) {
  // Compensation: attempt to cancel the Toss payment
  this.logger.error(
    `DB transaction failed after Toss confirm. paymentKey=${tossResponse.paymentKey}, orderId=${dto.orderId}`,
    dbError instanceof Error ? dbError.stack : String(dbError),
  );
  try {
    await this.tossClient.cancelPayment(tossResponse.paymentKey, '서버 오류로 인한 자동 취소');
    this.logger.log(`Compensation cancel succeeded. paymentKey=${tossResponse.paymentKey}`);
  } catch (cancelError) {
    this.logger.error(
      `CRITICAL: Compensation cancel also failed. paymentKey=${tossResponse.paymentKey}. Manual refund required.`,
      cancelError instanceof Error ? cancelError.stack : String(cancelError),
    );
  }
  throw new InternalServerErrorException(
    '결제는 승인되었으나 처리 중 오류가 발생했습니다. 자동 취소를 시도했습니다. 고객센터에 문의해주세요.',
  );
}
```

ReservationService에 Logger 추가: `private readonly logger = new Logger(ReservationService.name);` (import `Logger` from `@nestjs/common`). InternalServerErrorException도 import에 추가.

**Issue 2 -- TossPaymentExceptionFilter (새 파일):**

`apps/api/src/common/filters/toss-payment-exception.filter.ts` 생성:
- `@Catch(TossPaymentError)` 데코레이터
- `ExceptionFilter` implements
- Toss 에러 코드 -> HTTP 상태 매핑:
  - 400 (client errors): `PAY_PROCESS_CANCELED`, `PAY_PROCESS_ABORTED`, `REJECT_CARD_PAYMENT`, `BELOW_MINIMUM_AMOUNT`, `INVALID_CARD_LOST_OR_STOLEN`, `NOT_AVAILABLE_PAYMENT`, `EXCEED_MAX_CARD_INSTALLMENT_PLAN`, `NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT`
  - 409 (conflict): `ALREADY_PROCESSED_PAYMENT`, `DUPLICATED_ORDER_ID`
  - 502 (upstream/unknown): 그 외 모든 코드
- 응답 형식: `{ statusCode, code: exception.code, message: exception.message, timestamp }`

`apps/api/src/main.ts`에서:
- `TossPaymentExceptionFilter` import
- 기존 `app.useGlobalFilters(new HttpExceptionFilter())` 를 `app.useGlobalFilters(new HttpExceptionFilter(), new TossPaymentExceptionFilter())` 로 변경
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - confirmPayment()에서 DB 실패 시 Toss 자동 취소 보상 로직 존재
    - TossPaymentError가 NestJS ExceptionFilter를 통해 400/409/502로 매핑됨
    - 두 필터 모두 main.ts에 전역 등록됨
  </done>
</task>

<task type="auto">
  <name>Task 2: refundBooking 좌석 복원 + confirm 만료 Redis 해제</name>
  <files>
    apps/api/src/modules/admin/admin-booking.service.ts
    apps/api/src/modules/admin/admin.module.ts
    apps/web/app/booking/[performanceId]/confirm/page.tsx
  </files>
  <action>
**Issue 3 -- refundBooking() 좌석 복원 (admin-booking.service.ts L226-272):**

1. `admin-booking.service.ts` 상단 import에 `seatInventories` 추가 (schema/index.js에서):
   ```typescript
   import {
     reservations,
     reservationSeats,
     payments,
     showtimes,
     performances,
     users,
     seatInventories,  // 추가
   } from '../../database/schema/index.js';
   ```

2. `BookingGateway` import 및 DI 주입:
   ```typescript
   import { BookingGateway } from '../booking/booking.gateway.js';
   ```
   constructor에 `private readonly bookingGateway: BookingGateway` 파라미터 추가.

3. `admin.module.ts`에 `BookingModule` import 추가:
   ```typescript
   import { BookingModule } from '../booking/booking.module.js';
   // imports 배열에 BookingModule 추가
   imports: [PerformanceModule, PaymentModule, BookingModule],
   ```

4. `refundBooking()` 메서드의 DB 트랜잭션(L250-271) 내부에, payment status 업데이트 후 좌석 복원 로직 추가. cancelReservation() 패턴 그대로 복제:
   ```typescript
   // Restore seat_inventories to available
   const cancelledSeats = await tx
     .select({ seatId: reservationSeats.seatId })
     .from(reservationSeats)
     .where(eq(reservationSeats.reservationId, reservationId));

   for (const seat of cancelledSeats) {
     await tx
       .update(seatInventories)
       .set({ status: 'available', soldAt: null, lockedBy: null, lockedUntil: null })
       .where(
         and(
           eq(seatInventories.showtimeId, reservation.showtimeId),
           eq(seatInventories.seatId, seat.seatId),
         ),
       );
   }
   ```

5. 트랜잭션 종료 후 (L271 뒤) WebSocket broadcast 추가:
   ```typescript
   // Broadcast available status via WebSocket
   const freedSeats = await this.db
     .select({ seatId: reservationSeats.seatId })
     .from(reservationSeats)
     .where(eq(reservationSeats.reservationId, reservationId));

   for (const seat of freedSeats) {
     this.bookingGateway.broadcastSeatUpdate(reservation.showtimeId, seat.seatId, 'available');
   }
   ```

**Issue 5 -- confirm 페이지 handleExpire Redis 해제 (confirm/page.tsx L89-92):**

1. `useUnlockAllSeats` import 추가:
   ```typescript
   import { usePrepareReservation, useUnlockAllSeats } from '@/hooks/use-booking';
   ```

2. `ConfirmPageContent` 컴포넌트 내부에서 hook 호출:
   ```typescript
   const unlockAll = useUnlockAllSeats();
   ```

3. `handleExpire` 콜백 수정 (L89-92):
   ```typescript
   const handleExpire = useCallback(() => {
     const { selectedShowtimeId } = useBookingStore.getState();
     if (selectedShowtimeId) {
       unlockAll.mutate({ showtimeId: selectedShowtimeId });
     }
     toast.error('좌석 점유 시간이 만료되어 좌석 선택 화면으로 이동합니다.');
     router.replace(`/booking/${performanceId}`);
   }, [performanceId, router, unlockAll]);
   ```
   `unlockAll.mutate`는 fire-and-forget -- Redis TTL이 백업이므로 실패해도 문제 없다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit 2>&1 | head -30 && pnpm --filter @grapit/web exec tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - refundBooking()이 seatInventories를 available로 복원하고 WebSocket broadcast 수행
    - AdminModule이 BookingModule을 import하여 BookingGateway DI 가능
    - confirm 페이지 handleExpire가 unlockAll.mutate() 호출 후 redirect
  </done>
</task>

<task type="auto">
  <name>Task 3: getMyReservations + getBookings N+1 쿼리 일괄 조회로 전환</name>
  <files>
    apps/api/src/modules/reservation/reservation.service.ts
    apps/api/src/modules/admin/admin-booking.service.ts
  </files>
  <action>
**Issue 6a -- getMyReservations() N+1 해소 (reservation.service.ts L297-303):**

기존 코드 (L297-320 근처):
```typescript
const result: ReservationListItem[] = [];
for (const row of rows) {
  const seats = await this.db
    .select()
    .from(reservationSeats)
    .where(eq(reservationSeats.reservationId, row.reservation.id));
  result.push({ ... seats: seats.map(...) ... });
}
```

변경:
1. `inArray` import 추가 (drizzle-orm에서): 이미 `eq`, `and`, `desc` 등 import 하는 줄에 `inArray` 추가.
2. for 루프 전에 일괄 조회:
   ```typescript
   // Batch-fetch all seats for all reservations (eliminates N+1)
   const reservationIds = rows.map((r) => r.reservation.id);
   const allSeats = reservationIds.length > 0
     ? await this.db
         .select()
         .from(reservationSeats)
         .where(inArray(reservationSeats.reservationId, reservationIds))
     : [];
   const seatsByReservation = new Map<string, typeof allSeats>();
   for (const seat of allSeats) {
     const existing = seatsByReservation.get(seat.reservationId) ?? [];
     existing.push(seat);
     seatsByReservation.set(seat.reservationId, existing);
   }
   ```
3. for 루프를 map으로 교체 (DB 호출 없이 Map lookup):
   ```typescript
   const result: ReservationListItem[] = rows.map((row) => {
     const seats = seatsByReservation.get(row.reservation.id) ?? [];
     return {
       id: row.reservation.id,
       // ... 기존 필드 그대로 ...
       seats: seats.map((s) => ({
         seatId: s.seatId,
         tierName: s.tierName,
         price: s.price,
         row: s.row,
         number: s.number,
       })),
       // ... 나머지 필드 ...
     };
   });
   ```

**Issue 6b -- getBookings() N+1 해소 (admin-booking.service.ts L117-120):**

동일한 패턴 적용. 기존 for 루프(L116-140 근처):
```typescript
const bookings: AdminBookingListItem[] = [];
for (const row of rows) {
  const seats = await this.db
    .select()
    .from(reservationSeats)
    .where(eq(reservationSeats.reservationId, row.reservation.id));
  bookings.push({ ... });
}
```

변경:
1. `inArray` import 추가: `import { eq, and, sql, ilike, or, desc, inArray } from 'drizzle-orm';`
2. for 루프 전 일괄 조회:
   ```typescript
   const reservationIds = rows.map((r) => r.reservation.id);
   const allSeats = reservationIds.length > 0
     ? await this.db
         .select()
         .from(reservationSeats)
         .where(inArray(reservationSeats.reservationId, reservationIds))
     : [];
   const seatsByReservation = new Map<string, typeof allSeats>();
   for (const seat of allSeats) {
     const existing = seatsByReservation.get(seat.reservationId) ?? [];
     existing.push(seat);
     seatsByReservation.set(seat.reservationId, existing);
   }
   ```
3. for 루프를 map으로 교체하여 Map lookup 사용. 기존 push 로직의 모든 필드를 그대로 유지하되 `seats` 필드만 Map에서 가져온다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - getMyReservations()가 1회 일괄 쿼리로 전체 좌석 조회 (N+1 제거)
    - getBookings()가 1회 일괄 쿼리로 전체 좌석 조회 (N+1 제거)
    - 빈 결과 시 빈 배열 반환 (inArray에 빈 배열 방어)
  </done>
</task>

</tasks>

<verification>
1. `pnpm --filter @grapit/api exec tsc --noEmit` -- 백엔드 타입체크 통과
2. `pnpm --filter @grapit/web exec tsc --noEmit` -- 프론트엔드 타입체크 통과
3. `pnpm --filter @grapit/api test` -- 기존 테스트 통과 (admin-booking.service.spec.ts 포함)
</verification>

<success_criteria>
- Toss confirm 후 DB 실패 시 cancelPayment 보상 호출 + 로깅
- TossPaymentError가 400/409/502로 적절히 HTTP 변환됨
- 관리자 환불 시 seatInventories available 복원 + WebSocket broadcast
- confirm 페이지 타이머 만료 시 Redis 좌석 잠금 해제
- getMyReservations, getBookings에서 N+1 쿼리 제거
- 모든 타입체크 및 기존 테스트 통과
</success_criteria>

<output>
After completion, create `.planning/quick/260407-jyt-pr-3-6-tosspaymenterror-http-refundbooki/260407-jyt-SUMMARY.md`
</output>
