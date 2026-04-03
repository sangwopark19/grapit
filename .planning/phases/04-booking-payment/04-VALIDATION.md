---
phase: 4
slug: booking-payment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/api test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | BOOK-05 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "amount"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PAY-05 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/payment/payment.service.spec.ts -t "amount validation"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | PAY-06 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "reservation number"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | PAY-07 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/payment/payment.service.spec.ts -t "failure"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | RESV-01 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "list"` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | RESV-03 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "cancel"` | ❌ W0 | ⬜ pending |
| 04-01-07 | 01 | 1 | RESV-03 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "deadline"` | ❌ W0 | ⬜ pending |
| 04-01-08 | 01 | 1 | ADMN-04 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/admin/admin-booking.service.spec.ts -t "list"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/reservation/reservation.service.spec.ts` — stubs for BOOK-05, PAY-06, RESV-01, RESV-03
- [ ] `apps/api/src/modules/payment/payment.service.spec.ts` — stubs for PAY-05, PAY-07
- [ ] `apps/api/src/modules/admin/admin-booking.service.spec.ts` — stubs for ADMN-04

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toss SDK widget renders payment methods | PAY-01, PAY-02, PAY-03, PAY-04 | Third-party SDK UI rendering cannot be unit tested | 1. Navigate to booking page 2. Select seats 3. Verify payment widget shows card/KakaoPay/NaverPay/bank transfer options |
| Successful payment shows confirmation page | PAY-06 | Requires Toss test mode redirect flow | 1. Use Toss test card 2. Complete payment 3. Verify booking number on confirmation page |
| Payment failure shows error message | PAY-07 | Requires Toss test mode failure simulation | 1. Trigger payment failure via Toss test mode 2. Verify error message and seat lock release |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
