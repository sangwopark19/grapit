# Phase 19: Seat Lock Ownership Enforcement - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 10 likely modified files, plus 8 reference analog files
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/modules/booking/booking.service.ts` | service | CRUD, event-driven | `apps/api/src/modules/booking/booking.service.ts` + `apps/api/src/modules/sms/sms.service.ts` | exact |
| `apps/api/src/modules/booking/providers/redis.provider.ts` | provider | request-response, transform | `apps/api/src/modules/booking/providers/redis.provider.ts` | exact |
| `apps/api/src/modules/reservation/reservation.service.ts` | service | request-response, CRUD | `apps/api/src/modules/reservation/reservation.service.ts` | exact |
| `apps/web/app/booking/[performanceId]/confirm/page.tsx` | component | request-response | `apps/web/app/booking/[performanceId]/confirm/page.tsx` + `apps/web/components/booking/booking-page.tsx` | exact |
| `apps/web/app/booking/[performanceId]/complete/page.tsx` | component | request-response | `apps/web/app/booking/[performanceId]/complete/page.tsx` | exact |
| `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` | test | CRUD | `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` | exact |
| `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` | test | CRUD | `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` | exact |
| `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` | test | transform | `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` | exact |
| `apps/api/src/modules/reservation/reservation.service.spec.ts` | test | request-response, CRUD | `apps/api/src/modules/reservation/reservation.service.spec.ts` | exact |
| `apps/web/e2e/toss-payment.spec.ts` | test | request-response | `apps/web/e2e/toss-payment.spec.ts` | exact |

## Pattern Assignments

### `apps/api/src/modules/booking/booking.service.ts` (service, CRUD/event-driven)

**Analog:** `apps/api/src/modules/booking/booking.service.ts`

**Imports pattern** (lines 1-9):
```typescript
import { Injectable, Inject, ConflictException } from '@nestjs/common';
import type IORedis from 'ioredis';
import { eq, and } from 'drizzle-orm';
import { REDIS_CLIENT } from './providers/redis.provider.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { seatInventories } from '../../database/schema/seat-inventories.js';
import { BookingGateway } from './booking.gateway.js';
import type { LockSeatResponse, SeatState, SeatStatusResponse, UnlockAllResponse } from '@grabit/shared';
```

**Lua documentation/key contract pattern** (lines 17-31):
```typescript
/**
 * Lua script for atomic seat locking.
 * Cleans stale user-seats entries, checks count, SET NX, SADD + EXPIRE.
 *
 * KEYS[1] = {showtimeId}:user-seats:{userId}
 * KEYS[2] = {showtimeId}:seat:{seatId}
 * KEYS[3] = {showtimeId}:locked-seats
 * ARGV[1] = userId
 * ARGV[2] = LOCK_TTL (600)
 * ARGV[3] = MAX_SEATS (4)
 * ARGV[4] = seatId
 * ARGV[5] = key prefix "{showtimeId}:seat:"
 *
 * Hash tag {showtimeId} ensures all keys hash to the same Redis Cluster slot.
 */
```

**Single-seat safe unlock pattern** (lines 56-75):
```typescript
/**
 * Lua script for atomic seat unlocking.
 * Checks ownership before deleting to prevent TOCTOU race.
 *
 * KEYS[1] = {showtimeId}:seat:{seatId}
 * KEYS[2] = {showtimeId}:user-seats:{userId}
 * KEYS[3] = {showtimeId}:locked-seats
 * ARGV[1] = userId
 * ARGV[2] = seatId
 * Returns: 1 if unlocked, 0 if not owner
 */
const UNLOCK_SEAT_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  redis.call('SREM', KEYS[3], ARGV[2])
  return 1
end
return 0
`;
```

**ioredis `eval()` flat signature + hash-tag keys** (lines 127-143):
```typescript
const userSeatsKey = `{${showtimeId}}:user-seats:${userId}`;
const lockKey = `{${showtimeId}}:seat:${seatId}`;
const lockedSeatsKey = `{${showtimeId}}:locked-seats`;
const keyPrefix = `{${showtimeId}}:seat:`;

const result = (await this.redis.eval(
  LOCK_SEAT_LUA,
  3,
  userSeatsKey,
  lockKey,
  lockedSeatsKey,
  userId,
  String(LOCK_TTL),
  String(MAX_SEATS),
  seatId,
  keyPrefix,
)) as [number, string, string?];
```

**Business conflict + broadcast pattern** (lines 145-155):
```typescript
const [status, reason] = result;

if (status === 0) {
  if (reason === 'MAX_SEATS') {
    throw new ConflictException(`최대 ${MAX_SEATS}석까지 선택할 수 있습니다`);
  }
  throw new ConflictException('이미 다른 사용자가 선택한 좌석입니다');
}

// Broadcast real-time update (include userId so sender can ignore own events)
this.gateway.broadcastSeatUpdate(showtimeId, seatId, 'locked', userId);
```

**Apply to Phase 19:** add `assertOwnedSeatLocks(userId, showtimeId, seatIds)` and `consumeOwnedSeatLocks(userId, showtimeId, seatIds)` here, not in `ReservationService`. Copy the `eval()` shape, `ConflictException` style, and hash-tag key construction. For new multi-seat scripts, pass every touched key through `KEYS`: `[userSeatsKey, lockedSeatsKey, ...seatLockKeys]`. Do not build requested seat lock keys inside Lua from a prefix for assert/consume.

**Secondary analog for hash-tag builder discipline:** `apps/api/src/modules/sms/sms.service.ts`

**Hash-tag invariant comments and builders** (lines 83-126):
```typescript
// All keys MUST share the `{sms:${e164}}` hash tag so CRC16 maps them
// to the same Redis Cluster slot — otherwise `VERIFY_AND_INCREMENT_LUA`
// (multi-key EVAL) raises `CROSSSLOT Keys in request don't hash to the same slot`
// on cluster-mode Valkey / Memorystore.
const E164_RE = /^\+\d{6,15}$/;
function assertE164(s: string): void {
  if (!E164_RE.test(s)) {
    throw new Error(`[sms] non-E164 key input: ${s.slice(0, 4)}***`);
  }
}
export const smsOtpKey           = (e164: string): string => { assertE164(e164); return `{sms:${e164}}:otp`; };
export const smsAttemptsKey      = (e164: string): string => { assertE164(e164); return `{sms:${e164}}:attempts`; };
export const smsVerifiedKey      = (e164: string): string => { assertE164(e164); return `{sms:${e164}}:verified`; };
```

---

### `apps/api/src/modules/booking/providers/redis.provider.ts` (provider, request-response/transform)

**Analog:** `apps/api/src/modules/booking/providers/redis.provider.ts`

**Provider and local mock contract** (lines 1-13):
```typescript
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * In-memory Redis mock for local dev when REDIS_URL is not configured.
 * Implements only the subset of commands used by BookingService.
 *
 * NOTE: eval() follows ioredis flat signature (script, numKeys, ...keysAndArgs),
 * not the Upstash object-keys pattern.
 */
```

**Lua emulation dispatch pattern** (lines 199-228):
```typescript
/**
 * Dispatches Lua script emulation using the ioredis flat signature.
 *
 * Signature: eval(script, numKeys, ...keysAndArgs)
 * Dispatches by script content + key/arg arity.
 */
async eval(
  script: string,
  numKeys: number,
  ...keysAndArgs: (string | number)[]
): Promise<unknown> {
  const keys = keysAndArgs.slice(0, numKeys).map(String);
  const args = keysAndArgs.slice(numKeys).map(String);

  if (keys.length === 3 && args.length === 5) {
    return this.evalLockSeat(keys, args);
  }
  if (keys.length === 3 && args.length === 2) {
    return this.evalUnlockSeat(keys, args);
  }
  if (keys.length === 1 && args.length === 1) {
    return this.evalGetValidLockedSeats(keys, args);
  }
  throw new Error('InMemoryRedis: unknown Lua script pattern');
}
```

**Existing lock emulation pattern** (lines 269-301):
```typescript
private async evalLockSeat(keys: string[], args: string[]): Promise<[number, string, string?]> {
  const [userSeatsKey, lockKey, lockedSeatsKey] = keys;
  const [userId, lockTtl, maxSeats, seatId, keyPrefix] = args;

  const members = Array.from(this.sets.get(userSeatsKey) ?? []);
  let alive = 0;
  for (const sid of members) {
    if (this.store.has(`${keyPrefix}${sid}`)) {
      alive++;
    } else {
      const userSet = this.sets.get(userSeatsKey);
      if (userSet) userSet.delete(sid);
      const lockedSet = this.sets.get(lockedSeatsKey);
      if (lockedSet) lockedSet.delete(sid);
    }
  }

  if (alive >= Number(maxSeats)) {
    return [0, 'MAX_SEATS'];
  }

  const existing = this.store.get(lockKey);
  if (existing !== undefined) {
    return [0, 'CONFLICT'];
  }

  await this.set(lockKey, userId as string, { nx: true, ex: Number(lockTtl) });
  await this.sadd(userSeatsKey, seatId as string);
  await this.expire(userSeatsKey, Number(lockTtl));
  await this.sadd(lockedSeatsKey, seatId as string);

  return [1, lockKey, seatId as string];
}
```

**Existing safe unlock emulation pattern** (lines 303-323):
```typescript
private evalUnlockSeat(keys: string[], args: string[]): number {
  const [lockKey, userSeatsKey, lockedSeatsKey] = keys;
  const [userId, seatId] = args;

  const owner = this.store.get(lockKey);
  if (owner !== userId) return 0;

  this.store.delete(lockKey);
  const timer = this.ttls.get(lockKey);
  if (timer) clearTimeout(timer);
  this.ttls.delete(lockKey);
  this.expiries.delete(lockKey);

  const userSet = this.sets.get(userSeatsKey);
  if (userSet) userSet.delete(seatId);

  const lockedSet = this.sets.get(lockedSeatsKey);
  if (lockedSet) lockedSet.delete(seatId);

  return 1;
}
```

**Production Redis hard-fail pattern** (lines 358-374):
```typescript
if (!url) {
  // Production misconfig must hard-fail: silent InMemoryRedis fallback would
  // isolate seat locking to a single Cloud Run instance (no cross-instance
  // pub/sub, no persistence) and silently allow duplicate bookings.
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      '[redis] REDIS_URL is required in production environment. ' +
        'Silent InMemoryRedis fallback is disabled to prevent duplicate bookings from instance-isolated seat locking. ' +
        'Check Cloud Run secret binding for redis-url.',
    );
  }
  console.warn(
    '[redis] No REDIS_URL — using in-memory mock. Seat locking works but is not persistent. ' +
      '(Development/test only — production now hard-fails.)',
  );
  return new InMemoryRedis() as unknown as IORedis;
}
```

**Apply to Phase 19:** extend `eval()` dispatch for new assert/consume scripts by arity plus script marker, then implement emulators that return the same tuple shape as Valkey Lua. Preserve production fail-closed behavior; do not add any production fallback.

---

### `apps/api/src/modules/reservation/reservation.service.ts` (service, request-response/CRUD)

**Analog:** `apps/api/src/modules/reservation/reservation.service.ts`

**Imports and dependency injection pattern** (lines 1-33, 39-44):
```typescript
import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import { BookingService } from '../booking/booking.service.js';
import { BookingGateway } from '../booking/booking.gateway.js';
```

```typescript
constructor(
  @Inject(DRIZZLE) private readonly db: DrizzleDB,
  private readonly tossClient: TossPaymentsClient,
  private readonly bookingService: BookingService,
  private readonly bookingGateway: BookingGateway,
) {}
```

**Prepare idempotency bypass to fix** (lines 81-93):
```typescript
async prepareReservation(
  dto: PrepareReservationRequest,
  userId: string,
): Promise<PrepareReservationResponse> {
  // 1. Idempotency: if a reservation already exists for this orderId, return it
  const [existing] = await this.db
    .select({ id: reservations.id, tossOrderId: reservations.tossOrderId })
    .from(reservations)
    .where(eq(reservations.tossOrderId, dto.orderId));

  if (existing) {
    return { reservationId: existing.id, orderId: dto.orderId };
  }
```

**Apply to Phase 19:** this return is the current anti-pattern. Before returning an existing pending reservation, fetch its `reservationSeats` and call `bookingService.assertOwnedSeatLocks(userId, showtimeId, seatIds)`. Also assert `dto.seats.map((s) => s.seatId)` before creating a new pending reservation.

**Amount validation + pending transaction pattern** (lines 105-146):
```typescript
const expectedAmount = await this.calculateTotalAmount(dto.seats, showtime.performanceId);

if (expectedAmount !== dto.amount) {
  throw new BadRequestException('금액이 일치하지 않습니다');
}

const result = await this.db.transaction(async (tx) => {
  const [reservation] = await tx
    .insert(reservations)
    .values({
      userId,
      showtimeId: dto.showtimeId,
      tossOrderId: dto.orderId,
      reservationNumber,
      status: 'PENDING_PAYMENT',
      totalAmount: dto.amount,
      cancelDeadline,
    })
    .returning();

  await tx.insert(reservationSeats).values(
    dto.seats.map((seat) => ({
      reservationId,
      seatId: seat.seatId,
      tierName: seat.tierName,
      price: seat.price,
      row: seat.row,
      number: seat.number,
    })),
  );
```

**Confirm idempotency and pre-Toss anti-pattern to fix** (lines 153-193):
```typescript
// 1. Idempotency: check if payment already exists for this orderId
const [existingPayment] = await this.db
  .select()
  .from(payments)
  .where(eq(payments.tossOrderId, dto.orderId));

if (existingPayment) {
  return this.getReservationDetail(existingPayment.reservationId, userId);
}

// 3. Amount validation against the prepared reservation
if (reservation.totalAmount !== dto.amount) {
  throw new BadRequestException('금액이 일치하지 않습니다');
}

// 4. Call Toss Payments confirm API
const tossResponse = await this.tossClient.confirmPayment({
  paymentKey: dto.paymentKey,
  orderId: dto.orderId,
  amount: dto.amount,
});
```

**Apply to Phase 19:** keep existing payment idempotency first. After pending reservation and amount validation, fetch seat IDs and assert lock ownership before `confirmPayment()`. After Toss confirm, call `consumeOwnedSeatLocks()` before the DB sold transition. If consume fails after Toss, use the compensation pattern below.

**DB sold transition pattern** (lines 195-249):
```typescript
try {
  await this.db.transaction(async (tx) => {
    await tx
      .update(reservations)
      .set({
        status: 'CONFIRMED',
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, reservation.id));

    await tx.insert(payments).values({
      reservationId: reservation.id,
      paymentKey: tossResponse.paymentKey,
      tossOrderId: tossResponse.orderId,
      method: tossResponse.method,
      amount: tossResponse.totalAmount,
      status: 'DONE',
      paidAt: new Date(tossResponse.approvedAt),
    });

    const resSeats = await tx
      .select({ seatId: reservationSeats.seatId })
      .from(reservationSeats)
      .where(eq(reservationSeats.reservationId, reservation.id));
```

**Compensation pattern** (lines 250-267):
```typescript
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

**Sold broadcast after commit pattern** (lines 270-283):
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

**Apply to Phase 19:** replace broad `unlockAllSeats()` with targeted consume of confirmed seats. Keep `sold` broadcasts after the DB transaction commits.

---

### `apps/web/app/booking/[performanceId]/confirm/page.tsx` (component, request-response)

**Analog:** `apps/web/app/booking/[performanceId]/confirm/page.tsx`

**Imports pattern** (lines 1-16):
```typescript
'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { TossPaymentWidget, type TossPaymentWidgetRef } from '@/components/booking/toss-payment-widget';
import { Button } from '@/components/ui/button';
import { usePrepareReservation, useUnlockAllSeats, useCancelPendingReservation } from '@/hooks/use-booking';
import { useBookingStore } from '@/stores/use-booking-store';
import { useAuthStore } from '@/stores/use-auth-store';
```

**Timer expiry route-back pattern** (lines 95-105):
```typescript
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

**Prepare-before-Toss and server error surfacing pattern** (lines 119-140):
```typescript
async function handlePayment() {
  if (!paymentWidgetRef.current || !agreed || isProcessing) return;

  setIsProcessing(true);
  try {
    // 1. Create pending reservation on server before payment
    const result = await prepareMutation.mutateAsync({
      orderId,
      showtimeId: selectedShowtimeId ?? '',
      seats: selectedSeats,
      amount: totalPrice,
    });
    reservationIdRef.current = result.reservationId;

    // 2. Initiate Toss payment — SDK redirects the browser
    await paymentWidgetRef.current.requestPayment();
  } catch (err) {
    setIsProcessing(false);
    const errorMessage =
      err instanceof Error ? err.message : '결제 요청에 실패했습니다.';
    toast.error(errorMessage);
  }
}
```

**CTA disabled/text pattern** (lines 151-156, 201-210):
```typescript
const ctaDisabled = !agreed || isProcessing || !widgetReady;
const ctaText = isProcessing
  ? '결제 처리 중...'
  : !agreed
    ? '약관에 동의해주세요'
    : '결제하기';
```

```tsx
<Button
  className="h-12 w-full text-base"
  disabled={ctaDisabled}
  onClick={handlePayment}
>
  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {ctaText}
</Button>
```

**Apply to Phase 19:** server `409` messages already surface through `err.message`. For lock failures, keep `requestPayment()` after successful prepare only. If adding a visible CTA back to seats, copy the `router.replace(`/booking/${performanceId}`)` route-back pattern and preserve mobile sticky CTA dimensions.

**Secondary analog for seat-selection state recovery:** `apps/web/components/booking/booking-page.tsx`

**Optimistic lock error rollback** (lines 231-255):
```typescript
lockSeat.mutate(
  { showtimeId: selectedShowtimeId, seatId },
  {
    onSuccess: (response) => {
      if (response.expiresAt) {
        setTimerExpiry(response.expiresAt);
      }
    },
    onError: (error: unknown) => {
      // Race condition: revert optimistic update
      removeSeat(seatId);
      if (
        error instanceof ApiClientError &&
        error.statusCode === 409
      ) {
        toast.info('이미 다른 사용자가 선택한 좌석입니다');
      } else {
        toast.error(
          '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        );
      }
    },
  },
);
```

---

### `apps/web/app/booking/[performanceId]/complete/page.tsx` (component, request-response)

**Analog:** `apps/web/app/booking/[performanceId]/complete/page.tsx`

**Imports and state pattern** (lines 1-11, 38-45):
```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { BookingComplete } from '@/components/booking/booking-complete';
import { useConfirmPayment, useReservationByOrderId } from '@/hooks/use-booking';
import { useBookingStore } from '@/stores/use-booking-store';
import type { ReservationDetail } from '@grabit/shared';
```

```typescript
const confirmMutation = useConfirmPayment();
const [bookingData, setBookingData] = useState<ReservationDetail | null>(null);
const [isConfirming, setIsConfirming] = useState(false);
const hasConfirmedRef = useRef(false);

// Recovery: on refresh after confirm already succeeded, fetch by orderId
const [confirmFailed, setConfirmFailed] = useState(false);
const shouldRecover = confirmFailed && !!orderId;
```

**Recovery pattern** (lines 47-60):
```typescript
const { data: recoveredReservation } = useReservationByOrderId(
  shouldRecover ? orderId : null,
);

useEffect(() => {
  if (!shouldRecover || !recoveredReservation) return;

  if (recoveredReservation.status === 'CONFIRMED') {
    setBookingData(recoveredReservation);
  } else {
    toast.info('예매 내역에서 확인해주세요.');
    router.replace('/mypage?tab=reservations');
  }
}, [shouldRecover, recoveredReservation, router]);
```

**Confirm mutation + failed recovery trigger** (lines 62-89):
```typescript
const confirmPayment = useCallback(async () => {
  if (hasConfirmedRef.current || !paymentKey || !orderId || !amount) {
    return;
  }

  hasConfirmedRef.current = true;
  setIsConfirming(true);

  try {
    const result = await confirmMutation.mutateAsync({
      paymentKey,
      orderId,
      amount: Number(amount),
    });

    setBookingData(result);
    clearBooking();
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : '결제 확인에 실패했습니다.';
    toast.error(errorMessage);
    // Try recovery — maybe already confirmed on a previous attempt
    setConfirmFailed(true);
  } finally {
    setIsConfirming(false);
  }
}, [
```

**Current loading/success/fallback pattern** (lines 130-149):
```typescript
// Loading state
if (isConfirming || (!bookingData && !confirmMutation.isError)) {
  return <CompleteSkeleton />;
}

// Success state
if (bookingData) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-12">
      <BookingComplete booking={bookingData} />
    </main>
  );
}

// Fallback - should not reach here normally
return (
  <div className="mx-auto flex min-h-[50vh] max-w-[720px] items-center justify-center px-6 py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);
```

**Apply to Phase 19:** add an explicit failed confirmation state before the fallback when `confirmMutation.isError && !bookingData`. Do not render `BookingComplete` unless the server returned confirmed reservation data or recovery found an already-confirmed payment.

---

### `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` (test, CRUD)

**Analog:** `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`

**Imports and mock factory pattern** (lines 1-57):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BookingService } from '../booking.service.js';
import type { BookingGateway } from '../booking.gateway.js';

function createMockRedis() {
  return {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    smembers: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    scard: vi.fn(),
    expire: vi.fn(),
    eval: vi.fn(),
    ttl: vi.fn(),
  };
}
```

**Eval key/arg assertion pattern for Lua** (lines 80-92):
```typescript
expect(mockRedis.eval).toHaveBeenCalledOnce();
const callArgs = mockRedis.eval.mock.calls[0] as unknown[];
const script = callArgs[0] as string;
const numKeys = callArgs[1] as number;
const flatKeys = callArgs.slice(2, 2 + numKeys) as string[];
expect(script).toContain('SMEMBERS');
expect(script).toContain('EXISTS');
expect(numKeys).toBe(3);
expect(flatKeys).toContain(`{${showtimeId}}:user-seats:${userId}`);
expect(flatKeys).toContain(`{${showtimeId}}:seat:${seatId}`);
expect(flatKeys).toContain(`{${showtimeId}}:locked-seats`);
```

**Safe unlock eval assertion pattern** (lines 190-212):
```typescript
mockRedis.eval.mockResolvedValue(1);

const result = await service.unlockSeat(userId, showtimeId, seatId);

expect(result).toBe(true);
expect(mockRedis.eval).toHaveBeenCalledOnce();
const callArgs = mockRedis.eval.mock.calls[0] as unknown[];
const script = callArgs[0] as string;
const numKeys = callArgs[1] as number;
const flatKeys = callArgs.slice(2, 2 + numKeys) as string[];
const flatArgs = callArgs.slice(2 + numKeys) as string[];
expect(script).toContain('GET');
expect(script).toContain('DEL');
expect(script).toContain('SREM');
expect(numKeys).toBe(3);
expect(flatKeys).toEqual([
  `{${showtimeId}}:seat:${seatId}`,
  `{${showtimeId}}:user-seats:${userId}`,
  `{${showtimeId}}:locked-seats`,
]);
expect(flatArgs).toEqual([userId, seatId]);
```

**No separate Redis calls when Lua owns atomic cleanup** (lines 223-231):
```typescript
await service.unlockSeat(userId, showtimeId, seatId);

// Lua script handles all cleanup atomically — no separate redis calls
expect(mockRedis.del).not.toHaveBeenCalled();
expect(mockRedis.srem).not.toHaveBeenCalled();
expect(mockRedis.get).not.toHaveBeenCalled();
```

**Apply to Phase 19:** add assert/consume tests next to `unlockSeat`, using this exact `eval` argument inspection style. Required cases: all-owned, missing, other-owner, stale index ignored, unrelated same-showtime lock preserved, and consume deletes only requested seats.

---

### `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` (test, CRUD)

**Analog:** `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts`

**Real Valkey setup pattern** (lines 1-3, 89-102):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import IORedis from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
```

```typescript
beforeAll(async () => {
  container = await new GenericContainer('valkey/valkey:8-alpine')
    .withExposedPorts(6379)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  redis = new IORedis({ host, port, maxRetriesPerRequest: 3 });

  // Sanity: PING should return PONG
  const pong = await redis.ping();
  expect(pong).toBe('PONG');
}, 120_000);
```

**Script copy warning pattern** (lines 23-26):
```typescript
// --- Lua scripts (copied from apps/api/src/modules/booking/booking.service.ts) ---
// If these ever diverge from booking.service.ts, this test catches it
// immediately in the assertion phase.
```

**Valkey eval state assertion pattern** (lines 109-143):
```typescript
const result = (await redis.eval(
  LOCK_SEAT_LUA,
  3,
  userSeatsKey,
  lockKey,
  lockedSeatsKey,
  userId,
  String(LOCK_TTL),
  String(MAX_SEATS),
  seatId,
  keyPrefix,
)) as [number, string, string];

expect(Array.isArray(result)).toBe(true);
expect(result[0]).toBe(1);
expect(result[1]).toBe(lockKey);
expect(result[2]).toBe(seatId);

const owner = await redis.get(lockKey);
expect(owner).toBe(userId);

const ttl = await redis.ttl(lockKey);
expect(ttl).toBeGreaterThan(0);
expect(ttl).toBeLessThanOrEqual(LOCK_TTL);

const userSeats = await redis.smembers(userSeatsKey);
expect(userSeats).toContain(seatId);

const lockedSeats = await redis.smembers(lockedSeatsKey);
expect(lockedSeats).toContain(seatId);
```

**Non-owner no-op assertion pattern** (lines 203-228):
```typescript
await redis.set(lockKey2, userId, 'EX', LOCK_TTL);
await redis.sadd(userSeatsKey, seatId2);
await redis.sadd(lockedSeatsKey, seatId2);

const result = (await redis.eval(
  UNLOCK_SEAT_LUA,
  3,
  lockKey2,
  `{${showtimeId}}:user-seats:user-impostor`,
  lockedSeatsKey,
  'user-impostor',
  seatId2,
)) as number;

expect(result).toBe(0);

// Verify the lock is STILL held by the original user
const owner = await redis.get(lockKey2);
expect(owner).toBe(userId);
```

**Apply to Phase 19:** add real Valkey tests for assert/consume tuple shape and side effects. Include explicit `numKeys = 2 + seatIds.length`, `KEYS` containing every touched seat key, `MISSING`, `OTHER_OWNER`, all-owned consume, and unrelated lock preservation.

---

### `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` (test, transform)

**Analog:** `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts`

**Provider factory setup pattern** (lines 33-69):
```typescript
describe('redisProvider factory', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  let useFactory: UseFactory;

  beforeEach(() => {
    // redisProvider.useFactory is the function we test
    useFactory = redisProvider.useFactory as UseFactory;
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('exposes the REDIS_CLIENT injection symbol', () => {
    expect(redisProvider.provide).toBe(REDIS_CLIENT);
  });

  it('throws when NODE_ENV=production and REDIS_URL is empty (hard-fail guard)', () => {
    process.env['NODE_ENV'] = 'production';
    const config = createMockConfig('');

    expect(() => useFactory(config)).toThrowError(/REDIS_URL is required in production/);
  });
```

**Local mock surface helper pattern** (lines 99-120):
```typescript
describe('InMemoryRedis surface parity with ioredis (Phase 10.1 WR-01)', () => {
  type MemRedis = {
    set: (key: string, value: string, ...args: unknown[]) => Promise<string | null>;
    get: (key: string) => Promise<string | null>;
    del: (...keys: string[]) => Promise<number>;
    decr: (key: string) => Promise<number>;
    ping: () => Promise<string>;
    pttl: (key: string) => Promise<number>;
    pipeline: () => {
      set: (key: string, value: string, ...args: unknown[]) => ReturnType<MemRedis['pipeline']>;
      del: (...keys: string[]) => ReturnType<MemRedis['pipeline']>;
      exec: () => Promise<Array<[Error | null, unknown]>>;
    };
  };

  function createMock(): MemRedis {
    process.env['NODE_ENV'] = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = useFactory(createMockConfig('')) as unknown as MemRedis;
    warnSpy.mockRestore();
    return client;
  }
```

**Parity assertion style** (lines 128-144):
```typescript
it('set(key, value, "PX", ms, "NX") honors NX + TTL (ioredis variadic)', async () => {
  const redis = createMock();
  const key = smsResendKey(TEST_PHONE);
  const first = await redis.set(key, '1', 'PX', 30_000, 'NX');
  expect(first).toBe('OK');

  // Second NX call must fail while key is live
  const second = await redis.set(key, '1', 'PX', 30_000, 'NX');
  expect(second).toBeNull();

  // pttl returns remaining milliseconds for a key with TTL
  const ttl = await redis.pttl(key);
  expect(ttl).toBeGreaterThan(0);
  expect(ttl).toBeLessThanOrEqual(30_000);
});
```

**Apply to Phase 19:** extend the `MemRedis` type with `eval`, `smembers`, `sadd`, `srem` if needed in tests, and add InMemoryRedis eval tests proving new assert/consume scripts return the same tuple shape and side effects as real Valkey.

---

### `apps/api/src/modules/reservation/reservation.service.spec.ts` (test, request-response/CRUD)

**Analog:** `apps/api/src/modules/reservation/reservation.service.spec.ts`

**Imports and mocks pattern** (lines 1-45):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ReservationService } from './reservation.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import type { BookingService } from '../booking/booking.service.js';
import type { BookingGateway } from '../booking/booking.gateway.js';
import type { SeatSelection } from '@grabit/shared';

function createMockBookingService() {
  return {
    unlockAllSeats: vi.fn().mockResolvedValue({ unlockedSeats: [] }),
  };
}
```

**Apply to Phase 19:** update `createMockBookingService()` to expose `assertOwnedSeatLocks` and `consumeOwnedSeatLocks`; new tests should assert Toss is not called when pre-check fails and `cancelPayment()` is called when post-Toss consume fails.

**Confirm mock chain pattern** (lines 261-379):
```typescript
function setupConfirmMocks() {
  // 1st select: check existing payment (none)
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  // 2nd select: get reservation by orderId + userId
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{
        id: reservationId,
        userId,
        showtimeId,
        tossOrderId: orderId,
        status: 'PENDING_PAYMENT',
        totalAmount: 150000,
      }]),
    }),
  });

  const mockTx = {
    update: vi.fn().mockImplementation((...args: unknown[]) => {
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      };
    }),
    insert: vi.fn().mockImplementation((...args: unknown[]) => {
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: randomUUID() }]),
        }),
      };
    }),
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { seatId: 'A-1' },
            { seatId: 'A-2' },
          ]),
        }),
      };
    }),
  };
```

**Current broad unlock expectation to replace** (lines 395-403):
```typescript
it('should call BookingService.unlockAllSeats after transaction', async () => {
  setupConfirmMocks();

  await service.confirmAndCreateReservation(
    { paymentKey: 'pk_test_123', orderId, amount: 150000 },
    userId,
  );

  expect(mockBookingService.unlockAllSeats).toHaveBeenCalledWith(userId, showtimeId);
});
```

**Sold broadcast assertion pattern** (lines 406-415):
```typescript
it('should call BookingGateway.broadcastSeatUpdate with sold for each seat', async () => {
  setupConfirmMocks();

  await service.confirmAndCreateReservation(
    { paymentKey: 'pk_test_123', orderId, amount: 150000 },
    userId,
  );

  expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-1', 'sold', userId);
  expect(mockBookingGateway.broadcastSeatUpdate).toHaveBeenCalledWith(showtimeId, 'A-2', 'sold', userId);
});
```

**Apply to Phase 19:** replace the broad unlock test with targeted consume tests. Add prepare tests for missing/expired/other-user locks and existing pending order idempotency. Add confirm tests for pre-Toss failure, post-Toss consume failure with compensation, existing payment idempotency bypassing active lock checks, and sold broadcast ordering after DB success.

---

### `apps/web/e2e/toss-payment.spec.ts` (test, request-response)

**Analog:** `apps/web/e2e/toss-payment.spec.ts`

**Imports and env gate pattern** (lines 1-4, 28-32):
```typescript
import { test, expect, type Route } from '@playwright/test';
import { injectBookingFixture } from './fixtures/booking-store';
import { loginAsTestUser } from './helpers/auth';

test.describe('Toss Payments E2E', () => {
  test.skip(
    !process.env['TOSS_CLIENT_KEY_TEST'],
    'Skipped: TOSS_CLIENT_KEY_TEST not set. CI main-push gate should have failed before reaching this.',
  );
```

**API route intercept pattern** (lines 49-76):
```typescript
await page.route('**/api/v1/payments/confirm', async (route: Route) => {
  confirmIntercepted = true;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'test-reservation-id',
      reservationNumber: 'GRP-TEST-0001',
      status: 'CONFIRMED',
      performanceTitle: 'E2E Test Performance',
      posterUrl: null,
      showDateTime: new Date(Date.now() + 86400000).toISOString(),
      venue: 'E2E Venue',
      seats: [{ seatId: 's1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
      totalAmount: 50000,
      createdAt: new Date().toISOString(),
      paymentMethod: 'card',
      paidAt: new Date().toISOString(),
      cancelDeadline: new Date(Date.now() + 86400000).toISOString(),
      cancelledAt: null,
      cancelReason: null,
      paymentKey: 'test_payment_key',
    }),
  });
});
```

**Booking fixture + confirm navigation pattern** (lines 78-116):
```typescript
const perfId = 'e2e-test-performance';
await injectBookingFixture(page, {
  performanceId: perfId,
  showtimeId: 'e2e-test-showtime',
  seats: [{ seatId: 's1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
  performanceTitle: 'E2E Test Performance',
  showDateTime: new Date(Date.now() + 86400000).toISOString(),
  venue: 'E2E Venue',
});

await page.goto(`/booking/${perfId}/confirm`);
await expect(page).toHaveURL(/\/confirm/);
await expect(page.locator('#payment-method iframe')).toBeVisible({ timeout: 20000 });

const paymentKey = `test_payment_key_${Date.now()}`;
const orderId = `test_order_${Date.now()}`;
const amount = '50000';
await page.goto(
  `/booking/${perfId}/complete?paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`,
);

await expect.poll(() => confirmIntercepted, {
  timeout: 10000,
  message: 'POST /api/v1/payments/confirm was not intercepted',
}).toBe(true);

await expect(page.getByText(/예매가 완료|완료되었습니다/)).toBeVisible({ timeout: 10000 });
```

**Error URL simulation pattern** (lines 123-167):
```typescript
test('UI regression: decline error URL → error message renders', async ({ page }) => {
  await loginAsTestUser(page);
  await injectBookingFixture(page, {
    performanceId: 'e2e-test-performance',
    showtimeId: 'e2e-test-showtime',
    seats: [{ seatId: 's1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
    performanceTitle: 'E2E Test Performance',
    showDateTime: new Date(Date.now() + 86400000).toISOString(),
    venue: 'E2E Venue',
  });
  const declineMessage = '카드 승인 거절';
  await page.goto(
    `/booking/e2e-test-performance/confirm?error=true&code=INVALID_CARD&message=${encodeURIComponent(declineMessage)}`,
  );
  await expect(page.getByText(/카드 승인 거절|결제에 실패/)).toBeVisible({ timeout: 5000 });
});
```

**Apply to Phase 19:** add intercepts for `POST **/api/v1/reservations/prepare` returning `409` with the lock-expired/other-user message, then assert Toss request is not triggered. Add `POST **/api/v1/payments/confirm` returning `409` on the complete page and assert failed confirmation UI, not success copy.

## Shared Patterns

### Controller Auth And Zod Validation

**Source:** `apps/api/src/modules/reservation/reservation.controller.ts`
**Apply to:** reservation API routes if controller signatures change

**Prepare/confirm route pattern** (lines 29-42):
```typescript
@Post('reservations/prepare')
async prepareReservation(
  @Body(new ZodValidationPipe(prepareReservationSchema)) body: PrepareReservationInput,
  @Request() req: { user: { id: string } },
) {
  return this.reservationService.prepareReservation(body, req.user.id);
}

@Post('payments/confirm')
async confirmPayment(
  @Body(new ZodValidationPipe(confirmPaymentSchema)) body: ConfirmPaymentInput,
  @Request() req: { user: { id: string } },
) {
  return this.reservationService.confirmAndCreateReservation(body, req.user.id);
}
```

Rule: use `req.user.id` as the only user identity. Do not accept `userId` or lock owner from request bodies.

### Shared DTO Contract

**Source:** `packages/shared/src/schemas/booking.schema.ts`
**Apply to:** web hooks, controller validation, reservation service inputs

**Current schemas** (lines 3-24):
```typescript
const seatSelectionSchema = z.object({
  seatId: z.string().min(1, '좌석 ID가 필요합니다'),
  tierName: z.string().min(1, '등급명이 필요합니다'),
  price: z.number().int().min(0, '가격은 0 이상이어야 합니다'),
  row: z.string().min(1, '열 정보가 필요합니다'),
  number: z.string().min(1, '좌석 번호가 필요합니다'),
});

export const prepareReservationSchema = z.object({
  orderId: z.string().min(1, '주문 ID가 필요합니다'),
  showtimeId: z.string().uuid('유효한 회차 ID가 필요합니다'),
  seats: z.array(seatSelectionSchema).min(1, '최소 1개의 좌석을 선택해야 합니다'),
  amount: z.number().int().positive('결제 금액은 0보다 커야 합니다'),
});

export const confirmPaymentSchema = z.object({
  paymentKey: z.string().min(1, '결제 키가 필요합니다'),
  orderId: z.string().min(1, '주문 ID가 필요합니다'),
  amount: z.number().int().positive('결제 금액은 0보다 커야 합니다'),
});
```

Rule: do not add a client-supplied lock token for Phase 19. Ownership is server-side Valkey state.

### Web API Error Message Preservation

**Source:** `apps/web/lib/api-client.ts`
**Apply to:** confirm page and complete page error states

**Server message extraction** (lines 108-127):
```typescript
if (!res.ok) {
  const status = res.status;
  let errorMessage = STATUS_MESSAGES[status] ?? DEFAULT_ERROR_MESSAGE;
  try {
    const errorData = (await res.json()) as ApiError;
    if (errorData.message) errorMessage = errorData.message;
  } catch {
    // Use default message
  }

  // 401 is handled above (redirect). No toast needed here.
  if (status !== 401) {
    toast.error(errorMessage, {
      description: `오류 코드: ERR-${status}`,
      duration: 5000,
    });
  }

  throw new ApiClientError(errorMessage, status);
}
```

**Hook mutation wrappers** from `apps/web/hooks/use-booking.ts` (lines 103-114):
```typescript
export function usePrepareReservation() {
  return useMutation({
    mutationFn: (data: PrepareReservationRequest) =>
      apiClient.post<PrepareReservationResponse>('/api/v1/reservations/prepare', data),
  });
}

export function useConfirmPayment() {
  return useMutation({
    mutationFn: (data: ConfirmPaymentRequest) =>
      apiClient.post<ReservationDetail>('/api/v1/payments/confirm', data),
  });
}
```

Rule: API `message` survives as `Error.message`; pages should display that directly for lock-expired and other-user failures.

### Valkey Cluster Guard Pattern

**Source:** `apps/api/test/sms-cluster-crossslot.integration.spec.ts`
**Apply to:** optional cluster-mode regression if planner wants a stronger guard than standalone Valkey

**Single-node cluster setup** (lines 76-144):
```typescript
container = await new GenericContainer('valkey/valkey:8')
  .withExposedPorts(6379)
  .withCommand([
    'valkey-server',
    '--port',
    '6379',
    '--cluster-enabled',
    'yes',
    '--cluster-config-file',
    'nodes.conf',
    '--cluster-node-timeout',
    '5000',
    '--appendonly',
    'no',
    '--cluster-require-full-coverage',
    'no',
  ])
  .start();

const host = container.getHost();
const port = container.getMappedPort(6379);
const boot = new IORedis(`redis://${host}:${port}`, {
  maxRetriesPerRequest: 3,
});

await boot.call('CONFIG', 'SET', 'cluster-announce-ip', host);
await boot.call('CONFIG', 'SET', 'cluster-announce-port', String(port));
await boot.call('CLUSTER', 'ADDSLOTSRANGE', '0', '16383');
```

**Negative CROSSSLOT guard** (lines 160-175):
```typescript
describe('과거 스킴 (hash-tag 없음) 은 cluster-mode 에서 CROSSSLOT 을 던진다', () => {
  it('rejects with CROSSSLOT reply error', async () => {
    await expect(
      cluster.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        `sms:otp:${PHONE}`,
        `sms:attempts:${PHONE}`,
        `sms:verified:${PHONE}`,
        '123456',
        '5',
        '600',
      ),
    ).rejects.toThrow(/CROSSSLOT/);
  });
});
```

**Slot equality assertion** (lines 258-274):
```typescript
const s1 = await cluster.call('CLUSTER', 'KEYSLOT', smsOtpKey(PHONE));
const s2 = await cluster.call(
  'CLUSTER',
  'KEYSLOT',
  smsAttemptsKey(PHONE),
);
const s3 = await cluster.call(
  'CLUSTER',
  'KEYSLOT',
  smsVerifiedKey(PHONE),
);
expect(s1).toBe(s2);
expect(s2).toBe(s3);
```

Rule: if cluster guard is added for seat locks, assert all `{showtimeId}:...` keys share one slot and a legacy/non-tagged variant throws `CROSSSLOT`.

### Lock Failure Messages

**Source:** `.planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md` D-14
**Apply to:** `BookingService` helper failures, `ReservationService` prepare/confirm errors, web assertions

```typescript
const LOCK_EXPIRED_MESSAGE = '좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.';
const LOCK_OTHER_OWNER_MESSAGE = '이미 다른 사용자가 선택한 좌석입니다.';
```

Use `ConflictException` for both. Map missing, expired, and released locks to `LOCK_EXPIRED_MESSAGE`; map owner mismatch to `LOCK_OTHER_OWNER_MESSAGE`.

## No Analog Found

None. Every likely modified file has an exact local analog. Planner should use `19-RESEARCH.md` for external Valkey/Toss documentation details, but implementation shape should come from the code excerpts above.

## Metadata

**Analog search scope:** `apps/api/src`, `apps/api/test`, `apps/web`, `packages/shared`, selected prior Phase 14 cluster test patterns
**Files scanned/read:** 18 (`AGENTS.md`, `19-CONTEXT.md`, `19-RESEARCH.md`, 15 source/test/reference files)
**Project skills:** `.codex/skills` and `.agents/skills` not present in this repo
**Pattern extraction date:** 2026-04-29
