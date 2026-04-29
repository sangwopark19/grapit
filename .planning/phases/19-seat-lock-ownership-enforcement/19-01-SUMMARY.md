---
phase: 19-seat-lock-ownership-enforcement
plan: 01
subsystem: testing
tags: [seat-locks, valkey, lua, reservation, toss, playwright, vitest, red-tests]

requires:
  - phase: 07-valkey
    provides: ioredis flat eval signature and real Valkey integration harness
  - phase: 12-ux
    provides: seat-map UX regression suites for stage, legend, animation, minimap, and mobile touch behavior
  - phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
    provides: Valkey Cluster hash-tag and Lua testcontainers pattern
provides:
  - Backend Wave 0 RED tests for BookingService ownership assert/consume helpers
  - ReservationService RED tests for prepare/confirm lock ownership enforcement
  - InMemoryRedis and real Valkey ownership tuple regression tests
  - Web mutation and Toss E2E lock rejection RED tests
affects: [19-02, 19-03, 19-04, VALK-03, UX-02, UX-03, UX-04, UX-05, UX-06]

tech-stack:
  added: []
  patterns:
    - "Wave 0 RED test contract: collection succeeds while planned missing ownership behavior fails"
    - "ioredis eval test shape: eval(script, numKeys, ...KEYS, ...ARGV)"
    - "Playwright route interception for reservation/payment lock rejection"

key-files:
  created:
    - apps/web/hooks/__tests__/use-booking.test.tsx
  modified:
    - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
    - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
    - apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts
    - apps/api/src/modules/reservation/reservation.service.spec.ts
    - apps/web/e2e/toss-payment.spec.ts

key-decisions:
  - "Treat backend ownership helper and ReservationService failures as intentional RED evidence for later Phase 19 implementation plans."
  - "Keep all new tests in existing files per D-21, with only the planned new web hook test file."
  - "Do not modify runtime code in 19-01; this plan establishes the executable contract only."

patterns-established:
  - "Reservation ownership tests assert lock checks before pending reservation creation, Toss confirm, and sold transition."
  - "Toss lock rejection E2E uses route interception and asserts false success is not rendered."

requirements-completed: [VALK-03, UX-02, UX-03, UX-04, UX-05, UX-06]

duration: 9min
completed: 2026-04-29
---

# Phase 19 Plan 01: Seat Lock Ownership Wave 0 Summary

**Backend and web RED tests now pin the Valkey lock ownership contract before runtime enforcement is implemented.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-29T08:09:27Z
- **Completed:** 2026-04-29T08:18:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added backend RED coverage for `assertOwnedSeatLocks()` and `consumeOwnedSeatLocks()` across unit, InMemoryRedis, real Valkey, and reservation service tests.
- Added web mutation tests proving prepare/confirm calls use the expected API paths and preserve 409 lock-expired messages.
- Extended Toss E2E with prepare/confirm lock rejection regressions, including the false-success guard on complete page.
- Kept runtime code unchanged; all new behavior failures are intentionally deferred to later Phase 19 implementation plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend Wave 0 ownership tests** - `0843a41` (test)
2. **Task 2: Web Wave 0 lock rejection tests** - `50a68e3` (test)

**Plan metadata:** final docs commit records this SUMMARY and planning state updates.

## Files Created/Modified

- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` - BookingService RED tests for ownership assert/consume helper messages, key shape, and unrelated lock preservation.
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` - InMemoryRedis marker-script parity tests for unified `[ok, reason, seatId, owner]` ownership tuples.
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` - Real Valkey RED tests for all-owned, missing, other-owner, stale-index cleanup, and unrelated lock preservation.
- `apps/api/src/modules/reservation/reservation.service.spec.ts` - Prepare/confirm RED tests for active lock ownership, pending order idempotency, Toss precheck, compensation, and existing payment idempotency.
- `apps/web/hooks/__tests__/use-booking.test.tsx` - New React Query hook tests for prepare/confirm mutation API contracts and 409 message preservation.
- `apps/web/e2e/toss-payment.spec.ts` - Added two lock ownership route-interception E2E regressions inside the existing Toss Payments describe.

## Decisions Made

- RED failures are expected and documented because this plan intentionally adds tests before implementing ownership helpers or UI failure state.
- `TOSS_CLIENT_KEY_TEST` absence leaves the Toss E2E command skipped locally, but Playwright collected all 5 tests including the 2 new lock ownership cases.
- No runtime code was modified; later plans must make these tests GREEN.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider --reporter=verbose` | Expected RED: 338 collected, 324 passed, 14 failed. Failures are missing `BookingService` helpers, missing InMemoryRedis ownership Lua dispatch, and missing ReservationService ownership enforcement. |
| `pnpm --filter @grabit/api test:integration -- booking.service.integration --reporter=verbose` | Expected RED: 35 collected, 30 passed, 5 failed on missing planned BookingService helpers. Docker/testcontainers path ran successfully. |
| `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking --reporter=verbose` | PASS: 27 files, 189 tests passed, including new `use-booking` tests. |
| `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` | Collected 5 tests, all skipped because `TOSS_CLIENT_KEY_TEST` is not set in this environment. |

## Acceptance Criteria

- Backend grep gates for BookingService, InMemoryRedis, real Valkey integration, and ReservationService patterns all printed matches.
- Web grep gates for `use-booking.test.tsx` and Toss E2E lock ownership tests printed matches.
- Existing seat-map and seat-selection-panel tests remained in the web validation command and passed.
- RED failures are behavior failures tied to planned missing Phase 19 implementation, not collection/type errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test harness errors so RED failures identify planned missing behavior**
- **Found during:** Task 1 (Backend Wave 0 ownership tests)
- **Issue:** Initial integration test omitted the `BookingService` import, and one confirm test mock path produced a generic `from` TypeError before reaching the intended ownership assertion.
- **Fix:** Imported `BookingService` in the integration spec and completed the confirm test mock chain so verification fails as a clear missing ownership behavior instead.
- **Files modified:** `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts`, `apps/api/src/modules/reservation/reservation.service.spec.ts`
- **Verification:** Re-ran the API unit and integration commands; both now collect successfully and fail only on expected RED ownership gaps.
- **Committed in:** `0843a41`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** The fix only corrected RED test harness quality. It did not change runtime behavior or broaden scope.

## Issues Encountered

- Expected RED failures remain for backend ownership helpers, InMemoryRedis ownership script dispatch, ReservationService ownership enforcement, and complete-page failure UI.
- Toss E2E did not execute behavior locally because `TOSS_CLIENT_KEY_TEST` is unset; the command still collected the new tests and skipped through the existing env gate.

## Known Stubs

None. Stub scan found only test-local empty structures (`[]`, `{}`) and Lua local table initialization used by existing tests; no UI/runtime stub was introduced.

## Threat Flags

None. This plan added test coverage only and introduced no new network endpoint, auth path, file access pattern, schema change, or runtime trust boundary.

## User Setup Required

None for this plan. E2E execution with real behavior still depends on the existing `TOSS_CLIENT_KEY_TEST` environment gate.

## Next Phase Readiness

Plan 19-02 can implement `BookingService` ownership helpers and InMemoryRedis/Valkey tuple handling against the RED tests from Task 1. Plan 19-03/19-04 can then wire ReservationService and UI failure behavior until the full 19-01 verification matrix turns GREEN.

---
*Phase: 19-seat-lock-ownership-enforcement*
*Completed: 2026-04-29*

## Self-Check: PASSED

**Files verified:**
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — FOUND
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — FOUND
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` — FOUND
- `apps/api/src/modules/reservation/reservation.service.spec.ts` — FOUND
- `apps/web/hooks/__tests__/use-booking.test.tsx` — FOUND
- `apps/web/e2e/toss-payment.spec.ts` — FOUND
- `.planning/phases/19-seat-lock-ownership-enforcement/19-01-SUMMARY.md` — FOUND

**Commits verified:**
- `0843a41` — FOUND
- `50a68e3` — FOUND
