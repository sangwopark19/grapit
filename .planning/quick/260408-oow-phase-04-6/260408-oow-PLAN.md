---
phase: quick-260408-oow
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/modules/reservation/reservation.service.ts
  - apps/api/src/modules/admin/admin-booking.service.ts
  - apps/api/src/modules/payment/toss-payments.client.ts
  - apps/api/src/modules/reservation/reservation.controller.ts
  - apps/api/src/modules/reservation/reservation.service.spec.ts
  - apps/web/app/booking/[performanceId]/confirm/page.tsx
  - apps/web/hooks/use-booking.ts
  - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
  - apps/api/src/modules/booking/booking.service.spec.ts
autonomous: true
must_haves:
  truths:
    - "cancelReservation DB 실패 시 Toss 재결제(보상 트랜잭션) 시도가 존재한다"
    - "refundBooking DB 실패 시 동일한 보상 트랜잭션 패턴이 존재한다"
    - "cancelReservation에서 동시 이중 취소가 불가능하다 (SELECT FOR UPDATE)"
    - "toss-payments.client.ts의 response.json()이 unknown으로 타입 지정된 후 검증된다"
    - "handleExpire 시 서버의 PENDING_PAYMENT 레코드가 CANCELLED로 변경된다"
    - "booking.service.spec.ts가 __tests__/ 하나에만 존재한다"
  artifacts:
    - path: "apps/api/src/modules/reservation/reservation.service.ts"
      provides: "cancelReservation with compensation + SELECT FOR UPDATE"
    - path: "apps/api/src/modules/admin/admin-booking.service.ts"
      provides: "refundBooking with compensation"
    - path: "apps/api/src/modules/payment/toss-payments.client.ts"
      provides: "Type-safe response parsing with unknown + assertion"
    - path: "apps/api/src/modules/booking/__tests__/booking.service.spec.ts"
      provides: "Consolidated test file with all booking service tests"
  key_links:
    - from: "confirm/page.tsx handleExpire"
      to: "reservation.controller cancelPendingReservation"
      via: "API call to cancel PENDING_PAYMENT records"
      pattern: "apiClient\\.put.*cancel-pending"
---

<objective>
Phase 04 코드리뷰 이슈 6건 수정: 취소 보상 트랜잭션, 이중 취소 방지, Toss 응답 타입 안전, PENDING_PAYMENT 클린업, 중복 테스트 파일 통합

Purpose: PR #3 코드리뷰에서 발견된 결제/예매 안정성 이슈 해결
Output: 6개 이슈가 모두 수정된 소스 코드 + 기존 테스트 통과
</objective>

<execution_context>
@.planning/quick/260408-oow-phase-04-6/260408-oow-PLAN.md
</execution_context>

<context>
@apps/api/src/modules/reservation/reservation.service.ts
@apps/api/src/modules/admin/admin-booking.service.ts
@apps/api/src/modules/payment/toss-payments.client.ts
@apps/api/src/modules/reservation/reservation.controller.ts
@apps/api/src/modules/reservation/reservation.service.spec.ts
@apps/web/app/booking/[performanceId]/confirm/page.tsx
@apps/web/hooks/use-booking.ts
@apps/api/src/modules/booking/__tests__/booking.service.spec.ts
@apps/api/src/modules/booking/booking.service.spec.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: cancelReservation 보상 트랜잭션 + SELECT FOR UPDATE 이중 취소 방지 (Issue 1, 3)</name>
  <files>
    apps/api/src/modules/reservation/reservation.service.ts
    apps/api/src/modules/reservation/reservation.service.spec.ts
  </files>
  <action>
`cancelReservation()` 메서드를 다음과 같이 리팩토링한다:

**Issue 3 (이중 취소 레이스 컨디션) 수정:**
현재 status 체크(L467)가 트랜잭션 밖에서 일어난다. 트랜잭션 시작 시점에 `SELECT ... FOR UPDATE`로 reservation 행을 잠그고, 잠금 획득 후 status/deadline을 검증한다.

구체적으로:
1. 트랜잭션 내부에서 `sql\`SELECT * FROM reservations WHERE id = ${reservationId} FOR UPDATE\`` 또는 Drizzle의 raw SQL로 행 잠금 취득
2. Drizzle ORM에서는 `.for('update')`를 지원하지 않으므로 `db.execute(sql\`...\`)` 사용. 행 결과에서 reservation 정보 추출
3. 잠금 후 status !== 'CONFIRMED' 이면 `BadRequestException`, deadline 초과이면 `ForbiddenException` throw
4. payment 조회도 트랜잭션 내부로 이동
5. Toss cancelPayment 호출을 트랜잭션 내부, DB 업데이트 직전에 위치

**Issue 1 (보상 트랜잭션 누락) 수정:**
`confirmAndCreateReservation()`의 lines 196-268에 이미 구현된 패턴을 참조하여 cancelReservation에 동일한 try-catch 보상 패턴 적용:

```
try {
  await this.db.transaction(async (tx) => {
    // SELECT FOR UPDATE로 행 잠금
    const [reservation] = await tx.execute(
      sql`SELECT * FROM reservations WHERE id = ${reservationId} FOR UPDATE`
    );
    // status, ownership, deadline 검증
    // payment 조회
    // Toss cancelPayment 호출
    // DB 상태 업데이트 (reservation, payment, seat_inventories)
  });
} catch (error) {
  if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
    throw error; // 비즈니스 예외는 재throw
  }
  // Toss 취소 성공 후 DB 실패인 경우 — 보상 불필요 (환불이므로 고객에게 유리)
  // 하지만 일관성을 위해 로깅 + InternalServerError throw
  this.logger.error(`DB transaction failed after Toss cancel. reservationId=${reservationId}`, ...);
  throw new InternalServerErrorException('취소 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.');
}
```

핵심: Toss cancelPayment가 성공했는데 DB 트랜잭션이 실패하면, Toss 재결제(compensation)를 시도하는 것은 비실용적이다. 대신 CRITICAL 로그를 남기고 수동 처리를 유도한다. confirmAndCreateReservation에서 cancelPayment를 보상으로 쓴 것과 달리, cancelReservation에서는 이미 취소가 목적이므로 "환불은 성공, DB만 실패" 상황은 고객에게 불리하지 않다. 다만 DB 일관성이 깨지므로 CRITICAL 로그를 남긴다.

트랜잭션 바깥의 기존 코드(reservation 조회, payment 조회, status/deadline 체크)를 모두 트랜잭션 내부로 이동. 트랜잭션 밖에 남는 것은 WebSocket broadcast뿐이다.

Drizzle에서 `tx.execute(sql\`...\`)` 반환값은 `{ rows: unknown[] }` 형태이므로 적절한 타입 단언 필요. reservation 스키마 컬럼과 매핑:
```typescript
const result = await tx.execute(
  sql`SELECT id, user_id, showtime_id, status, cancel_deadline FROM reservations WHERE id = ${reservationId} FOR UPDATE`
);
const row = result.rows[0] as { id: string; user_id: string; showtime_id: string; status: string; cancel_deadline: Date } | undefined;
```

기존 테스트에서 `cancelReservation` 관련 테스트가 `reservation.service.spec.ts`에 있다. mockDb.transaction이 이미 모킹되어 있으므로 트랜잭션 내부 SELECT FOR UPDATE는 tx.execute를 추가 모킹하면 된다. 기존 테스트 2개(cancel succeed, cancel after deadline)를 수정하여 새 구조에 맞춘다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts</automated>
  </verify>
  <done>
    - cancelReservation 내에서 SELECT FOR UPDATE로 행 잠금 후 status/deadline 검증
    - Toss cancelPayment와 DB 업데이트가 동일 트랜잭션 흐름 내에서 처리
    - DB 실패 시 CRITICAL 로그 + InternalServerErrorException throw
    - 기존 테스트 통과
  </done>
</task>

<task type="auto">
  <name>Task 2: refundBooking 보상 트랜잭션 + toss-payments.client 타입 안전 (Issue 2, 4)</name>
  <files>
    apps/api/src/modules/admin/admin-booking.service.ts
    apps/api/src/modules/payment/toss-payments.client.ts
  </files>
  <action>
**Issue 2 (refundBooking 보상 트랜잭션 누락) 수정:**
`admin-booking.service.ts`의 `refundBooking()` 메서드를 Task 1의 cancelReservation과 동일 패턴으로 수정:

1. reservation 조회 + status 검증은 트랜잭션 밖에 남겨도 괜찮다 (admin은 동시 접근 가능성 낮음). 단, Toss cancel과 DB 업데이트의 순서를 안전하게 처리해야 한다.
2. 현재 L259에서 `cancelPayment()` 호출 후 L263에서 DB 트랜잭션. DB 실패 시 보상 없음.
3. 수정: DB 트랜잭션을 try-catch로 감싸되, Toss cancel이 성공한 상태에서 DB 실패 시 CRITICAL 로그를 남긴다 (cancelReservation과 동일 로직).

```typescript
// 기존 reservation/payment 조회 코드 유지
if (payment) {
  await this.tossClient.cancelPayment(payment.paymentKey, reason);
}

try {
  await this.db.transaction(async (tx) => {
    // 기존 트랜잭션 로직 그대로
  });
} catch (dbError) {
  this.logger.error(
    `CRITICAL: DB transaction failed after Toss refund. reservationId=${reservationId}, paymentKey=${payment?.paymentKey}. 수동 확인 필요.`,
    dbError instanceof Error ? dbError.stack : String(dbError),
  );
  throw new InternalServerErrorException(
    '환불은 처리되었으나 시스템 오류가 발생했습니다. 관리자에게 문의해주세요.',
  );
}
```

AdminBookingService에 Logger import + 인스턴스 추가:
```typescript
import { Logger, InternalServerErrorException } from '@nestjs/common';
// class 내부:
private readonly logger = new Logger(AdminBookingService.name);
```

**Issue 4 (toss-payments.client.ts 암묵적 any) 수정:**
`confirmPayment()`과 `cancelPayment()` 양쪽 모두:

1. `response.json()` 결과를 `unknown`으로 타입 지정
2. error 경로: `data`가 `unknown`이므로 안전하게 접근. error 객체 타입 가드 적용:
```typescript
const data: unknown = await response.json();

if (!response.ok) {
  const errorBody = data as Record<string, unknown>;
  throw new TossPaymentError(
    typeof errorBody.code === 'string' ? errorBody.code : 'UNKNOWN_ERROR',
    typeof errorBody.message === 'string' ? errorBody.message : '결제 승인에 실패했습니다',
  );
}

return data as TossPaymentResponse;
```

success 경로에서 `data as TossPaymentResponse` 캐스트는 유지한다. 전체 zod 검증을 적용하면 이상적이지만, TossPaymentResponse의 필드가 이미 Toss 공식 API 스펙이고, 현재 스코프에서는 암묵적 any를 제거하는 것이 목표다. TODO 코멘트로 향후 zod 검증 추가를 표시한다:
```typescript
// TODO: zod 스키마로 런타임 검증 추가 (현재는 타입 단언만 수행)
return data as TossPaymentResponse;
```
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit</automated>
  </verify>
  <done>
    - refundBooking에 try-catch 보상 패턴 적용 (CRITICAL 로그 + InternalServerError)
    - toss-payments.client.ts에서 response.json()이 unknown으로 타입 지정
    - error 경로에서 typeof 타입 가드로 안전한 접근
    - 타입 체크 통과 (no implicit any)
  </done>
</task>

<task type="auto">
  <name>Task 3: PENDING_PAYMENT 클린업 API + handleExpire 연결 + 중복 테스트 통합 (Issue 5, 6)</name>
  <files>
    apps/api/src/modules/reservation/reservation.service.ts
    apps/api/src/modules/reservation/reservation.controller.ts
    apps/web/app/booking/[performanceId]/confirm/page.tsx
    apps/web/hooks/use-booking.ts
    apps/api/src/modules/booking/__tests__/booking.service.spec.ts
    apps/api/src/modules/booking/booking.service.spec.ts
  </files>
  <action>
**Issue 5 (PENDING_PAYMENT 영구 누적) 수정:**

Backend: `reservation.service.ts`에 `cancelPendingReservation()` 메서드 추가:
```typescript
async cancelPendingReservation(reservationId: string, userId: string): Promise<void> {
  const [reservation] = await this.db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.userId, userId),
        eq(reservations.status, 'PENDING_PAYMENT'),
      ),
    );

  if (!reservation) {
    // 이미 취소되었거나 존재하지 않음 — 멱등성
    return;
  }

  await this.db
    .update(reservations)
    .set({
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: '좌석 점유 만료',
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, reservation.id));
}
```

Controller: `reservation.controller.ts`에 엔드포인트 추가:
```typescript
@Put('reservations/:id/cancel-pending')
async cancelPendingReservation(
  @Param('id') id: string,
  @Request() req: { user: { id: string } },
) {
  await this.reservationService.cancelPendingReservation(id, req.user.id);
  return { message: '만료된 예매가 취소되었습니다' };
}
```

Frontend hook (`use-booking.ts`): `useCancelPendingReservation()` 추가:
```typescript
export function useCancelPendingReservation() {
  return useMutation({
    mutationFn: (reservationId: string) =>
      apiClient.put<void>(`/api/v1/reservations/${reservationId}/cancel-pending`),
  });
}
```

Frontend (`confirm/page.tsx`): `handleExpire` 수정.
현재 코드는 Redis unlock만 수행. prepareReservation이 이미 호출된 후일 수 있으므로 PENDING_PAYMENT 레코드도 정리해야 한다.

문제: handleExpire 시점에 reservationId를 알아야 한다. `prepareReservation` 호출 결과로 `reservationId`를 받는데, 이는 `handlePayment` 내에서만 호출된다. 따라서:

1. `prepareReservation` 호출 전에 만료되면 DB 레코드가 없으므로 Redis unlock만 필요 (현행 유지).
2. `prepareReservation` 호출 후 만료 시 reservationId가 필요.

해결: `reservationIdRef`를 useRef로 관리. `handlePayment`에서 `prepareMutation.mutateAsync()` 성공 시 ref에 저장. `handleExpire`에서 ref 값이 있으면 cancelPending API 호출.

```typescript
const reservationIdRef = useRef<string | null>(null);
const cancelPending = useCancelPendingReservation();

// handlePayment 내부에서:
const result = await prepareMutation.mutateAsync({ ... });
reservationIdRef.current = result.reservationId;

// handleExpire 수정:
const handleExpire = useCallback(() => {
  const { selectedShowtimeId } = useBookingStore.getState();
  if (selectedShowtimeId) {
    unlockAll.mutate({ showtimeId: selectedShowtimeId });
  }
  if (reservationIdRef.current) {
    cancelPending.mutate(reservationIdRef.current);
  }
  toast.error('좌석 점유 시간이 만료되어 좌석 선택 화면으로 이동합니다.');
  router.replace(`/booking/${performanceId}`);
}, [performanceId, router, unlockAll, cancelPending]);
```

`useCancelPendingReservation` import를 `use-booking` 에서 추가.

**Issue 6 (중복 테스트 파일) 수정:**

1. `apps/api/src/modules/booking/booking.service.spec.ts` (104줄, lockSeat sold defense 3개 테스트)의 내용을 `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` (288줄)에 통합
2. `__tests__/booking.service.spec.ts`의 `describe('lockSeat')` 블록 안에 이미 lockSeat 성공/실패 테스트가 있다. sold defense 테스트 3개를 `describe('lockSeat - sold defense')` 서브 블록으로 해당 describe 안에 추가
3. 루트 레벨 `booking.service.spec.ts`는 삭제

통합 시 주의사항:
- `__tests__/` 파일은 `import { randomUUID } from 'node:crypto'`가 없다. sold defense 테스트에서 사용하므로 import 추가.
- 두 파일 모두 `createMockRedis()`를 정의하지만 필드가 다르다. `__tests__/` 버전이 더 완전하므로 이를 기반으로 사용. sold defense 테스트가 사용하는 `mockDb.select` 패턴은 `__tests__/` 파일의 기존 `mockNoSoldRecord()` 헬퍼와 호환된다.
- sold defense 테스트의 `randomUUID()` 사용처를 확인하여 상수 `userId`/`showtimeId` 사용으로 통일하거나 randomUUID 유지.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec vitest run src/modules/booking/__tests__/booking.service.spec.ts src/modules/reservation/reservation.service.spec.ts && test ! -f apps/api/src/modules/booking/booking.service.spec.ts</automated>
  </verify>
  <done>
    - cancelPendingReservation API 엔드포인트 존재 (PUT reservations/:id/cancel-pending)
    - handleExpire에서 reservationId가 있으면 cancelPending API 호출
    - booking.service.spec.ts가 __tests__/ 디렉토리에만 존재 (루트 레벨 삭제됨)
    - sold defense 테스트 3개가 __tests__/booking.service.spec.ts에 통합됨
    - 모든 테스트 통과
  </done>
</task>

</tasks>

<verification>
전체 검증:
1. `pnpm --filter @grapit/api exec vitest run` — 모든 API 테스트 통과
2. `pnpm --filter @grapit/api exec tsc --noEmit` — 타입 체크 통과
3. `apps/api/src/modules/booking/booking.service.spec.ts` 파일이 존재하지 않는지 확인
4. `cancelReservation`에 `FOR UPDATE` 키워드 포함 확인
5. `toss-payments.client.ts`에 `as any` 또는 암묵적 any 없음 확인
</verification>

<success_criteria>
- 6개 이슈 모두 수정 완료
- 기존 테스트 + 수정된 테스트 모두 통과
- tsc --noEmit 통과 (no implicit any)
- 중복 테스트 파일 제거됨
</success_criteria>

<output>
After completion, create `.planning/quick/260408-oow-phase-04-6/260408-oow-SUMMARY.md`
</output>
