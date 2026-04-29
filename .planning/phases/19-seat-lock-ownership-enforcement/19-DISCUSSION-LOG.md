# Phase 19: seat-lock-ownership-enforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 19-seat-lock-ownership-enforcement
**Areas discussed:** Ownership source of truth, Prepare enforcement, Confirm enforcement, Error and UX behavior, Test boundary

---

## Ownership Source Of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Existing Valkey owner value | Treat `GET {showtimeId}:seat:{seatId} === userId` as the canonical ownership proof. Reuses current lock API. | ✓ |
| Reservation-level token | Add a new token to prepare/confirm payloads and reservation records. More explicit but expands schema/client scope. | |
| Client selected state | Trust Zustand/client payload if seat status looked locked earlier. Does not close the audit gap. | |

**User's choice:** Auto-selected existing Valkey owner value.
**Notes:** Codex Default mode cannot call `request_user_input`, so the adapter fallback selected the narrowest option that satisfies the audit gap and existing architecture.

---

## Prepare Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Validate before pending reservation | Check every requested seat lock before creating or returning a pending reservation. | ✓ |
| Validate only on confirm | Less invasive, but lets users reach Toss for already-invalid seats. | |
| Validate opportunistically | Warn/log only. Does not enforce ownership. | |

**User's choice:** Auto-selected validate before pending reservation.
**Notes:** Existing `prepareReservation()` idempotency must not bypass this check for stale pending reservations.

---

## Confirm Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-check + post-Toss atomic consume | Check before Toss, then atomically consume locks before sold transition; compensate Toss if consume fails. | ✓ |
| Pre-check only | Avoids known-invalid charges but still permits expiry race during Toss confirmation. | |
| DB sold transition only | Current behavior. Does not prove active lock ownership. | |

**User's choice:** Auto-selected pre-check + post-Toss atomic consume.
**Notes:** This is the only option that satisfies "payment confirm does not mark sold without active lock ownership" under TTL race conditions.

---

## Error And UX Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Server message + stop Toss | Return 409 with specific Korean copy; confirm page shows it and does not open Toss. | ✓ |
| Generic payment failure | Simpler but hides lock expiry from users. | |
| Silent recovery | Try to recover automatically. Risky for lock ownership failures. | |

**User's choice:** Auto-selected server message + stop Toss.
**Notes:** Existing frontend already displays mutation error messages; planner should verify `ApiClientError` preserves server messages.

---

## Test Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Service + Lua + API/E2E regression | Cover BookingService ownership helper, ReservationService enforcement, and payment/booking E2E failure path. | ✓ |
| Unit tests only | Faster, but does not satisfy ROADMAP E2E regression criterion. | |
| Manual smoke only | Not sufficient for a core booking race fix. | |

**User's choice:** Auto-selected service + Lua + API/E2E regression.
**Notes:** Test placement should follow existing files: booking service specs, reservation service spec, and existing Toss/booking E2E fixtures.

---

## the agent's Discretion

- Exact helper and enum names are left to the planner.
- The planner may decide whether assert and consume are separate Lua scripts or one parameterized helper.
- Frontend may redirect to seat selection or keep the user on confirm with a CTA, as long as Toss is not opened after lock ownership failure.

## Deferred Ideas

- Server-side seat metadata fraud-hardening.
- Lock extension / hold refresh UX.
- Queueing or waiting-room behavior.
- Valkey production connectivity proof, owned by Phase 20.
