---
phase: 19-seat-lock-ownership-enforcement
plan: 04
subsystem: ui
tags: [seat-locks, payments, nextjs, react, playwright, vitest]

requires:
  - phase: 19-seat-lock-ownership-enforcement
    provides: 19-01 web RED lock rejection tests and exact Korean server-message contract
provides:
  - Confirm page prepare lock rejection alert with seat-selection recovery CTA
  - Complete page payment-confirm lock rejection failed state
  - Hook and Toss E2E coverage for lock ownership rejection messages
affects: [VALK-03, UX-02, UX-03, UX-04, UX-05, UX-06, booking, payments]

tech-stack:
  added: []
  patterns:
    - "Exact server-message matching for lock-expired and other-owner browser recovery"
    - "Complete-page lock rejection bypasses idempotent recovery and renders failed state"

key-files:
  created: []
  modified:
    - apps/web/app/booking/[performanceId]/confirm/page.tsx
    - apps/web/app/booking/[performanceId]/complete/page.tsx
    - apps/web/hooks/__tests__/use-booking.test.tsx
    - apps/web/e2e/toss-payment.spec.ts

key-decisions:
  - "Preserve selected seats on prepare lock failure until the user explicitly clicks the recovery CTA."
  - "Use confirm-page lock failure state to disable payment CTA and prevent Toss requestPayment after prepare rejection."
  - "Treat payment confirm 409 lock failures as terminal failed UI state, leaving existing orderId recovery for non-lock failures only."

patterns-established:
  - "Confirm lock failure state renders a role=alert section before the Toss widget while keeping order summary stable."
  - "Complete lock failure state renders before the loading/success branches so success copy cannot appear after a lock rejection."

requirements-completed: [VALK-03, UX-02, UX-03, UX-04, UX-05, UX-06]

duration: 7min
completed: 2026-04-29
---

# Phase 19 Plan 04: Seat Lock Rejection UX Summary

**Browser payment flow now surfaces backend lock ownership rejections without opening Toss or showing false booking success.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-29T08:24:31Z
- **Completed:** 2026-04-29T08:31:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Confirm page now matches the two canonical lock failure messages, keeps selected seats visible, disables payment CTA, and offers `좌석 다시 선택하기`.
- Complete page now distinguishes 409 lock ownership rejection from generic confirm failure recovery and renders `예매를 완료하지 못했습니다` instead of success copy.
- Hook and Playwright coverage now includes prepare recovery CTA behavior and confirm other-owner message propagation.
- Seat-map viewer and seat-selection regression suites remained green.

## Task Commits

Each TDD task produced test and implementation commits:

1. **Task 1: Surface prepare lock failures on confirm page** - `b1668fa` (test), `62c8c66` (feat)
2. **Task 2: Render confirm lock failures as failed completion state** - `bae09a3` (test), `7b926c1` (feat)

**Plan metadata:** final docs commit records this SUMMARY and planning state updates.

## Files Created/Modified

- `apps/web/app/booking/[performanceId]/confirm/page.tsx` - Added `LOCK_FAILURE_MESSAGES`, `lockFailureMessage`, recovery CTA, disabled CTA copy, and guard before Toss request.
- `apps/web/app/booking/[performanceId]/complete/page.tsx` - Added `ApiClientError` 409 lock matching and failed completion alert before loading/success states.
- `apps/web/hooks/__tests__/use-booking.test.tsx` - Added confirm mutation 409 other-owner message propagation coverage.
- `apps/web/e2e/toss-payment.spec.ts` - Added lock rejection assertions for prepare recovery CTA, disabled payment CTA, and complete-page reservation recovery CTA.

## Decisions Made

- Lock failure recovery on confirm clears seats only when the user clicks `좌석 다시 선택하기`; the prepare rejection catch path does not clear selected seats.
- Complete-page lock rejection does not set `confirmFailed=true`, so `/reservations?orderId=...` recovery cannot turn lock ownership rejection into success.
- Native buttons were used in the complete failed state to match the existing missing-params fallback style.

## TDD Gate Compliance

- RED/test commits present: `b1668fa`, `bae09a3`.
- GREEN/feature commits present after RED commits: `62c8c66`, `7b926c1`.
- Local Toss E2E RED behavior could not execute because the existing `TOSS_CLIENT_KEY_TEST` gate skipped all Toss tests; the assertions are present and will execute in environments with that key.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking --reporter=verbose` | PASS: 27 files, 189 tests before Task 2 hook addition; then 190 tests after hook addition. Existing jsdom/act stderr warnings remain non-failing. |
| `pnpm --filter @grabit/web test -- use-booking --reporter=verbose` | PASS: 27 files, 190 tests after confirm-message test addition. |
| `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking` | PASS: 27 files, 190 tests. |
| `pnpm --filter @grabit/web typecheck` | PASS: `tsc --noEmit`. |
| `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` | Collected 5 tests, all skipped because `TOSS_CLIENT_KEY_TEST` is not set in this environment. |

## Acceptance Criteria

- Confirm page grep gates for `LOCK_FAILURE_MESSAGES`, `isLockFailureMessage`, `lockFailureMessage`, alert role, recovery handler, and disabled CTA all printed matches.
- Confirm page structural Node check exited 0: the lock failure catch path does not call `clearSeats()`, and the only `clearSeats()` call is inside `handleLockFailureRecovery`.
- Complete page grep gates for `ApiClientError`, `confirmationErrorMessage`, failed copy, 409 status matching, and alert role all printed matches.
- Toss E2E grep gates for prepare and confirm lock ownership regressions printed matches.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Toss E2E behavior was not executed locally because `TOSS_CLIENT_KEY_TEST` is unset. This is the existing env gate from the payment E2E suite, not an auth failure or implementation blocker.
- `pnpm --filter @grabit/web test ...` still emits pre-existing jsdom `navigation`/`scrollTo` and seat-map `act(...)` warnings while passing all tests.

## Known Stubs

None. Stub scan found no placeholder/TODO/FIXME or hardcoded empty UI data in files created or modified by this plan.

## Threat Flags

None. This plan introduced no new network endpoint, auth path, file access pattern, schema change, or trust-boundary expansion; it only renders existing API rejection messages.

## User Setup Required

None for unit verification. Full Toss E2E behavior requires the existing `TOSS_CLIENT_KEY_TEST` environment variable.

## Next Phase Readiness

Plan 19 frontend false-success behavior is covered. Backend plans 19-02 and 19-03 can complete server-side ownership enforcement while this UI now displays their 409 lock rejection messages correctly.

---
*Phase: 19-seat-lock-ownership-enforcement*
*Completed: 2026-04-29*

## Self-Check: PASSED

**Files verified:**
- `apps/web/app/booking/[performanceId]/confirm/page.tsx` - FOUND
- `apps/web/app/booking/[performanceId]/complete/page.tsx` - FOUND
- `apps/web/hooks/__tests__/use-booking.test.tsx` - FOUND
- `apps/web/e2e/toss-payment.spec.ts` - FOUND
- `.planning/phases/19-seat-lock-ownership-enforcement/19-04-SUMMARY.md` - FOUND

**Commits verified:**
- `b1668fa` - FOUND
- `62c8c66` - FOUND
- `bae09a3` - FOUND
- `7b926c1` - FOUND
