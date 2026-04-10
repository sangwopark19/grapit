---
phase: 07-valkey
plan: 04
subsystem: [booking/redis, performance/cache, booking/websocket, planning/UAT]
tags: [review-fixup, operational-safety, hard-fail, graceful-degradation, release-gate]
requires: ["07-01", "07-02", "07-03"]
provides:
  - "redisProvider production hard-fail on missing REDIS_URL"
  - "CacheService non-blocking invalidate/invalidatePattern with Logger.warn"
  - "Socket.IO Redis adapter sub client isolation via duplicate() options"
  - "07-HUMAN-UAT.md merge-blocking release gate for PR #13"
affects:
  - apps/api/src/modules/booking/providers/redis.provider.ts
  - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
  - apps/api/src/modules/performance/cache.service.ts
  - apps/api/src/modules/performance/__tests__/cache.service.spec.ts
  - apps/api/src/modules/booking/providers/redis-io.adapter.ts
  - apps/api/src/modules/booking/__tests__/redis-io.adapter.spec.ts
  - .planning/phases/07-valkey/07-HUMAN-UAT.md
tech_stack:
  added: []
  patterns:
    - "Fail-fast misconfiguration detection at provider bootstrap"
    - "Best-effort cache invalidation (swallow + structured warn log)"
    - "Sub-client option isolation for @socket.io/redis-adapter"
    - "Merge-blocking release gate frontmatter"
key_files:
  created:
    - apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts
  modified:
    - apps/api/src/modules/booking/providers/redis.provider.ts
    - apps/api/src/modules/performance/cache.service.ts
    - apps/api/src/modules/performance/__tests__/cache.service.spec.ts
    - apps/api/src/modules/booking/providers/redis-io.adapter.ts
    - apps/api/src/modules/booking/__tests__/redis-io.adapter.spec.ts
    - .planning/phases/07-valkey/07-HUMAN-UAT.md
decisions:
  - "Production REDIS_URL misconfig must hard-fail at bootstrap (not silently use InMemoryRedis)"
  - "CacheService invalidate() logs but never throws — admin DB commit must not roll back on transient cache outage"
  - "Both sides of duplicate() (helper + adapter.connectToRedis) receive { maxRetriesPerRequest: null, enableReadyCheck: false }"
  - "07-HUMAN-UAT.md becomes a merge-blocking release gate, not a post-ship tracker"
metrics:
  duration: ~20min
  tasks: 4
  tests_before: 148
  tests_after: 156
  new_tests: 8
  files_created: 1
  files_modified: 6
  completed_date: 2026-04-10
---

# Phase 07 Plan 04: 리뷰 피드백 운영 안전성 보강 Summary

Phase 7 cross-AI 리뷰에서 Codex와 Claude CLI가 공통으로 지적한 HIGH/MEDIUM 운영 안전성 결함 4건을 PR #13 merge 전에 해소했다. 플랜 01~03을 수정하지 않는 추가형(additive) 플랜으로, 같은 브랜치(`gsd/phase-07-valkey-migration`)에 4개 커밋으로 구성되어 동일 PR의 일부로 ship된다.

## One-liner

프로덕션 REDIS_URL 미설정 시 hard-fail, 캐시 invalidate 비차단화, Socket.IO sub 커넥션 isolation, 07-HUMAN-UAT.md를 merge-blocking release gate로 전환 — 4개 파일 수정 + 8개 신규/확장 테스트.

## What Changed

### Task 1 — `redis.provider.ts` production hard-fail
**Commit:** `cdfb5d1`

`redisProvider.useFactory`가 `NODE_ENV=production` 그리고 `REDIS_URL`이 빈 문자열일 때 `throw new Error('[redis] REDIS_URL is required in production environment...')`로 부트 실패한다. 개발/테스트 환경은 여전히 `InMemoryRedis` fallback과 console.warn으로 동작한다.

- 생성: `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` (5개 테스트)
  - `exposes the REDIS_CLIENT injection symbol`
  - `throws when NODE_ENV=production and REDIS_URL is empty (hard-fail guard)`
  - `returns InMemoryRedis mock when NODE_ENV=development and REDIS_URL is empty`
  - `returns InMemoryRedis mock when NODE_ENV=test and REDIS_URL is empty`
  - `returns a real ioredis instance when REDIS_URL is set (production)` (with `client.disconnect()` cleanup)

**Why:** Cloud Run에서 Secret Manager 바인딩이 빠진 채 배포되면, 기존 구현은 조용히 InMemoryRedis로 fallback하여 각 인스턴스마다 고립된 좌석 잠금으로 중복 예매를 허용할 수 있었다. 차라리 부트 실패가 데이터 손실보다 안전하다.

**Review coverage:** 07-REVIEWS.md HIGH consensus #1 (Codex + Claude), T-07-10 DoS mitigation.

### Task 2 — `CacheService.invalidate()` non-blocking + Logger.warn
**Commit:** `4240ccf`

`CacheService`에 `private readonly logger = new Logger(CacheService.name)` 필드를 추가하고, `get/set/invalidate/invalidatePattern` 4개 메서드 모두 try/catch + `logger.warn({ err, key|pattern, op })` 구조화 로그를 남긴다. 특히 `invalidate`와 `invalidatePattern`은 이제 예외를 상위로 전파하지 않는다.

- 신규 테스트 3개:
  - `invalidate() swallows redis errors and logs a warning (does not throw)`
  - `invalidatePattern() swallows redis errors and logs a warning (does not throw)`
  - `swallows redis.del errors after successful keys() lookup`

**Why:** admin CRUD (create/update/delete)는 DB 커밋 후 캐시 무효화를 호출한다. Redis가 일시적으로 불안정할 때 캐시 예외가 admin HTTP 500으로 이어지면 "DB는 성공했는데 UI는 실패"라는 혼란이 생긴다. 캐시 실패는 TTL까지 기다리면 자연치유되므로 best-effort + 관측 가능한 warn 로그가 정답이다.

**Information disclosure 방지:** 로그 payload는 `err.message`, 키 문자열, op 이름만 포함하고 캐시된 값은 절대 로깅하지 않는다 (T-07-11).

**Review coverage:** 07-REVIEWS.md MEDIUM consensus #6, T-07-11 Information Disclosure mitigation.

### Task 3 — `redis-io.adapter.ts` duplicate() 옵션 전달
**Commit:** `ed7d6e8`

`connectToRedis()`와 `createSocketIoRedisAdapter()` 양쪽 모두 `pubClient.duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false })`로 sub 커넥션을 생성한다.

- 기존 테스트 1건 확장: `expect(duplicate).toHaveBeenCalledWith({ maxRetriesPerRequest: null, enableReadyCheck: false })` 어서션 추가

**Why:** `@socket.io/redis-adapter`는 sub 커넥션에 `maxRetriesPerRequest: null` (SUBSCRIBE 명령을 retry 한계로 중단시키면 안 됨)과 `enableReadyCheck: false` (subscriber 커넥션의 READY INFO 체크는 의미 없음)을 요구한다. 기존 구현은 옵션 없이 `duplicate()`를 호출해서 sub가 pub의 `maxRetriesPerRequest: 3`을 상속받았고, 네트워크 flap 시 subscription이 retry 도중 끊어져 cross-instance seat-update 이벤트가 조용히 사라질 수 있었다.

**Review coverage:** 07-REVIEWS.md MEDIUM Claude-only #8, T-07-13 DoS mitigation.

### Task 4 — `07-HUMAN-UAT.md` merge-blocking release gate
**Commit:** `bbf563e`

YAML frontmatter에 `release_gate` 블록(`merge_blocking: true`, `rationale`, PR 링크)을 추가하고, 본문 앞부분에 "Release Gate — PR #13 Merge Requirements" 섹션을 prepend했다. 기존 4개 테스트 엔트리와 Summary는 그대로 보존.

**Why:** Valkey-on-Cloud-Run 연결성, multi-instance pub/sub 전파, CLUSTER 모드 호환성, 캐시 latency 개선 — 이 네 가지는 CI와 unit test로는 검증 불가능하며 오직 실제 배포에서만 확인할 수 있다. 원래 이 문서는 "ship 후 확인 트래커"로 프레이밍되어 있어 PR #13이 아무 런타임 증거 없이 merge될 수 있는 구멍이 있었다.

**Review coverage:** 07-REVIEWS.md HIGH consensus #3, T-07-14 Repudiation/Audit gap mitigation.

## Test Counts Before/After

| Scope | Before | After | Delta |
|-------|--------|-------|-------|
| Full `@grapit/api` suite | 148 | 156 | +8 |
| `src/modules/booking` | 23 | 28 | +5 (new redis.provider.spec) |
| `src/modules/performance` | 22 | 25 | +3 (new invalidate error tests) |
| `redis-io.adapter.spec.ts` | 3 | 3 | 0 (extended assertions, no new cases) |

**Verification commands (all exit 0):**
- `pnpm --filter @grapit/api test` → 20 files, 156 passed
- `pnpm --filter @grapit/api exec tsc --noEmit` → clean
- `pnpm --filter @grapit/api lint` → 0 errors, 23 pre-existing warnings in unrelated files (out of scope per deviation rules)

## Deviations from Plan

**None of consequence.** The only micro-deviation was in Task 1's `createMockConfig` helper: the plan's template spec used `url ?? defaultValue ?? ''` but an empty string is not nullish, so it short-circuits incorrectly. I changed the mock implementation to explicitly branch on `url === ''` before returning the default value. This is a test-internal detail, does not affect production code, and the 5 tests still cover all branches per the plan.

No architectural changes (Rule 4) required. No blocking issues (Rule 3) encountered.

## Review Feedback Coverage

### Closed in this plan (4/4)

| Severity | Source | Concern | Task |
|----------|--------|---------|------|
| HIGH | consensus #1 | Silent InMemoryRedis fallback on prod misconfig | Task 1 |
| HIGH | consensus #3 | Non-blocking human checkpoint (no release gate) | Task 4 |
| MEDIUM | consensus #6 | invalidate exception propagation to admin 500 | Task 2 |
| MEDIUM | Claude-only #8 | Socket.IO duplicate() missing required options | Task 3 |

### Deferred (not in this plan)

| Severity | Concern | Destination |
|----------|---------|-------------|
| HIGH | consensus #2 — integration test with testcontainers | Plan 05 |
| MEDIUM | consensus #4 — KEYS → SCAN migration | backlog |
| MEDIUM | consensus #5 — cache stampede defense (SETNX per-key) | backlog |
| MEDIUM | consensus #7 — Valkey ping in HealthController | Plan 05 |
| MEDIUM | consensus #8 — RedisModule(global) extraction | backlog |
| LOW | findById viewCount stale fix, provisioning idempotency, etc. | backlog |

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | `cdfb5d1` | feat | hard-fail redisProvider when NODE_ENV=production and REDIS_URL is empty |
| 2 | `4240ccf` | feat | make CacheService invalidate() non-blocking with Logger.warn |
| 3 | `ed7d6e8` | feat | pass required options to ioredis duplicate() in Socket.IO adapter |
| 4 | `bbf563e` | docs | mark 07-HUMAN-UAT.md as merge-blocking release gate for PR #13 |

Branch: `gsd/phase-07-valkey-migration` (worktree branch `worktree-agent-a7013c96`, to be merged back into the feature branch by the orchestrator).

## Reminder — PR #13 Still Blocked Until Human UAT

Plan 04 closes the code-level and process-level review gaps, but it does NOT change the fact that PR #13 requires the 4 runtime verifications in `07-HUMAN-UAT.md` to be marked PASS before merge to `main`. The release gate added in Task 4 is now the authoritative merge policy. Plan 05 (if executed) may add additional integration test automation, but human UAT on real Cloud Run + Memorystore Valkey remains required.

## Self-Check: PASSED

- [x] File exists: `apps/api/src/modules/booking/providers/redis.provider.ts` (modified)
- [x] File exists: `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` (created)
- [x] File exists: `apps/api/src/modules/performance/cache.service.ts` (modified)
- [x] File exists: `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` (modified)
- [x] File exists: `apps/api/src/modules/booking/providers/redis-io.adapter.ts` (modified)
- [x] File exists: `apps/api/src/modules/booking/__tests__/redis-io.adapter.spec.ts` (modified)
- [x] File exists: `.planning/phases/07-valkey/07-HUMAN-UAT.md` (modified)
- [x] Commit `cdfb5d1` present in `git log`
- [x] Commit `4240ccf` present in `git log`
- [x] Commit `ed7d6e8` present in `git log`
- [x] Commit `bbf563e` present in `git log`
- [x] `grep "REDIS_URL is required in production" redis.provider.ts` → 1 match
- [x] `grep "merge_blocking: true" 07-HUMAN-UAT.md` → 1 match
- [x] `grep "maxRetriesPerRequest: null" redis-io.adapter.ts` → 2 matches
- [x] `grep "this.logger.warn" cache.service.ts` → 4 matches
- [x] Full test suite: 156 passing (was 148)
- [x] TypeScript clean: `tsc --noEmit` exit 0
- [x] Lint: 0 errors (23 pre-existing warnings in untouched files, out of scope)
