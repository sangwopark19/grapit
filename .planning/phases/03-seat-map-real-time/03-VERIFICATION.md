---
phase: 03-seat-map-real-time
verified: 2026-04-02T00:50:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "All booking service unit tests pass (10 tests)"
    status: failed
    reason: "2 of 10 backend unit tests fail — broadcastSeatUpdate test assertions expect 3-arg call (showtimeId, seatId, status) but implementation passes 4 args (showtimeId, seatId, status, userId). Implementation added userId as a 4th arg for race-condition filtering (needed by frontend). Tests were not updated to match the intentional deviation."
    artifacts:
      - path: "apps/api/src/modules/booking/__tests__/booking.service.spec.ts"
        issue: "Test lines 137-141 and 202-206 assert toHaveBeenCalledWith(showtimeId, seatId, 'locked') and toHaveBeenCalledWith(showtimeId, seatId, 'available') — missing the 4th userId argument that the implementation now passes"
    missing:
      - "Update booking.service.spec.ts test lines 137-141: change to toHaveBeenCalledWith(showtimeId, seatId, 'locked', userId)"
      - "Update booking.service.spec.ts test lines 202-206: change to toHaveBeenCalledWith(showtimeId, seatId, 'available', userId)"
human_verification:
  - test: "Real-time seat updates across two browser tabs"
    expected: "Seat selected in Tab A appears gray in Tab B instantly, without page refresh"
    why_human: "Requires running NestJS API + Redis + Next.js frontend simultaneously with two browser sessions pointing to the same showtime"
  - test: "Countdown timer full lifecycle"
    expected: "Timer starts on first seat lock, counts down MM:SS, turns red at 3 minutes, opens non-dismissible modal at 0:00, clicking 처음으로 resets to initial state"
    why_human: "Requires live interaction; timer is real-time interval-based and 10-minute lock duration cannot be automated cheaply"
  - test: "Race condition toast"
    expected: "When two users attempt to lock the same seat simultaneously, the second user sees '이미 다른 사용자가 선택한 좌석입니다' toast and the seat reverts to tier color in their map"
    why_human: "Requires two authenticated user sessions attempting a concurrent seat lock against live Redis"
  - test: "WebSocket disconnect/reconnect toast"
    expected: "Killing Redis shows a persistent loading toast; restoring Redis shows a success toast and seat state refetches"
    why_human: "Requires manually interrupting the Redis connection and observing the UI"
---

# Phase 3: Seat Map + Real-Time — Verification Report

**Phase Goal:** Users can view an interactive SVG seat map, select available seats, and see other users' selections in real time
**Verified:** 2026-04-02T00:50:00Z
**Status:** gaps_found (1 automated gap — 2 failing tests)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can select a date and showtime, then see an SVG seat map with seats color-coded by tier | VERIFIED | `booking-page.tsx` wires `DatePicker`, `ShowtimeChips`, `SeatMapViewer` with `seatConfig` tier color rendering via `processedSvg` DOM manipulation |
| 2 | User can zoom, pan, and pinch-zoom (mobile) the seat map; sold/occupied seats clearly disabled | VERIFIED | `SeatMapViewer` wraps SVG in `TransformWrapper`/`TransformComponent` from `react-zoom-pan-pinch`; locked/sold seats get `cursor:not-allowed;opacity:0.6;transition:none` style |
| 3 | User can select seats and see them listed in a side panel with tier, row, number, and price | VERIFIED | `SeatSelectionPanel` (desktop 360px) and `SeatSelectionSheet` (mobile bottom sheet) both receive `selectedSeats: SeatSelection[]` with all required fields |
| 4 | Selected seat locked via Redis SET NX for 10 minutes; lock auto-releases on TTL expiry | VERIFIED | `BookingService.lockSeat()` calls `redis.set(key, userId, { nx: true, ex: 600 })`; TTL expiry auto-releases per Redis semantics; InMemoryRedis mock also implements cleanup |
| 5 | Other users see seat selections/releases reflected in real time via WebSocket without page refresh | HUMAN NEEDED | `useBookingSocket` receives `seat-update` events, calls `queryClient.setQueryData` to update cache, triggering `SeatMapViewer` re-render via `processedSvg` memo; requires live multi-tab test |

**Score:** 4/5 truths verified automatically (1 requires human)

---

## Required Artifacts

### Plan 01 Artifacts (Backend)

| Artifact | Status | Notes |
|----------|--------|-------|
| `apps/api/src/database/schema/seat-inventories.ts` | VERIFIED | Contains `pgTable('seat_inventories'`, `uniqueIndex('idx_seat_inv_showtime_seat')`; migration `0003_sloppy_dark_beast.sql` generated |
| `apps/api/src/modules/booking/booking.service.ts` | VERIFIED | 149 lines; full implementation of `lockSeat`, `unlockSeat`, `getSeatStatus`, `getMyLocks`; `MAX_SEATS=4`, `LOCK_TTL=600` |
| `apps/api/src/modules/booking/booking.gateway.ts` | VERIFIED | Contains `@WebSocketGateway({ namespace: '/booking' })`, `join-showtime`, `seat-update`, `broadcastSeatUpdate` |
| `apps/api/src/modules/booking/providers/redis.provider.ts` | VERIFIED | Exports `UPSTASH_REDIS` and `IOREDIS_CLIENT` symbol tokens; includes InMemoryRedis fallback for local dev |
| `packages/shared/src/types/booking.types.ts` | VERIFIED | Exports `SeatState`, `SeatSelection`, `LockSeatRequest`, `LockSeatResponse`, `SeatStatusResponse`, `SeatUpdateEvent` |

### Plan 02 Artifacts (Frontend Booking Page)

| Artifact | Status | Notes |
|----------|--------|-------|
| `apps/web/app/booking/[performanceId]/page.tsx` | VERIFIED | `'use client'` with `use(params)`, renders `BookingPage` |
| `apps/web/components/booking/booking-page.tsx` | VERIFIED | 431 lines; full orchestrator with all components wired including `useBookingSocket`, `TimerExpiredModal` |
| `apps/web/components/booking/seat-map-viewer.tsx` | VERIFIED | `TransformWrapper`, DOM-based SVG rendering, event delegation, `transition:none` on seat elements |
| `apps/web/components/booking/seat-selection-panel.tsx` | VERIFIED | Desktop 360px panel with seat list, total price, CTA |
| `apps/web/components/booking/seat-selection-sheet.tsx` | VERIFIED | Mobile bottom sheet with custom drag behavior |
| `apps/web/stores/use-booking-store.ts` | VERIFIED | Zustand store with all required state and actions including `setTimerExpiry`, `expireTimer`, `setConnected`, `resetBooking` |

### Plan 03 Artifacts (Real-Time Integration)

| Artifact | Status | Notes |
|----------|--------|-------|
| `apps/web/lib/socket-client.ts` | VERIFIED | `createBookingSocket()` factory, `autoConnect: false`, `reconnection: true` |
| `apps/web/hooks/use-socket.ts` | VERIFIED | Full WebSocket lifecycle: connect/disconnect/reconnect, `join-showtime`, `seat-update` cache update, race condition detection |
| `apps/web/hooks/use-countdown.ts` | VERIFIED | `useCountdown(expiresAt, onExpire)` with interval, 3-min warning, stale-closure-safe `onExpireRef` |
| `apps/web/components/booking/countdown-timer.tsx` | VERIFIED | Primary/red color transition, `aria-live`, monospace digits, `AlertTriangle` at warning |
| `apps/web/components/booking/timer-expired-modal.tsx` | VERIFIED | Non-dismissible `AlertDialog`, `open={open}` with no `onOpenChange`, "처음으로" reset CTA |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Notes |
|------|----|-----|--------|-------|
| `booking.service.ts` | `@upstash/redis` | `redis.set(key, userId, { nx: true, ex: 600 })` | WIRED | Line 38 |
| `booking.service.ts` | `@upstash/redis` | `sadd('locked-seats:${showtimeId}', seatId)` in lockSeat, `srem` in unlockSeat | WIRED | Lines 49, 83 |
| `booking.service.ts` | `booking.gateway.ts` | `this.gateway.broadcastSeatUpdate(showtimeId, seatId, status, userId)` | WIRED | Lines 52, 86 — NOTE: implementation passes 4 args (userId added), tests expect 3 args |
| `booking.gateway.ts` | `ioredis` | `createAdapter` from `redis-io.adapter.ts` | WIRED | `redis-io.adapter.ts` exports `createSocketIoRedisAdapter` |

### Plan 02 Key Links

| From | To | Via | Status | Notes |
|------|----|-----|--------|-------|
| `booking-page.tsx` | `use-booking.ts` | `useShowtimes`, `useSeatStatus`, `useLockSeat`, `useUnlockSeat` | WIRED | Lines 9-14, 60-63 |
| `seat-map-viewer.tsx` | `use-booking-store.ts` | `seatStates` prop from `useSeatStatus` data + `selectedSeatIds` from store | WIRED | Props passed at lines 391-396 |
| `booking-page.tsx` | `/api/v1/booking/seats/lock` | `lockSeat.mutate({ showtimeId, seatId })` | WIRED | Line 224; `use-booking.ts` line 55 calls `apiClient.post('/api/v1/booking/seats/lock', data)` |
| `layout-shell.tsx` | `/booking` | `pathname.startsWith('/booking')` hides GNB/Footer | WIRED | Lines 10-11 |

### Plan 03 Key Links

| From | To | Via | Status | Notes |
|------|----|-----|--------|-------|
| `use-socket.ts` | `socket-client.ts` | `createBookingSocket()` factory call | WIRED | Line 20 |
| `use-socket.ts` | `use-booking-store.ts` | `setConnected(true/false)` on connect/disconnect | WIRED | Lines 24, 42 |
| `use-socket.ts` | `@tanstack/react-query` | `invalidateQueries({ queryKey: ['seat-status', showtimeId] })` on reconnect | WIRED | Line 33 |
| `booking-page.tsx` | `use-socket.ts` | `useBookingSocket(selectedShowtimeId)` | WIRED | Line 58 |
| `countdown-timer.tsx` | `use-countdown.ts` | `useCountdown(expiresAt, onExpire)` | WIRED | Line 13 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `seat-map-viewer.tsx` | `seatStates: Map<string, SeatState>` | `seatStatusData.seats` from `useSeatStatus` → `GET /api/v1/booking/schedules/:showtimeId/seats` → `BookingService.getSeatStatus()` → Redis SMEMBERS + Drizzle DB query | Yes (Redis + DB combined) | FLOWING |
| `booking-page.tsx` | `selectedSeats: SeatSelection[]` | Zustand store `addSeat()` called on `lockSeat` success with tier info from `seatConfig` | Yes (set on user click + lock success) | FLOWING |
| `countdown-timer.tsx` | `expiresAt: number | null` | Zustand store `timerExpiresAt` set by `setTimerExpiry(response.expiresAt)` in `lockSeat` onSuccess | Yes (server-provided Unix ms timestamp from Redis TTL) | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Backend TS compiles | `pnpm --filter @grapit/api exec tsc --noEmit` | No output (0 errors) | PASS |
| Frontend TS compiles | `pnpm --filter @grapit/web exec tsc --noEmit` | No output (0 errors) | PASS |
| Frontend tests (45 tests) | `pnpm --filter @grapit/web test -- --run` | 45 passed (9 test files) | PASS |
| Backend tests (86 tests) | `pnpm --filter @grapit/api test -- --run` | 84 passed, 2 FAILED | FAIL |
| Migration generated | `0003_sloppy_dark_beast.sql` | Contains `CREATE TABLE "seat_inventories"` with unique index | PASS |
| Redis key consistency | grep `locked-seats` in `booking.service.ts` | `sadd` in `lockSeat` (line 49), `srem` in `unlockSeat` (line 83), `smembers` in `getSeatStatus` (line 122) | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SEAT-01 | 03-02 | SVG 기반 좌석 배치도가 등급별 색상으로 구분되어 표시된다 | SATISFIED | `SeatMapViewer` applies tier colors from `seatConfig.tiers` via DOM manipulation |
| SEAT-02 | 03-02 | 좌석 배치도에서 확대/축소/전체보기 컨트롤이 제공된다 | SATISFIED | `SeatMapControls` with zoom in/out/reset inside `TransformWrapper` |
| SEAT-03 | 03-02 | 모바일에서 핀치 줌/드래그 이동이 지원된다 | SATISFIED | `react-zoom-pan-pinch` `TransformWrapper` supports pinch zoom natively |
| SEAT-04 | 03-01, 03-03 | 이미 판매/점유된 좌석이 비활성 표시되며 선택할 수 없다 | SATISFIED | `seatStates` map from API; locked/sold → `cursor:not-allowed;opacity:0.6` in SVG; click handler checks state before calling `onSeatClick` |
| SEAT-05 | 03-02 | 선택한 좌석이 사이드 패널에 좌석 정보(등급, 가격)와 함께 표시된다 | SATISFIED | `SeatSelectionPanel` and `SeatSelectionSheet` both display `tierName`, `row`, `number`, `price` per `SeatSelection` |
| SEAT-06 | 03-01, 03-03 | 타 사용자의 좌석 선택/해제가 실시간으로 반영된다 (WebSocket/SSE) | HUMAN NEEDED | Infrastructure wired: `booking.gateway.ts` → `@socket.io/redis-adapter` → `useBookingSocket` → `queryClient.setQueryData` → `SeatMapViewer` re-render; live test required |
| BOOK-01 | 03-02 | 캘린더에서 예매 가능한 날짜를 선택할 수 있다 | SATISFIED | `DatePicker` with `react-day-picker` v9; `availableDates` computed from showtimes; disabled unavailable dates |
| BOOK-02 | 03-02 | 선택한 날짜의 회차(시간)를 선택할 수 있다 | SATISFIED | `ShowtimeChips` with filtered showtimes by selected date; calls `setShowtime(id)` on selection |
| BOOK-03 | 03-01, 03-03 | 좌석 선택 시 Redis SET NX로 10분간 임시 점유된다 | SATISFIED | `redis.set(key, userId, { nx: true, ex: 600 })` in `BookingService.lockSeat()`; `expiresAt` returned to client and shown in `CountdownTimer` |
| BOOK-04 | 03-01, 03-03 | 임시 점유 TTL 만료 시 좌석이 자동으로 해제된다 | SATISFIED | Redis TTL auto-expires the per-seat key; `InMemoryRedis` mock implements cleanup of `locked-seats` and `user-seats` sets on TTL expiry |

**All 10 phase 3 requirements have implementation evidence. SEAT-06 requires human verification for live cross-tab confirmation.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `booking-page.tsx` | 278 | `console.log({ showtimeId, selectedSeats, totalPrice })` in `handleProceed` | INFO | Intentional stub — "Next" button deferred to Phase 4; documented in 03-02-SUMMARY.md and 03-03-SUMMARY.md Known Stubs table |
| `booking-page.tsx` | 283 | `toast.info('결제 기능은 준비 중입니다')` — placeholder payment flow | INFO | Intentional stub — Phase 4 replaces with actual Toss Payments navigation |
| `booking.service.spec.ts` | 137-141, 202-206 | Tests assert `broadcastSeatUpdate` called with 3 args; implementation calls with 4 args | WARNING | Tests fail (2/86). Implementation diverged from plan spec by adding `userId` 4th arg for race condition filtering. Feature works correctly; tests need update |

**Stub classification note:** `handleProceed` console.log and toast are correctly classified as INFO (not blockers) because the Phase 3 goal does not include payment — it ends at seat selection. These stubs are the Phase 4 entry point.

The `broadcastSeatUpdate` test mismatch is a WARNING blocker because it causes 2 test failures in `pnpm test`.

---

## Human Verification Required

### 1. Real-Time Seat Updates (Cross-Tab)

**Test:** Open two browser tabs to the same `/booking/[performanceId]`. In Tab A, select a showtime and click an available seat.
**Expected:** The same seat in Tab B immediately turns gray (locked color `#D1D5DB`) without any page refresh or manual action.
**Why human:** Requires running NestJS API + Redis + Next.js dev server simultaneously with two authenticated sessions.

### 2. Countdown Timer Lifecycle

**Test:** Select a showtime, click a seat. Observe the timer in the booking header. Wait for it to reach under 3 minutes. Wait for it to reach 0:00.
**Expected:** Timer appears after first lock, counts down in MM:SS, transitions to red background at 3:00 remaining, opens a non-dismissible modal at 0:00, clicking "처음으로" resets the page to the initial state.
**Why human:** Real-time interval behavior; a 10-minute countdown cannot be reasonably automated without mocking the server `expiresAt` timestamp, which requires running the full stack.

### 3. Race Condition Toast

**Test:** With two authenticated users in the same showtime, have both users attempt to click the same seat at approximately the same time.
**Expected:** The user who loses the race sees the seat revert to tier color in their map and receives an info-styled toast "이미 다른 사용자가 선택한 좌석입니다".
**Why human:** Requires concurrent authenticated sessions against live Redis SET NX.

### 4. WebSocket Disconnect/Reconnect Behavior

**Test:** With an active seat map open, stop the Redis server (or disconnect network). Then restore it.
**Expected:** On disconnect: a persistent loading toast appears. On reconnect: a success toast appears and the seat state is automatically refetched.
**Why human:** Requires manual Redis interruption; cannot be simulated in unit tests without full integration setup.

---

## Gaps Summary

**1 gap blocking `pnpm test` green state:**

The `BookingService` implementation added a 4th `userId` argument to `broadcastSeatUpdate()` calls (both in `lockSeat` and `unlockSeat`). This was an intentional enhancement — the frontend `use-socket.ts` checks `data.userId !== myUserId` to ignore the user's own broadcasts and avoid false race-condition detections. However, the test file (`booking.service.spec.ts` lines 137-141 and 202-206) was not updated to match — it still asserts the 3-arg signature from the original plan.

**Fix:** Update the two test assertions in `booking.service.spec.ts` to include `userId` as the 4th argument.

The gap does not affect runtime behavior — the feature works correctly. It is purely a test maintenance issue.

---

_Verified: 2026-04-02T00:50:00Z_
_Verifier: Claude (gsd-verifier)_
