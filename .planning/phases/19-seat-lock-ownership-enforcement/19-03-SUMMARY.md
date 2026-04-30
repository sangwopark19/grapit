---
phase: 19-seat-lock-ownership-enforcement
plan: 03
subsystem: api
tags: [seat-locks, valkey, reservation, toss, nestjs, vitest]

requires:
  - phase: 19-seat-lock-ownership-enforcement
    provides: 19-02 BookingService assertOwnedSeatLocks and consumeOwnedSeatLocks helpers
  - phase: 04-booking-payment
    provides: ReservationService, reservations/reservation_seats/payments schema, TossPaymentsClient
provides:
  - ReservationService prepareReservation active Valkey lock ownership enforcement
  - ReservationService confirmAndCreateReservation pre-Toss assert and post-Toss consume enforcement
  - Toss compensation cancel path for post-confirm lock consume failures
affects: [VALK-03, reservations, payments, booking, phase-20-valkey-runtime]

tech-stack:
  added: []
  patterns:
    - "ReservationService calls BookingService for all Valkey lock ownership checks; it does not construct Redis keys directly."
    - "Confirm sequence: existing payment idempotency -> pending lookup -> amount check -> pre-Toss assert -> Toss confirm -> post-Toss consume -> DB sold transition -> sold broadcast."

key-files:
  created:
    - .planning/phases/19-seat-lock-ownership-enforcement/19-03-SUMMARY.md
  modified:
    - apps/api/src/modules/reservation/reservation.service.ts
    - apps/api/src/modules/reservation/reservation.service.spec.ts

key-decisions:
  - "Existing pending orderId returns now require the same active Valkey ownership check as new pending reservation creation."
  - "Existing payment idempotency remains first and does not require active locks because sold transition already completed."
  - "Post-Toss consume failure cancels the Toss payment with lock-expiry compensation copy and skips the DB sold transaction."

patterns-established:
  - "Use getReservationSeatIds() as the ReservationService boundary for stored reservation seat IDs before ownership checks."
  - "Broad unlockAllSeats() is not used on confirm success; targeted consumeOwnedSeatLocks() owns confirmed-seat cleanup."

requirements-completed: [VALK-03]

duration: 6min
completed: 2026-04-29
---

# Phase 19 Plan 03: Reservation Ownership Enforcement Summary

**Reservation prepare and payment confirm now require active Valkey seat-lock ownership before pending reservation reuse, Toss confirmation, and sold transition.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-29T08:40:20Z
- **Completed:** 2026-04-29T08:46:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `prepareReservation()` now rejects new pending creation unless all requested seats are actively locked by the authenticated user.
- Existing pending `orderId` reuse now verifies the stored `reservation_seats` under the same user and rejects cross-user reuse with the existing Korean NotFound copy.
- `confirmAndCreateReservation()` keeps existing payment idempotency unchanged, then validates pending reservation seats before Toss confirm.
- After Toss confirm, confirmed seats are consumed with `consumeOwnedSeatLocks()` before the DB sold transition. Consume failure triggers Toss cancel compensation and skips the transaction.
- The previous broad `unlockAllSeats(userId, showtimeId)` confirm-success cleanup was removed.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: prepare ownership tests** - `b43fa73` (test)
2. **Task 1 GREEN: prepare ownership enforcement** - `8734acc` (feat)
3. **Task 2 RED: confirm ownership tests** - `1a6a984` (test)
4. **Task 2 GREEN: confirm ownership enforcement** - `0433627` (feat)

**Plan metadata:** final docs commit records this SUMMARY and planning state updates.

## Files Created/Modified

- `apps/api/src/modules/reservation/reservation.service.ts` - Adds `getReservationSeatIds()`, prepare ownership assertions, confirm pre-Toss assertion, post-Toss consume, compensation cancel, and removes confirm-success broad unlock.
- `apps/api/src/modules/reservation/reservation.service.spec.ts` - Adds/updates prepare and confirm ownership regression tests for orderId reuse, ownership ordering, compensation, and idempotency.
- `.planning/phases/19-seat-lock-ownership-enforcement/19-03-SUMMARY.md` - Execution summary.

## Decisions Made

- Existing pending reservation reuse validates stored seat IDs instead of trusting the incoming DTO seat list.
- Confirm uses the already prepared reservation seats as the ownership surface; no lock token, schema, or client payload field was added.
- When post-Toss lock consume fails and compensation cancel succeeds, the original lock ownership exception is returned to preserve the client-visible 409 lock failure semantics.

## TDD Gate Compliance

- RED commits present: `b43fa73`, `1a6a984`.
- GREEN commits present after RED commits: `8734acc`, `0433627`.
- The original Wave 0 RED failures from 19-01 were re-confirmed before implementation: `reservation.service.spec.ts` had 5 downstream ownership failures. After this plan, the API quick suite is green.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @grabit/api exec vitest run src/modules/reservation/reservation.service.spec.ts --reporter=verbose -t "prepareReservation - lock ownership"` | PASS: 5/5 prepare ownership tests. |
| `pnpm --filter @grabit/api exec vitest run src/modules/reservation/reservation.service.spec.ts --reporter=verbose -t "confirmAndCreateReservation"` | PASS: 6/6 confirm-focused tests. |
| `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider` | PASS: 29 files, 340/340 tests. |
| `pnpm --filter @grabit/api test:integration -- booking.service.integration` | PASS: 4 files, 35/35 tests with testcontainers/Valkey available. |

## Acceptance Criteria

- Prepare grep gates printed matches for `getReservationSeatIds`, existing pending ownership assert, and DTO seatId mapping.
- Confirm grep gates printed matches for pre-Toss assert, post-Toss consume, lock-expiry compensation copy, and consume-failure log.
- The `unlockAllSeats(userId, reservation.showtimeId)` grep printed no lines in `reservation.service.ts`.
- Existing payment idempotency test confirms no `assertOwnedSeatLocks()` or `consumeOwnedSeatLocks()` calls in that branch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The integration command ran successfully because Docker/testcontainers were available.

## Known Stubs

None. Stub scan found only a test-local `txOps: []` accumulator in `reservation.service.spec.ts`; it is not UI/runtime stub data.

## User Setup Required

None.

## Next Phase Readiness

Reservation/payment server-side ownership enforcement is complete. Phase 20 can focus on Cloud Run -> Valkey runtime/cluster contract verification without changing the ReservationService API contract.

---
*Phase: 19-seat-lock-ownership-enforcement*
*Completed: 2026-04-29*

## Self-Check: PASSED

**Files verified:**
- `apps/api/src/modules/reservation/reservation.service.ts` - FOUND
- `apps/api/src/modules/reservation/reservation.service.spec.ts` - FOUND
- `.planning/phases/19-seat-lock-ownership-enforcement/19-03-SUMMARY.md` - FOUND

**Commits verified:**
- `b43fa73` - FOUND
- `8734acc` - FOUND
- `1a6a984` - FOUND
- `0433627` - FOUND
