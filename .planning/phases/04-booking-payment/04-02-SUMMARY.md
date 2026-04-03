---
phase: 04-booking-payment
plan: 02
subsystem: ui
tags: [toss-payments, react, zustand, next.js, payment-widget, booking]

requires:
  - phase: 04-01
    provides: "Reservation/payment DB schema, Toss Payments server-side confirm, ReservationDetail types"
  - phase: 03-seat-map-real-time
    provides: "Booking store, seat selection UI, countdown timer, Redis seat locking"
provides:
  - "Order confirmation page (/booking/[performanceId]/confirm) with Toss Payments widget inline"
  - "Booking completion page (/booking/[performanceId]/complete) with reservation number"
  - "6 booking UI components: ConfirmHeader, OrderSummary, BookerInfoSection, TermsAgreement, TossPaymentWidget, BookingComplete"
  - "useConfirmPayment, useBookingDetail, useReservationByOrderId React Query hooks"
  - "Updated booking store with confirm-page fields"
affects: [04-03, mypage]

tech-stack:
  added: ["@tosspayments/tosspayments-sdk v2.6.0"]
  patterns: ["Toss SDK v2 widget init (loadTossPayments -> widgets -> setAmount -> renderPaymentMethods)", "forwardRef + useImperativeHandle for requestPayment", "Redirect-based payment flow with successUrl/failUrl", "Page refresh recovery via orderId query"]

key-files:
  created:
    - apps/web/app/booking/[performanceId]/confirm/page.tsx
    - apps/web/app/booking/[performanceId]/complete/page.tsx
    - apps/web/components/booking/confirm-header.tsx
    - apps/web/components/booking/order-summary.tsx
    - apps/web/components/booking/booker-info-section.tsx
    - apps/web/components/booking/terms-agreement.tsx
    - apps/web/components/booking/toss-payment-widget.tsx
    - apps/web/components/booking/booking-complete.tsx
  modified:
    - apps/web/stores/use-booking-store.ts
    - apps/web/hooks/use-booking.ts
    - apps/web/app/layout-shell.tsx

key-decisions:
  - "Toss SDK widget exposed via forwardRef + useImperativeHandle for parent-controlled requestPayment trigger"
  - "OrderId format: GRP-{timestamp}-{random5} for uniqueness without DB sequence"
  - "Layout-shell updated to hide GNB/Footer on booking paths except /complete"
  - "Page refresh recovery on complete page: query reservation by orderId if store is empty"
  - "Zod removed from booker-info-section in favor of react-hook-form native validation (zod not a direct web dependency)"

patterns-established:
  - "Toss Payments widget integration: loadTossPayments -> widgets({ customerKey }) -> setAmount -> renderPaymentMethods/renderAgreement -> requestPayment redirect"
  - "Payment error handling: Toss failUrl params (code, message) parsed on confirm page return"
  - "Booking store bridge: Phase 3 seat selection data flows to Phase 4 confirm page via Zustand"

requirements-completed: [BOOK-05, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07]

duration: 8min
completed: 2026-04-03
---

# Phase 4 Plan 2: Booking Frontend - Confirm + Complete Pages Summary

**Order confirmation page with Toss Payments SDK v2 widget inline, booker info editing, terms agreement, and booking completion page with reservation number display**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T00:47:06Z
- **Completed:** 2026-04-03T00:55:53Z
- **Tasks:** 2 auto tasks completed (Task 3 is human-verify checkpoint)
- **Files modified:** 14

## Accomplishments
- Confirm page (/booking/[performanceId]/confirm) assembles all checkout sections: sticky countdown header, order summary, booker info editing, terms agreement, Toss Payments widget, and payment CTA
- Complete page (/booking/[performanceId]/complete) confirms payment server-side and displays booking number with full reservation details
- Toss Payments SDK v2 widget renders inline with card, KakaoPay, NaverPay, bank transfer options
- Error handling covers payment failure, user cancellation, timer expiry, and page refresh recovery

## Task Commits

Each task was committed atomically:

1. **Task 1: Booking store + hooks + SDK install + all booking components** - `f29d5d7` (feat)
2. **Task 2: Confirm page + Complete page assembly** - `45a3717` (feat)

## Files Created/Modified
- `apps/web/components/booking/confirm-header.tsx` - Sticky header with countdown timer (warning at <=3min)
- `apps/web/components/booking/order-summary.tsx` - Performance info, seat list, total price breakdown
- `apps/web/components/booking/booker-info-section.tsx` - Display/edit mode for booker name and phone
- `apps/web/components/booking/terms-agreement.tsx` - All-toggle checkbox group with dialog terms viewer
- `apps/web/components/booking/toss-payment-widget.tsx` - Toss SDK v2 widget with forwardRef requestPayment
- `apps/web/components/booking/booking-complete.tsx` - Success display with reservation number, booking details, CTAs
- `apps/web/app/booking/[performanceId]/confirm/page.tsx` - Full checkout page assembling all components
- `apps/web/app/booking/[performanceId]/complete/page.tsx` - Payment confirmation and booking complete display
- `apps/web/stores/use-booking-store.ts` - Extended with confirm page fields (performanceId, expiresAt, etc.)
- `apps/web/hooks/use-booking.ts` - Added useConfirmPayment, useBookingDetail, useReservationByOrderId
- `apps/web/app/layout-shell.tsx` - Updated to show GNB/Footer on /complete but hide on /confirm
- `apps/web/hooks/use-socket.ts` - Fixed seat-update cache to use proper object shape (Rule 1 bug fix)
- `apps/web/package.json` - Added @tosspayments/tosspayments-sdk dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **Toss widget via forwardRef:** Used forwardRef + useImperativeHandle to expose requestPayment to parent, keeping widget encapsulated while allowing parent CTA to trigger payment
- **OrderId format:** `GRP-{timestamp}-{random5}` generated client-side, unique without DB sequence
- **Layout-shell refinement:** Changed from hiding GNB/Footer on all /booking paths to only hiding on paths that don't end with /complete, so booking completion page has standard navigation
- **Refresh recovery:** Complete page handles browser refresh by querying reservation via orderId if Zustand store is empty
- **React-hook-form native validation:** Used react-hook-form register options directly instead of zod resolver since zod is not a direct web dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed use-socket.ts seat-update cache shape**
- **Found during:** Task 1 (updating use-booking.ts)
- **Issue:** use-socket.ts set SeatStatusResponse cache with raw string instead of { status, userId } object
- **Fix:** Changed cache update to construct proper object shape
- **Files modified:** apps/web/hooks/use-socket.ts
- **Committed in:** f29d5d7 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed use-socket.ts import from @grapit/shared**
- **Found during:** Task 1 (updating hooks)
- **Issue:** SeatUpdateEvent and SeatStatusResponse types not exported from @grapit/shared, causing import errors
- **Fix:** Defined types locally in use-socket.ts and imported SeatStatusResponse from use-booking.ts
- **Files modified:** apps/web/hooks/use-socket.ts
- **Committed in:** f29d5d7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in Phase 3 code (SeatState, SeatMapConfig, tierColor not in shared types, admin casting-manager type errors) -- out of scope, did not fix
- Merge conflicts when bringing in Plan 04-01 agent's changes -- resolved by including both BookingModule (Phase 3) and PaymentModule/ReservationModule (Phase 4) in app.module.ts

## User Setup Required

**Toss Payments test keys required for full payment flow testing:**
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` - Toss Payments widget client key (test_gck_...)
- `TOSS_SECRET_KEY` - Toss Payments secret key (test_gsk_...)
- Get from: https://developers.tosspayments.com -> 회원가입 -> 내 개발 정보

Without these keys, the payment widget shows a graceful error message instead of crashing.

## Known Stubs

None - all components are wired to real data sources (booking store, auth store, API client). The Toss Payments widget requires env var configuration to render, but handles missing keys gracefully with an error message.

## Next Phase Readiness
- Confirm and complete pages ready for human verification (Task 3 checkpoint)
- Plan 04-03 (mypage reservations, admin booking management) can proceed independently
- Payment flow requires Toss Payments test keys for end-to-end testing

## Self-Check: PASSED

All 9 created files verified present. Both task commits (f29d5d7, 45a3717) verified in git log.

---
*Phase: 04-booking-payment*
*Completed: 2026-04-03*
