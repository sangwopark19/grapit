# Phase 19: seat-lock-ownership-enforcement - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 19 closes the v1.1 audit gap where the booking flow accepts client-provided selected seats through reservation/payment without proving the user still owns the active Valkey seat locks.

This phase delivers a server-side ownership contract for the existing SVG seat select -> Valkey lock -> reservation prepare -> Toss payment -> payment confirm flow:

- `prepareReservation()` must reject requested seats that are not actively locked by the authenticated user.
- `confirmAndCreateReservation()` must not mark seats sold unless the pending reservation's seats are still actively owned by that user at confirm time.
- Lock validation must use the existing Valkey lock source of truth, not client state, local Zustand state, or `reservation_seats` alone.
- Regression coverage must include expired, released, and other-user locks across API/service tests and the payment E2E path.

In scope:
- Add focused BookingService lock ownership helpers, preferably Valkey Lua-backed, for multi-seat assert/consume behavior.
- Wire ownership checks into `ReservationService.prepareReservation()` and `ReservationService.confirmAndCreateReservation()`.
- Preserve existing lock key scheme using `{showtimeId}:seat:{seatId}`, `{showtimeId}:user-seats:{userId}`, and `{showtimeId}:locked-seats`.
- Preserve Toss compensation behavior when payment has already been confirmed but DB-side processing fails.
- Update frontend only where required to surface server lock-expired/ownership errors cleanly in the existing confirm/complete flow.

Out of scope:
- Queueing/waiting room, hold extension UX, seat resale, lottery tickets, or new payment-provider behavior.
- Full server-side derivation of seat tier/row/number from SVG or inventory metadata. This phase validates lock ownership for `seatId`; broader seat metadata trust is a separate fraud-hardening phase.
- Valkey production connectivity proof. Phase 20 owns Cloud Run -> Valkey runtime/cluster contract verification.
- Human/operator UAT gates for legal, SMS, or email. Phase 22 owns those.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition And Audit Gap

- `.planning/ROADMAP.md` — Phase 19 goal, requirements, success criteria, and dependency on Phase 18.
- `.planning/REQUIREMENTS.md` — Requirement traceability for `VALK-03` and `UX-02` through `UX-06`.
- `.planning/v1.1-MILESTONE-AUDIT.md` — Authoritative gap statement: reservation/payment currently trusts client-provided seats and does not require Valkey lock ownership.
- `.planning/PROJECT.md` — Core value and v1.1 context. The booking flow is the service's core value and cannot tolerate duplicate booking.

### Relevant Prior Decisions

- `.planning/phases/17-local-dev-health-indicator-fix-inmemoryredis-ping-capability/17-CONTEXT.md` — Production `REDIS_URL` hard-fail and `InMemoryRedis` local-only boundary.
- `.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/14-CONTEXT.md` — Valkey Cluster hash-tag/Lua single-source-of-truth pattern for multi-key scripts.
- `.planning/milestones/v1.0-phases/03-seat-map-real-time/03-RESEARCH.md` — Original seat lock key pattern and real-time seat state design.
- `.planning/milestones/v1.0-phases/04-booking-payment/04-UI-SPEC.md` — Existing payment failure, timer expiry, and seat lock expired UX copy.

### Affected Code

- `apps/api/src/modules/booking/booking.service.ts` — Existing lock/unlock/status Lua scripts, lock key scheme, and `unlockAllSeats()`.
- `apps/api/src/modules/booking/providers/redis.provider.ts` — `InMemoryRedis` script emulation and production `REDIS_URL` safety guard.
- `apps/api/src/modules/reservation/reservation.service.ts` — `prepareReservation()` and `confirmAndCreateReservation()` ownership enforcement points.
- `apps/api/src/modules/reservation/reservation.controller.ts` — `/reservations/prepare` and `/payments/confirm` API routes.
- `packages/shared/src/schemas/booking.schema.ts` — Current prepare/confirm payload contract.
- `packages/shared/src/types/booking.types.ts` — `SeatSelection`, `PrepareReservationRequest`, and `ConfirmPaymentRequest`.
- `apps/web/hooks/use-booking.ts` — Client mutations for prepare/confirm and seat lock APIs.
- `apps/web/app/booking/[performanceId]/confirm/page.tsx` — Prepare-before-Toss flow and lock failure UI surface.
- `apps/web/app/booking/[performanceId]/complete/page.tsx` — Confirm-after-Toss flow and recovery behavior.
- `apps/web/components/booking/booking-page.tsx` — Seat lock, unlock, restore, and timer-reset behavior.

### Tests To Preserve Or Extend

- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — Existing lock/unlock unit tests.
- `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` — Existing Valkey/testcontainers Lua round-trip tests.
- `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — In-memory Redis script emulation tests.
- `apps/api/src/modules/reservation/reservation.service.spec.ts` — Reservation prepare/confirm/cancel behavior tests.
- `apps/web/e2e/toss-payment.spec.ts` — Existing payment E2E/intercept fixture path.

### External Primary Docs

- `https://valkey.io/commands/eval/` — Valkey `EVAL` command contract: keys accessed by scripts must be passed explicitly, especially for clustered deployments.
- `https://valkey.io/topics/eval-intro/` — Valkey Lua scripting atomic execution model.
- `https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/` — Redis lock ownership pattern: safe release requires comparing the stored value before deleting.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `BookingService.lockSeat()` already writes `{showtimeId}:seat:{seatId}` with value `userId` and `EX 600`, using a Lua script and showtime hash tags.
- `BookingService.unlockSeat()` already performs compare-before-delete through Lua for a single seat. Phase 19 can generalize this pattern to multi-seat assert/consume.
- `BookingService.getSeatStatus()` already treats `locked-seats` as a stale-cleaned index and the per-seat lock key as the actual truth.
- `InMemoryRedis.evalLockSeat()` and `evalUnlockSeat()` mirror the production Lua behavior closely enough to extend for local/unit tests.
- `ReservationService.confirmAndCreateReservation()` already has a compensation cancel path after Toss confirm when DB processing fails. Lock consume failure after Toss should reuse that operational pattern.

### Established Patterns

- Redis/Valkey keys use `{showtimeId}` hash tags to keep related keys in one cluster slot.
- Business conflicts are surfaced with Nest `ConflictException` or `BadRequestException` and Korean user-facing messages.
- Payment success is only broadcast after DB transaction success.
- Frontend booking state uses Zustand and TanStack Query; prepare happens before opening Toss, confirm happens on complete page from URL params.
- Existing tests rely on focused service tests and selected E2E fixtures rather than a large full-stack local environment.

### Integration Points

- `prepareReservation()` currently calculates amount from DB tier prices but inserts `reservation_seats` directly from client-provided `dto.seats`.
- `confirmAndCreateReservation()` currently confirms Toss first, then marks seats sold based on `reservation_seats`, then calls `unlockAllSeats()` after the transaction.
- `/booking/my-locks/:showtimeId` restores selected seats after refresh. It filters ownership per seat, but its first TTL lookup currently uses `seat:${showtimeId}:${seatId}` instead of the hash-tagged `{showtimeId}:seat:{seatId}` key. This is adjacent and should only be fixed if the Phase 19 plan explicitly needs session restore expiry correctness.
- The confirm page catches prepare errors and already shows `err.message`; the planner should ensure lock-specific API messages survive `ApiClientError` formatting.
- The complete page has recovery logic for already-confirmed orders. It must not turn a lock-ownership failure into a false success.

</code_context>

<specifics>
## Specific Ideas

- Default discussion choices were selected automatically because Codex Default mode cannot call `request_user_input`. The choices favor the narrowest server-side fix that closes the audit gap without inventing new user-facing concepts.
- The safest confirm sequence is: pre-check locks -> Toss confirm -> atomic consume locks -> DB confirmed/sold transition -> sold broadcasts. If consume fails after Toss, use the existing compensation cancel path.
- The server should fail closed. If Redis/Valkey ownership cannot be verified, do not create pending reservations and do not mark seats sold.
- The implementation should avoid broad `unlockAllSeats()` after successful confirm because it can delete unrelated same-showtime locks held by the same user.

</specifics>

<deferred>
## Deferred Ideas

- **Seat metadata fraud-hardening:** Server-side derivation of seat tier/row/number/price from the canonical SVG or seat inventory source should be its own phase if needed.
- **Lock extension / hold refresh UX:** Extending a seat lock while the user is on confirm/payment could improve conversion but changes user-facing timer semantics and belongs outside this gap closure.
- **Queueing/waiting room:** Not required for early traffic and already out of scope for the project.
- **Valkey production runtime proof:** Phase 20 owns Cloud Run -> Valkey connectivity, cluster mode, idle reconnect, and Socket.IO pub/sub runtime evidence.

</deferred>

---

*Phase: 19-seat-lock-ownership-enforcement*
*Context gathered: 2026-04-29*
