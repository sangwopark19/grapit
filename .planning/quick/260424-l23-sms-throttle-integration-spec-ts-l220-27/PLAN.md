---
quick_id: 260424-l23
slug: sms-throttle-integration-spec-ts-l220-27
date: 2026-04-24
type: fix
requirements: []
files_modified:
  - apps/api/test/sms-throttle.integration.spec.ts
---

# Quick: sms-throttle.integration.spec.ts TTL 2건 fix

**One-liner:** `@nest-lab/throttler-storage-redis` 의 실제 key 포맷(`{<tracker>:<throttlerName>}:hits` / `:blocked`)에 맞도록 `TTL 단위 검증` 2건의 filter 패턴을 수정해 pre-existing fail 을 해소한다. Phase 14 ci.yml `test:integration` step PR green 의 블로커.

## Context

Phase 14 VERIFICATION.md + `14-deferred-items.md` 에서 기록된 pre-existing fail:

- `apps/api/test/sms-throttle.integration.spec.ts` L220 `send-code Throttler가 1h=3600000ms TTL을 Valkey에 설정하는지 확인`
- `apps/api/test/sms-throttle.integration.spec.ts` L252 `verify-code Throttler가 15min=900000ms TTL을 Valkey에 설정하는지 확인`

두 테스트 모두 `keys.filter((k) => k.includes('throttler') || k.includes('Throttler'))` → `[]` → `expect(throttlerKeys.length).toBeGreaterThan(0)` fail.

## Root cause (확정)

`apps/api/node_modules/@nest-lab/throttler-storage-redis/src/throttler-storage-redis.service.js` L66-67:

```js
const hitKey = `{${key}:${throttlerName}}:hits`;
const blockKey = `{${key}:${throttlerName}}:blocked`;
```

실제 key 예: `{192.168.1.1:default}:hits`. "throttler" 문자열은 key 에 포함되지 않음. 과거 테스트 작성 시 추정으로 작성된 filter 가 라이브러리 실제 동작과 어긋난 pre-existing bug — Phase 13 `@grapit → @grabit` rename 과는 무관.

## Tasks

### Task 1: filter 패턴 수정 + green 확인

`apps/api/test/sms-throttle.integration.spec.ts` L232-235 및 L263-265 의 filter 를 수정한다. 두 가지 방식 중 하나:

- **옵션 A (최소 변경):** `keys.filter((k) => k.endsWith(':hits'))` — 모든 throttler hit key 매칭. hash-tag `{...}` 안쪽의 tracker/throttlerName 무관.
- **옵션 B (더 명시적):** `keys.filter((k) => /^\{[^}]+:default\}:hits$/.test(k))` — `default` throttler name 만 명시 매칭.

옵션 A 채택 — 테스트 목적(TTL 값 범위 검증)에 충분하고, 추후 throttler name 이 추가되어도 테스트가 깨지지 않음.

**검증:**
```bash
pnpm --filter @grabit/api test:integration sms-throttle -- --run
```

두 `TTL 단위 검증` it-block green + 기존 8건 rate-limit 테스트 pass 유지 + VERIFY_AND_INCREMENT_LUA 6건 green 유지.

**커밋:** `fix(260424-l23): match actual throttler key format in TTL unit tests`

### Task 2: deferred-items.md + HUMAN-UAT.md 연결

`/.planning/phases/14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag/deferred-items.md` 의 Pre-existing failure 섹션에 "Resolved by quick task 260424-l23" 주석 추가. 14-HUMAN-UAT.md 의 `ci.yml test:integration PR green` 체크박스는 PR merge 후 별도 확인 대상이므로 이 quick 에서 건드리지 않음.

**커밋:** `docs(260424-l23): mark pre-existing TTL failures as resolved in deferred-items.md`
