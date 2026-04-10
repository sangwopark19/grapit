---
phase: 7
slug: valkey
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @grapit/api test -- --run` |
| **Full suite command** | `pnpm --filter @grapit/api test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test -- --run`
- **After every plan wave:** Run `pnpm --filter @grapit/api test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | VALK-01 | — | N/A | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | VALK-02 | — | N/A | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | VALK-03 | — | N/A | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | VALK-04 | — | N/A | integration | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 1 | VALK-05 | — | N/A | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |
| 07-01-06 | 01 | 1 | VALK-06 | — | N/A | unit | `pnpm --filter @grapit/api test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/redis/__tests__/valkey.service.spec.ts` — stubs for VALK-01~03
- [ ] `apps/api/src/redis/__tests__/seat-lock.spec.ts` — stubs for VALK-05 (Lua scripts)
- [ ] `apps/api/src/redis/__tests__/cache.spec.ts` — stubs for VALK-06 (캐시 레이어)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VPC 연결 안정성 | VALK-04 | Cloud Run → Memorystore PSC 네트워크 경로는 로컬 테스트 불가 | GCP 콘솔에서 Memorystore 인스턴스 상태 확인 + Cloud Run 로그에서 연결 에러 없는지 검증 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
