---
phase: 19-seat-lock-ownership-enforcement
plan: 02
subsystem: backend
tags: [seat-locks, valkey, lua, booking, redis, vitest]

requires:
  - phase: 19-seat-lock-ownership-enforcement
    provides: 19-01 RED tests for BookingService ownership helpers and InMemoryRedis script parity
  - phase: 07-valkey
    provides: ioredis flat eval signature and real Valkey integration harness
  - phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
    provides: Valkey Cluster hash-tag and Lua marker dispatch pattern
provides:
  - BookingService assertOwnedSeatLocks and consumeOwnedSeatLocks helpers
  - Exported ownership Lua scripts and canonical Korean conflict messages
  - InMemoryRedis ownership script parity for local/unit tests
affects: [19-03, VALK-03, booking, reservations, payments]

tech-stack:
  added: []
  patterns:
    - "Ownership tuple contract: [status, reasonOrOK, seatIdOrCount, ownerOrEmpty]"
    - "Valkey multi-key scripts pass every accessed key through KEYS with {showtimeId} hash tags"
    - "InMemoryRedis dispatches Lua emulation by script marker before arity-only fallbacks"

key-files:
  created:
    - .planning/phases/19-seat-lock-ownership-enforcement/19-02-SUMMARY.md
  modified:
    - apps/api/src/modules/booking/booking.service.ts
    - apps/api/src/modules/booking/providers/redis.provider.ts
    - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
    - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
    - apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts

key-decisions:
  - "Assert helpers read only per-seat lock keys and never mutate index sets; locked-seats remains a stale-cleaned index elsewhere."
  - "Consume helpers validate every requested lock before deleting any lock or index membership."
  - "InMemoryRedis keeps production REDIS_URL hard-fail unchanged and only mirrors ownership scripts for local/test mode."

patterns-established:
  - "BookingService owns Valkey lock ownership semantics behind assertOwnedSeatLocks and consumeOwnedSeatLocks."
  - "Tests import BookingService exported ownership scripts/messages instead of duplicating Lua contracts."

requirements-completed: [VALK-03]

duration: 8min
completed: 2026-04-29
---

# Phase 19 Plan 02: Seat Lock Ownership Helper Summary

**BookingService now provides Valkey-backed seat lock ownership assert and consume primitives with InMemoryRedis parity.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-29T08:24:08Z
- **Completed:** 2026-04-29T08:32:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added exported lock ownership messages and Lua scripts in `BookingService`.
- Implemented `assertOwnedSeatLocks()` and `consumeOwnedSeatLocks()` using ioredis flat `eval(script, numKeys, ...keys, ...args)`.
- Added InMemoryRedis marker dispatch and ownership tuple emulation for local/unit parity.
- Updated tests to import BookingService ownership contracts and verified real Valkey script behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BookingService ownership Lua helpers** - `526c5be` (feat)
2. **Task 2: Add InMemoryRedis ownership script parity** - `090ed40` (feat)

**Plan metadata:** final docs commit records this SUMMARY and planning state updates.

## Files Created/Modified

- `apps/api/src/modules/booking/booking.service.ts` - Exports ownership messages/scripts and implements assert/consume helpers.
- `apps/api/src/modules/booking/providers/redis.provider.ts` - Adds InMemoryRedis marker dispatch plus assert/consume tuple emulation.
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` - Uses exported ownership contracts and verifies helper eval shape.
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` - Imports real BookingService scripts and verifies InMemoryRedis parity.
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` - Verifies helper behavior against real Valkey 8.
- `.planning/phases/19-seat-lock-ownership-enforcement/19-02-SUMMARY.md` - Execution summary.

## Decisions Made

- Assert-only ownership checks do not receive `user-seats` or `locked-seats` index keys, so they fail closed without mutating stale index members.
- Consume validates every requested seat first, then deletes only requested owned lock keys and removes only those members from `user-seats` and `locked-seats`.
- No reservation-level token, client payload field, schema change, or production InMemoryRedis fallback was introduced.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @grabit/api exec vitest run src/modules/booking/__tests__/booking.service.spec.ts --reporter=verbose` | PASS: 21/21 tests. |
| `pnpm --filter @grabit/api exec vitest run src/modules/booking/providers/__tests__/redis.provider.spec.ts --reporter=verbose` | PASS: 15/15 tests. |
| `pnpm --filter @grabit/api test:integration -- booking.service.integration` | PASS: 4 files, 35/35 tests. |
| `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider` | Expected remaining RED: 333/338 passed; only 5 `ReservationService` ownership wiring tests fail, owned by Plan 19-03. |

## Acceptance Criteria

- BookingService export grep printed matches for `LOCK_EXPIRED_MESSAGE`, `LOCK_OTHER_OWNER_MESSAGE`, `ASSERT_OWNED_SEAT_LOCKS_LUA`, and `CONSUME_OWNED_SEAT_LOCKS_LUA`.
- BookingService method/eval/key-shape grep gates printed matches.
- Provider grep gates printed matches for marker dispatch, parity methods, hard-fail production text, and missing/other-owner/unrelated-lock tests.
- Real Valkey integration command passed after the helper implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Contract Bug] Corrected assert stale-index expectation**
- **Found during:** Task 1 (Add BookingService ownership Lua helpers)
- **Issue:** A Wave 0 integration test expected `assertOwnedSeatLocks()` to delete stale `user-seats` and `locked-seats` index members, but Plan 19-02 explicitly defines assert as KEYS-only per-seat lock validation with no index keys.
- **Fix:** Updated the test to assert fail-closed missing-lock behavior without index mutation. Consume still verifies requested lock deletion and unrelated same-showtime lock preservation.
- **Files modified:** `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts`
- **Verification:** `pnpm --filter @grabit/api test:integration -- booking.service.integration` passed 35/35.
- **Committed in:** `526c5be`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** The correction aligns tests with the explicit Lua KEYS contract and avoids hidden side effects in assert-only checks.

## Issues Encountered

- The plan-level unit command still fails on 5 `ReservationService` RED tests from 19-01. These cover prepare/confirm wiring that Plan 19-03 owns; BookingService and InMemoryRedis tests are green.
- A parallel Plan 19-04 executor committed frontend work during this run. This plan did not touch frontend files or the untracked `19-04-SUMMARY.md`.

## TDD Gate Compliance

- RED source: Plan 19-01 commit `0843a41` added the backend RED tests this implementation satisfied.
- RED was re-confirmed before implementation: BookingService helpers failed as missing methods, and InMemoryRedis parity failed as unknown Lua script pattern.
- GREEN commits for this plan: `526c5be`, `090ed40`.

## Known Stubs

None. Stub scan hits were local accumulator arrays/maps or Lua local tables, not UI/runtime placeholder data.

## Threat Flags

None beyond the planned threat model. This plan introduced Valkey ownership scripts and local emulation exactly within T-19-01, T-19-02, and T-19-03 mitigations.

## User Setup Required

None.

## Next Phase Readiness

Plan 19-03 can now wire `ReservationService.prepareReservation()` to `assertOwnedSeatLocks()` and `confirmAndCreateReservation()` to pre-check and post-Toss `consumeOwnedSeatLocks()`. The only remaining backend RED in the plan-level unit command is that downstream wiring.

---
*Phase: 19-seat-lock-ownership-enforcement*
*Completed: 2026-04-29*

## Self-Check: PASSED

**Files verified:**
- `apps/api/src/modules/booking/booking.service.ts` - FOUND
- `apps/api/src/modules/booking/providers/redis.provider.ts` - FOUND
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` - FOUND
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` - FOUND
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` - FOUND
- `.planning/phases/19-seat-lock-ownership-enforcement/19-02-SUMMARY.md` - FOUND

**Commits verified:**
- `526c5be` - FOUND
- `090ed40` - FOUND
