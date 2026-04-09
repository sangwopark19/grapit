---
phase: 04-booking-payment
plan: 01
subsystem: api, database
tags: [nestjs, drizzle, toss-payments, reservation, payment, booking, zod]

# Dependency graph
requires:
  - phase: 02-catalog-admin
    provides: performances, showtimes, priceTiers, venues DB schema and admin module
  - phase: 03-seat-map-real-time
    provides: seat selection and Redis locking for seat occupancy
provides:
  - reservations, reservation_seats, payments DB schema tables
  - shared booking types and zod validation schemas (@grapit/shared)
  - TossPaymentsClient with confirm/cancel API wrapper
  - ReservationService (confirm, list, detail, cancel with deadline enforcement)
  - PaymentService (query payment by reservation)
  - AdminBookingService (list with stats, detail, refund)
  - 5 user-facing API endpoints (POST /payments/confirm, GET /users/me/reservations, GET /reservations, GET /reservations/:id, PUT /reservations/:id/cancel)
  - 3 admin API endpoints (GET /admin/bookings, GET /admin/bookings/:id, POST /admin/bookings/:id/refund)
affects: [04-02 frontend booking flow, 04-03 frontend my-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [toss-payments-basic-auth, server-side-amount-validation, cancel-deadline-enforcement, atomic-reservation-creation]

key-files:
  created:
    - apps/api/src/database/schema/reservations.ts
    - apps/api/src/database/schema/reservation-seats.ts
    - apps/api/src/database/schema/payments.ts
    - packages/shared/src/types/booking.types.ts
    - packages/shared/src/schemas/booking.schema.ts
    - apps/api/src/modules/payment/toss-payments.client.ts
    - apps/api/src/modules/payment/payment.service.ts
    - apps/api/src/modules/payment/payment.module.ts
    - apps/api/src/modules/reservation/reservation.service.ts
    - apps/api/src/modules/reservation/reservation.controller.ts
    - apps/api/src/modules/reservation/reservation.module.ts
    - apps/api/src/modules/admin/admin-booking.service.ts
    - apps/api/src/modules/admin/admin-booking.controller.ts
  modified:
    - apps/api/src/database/schema/index.ts
    - packages/shared/src/index.ts
    - apps/api/src/modules/admin/admin.module.ts
    - apps/api/src/app.module.ts

key-decisions:
  - "Proxy-based chainable mocks for Drizzle multi-join queries in tests (avoids brittle mock chains)"
  - "TossPaymentsClient uses native fetch API with Basic auth (Buffer.from(secretKey + ':').toString('base64'))"
  - "Server-side amount recalculation from price_tiers before Toss confirm (fraud prevention)"
  - "Cancel deadline = showtime - 24h, enforced server-side with ForbiddenException"

patterns-established:
  - "Toss Payments: Basic auth header format, confirm/cancel API endpoints, TossPaymentError custom exception"
  - "Reservation atomicity: DB transaction wraps reservation + seats + payment insert"
  - "Admin booking stats: separate count/sum queries for totalBookings, totalRevenue, cancelRate"

requirements-completed: [BOOK-05, PAY-05, PAY-06, PAY-07, RESV-01, RESV-02, RESV-03, ADMN-04]

# Metrics
duration: 8min
completed: 2026-04-03
---

# Phase 4 Plan 1: Booking Backend Summary

**Reservation/payment backend with 3 DB tables, TossPaymentsClient, 8 API endpoints, server-side amount validation, and cancel deadline enforcement**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T00:33:27Z
- **Completed:** 2026-04-03T00:41:31Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- 3 new DB schema tables (reservations, reservation_seats, payments) with proper foreign keys and indexes
- Shared booking types (ReservationStatus, ReservationDetail, BookingStats, etc.) and zod schemas (confirmPaymentSchema, cancelReservationSchema, adminRefundSchema) exported from @grapit/shared
- TossPaymentsClient injectable service with Basic auth, confirm/cancel methods, and TossPaymentError
- ReservationService with server-side amount validation, atomic reservation creation, cancel deadline enforcement (showtime - 24h)
- 8 API endpoints across user (5) and admin (3) controllers
- All 81 tests pass (9 new booking/payment tests + 72 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema + shared types + TossPaymentsClient + test scaffolds (RED)** - `94d9d89` (test)
2. **Task 2: Reservation + Payment + Admin booking services and controllers (GREEN)** - `340e490` (feat)

## Files Created/Modified
- `apps/api/src/database/schema/reservations.ts` - Reservations table with status enum, cancel deadline, indexes
- `apps/api/src/database/schema/reservation-seats.ts` - Reservation seats join table with seat info
- `apps/api/src/database/schema/payments.ts` - Payments table with Toss payment data (paymentKey, tossOrderId)
- `apps/api/src/database/schema/index.ts` - Added reservations, reservationSeats, payments exports
- `packages/shared/src/types/booking.types.ts` - 10 shared type definitions for booking domain
- `packages/shared/src/schemas/booking.schema.ts` - Zod schemas for payment confirm, cancel, admin refund
- `packages/shared/src/index.ts` - Added booking types and schemas exports
- `apps/api/src/modules/payment/toss-payments.client.ts` - Toss Payments API client with Basic auth
- `apps/api/src/modules/payment/payment.service.ts` - Payment query service
- `apps/api/src/modules/payment/payment.module.ts` - Payment NestJS module
- `apps/api/src/modules/reservation/reservation.service.ts` - Core reservation business logic
- `apps/api/src/modules/reservation/reservation.controller.ts` - 5 user-facing endpoints
- `apps/api/src/modules/reservation/reservation.module.ts` - Reservation NestJS module
- `apps/api/src/modules/admin/admin-booking.service.ts` - Admin booking management
- `apps/api/src/modules/admin/admin-booking.controller.ts` - 3 admin endpoints with RBAC
- `apps/api/src/modules/admin/admin.module.ts` - Updated with PaymentModule import and AdminBookingService
- `apps/api/src/app.module.ts` - Added PaymentModule and ReservationModule

## Decisions Made
- Used Proxy-based chainable mocks for Drizzle multi-join query tests instead of deeply nested vi.fn() chains (cleaner, avoids mock chain fragility)
- TossPaymentsClient uses native fetch API (no axios) with Basic auth header per Toss Payments v1 API spec
- Server recalculates total from price_tiers before confirming payment (fraud prevention - never trust client amount)
- Cancel deadline is showtime minus 24 hours, enforced with ForbiddenException on server side

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test mock chain for complex Drizzle join queries**
- **Found during:** Task 2 (Making tests GREEN)
- **Issue:** vi.fn() mock chains broke on `.innerJoin()` calls because mocks need to return objects with the next chainable method
- **Fix:** Used JavaScript Proxy to create infinitely chainable mock objects that resolve to the desired value on `.then()`
- **Files modified:** reservation.service.spec.ts, admin-booking.service.spec.ts
- **Verification:** All 81 tests pass
- **Committed in:** 340e490

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test infrastructure. No scope creep.

## Issues Encountered
None beyond the test mock chain issue described above.

## User Setup Required
None - no external service configuration required. Toss Payments SDK key will be needed when testing actual payment flows (configured via TOSS_SECRET_KEY env var).

## Next Phase Readiness
- All backend API endpoints ready for frontend consumption (plans 02 and 03)
- DB migration generation needed before running against real database (drizzle-kit generate)
- Toss Payments sandbox key required for end-to-end payment testing

## Self-Check: PASSED

- All 14 key files verified present
- Both task commits (94d9d89, 340e490) verified in git history
- Shared build: clean
- API tsc --noEmit: clean
- All 81 tests: passed

---
*Phase: 04-booking-payment*
*Completed: 2026-04-03*
