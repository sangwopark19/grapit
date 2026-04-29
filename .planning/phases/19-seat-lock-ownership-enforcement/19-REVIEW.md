---
phase: 19-seat-lock-ownership-enforcement
reviewed: 2026-04-29T09:34:42Z
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
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-29T09:34:42Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

19-REVIEW-FIX resolved several mechanical defects from the original review: broad confirm-time unlock was removed, DB sold transition is now conditional, duplicate seat IDs are rejected, `getMyLocks()` uses the right lock key shape, invalid `amount` no longer spins forever, `InMemoryRedis.del()` now deletes sets, and prepare idempotency validates status/request shape.

However, the payment confirmation boundary is still not safe enough to ship. The current flow checks seat locks before Toss, then can sell seats after those locks have expired or changed owner. The new order-level Redis lock also expires independently of the request, so the original same-order race can reappear under a slow or stuck confirm. The original seat metadata trust issue is only partially fixed because missing/malformed seat map config falls back to client-supplied tier data.

## Critical Issues

### CR-01: BLOCKER - Confirm can sell seats after the user's lock expired during Toss confirm

**File:** `apps/api/src/modules/reservation/reservation.service.ts:388`
**Issue:** `confirmAndCreateReservationLocked()` asserts Redis ownership once at line 388, then calls Toss at lines 390-395, and only commits DB sold state at lines 399-449. If the seat lock has one second left, or Toss/network/DB latency takes longer than the remaining lock TTL, the lock can expire or be acquired by another user before the DB sold transition. The first user still gets a confirmed reservation after their lock has expired, and a second user can temporarily hold a Redis lock for a seat that was sold out from under them.
**Fix:**
```ts
// Before Toss: atomically verify ownership and extend every requested lock
// long enough to cover the external confirm + DB commit path.
await this.bookingService.extendOwnedSeatLocks(
  userId,
  reservation.showtimeId,
  pendingSeatIds,
  PAYMENT_CONFIRM_LOCK_TTL,
);

const tossResponse = await this.tossClient.confirmPayment(...);

// After Toss and before DB sold commit: verify ownership again. If this fails,
// cancel the Toss payment and do not mark seats sold.
await this.bookingService.assertOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);

await this.db.transaction(async (tx) => {
  // conditional sold transition remains here
});

await this.bookingService.consumeOwnedSeatLocks(userId, reservation.showtimeId, pendingSeatIds);
```

### CR-02: BLOCKER - The same-order confirm lock can expire before the request finishes

**File:** `apps/api/src/modules/booking/booking.service.ts:163`
**Issue:** `PAYMENT_CONFIRM_LOCK_TTL` is fixed at 60 seconds, but `confirmAndCreateReservation()` includes an external Toss API call and DB transaction, and the Toss client uses `fetch()` without an abort timeout. If the first request exceeds 60 seconds, a second request for the same `orderId` can acquire a new lock and pass the existing-payment check. The old race from the original CR-02 then returns: one request can commit while the other later fails on a unique payment insert and runs compensation cancel against the same payment key.
**Fix:**
```ts
// Use a lock whose lifetime cannot expire mid-request, or prefer a DB lock.
await this.db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${dto.orderId}))`);
  // Re-check existing payment inside the locked transaction.
  // Do not call compensation cancel for duplicate/idempotent payment insert races
  // until the current payment row state has been re-read.
});

// Also add AbortController timeouts around Toss confirm/cancel so external calls
// cannot outlive the chosen lock/request budget.
```

### CR-03: BLOCKER - Missing seat map config still lets clients choose tier and price metadata

**File:** `apps/api/src/modules/reservation/reservation.service.ts:128`
**Issue:** `getCanonicalSeatSelections()` only canonicalizes tier from `seatMaps.seatConfig` when a usable `tiers` array exists. If the row is missing, `seatConfig` is null, or `tiers` is malformed, line 131 falls back to `seat.tierName` and lines 141-143 keep client row/number. That leaves the original CR-03 pricing/tier tampering path open for any performance with incomplete seat map metadata.
**Fix:**
```ts
const seatTierBySeatId = this.getSeatTierBySeatId(seatMapRows[0]?.seatConfig);
if (!seatTierBySeatId) {
  throw new BadRequestException('좌석 배치 정보가 유효하지 않습니다');
}

return seats.map((seat) => {
  const tierName = seatTierBySeatId.get(seat.seatId);
  if (!tierName) throw new BadRequestException('유효하지 않은 좌석입니다');
  // derive tierName, price, row, number from server-side metadata only
});
```

## Warnings

### WR-01: WARNING - Complete page recovery failures still fall into an endless spinner

**File:** `apps/web/app/booking/[performanceId]/complete/page.tsx:61`
**Issue:** After a non-lock confirm failure, the page sets `confirmFailed` and queries `useReservationByOrderId()`. If that query returns `null` or errors, `recoveredReservation` stays empty and no terminal error state is set. Because `confirmMutation.isError` is true, lines 183-201 skip the skeleton success path and render only the fallback spinner forever. This is reachable when the backend compensates a failed post-Toss DB transition and no payment row exists to recover.
**Fix:** Track the recovery query's `isError`/`isFetched` state and render a failed confirmation state when recovery returns no confirmed reservation.

```tsx
const {
  data: recoveredReservation,
  isFetched: recoveryFetched,
  isError: recoveryError,
} = useReservationByOrderId(shouldRecover ? orderId : null);

useEffect(() => {
  if (!shouldRecover || !recoveryFetched) return;
  if (recoveredReservation?.status === 'CONFIRMED') {
    setBookingData(recoveredReservation);
    return;
  }
  setConfirmationErrorMessage('결제 확인에 실패했습니다. 예매 내역을 확인해주세요.');
}, [shouldRecover, recoveryFetched, recoveredReservation]);
```

---

_Reviewed: 2026-04-29T09:34:42Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
