---
phase: 02
slug: catalog-admin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | apps/api/vitest.config.ts, apps/web/vitest.config.ts |
| **Quick run command** | `pnpm --filter @grapit/api test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PERF-01 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | PERF-02 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | PERF-03 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | PERF-04 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | PERF-05 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SRCH-01 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SRCH-02 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | SRCH-03 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | ADMN-01 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | ADMN-02 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | ADMN-03 | unit | `pnpm --filter @grapit/api test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend unit test stubs for performance CRUD endpoints
- [ ] Backend unit test stubs for search endpoints
- [ ] Backend unit test stubs for admin endpoints
- [ ] Test fixtures for performance/showtime/seat map data

*Existing infrastructure covers auth and base patterns from Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SVG seat map renders with zoom/pan | ADMN-03 | Browser SVG rendering | Upload SVG in admin, verify zoom/pan/tier coloring in browser |
| Poster image displays correctly | PERF-02 | Visual rendering | Upload poster via admin, check detail page shows correct image |
| Swiper carousel interaction | PERF-01 | Touch/mouse interaction | Browse genre page, verify carousel swipe works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
