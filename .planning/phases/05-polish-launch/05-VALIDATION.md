---
phase: 5
slug: polish-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x |
| **Config file** | `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/web test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/web test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFR-01 | — | N/A | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/mobile-tab-bar.test.tsx` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | INFR-01 | — | N/A | manual | Browser DevTools mobile mode visual check | manual-only | ⬜ pending |
| 05-02-01 | 02 | 1 | INFR-02 | — | N/A | unit | `pnpm --filter @grapit/web exec vitest run components/__tests__/skeleton-variants.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | INFR-03 | — | N/A | unit | `pnpm --filter @grapit/web exec vitest run lib/__tests__/api-client.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | INFR-03 | — | N/A | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/network-banner.test.tsx` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 1 | INFR-03 | — | N/A | unit | `pnpm --filter @grapit/web exec vitest run app/__tests__/not-found.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` — stubs for INFR-01
- [ ] `apps/web/lib/__tests__/api-client.test.ts` — stubs for INFR-03 error interceptor
- [ ] `apps/web/components/layout/__tests__/network-banner.test.tsx` — stubs for INFR-03 network banner
- [ ] `apps/web/components/__tests__/skeleton-variants.test.tsx` — stubs for INFR-02
- [ ] `apps/web/app/__tests__/not-found.test.tsx` — stubs for INFR-03

*Existing infrastructure covers test framework setup. Only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 44px touch targets on mobile | INFR-01 | CSS computed dimensions require browser rendering | Open DevTools mobile mode (375px), inspect all buttons/links for min 44x44px tappable area |
| Responsive layout visual check | INFR-01 | Layout correctness requires visual inspection | Check all public pages at 375px, 768px, 1280px widths |
| Sentry event delivery | INFR-03 | Requires live Sentry project DSN | Trigger error in dev, verify event appears in Sentry dashboard |
| Cloud Run deployment health | INFR-03 | Requires GCP infrastructure | Deploy to Cloud Run, verify health check endpoint returns 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
