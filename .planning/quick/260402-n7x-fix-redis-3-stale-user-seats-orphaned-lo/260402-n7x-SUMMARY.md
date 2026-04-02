---
phase: quick
plan: 260402-n7x
subsystem: booking
tags: [redis, lua, seat-locking, bug-fix, atomicity]
dependency_graph:
  requires: []
  provides: [atomic-seat-lock, unlock-all-seats]
  affects: [booking-flow, seat-map, timer-reset]
tech_stack:
  added: []
  patterns: [lua-script, redis-eval, fire-and-forget-mutation]
key_files:
  created: []
  modified:
    - apps/api/src/modules/booking/booking.service.ts
    - apps/api/src/modules/booking/booking.controller.ts
    - apps/api/src/modules/booking/__tests__/booking.service.spec.ts
    - apps/web/hooks/use-booking.ts
    - apps/web/components/booking/booking-page.tsx
    - packages/shared/src/types/booking.types.ts
decisions:
  - Lua script for lockSeat atomicity (single redis.eval replaces 5 separate Redis calls)
  - unlockAllSeats uses Node loop (not Lua) because it needs per-seat broadcast + no concurrency concern
  - Fire-and-forget pattern for timer reset unlock-all (TTL is fallback)
metrics:
  duration: 5min
  completed: 2026-04-02T07:53:49Z
  tasks: 2/2
  files: 6
---

# Quick Task 260402-n7x: Fix Redis 3 Stale User-Seats / Orphaned Locks Summary

Lua-atomic lockSeat fixing stale user-seats inflation, race-condition seat count bypass, and timer-reset orphaned locks via new unlockAllSeats endpoint.

## What Changed

### Bug 1: Stale user-seats entries blocking new locks
- **Problem:** After seat lock TTL expired, seatId remained in user-seats set. `scard` counted stale entries, blocking users from selecting new seats.
- **Fix:** Lua script iterates user-seats members, checks each lock key via `EXISTS`, removes stale entries from both user-seats and locked-seats before count check.

### Bug 2: Timer reset leaving orphaned Redis locks
- **Problem:** `handleTimerReset` only called `resetBooking()` (Zustand clear) without releasing Redis locks. Seats appeared locked to all users until TTL expired.
- **Fix:** New `unlockAllSeats` method + `DELETE /api/v1/booking/seats/lock-all/:showtimeId` endpoint. Frontend calls it before `resetBooking()`.

### Bug 3: Non-atomic seat count check allowing >4 locks
- **Problem:** Separate `scard` + `SET NX` allowed two concurrent requests to both pass count check and both succeed.
- **Fix:** Single Lua script (`redis.eval`) makes stale-cleanup + count-check + SET NX + SADD + EXPIRE atomic. Two concurrent calls cannot both succeed when count = MAX_SEATS - 1.

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | e46aeea | test | TDD RED: failing tests for Lua lockSeat + unlockAllSeats |
| 2 | 0721257 | fix | Atomic Lua lockSeat + unlockAllSeats endpoint (GREEN) |
| 3 | 8c38eab | fix | Frontend unlock-all hook + timer reset integration |

## Task Details

### Task 1: Atomic Lua lockSeat + unlockAllSeats backend
- Replaced 5 separate Redis calls in `lockSeat` with single `redis.eval` Lua script
- Lua script: SMEMBERS -> EXISTS loop (stale cleanup) -> count check -> SET NX -> SADD + EXPIRE
- New `unlockAllSeats(userId, showtimeId)` method: smembers -> verify ownership -> del + srem + broadcast per seat -> del user-seats key
- New controller endpoint: `DELETE seats/lock-all/:showtimeId` with auth guard
- Added `UnlockAllResponse` to shared types
- 13 tests: all pass (7 new + 6 existing updated)

### Task 2: Frontend unlock-all hook + timer reset integration
- Added `useUnlockAllSeats` hook using `useMutation` (invalidates seat-status + my-locks queries)
- Wired `handleTimerReset`: reads `selectedShowtimeId` from store before `resetBooking()` clears it
- Fire-and-forget: `mutate()` without await (TTL is fallback if API fails)
- TypeScript compiles clean on both api and web packages

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification Results

- `vitest run booking.service.spec.ts`: 13/13 tests pass
- `tsc --noEmit` (api): clean
- `tsc --noEmit` (web): clean
- `grep redis.eval booking.service.ts`: confirmed Lua script in lockSeat
- `grep SMEMBERS booking.service.ts`: confirmed stale cleanup in Lua
- `grep unlockAll.mutate booking-page.tsx`: confirmed timer reset calls unlock-all

## Self-Check: PASSED

All 7 files found, all 3 commits verified.
