---
phase: 19
slug: seat-lock-ownership-enforcement
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-29
---

# Phase 19 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.x for API/Web unit tests, Vitest + testcontainers for Valkey integration, Playwright 1.59.x for payment E2E |
| **Config file** | `apps/api/vitest.config.ts`, `apps/api/vitest.integration.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick API command** | `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider` |
| **Quick web command** | `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking` |
| **Integration command** | `pnpm --filter @grabit/api test:integration -- booking.service.integration` |
| **E2E command** | `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` |
| **Full suite command** | `pnpm test && pnpm --filter @grabit/api test:integration` |
| **Estimated runtime** | quick unit suites under ~90 seconds; integration/E2E gated by Valkey container and web server startup |

---

## Sampling Rate

- **After every API task commit:** Run `pnpm --filter @grabit/api test -- reservation.service booking.service redis.provider`
- **After every web task commit:** Run `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking`
- **After every plan wave:** Run `pnpm --filter @grabit/api test && pnpm --filter @grabit/web test`
- **Before `$gsd-verify-work`:** Run `pnpm test`, `pnpm --filter @grabit/api test:integration -- booking.service.integration`, and `pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts`
- **Max feedback latency:** 120 seconds for narrow unit feedback; integration/E2E may exceed this because of container/server startup

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-W0-01 | TBD | 0 | VALK-03 | T-19-01 | `assertOwnedSeatLocks()` succeeds only when every `{showtimeId}:seat:{seatId}` value equals authenticated `userId` | unit | `pnpm --filter @grabit/api test -- booking.service` | yes: `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` | pending |
| 19-W0-02 | TBD | 0 | VALK-03 | T-19-02 | `consumeOwnedSeatLocks()` deletes only requested owned locks and preserves unrelated same-showtime locks | unit | `pnpm --filter @grabit/api test -- booking.service redis.provider` | yes: `apps/api/src/modules/booking/__tests__/booking.service.spec.ts`, `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` | pending |
| 19-W0-03 | TBD | 0 | VALK-03 | T-19-03 | Real Valkey Lua script handles all-owned, missing, other-owner, and stale-index cases with explicit `KEYS` | integration | `pnpm --filter @grabit/api test:integration -- booking.service.integration` | yes: `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` | pending |
| 19-W0-04 | TBD | 0 | VALK-03 | T-19-04 | `prepareReservation()` rejects missing, expired, released, and other-user locks before pending reservation creation or idempotent return | service unit | `pnpm --filter @grabit/api test -- reservation.service` | yes: `apps/api/src/modules/reservation/reservation.service.spec.ts` | pending |
| 19-W0-05 | TBD | 0 | VALK-03 | T-19-05 | `confirmAndCreateReservation()` rejects invalid locks before Toss confirm and compensates if post-Toss consume fails | service unit | `pnpm --filter @grabit/api test -- reservation.service` | yes: `apps/api/src/modules/reservation/reservation.service.spec.ts` | pending |
| 19-W0-06 | TBD | 0 | UX-02 UX-03 UX-04 UX-05 UX-06 | T-19-06 | Lock failure UI surfaces server message, does not start Toss after prepare failure, and does not regress seat map viewer behaviors | web unit + E2E | `pnpm --filter @grabit/web test -- seat-map-viewer seat-selection-panel use-booking && pnpm --filter @grabit/web test:e2e -- toss-payment.spec.ts` | yes: `apps/web/e2e/toss-payment.spec.ts` and booking component tests | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` - add assert/consume helper tests for all-owned, missing, other-owner, stale index, and unrelated lock preservation.
- [ ] `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` - add InMemoryRedis `eval()` dispatch/emulation coverage for new assert/consume Lua scripts.
- [ ] `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` - add real Valkey helper coverage for new scripts.
- [ ] `apps/api/src/modules/reservation/reservation.service.spec.ts` - add prepare and confirm ownership enforcement tests.
- [ ] `apps/web/e2e/toss-payment.spec.ts` - add prepare/confirm lock failure user-path regressions using route interception.
- [ ] Optional `apps/web/app/booking/[performanceId]/complete` regression coverage - add explicit failed confirmation state if implementation changes UI behavior.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production Cloud Run to Valkey connectivity | VALK-03 | Phase 20 owns production runtime/cluster connectivity proof, not Phase 19 | Defer to Phase 20 validation artifacts |

---

## Threat Model References

| Ref | Threat | Required Control |
|-----|--------|------------------|
| T-19-01 | Client submits seats it does not actively lock | Compare every per-seat Valkey lock value to authenticated `userId` before prepare and confirm |
| T-19-02 | Broad cleanup deletes unrelated same-showtime locks | Consume only confirmed requested locks and remove only corresponding index entries |
| T-19-03 | Cluster-incompatible Lua script accesses undeclared keys | Pass every accessed lock/index key through `KEYS` and keep `{showtimeId}` hash tags |
| T-19-04 | Existing pending `orderId` bypasses current lock ownership | Re-check ownership before returning an existing pending reservation |
| T-19-05 | Toss confirms payment but lock ownership disappears before sold transition | Atomic post-Toss consume must fail closed, run Toss cancel compensation, and skip DB sold transition |
| T-19-06 | Frontend shows false success after server lock rejection | Confirm/complete pages surface server failure message and recovery only applies to already-confirmed orders |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency target documented
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
