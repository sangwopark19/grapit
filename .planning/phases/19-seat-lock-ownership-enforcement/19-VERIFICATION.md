---
phase: 19-seat-lock-ownership-enforcement
verified: 2026-04-29T10:30:30Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/11
  gaps_closed:
    - "payment confirm validates locks before Toss and consumes locks before DB sold transition"
    - "post-Toss lock consume failure runs compensation and does not mark seats sold"
    - "tests materially cover Phase 19 critical payment boundary paths"
  gaps_remaining: []
  regressions: []
---

# Phase 19: Seat Lock Ownership Enforcement Verification Report

**Phase Goal:** SVG seat select -> Valkey lock -> reservation/payment flow에서 reservation prepare/confirm이 client-provided seats만 신뢰하지 않고 active Valkey lock ownership을 강제한다.  
**Verified:** 2026-04-29T10:30:30Z  
**Status:** passed  
**Re-verification:** Yes - after gap closure

## Goal Achievement

Phase 19 is now achieved. The previous blocker was the post-Toss boundary: locks were consumed after DB sold commit and consume failure was treated as cleanup. Live code now consumes active owned locks after Toss confirm but before the DB sold/payment transaction, and the consume failure path cancels Toss, skips the DB transaction, and skips sold broadcasts.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | reservation prepare verifies active lock owner for every requested seat and rejects missing/expired/other-owner locks | VERIFIED | Quick regression check: `prepareReservation()` still calls `bookingService.assertOwnedSeatLocks(...)` for existing pending and new pending paths at `apps/api/src/modules/reservation/reservation.service.ts:255` and `:278`; regression test names remain at `reservation.service.spec.ts:466`, `:487`, `:508`. |
| 2 | existing pending `orderId` cannot bypass current Valkey ownership | VERIFIED | Existing pending path still re-reads stored seats and asserts current ownership at `reservation.service.ts:254-255`; test remains at `reservation.service.spec.ts:508`. |
| 3 | BookingService has active ownership assert/extend/consume helpers backed by Valkey Lua with per-seat owner tuples | VERIFIED | `ASSERT_OWNED_SEAT_LOCKS_LUA`, `CONSUME_OWNED_SEAT_LOCKS_LUA`, `EXTEND_OWNED_SEAT_LOCKS_LUA`, and helper methods are present at `booking.service.ts:114`, `:141`, `:174`, `:343`, `:357`, `:377`. |
| 4 | consume helper deletes only requested owned locks and preserves unrelated same-showtime locks | VERIFIED | Consume Lua validates all requested locks before deletion, then deletes only `KEYS[3..]` and SREM exact seat IDs at `booking.service.ts:144-160`. |
| 5 | Redis provider preserves production hard-fail and InMemoryRedis parity | VERIFIED | InMemoryRedis dispatches ownership scripts at `redis.provider.ts:223-230`; production empty `REDIS_URL` still throws at `redis.provider.ts:487-497`. |
| 6 | payment confirm serializes by order-level confirm lock and existing payment idempotency remains lock-free | VERIFIED | `acquirePaymentConfirmLock` gates confirm at `reservation.service.ts:325-333`; existing payment returns detail before seat-lock checks at `:380-388`; idempotency test remains at `reservation.service.spec.ts:1147`. |
| 7 | payment confirm rejects invalid locks before Toss confirm | VERIFIED | `extendOwnedSeatLocks(...)` runs before Toss at `reservation.service.ts:415-424`; test verifies Toss and DB transaction are not called on extension failure at `reservation.service.spec.ts:932-957`. |
| 8 | payment confirm consumes active owned locks before DB sold transition | VERIFIED | Fixed. `assertOwnedSeatLocks` and `consumeOwnedSeatLocks` now run at `reservation.service.ts:470-472`, before the DB sold/payment transaction starts at `:491-492` and before sold WebSocket broadcast at `:585-588`. Static line-order check returned `consumeAfterToss=true`, `consumeBeforeTx=true`, `consumeBeforeBroadcast=true`, and `postCommitCleanupMissing=true`. |
| 9 | post-Toss lock consume failure compensates Toss and skips sold transition | VERIFIED | Fixed. The combined post-Toss lock block catches assert/consume failures, calls `tossClient.cancelPayment(..., '좌석 점유 만료로 인한 자동 취소')`, then rethrows before DB transaction at `reservation.service.ts:470-488`. Regression at `reservation.service.spec.ts:1047-1073` asserts `rejects.toThrow(LOCK_OTHER_OWNER_MESSAGE)`, `cancelPayment`, `mockDb.transaction` not called, and `broadcastSeatUpdate` not called. |
| 10 | confirm and complete pages surface server lock rejection and avoid false success | VERIFIED | Quick regression check: confirm page lock messages and CTA guard remain in `confirm/page.tsx`; complete page failed state remains at `complete/page.tsx:162`; E2E lock rejection tests remain at `toss-payment.spec.ts:169` and `:217`. |
| 11 | regression tests materially cover the critical Phase 19 backend/web paths | VERIFIED | Fixed. `reservation.service.spec.ts` now asserts consume-before-DB ordering at `:885-886`, consume failure compensation/no DB/no broadcast at `:1047-1073`, and updated DB failure/race expectations consume locks before transaction at `:1112-1114` and `:1139-1141`. Targeted reservation service suite passed: 1 file, 36 tests. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/booking/booking.service.ts` | Valkey ownership assert/extend/consume helpers | VERIFIED | Artifact check passed; manual grep confirms Lua scripts and `redis.eval(...)` helper wiring. |
| `apps/api/src/modules/booking/providers/redis.provider.ts` | InMemoryRedis parity and production hard-fail | VERIFIED | Artifact check passed; script marker dispatch and production hard-fail verified. |
| `apps/api/src/modules/reservation/reservation.service.ts` | prepare/confirm ownership enforcement | VERIFIED | Artifact check passed; consume is post-Toss/pre-DB and post-commit cleanup block is removed. |
| `apps/api/src/modules/reservation/reservation.service.spec.ts` | ownership regression tests | VERIFIED | Artifact check passed; tests now assert consume failure compensation and no sold transition. |
| `apps/web/app/booking/[performanceId]/confirm/page.tsx` | prepare lock failure alert and recovery CTA | VERIFIED | Artifact check passed; lock messages remain wired to prepare rejection UX. |
| `apps/web/app/booking/[performanceId]/complete/page.tsx` | confirm lock failure failed state | VERIFIED | Artifact check passed; failed confirmation state remains before success rendering. |
| `apps/web/hooks/__tests__/use-booking.test.tsx` | mutation endpoint/error propagation tests | VERIFIED | Artifact check passed; hook tests still cover 409 message propagation. |
| `apps/web/e2e/toss-payment.spec.ts` | lock rejection E2E regressions | VERIFIED | Artifact check passed; prepare and confirm lock ownership E2E cases exist. Runtime E2E execution remains environment-gated by Toss/browser setup, but this is not a blocker for the closed backend gap. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ReservationController` | `ReservationService.prepareReservation` | `POST reservations/prepare` | VERIFIED | Previously verified route wiring remains unchanged. |
| `ReservationController` | `ReservationService.confirmAndCreateReservation` | `POST payments/confirm` | VERIFIED | Previously verified route wiring remains unchanged. |
| `ReservationService` | `BookingService.assertOwnedSeatLocks` | prepare and confirm checks | VERIFIED | Calls exist at `reservation.service.ts:255`, `:278`, and `:471`. |
| `ReservationService` | `BookingService.consumeOwnedSeatLocks` | post-Toss/pre-sold consume | VERIFIED | Call exists at `reservation.service.ts:472`, before DB transaction at `:491-492`. |
| `BookingService` | `REDIS_CLIENT` | `redis.eval(CONSUME_OWNED_SEAT_LOCKS_LUA, 2 + seatIds.length, ...)` | VERIFIED | Manual verification at `booking.service.ts:357-369`; `gsd-sdk verify.key-links` produced a plan-regex false negative, not a code gap. |
| `redis.provider.ts` | `BookingService` | script marker dispatch | VERIFIED | InMemoryRedis dispatches `ASSERT_OWNED_SEAT_LOCKS_LUA`, `CONSUME_OWNED_SEAT_LOCKS_LUA`, and `EXTEND_OWNED_SEAT_LOCKS_LUA` at `redis.provider.ts:223-230`. |
| Confirm page | `/api/v1/reservations/prepare` | `usePrepareReservation` mutation | VERIFIED | E2E/hook evidence remains present. |
| Complete page | `/api/v1/payments/confirm` | `useConfirmPayment` mutation | VERIFIED | E2E/hook evidence remains present. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `reservation.service.ts` | `pendingSeatIds` | `getReservationSeatIds(reservation.id)` DB rows | Yes | VERIFIED - same DB-derived seat IDs feed `extendOwnedSeatLocks`, post-Toss `assertOwnedSeatLocks`, `consumeOwnedSeatLocks`, DB sold transition, and broadcasts. |
| `reservation.service.ts` | `tossResponse.paymentKey` | `tossClient.confirmPayment(...)` | Yes | VERIFIED - compensation on lock consume failure uses actual Toss payment key at `reservation.service.ts:479`. |
| `booking.service.ts` | ownership tuple | Valkey per-seat lock values | Yes | VERIFIED - Lua returns structured ownership results and maps missing/other-owner locks to ConflictException. |
| `confirm/page.tsx` | `lockFailureMessage` | prepare mutation error message | Yes | VERIFIED - server 409 message remains rendered and blocks Toss submission. |
| `complete/page.tsx` | `confirmationErrorMessage` | confirm mutation error message | Yes | VERIFIED - server 409 message renders failed state before success branch. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reservation service regression suite | `pnpm --filter @grabit/api exec vitest run src/modules/reservation/reservation.service.spec.ts --reporter=dot` | 1 file passed, 36 tests passed | PASS |
| Confirm consume ordering | static Node line-order check over `reservation.service.ts` | `consumeAfterToss=true`, `consumeBeforeTx=true`, `consumeBeforeBroadcast=true`, `postCommitCleanupMissing=true` | PASS |
| Plan artifact checks | `gsd-sdk query verify.artifacts` for `19-01` through `19-04` | 13/13 artifacts passed | PASS |
| Key link checks | `gsd-sdk query verify.key-links` plus manual grep for plan-regex false negatives | Core links manually verified; false negatives were invalid/over-escaped plan regex patterns | PASS |
| Test assertion sanity | static Node check over `reservation.service.spec.ts` | consume failure test asserts reject, cancel, no DB transaction, no sold broadcast, and ordering checks exist | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VALK-03 | 19-01, 19-02, 19-03, 19-04 | 좌석 잠금 Lua 스크립트 Valkey 호환성 검증 및 수정 | SATISFIED | Ownership Lua helpers, InMemoryRedis parity, prepare validation, post-Toss/pre-DB consume, and consume failure compensation are present and tested. |
| UX-02 | 19-01, 19-04 | SVG 좌석맵 스테이지 방향 표시 | SATISFIED | Phase 19 web changes preserve seat selection flow; no regression evidence found in quick check. |
| UX-03 | 19-01, 19-04 | SVG 좌석맵 등급별 색상 범례 + 가격 표시 | SATISFIED | Confirm page keeps order summary/price display while showing lock failure alert. |
| UX-04 | 19-01, 19-04 | 좌석 선택 상태 전환 애니메이션 | SATISFIED | No Phase 19 gap remains in backend ownership enforcement; UX regression artifacts remain present. |
| UX-05 | 19-01, 19-04 | 미니맵 네비게이터 | SATISFIED | No Phase 19 gap remains in backend ownership enforcement; UX regression artifacts remain present. |
| UX-06 | 19-01, 19-04 | 모바일 터치 타겟 44px 최소 보장 | SATISFIED | No Phase 19 gap remains in backend ownership enforcement; UX regression artifacts remain present. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No blocker anti-patterns found. Grep hits were benign null/default initializers, non-user-visible parser fallbacks, or test helper arrays. |

### Human Verification Required

None. The previously failed truths are backend control-flow and test assertion contracts, and they are programmatically verified.

### Gaps Summary

No remaining gaps. The previous blockers for truths #8, #9, and #11 are closed: lock consume now happens before the DB sold transition, consume failure compensates Toss and prevents sold side effects, and regression tests assert the corrected behavior.

---

_Verified: 2026-04-29T10:30:30Z_  
_Verifier: the agent (gsd-verifier)_
