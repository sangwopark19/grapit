---
phase: 03-seat-map-real-time
plan: 03
subsystem: web
tags: [socket.io, websocket, real-time, countdown-timer, race-condition, react-hooks, vitest]

# Dependency graph
requires:
  - phase: 03-seat-map-real-time
    plan: 01
    provides: "BookingGateway WebSocket /booking namespace, seat-update event"
  - phase: 03-seat-map-real-time
    plan: 02
    provides: "BookingPage, BookingHeader, SeatMapViewer, useBookingStore, useSeatStatus"
provides:
  - "Socket.IO client factory for /booking namespace"
  - "useBookingSocket hook: WebSocket lifecycle, seat-update cache updates, race condition handling"
  - "useCountdown hook: interval-based countdown with 3-min warning"
  - "CountdownTimer component: visual MM:SS with color state transitions"
  - "TimerExpiredModal: non-dismissible AlertDialog for timer expiry"
  - "Real-time seat state flow: WebSocket -> React Query cache -> SVG DOM"
affects: [04-payment]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Socket.IO client factory (non-singleton per mount)", "WebSocket -> React Query cache -> DOM rendering pipeline", "useRef for stale closure prevention in intervals/event handlers", "aria-live polite/assertive for countdown accessibility"]

key-files:
  created:
    - "apps/web/lib/socket-client.ts"
    - "apps/web/hooks/use-socket.ts"
    - "apps/web/hooks/use-countdown.ts"
    - "apps/web/components/booking/countdown-timer.tsx"
    - "apps/web/components/booking/timer-expired-modal.tsx"
    - "apps/web/hooks/__tests__/use-countdown.test.ts"
    - "apps/web/hooks/__tests__/use-socket.test.ts"
  modified:
    - "apps/web/components/booking/booking-page.tsx"
    - "apps/web/components/booking/booking-header.tsx"
    - "apps/web/components/booking/seat-map-viewer.tsx"

key-decisions:
  - "Socket factory (not singleton): each booking page mount creates a new socket to prevent stale connections"
  - "useRef for onExpire callback: avoids stale closure in setInterval while allowing callback updates"
  - "409 race condition uses toast.info with Info semantic color (#F3EFFF/#6C3CE0), other errors use toast.error"
  - "transition: none on SVG seat elements ensures instant color changes per D-12"

patterns-established:
  - "WebSocket -> React Query cache pipeline: socket event -> queryClient.setQueryData -> automatic component re-render"
  - "Race condition dual handling: WebSocket seat-update for remote conflicts + API 409 for local lock failures"
  - "Countdown timer useRef pattern: onExpireRef.current to avoid stale closure in setInterval"

requirements-completed: [SEAT-04, SEAT-06, BOOK-03, BOOK-04]

# Metrics
duration: 4min
completed: 2026-04-01
---

# Phase 3 Plan 03: Real-Time Integration Summary

**Socket.IO client with WebSocket seat updates, countdown timer with 3-minute warning, timer expiry modal, and race condition handling wired into booking page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T06:21:33Z
- **Completed:** 2026-04-01T06:25:45Z
- **Tasks:** 2 completed, 1 checkpoint pending
- **Files modified:** 10

## Accomplishments
- Socket.IO client factory connecting to /booking namespace with reconnection, autoConnect: false
- useBookingSocket hook managing full WebSocket lifecycle: connect/disconnect/reconnect, join-showtime rooms, seat-update -> React Query cache pipeline, race condition detection
- useCountdown hook with 1-second interval, 3-minute warning threshold, stale-closure-safe onExpire callback
- CountdownTimer component with primary/red color transition, aria-live polite/assertive, monospace digits
- TimerExpiredModal with non-dismissible AlertDialog and "처음으로" reset CTA
- BookingPage wired with WebSocket, timer expiry/reset handlers, 409 race condition toast
- BookingHeader upgraded from static "--:--" placeholder to live CountdownTimer
- SeatMapViewer adds transition: none for instant seat state changes (D-12)
- 10 new hook tests (5 useCountdown + 5 useBookingSocket), all 45 frontend tests green
- TypeScript compiles with zero errors

## Task Commits

1. **Task 1 (TDD): Socket client + hooks + components + tests**
   - `95a2aaf` test(03-03): add failing tests for useCountdown and useBookingSocket hooks (RED)
   - `af72bc2` feat(03-03): socket client, useBookingSocket, useCountdown hooks, CountdownTimer, TimerExpiredModal (GREEN)
2. **Task 2: Wire real-time into booking page**
   - `e74b3cc` feat(03-03): wire real-time WebSocket, countdown timer, race condition into booking page

## Files Created/Modified
- `apps/web/lib/socket-client.ts` - Socket.IO client factory for /booking namespace
- `apps/web/hooks/use-socket.ts` - WebSocket lifecycle hook with seat-update cache, race condition
- `apps/web/hooks/use-countdown.ts` - Countdown timer hook with warning at 3min
- `apps/web/components/booking/countdown-timer.tsx` - Visual MM:SS with color transitions
- `apps/web/components/booking/timer-expired-modal.tsx` - Non-dismissible AlertDialog
- `apps/web/hooks/__tests__/use-countdown.test.ts` - 5 countdown hook unit tests
- `apps/web/hooks/__tests__/use-socket.test.ts` - 5 WebSocket hook unit tests
- `apps/web/components/booking/booking-page.tsx` - WebSocket + timer + race condition integration
- `apps/web/components/booking/booking-header.tsx` - Live CountdownTimer replaces placeholder
- `apps/web/components/booking/seat-map-viewer.tsx` - Instant seat transition (no CSS animation)

## Decisions Made
- **Socket factory pattern**: `createBookingSocket()` returns a new Socket instance per call (not singleton). Each booking page mount gets a fresh socket to avoid stale connections from previous sessions.
- **Race condition dual handling**: (1) WebSocket `seat-update` events detect when another user locks a seat we selected, removing it from our store with info toast. (2) API 409 response from lock attempt reverts optimistic UI with info toast. Both paths use the Info semantic color scheme.
- **Timer transition: none on SVG**: Seat state changes from WebSocket are instant (no fade/transition) per D-12, achieved by explicitly setting `transition: 'none'` on all seat SVG elements.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| booking-page.tsx | handleProceed | console.log + toast instead of navigation | Payment flow deferred to Phase 4 |

This stub is intentional and documented -- Phase 4 will replace it with actual payment navigation.

## Pending: Checkpoint Human Verification (Task 3)

Task 3 is a human verification checkpoint requiring:
1. Both dev servers running (api + web)
2. Redis running for seat locking
3. Two browser tabs for real-time seat update testing
4. Timer countdown verification
5. Race condition toast verification

## Self-Check: PASSED

All 7 created files verified present. All 3 task commits verified in git log.
