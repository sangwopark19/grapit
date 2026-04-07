---
phase: quick-260407-fbi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/modules/reservation/reservation.module.ts
  - apps/api/src/modules/reservation/reservation.service.ts
  - apps/api/src/modules/reservation/reservation.service.spec.ts
  - apps/api/src/modules/booking/booking.module.ts
  - apps/api/src/modules/booking/booking.service.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "결제 완료된 좌석은 다른 사용자가 잠금(lock) 시도 시 거절된다"
    - "결제 완료 시 seat_inventories.status가 'sold'로 변경된다"
    - "결제 완료 시 Redis 좌석 잠금이 해제된다"
    - "결제 완료 시 WebSocket으로 'sold' 상태가 브로드캐스트된다"
    - "예매 취소 시 seat_inventories.status가 'available'로 복원된다"
    - "lockSeat() 호출 시 DB에서 sold 상태인 좌석은 ConflictException 발생"
  artifacts:
    - path: "apps/api/src/modules/reservation/reservation.service.ts"
      provides: "결제 확인 트랜잭션에 seat_inventories sold 업데이트 + Redis 해제 + WS 브로드캐스트"
      contains: "seatInventories"
    - path: "apps/api/src/modules/booking/booking.service.ts"
      provides: "lockSeat에 DB sold 체크 방어 로직"
      contains: "sold"
  key_links:
    - from: "reservation.service.ts confirmAndCreateReservation"
      to: "seat_inventories table"
      via: "Drizzle update in transaction"
      pattern: "seatInventories.*sold"
    - from: "reservation.service.ts confirmAndCreateReservation"
      to: "Redis seat locks"
      via: "BookingService unlockAllSeats or direct Redis del"
      pattern: "redis.*del|unlockAllSeats"
    - from: "booking.service.ts lockSeat"
      to: "seat_inventories table"
      via: "DB query before Redis lock"
      pattern: "seatInventories.*sold"
---

<objective>
결제 완료된 좌석이 다시 예매 가능한 치명적 버그를 수정한다.

Purpose: confirmAndCreateReservation() 트랜잭션이 seat_inventories를 sold로 업데이트하지 않고, Redis 잠금도 해제하지 않으며, WebSocket 브로드캐스트도 하지 않아서 결제된 좌석이 10분(Redis TTL) 후 다시 선택/결제 가능해지는 문제.

Output: 결제 확인 시 DB sold 마킹 + Redis 해제 + WS sold 브로드캐스트, 취소 시 DB available 복원, lockSeat에 DB sold 방어 로직 추가.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/modules/reservation/reservation.service.ts
@apps/api/src/modules/reservation/reservation.module.ts
@apps/api/src/modules/booking/booking.service.ts
@apps/api/src/modules/booking/booking.module.ts
@apps/api/src/modules/booking/booking.gateway.ts
@apps/api/src/database/schema/seat-inventories.ts
@apps/api/src/modules/reservation/reservation.service.spec.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From apps/api/src/database/schema/seat-inventories.ts:
```typescript
export const seatStatusEnum = pgEnum('seat_status', ['available', 'locked', 'sold']);
export const seatInventories = pgTable('seat_inventories', {
  id: uuid('id').defaultRandom().primaryKey(),
  showtimeId: uuid('showtime_id').notNull(),
  seatId: varchar('seat_id', { length: 20 }).notNull(),
  status: seatStatusEnum('status').notNull().default('available'),
  lockedBy: uuid('locked_by'),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  soldAt: timestamp('sold_at', { withTimezone: true }),
});
```

From apps/api/src/modules/booking/booking.service.ts:
```typescript
// BookingService is exported from BookingModule
async unlockAllSeats(userId: string, showtimeId: string): Promise<UnlockAllResponse>
async getSeatStatus(showtimeId: string): Promise<SeatStatusResponse>
```

From apps/api/src/modules/booking/booking.gateway.ts:
```typescript
// BookingGateway is NOT exported from BookingModule — only a provider
broadcastSeatUpdate(showtimeId: string, seatId: string, status: SeatState, userId?: string): void
```

From reservation_seats table (via reservation.service.ts usage):
```typescript
// reservation_seats has: reservationId, seatId, tierName, price, row, number
// seatId is varchar, not FK — matches seat_inventories.seatId
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: 결제 확인/취소 시 seat_inventories 상태 전환 + Redis 해제 + WS 브로드캐스트</name>
  <files>
    apps/api/src/modules/reservation/reservation.module.ts
    apps/api/src/modules/reservation/reservation.service.ts
    apps/api/src/modules/reservation/reservation.service.spec.ts
    apps/api/src/modules/booking/booking.module.ts
  </files>
  <behavior>
    - Test: confirmAndCreateReservation should update seat_inventories status to 'sold' and set soldAt for all reservation seats within the transaction
    - Test: confirmAndCreateReservation should call BookingService.unlockAllSeats to release Redis locks after DB commit
    - Test: confirmAndCreateReservation should call BookingGateway.broadcastSeatUpdate with 'sold' for each seat
    - Test: cancelReservation should update seat_inventories status back to 'available' and clear soldAt for all reservation seats
    - Test: cancelReservation should call BookingGateway.broadcastSeatUpdate with 'available' for each seat
  </behavior>
  <action>
    1. **Module wiring:**
       - `booking.module.ts`: Add `BookingGateway` to the `exports` array (alongside `BookingService`). This allows ReservationModule to inject the gateway for WebSocket broadcasts.
       - `reservation.module.ts`: Add `BookingModule` to `imports` array. Inject `BookingService` and `BookingGateway` into `ReservationService` constructor.

    2. **ReservationService constructor changes:**
       - Add `private readonly bookingService: BookingService` and `private readonly bookingGateway: BookingGateway` as constructor parameters.
       - Add import for `BookingService` from `../booking/booking.service.js`, `BookingGateway` from `../booking/booking.gateway.js`.
       - Add import for `seatInventories` from `../../database/schema/seat-inventories.js`.
       - Add import for `reservationSeats` (already imported in some methods but needed at top).

    3. **confirmAndCreateReservation() fix (lines 187-205):**
       Inside the existing `this.db.transaction(async (tx) => { ... })` block, AFTER the payments insert, add:

       ```typescript
       // Fetch the reservation's seat IDs
       const resSeats = await tx
         .select({ seatId: reservationSeats.seatId })
         .from(reservationSeats)
         .where(eq(reservationSeats.reservationId, reservation.id));

       // Mark seats as sold in seat_inventories (upsert pattern)
       for (const seat of resSeats) {
         const [existing] = await tx
           .select({ id: seatInventories.id })
           .from(seatInventories)
           .where(
             and(
               eq(seatInventories.showtimeId, reservation.showtimeId),
               eq(seatInventories.seatId, seat.seatId),
             ),
           );

         if (existing) {
           await tx
             .update(seatInventories)
             .set({ status: 'sold', soldAt: new Date(), lockedBy: null, lockedUntil: null })
             .where(eq(seatInventories.id, existing.id));
         } else {
           await tx
             .insert(seatInventories)
             .values({
               showtimeId: reservation.showtimeId,
               seatId: seat.seatId,
               status: 'sold',
               soldAt: new Date(),
             });
         }
       }
       ```

       AFTER the transaction completes (outside tx block), add:
       ```typescript
       // Release Redis locks for this user's seats in this showtime
       await this.bookingService.unlockAllSeats(userId, reservation.showtimeId);

       // Broadcast sold status via WebSocket for each seat
       const confirmedSeats = await this.db
         .select({ seatId: reservationSeats.seatId })
         .from(reservationSeats)
         .where(eq(reservationSeats.reservationId, reservation.id));

       for (const seat of confirmedSeats) {
         this.bookingGateway.broadcastSeatUpdate(reservation.showtimeId, seat.seatId, 'sold', userId);
       }
       ```

    4. **cancelReservation() fix (lines 401-424):**
       Inside the existing `this.db.transaction(async (tx) => { ... })` block, AFTER the payment status update, add:

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

       AFTER the transaction, add WebSocket broadcast:
       ```typescript
       const freedSeats = await this.db
         .select({ seatId: reservationSeats.seatId })
         .from(reservationSeats)
         .where(eq(reservationSeats.reservationId, reservationId));

       for (const seat of freedSeats) {
         this.bookingGateway.broadcastSeatUpdate(reservation.showtimeId, seat.seatId, 'available');
       }
       ```

    5. **Update tests (reservation.service.spec.ts):**
       - Add mock for `BookingService` (with `unlockAllSeats: vi.fn().mockResolvedValue({ unlockedSeats: [] })`).
       - Add mock for `BookingGateway` (with `broadcastSeatUpdate: vi.fn()`).
       - Update `ReservationService` constructor in `beforeEach` to pass all 4 dependencies: `(mockDb, mockTossClient, mockBookingService, mockBookingGateway)`.
       - Add test for `confirmAndCreateReservation`: verify transaction calls `seatInventories` update/insert AND that `unlockAllSeats` and `broadcastSeatUpdate` are called.
       - Add test for `cancelReservation`: verify transaction includes `seatInventories` status restoration to 'available'.
       - Keep existing tests working (the new constructor params are additional — existing tests only need mock objects added).

    Note: The `reservation` variable is already available in scope inside `confirmAndCreateReservation` (line 155). Use `reservation.showtimeId` to query the correct showtime.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts</automated>
  </verify>
  <done>
    - confirmAndCreateReservation 트랜잭션에서 reservation_seats의 seatId 목록을 조회하여 seat_inventories.status를 'sold'로 업데이트하고 soldAt을 설정한다.
    - confirmAndCreateReservation 트랜잭션 완료 후 BookingService.unlockAllSeats()로 Redis 잠금을 해제한다.
    - confirmAndCreateReservation 트랜잭션 완료 후 BookingGateway.broadcastSeatUpdate()로 각 좌석에 'sold' 브로드캐스트한다.
    - cancelReservation 트랜잭션에서 seat_inventories.status를 'available'로 복원한다.
    - cancelReservation 트랜잭션 완료 후 BookingGateway.broadcastSeatUpdate()로 각 좌석에 'available' 브로드캐스트한다.
    - 모든 기존 테스트 + 신규 테스트 통과.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lockSeat()에 DB sold 상태 방어 로직 추가</name>
  <files>
    apps/api/src/modules/booking/booking.service.ts
  </files>
  <behavior>
    - Test: lockSeat should throw ConflictException when seat_inventories has status='sold' for the given showtime+seat
    - Test: lockSeat should proceed normally when no sold record exists in seat_inventories
    - Test: lockSeat should proceed normally when seat_inventories record exists with status='available'
  </behavior>
  <action>
    `booking.service.ts`의 `lockSeat()` 메서드 시작부(Redis Lua 스크립트 호출 전)에 DB sold 체크를 추가한다.

    Redis 잠금 시도 전에 seat_inventories를 조회하여 이미 sold 상태인 좌석은 즉시 거절한다. 이는 Redis TTL이 만료된 후에도 sold 좌석을 보호하는 마지막 방어선이다.

    `lockSeat()` 메서드의 `const userSeatsKey = ...` 라인 전에 추가:

    ```typescript
    // DB-level sold check: defense against Redis TTL expiry race
    const [soldRecord] = await this.db
      .select({ id: seatInventories.id })
      .from(seatInventories)
      .where(
        and(
          eq(seatInventories.showtimeId, showtimeId),
          eq(seatInventories.seatId, seatId),
          eq(seatInventories.status, 'sold'),
        ),
      );

    if (soldRecord) {
      throw new ConflictException('이미 판매된 좌석입니다');
    }
    ```

    필요한 import 추가:
    - `and` from `drizzle-orm` (이미 import됨 확인)
    - `eq` from `drizzle-orm` (이미 import됨 확인)

    기존 booking.service.spec.ts가 없으므로 테스트 파일을 생성하되, lockSeat의 sold 방어 로직에 대한 테스트만 포함한다. 기존 lockSeat 테스트는 없으므로 충돌 없음.

    테스트 파일 `apps/api/src/modules/booking/booking.service.spec.ts` 생성:
    - mockDb, mockRedis, mockGateway로 BookingService를 직접 인스턴스화
    - sold 좌석 조회 시 ConflictException 발생 확인
    - sold 레코드 없을 때 Redis eval이 정상 호출되는 확인
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec vitest run src/modules/booking/booking.service.spec.ts</automated>
  </verify>
  <done>
    - lockSeat()가 Redis Lua 실행 전에 seat_inventories에서 sold 상태를 확인한다.
    - sold 상태인 좌석에 대해 ConflictException('이미 판매된 좌석입니다')을 던진다.
    - sold가 아닌 좌석은 기존 Redis 잠금 플로우를 정상 진행한다.
    - 테스트 통과.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Redis TTL -> DB state | Redis 잠금이 TTL 만료로 소멸해도 DB sold 상태가 유지되어야 함 |
| Confirm flow -> seat state | 결제 확인이 DB 좌석 상태를 정확히 반영해야 함 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fbi-01 | Tampering | lockSeat | mitigate | DB sold 체크를 Redis lock 전에 수행하여 TTL 만료 후 재잠금 방지 |
| T-fbi-02 | Elevation | confirmAndCreateReservation | accept | 이미 userId 검증 + PENDING_PAYMENT 상태 체크 존재. seat_inventories는 트랜잭션 내에서만 변경. |
| T-fbi-03 | Denial of Service | lockSeat DB query | accept | 추가 DB 쿼리 1회 (indexed unique on showtime_id+seat_id). 성능 영향 무시 가능. |
</threat_model>

<verification>
1. `pnpm --filter @grapit/api exec vitest run` - 전체 API 테스트 통과
2. `pnpm --filter @grapit/api exec tsc --noEmit` - 타입 체크 통과
3. 수동 검증: 좌석 선택 -> 결제 완료 -> 같은 좌석 재선택 시도 시 '이미 판매된 좌석입니다' 에러
4. 수동 검증: 예매 취소 -> 취소된 좌석 다시 선택 가능
</verification>

<success_criteria>
- 결제 완료된 좌석의 seat_inventories.status가 'sold'로 저장된다
- Redis 좌석 잠금이 결제 완료 후 즉시 해제된다
- WebSocket으로 'sold' 상태가 실시간 브로드캐스트된다
- 다른 사용자가 sold 좌석을 lockSeat 시도하면 ConflictException 발생
- 예매 취소 시 seat_inventories.status가 'available'로 복원된다
- 기존 테스트 + 신규 테스트 모두 통과
</success_criteria>

<output>
After completion, create `.planning/quick/260407-fbi-paid-seat-rebookable-fix/260407-fbi-SUMMARY.md`
</output>
