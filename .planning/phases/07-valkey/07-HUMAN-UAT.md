---
status: partial
phase: 07-valkey
source: [07-VERIFICATION.md]
started: 2026-04-10T04:35:00Z
updated: 2026-04-10T16:25:00Z
release_gate:
  pr: "https://github.com/grapit/grapit/pull/13"
  branch: gsd/phase-07-valkey-migration
  merge_blocking: false
  strategy: post-merge-smoke-test-with-rollback
  required_state: "local pre-merge checks PASS → merge to main → immediate post-deploy smoke test → Cloud Run revision rollback if any item FAILS"
  rationale: |
    Original gate was merge_blocking: true + "deploy preview branch" procedure,
    but .github/workflows/deploy.yml only triggers on main branch CI success.
    No staging/preview Cloud Run service exists, and the 1-person-dev project
    does not want to maintain one. Therefore "verify in production before
    merging" is physically impossible on this infra.

    Path B (chosen 2026-04-10): pre-merge gate becomes LOCAL verification
    (testcontainers integration + unit tests), merge unblocks deployment,
    immediate post-deploy smoke test runs against the live Cloud Run +
    Memorystore Valkey instance, any FAIL triggers Cloud Run revision
    rollback (1-click, instant, 0 downtime) + hotfix commit.

    Safety net: Plan 07-04 added production REDIS_URL hard-fail at boot —
    a misconfigured deploy fails health check and Cloud Run automatically
    keeps the previous revision serving traffic. The worst case is a failed
    deploy attempt, not a degraded production.
---

## Release Gate — PR #13 Path B (Local Pre-merge + Post-deploy Smoke Test)

### Pre-merge (LOCAL) — all PASS before `gh pr merge 13`

- [x] **Unit tests green** — `pnpm --filter @grapit/api test` → 21 files / 159 tests passing (recorded 2026-04-10 15:36 KST)
- [x] **TypeScript clean** — `pnpm --filter @grapit/api exec tsc --noEmit` → exit 0 (recorded 2026-04-10 15:36 KST)
- [x] **testcontainers Valkey 8 integration** — `pnpm --filter @grapit/api test:integration` → 5/5 passing on real `valkey/valkey:8-alpine` container (recorded 2026-04-10 16:20 KST). **This closes 07-REVIEWS HIGH #2 (Lua script compatibility) at the code level** — Lua scripts verified against the actual Valkey 8 Lua 5.1 interpreter. No emulation, no mocks.
- [x] **Web tests green** — `pnpm --filter @grapit/web test` → 14 files / 87 tests passing (recorded 2026-04-10 15:36 KST)

### Merge

```bash
gh pr merge 13 --squash --delete-branch
# → deploy.yml triggers automatically on main CI success
# → watch: gh run watch (or GitHub Actions UI)
```

### Post-deploy smoke test — run IMMEDIATELY after deployment completes

Execute the 4 tests in the Tests section below against the live `https://grapit-api-d3c6wrfdbq-du.a.run.app` endpoint. Update each with `result: PASS` + evidence (timestamp, curl output, Cloud Run log line), OR `result: FAIL` + observed behavior.

### Rollback plan (if any test FAILS)

**Cloud Run Console → grapit-api service → Revisions tab → previous revision → "Manage traffic" → 100% to previous revision.** Instant, 0 downtime. Cloud Run retains revisions indefinitely.

Alternative (CLI):
```bash
PREV=$(gcloud run revisions list --service=grapit-api --region=asia-northeast3 --format='value(name)' | sed -n '2p')
gcloud run services update-traffic grapit-api --region=asia-northeast3 --to-revisions=$PREV=100
```

After rollback: open a fix commit on a new branch (NOT the merged branch — it's gone after `--delete-branch`), PR it, local verify again, re-attempt path B.

**Source of truth:** 07-REVIEWS.md HIGH consensus, 07-VERIFICATION.md `human_verification` block, Cloud Run revisions architecture (revision-based deploy + instant rollback).

## Current Test

[awaiting post-merge smoke test — PR #13 merge 후 즉시 실행]

## Tests

### 1. Cloud Run → Valkey VPC 연결 + /health redis up (Plan 05 RedisHealthIndicator)
expected: 배포 완료 후 `curl https://grapit-api-d3c6wrfdbq-du.a.run.app/api/v1/health` → HTTP 200, 응답 JSON에 `"redis":{"status":"up"}` 포함. Cloud Run 로그에 `[redis] Error:` 라인 없음. 30분 idle 후 재요청 시에도 동일.
result: [pending]
why_human: VPC Direct Egress + Memorystore PSC 엔드포인트 연결은 실제 배포 환경에서만 검증 가능. **이 테스트는 항목 2(CLUSTER 호환성)도 동시에 커버한다** — health up이 찍히면 ioredis standalone 클라이언트가 Valkey CLUSTER 모드 샤드에 정상 연결된 것이기 때문.
on_fail: Cloud Run 로그에 `ClusterAllFailedError` / `READONLY` / `MOVED` 류가 보이면 Plan 03 SUMMARY의 open question이 현실화된 것. `new Redis.Cluster([{host, port}])` 업그레이드 hotfix 필요. 즉시 이전 revision으로 롤백 후 브랜치 생성.

### 2. 좌석 잠금 SET NX + TTL 실제 플로우 (lockSeat → getSeatStatus → unlockSeat)
expected: 배포된 사이트에서 실제 공연 회차 진입 → 좌석 1개 선택 → 서버가 Valkey에 `seat:{showtimeId}:{seatId}` SET NX 성공, TTL ~600초. 10분 대기 시 자동 해제되어 다른 사용자가 같은 좌석 선택 가능.
result: [pending]
why_human: 로컬 testcontainers 통합 테스트(pre-merge 체크 #3)가 Lua 스크립트 호환성은 이미 검증했음. 여기서 확인할 것은 **"Cloud Run ↔ VPC ↔ Memorystore Valkey" 네트워크 경로가 실제 사용자 플로우에서 latency 내로 동작하는지**이다. 수동 브라우저 테스트로 2-3개 회차에서 좌석 선택 → 잠금 → 해제를 확인한다.
on_fail: 좌석 선택이 멈추거나 에러 → Cloud Run 로그 확인, 즉시 이전 revision으로 롤백.

### 3. 카탈로그 캐시 (performance list/detail)
expected: `curl https://grapit-api-d3c6wrfdbq-du.a.run.app/api/v1/performances?limit=20` 첫 요청(cache miss) vs 두 번째 요청(cache hit) latency 비교. Cache hit가 명확히 빠름 (적어도 50% 이상 단축). Admin에서 공연 수정 후 즉시 다음 API 호출에서 업데이트된 데이터가 보임(invalidation 동작).
result: [pending]
why_human: 코드 레벨에서 CacheService는 unit test로 cover됨. 여기서 확인할 것은 **실제 Valkey round-trip이 DB round-trip보다 빠른지**와 **admin invalidation이 동작하는지**. curl + 스톱워치/Cloud Run 로그 timing 확인으로 충분.
on_fail: cache hit가 miss보다 느리거나 같으면 네트워크 경로/직렬화 문제. invalidation이 안 먹히면 Plan 02의 CacheService.invalidate 경로 재점검. 롤백 불필요 — 사용자 기능은 동작하고 캐시 효과만 없는 상태이므로 브랜치에서 fix.

### 4. 다중 인스턴스 Socket.IO pub/sub (optional — 초기에는 스킵 가능)
expected: Cloud Run `min-instances`를 임시로 2 이상으로 올리거나 동시 요청 burst로 2개 이상 인스턴스 강제 스케일업. 브라우저 A에서 좌석 잠금 → 브라우저 B(다른 인스턴스에 붙음)가 `seat-update` 이벤트 수신해 회색 표시.
result: [pending]
why_human: 다중 인스턴스 검증은 현재 `min-instances=0, max-instances=5`에서 자연 발생이 드물고, 사용자가 1명인 초기 운영 단계에서는 트래픽이 단일 인스턴스에 집중된다. **이 항목은 "multi-instance가 실제로 필요해지기 전까지 defer 가능"** — Phase 7 코드는 Plan 04에서 `duplicate()` 옵션을 이미 적용했고, 나중에 트래픽이 늘어 자연스럽게 scale-up이 일어나는 시점에 검증한다.
on_fail: 이벤트 전파 실패 시 Cloud Run `--min-instances=2`로 임시 고정 후 재검증. Socket.IO 로그에서 `RedisIoAdapter` 초기화 로그 확인. 이 항목만으로 롤백하지는 않음 (기본 기능은 동작).

## Summary

total: 4
pre_merge_local: 4/4 PASS
post_merge_runtime: 0/4 PASS
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
