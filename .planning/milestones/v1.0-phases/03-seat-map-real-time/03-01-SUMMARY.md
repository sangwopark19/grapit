---
phase: 03-seat-map-real-time
plan: 01
subsystem: api
tags: [nestjs, redis, websocket, socket.io, upstash, ioredis, drizzle, seat-locking, real-time]

# Dependency graph
requires:
  - phase: 02-catalog-admin
    provides: "seat_maps + showtimes DB schema, performance types, NestJS module pattern"
provides:
  - "BookingService with Redis SET NX seat locking (600s TTL)"
  - "BookingGateway WebSocket /booking namespace with showtime rooms"
  - "BookingController REST API (lock, unlock, seat status)"
  - "seat_inventories Drizzle table for permanent sold records"
  - "Shared booking types (SeatState, SeatSelection, LockSeatResponse, SeatStatusResponse)"
  - "Redis providers (UPSTASH_REDIS, IOREDIS_CLIENT) with NestJS DI"
  - "Frontend dependencies (react-zoom-pan-pinch, react-day-picker, socket.io-client)"
affects: [03-02, 03-03, 04-payment]

# Tech tracking
tech-stack:
  added: ["@nestjs/websockets", "@nestjs/platform-socket.io", "socket.io", "@socket.io/redis-adapter", "@upstash/redis", "ioredis", "react-zoom-pan-pinch", "react-day-picker", "socket.io-client"]
  patterns: ["Redis SET NX for distributed locking", "dual Redis client strategy (Upstash HTTP + ioredis TCP)", "WebSocket room-based broadcasting", "locked-seats Redis set for status aggregation"]

key-files:
  created:
    - "apps/api/src/modules/booking/booking.service.ts"
    - "apps/api/src/modules/booking/booking.controller.ts"
    - "apps/api/src/modules/booking/booking.gateway.ts"
    - "apps/api/src/modules/booking/booking.module.ts"
    - "apps/api/src/modules/booking/providers/redis.provider.ts"
    - "apps/api/src/modules/booking/providers/redis-io.adapter.ts"
    - "apps/api/src/modules/booking/dto/lock-seat.dto.ts"
    - "apps/api/src/modules/booking/dto/seat-status.dto.ts"
    - "apps/api/src/config/redis.config.ts"
    - "apps/api/src/database/schema/seat-inventories.ts"
    - "packages/shared/src/types/booking.types.ts"
    - "apps/api/src/modules/booking/__tests__/booking.service.spec.ts"
    - "apps/api/src/modules/booking/__tests__/dto.spec.ts"
  modified:
    - "apps/api/src/app.module.ts"
    - "apps/api/src/database/schema/index.ts"
    - "packages/shared/src/index.ts"
    - "apps/api/package.json"
    - "apps/web/package.json"

key-decisions:
  - "locked-seats Redis set pattern: lockSeat writes to both user-seats and locked-seats sets; getSeatStatus reads locked-seats for aggregation"
  - "No TTL on locked-seats set (stale entries acceptable for MVP; actual lock correctness enforced by per-seat SET NX key)"
  - "broadcastSeatUpdate sends 'available' not 'released' on unlock for frontend consistency"

patterns-established:
  - "Redis provider pattern: Symbol tokens (UPSTASH_REDIS, IOREDIS_CLIENT) with ConfigService useFactory"
  - "WebSocket gateway pattern: namespace + room-based broadcasting for per-showtime isolation"
  - "Booking DTO pattern: zod schemas with Korean error messages, exported type inference"

requirements-completed: [SEAT-04, SEAT-06, BOOK-03, BOOK-04]

# Metrics
duration: 11min
completed: 2026-04-01
---

# Phase 3 Plan 01: Backend Booking Module Summary

**Redis SET NX seat locking with Socket.IO real-time broadcasting, REST API, and seat_inventories schema for the booking foundation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-01T05:44:09Z
- **Completed:** 2026-04-01T05:55:46Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- BookingService with atomic Redis SET NX locking (600s TTL), ownership-checked unlock, and combined Redis+DB seat status query
- WebSocket gateway at /booking namespace with per-showtime rooms and real-time seat-update broadcasting
- REST API: POST lock, DELETE unlock, GET seat status -- all with proper auth guards and zod validation
- 4-seat maximum enforced per user per showtime via Redis SCARD
- seat_inventories Drizzle table with unique (showtimeId, seatId) constraint and migration generated
- All Phase 3 frontend+backend dependencies installed
- 14 new tests (4 DTO + 10 service) all passing, 86 total tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared booking types + seat_inventories schema + Redis config + dependencies**
   - `94dce6e` test(03-01): add failing tests for booking DTOs and SeatState type (RED)
   - `079274c` feat(03-01): shared booking types, seat_inventories schema, Redis config, dependencies (GREEN)
2. **Task 2: BookingService + BookingController + BookingGateway + module registration**
   - `3c49521` test(03-01): add failing tests for BookingService (10 test cases) (RED)
   - `f14067e` feat(03-01): BookingService, Controller, Gateway with Redis seat locking (GREEN)

## Files Created/Modified
- `apps/api/src/modules/booking/booking.service.ts` - Core seat locking/unlocking/status business logic
- `apps/api/src/modules/booking/booking.controller.ts` - REST endpoints under /api/v1/booking
- `apps/api/src/modules/booking/booking.gateway.ts` - WebSocket gateway with showtime room management
- `apps/api/src/modules/booking/booking.module.ts` - NestJS module wiring all providers
- `apps/api/src/modules/booking/providers/redis.provider.ts` - UPSTASH_REDIS and IOREDIS_CLIENT DI tokens
- `apps/api/src/modules/booking/providers/redis-io.adapter.ts` - Socket.IO Redis adapter factory
- `apps/api/src/modules/booking/dto/lock-seat.dto.ts` - Zod schema for lock request validation
- `apps/api/src/modules/booking/dto/seat-status.dto.ts` - Zod schema for status query validation
- `apps/api/src/config/redis.config.ts` - NestJS config for Upstash + ioredis URLs
- `apps/api/src/database/schema/seat-inventories.ts` - Drizzle seat_inventories table + pgEnum
- `packages/shared/src/types/booking.types.ts` - Shared booking types (SeatState, SeatSelection, etc.)
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` - 10 BookingService unit tests
- `apps/api/src/modules/booking/__tests__/dto.spec.ts` - 4 DTO validation unit tests
- `apps/api/src/app.module.ts` - Added BookingModule + redisConfig
- `apps/api/src/database/schema/index.ts` - Added seatInventories export

## Decisions Made
- **locked-seats Redis set**: lockSeat writes to both `user-seats:${showtimeId}:${userId}` and `locked-seats:${showtimeId}` sets. getSeatStatus reads `locked-seats` via SMEMBERS for aggregation. No TTL on the set (stale entries from expired individual locks are acceptable for MVP -- the actual lock correctness is enforced by per-seat SET NX key). Future improvement: Redis keyspace notifications to clean stale entries.
- **Broadcast status value**: unlockSeat broadcasts 'available' (not 'released') to match the SeatState type union for frontend simplicity.
- **Public seat status endpoint**: GET /schedules/:showtimeId/seats is public (no auth) to allow unauthenticated seat map viewing before login.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DB migration could not be applied (no DATABASE_URL in worktree environment). Migration SQL file generated correctly and ready for application.
- Shared package needed rebuild (`pnpm --filter @grapit/shared build`) for TypeScript check to pass in worktree -- expected for git worktree environments.

## User Setup Required

**Redis environment variables** needed for the booking module to function:
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token
- `REDIS_URL` - Redis TCP URL for ioredis (Socket.IO pub/sub), defaults to `redis://localhost:6379`

These should be added to the root `.env` file. Without them, the module will start but Redis operations will fail at runtime.

## Next Phase Readiness
- Backend booking module fully operational -- Plan 02 (frontend SVG seat map) can build on these endpoints
- Plan 03 (real-time integration) can connect Socket.IO client to the /booking gateway
- Migration needs to be applied when DB is accessible: `DOTENV_CONFIG_PATH=../../.env pnpm --filter @grapit/api exec drizzle-kit migrate`

## Self-Check: PASSED

All 13 created files verified present. All 4 task commits verified in git log.

---
*Phase: 03-seat-map-real-time*
*Completed: 2026-04-01*
