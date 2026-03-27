---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | apps/api/vitest.config.ts, apps/web/vitest.config.ts |
| **Quick run command** | `pnpm --filter @grapit/api test -- --run` |
| **Full suite command** | `pnpm -r test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test -- --run`
- **After every plan wave:** Run `pnpm -r test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (populated during planning) | | | | | | | |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — vitest configuration for NestJS API
- [ ] `apps/web/vitest.config.ts` — vitest configuration for Next.js frontend
- [ ] `packages/shared/vitest.config.ts` — vitest configuration for shared package
- [ ] vitest install — if not already in devDependencies

*Existing infrastructure covers phase requirements after Wave 0 setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kakao OAuth login | AUTH-02 | Requires real OAuth redirect flow | 1. Click Kakao login 2. Authorize 3. Verify redirect + session |
| Naver OAuth login | AUTH-02 | Requires real OAuth redirect flow | 1. Click Naver login 2. Authorize 3. Verify redirect + session |
| Google OAuth login | AUTH-02 | Requires real OAuth redirect flow | 1. Click Google login 2. Authorize 3. Verify redirect + session |
| Session persistence across refresh | AUTH-05 | Requires browser interaction | 1. Login 2. Refresh page 3. Verify still authenticated |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
