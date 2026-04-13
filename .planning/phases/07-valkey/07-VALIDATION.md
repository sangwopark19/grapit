---
phase: 7
slug: valkey
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
audited: 2026-04-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | apps/api/vitest.config.ts (unit), apps/api/vitest.integration.config.ts (integration) |
| **Quick run command** | `pnpm --filter @grapit/api test -- --run` |
| **Full suite command** | `pnpm --filter @grapit/api test -- --run` |
| **Integration command** | `pnpm --filter @grapit/api test:integration` (requires Docker) |
| **Estimated runtime** | ~1s (unit), ~30s (integration with container boot) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test -- --run`
- **After every plan wave:** Run `pnpm --filter @grapit/api test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | VALK-01 | T-07-01 | Lua script hardcoded, user input via KEYS/ARGV only | unit | `pnpm --filter @grapit/api exec vitest run src/modules/booking/providers/__tests__/redis.provider.spec.ts` | ✅ `redis.provider.spec.ts` (5 tests) | ✅ green |
| 07-01-02 | 03 | 2 | VALK-02 | T-07-07 | WIF OIDC auth, no service account key files | manual | N/A — infra provisioning | ✅ `scripts/provision-valkey.sh` | ✅ green (manual) |
| 07-01-03 | 01 | 1 | VALK-03 | T-07-01 | eval() flat signature prevents injection | unit+integration | `pnpm --filter @grapit/api exec vitest run src/modules/booking/__tests__/booking.service.spec.ts` | ✅ `booking.service.spec.ts` (16 tests) + `booking.service.integration.spec.ts` (5 tests) | ✅ green |
| 07-01-04 | 03 | 2 | VALK-04 | T-07-09 | PSC + Direct VPC Egress, private IP only | manual+unit | `pnpm --filter @grapit/api exec vitest run src/health/__tests__/redis.health.indicator.spec.ts` | ✅ `redis.health.indicator.spec.ts` (3 tests) | ✅ green (health check automated, VPC manual) |
| 07-01-05 | 05 | 3 | VALK-05 | T-07-16 | Lua scripts run against real Valkey 8 container | integration | `pnpm --filter @grapit/api test:integration` | ✅ `booking.service.integration.spec.ts` (5 tests) | ✅ green |
| 07-01-06 | 02 | 2 | VALK-06 | T-07-04 | Cache keys server-generated, no user input in keys | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/__tests__/cache.service.spec.ts` | ✅ `cache.service.spec.ts` (15 tests) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- [x] `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` — VALK-01 (provider unification, prod hard-fail)
- [x] `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — VALK-03 (ioredis eval signature)
- [x] `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` — VALK-05 (Lua roundtrip with testcontainers)
- [x] `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` — VALK-06 (cache layer)
- [x] `apps/api/src/health/__tests__/redis.health.indicator.spec.ts` — VALK-04 health check portion
- [x] `apps/api/src/modules/booking/__tests__/redis-io.adapter.spec.ts` — Socket.IO adapter duplicate() options

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VPC 연결 안정성 | VALK-04 | Cloud Run → Memorystore PSC 네트워크 경로는 로컬 테스트 불가 | GCP 콘솔에서 Memorystore 인스턴스 상태 확인 + Cloud Run 로그에서 연결 에러 없는지 검증 |
| Memorystore 프로비저닝 | VALK-02 | gcloud CLI 실행은 GCP 계정 인증 + 리소스 생성 필요 | `scripts/provision-valkey.sh` 실행 후 `gcloud memorystore instances describe grapit-valkey` 확인 |
| CLUSTER 모드 호환성 | VALK-04 | Memorystore는 단일 샤드라도 CLUSTER 모드로 생성됨, ioredis standalone 호환성은 실 배포에서 확인 필요 | Cloud Run 배포 후 /api/v1/health 엔드포인트에서 redis status 확인 |

---

## Validation Audit 2026-04-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Unit tests (total) | 159 |
| Integration tests | 5 |
| Test files | 21 (unit) + 1 (integration) |
| Manual-only items | 3 |

**Audit notes:**
- VALIDATION.md was originally created in draft state with all tasks pending
- All 6 requirements now have automated verification (4 fully automated, 2 with manual supplement)
- Wave 0 test stubs from original draft were superseded by actual test files created during plan execution
- Integration tests require Docker (testcontainers); CI must have Docker-in-Docker or Valkey service

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Manual-Only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all filled during execution)
- [x] No watch-mode flags
- [x] Feedback latency < 2s (unit suite completes in ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-13
