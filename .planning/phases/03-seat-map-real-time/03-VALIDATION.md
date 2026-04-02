---
phase: 3
slug: seat-map-real-time
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `apps/api/vitest.config.ts` / `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/api test -- --run` |
| **Full suite command** | `pnpm --filter @grapit/api test -- --run && pnpm --filter @grapit/web test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test -- --run`
- **After every plan wave:** Run `pnpm --filter @grapit/api test -- --run && pnpm --filter @grapit/web test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SEAT-01 | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SEAT-02 | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | SEAT-03 | integration | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | SEAT-04 | integration | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | SEAT-05 | e2e | `pnpm --filter @grapit/web test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/booking/__tests__/` — test stubs for booking/seat services
- [ ] `apps/api/src/seat/__tests__/` — test stubs for seat lock, WebSocket gateway
- [ ] WebSocket test utilities — Socket.IO client test helpers

*Planner will finalize Wave 0 tasks based on plan structure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SVG seat map zoom/pan on mobile | SEAT-02 | Touch gestures require device | Pinch zoom on mobile device/emulator |
| Real-time seat update across browsers | SEAT-05 | Multi-client WebSocket | Open two browser tabs, select seat in one, verify in other |
| Bottom sheet drag on mobile | BOOK-02 | Touch gesture | Drag bottom sheet on mobile device/emulator |
| Countdown timer visual states | BOOK-03 | Visual verification | Observe timer color change at 3 minutes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
