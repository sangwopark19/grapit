# Phase 19: Seat Lock Ownership Enforcement - Research

**Researched:** 2026-04-29 [VERIFIED: system date]
**Domain:** Valkey Lua seat-lock ownership, NestJS reservation/payment boundary, Toss compensation, booking UX regression validation [VERIFIED: .planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md]
**Confidence:** HIGH [VERIFIED: codebase grep + official docs + npm registry]

<user_constraints>
## User Constraints (from CONTEXT.md)

Source: copied from `.planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md` [VERIFIED: 19-CONTEXT.md]

### Locked Decisions

## Implementation Decisions

### Ownership Source Of Truth

- **D-01:** The existing Valkey lock key value remains the ownership token. A seat is owned only when `GET {showtimeId}:seat:{seatId}` equals the authenticated `userId`.
- **D-02:** Do not introduce a separate reservation-level lock token for this phase. The current lock contract is already user-bound, TTL-bound, and hash-tagged by showtime; adding a second token would expand migration and client payload scope.
- **D-03:** All multi-key lock validation must pass every accessed key through `KEYS` and keep the `{showtimeId}` hash tag so standalone and cluster deployments share the same script contract.
- **D-04:** The `locked-seats` set is an index only. It may be stale. The actual per-seat lock key is authoritative.

### Reservation Prepare Contract

- **D-05:** `prepareReservation()` must validate all requested `seatId`s against active Valkey ownership before creating or returning a pending reservation.
- **D-06:** Existing `orderId` idempotency cannot bypass the ownership check. If a pending reservation already exists for the same order and its locks are now expired/released/owned by another user, `prepareReservation()` should reject instead of returning success.
- **D-07:** The prepare check should fail the whole request if any requested seat is invalid. Partial reservation creation is not allowed.
- **D-08:** The rejection should be a client-visible conflict class error (`409 Conflict`) with Korean copy that distinguishes lock expiry/release from a general server failure.

### Payment Confirm Contract

- **D-09:** `confirmAndCreateReservation()` must validate the pending reservation's seats before calling Toss `confirmPayment()`. This prevents charging a user when the server already knows the seat locks are invalid.
- **D-10:** After Toss confirms and before seats are marked sold, the service must re-check and consume the locks atomically. If locks are no longer owned at that point, abort DB sold transition and run the existing Toss compensation cancel path.
- **D-11:** The preferred implementation is a new BookingService helper such as `consumeOwnedSeatLocks(userId, showtimeId, seatIds)` backed by a Lua script that checks all seat lock keys, deletes only owned locks, removes `user-seats` and `locked-seats` index members, and returns structured failure reasons.
- **D-12:** The post-confirm consume step replaces the broad `unlockAllSeats(userId, showtimeId)` cleanup for the confirmed seats. Avoid deleting unrelated locks the same user may hold in the same showtime after a retry or tab/session edge case.
- **D-13:** Existing payment idempotency remains: if a `payments.tossOrderId` record already exists, return the reservation detail without requiring active locks because sold transition already happened.

### Error And UX Semantics

- **D-14:** Lock ownership failures should use explicit user-facing messages:
  - expired/released/missing lock: `좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.`
  - other-user lock: `이미 다른 사용자가 선택한 좌석입니다.`
- **D-15:** The web confirm page should surface the server message from `/reservations/prepare` and stop payment widget submission. If the lock is invalid, route or guide the user back to seat selection using existing booking state patterns rather than starting Toss.
- **D-16:** The complete page should surface payment confirm lock failures as a failed confirmation state and rely on recovery/idempotency only for already-confirmed orders. Do not silently show success when the server rejected the sold transition.
- **D-17:** WebSocket `sold` broadcast remains after DB commit. Lock invalidation/cleanup broadcasts should not race ahead of the committed sold state.

### Test Contract

- **D-18:** Add focused `ReservationService` tests proving prepare rejects missing/expired/other-user locks and confirm refuses sold transition without active ownership.
- **D-19:** Add BookingService Lua/in-memory coverage for multi-seat ownership assert/consume, including all-owned, missing, other-owner, and cleanup of index sets.
- **D-20:** Add or update API/E2E coverage for the user path: selected seat lock disappears or changes owner before prepare/confirm, then the booking flow shows the lock-expired/other-user error and does not create a confirmed reservation.
- **D-21:** Keep tests close to existing files unless the planner finds a cleaner local pattern: `booking.service.spec.ts`, `booking.service.integration.spec.ts`, `redis.provider.spec.ts`, `reservation.service.spec.ts`, and existing payment/booking Playwright specs.

### Scope Guardrails

- **D-22:** Do not solve client-provided tier/price metadata trust in this phase beyond existing amount recalculation. If the planner discovers a severe seatId -> tier mismatch exploit, record it as a deferred fraud-hardening item unless it blocks lock ownership enforcement.
- **D-23:** Do not rework the full reservation schema or add new tables unless strictly required. The current `reservations`, `reservation_seats`, `payments`, and `seat_inventories` tables are the integration surface.
- **D-24:** Preserve Phase 17 production safety: production must never fall back to `InMemoryRedis`, because instance-local locks can allow duplicate bookings.

### the agent's Discretion

- Exact helper names, TypeScript error classes, and failure enum names are flexible if the behavior above is preserved.
- The planner may choose whether prepare uses an assert-only Lua script and confirm uses a consume Lua script, or a single parameterized helper with modes, as long as key access remains explicit and testable.
- The frontend may redirect immediately to seat selection or keep the user on confirm with a clear CTA, provided Toss is not opened after a lock ownership failure.

### Deferred Ideas (OUT OF SCOPE)

- **Seat metadata fraud-hardening:** Server-side derivation of seat tier/row/number/price from the canonical SVG or seat inventory source should be its own phase if needed.
- **Lock extension / hold refresh UX:** Extending a seat lock while the user is on confirm/payment could improve conversion but changes user-facing timer semantics and belongs outside this gap closure.
- **Queueing/waiting room:** Not required for early traffic and already out of scope for the project.
- **Valkey production runtime proof:** Phase 20 owns Cloud Run -> Valkey connectivity, cluster mode, idle reconnect, and Socket.IO pub/sub runtime evidence.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALK-03 | 좌석 잠금 Lua 스크립트 Valkey 호환성 검증 및 수정 [VERIFIED: .planning/REQUIREMENTS.md] | Use ioredis `eval(script, numKeys, ...keysAndArgs)`, pass every accessed key through `KEYS`, preserve `{showtimeId}` hash tags, and add real Valkey integration coverage for assert/consume scripts. [VERIFIED: apps/api/src/modules/booking/booking.service.ts; CITED: https://valkey.io/commands/eval/] |
| UX-02 | SVG 좌석맵 스테이지 방향 표시 [VERIFIED: .planning/REQUIREMENTS.md] | Phase 19 must not regress existing seat-map UX tests while adding lock-expired paths; run existing `seat-map-viewer` tests that already cover stage overlay. [VERIFIED: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx] |
| UX-03 | SVG 좌석맵 등급별 색상 범례 + 가격 표시 [VERIFIED: .planning/REQUIREMENTS.md] | Preserve `SeatSelection` shape and booking store data so order summary/legend still receives tier and price fields after lock failures. [VERIFIED: packages/shared/src/types/booking.types.ts; apps/web/components/booking/booking-page.tsx] |
| UX-04 | 좌석 선택 상태 전환 애니메이션 [VERIFIED: .planning/REQUIREMENTS.md] | Backend conflict handling should revert/clear selected seats through existing booking state instead of mutating SVG state directly. [VERIFIED: apps/web/components/booking/booking-page.tsx] |
| UX-05 | 미니맵 네비게이터 [VERIFIED: .planning/REQUIREMENTS.md] | Keep Phase 12 `seat-map-viewer` regression tests in the phase gate because lock errors redirect users back into the same viewer. [VERIFIED: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx] |
| UX-06 | 모바일 터치 타겟 44px 최소 보장 [VERIFIED: .planning/REQUIREMENTS.md] | Do not add confirm/complete error UI that crowds mobile sticky CTA; validate mobile lock-failure path with Playwright or responsive component tests. [VERIFIED: apps/web/playwright.config.ts; apps/web/app/booking/[performanceId]/confirm/page.tsx] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

| Directive | Planning Impact |
|-----------|-----------------|
| Write responses in Korean; keep technical terms and code identifiers in English. [VERIFIED: ./AGENTS.md] | PLAN.md task descriptions and validation notes should be Korean with code names left in English. |
| Do not modify Claude or `~/.claude` settings/files/workflows. [VERIFIED: ./AGENTS.md] | Phase 19 must stay inside repo code/planning artifacts. |
| Follow stack defined in project architecture/stack docs. [VERIFIED: ./AGENTS.md] | Use existing NestJS + ioredis + Drizzle + Vitest + Playwright stack; do not introduce a lock library or payment workflow framework. |
| Before direct file edits, start through a GSD workflow unless explicitly bypassed. [VERIFIED: ./AGENTS.md] | Planner should keep execution under `/gsd:execute-phase` or equivalent GSD plan execution. |
| Project skill directories `.codex/skills` and `.agents/skills` are absent in this repo. [VERIFIED: find .codex/skills .agents/skills] | No extra project skill rules need to be loaded for Phase 19. |
| Planning graph is absent. [VERIFIED: find .planning/graphs] | Semantic graph context is unavailable; research relies on grep/code/docs. |
| Current git worktree has unrelated untracked `docs/v2.0-fanmeet-milestone-spec.md`. [VERIFIED: git status --short] | Do not include that file in Phase 19 commits. |

## Summary

Phase 19 should enforce seat ownership at the API/backend boundary, not in the browser. `BookingService.lockSeat()` already stores `userId` as the per-seat Valkey value under `{showtimeId}:seat:{seatId}` and uses hash-tagged Lua for lock/unlock/status. [VERIFIED: apps/api/src/modules/booking/booking.service.ts:17-188] `ReservationService.prepareReservation()` currently returns existing pending reservations by `orderId` before any lock check and inserts `reservation_seats` from client-provided seats after only amount validation. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:81-146] `ReservationService.confirmAndCreateReservation()` currently calls Toss confirm before any active lock ownership check, marks seats sold from `reservation_seats`, then broadly calls `unlockAllSeats()`. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:149-283]

Primary recommendation: add two focused `BookingService` helpers, `assertOwnedSeatLocks(userId, showtimeId, seatIds)` and `consumeOwnedSeatLocks(userId, showtimeId, seatIds)`, backed by Lua scripts that check every requested per-seat key value against the authenticated user and pass all accessed keys through `KEYS`. [VERIFIED: 19-CONTEXT.md D-03/D-05/D-11] Wire `assertOwnedSeatLocks()` into prepare before both idempotent return and new pending creation; wire confirm as `existing payment idempotency -> pending reservation lookup -> amount validation -> pre-Toss assert -> Toss confirm -> atomic consume -> DB sold/payment transaction -> sold WebSocket broadcast`. [VERIFIED: 19-CONTEXT.md D-06/D-09/D-10/D-13/D-17]

The strongest technical constraint is fail-closed behavior. Valkey `EVAL` requires the script source, key count, keys, then args, and official Valkey docs state that all key names accessed by scripts must be provided explicitly for standalone and clustered deployments. [CITED: https://valkey.io/commands/eval/] Redis/Valkey Lua scripts execute atomically, which is the correct primitive for multi-seat check-and-delete. [CITED: https://redis.io/docs/latest/develop/programmability/eval-intro/] Safe lock release requires comparing the stored lock value before deleting, because deleting without ownership comparison can remove another client's lock. [CITED: https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/] The existing code already uses the same compare-before-delete pattern for single-seat unlock. [VERIFIED: apps/api/src/modules/booking/booking.service.ts:56-75]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Seat lock ownership assertion | API / Backend | Valkey | Authenticated `userId` and requested `seatIds` meet at `ReservationService`; Valkey stores the authoritative lock value. [VERIFIED: 19-CONTEXT.md D-01/D-05] |
| Atomic lock consume | API / Backend | Valkey | Multi-seat check/delete must be a single Lua operation to avoid TOCTOU between Toss confirm and sold transition. [VERIFIED: 19-CONTEXT.md D-10/D-11; CITED: Redis Lua atomicity docs] |
| Pending reservation creation | API / Backend | Database / Storage | `reservations` and `reservation_seats` are persisted in PostgreSQL through Drizzle transactions. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:116-144] |
| Payment authorization/confirmation | API / Backend | Toss Payments external service | `TossPaymentsClient.confirmPayment()` calls `/v1/payments/confirm` with `paymentKey`, `orderId`, and `amount`; Toss confirms the payment externally. [VERIFIED: apps/api/src/modules/payment/toss-payments.client.ts:41-70; CITED: https://docs.tosspayments.com/reference#confirm-payment] |
| Payment compensation after post-confirm failure | API / Backend | Toss Payments external service | Existing compensation uses `cancelPayment()` after DB failure; lock consume failure after Toss should reuse the same cancel path. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:250-267; CITED: https://docs.tosspayments.com/reference#cancel-payment] |
| Lock-expired/other-user UX | Browser / Client | API / Backend | API returns `409` messages; `apiClient` already extracts response `message` and throws `ApiClientError`. [VERIFIED: apps/web/lib/api-client.ts:108-127] |
| `sold` broadcast | API / Backend | Browser / Client | `BookingGateway.broadcastSeatUpdate()` should remain after DB commit so clients see committed sold state only. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:273-281; 19-CONTEXT.md D-17] |

## Standard Stack

### Core

| Library | Installed Version | Current Registry Version | Purpose | Why Standard |
|---------|-------------------|--------------------------|---------|--------------|
| `ioredis` | 5.10.1 [VERIFIED: pnpm list] | 5.10.1, modified 2026-03-19 [VERIFIED: npm registry] | Valkey/Redis TCP client and Lua `eval()` executor | Already used by `REDIS_CLIENT`; Context7 docs confirm `eval(script, numkeys, ...args)` shape. [VERIFIED: apps/api/src/modules/booking/providers/redis.provider.ts; VERIFIED: Context7 /redis/ioredis] |
| `@nestjs/common` | 11.1.17 [VERIFIED: pnpm list] | 11.1.19, modified 2026-04-13 [VERIFIED: npm registry] | `ConflictException`, `BadRequestException`, service/controller framework | Existing API uses Nest exceptions; Nest docs list built-in HTTP exceptions including `ConflictException`. [VERIFIED: apps/api/src/modules/booking/booking.service.ts; CITED: https://docs.nestjs.com/exception-filters] |
| `drizzle-orm` | 0.45.1 [VERIFIED: pnpm list] | 0.45.2, modified 2026-04-28 [VERIFIED: npm registry] | PostgreSQL transactions and seat inventory persistence | Existing reservation flow uses Drizzle transactions; Drizzle docs support conflict/upsert patterns if planner hardens seat inventory writes. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts; VERIFIED: Context7 /drizzle-team/drizzle-orm-docs] |
| `@tosspayments/tosspayments-sdk` | 2.6.0 [VERIFIED: pnpm list] | 2.7.0, modified 2026-04-21 [VERIFIED: npm registry] | Web Toss widget | Confirm page already initializes widget and calls prepare before `requestPayment()`. [VERIFIED: apps/web/components/booking/toss-payment-widget.tsx; apps/web/app/booking/[performanceId]/confirm/page.tsx] |
| `Vitest` | API 3.2.4 / Web range 3.2.x [VERIFIED: pnpm list + package.json] | 4.1.5, modified 2026-04-23 [VERIFIED: npm registry] | Unit/integration tests | Existing API and web test configs use Vitest; keep current installed major for this phase. [VERIFIED: apps/api/vitest.config.ts; apps/web/vitest.config.ts] |
| `testcontainers` | 11.14.0 [VERIFIED: pnpm list] | 11.14.0, modified 2026-04-08 [VERIFIED: npm registry] | Real Valkey integration tests | Existing booking/SMS integration tests boot `valkey/valkey:8`. [VERIFIED: apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts; apps/api/test/sms-cluster-crossslot.integration.spec.ts] |
| `@playwright/test` | 1.59.1 [VERIFIED: pnpm list] | 1.59.1, modified 2026-04-29 [VERIFIED: npm registry] | Booking/payment E2E regression | Existing Toss E2E intercepts payment confirm and seeds booking fixture. [VERIFIED: apps/web/e2e/toss-payment.spec.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | 5.95.2 installed / 5.100.6 current [VERIFIED: pnpm list + npm registry] | Client mutation/query cache | Keep existing `usePrepareReservation()` and `useConfirmPayment()` mutations; do not add another client state layer. [VERIFIED: apps/web/hooks/use-booking.ts] |
| `zod` | API dependency range 3.25.76 / registry 4.3.6 [VERIFIED: apps/api/package.json + npm registry] | Shared request validation | Keep existing `prepareReservationSchema` and `confirmPaymentSchema`; this phase should not expand client payload with a new token. [VERIFIED: packages/shared/src/schemas/booking.schema.ts; 19-CONTEXT.md D-02] |
| `Docker` | 29.1.3 available [VERIFIED: docker info] | testcontainers runtime | Required for real Valkey integration tests. [VERIFIED: apps/api/vitest.integration.config.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lua assert/consume in `BookingService` | Multiple `GET`/`DEL` calls in TypeScript | Not atomic; race can occur between checking locks and deleting them. Use Lua. [CITED: Redis Lua atomicity docs] |
| Valkey lock value = `userId` | New reservation-level lock token | Rejected by CONTEXT; adds migration/client payload scope and duplicates the existing user-bound TTL contract. [VERIFIED: 19-CONTEXT.md D-02] |
| `unlockAllSeats(userId, showtimeId)` after confirm | Broad cleanup after DB commit | Rejected by CONTEXT because it can delete unrelated same-showtime locks held by the same user. [VERIFIED: 19-CONTEXT.md D-12; apps/api/src/modules/booking/booking.service.ts:198-225] |
| New payment state machine library | Existing `TossPaymentsClient` + compensation path | Existing client already wraps confirm/cancel endpoints; phase only needs ordering and tests. [VERIFIED: apps/api/src/modules/payment/toss-payments.client.ts] |

**Installation:**

```bash
# No new packages. Use existing workspace dependencies.
pnpm install
```

**Version verification:** Registry versions were checked with `npm view <package> version time.modified`; installed versions were checked with `pnpm --filter ... list --depth 0`. [VERIFIED: npm registry + pnpm list]

## Architecture Patterns

### System Architecture Diagram

```text
Browser SeatMap
  -> POST /api/v1/booking/seats/lock
  -> BookingService.lockSeat()
  -> Valkey {showtimeId}:seat:{seatId} = userId, TTL 600
  -> WebSocket "locked" broadcast

Confirm Page "결제하기"
  -> POST /api/v1/reservations/prepare
  -> ReservationService.prepareReservation()
  -> BookingService.assertOwnedSeatLocks(userId, showtimeId, requestedSeatIds)
      -> if any GET seatKey missing: 409 lock-expired message
      -> if any GET seatKey != userId: 409 other-user message
      -> if all owned: create/reuse pending reservation
  -> Toss widget requestPayment()

Toss success redirect
  -> Complete Page POST /api/v1/payments/confirm
  -> ReservationService.confirmAndCreateReservation()
      -> if payment already exists: return reservation detail
      -> assertOwnedSeatLocks() before Toss confirm
      -> TossPaymentsClient.confirmPayment()
      -> BookingService.consumeOwnedSeatLocks()
          -> if fail: Toss cancel compensation, no sold DB transition
      -> DB transaction: reservation CONFIRMED + payment DONE + seat_inventories sold
      -> WebSocket "sold" broadcast after commit
```

Diagram source: existing controllers/services and Phase 19 decisions. [VERIFIED: apps/api/src/modules/reservation/reservation.controller.ts; apps/api/src/modules/reservation/reservation.service.ts; 19-CONTEXT.md]

### Recommended Project Structure

```text
apps/api/src/modules/booking/
├── booking.service.ts                         # Add assert/consume helpers and Lua constants [VERIFIED: existing file]
├── providers/redis.provider.ts                # Extend InMemoryRedis eval emulation for new scripts [VERIFIED: existing file]
└── __tests__/
    ├── booking.service.spec.ts                # Helper unit tests [VERIFIED: existing file]
    └── booking.service.integration.spec.ts    # Real Valkey helper tests [VERIFIED: existing file]

apps/api/src/modules/reservation/
├── reservation.service.ts                     # Wire prepare/confirm enforcement [VERIFIED: existing file]
└── reservation.service.spec.ts                # Prepare/confirm lock ownership tests [VERIFIED: existing file]

apps/web/app/booking/[performanceId]/
├── confirm/page.tsx                           # Surface prepare 409 and stop Toss [VERIFIED: existing file]
└── complete/page.tsx                          # Surface confirm 409 as failed state [VERIFIED: existing file]

apps/web/e2e/
└── toss-payment.spec.ts                       # Add lock-expired/other-user payment path regression [VERIFIED: existing file]
```

### Pattern 1: `BookingService` Owns Valkey Lock Semantics

**What:** Put all ownership key construction, Lua scripts, and structured failure reasons in `BookingService`; `ReservationService` should call helper methods rather than building Redis keys directly. [VERIFIED: current `BookingService` already owns lock/unlock/status key construction]

**When to use:** Any reservation or payment path that needs to know whether a seat is still actively held by a user. [VERIFIED: 19-CONTEXT.md D-05/D-09/D-10]

**Example:**

```typescript
// Source: Valkey EVAL KEYS contract + existing BookingService hash-tag style.
// [CITED: https://valkey.io/commands/eval/]
// [VERIFIED: apps/api/src/modules/booking/booking.service.ts]

type SeatLockFailureReason = 'MISSING' | 'OTHER_OWNER';

interface SeatLockCheckResult {
  ok: boolean;
  reason?: SeatLockFailureReason;
  seatId?: string;
}

function seatLockKeys(showtimeId: string, userId: string, seatIds: string[]) {
  return {
    userSeatsKey: `{${showtimeId}}:user-seats:${userId}`,
    lockedSeatsKey: `{${showtimeId}}:locked-seats`,
    seatKeys: seatIds.map((seatId) => `{${showtimeId}}:seat:${seatId}`),
  };
}
```

### Pattern 2: Assert-Only Before Side Effects, Consume After Toss Confirm

**What:** `prepareReservation()` and the pre-Toss part of `confirmAndCreateReservation()` should only assert active ownership; the post-Toss step should atomically assert and consume locks. [VERIFIED: 19-CONTEXT.md D-09/D-10/D-11]

**When to use:** Prepare and pre-confirm should not delete locks because the user still needs the seats while Toss widget is open; post-confirm should consume exactly the confirmed seats. [VERIFIED: 19-CONTEXT.md D-10/D-12]

**Example:**

```typescript
// Source: recommended reservation service ordering from Phase 19 decisions.
// [VERIFIED: .planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md]

await this.bookingService.assertOwnedSeatLocks(userId, dto.showtimeId, dto.seats.map((s) => s.seatId));
const pending = await this.createPendingReservation(dto, userId);

// confirm
if (existingPayment) return this.getReservationDetail(existingPayment.reservationId, userId);
const pendingReservation = await this.findPendingReservation(dto.orderId, userId);
await this.bookingService.assertOwnedSeatLocks(userId, pendingReservation.showtimeId, seatIds);
const tossResponse = await this.tossClient.confirmPayment({ paymentKey, orderId, amount });
try {
  await this.bookingService.consumeOwnedSeatLocks(userId, pendingReservation.showtimeId, seatIds);
  await this.markReservationConfirmedAndSeatsSold(...);
} catch (error) {
  await this.tossClient.cancelPayment(tossResponse.paymentKey, '좌석 점유 만료로 인한 자동 취소');
  throw error;
}
```

### Pattern 3: Lua Receives Every Seat Key Through `KEYS`

**What:** For multi-seat validation, compute `KEYS = [userSeatsKey, lockedSeatsKey, ...seatLockKeys]` and `ARGV = [userId, ...seatIds]`; do not generate per-seat lock keys inside Lua from a prefix. [CITED: https://valkey.io/commands/eval/]

**When to use:** Any Lua script that touches more than one seat key, especially when `seatIds` are dynamic. [VERIFIED: 19-CONTEXT.md D-03]

**Example:**

```typescript
// Source: Valkey EVAL contract; adapted to Phase 19 consume helper.
// [CITED: https://valkey.io/commands/eval/]

const CONSUME_OWNED_SEAT_LOCKS_LUA = `
local userId = ARGV[1]
for i = 3, #KEYS do
  local owner = redis.call('GET', KEYS[i])
  local seatId = ARGV[i - 1]
  if not owner then
    return {0, 'MISSING', seatId}
  end
  if owner ~= userId then
    return {0, 'OTHER_OWNER', seatId}
  end
end
for i = 3, #KEYS do
  local seatId = ARGV[i - 1]
  redis.call('DEL', KEYS[i])
  redis.call('SREM', KEYS[1], seatId)
  redis.call('SREM', KEYS[2], seatId)
end
return {1}
`;

const result = await this.redis.eval(
  CONSUME_OWNED_SEAT_LOCKS_LUA,
  2 + seatIds.length,
  userSeatsKey,
  lockedSeatsKey,
  ...seatKeys,
  userId,
  ...seatIds,
);
```

### Pattern 4: Conflict Exceptions Carry User-Facing Korean Messages

**What:** Map missing/released/expired lock to `좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.` and other-owner lock to `이미 다른 사용자가 선택한 좌석입니다.` with `ConflictException`. [VERIFIED: 19-CONTEXT.md D-14; CITED: NestJS exception docs]

**When to use:** Prepare and confirm ownership failures; do not collapse these into generic `500` or Toss errors. [VERIFIED: 19-CONTEXT.md D-08/D-16]

**Example:**

```typescript
// Source: NestJS built-in exceptions and Phase 19 UX copy.
// [CITED: https://docs.nestjs.com/exception-filters]
// [VERIFIED: 19-CONTEXT.md D-14]

function throwSeatLockConflict(reason: SeatLockFailureReason): never {
  if (reason === 'OTHER_OWNER') {
    throw new ConflictException('이미 다른 사용자가 선택한 좌석입니다.');
  }
  throw new ConflictException('좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.');
}
```

### Anti-Patterns to Avoid

- **Returning idempotent pending reservations before lock validation:** This is explicitly rejected because stale pending rows can outlive Valkey TTL. [VERIFIED: 19-CONTEXT.md D-06; apps/api/src/modules/reservation/reservation.service.ts:85-93]
- **Calling Toss before pre-check:** This charges users even when the server can already know the locks are invalid. [VERIFIED: 19-CONTEXT.md D-09; apps/api/src/modules/reservation/reservation.service.ts:188-193]
- **Deleting locks with `unlockAllSeats()` after confirm:** This may delete unrelated locks from the same user/showtime. [VERIFIED: 19-CONTEXT.md D-12]
- **Trusting `locked-seats` set membership:** It is a stale index; the per-seat lock key value is authoritative. [VERIFIED: 19-CONTEXT.md D-04; apps/api/src/modules/booking/booking.service.ts:77-96]
- **Generating dynamic key names inside Lua:** Official docs say scripts should only access key names passed as key arguments. [CITED: https://valkey.io/commands/eval/]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-seat lock ownership | TypeScript loop of `GET` calls followed by `DEL` calls | One Valkey Lua script through ioredis `eval()` | Lua is atomic; loops in TypeScript create TOCTOU windows. [CITED: Redis Lua scripting docs] |
| Lock release safety | Blind `DEL seatKey` | Compare stored owner before delete | Safe release requires value comparison to avoid deleting another client's lock. [CITED: Redis distributed locks docs] |
| Cluster slot compatibility | Programmatic key construction inside Lua | Explicit `KEYS` list with `{showtimeId}` hash tag | Valkey EVAL docs require accessed keys to be passed explicitly; cluster multi-key operations require same slot. [CITED: Valkey EVAL docs; CITED: Valkey cluster tutorial] |
| Payment compensation | New custom retry/refund state machine | Existing `TossPaymentsClient.cancelPayment()` path | Existing code already cancels Toss after DB failure; Phase 19 only adds a new post-confirm failure source. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:250-267] |
| Lock failure UI parsing | Custom response parser | Existing `apiClient` message extraction | `apiClient` already reads server `message`, toasts it, and throws `ApiClientError`. [VERIFIED: apps/web/lib/api-client.ts:108-127] |
| Real Valkey test harness | A new external service dependency | Existing `testcontainers` + `valkey/valkey:8` pattern | Current integration tests already boot Valkey with testcontainers. [VERIFIED: apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts] |

**Key insight:** This phase is not about inventing a new lock protocol; it is about moving the existing Valkey ownership contract into the two server-side trust boundaries where money and sold seats are finalized. [VERIFIED: 19-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Prepare Idempotency Becomes a Lock Bypass

**What goes wrong:** Existing `orderId` returns a pending reservation without checking current Valkey locks. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:85-93]
**Why it happens:** Database idempotency is treated as proof of seat ownership, but Valkey TTL may have expired or ownership may have changed. [VERIFIED: 19-CONTEXT.md D-06]
**How to avoid:** For existing pending reservations, fetch the reservation seats and assert active ownership before returning success. [VERIFIED: 19-CONTEXT.md D-06]
**Warning signs:** Tests only cover new reservation creation and not "existing pending order after lock expiry." [VERIFIED: apps/api/src/modules/reservation/reservation.service.spec.ts]

### Pitfall 2: Confirm Charges Before Detecting Invalid Locks

**What goes wrong:** Toss confirm succeeds, then the server discovers the seat lock is missing. [VERIFIED: current confirm order in apps/api/src/modules/reservation/reservation.service.ts:188-249]
**Why it happens:** `confirmPayment()` is called before any lock check. [VERIFIED: apps/api/src/modules/reservation/reservation.service.ts:188-193]
**How to avoid:** Pre-check locks before Toss confirm, then re-check and consume atomically after Toss confirm before DB sold transition. [VERIFIED: 19-CONTEXT.md D-09/D-10]
**Warning signs:** Unit test expects `tossClient.confirmPayment` to be called even when `bookingService` reports invalid locks. [VERIFIED: planned test gap]

### Pitfall 3: Lock Consume Deletes Unrelated Seats

**What goes wrong:** A broad unlock cleans every same-showtime lock for the user, including seats selected in another tab or retry edge case. [VERIFIED: 19-CONTEXT.md D-12]
**Why it happens:** `unlockAllSeats(userId, showtimeId)` iterates the user set and deletes all owned seats. [VERIFIED: apps/api/src/modules/booking/booking.service.ts:198-225]
**How to avoid:** Consume only `reservation_seats` for the confirmed reservation. [VERIFIED: 19-CONTEXT.md D-12]
**Warning signs:** Successful confirm test still expects `unlockAllSeats(userId, showtimeId)`. [VERIFIED: apps/api/src/modules/reservation/reservation.service.spec.ts:395-403]

### Pitfall 4: `locked-seats` Index Is Treated as Truth

**What goes wrong:** Stale set members are accepted as valid locks. [VERIFIED: 19-CONTEXT.md D-04]
**Why it happens:** `locked-seats` is easier to query than every per-seat key, but existing status code already has to clean stale entries. [VERIFIED: apps/api/src/modules/booking/booking.service.ts:77-96]
**How to avoid:** For requested seats, always `GET {showtimeId}:seat:{seatId}` and compare the value with `userId`. [VERIFIED: 19-CONTEXT.md D-01/D-04]
**Warning signs:** Tests seed only `locked-seats` without per-seat keys and still pass. [VERIFIED: planned test gap]

### Pitfall 5: Lua Works Standalone But Breaks in Cluster Mode

**What goes wrong:** A script accesses dynamically generated keys or keys across slots, causing cluster failures. [CITED: Valkey EVAL docs; CITED: Valkey cluster tutorial]
**Why it happens:** Standalone Valkey does not expose every cluster slot constraint. [VERIFIED: Phase 14 CROSSSLOT history in .planning/STATE.md]
**How to avoid:** Pass all accessed keys as `KEYS` and keep every key in the same `{showtimeId}` hash tag. [VERIFIED: 19-CONTEXT.md D-03; CITED: Redis CLUSTER KEYSLOT docs]
**Warning signs:** Lua script receives a prefix in ARGV and concatenates seat IDs to access keys. [VERIFIED: current `GET_VALID_LOCKED_SEATS_LUA` uses prefix for status only; Phase 19 multi-seat validation should avoid this pattern]

### Pitfall 6: Compensation Is Not Tested At the New Failure Point

**What goes wrong:** Toss confirm succeeds, lock consume fails, and the code returns an error without canceling the payment. [VERIFIED: 19-CONTEXT.md D-10]
**Why it happens:** Existing compensation tests target DB transaction failure, not post-confirm lock ownership failure. [VERIFIED: apps/api/src/modules/reservation/reservation.service.spec.ts]
**How to avoid:** Add a confirm test where pre-check passes, Toss confirm returns `DONE`, consume fails, DB sold transition does not run, and `cancelPayment()` is called. [VERIFIED: 19-CONTEXT.md D-18/D-20]
**Warning signs:** `cancelPayment` mock call count is not asserted for lock consume failure. [VERIFIED: planned test gap]

### Pitfall 7: Complete Page Recovery Shows False Success

**What goes wrong:** Complete page catches confirm failure, recovery fetch finds no confirmed payment but UI never shows a clear failed state. [VERIFIED: apps/web/app/booking/[performanceId]/complete/page.tsx:80-149]
**Why it happens:** Existing UI mostly shows skeleton/fallback unless `bookingData` exists. [VERIFIED: apps/web/app/booking/[performanceId]/complete/page.tsx:130-149]
**How to avoid:** Add explicit lock-failure state and assert it does not render `BookingComplete`. [VERIFIED: 19-CONTEXT.md D-16]
**Warning signs:** E2E only asserts happy path confirm intercept and success copy. [VERIFIED: apps/web/e2e/toss-payment.spec.ts]

## Code Examples

Verified patterns from official sources and local code:

### Multi-Seat Consume Lua Shape

```typescript
// Source: Valkey EVAL docs require all accessed keys in KEYS.
// Source: Redis lock docs require compare-before-delete ownership safety.
// [CITED: https://valkey.io/commands/eval/]
// [CITED: https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/]

const CONSUME_OWNED_SEAT_LOCKS_LUA = `
local userId = ARGV[1]
for i = 3, #KEYS do
  local owner = redis.call('GET', KEYS[i])
  local seatId = ARGV[i - 1]
  if not owner then
    return {0, 'MISSING', seatId}
  end
  if owner ~= userId then
    return {0, 'OTHER_OWNER', seatId}
  end
end
for i = 3, #KEYS do
  local seatId = ARGV[i - 1]
  redis.call('DEL', KEYS[i])
  redis.call('SREM', KEYS[1], seatId)
  redis.call('SREM', KEYS[2], seatId)
end
return {1}
`;
```

### Reservation Confirm Ordering

```typescript
// Source: Phase 19 D-09/D-10/D-13 ordering.
// [VERIFIED: .planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md]

if (existingPayment) {
  return this.getReservationDetail(existingPayment.reservationId, userId);
}

const reservation = await this.findPendingReservationByOrder(dto.orderId, userId);
const seatIds = await this.findReservationSeatIds(reservation.id);

await this.bookingService.assertOwnedSeatLocks(userId, reservation.showtimeId, seatIds);

const tossResponse = await this.tossClient.confirmPayment({
  paymentKey: dto.paymentKey,
  orderId: dto.orderId,
  amount: dto.amount,
});

try {
  await this.bookingService.consumeOwnedSeatLocks(userId, reservation.showtimeId, seatIds);
  await this.confirmReservationAndMarkSeatsSold(reservation, tossResponse, seatIds);
} catch (error) {
  await this.tossClient.cancelPayment(tossResponse.paymentKey, '좌석 점유 만료로 인한 자동 취소');
  throw error;
}
```

### Real Valkey Integration Test Pattern

```typescript
// Source: existing testcontainers Valkey pattern.
// [VERIFIED: apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts]

container = await new GenericContainer('valkey/valkey:8-alpine')
  .withExposedPorts(6379)
  .start();

const redis = new IORedis({
  host: container.getHost(),
  port: container.getMappedPort(6379),
  maxRetriesPerRequest: 3,
});

const result = await redis.eval(
  CONSUME_OWNED_SEAT_LOCKS_LUA,
  2 + seatIds.length,
  userSeatsKey,
  lockedSeatsKey,
  ...seatKeys,
  userId,
  ...seatIds,
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upstash-style Redis usage | ioredis flat `eval(script, numKeys, ...keysAndArgs)` | Phase 7 Valkey migration [VERIFIED: .planning/ROADMAP.md; apps/api/src/modules/booking/providers/redis.provider.ts] | New scripts must use ioredis signature and InMemoryRedis must emulate that signature. [VERIFIED: apps/api/src/modules/booking/providers/redis.provider.ts:199-228] |
| Standalone-only Lua smoke tests | Real Valkey + cluster-mode regression harness where needed | Phase 14 CROSSSLOT fix [VERIFIED: apps/api/test/sms-cluster-crossslot.integration.spec.ts] | Planner should reuse this pattern if it wants cluster-specific assurance for new scripts. |
| Client-selected seats trusted through payment | Server-side Valkey ownership enforcement at prepare and confirm | Phase 19 target [VERIFIED: .planning/v1.1-MILESTONE-AUDIT.md; 19-CONTEXT.md] | Prevents active duplicate booking and stale client state from becoming sold seats. |
| Broad post-confirm cleanup | Consume only confirmed reservation seats | Phase 19 target [VERIFIED: 19-CONTEXT.md D-12] | Avoids deleting unrelated same-showtime locks. |

**Deprecated/outdated:**

- `@tosspayments/sdk` and `@tosspayments/payment-sdk` are not the project standard; use existing `@tosspayments/tosspayments-sdk`. [VERIFIED: AGENTS stack section; apps/web/package.json]
- Client-side Zustand selected seats are not a trust source for reservation/payment. [VERIFIED: 19-CONTEXT.md D-01/D-05]
- `locked-seats` set membership is not proof of ownership. [VERIFIED: 19-CONTEXT.md D-04]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No `[ASSUMED]` claims recorded. | — | All recommendations are grounded in CONTEXT.md, local code, official docs, npm registry, or explicit command output. |

## Open Questions (RESOLVED)

1. **Should `TossPaymentsClient.cancelPayment()` add a Toss idempotency key for automatic compensation?**
   - What we know: Toss docs state payment cancel accepts an idempotency key header to avoid duplicate cancel processing. [CITED: https://docs.tosspayments.com/reference#cancel-payment]
   - What's unclear: Existing client has no idempotency-header abstraction, and CONTEXT says preserve existing compensation behavior rather than add provider behavior. [VERIFIED: apps/api/src/modules/payment/toss-payments.client.ts; 19-CONTEXT.md]
   - RESOLVED: Phase 19 does not block on adding Toss provider API idempotency behavior. Keep the current compensation cancel path unless a scoped `cancelPayment(paymentKey, reason, idempotencyKey?)` implementation is already present in an execution plan; if omitted, track the Toss cancel idempotency key as residual payment-compensation hardening rather than a Phase 19 blocker. [VERIFIED: 19-CONTEXT.md D-10/D-23]

2. **Should DB sold transition be hardened with `onConflictDoUpdate()` or row-status guard?**
   - What we know: `seat_inventories` has a unique index on `(showtimeId, seatId)`, and Drizzle supports `onConflictDoUpdate`. [VERIFIED: apps/api/src/database/schema/seat-inventories.ts:15-17; VERIFIED: Context7 /drizzle-team/drizzle-orm-docs]
   - What's unclear: Phase 19 can close the audit gap without a schema change; adding an upsert/status guard improves duplicate-booking defense but broadens DB logic. [VERIFIED: 19-CONTEXT.md D-23]
   - RESOLVED: Do not add a new table or schema. If a local transaction guard around the existing `seat_inventories` write logic is already planned, keep it local and covered by a duplicate sold conflict test; otherwise track DB sold transition duplicate-booking hardening as residual work outside the minimum ownership enforcement contract. [VERIFIED: 19-CONTEXT.md D-23]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | pnpm/Vitest/Next/Nest tooling | yes [VERIFIED: node --version] | v24.13.0 [VERIFIED: node --version] | Project engine is `>=22`; planner should avoid Node 24-only APIs because stack standard is Node 22 LTS. [VERIFIED: package.json; AGENTS stack section] |
| pnpm | Workspace scripts | yes [VERIFIED: pnpm --version] | 10.28.1 [VERIFIED: pnpm --version] | none needed |
| npm | Registry version verification | yes [VERIFIED: npm --version] | 11.6.2 [VERIFIED: npm --version] | none needed |
| Docker | testcontainers Valkey integration tests | yes [VERIFIED: docker info] | 29.1.3 [VERIFIED: docker info] | If unavailable in CI, mark Valkey integration tests as blocking rather than silently skipping. [VERIFIED: apps/api/vitest.integration.config.ts] |
| `valkey/valkey:8` Docker image | Cluster/standalone Valkey tests | yes [VERIFIED: docker image ls] | local image present, created ~3 weeks ago [VERIFIED: docker image ls] | Pull image during testcontainers startup. |
| `valkey/valkey:8-alpine` Docker image | Existing booking integration tests | yes [VERIFIED: docker image ls] | local image present, created ~3 weeks ago [VERIFIED: docker image ls] | Use `valkey/valkey:8` if Alpine image fails. |
| `valkey-cli` | Manual cluster debugging | no [VERIFIED: command -v valkey-cli] | — | Use ioredis/testcontainers calls as existing tests do. [VERIFIED: apps/api/test/sms-cluster-crossslot.integration.spec.ts] |
| `redis-cli` | Manual cluster debugging | no [VERIFIED: command -v redis-cli] | — | Use ioredis/testcontainers calls as existing tests do. [VERIFIED: apps/api/test/sms-cluster-crossslot.integration.spec.ts] |

**Missing dependencies with no fallback:** None. [VERIFIED: environment audit]

**Missing dependencies with fallback:**
- `valkey-cli` and `redis-cli` are absent, but Phase 19 tests can use ioredis through testcontainers, matching existing project patterns. [VERIFIED: command -v checks; apps/api/test/sms-cluster-crossslot.integration.spec.ts]

## Validation Architecture

`.planning/config.json` has `workflow.nyquist_validation: true`; include this section and create concrete validation requirements. [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| API unit framework | Vitest 3.2.4 installed [VERIFIED: pnpm list] |
| API unit config | `apps/api/vitest.config.ts`, node environment, excludes `*.integration.spec.ts` [VERIFIED: apps/api/vitest.config.ts] |
| API integration framework | Vitest + testcontainers 11.14.0 [VERIFIED: pnpm list] |
| API integration config | `apps/api/vitest.integration.config.ts`, includes `test/**/*.integration.spec.ts` and `src/**/*.integration.spec.ts` [VERIFIED: apps/api/vitest.integration.config.ts] |
| Web unit framework | Vitest + jsdom + React Testing Library [VERIFIED: apps/web/vitest.config.ts; apps/web/package.json] |
| E2E framework | Playwright 1.59.1 [VERIFIED: pnpm list] |
| E2E config | `apps/web/playwright.config.ts`, base URL `http://localhost:3000`, web server command `pnpm --filter @grabit/web dev` [VERIFIED: apps/web/playwright.config.ts] |
| Quick API command | `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider` [VERIFIED: package scripts + vitest file names] |
| Quick web command | `pnpm --filter @grabit/web test -- seat-map-viewer use-booking` [VERIFIED: package scripts + existing test names] |
| Integration command | `pnpm --filter @grabit/api test:integration -- booking.service.integration` [VERIFIED: apps/api/package.json; existing file] |
| E2E command | `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` [VERIFIED: apps/web/package.json] |
| Full suite command | `pnpm test` plus `pnpm --filter @grabit/api test:integration` [VERIFIED: package.json + apps/api/package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| VALK-03 | `assertOwnedSeatLocks()` returns success only when every `{showtimeId}:seat:{seatId}` value equals `userId`. | unit | `pnpm --filter @grabit/api test -- booking.service` | Existing file, Wave 0 additions needed [VERIFIED: apps/api/src/modules/booking/__tests__/booking.service.spec.ts] |
| VALK-03 | `consumeOwnedSeatLocks()` deletes only requested owned locks and removes corresponding `user-seats` and `locked-seats` index members. | unit + in-memory | `pnpm --filter @grabit/api test -- booking.service redis.provider` | Existing files, Wave 0 additions needed [VERIFIED: booking.service.spec.ts; redis.provider.spec.ts] |
| VALK-03 | Consume script works against real Valkey with all-owned, missing, other-owner, and stale-index cases. | integration | `pnpm --filter @grabit/api test:integration -- booking.service.integration` | Existing file, Wave 0 additions needed [VERIFIED: apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts] |
| VALK-03 | Prepare rejects missing/expired/released/other-user locks and does not create pending reservation. | service unit | `pnpm --filter @grabit/api test -- reservation.service` | Existing file, Wave 0 additions needed [VERIFIED: apps/api/src/modules/reservation/reservation.service.spec.ts] |
| VALK-03 | Prepare idempotency cannot bypass lock ownership for an existing pending order. | service unit | `pnpm --filter @grabit/api test -- reservation.service` | Existing file, Wave 0 additions needed [VERIFIED: 19-CONTEXT.md D-06] |
| VALK-03 | Confirm pre-check rejects invalid locks before Toss confirm. | service unit | `pnpm --filter @grabit/api test -- reservation.service` | Existing file, Wave 0 additions needed [VERIFIED: 19-CONTEXT.md D-09] |
| VALK-03 | Confirm post-Toss consume failure calls Toss cancel and does not mark seats sold. | service unit | `pnpm --filter @grabit/api test -- reservation.service` | Existing file, Wave 0 additions needed [VERIFIED: 19-CONTEXT.md D-10] |
| UX-02 | Returning to seat selection after lock failure preserves stage-direction viewer behavior. | web unit regression | `pnpm --filter @grabit/web test -- seat-map-viewer` | Existing file covers stage overlay [VERIFIED: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx] |
| UX-03 | Lock-failure flow preserves selected-seat tier/price display shape. | web unit or E2E | `pnpm --filter @grabit/web test -- seat-selection-panel` | Existing file covers seat rows/price [VERIFIED: apps/web/components/booking/__tests__/seat-selection-panel.test.tsx] |
| UX-04 | Lock-failure cleanup does not break selected/locked transition behavior. | web unit regression | `pnpm --filter @grabit/web test -- seat-map-viewer` | Existing file covers transition behavior [VERIFIED: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx] |
| UX-05 | Viewer minimap remains covered by existing regression suite. | web unit regression | `pnpm --filter @grabit/web test -- seat-map-viewer` | Existing file covers minimap mount behavior [VERIFIED: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx] |
| UX-06 | Mobile lock-failure CTA/error copy does not block normal touch target flow. | E2E or responsive unit | `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` plus optional mobile project if planner adds one | Existing E2E file, Wave 0 additions needed [VERIFIED: apps/web/e2e/toss-payment.spec.ts] |

### Sampling Rate

- **Per task commit:** Run the narrow unit command for touched tier, for example `pnpm --filter @grabit/api test -- reservation.service` after reservation edits. [VERIFIED: package scripts]
- **Per wave merge:** Run `pnpm --filter @grabit/api test && pnpm --filter @grabit/web test`. [VERIFIED: package scripts]
- **Phase gate:** Run `pnpm --filter @grabit/api test`, `pnpm --filter @grabit/api test:integration -- booking.service.integration`, and `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` before `$gsd-verify-work`. [VERIFIED: package scripts + validation requirements]

### Wave 0 Gaps

- [ ] `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — add assert/consume helper unit tests for all-owned, missing, other-owner, stale index, and unrelated lock preservation. [VERIFIED: file exists]
- [ ] `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — add InMemoryRedis `eval()` dispatch/emulation for new assert/consume Lua scripts. [VERIFIED: file exists]
- [ ] `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` — add real Valkey script tests for new helpers. [VERIFIED: file exists]
- [ ] `apps/api/src/modules/reservation/reservation.service.spec.ts` — add prepare and confirm ownership enforcement tests. [VERIFIED: file exists]
- [ ] `apps/web/e2e/toss-payment.spec.ts` — add prepare/confirm lock failure user-path regressions using route interception. [VERIFIED: file exists]
- [ ] Optional `apps/web/app/booking/[performanceId]/complete` component test or E2E assertion — add explicit failed confirmation state if implementation changes UI. [VERIFIED: complete page currently lacks explicit error state]

## Security Domain

Security enforcement is enabled by default because `.planning/config.json` does not disable it and user context explicitly requires threat model coverage. [VERIFIED: .planning/config.json; user prompt]

### Applicable ASVS Categories

OWASP ASVS 5.0.0 is the current stable ASVS version per OWASP project page; the table keeps the GSD template's legacy V2/V3/V4/V5/V6 grouping for planner compatibility. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Use authenticated `req.user.id`; never accept `userId` from client payload. [VERIFIED: apps/api/src/modules/reservation/reservation.controller.ts] |
| V3 Session Management | yes | Existing AuthGuard/session refresh remains the user identity source; Phase 19 should not add client lock tokens. [VERIFIED: 19-CONTEXT.md D-02; apps/web/lib/api-client.ts] |
| V4 Access Control | yes | Seat lock ownership is an object-level authorization check: `GET lockKey === authenticated userId`. [VERIFIED: 19-CONTEXT.md D-01] |
| V5 Input Validation | yes | Keep zod DTO validation for prepare/confirm and validate server-side ownership independent of DTO shape. [VERIFIED: packages/shared/src/schemas/booking.schema.ts] |
| V6 Cryptography | limited | No new cryptography; do not invent lock tokens or hashes. [VERIFIED: 19-CONTEXT.md D-02] |

### Known Threat Patterns for Phase 19

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client sends seats without owning locks | Tampering / Elevation of privilege | `prepareReservation()` and `confirmAndCreateReservation()` assert Valkey per-seat owner equals authenticated `userId`. [VERIFIED: 19-CONTEXT.md D-05/D-09] |
| Expired/released lock becomes confirmed reservation | Tampering | Missing per-seat key returns `409` lock-expired copy and blocks pending/sold transition. [VERIFIED: 19-CONTEXT.md D-14] |
| Other-user lock is confirmed by attacker | Elevation of privilege | Other owner returns `409` other-user copy; no Toss call pre-confirm and no DB sold update post-confirm. [VERIFIED: 19-CONTEXT.md D-09/D-14] |
| Duplicate booking under concurrency | Tampering / Repudiation | Atomic consume before DB sold transition plus existing `seat_inventories` unique `(showtimeId, seatId)` index; planner should add duplicate sold conflict test if touching DB write logic. [VERIFIED: apps/api/src/database/schema/seat-inventories.ts; 19-CONTEXT.md D-10] |
| Valkey outage/fail-open behavior | Denial of service / Tampering | Fail closed: if ownership cannot be verified, reject reservation/payment; preserve production hard-fail for missing Redis URL. [VERIFIED: 19-CONTEXT.md D-24; apps/api/src/modules/booking/providers/redis.provider.ts:358-368] |
| Payment confirmed but lock consume fails | Repudiation / Tampering | Run Toss cancel compensation and do not mark seats sold. [VERIFIED: 19-CONTEXT.md D-10; apps/api/src/modules/reservation/reservation.service.ts:250-267] |
| Stale `locked-seats` index treated as truth | Tampering | Ignore index for ownership; per-seat lock key is authoritative. [VERIFIED: 19-CONTEXT.md D-04] |
| False success on complete page after confirm rejection | Repudiation | Explicit failed confirmation state; recovery only for already confirmed orders. [VERIFIED: 19-CONTEXT.md D-16] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/19-seat-lock-ownership-enforcement/19-CONTEXT.md` — locked implementation decisions, test contract, scope guardrails. [VERIFIED: file read]
- `.planning/REQUIREMENTS.md` — VALK-03 and UX-02..UX-06 requirement definitions and traceability. [VERIFIED: file read]
- `.planning/ROADMAP.md` — Phase 19 goal, dependency, success criteria. [VERIFIED: rg + file read]
- `.planning/v1.1-MILESTONE-AUDIT.md` — audit gap: reservation/payment trusts client-provided seats. [VERIFIED: rg]
- `apps/api/src/modules/booking/booking.service.ts` — current lock key scheme, Lua scripts, `unlockAllSeats()`, stale index cleanup. [VERIFIED: file read]
- `apps/api/src/modules/reservation/reservation.service.ts` — current prepare/confirm order and compensation path. [VERIFIED: file read]
- `apps/api/src/modules/booking/providers/redis.provider.ts` — ioredis provider, InMemoryRedis eval emulation, production Redis hard-fail. [VERIFIED: file read]
- `apps/web/app/booking/[performanceId]/confirm/page.tsx` and `complete/page.tsx` — current prepare-before-Toss and confirm-after-Toss UI flow. [VERIFIED: file read]
- Valkey EVAL docs — `EVAL script numkeys [key...] [arg...]` and explicit-key requirement. [CITED: https://valkey.io/commands/eval/]
- Redis Lua scripting docs — atomic execution and parameterization guidance. [CITED: https://redis.io/docs/latest/develop/programmability/eval-intro/]
- Redis distributed locks docs — compare-value-before-delete safe release pattern. [CITED: https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/]
- Toss Payments API docs — confirm and cancel endpoints, cancel idempotency note. [CITED: https://docs.tosspayments.com/reference]
- npm registry — current versions and publish metadata for ioredis, NestJS, Drizzle, Vitest, Playwright, Toss SDK. [VERIFIED: npm view]

### Secondary (MEDIUM confidence)

- Context7 `/redis/ioredis` — ioredis `eval` and `defineCommand` Lua docs. [VERIFIED: ctx7 CLI]
- Context7 `/nestjs/docs.nestjs.com` — NestJS built-in exception behavior. [VERIFIED: ctx7 CLI]
- Context7 `/drizzle-team/drizzle-orm-docs` — `onConflictDoUpdate()` upsert examples. [VERIFIED: ctx7 CLI]
- `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-RESEARCH.md` and `apps/api/test/sms-cluster-crossslot.integration.spec.ts` — local cluster-mode test pattern. [VERIFIED: file read]

### Tertiary (LOW confidence)

- None. [VERIFIED: sources above]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all recommended libraries are already installed and versions were verified with `pnpm list` and `npm view`. [VERIFIED: pnpm list + npm registry]
- Architecture: HIGH — enforcement points are explicitly locked in CONTEXT.md and visible in current `BookingService`/`ReservationService`. [VERIFIED: 19-CONTEXT.md + codebase]
- Pitfalls: HIGH — each pitfall maps to an existing code path, locked decision, or official Valkey/Redis/Toss documentation. [VERIFIED: codebase + cited docs]
- Validation: HIGH — current test framework/config files exist; listed Wave 0 gaps are concrete file additions or updates. [VERIFIED: vitest/playwright configs + test files]
- Security: HIGH for lock ownership and fail-closed controls; MEDIUM for optional Toss cancel idempotency because existing project code does not yet expose that header. [VERIFIED: codebase + Toss docs]

**Research date:** 2026-04-29 [VERIFIED: system date]
**Valid until:** 2026-05-29 for codebase/phase planning; re-check npm registry and Toss docs if planning starts after that date. [VERIFIED: npm registry dates are current as of research date]
