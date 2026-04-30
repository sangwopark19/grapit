---
phase: 19-seat-lock-ownership-enforcement
reviewed: 2026-04-30T00:33:42Z
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
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-30T00:33:42Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Standard-depth review covered the Phase 19 seat-lock ownership and payment-confirm paths across API, Redis mock/provider, web confirmation pages, and tests. Typecheck and unit tests pass, but the implementation still has release-blocking correctness gaps in payment-confirm races, pending-reservation cancellation, and compensation handling.

## Critical Issues

### CR-01: [BLOCKER] Pending-cancel can overwrite a confirmed paid reservation

**File:** `apps/api/src/modules/reservation/reservation.service.ts:890-898`

**Issue:** `cancelPendingReservation()` first reads a `PENDING_PAYMENT` row, but the later update only filters by `id`. If payment confirmation changes the same reservation to `CONFIRMED` between the read and update, this method can set a paid reservation back to `CANCELLED`. This is a payment/data-loss race.

**Fix:**
```ts
const [cancelled] = await this.db
  .update(reservations)
  .set({
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelReason: '좌석 점유 만료',
    updatedAt: new Date(),
  })
  .where(and(
    eq(reservations.id, reservation.id),
    eq(reservations.userId, userId),
    eq(reservations.status, 'PENDING_PAYMENT'),
  ))
  .returning({ id: reservations.id });

if (!cancelled) return;
```

### CR-02: [BLOCKER] Cancelled reservations are treated as successful payment confirmation

**File:** `apps/api/src/modules/reservation/reservation.service.ts:405-407`, `apps/web/app/booking/[performanceId]/complete/page.tsx:96-97`

**Issue:** `confirmAndCreateReservationLocked()` treats every non-`PENDING_PAYMENT` status as "already confirmed" and returns reservation detail. A `CANCELLED` pending reservation can therefore be returned to the complete page, which unconditionally sets `bookingData`; `BookingComplete` then renders a success heading. Users can see "예매가 완료되었습니다" for a cancelled/expired reservation.

**Fix:**
```ts
if (reservation.status === 'CONFIRMED') {
  return this.getReservationDetail(reservation.id, userId);
}

if (reservation.status !== 'PENDING_PAYMENT') {
  throw new ConflictException('좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.');
}
```

Also guard the client response:
```ts
if (result.status !== 'CONFIRMED') {
  throw new Error('예매를 완료하지 못했습니다. 예매 내역을 확인해주세요.');
}
setBookingData(result);
```

### CR-03: [BLOCKER] Failed Toss compensation is swallowed and returned as a normal conflict

**File:** `apps/api/src/modules/reservation/reservation.service.ts:459-467`, `apps/api/src/modules/reservation/reservation.service.ts:479-487`, `apps/api/src/modules/reservation/reservation.service.ts:568-578`

**Issue:** After Toss has approved payment, several compensation paths attempt `cancelPayment()` but still throw the original `ConflictException` when cancellation fails. That hides a captured-payment/manual-refund state behind messages like "이미 다른 사용자가 선택한 좌석입니다" or "이미 판매된 좌석입니다". The client will treat this as a recoverable seat conflict instead of a critical payment reconciliation case.

**Fix:**
```ts
private async cancelConfirmedPaymentOrThrow(paymentKey: string, reason: string): Promise<void> {
  try {
    await this.tossClient.cancelPayment(paymentKey, reason);
  } catch (cancelError) {
    this.logger.error(
      `CRITICAL: compensation cancel failed. paymentKey=${paymentKey}. Manual refund required.`,
      cancelError instanceof Error ? cancelError.stack : String(cancelError),
    );
    throw new InternalServerErrorException(
      '결제는 승인되었으나 자동 취소에 실패했습니다. 고객센터에 문의해주세요.',
    );
  }
}
```

Use this helper in all post-confirm compensation branches before rethrowing business conflicts.

### CR-04: [BLOCKER] Seat locks are consumed before seats are durably marked sold

**File:** `apps/api/src/modules/reservation/reservation.service.ts:470-492`

**Issue:** The code deletes Redis seat locks with `consumeOwnedSeatLocks()` before the DB transaction marks those seats `sold`. During that window `BookingService.lockSeat()` sees no Redis lock and no committed sold row, so another user can relock the same seat and enter payment. The DB uniqueness guard may eventually cancel the second payment, but the lock layer no longer enforces ownership through the durable sale transition.

**Fix:**
```ts
await this.bookingService.assertOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);

await this.db.transaction(async (tx) => {
  // mark reservation CONFIRMED, insert payment, conditionally mark seats sold
});

try {
  await this.bookingService.consumeOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);
} catch (cleanupError) {
  this.logger.warn(
    `Post-commit seat lock cleanup failed. reservationId=${reservation.id}`,
    cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
  );
}
```

If cleanup fails after commit, DB `sold` state remains the source of truth and stale Redis locks can expire or be cleaned separately.

## Warnings

### WR-01: [WARNING] Stale user-seat cleanup counts locks owned by other users

**File:** `apps/api/src/modules/booking/booking.service.ts:40-50`

**Issue:** `LOCK_SEAT_LUA` treats any existing `{showtimeId}:seat:{seatId}` key as an active seat for the current user. If the user's old set member outlives expiry cleanup and another user later locks that same seat, the old user's `alive` count is inflated and can incorrectly trigger the max-seat limit.

**Fix:**
```lua
local owner = redis.call('GET', ARGV[5] .. sid)
if owner == ARGV[1] then
  alive = alive + 1
else
  redis.call('SREM', KEYS[1], sid)
  if not owner then
    redis.call('SREM', KEYS[3], sid)
  end
end
```

### WR-02: [WARNING] Payment confirmation shortens seat locks without refreshing them

**File:** `apps/api/src/modules/booking/booking.service.ts:188-191`, `apps/api/src/modules/reservation/reservation.service.ts:416-424`

**Issue:** `extendOwnedSeatLocks()` uses `EXPIRE` with `PAYMENT_CONFIRM_LOCK_TTL` (60s), which can shorten a seat lock that originally had up to 10 minutes remaining. The order-level confirm lock is refreshed on an interval, but the seat locks are not. A slow or stalled Toss confirm can let the seat locks expire after payment approval and force compensation.

**Fix:** Do not reduce existing TTLs, and either refresh the seat locks together with the order confirm lock or bound the Toss confirm call with a timeout shorter than the refreshed seat TTL.
```lua
local currentTtl = redis.call('TTL', KEYS[i])
if currentTtl < ttl then
  redis.call('EXPIRE', KEYS[i], ttl)
end
```

## Verification

- Passed: `pnpm --filter @grabit/api typecheck`
- Passed: `pnpm --filter @grabit/web typecheck`
- Passed: `pnpm --filter @grabit/api test -- src/modules/booking/__tests__/booking.service.spec.ts src/modules/booking/providers/__tests__/redis.provider.spec.ts src/modules/reservation/reservation.service.spec.ts` (Vitest ran the API suite: 29 files, 370 tests)
- Passed: `pnpm --filter @grabit/web test -- hooks/__tests__/use-booking.test.tsx` (Vitest ran the web suite: 27 files, 190 tests)

---

_Reviewed: 2026-04-30T00:33:42Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
