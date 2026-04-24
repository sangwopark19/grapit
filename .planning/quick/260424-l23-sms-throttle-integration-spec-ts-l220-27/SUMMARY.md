---
quick_id: 260424-l23
slug: sms-throttle-integration-spec-ts-l220-27
date: 2026-04-24
status: complete
type: fix
tasks_completed: 2
commits:
  - e65fa99
files_modified:
  - apps/api/test/sms-throttle.integration.spec.ts
  - .planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/deferred-items.md
---

# Quick 260424-l23 SUMMARY

**One-liner:** `sms-throttle.integration.spec.ts` 의 `TTL 단위 검증` 2건 pre-existing fail 해소 — `@nest-lab/throttler-storage-redis` 의 실제 key format (`{<tracker>:<throttlerName>}:hits`) 에 맞도록 filter 를 `.endsWith(':hits')` 로 수정. Phase 14 ci.yml `test:integration` step PR green 블로커 제거.

## Completed Tasks

| Task | Description | Commit |
| ---- | ----------- | ------ |
| 1 | filter pattern fix — `.includes('throttler')` → `.endsWith(':hits')` (L232, L262) | `e65fa99` |
| 2 | `deferred-items.md` 의 pre-existing failure 섹션에 RESOLVED 주석 + root cause 정정 | (이 SUMMARY 커밋에 포함) |

## Root cause (정정)

Phase 14 `deferred-items.md` 는 원인을 "Phase 13 @grabit namespace rename 여파로 throttler key prefix 가 바뀜" 으로 추정했으나, 실제는 다름:

- `apps/api/node_modules/@nest-lab/throttler-storage-redis/src/throttler-storage-redis.service.js` L66-67 에서 key 를 `{${key}:${throttlerName}}:hits` (및 `:blocked`) 로 저장한다
- 실제 key 예: `{192.168.1.1:default}:hits` — "throttler" 문자열은 어디에도 없음
- 과거 테스트 작성 시 라이브러리 실제 동작을 확인하지 않고 substring 매칭한 bug. Namespace rename 과 무관하게 항상 실패해야 하는 코드였음

## Fix details

`apps/api/test/sms-throttle.integration.spec.ts` L232, L262:

```ts
// Before
const throttlerKeys = keys.filter(
  (k) => k.includes('throttler') || k.includes('Throttler'),
);

// After
const throttlerKeys = keys.filter((k) => k.endsWith(':hits'));
```

옵션 A 채택 — 테스트 의도(hit key 의 PTTL 이 1h/15min window 내) 보존 + throttler name 추가 시 회귀 없음. `:blocked` key 는 차단 트리거 전까지 생성되지 않아 `:hits` 만 존재.

## Verification

```
pnpm --filter @grabit/api test:integration sms-throttle -- --run
  ✓ test/sms-throttle.integration.spec.ts (13 tests) 955ms

pnpm --filter @grabit/api test:integration -- --run
  Test Files  4 passed (4)
  Tests       30 passed (30)
```

이전 base: 28/30 (2개 fail). 현재: 30/30 green.

## Impact

- Phase 14 ci.yml `test:integration` step (SC-2 guard) PR green 가능 → 14-HUMAN-UAT.md **[MEDIUM#5] GitHub Actions CI 녹색** 체크박스의 잠재 블로커 제거. 실제 PR merge 시 CI 로그 확인은 여전히 HUMAN-UAT 절차로 진행.
- Phase 14 `deferred-items.md` Pre-existing failure 섹션 RESOLVED 처리.

## No-change areas

- Rate-limit 동작 테스트 8건 (기존 green) — 변경 없음
- `VERIFY_AND_INCREMENT_LUA` atomic script 6건 (Plan 02 에서 refactor) — 변경 없음
- Phase 14 deliverable (sms.service.ts hash-tag, cluster-crossslot spec, ci.yml step, phone-verification) — 변경 없음
