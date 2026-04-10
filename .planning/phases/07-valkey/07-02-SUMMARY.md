---
phase: 07-valkey
plan: 02
subsystem: backend/performance/cache
tags: [redis, valkey, cache, read-through, invalidation, performance, admin]
requirements: [VALK-06]
dependency-graph:
  requires:
    - "REDIS_CLIENT provider (from Plan 07-01, exported via BookingModule)"
    - "ioredis 5.x client (get/set/del/keys signatures)"
  provides:
    - "CacheService (get/set/invalidate/invalidatePattern) for any module that imports PerformanceModule"
    - "Read-through cache layer over the public catalog + home API"
    - "Admin write-path invalidation contract for list/detail/home/banner caches"
  affects:
    - "apps/api/src/modules/performance/performance.service.ts (5 read endpoints cached)"
    - "apps/api/src/modules/admin/admin.service.ts (7 mutations invalidate cache)"
tech-stack:
  added:
    - "CacheService abstraction (JSON serialization + graceful degradation)"
  patterns:
    - "Read-through cache: get → miss → DB → set → return"
    - "Invalidate on write: pattern wipe for list/home + exact key for detail"
    - "Graceful degradation: cache failures never break the request path"
key-files:
  created:
    - apps/api/src/modules/performance/cache.service.ts
    - apps/api/src/modules/performance/__tests__/cache.service.spec.ts
  modified:
    - apps/api/src/modules/performance/performance.module.ts
    - apps/api/src/modules/performance/performance.service.ts
    - apps/api/src/modules/performance/performance.service.spec.ts
    - apps/api/src/modules/admin/admin.service.ts
    - apps/api/src/modules/admin/admin.service.spec.ts
decisions:
  - "CacheService는 PerformanceModule에서 제공/export → AdminModule이 이미 PerformanceModule을 imports하므로 별도 등록 불필요"
  - "findById의 viewCount 증가는 캐시 확인 전에 실행 (캐시 히트에서도 조회수 집계 지속)"
  - "AdminService에서는 private invalidateCatalogCache(id?) 헬퍼로 list/home/detail 무효화를 한곳에 집중"
  - "TTL 300초 (5분) 단일 기본값 — per D-08; 엔드포인트별 TTL 튜닝은 Out of Scope"
  - "pattern 기반 invalidate는 KEYS 사용 (현재 캐시 키 수 <100로 안전, T-07-05 accept)"
metrics:
  duration: "~7min"
  tasks: 2
  files: 7
  tests_passed: 145
  completed: "2026-04-10"
---

# Phase 07 Plan 02: Performance Catalog Cache Layer Summary

PerformanceService 5개 읽기 엔드포인트(list/detail/banners/hot/new)에 ioredis 기반 read-through 캐시를 적용하고, AdminService 7개 쓰기 경로(공연 CRUD 3 + 배너 CRUD 4)에서 관련 캐시를 즉시 무효화했다. 캐시 계층은 재사용 가능한 `CacheService`(get/set/invalidate/invalidatePattern)로 추출해 PerformanceModule에서 export하며, AdminModule은 기존 PerformanceModule import로 CacheService를 그대로 주입받는다. 기본 TTL은 5분(300초, per D-08)이고, get/set은 graceful degradation으로 Redis 장애가 요청 경로를 깨뜨리지 않도록 처리한다.

## What Was Built

### Task 1: CacheService + 유닛 테스트 + 모듈 연결 (commits 48ecf86, dafc726)

**`cache.service.ts` (신규):**
- `get<T>(key)` — JSON.parse 후 `T | null` 반환, 미스/에러/잘못된 JSON 모두 null로 정규화
- `set(key, data, ttl=300)` — `redis.set(key, JSON.stringify(data), 'EX', ttl)` 호출, 에러는 swallow (graceful degradation)
- `invalidate(...keys)` — 빈 배열이면 no-op, 아니면 `redis.del(...keys)`
- `invalidatePattern(pattern)` — `redis.keys(pattern)` 후 매치된 키에 대해 `redis.del`; 매치 없으면 no-op
- `@Inject(REDIS_CLIENT)` — Plan 07-01에서 export된 단일 ioredis provider를 그대로 사용

**`__tests__/cache.service.spec.ts` (신규, RED→GREEN):**
- 12 tests: miss/hit/error, EX 300 default, custom TTL, invalidate(0 keys / N keys), invalidatePattern(empty / matches), JSON round-trip
- RED 단계 커밋(48ecf86) → 구현 커밋(dafc726) → 12/12 통과

**`performance.module.ts` (수정):**
- `imports: [BookingModule]` 추가 (REDIS_CLIENT provider 접근)
- `providers: [PerformanceService, CacheService]`
- `exports: [PerformanceService, CacheService]` (AdminModule이 PerformanceModule을 import해서 CacheService도 함께 주입받음)

### Task 2: PerformanceService 캐시 적용 + AdminService 무효화 (commit 5354233)

**`performance.service.ts` — 5개 엔드포인트에 read-through 캐시:**

| 메서드 | 캐시 키 | 특이사항 |
|---|---|---|
| `findByGenre` | `cache:performances:list:{genre}:{page}:{limit}:{sort}:{ended}:{sub|none}` | 6개 쿼리 파라미터를 모두 키에 포함 |
| `findById` | `cache:performances:detail:{id}` | **viewCount 증가는 캐시 확인 전에 실행** → 히트에도 조회수 집계 유지 |
| `getHomeBanners` | `cache:home:banners` | 정적 키 |
| `getHotPerformances` | `cache:home:hot` | 정적 키 |
| `getNewPerformances` | `cache:home:new` | 정적 키 |

모두 동일 패턴: `get → 히트면 즉시 return → 미스면 DB 조회 → set → return`.

**`admin.service.ts` — 7개 쓰기 경로에 캐시 무효화:**

공연 CRUD (`private invalidateCatalogCache(id?)` 헬퍼로 집중):
- `createPerformance` → `invalidateCatalogCache()` (list:*, home:*)
- `updatePerformance(id)` → `invalidateCatalogCache(id)` (list:*, home:*, detail:id)
- `deletePerformance(id)` → `invalidateCatalogCache(id)` (list:*, home:*, detail:id)

배너 CRUD (단일 키 무효화):
- `createBanner` → `invalidate('cache:home:banners')`
- `updateBanner` → `invalidate('cache:home:banners')`
- `deleteBanner` → `invalidate('cache:home:banners')`
- `reorderBanners` → `invalidate('cache:home:banners')`

**모듈 배선:** `admin.module.ts`는 이미 `imports: [PerformanceModule, …]` 상태였고 PerformanceModule이 CacheService를 export하므로 AdminModule은 무수정 상태에서 DI로 CacheService를 주입받는다.

**테스트 인프라 업데이트:**
- `performance.service.spec.ts`: `createMockCacheService()` 추가, 생성자 호출에 mockCache 전달
- `admin.service.spec.ts`: 동일 패턴으로 업데이트
- 두 mock 모두 기본적으로 miss(get→null) + set/invalidate no-op → 기존 DB 경로 테스트 어서션 그대로 유지

## Verification Results

**전체 API 테스트:** 145/145 통과 (18 test files)
```
Test Files  18 passed (18)
     Tests  145 passed (145)
```

주요 테스트 파일:
- `modules/performance/__tests__/cache.service.spec.ts` — 12 tests (CacheService)
- `modules/performance/performance.service.spec.ts` — 10 tests (기존 서비스 회귀 확인)
- `modules/admin/admin.service.spec.ts` — 12 tests (기존 서비스 회귀 확인)
- `modules/booking/__tests__/booking.service.spec.ts` — 16 tests (Plan 07-01 회귀)

**TypeScript 컴파일:** `pnpm --filter @grapit/api exec tsc --noEmit` 에러 0건

**캐시 포인트 수동 검증:**
- `grep 'cacheService' performance.service.ts` → 11 hits (5 메서드 × 2 호출 + 1 constructor)
- `grep 'invalidate' admin.service.ts` → 12 hits (3 공연 CRUD + 4 배너 CRUD + 1 private helper + imports/constructors)

## Success Criteria Check

- [x] CacheService가 get/set/invalidate/invalidatePattern 4개 메서드 제공
- [x] PerformanceService 5개 메서드에 read-through 캐시 적용
- [x] AdminService CRUD 7곳에 캐시 무효화 적용 (공연 3 + 배너 4)
- [x] TTL 300초 (5분)
- [x] findById의 viewCount 증가가 캐시 확인 전에 실행됨
- [x] 전체 테스트 통과 (145/145) + TypeScript 컴파일 에러 없음
- [x] Graceful degradation: get()/set() Redis 에러 시에도 요청 경로 유지

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] performance.service.spec.ts / admin.service.spec.ts 생성자 인수 업데이트**
- **Found during:** Task 2 verification (tsc / vitest)
- **Issue:** PerformanceService / AdminService 생성자에 CacheService 파라미터를 추가했기 때문에 기존 spec 파일들이 `new Service(mockDb)` 단일 인수로 호출 중이라 컴파일 실패
- **Fix:** 두 spec 파일에 `createMockCacheService()` 헬퍼 추가 후 생성자 호출에 mockCache 전달. mock은 기본 miss(get→null) + set/invalidate no-op로 구현해 기존 DB 어서션 로직에 영향 없음
- **Files modified:**
  - `apps/api/src/modules/performance/performance.service.spec.ts`
  - `apps/api/src/modules/admin/admin.service.spec.ts`
- **Commit:** `5354233`

**2. [Rule 3 - Blocking] admin.service.ts createPerformance / updatePerformance의 transaction return 패턴 변경**
- **Found during:** Task 2 구현
- **Issue:** 기존 코드는 `return this.db.transaction(async tx => {...})`으로 바로 return. 무효화를 transaction 바깥 post-commit 시점에서 실행하려면 transaction 결과를 먼저 변수로 받아야 함 (transaction 내부에서 cache invalidate 시 실패하면 rollback 영향 있음)
- **Fix:** `const result = await this.db.transaction(...)` → `await this.invalidateCatalogCache(id?)` → `return result` 패턴으로 전환. transaction 커밋 성공 후에만 캐시 무효화가 실행되도록 보장
- **Files modified:** `apps/api/src/modules/admin/admin.service.ts` (createPerformance, updatePerformance)
- **Commit:** `5354233`
- **Rationale:** 플랜 Action 블록의 "return 직전에 추가" 지시를 `transaction().return` 1-liner에 그대로 적용하면 무효화가 transaction 내부에서 실행되어 트랜잭션 rollback 시에도 캐시를 무효화하는 잘못된 동작이 됨

**3. [Plan Consolidation] `invalidateCatalogCache(id?)` private helper 도입**
- **Found during:** Task 2 구현
- **Issue:** 플랜은 createPerformance / updatePerformance / deletePerformance 각각에 동일한 3라인 블록(`invalidatePattern('cache:performances:list:*')`, `invalidatePattern('cache:home:*')`, `invalidate('cache:performances:detail:${id}')`)을 반복 추가하도록 지시
- **Fix:** `private async invalidateCatalogCache(id?)` 헬퍼로 추출하고 3곳에서 호출. list/home invalidate는 Promise.all로 병렬화해 레이턴시도 단축. 결과 행동은 플랜 사양과 동일
- **Commit:** `5354233`

**4. [Out of Scope - Plan Delta] files_modified 목록의 컨트롤러 4개는 실제로 수정 불필요**
- **Plan 선언:** `performance.controller.ts`, `admin-performance.controller.ts`, `admin-banner.controller.ts`, `admin.module.ts`를 files_modified에 포함
- **실제:** 컨트롤러들은 Service를 통해 간접적으로 캐시를 다루므로 변경 불필요. admin.module.ts도 이미 PerformanceModule을 imports하고 있어 CacheService가 자동 주입됨. 플랜 Task 2 Action 4에도 "변경 불필요"라고 명시되어 있음
- **Action:** 이 4개 파일은 수정하지 않음. Deviation이라기보다 플랜 frontmatter의 exhaustive 선언과 실제 "touched files"의 차이

전체 플랜 로직(캐시 키 포맷, TTL, 5 read + 7 invalidate, viewCount 위치)은 사양 그대로 구현됨.

## Dependencies Unblocked

- **Plan 07-03 (Valkey 호환성 검증):** 이 plan의 CacheService가 ioredis API(get/set EX/del/keys)만 사용하므로 Valkey 호환성 검증 표면이 명확해짐 — Plan 07-03 자동화 테스트는 이 5+7 cache 경로만 exercises하면 충분
- **향후 캐시 리팩토링:** CacheService가 PerformanceModule에서 export되므로 다른 모듈(reservation, booking, search)도 동일한 추상화 재사용 가능

## Known Stubs

None. 모든 캐시 경로가 실제 CacheService와 REDIS_CLIENT provider에 연결되어 있으며, CacheService 자체는 InMemoryRedis fallback을 통해 REDIS_URL 미설정 환경에서도 동작한다.

## Threat Flags

플랜의 `<threat_model>`에 정의된 trust boundaries / STRIDE threats(T-07-04 Tampering, T-07-05 DoS KEYS, T-07-06 Info Disclosure)를 벗어나는 새 공격 면은 도입되지 않았다.

- **T-07-04 (캐시 키 Tampering, mitigate):** 모든 캐시 키는 서버에서 생성되며, `findByGenre`의 키에 사용되는 쿼리 파라미터(genre/page/limit/sort/ended/sub)는 이미 `performanceQuerySchema` Zod 검증을 통과한 값이다. `findById`의 `id`는 URL path param으로 기존 컨트롤러에서 검증된다. 사용자 입력이 키에 직접 concatenation되는 경로 없음.
- **T-07-05 (KEYS O(N), accept):** `invalidatePattern`에서 `redis.keys`를 사용. 현재 캐시 키 수는 `cache:performances:list:*` 패턴 하나가 장르(5) × 페이지(~N) × limit(20) × sort(2) × ended(2) × sub(<10) 조합으로 최대 ~수백 개, `cache:home:*` 3개. 전체 합쳐 <1k 예상으로 KEYS가 수ms 이내 완료. 트래픽 증가/키 폭증 시 SCAN + cursor iterate로 교체 필요(Phase 8+).
- **T-07-06 (Info Disclosure, accept):** 캐시 대상은 모두 `@Public` 데코레이터가 붙은 읽기 엔드포인트(performances 목록/상세, home 배너/hot/new)로 인증 없이 접근 가능한 공개 데이터만 캐시. 사용자별 데이터(mypage, booking, auth)는 캐시 대상이 아니다.

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 (RED) | `48ecf86` | test(07-02): add failing tests for CacheService |
| Task 1 (GREEN) | `dafc726` | feat(07-02): implement CacheService + wire into PerformanceModule |
| Task 2 | `5354233` | feat(07-02): apply read-through cache + admin invalidation |

## Self-Check

### Files verified (exist at expected paths)

- [x] `apps/api/src/modules/performance/cache.service.ts` — created
- [x] `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` — created
- [x] `apps/api/src/modules/performance/performance.module.ts` — BookingModule import + CacheService export
- [x] `apps/api/src/modules/performance/performance.service.ts` — 5 cache hit/miss blocks
- [x] `apps/api/src/modules/performance/performance.service.spec.ts` — mockCache injection
- [x] `apps/api/src/modules/admin/admin.service.ts` — `invalidateCatalogCache` + 7 invalidation points
- [x] `apps/api/src/modules/admin/admin.service.spec.ts` — mockCache injection

### Commits verified

- [x] `48ecf86` — found in git log (RED test)
- [x] `dafc726` — found in git log (GREEN impl)
- [x] `5354233` — found in git log (cache + invalidation)

## Self-Check: PASSED
