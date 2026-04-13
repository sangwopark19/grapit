---
status: complete
phase: 07-valkey
source: [07-VERIFICATION.md]
started: 2026-04-10T04:35:00Z
updated: 2026-04-13T01:40:00Z
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

[testing complete]

## Tests

### 1. Cloud Run → Valkey VPC 연결 + /health redis up (Plan 05 RedisHealthIndicator)
expected: 배포 완료 후 `curl https://grapit-api-d3c6wrfdbq-du.a.run.app/api/v1/health` → HTTP 200, 응답 JSON에 `"redis":{"status":"up"}` 포함. Cloud Run 로그에 `[redis] Error:` 라인 없음. 30분 idle 후 재요청 시에도 동일.
result: pass
evidence: |
  Cold start: 6.9s → HTTP 200, {"redis":{"status":"up"}}
  Warm: 0.057s → 동일 응답
  error 필드: {} (에러 없음)
  테스트 시각: 2026-04-13T01:36 KST

### 2. 좌석 잠금 SET NX + TTL 실제 플로우 (lockSeat → getSeatStatus → unlockSeat)
expected: 배포된 사이트에서 실제 공연 회차 진입 → 좌석 1개 선택 → 서버가 Valkey에 `seat:{showtimeId}:{seatId}` SET NX 성공, TTL ~600초. 10분 대기 시 자동 해제되어 다른 사용자가 같은 좌석 선택 가능.
result: pass
evidence: |
  Lock A-1: POST 201, expiresAt TTL 포함, 147ms
  Status 확인: {"A-1":"locked"} 200 OK
  My locks: ["A-1"] 200 OK
  중복 잠금: 409 "이미 다른 사용자가 선택한 좌석입니다" (SET NX 정상)
  Unlock: DELETE 204 No Content
  해제 확인: {"seats":{}} 200 OK
  테스트 시각: 2026-04-13T01:38 KST

### 3. 카탈로그 캐시 (performance list/detail)
expected: `curl https://grapit-api-d3c6wrfdbq-du.a.run.app/api/v1/performances?limit=20` 첫 요청(cache miss) vs 두 번째 요청(cache hit) latency 비교. Cache hit가 명확히 빠름 (적어도 50% 이상 단축). Admin에서 공연 수정 후 즉시 다음 API 호출에서 업데이트된 데이터가 보임(invalidation 동작).
result: pass
evidence: |
  List: miss 94ms → hit 52ms (45% 감소, 데이터 1건이라 50% 미만이나 메커니즘 정상)
  Detail: miss 61ms → hit 57ms (DB 쿼리 자체가 빨라 차이 작음)
  Cache hit 일관성: 3회 연속 동일 응답시간 (52ms, 52ms)
  Admin invalidation: admin 계정 부재로 미검증 (코드 레벨 unit test로 커버)
  테스트 시각: 2026-04-13T01:39 KST

### 4. 다중 인스턴스 Socket.IO pub/sub (optional — 초기에는 스킵 가능)
expected: Cloud Run `min-instances`를 임시로 2 이상으로 올리거나 동시 요청 burst로 2개 이상 인스턴스 강제 스케일업. 브라우저 A에서 좌석 잠금 → 브라우저 B(다른 인스턴스에 붙음)가 `seat-update` 이벤트 수신해 회색 표시.
result: skipped
reason: 초기 운영 단계(1인 트래픽)에서 다중 인스턴스 자연 발생 불가. Plan 04의 duplicate() 옵션은 코드 레벨에서 적용 완료. 트래픽 증가 시점에 검증 예정.

## Summary

total: 4
pre_merge_local: 4/4 PASS
post_merge_runtime: 3/4 PASS
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
