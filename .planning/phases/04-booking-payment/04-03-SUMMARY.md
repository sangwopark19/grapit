---
phase: 04-booking-payment
plan: 03
subsystem: ui, frontend
tags: [react, next.js, tanstack-query, reservation, mypage, admin, booking, cancel, refund]

# Dependency graph
requires:
  - phase: 04-booking-payment
    provides: plan 01 backend API endpoints (reservations, payments, admin bookings), shared booking types
  - phase: 02-catalog-admin
    provides: admin layout, sidebar, UI components (table, dialog, badge, etc.)
  - phase: 01-foundation-auth
    provides: auth guard, api-client, auth store, profile form
provides:
  - Mypage reservation list with status filters and card layout
  - Reservation detail page with full booking info and cancellation flow
  - Admin booking dashboard with stats cards, searchable table, detail modal with refund
  - Shared booking types in @grapit/shared (ReservationStatus, ReservationDetail, BookingStats, etc.)
  - React Query hooks (useMyReservations, useReservationDetail, useCancelReservation, useAdminBookings, useAdminRefund)
affects: [04-02 booking flow frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [url-based-tab-state, status-filter-chips, debounced-admin-search, inline-refund-form-in-modal]

key-files:
  created:
    - packages/shared/src/types/booking.types.ts
    - apps/web/hooks/use-reservations.ts
    - apps/web/components/reservation/reservation-card.tsx
    - apps/web/components/reservation/reservation-list.tsx
    - apps/web/components/reservation/reservation-detail.tsx
    - apps/web/components/reservation/cancel-confirm-modal.tsx
    - apps/web/app/mypage/reservations/[id]/page.tsx
    - apps/web/components/admin/admin-stat-card.tsx
    - apps/web/components/admin/admin-booking-table.tsx
    - apps/web/components/admin/admin-booking-detail-modal.tsx
    - apps/web/components/admin/admin-booking-dashboard.tsx
    - apps/web/app/admin/bookings/page.tsx
  modified:
    - apps/web/app/mypage/page.tsx
    - apps/web/components/admin/admin-sidebar.tsx
    - packages/shared/src/index.ts

key-decisions:
  - "URL searchParam-based tab state (?tab=reservations) for bookmarkable/shareable mypage tabs"
  - "Inline refund form within same modal (toggle view) instead of nested dialog to avoid dialog stacking UX issues"
  - "keepPreviousData on all list queries to prevent layout shift during filter/search changes"

patterns-established:
  - "Status badge color mapping: CONFIRMED green (#F0FDF4/#15803D), CANCELLED red (#FEF2F2/#C62828), PENDING_PAYMENT amber (#FFFBEB/#8B6306)"
  - "Reservation card: poster 60x84px + info + status badge pattern"
  - "Admin stat card: fixed 100px height, icon + label + formatted value"

requirements-completed: [RESV-01, RESV-02, RESV-03, ADMN-04]

# Metrics
duration: 7min
completed: 2026-04-03
---

# Phase 4 Plan 3: Reservation Management Frontend Summary

**Mypage reservation tabs with status-filtered card list, detail page with cancel flow (AlertDialog + reason select + refund preview), admin booking dashboard with stats cards/searchable table/refund modal**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-03T00:46:13Z
- **Completed:** 2026-04-03T00:53:10Z
- **Tasks:** 2 (of 3; Task 3 is human-verify checkpoint)
- **Files modified:** 15

## Accomplishments
- Mypage updated with Tabs (profile/reservations) and URL-based tab state for deep-linking
- Reservation list with status filter chips (all/confirmed/cancelled), poster card layout, empty/loading states
- Reservation detail page with full booking info sections (performance, seats, payment, cancel deadline) and AlertDialog cancel flow with reason selection and refund preview
- Admin booking dashboard with 3 stat cards (total bookings, revenue, cancel rate), debounced searchable table, row-click detail modal with inline refund form
- 6 React Query hooks with keepPreviousData for smooth filter transitions
- Booking types added to @grapit/shared for cross-package type safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Reservation hooks + components + updated mypage + reservation detail page** - `9f53466` (feat)
2. **Task 2: Admin booking management page + sidebar update** - `3b70e0d` (feat)

## Files Created/Modified
- `packages/shared/src/types/booking.types.ts` - Shared booking type definitions (ReservationStatus, ReservationDetail, BookingStats, etc.)
- `packages/shared/src/index.ts` - Added booking types export
- `apps/web/hooks/use-reservations.ts` - React Query hooks for reservation/booking operations
- `apps/web/components/reservation/reservation-card.tsx` - Clickable reservation card with poster, date, seat summary, status badge
- `apps/web/components/reservation/reservation-list.tsx` - Filter chips + card list with empty/loading states
- `apps/web/components/reservation/cancel-confirm-modal.tsx` - AlertDialog with reason select and refund preview
- `apps/web/components/reservation/reservation-detail.tsx` - Full reservation detail with cancel button and deadline enforcement
- `apps/web/app/mypage/page.tsx` - Updated with Tabs (profile/reservations) and URL-based state
- `apps/web/app/mypage/reservations/[id]/page.tsx` - Reservation detail page with AuthGuard
- `apps/web/components/admin/admin-stat-card.tsx` - Stats card with count/currency/percent formatting
- `apps/web/components/admin/admin-booking-table.tsx` - Admin booking table with status badges and skeleton loading
- `apps/web/components/admin/admin-booking-detail-modal.tsx` - Detail modal with inline refund form
- `apps/web/components/admin/admin-booking-dashboard.tsx` - Dashboard assembling stats, search, table, modal
- `apps/web/app/admin/bookings/page.tsx` - Admin bookings page wrapper
- `apps/web/components/admin/admin-sidebar.tsx` - Added "예매 관리" nav item with Ticket icon

## Decisions Made
- URL searchParam-based tab state (`?tab=reservations`) instead of client-only state for shareable/bookmarkable mypage tabs
- Inline refund form within same modal (view toggle) instead of nested dialog to avoid dialog stacking UX issues
- Used `keepPreviousData` on all list queries to prevent layout shift during filter/search changes
- Cancel modal uses `onEscapeKeyDown={(e) => e.preventDefault()}` per D-09 non-dismissible requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created booking.types.ts in shared package**
- **Found during:** Task 1 (reading types)
- **Issue:** Plan 01 created types in separate worktree; this worktree didn't have them yet
- **Fix:** Created booking.types.ts with all required types and added export to shared index
- **Files modified:** packages/shared/src/types/booking.types.ts, packages/shared/src/index.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** 9f53466 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for parallel agent worktree setup. No scope creep.

## Known Stubs
None - all components are fully wired to React Query hooks connected to Plan 01 API endpoints.

## Issues Encountered
None beyond the worktree type availability issue described in deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All reservation management UI ready for human verification (Task 3 checkpoint)
- Backend API endpoints from Plan 01 must be available for end-to-end testing
- Cancel deadline enforcement is client-side display only; server enforces in API

## Self-Check: PENDING

Task 3 (human-verify checkpoint) not yet completed.

---
*Phase: 04-booking-payment*
*Completed: 2026-04-03 (pending verification)*
