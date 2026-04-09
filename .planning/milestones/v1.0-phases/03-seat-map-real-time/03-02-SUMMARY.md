---
phase: 03-seat-map-real-time
plan: 02
subsystem: web
tags: [react, next.js, zustand, react-query, react-zoom-pan-pinch, react-day-picker, svg, seat-map, booking-ui]

# Dependency graph
requires:
  - phase: 03-seat-map-real-time
    plan: 01
    provides: "BookingService REST API, WebSocket gateway, shared booking types"
  - phase: 02-catalog-admin
    provides: "PerformanceWithDetails, SeatMapConfig, showtimes, priceTiers, api-client"
provides:
  - "Booking page at /booking/[performanceId] with standalone layout (no GNB/Footer)"
  - "useBookingStore Zustand store for client-side booking state"
  - "React Query hooks: useShowtimes, useSeatStatus, useLockSeat, useUnlockSeat"
  - "Interactive SVG seat map with zoom/pan/pinch via react-zoom-pan-pinch"
  - "DatePicker with react-day-picker v9 disabled dates"
  - "ShowtimeChips with active/loading/empty states"
  - "SeatSelectionPanel (desktop 360px) and SeatSelectionSheet (mobile bottom sheet)"
  - "Optimistic seat locking with 409 race condition revert"
affects: [03-03, 04-payment]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DOM-based SVG seat state rendering (no per-seat React components)", "Zustand + React Query separation (client vs server state)", "Custom bottom sheet with CSS transform + touch events", "Optimistic UI with mutation error revert"]

key-files:
  created:
    - "apps/web/app/booking/[performanceId]/page.tsx"
    - "apps/web/app/booking/[performanceId]/layout.tsx"
    - "apps/web/components/booking/booking-page.tsx"
    - "apps/web/components/booking/booking-header.tsx"
    - "apps/web/components/booking/date-picker.tsx"
    - "apps/web/components/booking/showtime-chips.tsx"
    - "apps/web/components/booking/seat-map-viewer.tsx"
    - "apps/web/components/booking/seat-map-controls.tsx"
    - "apps/web/components/booking/seat-legend.tsx"
    - "apps/web/components/booking/seat-selection-panel.tsx"
    - "apps/web/components/booking/seat-selection-sheet.tsx"
    - "apps/web/components/booking/seat-row.tsx"
    - "apps/web/stores/use-booking-store.ts"
    - "apps/web/hooks/use-booking.ts"
    - "packages/shared/src/types/booking.types.ts"
    - "apps/web/components/booking/__tests__/date-picker.test.tsx"
    - "apps/web/components/booking/__tests__/showtime-chips.test.tsx"
    - "apps/web/components/booking/__tests__/seat-map-viewer.test.tsx"
    - "apps/web/components/booking/__tests__/seat-selection-panel.test.tsx"
    - "apps/web/components/booking/__tests__/seat-map-controls.test.tsx"
  modified:
    - "apps/web/app/layout-shell.tsx"
    - "apps/web/package.json"
    - "packages/shared/src/index.ts"
    - "pnpm-lock.yaml"

key-decisions:
  - "DOM-based SVG rendering: fetch SVG text, set innerHTML, apply seat states via querySelectorAll + setAttribute (avoids 1000+ React component overhead)"
  - "Custom bottom sheet: CSS transform + touch events (no external library, shadcn Sheet is side-drawer only)"
  - "Timer placeholder in BookingHeader: shows static '--:--' when expiresAt is set, full CountdownTimer deferred to Plan 03"
  - "'Next' button logs payload + shows toast placeholder (Phase 4 replaces with payment navigation)"

patterns-established:
  - "Booking store pattern: Zustand with setShowtime clearing seats/timer (state cascade on showtime change)"
  - "Optimistic seat lock: addSeat immediately, revert on 409 error with toast notification"
  - "Event delegation on SVG container: single click handler with closest('[data-seat-id]') lookup"

requirements-completed: [SEAT-01, SEAT-02, SEAT-03, SEAT-05, BOOK-01, BOOK-02]

# Metrics
duration: 12min
completed: 2026-04-01
---

# Phase 3 Plan 02: Frontend Booking Page Summary

**Interactive SVG seat map with react-zoom-pan-pinch, date/showtime selection via react-day-picker, Zustand booking store, and responsive selection panels (desktop side panel + mobile bottom sheet)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-01T06:01:35Z
- **Completed:** 2026-04-01T06:13:43Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments
- Complete booking page at /booking/[performanceId] with standalone layout (no GNB, no Footer)
- Zustand useBookingStore managing date, showtime, seats, timer, and connection state with showtime-change cascading resets
- React Query hooks (useShowtimes, useSeatStatus, useLockSeat, useUnlockSeat) connected to Plan 01 REST API
- DatePicker with react-day-picker v9 Korean locale, disabled unavailable dates, primary accent on selected
- ShowtimeChips with formatted times, active/inactive/loading/empty states
- SeatLegend showing tier colors with prices, horizontally scrollable
- SeatMapViewer: SVG fetched from URL, rendered inline, seat states applied via DOM manipulation, zoom/pan/pinch via react-zoom-pan-pinch, event delegation for clicks, hover tooltips on desktop
- SeatMapControls: floating zoom in/out/reset buttons inside TransformWrapper
- SeatSelectionPanel (desktop 360px): sticky panel with seat list, total price, CTA button
- SeatSelectionSheet (mobile): custom bottom sheet with drag-to-expand/collapse, snap points, auto-expand on first seat selection
- Optimistic seat locking with 409 race condition revert and toast notification
- 26 new unit tests across 5 test suites, all 35 frontend tests passing
- TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Booking store + hooks + LayoutShell update + page route**
   - `b7661de` feat(03-02): booking store, hooks, LayoutShell update, page route
2. **Task 2: Header, calendar, showtime chips, legend components**
   - `bb8fdb0` feat(03-02): header, calendar, showtime chips, legend components
3. **Task 3: Seat map, controls, selection panels, booking page orchestrator + tests**
   - `4020451` feat(03-02): seat map, controls, selection panels, booking page orchestrator

## Files Created/Modified
- `apps/web/app/booking/[performanceId]/page.tsx` - Booking route (use client + use(params))
- `apps/web/app/booking/[performanceId]/layout.tsx` - Minimal layout wrapper
- `apps/web/components/booking/booking-page.tsx` - Main orchestrator wiring all components
- `apps/web/components/booking/booking-header.tsx` - Sticky header with back button, title, timer placeholder
- `apps/web/components/booking/date-picker.tsx` - react-day-picker v9 calendar with disabled dates
- `apps/web/components/booking/showtime-chips.tsx` - Horizontal chip row with active/loading/empty states
- `apps/web/components/booking/seat-legend.tsx` - Tier color legend bar
- `apps/web/components/booking/seat-map-viewer.tsx` - SVG seat map with DOM-based state rendering
- `apps/web/components/booking/seat-map-controls.tsx` - Zoom in/out/reset floating controls
- `apps/web/components/booking/seat-row.tsx` - Individual seat item in selection list
- `apps/web/components/booking/seat-selection-panel.tsx` - Desktop side panel (360px)
- `apps/web/components/booking/seat-selection-sheet.tsx` - Mobile bottom sheet with drag
- `apps/web/stores/use-booking-store.ts` - Zustand booking state store
- `apps/web/hooks/use-booking.ts` - React Query hooks for booking API
- `packages/shared/src/types/booking.types.ts` - Shared booking types (from Plan 01, recreated in worktree)
- `packages/shared/src/index.ts` - Added booking types export
- `apps/web/app/layout-shell.tsx` - Added /booking route exclusion for GNB/Footer
- `apps/web/package.json` - Added react-zoom-pan-pinch, react-day-picker, socket.io-client, @testing-library/user-event

## Decisions Made
- **DOM-based SVG rendering**: Fetch SVG text from URL, inject via dangerouslySetInnerHTML, apply seat states via querySelectorAll('[data-seat-id]') + setAttribute. This avoids creating 1000+ individual React components per seat, which would cause severe re-render overhead. Only seat state changes trigger DOM updates.
- **Custom bottom sheet over shadcn Sheet**: shadcn Sheet is a side drawer, not a bottom sheet with snap points. Built custom implementation using CSS transform: translateY() with touch event tracking and velocity-based snap detection. Lightweight, no extra dependencies.
- **Timer placeholder**: BookingHeader shows "--:--" when a timer is active. The full CountdownTimer with real-time countdown will be implemented in Plan 03 (real-time integration).
- **"Next" button placeholder**: Logs booking payload to console and shows toast "결제 기능은 준비 중입니다". Phase 4 will replace this with actual payment navigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created booking.types.ts in worktree**
- **Found during:** Task 1
- **Issue:** packages/shared/src/types/booking.types.ts was created by Plan 01 in a separate worktree and doesn't exist in this worktree.
- **Fix:** Created the shared booking types file and added its export to packages/shared/src/index.ts.
- **Files modified:** packages/shared/src/types/booking.types.ts, packages/shared/src/index.ts
- **Commit:** b7661de

**2. [Rule 3 - Blocking] Installed missing frontend dependencies**
- **Found during:** Task 1
- **Issue:** react-zoom-pan-pinch, react-day-picker, and socket.io-client were installed by Plan 01 in a different worktree.
- **Fix:** Ran pnpm install for missing packages in this worktree.
- **Files modified:** apps/web/package.json, pnpm-lock.yaml

**3. [Rule 3 - Blocking] Installed @testing-library/user-event**
- **Found during:** Task 2
- **Issue:** user-event needed for test interaction simulation, not previously installed.
- **Fix:** Added as dev dependency.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| booking-header.tsx | 37 | Timer shows "--:--" static text | CountdownTimer component deferred to Plan 03 |
| booking-page.tsx | handleProceed | console.log + toast instead of navigation | Payment flow deferred to Phase 4 |

Both stubs are intentional and documented in the plan. Plan 03 resolves the timer, Phase 4 resolves the payment navigation.

## Self-Check: PASSED

All 20 created files verified present. All 3 task commits verified in git log.
