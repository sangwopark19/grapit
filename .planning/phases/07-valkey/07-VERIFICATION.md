---
phase: 07-valkey
verified: 2026-04-10T04:00:00Z
status: human_needed
score: 8/10 must-haves verified
gaps:
  - truth: "Socket.IO Redis adapter가 동일 ioredis 클라이언트(REDIS_CLIENT)를 사용하여 Valkey pub/sub로 동작한다"
    status: partial
    reason: "redis-io.adapter.ts에 createSocketIoRedisAdapter() 함수가 정의되어 있으나, main.ts 또는 어떤 모듈에서도 app.useAdapter()로 연결되지 않았다. 현재 Socket.IO는 Redis 없이 단독 서버 모드로 실행 중이며, 다중 인스턴스 간 pub/sub 동기화가 동작하지 않는다."
    artifacts:
      - path: "apps/api/src/modules/booking/providers/redis-io.adapter.ts"
        issue: "createSocketIoRedisAdapter() 함수가 정의만 되어 있고 app.useAdapter() 호출이 없다"
      - path: "apps/api/src/main.ts"
        issue: "createSocketIoRedisAdapter 임포트 및 app.useAdapter() 호출이 없다"
    missing:
      - "main.ts에서 REDIS_CLIENT를 주입받아 createSocketIoRedisAdapter를 호출하고 app.useAdapter()에 연결해야 한다"
      - "또는 BookingGateway가 @WebSocketGateway 데코레이터 내에서 adapter를 설정해야 한다"
human_verification:
  - test: "Cloud Run 배포 후 좌석 잠금(SET NX + TTL) 동작 확인"
    expected: "lockSeat 호출 시 Valkey(10.178.0.3:6379)에 SET NX가 성공하고, 600초(10분) 후 키가 자동 만료된다"
    why_human: "Valkey 인스턴스는 VPC 내부 PSC 엔드포인트(10.178.0.3:6379)로만 접근 가능. 로컬/CI에서 연결 불가"
  - test: "Cloud Run → Valkey VPC 연결 안정성 확인"
    expected: "API 서버 기동 시 ioredis 연결 에러 없이 CONNECTED 상태. health check 엔드포인트에서 Redis 연결 OK 응답"
    why_human: "VPC 네트워킹은 배포 후에만 검증 가능. Cloud Run 로그에서 [redis] Error 없음 확인 필요"
  - test: "CLUSTER 모드 Valkey에 ioredis standalone 클라이언트 연결 호환성"
    expected: "new Redis(url, ...) 방식의 standalone 연결이 CLUSTER 모드 Valkey discovery endpoint(10.178.0.3:6379)에서 정상 동작"
    why_human: "Plan 03 SUMMARY에 기록된 알려진 오픈 이슈. Memorystore for Valkey는 단일 샤드라도 CLUSTER 모드로 생성됨. standalone 클라이언트 호환성은 실제 배포에서만 확인 가능. 실패 시 new Redis.Cluster([{host, port}]) 업그레이드 필요"
  - test: "공연 카탈로그 캐시 응답 시간 단축 효과 측정"
    expected: "두 번째 요청부터 DB 조회 없이 Valkey에서 응답하여 레이턴시가 유의미하게 단축됨. TTL 5분(300초) 경과 후 자동 만료되어 DB 재조회"
    why_human: "캐시 히트/미스 실측은 실제 Valkey + DB가 연결된 환경에서만 측정 가능"
---

# Phase 07: Valkey 마이그레이션 검증 리포트

**Phase Goal:** Upstash Redis 제거, ioredis 단일 클라이언트로 Google Memorystore for Valkey에 연결하여 인프라를 단순화한다
**Verified:** 2026-04-10T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | @upstash/redis 패키지가 apps/api/package.json에서 완전히 제거되어 있다 | VERIFIED | package.json에 @upstash 키 없음. src/ 내 모든 import 제거 확인 (dist/는 빌드 아티팩트) |
| 2 | REDIS_CLIENT 단일 Symbol로 provider가 통합되어 있다 | VERIFIED | redis.provider.ts: `export const REDIS_CLIENT = Symbol('REDIS_CLIENT')`. UPSTASH_REDIS/IOREDIS_CLIENT 심볼 없음 |
| 3 | BookingService eval() 3곳이 ioredis 플랫 시그니처(script, numKeys, ...keysAndArgs)를 사용한다 | VERIFIED | lockSeat: `eval(LOCK_SEAT_LUA, 3, ...)`, unlockSeat: `eval(UNLOCK_SEAT_LUA, 3, ...)`, getSeatStatus: `eval(GET_VALID_LOCKED_SEATS_LUA, 1, ...)` |
| 4 | InMemoryRedis mock의 eval()이 ioredis 시그니처로 동작한다 | VERIFIED | redis.provider.ts line 109: `async eval(_script: string, numKeys: number, ...keysAndArgs: (string \| number)[])` |
| 5 | Socket.IO Redis adapter가 동일 ioredis 클라이언트(REDIS_CLIENT)를 사용한다 | FAILED | createSocketIoRedisAdapter()는 정의만 있고 main.ts에서 app.useAdapter() 연결 없음 |
| 6 | CacheService(get/set/invalidate/invalidatePattern)가 존재하고 ioredis REDIS_CLIENT를 주입받는다 | VERIFIED | cache.service.ts: `@Inject(REDIS_CLIENT) private readonly redis: IORedis`. DEFAULT_TTL=300 확인 |
| 7 | PerformanceService 5개 엔드포인트에 read-through 캐시가 적용되어 있다 | VERIFIED | findByGenre/findById/getHomeBanners/getHotPerformances/getNewPerformances 모두 캐시 hit/miss 패턴 구현 |
| 8 | AdminService 7개 쓰기 경로에 캐시 무효화가 적용되어 있다 | VERIFIED | createPerformance/updatePerformance/deletePerformance(invalidateCatalogCache 헬퍼), createBanner/updateBanner/deleteBanner/reorderBanners(cache:home:banners) |
| 9 | scripts/provision-valkey.sh가 존재하고 실행 가능하다 | VERIFIED | 파일 존재 + chmod +x 확인. gcloud memorystore instances create, PSC policy, VALKEY_8_0, asia-northeast3 포함 |
| 10 | deploy.yml에 Direct VPC Egress 플래그 3개 + REDIS_URL Secret이 추가되어 있다 | VERIFIED | --network=default, --subnet=default, --vpc-egress=private-ranges-only 및 REDIS_URL=redis-url:latest 확인. UPSTASH 관련 변수 없음 |

**Score:** 8/10 truths (Truth #5 FAILED — Socket.IO adapter 미연결)

---

### Required Artifacts

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

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| booking.service.ts | redis.provider.ts | @Inject(REDIS_CLIENT) | WIRED | line 99: `@Inject(REDIS_CLIENT) private readonly redis: IORedis` |
| booking.module.ts | redis.provider.ts | providers array | WIRED | redisProvider 등록 + exports |
| cache.service.ts | redis.provider.ts | @Inject(REDIS_CLIENT) | WIRED | line 31: `@Inject(REDIS_CLIENT) private readonly redis: IORedis` |
| performance.module.ts | booking.module.ts | imports array | WIRED | `imports: [BookingModule]` — REDIS_CLIENT provider 접근 |
| performance.service.ts | cache.service.ts | DI injection | WIRED | `this.cacheService.get/set` 11곳 |
| admin.service.ts | cache.service.ts | DI injection | WIRED | `this.cacheService.invalidate/invalidatePattern` 11곳 |
| admin.module.ts | performance.module.ts | imports array | WIRED | `imports: [PerformanceModule, ...]` — CacheService 자동 주입 |
| redis-io.adapter.ts | main.ts | app.useAdapter() | NOT_WIRED | createSocketIoRedisAdapter() 정의만 있고 main.ts에서 호출 없음 |
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

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VALK-01 | Plan 07-01 | @upstash/redis 제거, ioredis 단일 클라이언트로 Valkey 연결 통합 | SATISFIED | package.json에서 제거, REDIS_CLIENT 단일 Symbol, src/ 전체 import 제거 |
| VALK-02 | Plan 07-03 | Google Memorystore for Valkey 프로비저닝 (PSC + Direct VPC Egress) | SATISFIED | provision-valkey.sh 실행 완료(07-03-SUMMARY), 인스턴스 ACTIVE, deploy.yml VPC 플래그 적용 |
| VALK-03 | Plan 07-01 | 좌석 잠금 Lua 스크립트 Valkey 호환성 검증 및 수정 | SATISFIED (코드 수준) | eval() ioredis 플랫 시그니처로 변환, InMemoryRedis mock 동기화, 16/16 테스트 통과. 런타임 Valkey 검증은 human_verification |
| VALK-04 | Plan 07-01 | Socket.IO Redis adapter가 ioredis로 Valkey pub/sub 정상 동작 확인 | BLOCKED | createSocketIoRedisAdapter()가 정의되어 있으나 main.ts에서 app.useAdapter() 연결 없음. 단일 인스턴스에서는 동작하지만 다중 인스턴스 pub/sub 불가 |
| VALK-05 | Plan 07-03 | Cloud Run → Valkey VPC 네트워킹 설정 | SATISFIED (코드 수준) | deploy.yml에 --network=default --subnet=default --vpc-egress=private-ranges-only 적용. 실제 연결 확인은 human_verification |
| VALK-06 | Plan 07-02 | 성능 카탈로그 캐시 레이어 구현 | SATISFIED | CacheService + PerformanceService 5개 캐시 + AdminService 7개 무효화. TTL 300초. 145/145 테스트 통과 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/api/dist/ | N/A | 오래된 빌드 아티팩트에 @upstash/redis 참조 남아 있음 | INFO | dist/는 런타임에 사용되지 않음 (Docker 이미지에서 새 빌드 수행). 무시 가능 |
| apps/api/src/modules/booking/providers/redis-io.adapter.ts | 1-16 | createSocketIoRedisAdapter() 정의만 있고 실제 연결 없음 | WARNING | Socket.IO가 Redis adapter 없이 실행 중. 단일 인스턴스에서는 동작하지만 Cloud Run 다중 인스턴스 배포 시 좌석 상태가 인스턴스 간 동기화되지 않음 |
| apps/api/src/modules/admin/admin.service.ts | 39-47 | invalidatePattern에서 KEYS 명령어 사용 (O(N)) | INFO | Plan 07 SUMMARY에서 accept로 결정. 현재 캐시 키 수 <1k로 안전. 트래픽 증가 시 SCAN으로 교체 필요 |

---

### Human Verification Required

#### 1. Cloud Run 배포 후 좌석 잠금 동작 확인

**Test:** 다음 Cloud Run 배포 후 lockSeat API 호출
**Expected:** Valkey(10.178.0.3:6379)에 `seat:{showtimeId}:{seatId}` 키로 SET NX 성공, TTL 600초(10분) 설정, 만료 후 자동 해제
**Why human:** Valkey 인스턴스는 VPC PSC 전용 엔드포인트라 로컬/CI에서 접근 불가

#### 2. ioredis standalone → CLUSTER 모드 Valkey 연결 호환성

**Test:** 다음 Cloud Run 배포 시 API 서버 시작 로그 확인
**Expected:** `[redis] Error:` 로그 없이 ioredis CONNECTED 상태. `redis://10.178.0.3:6379`에 standalone 클라이언트로 정상 연결
**Why human:** Plan 03 SUMMARY에 기록된 오픈 이슈. Memorystore for Valkey는 단일 샤드도 CLUSTER 모드로 생성. standalone 클라이언트 호환성은 실제 배포에서만 확인 가능. 실패 시 `new Redis.Cluster([{host:'10.178.0.3', port:6379}])` 업그레이드 필요

#### 3. Cloud Run → Valkey VPC 연결 안정성

**Test:** 배포 완료 후 `GET /api/v1/health` 엔드포인트 호출 및 Cloud Run 로그 모니터링
**Expected:** Redis health check OK, 30분 idle 후 재연결 시에도 에러 없음
**Why human:** VPC Direct Egress 네트워킹은 실제 배포 환경에서만 검증 가능

#### 4. Socket.IO Redis adapter 연결 수정 후 다중 인스턴스 pub/sub 검증

**Test:** VALK-04 gap 수정(app.useAdapter 연결) 후, Cloud Run 2개 인스턴스에서 좌석 잠금 이벤트가 양쪽 인스턴스의 클라이언트에게 전파되는지 확인
**Expected:** 인스턴스 A에서 lockSeat → 인스턴스 B에 연결된 클라이언트가 seat-update 이벤트 수신
**Why human:** 다중 인스턴스 실시간 동기화는 런타임 검증 필요

---

### Gaps Summary

**VALK-04 (Socket.IO Redis adapter 미연결) — 코드 레벨 버그:**

`apps/api/src/modules/booking/providers/redis-io.adapter.ts`에 `createSocketIoRedisAdapter()` 함수가 존재하지만, `apps/api/src/main.ts` 어디에서도 `app.useAdapter()`가 호출되지 않습니다. 현재 Socket.IO는 Redis adapter 없이 단독 실행 중입니다.

**영향:** 단일 Cloud Run 인스턴스에서는 좌석 잠금 브로드캐스트가 동작합니다(같은 프로세스 내 브로드캐스트). 그러나 Cloud Run이 2개 이상의 인스턴스로 스케일 아웃되면 인스턴스 간 pub/sub 동기화가 되지 않아 일부 클라이언트가 좌석 상태 업데이트를 받지 못합니다.

**수정 방법:** main.ts에서 REDIS_CLIENT를 주입받아 app.useAdapter()로 연결하거나, NestJS WebSocket adapter 패턴에 따라 AppModule에서 처리해야 합니다.

```typescript
// main.ts 예시
import { createSocketIoRedisAdapter } from './modules/booking/providers/redis-io.adapter.js';

// bootstrap 함수 내에서:
const redisClient = app.get<IORedis>(REDIS_CLIENT);
app.useWebSocketAdapter(new IoAdapter(app)); // 기본 어댑터
// 또는 Redis adapter를 직접 연결하는 커스텀 adapter 구현 필요
```

---

## 요약

Phase 07 코드 작업의 핵심 목표(Upstash 제거, ioredis 통합, 캐시 레이어 구현, VPC 인프라 설정)는 대부분 달성되었습니다. 10개 Observable Truth 중 8개가 코드 레벨에서 완전히 검증되었으며, 나머지 2개는 런타임(VPC) 검증이 필요합니다.

**코드 레벨 버그 1건 발견:** VALK-04 — `createSocketIoRedisAdapter()`가 정의되어 있으나 `main.ts`에서 연결되지 않아 Socket.IO Redis adapter가 비활성화 상태입니다. 단일 인스턴스에서는 동작하지만 Cloud Run 스케일 아웃 시 좌석 실시간 동기화가 깨집니다.

다음 배포 전 수정이 권장됩니다.

---

_Verified: 2026-04-10T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
