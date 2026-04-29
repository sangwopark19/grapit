---
phase: 19-seat-lock-ownership-enforcement
reviewed: 2026-04-29T08:55:31Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts
  - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
  - apps/api/src/modules/booking/booking.service.ts
  - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
  - apps/api/src/modules/booking/providers/redis.provider.ts
  - apps/api/src/modules/reservation/reservation.service.spec.ts
  - apps/api/src/modules/reservation/reservation.service.ts
  - apps/web/app/booking/[performanceId]/complete/page.tsx
  - apps/web/app/booking/[performanceId]/confirm/page.tsx
  - apps/web/e2e/toss-payment.spec.ts
  - apps/web/hooks/__tests__/use-booking.test.tsx
findings:
  critical: 3
  warning: 4
  info: 0
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-29T08:55:31Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

좌석 lock ownership 검증은 추가되었지만, 결제 확정 경로의 원자성이 아직 보장되지 않습니다. 특히 Redis lock을 DB sold 전환보다 먼저 삭제하고, 같은 orderId 확정을 서버에서 single-flight로 막지 않아 유료 결제와 좌석 상태가 갈라질 수 있습니다. 또한 서버가 좌석의 tier/metadata를 클라이언트 입력에 의존해 금액 변조와 중복 좌석 저장을 막지 못합니다.

## Critical Issues

### CR-01: BLOCKER - Redis lock을 DB sold 전환 전에 삭제해 double booking 창을 만듭니다

**File:** `apps/api/src/modules/reservation/reservation.service.ts:226`
**Issue:** `confirmAndCreateReservation()`은 Toss 승인 직후 `consumeOwnedSeatLocks()`로 Redis lock을 삭제한 다음 DB transaction을 시작합니다. 이 짧은 구간에는 같은 좌석이 Redis에서도 비어 있고 DB에서도 아직 `sold`가 아니므로 다른 사용자의 `lockSeat()`가 성공할 수 있습니다. 더 나쁘게, 두 번째 사용자의 confirm 단계는 DB sold 여부를 다시 검증하지 않고 lines 275-290에서 기존 `seat_inventories` row를 조건 없이 `sold`로 update하므로 같은 좌석에 대해 두 reservation/payment가 CONFIRMED 될 수 있습니다. DB transaction 실패 후 compensation cancel까지 실패하면 결제는 DONE인데 좌석은 sold가 아니고 lock도 삭제된 상태로 남아 다른 사용자가 구매할 수 있습니다.
**Fix:**
```ts
// 핵심 방향:
// 1. DB sold 전환이 성공하기 전에는 Redis lock을 삭제하지 않는다.
// 2. seat_inventories 갱신은 "아직 sold가 아닌 경우"에만 성공하게 하고 row count를 검증한다.
// 3. DB commit 후에만 consumeOwnedSeatLocks()를 호출한다.
await this.bookingService.assertOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);

await this.db.transaction(async (tx) => {
  for (const seatId of pendingSeatIds) {
    const updated = await tx
      .update(seatInventories)
      .set({ status: 'sold', soldAt: new Date(), lockedBy: null, lockedUntil: null })
      .where(and(
        eq(seatInventories.showtimeId, reservation.showtimeId),
        eq(seatInventories.seatId, seatId),
        sql`${seatInventories.status} <> 'sold'`,
      ))
      .returning({ id: seatInventories.id });

    if (updated.length === 0) {
      const inserted = await tx.insert(seatInventories)
        .values({ showtimeId: reservation.showtimeId, seatId, status: 'sold', soldAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: seatInventories.id });
      if (inserted.length === 0) throw new ConflictException('이미 판매된 좌석입니다');
    }
  }
});

await this.bookingService.consumeOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);
```

### CR-02: BLOCKER - 같은 orderId confirm을 서버에서 serialize하지 않습니다

**File:** `apps/api/src/modules/reservation/reservation.service.ts:181`
**Issue:** idempotency check, pending reservation 조회, Toss confirm, payment insert가 order-level lock 없이 분리되어 있습니다. 같은 `orderId`에 대한 두 요청이 동시에 들어오면 둘 다 line 182의 existing payment check를 통과하고 Toss confirm까지 진행할 수 있습니다. 한 요청이 Redis consume에 실패하면 line 234에서 같은 paymentKey를 cancel할 수 있어, 다른 요청이 이미 DB를 CONFIRMED로 만들고 있는 결제를 취소하는 경합이 생깁니다.
**Fix:**
```ts
const confirmLockKey = `{payment-confirm}:${dto.orderId}`;
const locked = await this.redis.set(confirmLockKey, userId, 'NX', 'EX', 60);
if (!locked) {
  throw new ConflictException('결제 확인이 이미 진행 중입니다.');
}

try {
  // lock 획득 후 existing payment/reservation을 다시 조회하고 confirm 흐름을 진행한다.
} finally {
  await this.redis.del(confirmLockKey);
}
```

또는 PostgreSQL advisory lock/`SELECT ... FOR UPDATE` 기반으로 같은 `toss_order_id` confirm이 한 번에 하나만 실행되도록 하고, lock 획득 후 existing payment를 반드시 다시 조회해야 합니다.

### CR-03: BLOCKER - 서버가 좌석 tier/metadata를 클라이언트 payload에서 신뢰합니다

**File:** `apps/api/src/modules/reservation/reservation.service.ts:57`
**Issue:** `calculateTotalAmount()`는 각 좌석의 실제 tier를 seat map에서 찾지 않고 클라이언트가 보낸 `seat.tierName`으로 가격을 계산합니다. 이후 lines 160-168도 `tierName`, `row`, `number`, `price`를 그대로 `reservation_seats`에 저장합니다. 사용자는 비싼 좌석을 lock한 뒤 더 싼 tierName을 제출해 금액을 낮추거나, 같은 `seatId`를 중복 제출해 하나의 물리 좌석을 여러 ticket처럼 저장할 수 있습니다.
**Fix:**
```ts
const uniqueSeatIds = [...new Set(dto.seats.map((seat) => seat.seatId))];
if (uniqueSeatIds.length !== dto.seats.length) {
  throw new BadRequestException('중복된 좌석이 포함되어 있습니다');
}

// showtime.performanceId로 seatMaps.seatConfig + priceTiers를 조회한다.
// seatId -> tierName/price 매핑은 서버에서 계산하고, 클라이언트의 tierName/price는 무시한다.
const canonicalSeats = uniqueSeatIds.map((seatId) => {
  const tier = seatTierBySeatId.get(seatId);
  if (!tier) throw new BadRequestException('유효하지 않은 좌석입니다');
  return {
    seatId,
    tierName: tier.tierName,
    price: tier.price,
    row: deriveRow(seatId),
    number: deriveNumber(seatId),
  };
});
```

## Warnings

### WR-01: WARNING - `getMyLocks()`가 잘못된 Redis key로 TTL을 조회합니다

**File:** `apps/api/src/modules/booking/booking.service.ts:350`
**Issue:** lock key는 `{${showtimeId}}:seat:${seatId}` 형식인데, TTL 조회는 `seat:${showtimeId}:${userSeats[0]}`를 사용합니다. 실제 lock이 살아 있어도 `ttl()`은 `-2`를 반환해 `expiresAt`이 `null`이 되고, 클라이언트 타이머/복구 흐름이 잘못 동작할 수 있습니다.
**Fix:** line 351을 `const firstSeatKey = \`{${showtimeId}}:seat:${userSeats[0]}\`;`로 바꾸고, 가능하면 valid seat들의 TTL 중 가장 이른 만료 시간을 사용하세요.

### WR-02: WARNING - complete page가 `amount` 누락/비정상 값에서 무한 loading에 빠집니다

**File:** `apps/web/app/booking/[performanceId]/complete/page.tsx:76`
**Issue:** `confirmPayment()`는 `!amount`이면 return하지만, invalid access 분기는 lines 132-149에서 `paymentKey`와 `orderId`만 검사합니다. `/complete?paymentKey=x&orderId=y`처럼 amount가 없거나 `amount=abc`인 URL은 confirm도 하지 않고 error도 표시하지 않은 채 skeleton만 계속 보여줍니다.
**Fix:**
```tsx
const parsedAmount = Number(amount);
const hasValidAmount = amount !== null && Number.isFinite(parsedAmount) && parsedAmount > 0;

if (!paymentKey || !orderId || !hasValidAmount) {
  return <InvalidAccess />;
}
```

### WR-03: WARNING - InMemoryRedis `del()`이 set key와 TTL timer를 삭제하지 않습니다

**File:** `apps/api/src/modules/booking/providers/redis.provider.ts:147`
**Issue:** real Redis `DEL`은 string과 set 모두 삭제하지만 mock은 `store.delete()`만 호출합니다. `unlockAllSeats()`가 line 288에서 user-seats set을 삭제해도 in-memory mock에서는 set이 남아 local dev/test 동작이 production Redis와 달라집니다.
**Fix:**
```ts
async del(...keys: string[]): Promise<number> {
  let count = 0;
  for (const key of keys) {
    const existed = this.store.delete(key) || this.sets.delete(key);
    const timer = this.ttls.get(key);
    if (timer) clearTimeout(timer);
    this.ttls.delete(key);
    this.expiries.delete(key);
    if (existed) count++;
  }
  return count;
}
```

### WR-04: WARNING - prepare idempotency가 기존 reservation의 상태와 요청 일치 여부를 검증하지 않습니다

**File:** `apps/api/src/modules/reservation/reservation.service.ts:106`
**Issue:** 같은 `tossOrderId`가 있으면 status가 `CANCELLED`/`CONFIRMED`인지, 요청의 `showtimeId`/좌석/금액이 기존 reservation과 같은지 확인하지 않고 기존 id를 반환합니다. 만료로 `cancelPendingReservation()` 된 orderId가 재사용되면 취소된 reservation id가 prepare 응답으로 나갈 수 있고, 이후 confirm은 line 206의 non-pending branch로 빠져 실제 결제 없이 detail을 반환하려고 합니다.
**Fix:** idempotent return은 `PENDING_PAYMENT`이고 canonical request가 완전히 같은 경우로 제한하세요. 상태가 `CANCELLED`/`FAILED`이면 새 orderId를 요구하거나 명시적인 409를 반환하고, seats/amount/showtime mismatch도 409로 거부해야 합니다.

---

_Reviewed: 2026-04-29T08:55:31Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
