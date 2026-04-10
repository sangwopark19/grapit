---
phase: 07-valkey
verified: 2026-04-10T04:00:00Z
re_verified: 2026-04-10T04:30:00Z
re_verified_plans_04_05: 2026-04-10T06:00:00Z
status: human_needed
score: 14/14 must-haves verified (code-level)
gaps: []
gaps_resolved:
  - truth: "Socket.IO Redis adapter가 동일 ioredis 클라이언트(REDIS_CLIENT)를 사용하여 Valkey pub/sub로 동작한다"
    resolved_in: "commit 2747566 fix(07-04): wire Socket.IO to REDIS_CLIENT via RedisIoAdapter"
    resolution: |
      apps/api/src/modules/booking/providers/redis-io.adapter.ts에 NestJS
      IoAdapter를 확장한 `RedisIoAdapter` 클래스를 추가했다. `connectToRedis()`가
      주입된 ioredis 클라이언트를 `duplicate()`하여 @socket.io/redis-adapter용
      pub/sub 쌍을 구성하고, `createIOServer()`에서 server.adapter()로 연결한다.
      InMemoryRedis mock처럼 `duplicate()`가 없는 클라이언트는 false를 반환하고
      기본 in-process adapter로 graceful fallback 한다.
      main.ts의 bootstrap()이 REDIS_CLIENT를 DI에서 해석하여 `app.useWebSocketAdapter()`에
      등록하므로 Cloud Run 다중 인스턴스에서 seat-update 이벤트가 Valkey pub/sub를
      통해 전파된다. 단위 테스트 3건이 redis-io.adapter.spec.ts에 추가되었고
      148/148 테스트가 통과한다.
human_verification:
  - test: "Cloud Run 배포 후 좌석 잠금(SET NX + TTL) 동작 확인"
    expected: "lockSeat 호출 시 Valkey(10.178.0.3:6379)에 SET NX가 성공하고, 600초(10분) 후 키가 자동 만료된다"
    why_human: "Valkey 인스턴스는 VPC 내부 PSC 엔드포인트(10.178.0.3:6379)로만 접근 가능. 로컬/CI에서 연결 불가"
  - test: "Cloud Run → Valkey VPC 연결 안정성 확인 (/health redis 키 up 응답)"
    expected: "API 서버 기동 시 ioredis 연결 에러 없이 CONNECTED 상태. GET /api/v1/health에서 redis.status=up 응답. 30분 idle 후 재연결도 에러 없음"
    why_human: "VPC 네트워킹은 배포 후에만 검증 가능. Plan 05에서 /health에 RedisHealthIndicator 추가됨 — 이제 503으로 장애를 노출하나 실제 Valkey에 대한 ping 응답은 배포 후에만 확인 가능"
  - test: "CLUSTER 모드 Valkey에 ioredis standalone 클라이언트 연결 호환성"
    expected: "new Redis(url, ...) 방식의 standalone 연결이 CLUSTER 모드 Valkey discovery endpoint(10.178.0.3:6379)에서 정상 동작"
    why_human: "Plan 03 SUMMARY에 기록된 알려진 오픈 이슈. Memorystore for Valkey는 단일 샤드라도 CLUSTER 모드로 생성됨. standalone 클라이언트 호환성은 실제 배포에서만 확인 가능. 실패 시 new Redis.Cluster([{host, port}]) 업그레이드 필요"
  - test: "공연 카탈로그 캐시 응답 시간 단축 효과 측정"
    expected: "두 번째 요청부터 DB 조회 없이 Valkey에서 응답하여 레이턴시가 유의미하게 단축됨. TTL 5분(300초) 경과 후 자동 만료되어 DB 재조회"
    why_human: "캐시 히트/미스 실측은 실제 Valkey + DB가 연결된 환경에서만 측정 가능"
  - test: "Socket.IO Redis adapter 다중 인스턴스 pub/sub 전파 (Plan 04 옵션 적용 후)"
    expected: "Cloud Run 2개 인스턴스에서 인스턴스 A의 lockSeat → 인스턴스 B 클라이언트가 seat-update 이벤트 수신. duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false }) 옵션 적용으로 network flap 시에도 subscription 유지"
    why_human: "다중 인스턴스 실시간 동기화는 런타임 검증 필요"
---

# Phase 07: Valkey 마이그레이션 검증 리포트

**Phase Goal:** Upstash Redis 제거, ioredis 단일 클라이언트로 Google Memorystore for Valkey에 연결하여 인프라를 단순화한다
**Verified:** 2026-04-10T04:00:00Z
**Re-verified (Plans 01-03 gap):** 2026-04-10T04:30:00Z — VALK-04 gap closed by commit `2747566`
**Re-verified (Plans 04+05):** 2026-04-10T06:00:00Z — additive plans close 07-REVIEWS.md HIGH #1, #2, #3 + MEDIUM #6, #7, #8
**Status:** human_needed (code-level VERIFIED 14/14, 5 items require post-deploy runtime verification)

---

## Plans 04+05 Re-verification (2026-04-10T06:00:00Z)

This section documents the incremental re-verification triggered by plans 04 and 05 being added after the initial verification cycle.

### Re-verification Scope

Plan 04 must_haves (4 items):
1. 프로덕션 REDIS_URL 미설정 시 hard-fail (silent InMemoryRedis fallback 금지)
2. CacheService.invalidate() / invalidatePattern() Redis 장애 시 예외 전파 금지 + Logger.warn
3. createSocketIoRedisAdapter sub connection이 `maxRetriesPerRequest: null + enableReadyCheck: false` 옵션을 갖는다
4. 07-HUMAN-UAT.md가 PR #13 merge 전 필수 release gate임이 명시된다

Plan 05 must_haves (4 items):
1. GET /api/v1/health가 Valkey ping 결과를 포함하여 redis 키의 status가 up/down으로 응답된다
2. Valkey 연결이 끊어지면 /api/v1/health가 503을 반환하여 Cloud Run liveness probe가 실패한다
3. lockSeat → getSeatStatus → unlockSeat 플로우가 실제 Valkey 8 컨테이너에서 Lua 라운드트립 검증된다
4. 통합 테스트가 별도 vitest config으로 격리되며 `pnpm test:integration`으로만 실행된다

### Observable Truths — Plans 04+05

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P04-1 | 프로덕션 REDIS_URL 미설정 시 앱이 부트 실패한다 | VERIFIED | `redis.provider.ts` line 223-229: `process.env['NODE_ENV'] === 'production'` 분기에서 `throw new Error('[redis] REDIS_URL is required in production environment...')`. 개발/테스트 환경은 InMemoryRedis fallback 유지 |
| P04-2 | CacheService.invalidate/invalidatePattern이 Redis 장애 시 예외를 전파하지 않는다 | VERIFIED | `cache.service.ts` lines 67-93: invalidate() + invalidatePattern() 모두 try/catch 블록으로 래핑. catch 블록에서 `this.logger.warn({ err, keys, op }, ...)` 로깅 후 return. throw 없음 |
| P04-3 | redis-io.adapter.ts의 duplicate() 호출이 올바른 옵션을 전달한다 | VERIFIED | `redis-io.adapter.ts` lines 22-25 (createSocketIoRedisAdapter) 및 lines 88-91 (connectToRedis): 양쪽 모두 `duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false })` 호출 확인 |
| P04-4 | 07-HUMAN-UAT.md가 PR #13 merge-blocking release gate로 선언되어 있다 | VERIFIED | `07-HUMAN-UAT.md` frontmatter: `merge_blocking: true`, `required_state: "all 4 tests below MUST be marked PASS before PR #13 can be merged to main"`. 본문 첫 섹션 "Release Gate — PR #13 Merge Requirements"로 시작 |
| P05-1 | GET /api/v1/health가 redis 키 status를 up/down으로 포함한다 | VERIFIED | `health.controller.ts` line 18: `() => this.redisIndicator.isHealthy('redis')` 체크 배열에 포함. `redis.health.indicator.ts` line 32-38: `ping() === 'PONG'` → up, 그 외 → down |
| P05-2 | Valkey 연결 끊김 시 /api/v1/health가 503을 반환한다 | VERIFIED (코드 수준) | `redis.health.indicator.ts` catch 블록: `indicator.down({ message: err.message })`. Terminus는 down() 결과가 있으면 503을 응답하는 것이 문서화된 동작. 실제 Valkey 연결 끊김 시나리오는 human_verification #2 |
| P05-3 | Lua 스크립트 실제 Valkey 8 컨테이너 라운드트립 스펙이 존재한다 | VERIFIED (파일 존재, Docker 미실행) | `booking.service.integration.spec.ts`: 5개 테스트 케이스(lock/list/conflict/unlock/non-owner). `GenericContainer('valkey/valkey:8-alpine')` 사용. 로컬에서 Docker 없이는 실행 불가 — CI에서 검증 예정 |
| P05-4 | 통합 테스트가 별도 vitest config으로 격리되고 test:integration 스크립트가 있다 | VERIFIED | `vitest.config.ts` line 14: `'**/*.integration.spec.ts'` exclude 확인. `vitest.integration.config.ts` line 15: `include: ['**/*.integration.spec.ts']`. `package.json` line 12: `"test:integration": "vitest run --config vitest.integration.config.ts"` |

**Plans 04+05 Score: 8/8 must-haves verified (code-level)**

---

### Artifact Verification — Plans 04+05

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/booking/providers/redis.provider.ts` | `NODE_ENV=production + !REDIS_URL → throw Error(...)` | VERIFIED | line 218-229: production hard-fail 분기 구현. `process.env['NODE_ENV'] === 'production'`에서 throw |
| `apps/api/src/modules/performance/cache.service.ts` | invalidate/invalidatePattern try/catch + Logger.warn | VERIFIED | lines 35, 67-93: `private readonly logger = new Logger(...)` + 양쪽 메서드 try/catch + logger.warn |
| `apps/api/src/modules/booking/providers/redis-io.adapter.ts` | `duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false })` 두 곳 | VERIFIED | line 22-25 (createSocketIoRedisAdapter), line 88-91 (connectToRedis) — 두 호출 경로 모두 옵션 전달 |
| `.planning/phases/07-valkey/07-HUMAN-UAT.md` | merge_blocking: true + release gate 섹션 | VERIFIED | frontmatter `merge_blocking: true` + 본문 "Release Gate — PR #13 Merge Requirements" 섹션 |
| `apps/api/src/health/redis.health.indicator.ts` | RedisHealthIndicator — @Inject(REDIS_CLIENT) + redis.ping() + up/down | VERIFIED | lines 23-41: @Inject(REDIS_CLIENT), ping(), PONG 비교, indicator.up()/down() |
| `apps/api/src/health/health.controller.ts` | this.health.check([() => this.redisIndicator.isHealthy('redis')]) | VERIFIED | line 17-19: 체크 배열에 redisIndicator.isHealthy('redis') 포함 |
| `apps/api/src/health/health.module.ts` | imports: [TerminusModule, BookingModule]; providers: [RedisHealthIndicator] | VERIFIED | line 8: `imports: [TerminusModule, BookingModule]`, line 10: `providers: [RedisHealthIndicator]` |
| `apps/api/src/modules/booking/__tests__/booking.service.integration.spec.ts` | 실제 Valkey 8 컨테이너 Lua 라운드트립 (5 tests) | VERIFIED (파일 존재) | 5개 테스트: lock/list/conflict/unlock/non-owner. `GenericContainer('valkey/valkey:8-alpine').withExposedPorts(6379)` 패턴 |
| `apps/api/vitest.integration.config.ts` | include: ['**/*.integration.spec.ts'], hookTimeout: 120000 | VERIFIED | line 15: `include: ['**/*.integration.spec.ts']`, line 17: `hookTimeout: 120000` |
| `apps/api/package.json` | test:integration script + testcontainers devDep | VERIFIED | line 12: `"test:integration": "vitest run --config vitest.integration.config.ts"`, devDependencies line 71: `"testcontainers": "^11.14.0"` |

---

### Key Link Verification — Plans 04+05

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `redis.provider.ts` | `process.env.NODE_ENV` | production 분기 조건 | WIRED | `process.env['NODE_ENV'] === 'production'` + throw |
| `cache.service.ts` | `@nestjs/common Logger` | `private readonly logger = new Logger(CacheService.name)` | WIRED | line 35: Logger 필드 선언. invalidate/invalidatePattern catch에서 `this.logger.warn()` 호출 |
| `redis-io.adapter.ts` | ioredis duplicate options | `duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false })` | WIRED | 두 곳(createSocketIoRedisAdapter + connectToRedis) 모두 옵션 전달 |
| `redis.health.indicator.ts` | REDIS_CLIENT symbol | `@Inject(REDIS_CLIENT)` | WIRED | line 26: `@Inject(REDIS_CLIENT) private readonly redis: IORedis` |
| `health.module.ts` | BookingModule (REDIS_CLIENT export) | `imports: [TerminusModule, BookingModule]` | WIRED | line 8: BookingModule import — redisProvider re-export로 REDIS_CLIENT DI 접근 |
| `health.controller.ts` | RedisHealthIndicator | constructor injection + check array | WIRED | line 10: constructor 주입. line 18: isHealthy('redis') 체크 배열 등록 |

---

### Requirements Coverage — Plans 04+05 추가 기여

| Requirement | Plans | Status | Plan 04+05 기여 |
|-------------|-------|--------|----------------|
| VALK-01 | 01, 04 | SATISFIED | Plan 04: production hard-fail로 misconfigured deploy 방지 강화 |
| VALK-03 | 01, 04, 05 | SATISFIED (코드+통합 스펙) | Plan 04: duplicate() 옵션으로 pub/sub 안정성 강화. Plan 05: testcontainers Lua 라운드트립 스펙 추가 |
| VALK-04 | 01, 04, 05 | SATISFIED (코드+통합 스펙) | Plan 04: duplicate() options. Plan 05: health indicator로 연결 상태 노출 |
| VALK-05 | 03, 05 | SATISFIED (코드 수준) | Plan 05: /health Redis 체크로 Cloud Run liveness probe 강화 |
| VALK-06 | 02, 04 | SATISFIED | Plan 04: invalidate 비차단화로 admin 500 방지 |

---

### Anti-Patterns — Plans 04+05

계획된 backlog 항목들로, 스코프에서 명시적으로 제외됨:

| File | Pattern | Severity | Note |
|------|---------|----------|------|
| `cache.service.ts` | `redis.keys(pattern)` (O(N) KEYS) | INFO | Plan 07 내 accept 결정. 현재 캐시 키 수 <100으로 안전. SCAN 전환은 backlog |
| `booking.service.integration.spec.ts` | Docker 없이 실행 불가 | INFO | 설계 의도: CI에서만 실행. `pnpm test` 기본 제외 확인됨 |

신규 blocker 없음.

---

## Original Verification (Plans 01-03)

### Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | @upstash/redis 패키지가 apps/api/package.json에서 완전히 제거되어 있다 | VERIFIED | package.json에 @upstash 키 없음. src/ 내 모든 import 제거 확인 (dist/는 빌드 아티팩트) |
| 2 | REDIS_CLIENT 단일 Symbol로 provider가 통합되어 있다 | VERIFIED | redis.provider.ts: `export const REDIS_CLIENT = Symbol('REDIS_CLIENT')`. UPSTASH_REDIS/IOREDIS_CLIENT 심볼 없음 |
| 3 | BookingService eval() 3곳이 ioredis 플랫 시그니처(script, numKeys, ...keysAndArgs)를 사용한다 | VERIFIED | lockSeat: `eval(LOCK_SEAT_LUA, 3, ...)`, unlockSeat: `eval(UNLOCK_SEAT_LUA, 3, ...)`, getSeatStatus: `eval(GET_VALID_LOCKED_SEATS_LUA, 1, ...)` |
| 4 | InMemoryRedis mock의 eval()이 ioredis 시그니처로 동작한다 | VERIFIED | redis.provider.ts line 109: `async eval(_script: string, numKeys: number, ...keysAndArgs: (string \| number)[])` |
| 5 | Socket.IO Redis adapter가 동일 ioredis 클라이언트(REDIS_CLIENT)를 사용한다 | VERIFIED | commit `2747566`: `RedisIoAdapter` NestJS class 추가 + main.ts `useWebSocketAdapter()` 연결. InMemoryRedis 시 graceful fallback. 148/148 tests |
| 6 | CacheService(get/set/invalidate/invalidatePattern)가 존재하고 ioredis REDIS_CLIENT를 주입받는다 | VERIFIED | cache.service.ts: `@Inject(REDIS_CLIENT) private readonly redis: IORedis`. DEFAULT_TTL=300 확인 |
| 7 | PerformanceService 5개 엔드포인트에 read-through 캐시가 적용되어 있다 | VERIFIED | findByGenre/findById/getHomeBanners/getHotPerformances/getNewPerformances 모두 캐시 hit/miss 패턴 구현 |
| 8 | AdminService 7개 쓰기 경로에 캐시 무효화가 적용되어 있다 | VERIFIED | createPerformance/updatePerformance/deletePerformance(invalidateCatalogCache 헬퍼), createBanner/updateBanner/deleteBanner/reorderBanners(cache:home:banners) |
| 9 | scripts/provision-valkey.sh가 존재하고 실행 가능하다 | VERIFIED | 파일 존재 + chmod +x 확인. gcloud memorystore instances create, PSC policy, VALKEY_8_0, asia-northeast3 포함 |
| 10 | deploy.yml에 Direct VPC Egress 플래그 3개 + REDIS_URL Secret이 추가되어 있다 | VERIFIED | --network=default, --subnet=default, --vpc-egress=private-ranges-only 및 REDIS_URL=redis-url:latest 확인. UPSTASH 관련 변수 없음 |

**Plans 01-03 Score:** 10/10 truths (Truth #5 resolved by commit `2747566` during verification cycle)

---

### Required Artifacts (Plans 01-03)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/booking/providers/redis.provider.ts` | REDIS_CLIENT 단일 ioredis provider + InMemoryRedis mock (ioredis eval 시그니처) | VERIFIED | REDIS_CLIENT Symbol export, redisProvider export, eval() ioredis 시그니처 구현 |
| `apps/api/src/config/redis.config.ts` | redis.url 단일 키만 제공 (upstashUrl/upstashToken 제거) | VERIFIED | `url: process.env['REDIS_URL'] ?? ''` 단일 키 |
| `apps/api/src/modules/booking/booking.service.ts` | eval(script, numKeys, ...keys, ...args) 시그니처 사용 | VERIFIED | 3곳 모두 numKeys를 두 번째 인자로 전달 |
| `apps/api/src/modules/booking/booking.module.ts` | redisProvider 단일 등록 + exports에 포함 | VERIFIED | providers: [BookingService, BookingGateway, redisProvider], exports: [..., redisProvider] |
| `apps/api/src/modules/performance/cache.service.ts` | CacheService: get/set/invalidate/invalidatePattern | VERIFIED | 4개 메서드 구현, graceful degradation 패턴 적용 |
| `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` | CacheService 유닛 테스트 | VERIFIED | 12개 테스트 (miss/hit/error/TTL/round-trip/invalidation) |
| `scripts/provision-valkey.sh` | GCP Memorystore for Valkey 프로비저닝 스크립트 | VERIFIED | 실행 권한 있음, 4단계(API enable + PSC policy + instance create + describe) |
| `.github/workflows/deploy.yml` | Cloud Run Direct VPC Egress + REDIS_URL Secret 설정 | VERIFIED | 3개 VPC Egress 플래그 + REDIS_URL=redis-url:latest 추가됨 |

---

### Key Link Verification (Plans 01-03)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| booking.service.ts | redis.provider.ts | @Inject(REDIS_CLIENT) | WIRED | line 99: `@Inject(REDIS_CLIENT) private readonly redis: IORedis` |
| booking.module.ts | redis.provider.ts | providers array | WIRED | redisProvider 등록 + exports |
| cache.service.ts | redis.provider.ts | @Inject(REDIS_CLIENT) | WIRED | line 31: `@Inject(REDIS_CLIENT) private readonly redis: IORedis` |
| performance.module.ts | booking.module.ts | imports array | WIRED | `imports: [BookingModule]` — REDIS_CLIENT provider 접근 |
| performance.service.ts | cache.service.ts | DI injection | WIRED | `this.cacheService.get/set` 11곳 |
| admin.service.ts | cache.service.ts | DI injection | WIRED | `this.cacheService.invalidate/invalidatePattern` 11곳 |
| admin.module.ts | performance.module.ts | imports array | WIRED | `imports: [PerformanceModule, ...]` — CacheService 자동 주입 |
| redis-io.adapter.ts | main.ts | app.useWebSocketAdapter() | WIRED | commit `2747566`: main.ts bootstrap()에서 `RedisIoAdapter` 인스턴스화 + `connectToRedis()` + `app.useWebSocketAdapter()` |
| deploy.yml | GCP Secret Manager | secrets mapping | WIRED | REDIS_URL=redis-url:latest |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| performance.service.ts findByGenre | cached / result | this.cacheService.get → DB query → this.cacheService.set | get miss 시 실제 DB 쿼리 실행, set으로 Valkey 저장 | FLOWING |
| performance.service.ts findById | cached / result | this.cacheService.get → DB query → this.cacheService.set | viewCount 증가 후 캐시 확인, miss 시 DB full 조회 | FLOWING |
| cache.service.ts set() | redis.set() | ioredis.set(key, JSON.stringify(data), 'EX', ttl) | 실제 Redis SET EX 호출 | FLOWING |
| cache.service.ts get() | redis.get() | ioredis.get(key) → JSON.parse | 실제 Redis GET 호출 | FLOWING |
| booking.service.ts lockSeat | redis.eval() | Lua LOCK_SEAT_LUA 스크립트 | SET NX + EX 600을 Lua에서 원자적 실행 | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (Valkey 인스턴스가 VPC 내부 전용 엔드포인트 10.178.0.3:6379로만 접근 가능하여 로컬에서 실행 불가)

---

### Requirements Coverage (전체)

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VALK-01 | 01, 04 | @upstash/redis 제거, ioredis 단일 클라이언트로 Valkey 연결 통합 | SATISFIED | package.json에서 제거, REDIS_CLIENT 단일 Symbol, src/ 전체 import 제거. Plan 04: production hard-fail 강화 |
| VALK-02 | 03 | Google Memorystore for Valkey 프로비저닝 (PSC + Direct VPC Egress) | SATISFIED | provision-valkey.sh 실행 완료(07-03-SUMMARY), 인스턴스 ACTIVE, deploy.yml VPC 플래그 적용 |
| VALK-03 | 01, 04, 05 | 좌석 잠금 Lua 스크립트 Valkey 호환성 검증 및 수정 | SATISFIED (코드+통합 스펙) | eval() ioredis 플랫 시그니처로 변환, InMemoryRedis mock 동기화. Plan 05: testcontainers 통합 스펙 추가. 런타임 Valkey 검증은 human_verification |
| VALK-04 | 01, 04 | Socket.IO Redis adapter가 ioredis로 Valkey pub/sub 정상 동작 확인 | SATISFIED (코드 수준) | `RedisIoAdapter` + main.ts `useWebSocketAdapter()` 연결. Plan 04: duplicate() 옵션 추가. 런타임 다중 인스턴스 검증은 human_verification |
| VALK-05 | 03, 05 | Cloud Run → Valkey VPC 네트워킹 설정 | SATISFIED (코드 수준) | deploy.yml VPC Egress 플래그 적용. Plan 05: /health Redis indicator로 연결 상태 노출 강화. 실제 연결 확인은 human_verification |
| VALK-06 | 02, 04 | 성능 카탈로그 캐시 레이어 구현 | SATISFIED | CacheService + PerformanceService 5개 캐시 + AdminService 7개 무효화. Plan 04: invalidate 비차단화로 admin CRUD 500 방지 |

---

### Anti-Patterns Found (전체)

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/api/dist/ | N/A | 오래된 빌드 아티팩트에 @upstash/redis 참조 남아 있음 | INFO | dist/는 런타임에 사용되지 않음 (Docker 이미지에서 새 빌드 수행). 무시 가능 |
| apps/api/src/modules/admin/admin.service.ts | 39-47 | invalidatePattern에서 KEYS 명령어 사용 (O(N)) | INFO | Plan 07 내 accept 결정. 현재 캐시 키 수 <1k로 안전. 트래픽 증가 시 SCAN으로 교체 필요 (backlog) |

---

### Human Verification Required

#### 1. Cloud Run 배포 후 좌석 잠금(SET NX + TTL) 동작 확인

**Test:** 다음 Cloud Run 배포 후 lockSeat API 호출
**Expected:** Valkey(10.178.0.3:6379)에 `seat:{showtimeId}:{seatId}` 키로 SET NX 성공, TTL 600초(10분) 설정, 만료 후 자동 해제
**Why human:** Valkey 인스턴스는 VPC PSC 전용 엔드포인트라 로컬/CI에서 접근 불가

#### 2. Cloud Run → Valkey VPC 연결 안정성 (/health redis 키 확인 포함)

**Test:** 배포 완료 후 `GET /api/v1/health` 엔드포인트 호출 및 Cloud Run 로그 모니터링
**Expected:** 응답 JSON에 `"redis": { "status": "up" }` 포함. 30분 idle 후 재연결 시에도 에러 없음
**Why human:** Plan 05에서 RedisHealthIndicator가 /health에 추가됨. 실제 Valkey ping 응답 및 VPC Direct Egress 네트워킹은 배포 후에만 검증 가능

#### 3. ioredis standalone → CLUSTER 모드 Valkey 연결 호환성

**Test:** 다음 Cloud Run 배포 시 API 서버 시작 로그 확인
**Expected:** `[redis] Error:` 로그 없이 ioredis CONNECTED 상태. `redis://10.178.0.3:6379`에 standalone 클라이언트로 정상 연결
**Why human:** Plan 03 SUMMARY에 기록된 오픈 이슈. Memorystore for Valkey는 단일 샤드도 CLUSTER 모드로 생성. standalone 클라이언트 호환성은 실제 배포에서만 확인 가능. 실패 시 `new Redis.Cluster([{host:'10.178.0.3', port:6379}])` 업그레이드 필요

#### 4. 공연 카탈로그 캐시 응답 시간 단축 측정

**Test:** 배포 후 `/api/v1/performances?genre=MUSICAL` 두 번 연속 호출
**Expected:** 두 번째 요청이 DB 조회 없이 Valkey에서 응답하여 레이턴시가 유의미하게 단축됨. TTL 300초 경과 후 자동 만료
**Why human:** 캐시 히트/미스 실측은 실제 Valkey + DB가 연결된 환경에서만 측정 가능

#### 5. Socket.IO Redis adapter 다중 인스턴스 pub/sub 전파 (Plan 04 옵션 적용 후)

**Test:** Cloud Run 2개 인스턴스에서 좌석 잠금 이벤트 전파 확인
**Expected:** 인스턴스 A에서 lockSeat → 인스턴스 B에 연결된 클라이언트가 seat-update 이벤트 수신. Plan 04에서 `duplicate({ maxRetriesPerRequest: null, enableReadyCheck: false })` 적용으로 network flap 시에도 subscription 유지
**Why human:** 다중 인스턴스 실시간 동기화는 런타임 검증 필요

---

### Gaps Summary

**Plans 04+05 이후 코드 레벨 gap 없음.** 07-REVIEWS.md의 모든 HIGH/MEDIUM-공통 이슈가 해소되었다:

- HIGH #1 (silent InMemoryRedis fallback) → Plan 04 Task 1에서 production hard-fail로 해소
- HIGH #2 (실제 Valkey 런타임 테스트 0건) → Plan 05 Task 2에서 testcontainers 통합 스펙으로 해소
- HIGH #3 (non-blocking human checkpoint) → Plan 04 Task 4에서 07-HUMAN-UAT.md merge-blocking gate로 해소
- MEDIUM #6 (invalidate 예외 전파) → Plan 04 Task 2에서 try/catch + Logger.warn으로 해소
- MEDIUM #7 (HealthController Valkey ping 부재) → Plan 05 Task 1에서 RedisHealthIndicator로 해소
- MEDIUM #8 (Socket.IO duplicate() 옵션 누락) → Plan 04 Task 3에서 옵션 전달로 해소

**남은 검증 항목 5건은 모두 런타임/배포 의존적**이며 human_verification 섹션에 기록됨. 07-HUMAN-UAT.md의 merge-blocking release gate가 활성화되어 있어 4건의 런타임 검증 PASS 전까지 PR #13 merge가 차단된다.

**통합 테스트 주의:** `booking.service.integration.spec.ts`는 Docker가 없는 환경에서 실행 불가. CI 파이프라인에서 Docker-in-Docker 활성화 후 `pnpm test:integration` 실행 시 실제 Valkey 8 컨테이너에서 5개 Lua 테스트가 검증된다.

---

_Verified: 2026-04-10T04:00:00Z_
_Re-verified: 2026-04-10T04:30:00Z (VALK-04 gap closed inline)_
_Re-verified (Plans 04+05): 2026-04-10T06:00:00Z (operational safety fixes + health indicator + integration spec)_
_Verifier: Claude (gsd-verifier)_
