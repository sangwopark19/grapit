# Phase 7: Valkey 마이그레이션 - Research

**Researched:** 2026-04-10
**Domain:** Redis/Valkey 클라이언트 마이그레이션, GCP Memorystore 인프라, 캐시 레이어 구현
**Confidence:** HIGH

## Summary

이 phase는 Upstash Redis(@upstash/redis HTTP) + ioredis(TCP) 이원화 구조를 Google Memorystore for Valkey + ioredis 단일 TCP 클라이언트로 전환하는 작업이다. 핵심 변환 포인트는 3가지다: (1) Upstash `eval(script, keys[], args[])` 시그니처를 ioredis `eval(script, numKeys, ...keys, ...args)` 플랫 시그니처로 변환, (2) GCP Memorystore for Valkey를 PSC(Private Service Connect) 기반으로 프로비저닝하고 Cloud Run Direct VPC Egress로 연결, (3) 공연 카탈로그 캐시 레이어 신규 구현.

ioredis 5.10.1은 Valkey의 EVAL/EVALSHA 명령어와 100% 호환되며, Socket.IO Redis adapter(`@socket.io/redis-adapter`)는 ioredis를 공식 지원하므로 pub/sub 관련 코드는 변경 불필요하다. Lua 스크립트 3개(lockSeat, unlockSeat, getValidLockedSeats)는 Valkey의 Lua 5.1 인터프리터에서 동일하게 실행된다.

**Primary recommendation:** `@upstash/redis` 제거 후 ioredis 단일 클라이언트로 통합. Lua eval() 시그니처만 변환하면 되며, ioredis `defineCommand()`로 래핑하여 EVALSHA 자동 최적화까지 확보한다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `@upstash/redis` 제거, `ioredis` 단일 클라이언트로 통합 (Memorystore for Valkey TCP 연결)
- **D-02:** ioredis 유지 근거: @socket.io/redis-adapter 공식 지원, 2026년 1~3월 6개 릴리스로 활발 유지보수, 주간 1,470만 다운로드 검증된 생태계, Valkey 기본 커맨드 100% 호환
- **D-03:** iovalkey 미채택 -- 마지막 릴리스 13개월 전(v0.3.1), 0.x 버전 미안정, @socket.io/redis-adapter 비공식, export 문서 불일치(이슈 #27 미해결), Valkey 조직 내 GLIDE가 1순위로 밀려 2순위 전락
- **D-04:** Valkey GLIDE 미채택 -- 정적 Pub/Sub 모델이 Socket.IO adapter와 근본적 불호환, protobuf 오버헤드로 성능 열위
- **D-05:** env 없으면 InMemoryRedis mock, `REDIS_URL` 있으면 ioredis 접속 -- 현재 패턴 유지
- **D-06:** InMemoryRedis mock의 `eval()` 시그니처를 ioredis 패턴(`eval(script, numKeys, ...keysAndArgs)`)에 맞춰 업데이트
- **D-07:** 캐싱 대상: 공연 목록 API + 공연 상세 API
- **D-08:** TTL 5분 + admin CRUD 시 해당 캐시 즉시 삭제(수동 무효화)
- **D-09:** 검색 결과 캐싱은 이 phase에서 제외
- **D-10:** Memorystore for Valkey를 gcloud CLI로 프로비저닝
- **D-11:** Cloud Run -> Valkey 연결은 Direct VPC Egress 사용

### Claude's Discretion
- Lua 스크립트 3개의 eval() 시그니처 변환 세부사항
- 캐시 키 네이밍 컨벤션 설계
- redis.config.ts 환경변수 정리 (UPSTASH_* 제거, REDIS_URL 통일)
- gcloud CLI 프로비저닝 스크립트 세부 파라미터
- CI/CD 파이프라인 환경변수 마이그레이션

### Deferred Ideas (OUT OF SCOPE)
- 검색 결과 캐싱 -- 쿼리 조합 복잡도가 높아 무효화 전략이 까다로움
- Valkey Cluster -- 단일 노드로 현재 규모 충분
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALK-01 | @upstash/redis 제거, ioredis 단일 클라이언트로 Valkey 연결 통합 | eval() 시그니처 변환 패턴, provider 통합 아키텍처 |
| VALK-02 | Google Memorystore for Valkey 프로비저닝 (PSC + Direct VPC Egress) | gcloud CLI 명령어, PSC 서비스 연결 정책, 네트워킹 설정 |
| VALK-03 | 좌석 잠금 Lua 스크립트 Valkey 호환성 검증 및 수정 | Valkey Lua 5.1 호환성 확인, ioredis defineCommand() 패턴 |
| VALK-04 | Socket.IO Redis adapter가 ioredis로 Valkey pub/sub 정상 동작 확인 | redis-io.adapter.ts 변경 불필요 확인 |
| VALK-05 | Cloud Run -> Valkey VPC 네트워킹 설정 | Direct VPC Egress gcloud 설정, deploy.yml 수정 패턴 |
| VALK-06 | 성능 카탈로그 캐시 레이어 구현 | NestJS 캐시 인터셉터 패턴, TTL + 수동 무효화 전략 |
</phase_requirements>

## Standard Stack

### Core (기존 유지)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | 5.10.1 | Valkey TCP 클라이언트 | 이미 설치됨. Valkey 완전 호환, @socket.io/redis-adapter 공식 지원 [VERIFIED: npm registry] |
| @socket.io/redis-adapter | 8.3.0 | Socket.IO 다중 인스턴스 pub/sub | 이미 설치됨. ioredis 기반 동작 확인 [VERIFIED: npm registry] |

### 제거 대상
| Library | Version | Reason |
|---------|---------|--------|
| @upstash/redis | 1.37.0 | Memorystore TCP 연결로 대체. HTTP 기반 클라이언트 불필요 [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ioredis | iovalkey | iovalkey 0.x 미안정, @socket.io/redis-adapter 비공식 -- 사용자가 명시적으로 거부 (D-03) |
| ioredis | valkey-glide | 정적 Pub/Sub 모델이 Socket.IO adapter와 근본적 불호환 -- 사용자가 명시적으로 거부 (D-04) |

**Uninstallation:**
```bash
pnpm --filter @grapit/api remove @upstash/redis
```

## Architecture Patterns

### eval() 시그니처 변환 (핵심 변환)

**Upstash 패턴 (현재):**
```typescript
// @upstash/redis: eval(script, keys[], args[])
const result = await this.redis.eval<Keys, Result>(
  LOCK_SEAT_LUA,
  [userSeatsKey, lockKey, lockedSeatsKey],        // keys[]
  [userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix],  // args[]
);
```

**ioredis 패턴 (변환 후):**
```typescript
// ioredis: eval(script, numKeys, key1, key2, ..., arg1, arg2, ...)
const result = await this.redis.eval(
  LOCK_SEAT_LUA,
  3,                                              // numKeys
  userSeatsKey, lockKey, lockedSeatsKey,           // keys (flat)
  userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix,  // args (flat)
) as [number, string, string?];
```
[VERIFIED: ioredis GitHub + Upstash docs]

### defineCommand() 최적화 (권장)

ioredis의 `defineCommand()`를 사용하면 EVALSHA 자동 캐싱으로 네트워크 오버헤드를 줄일 수 있다.

```typescript
// Source: https://github.com/redis/ioredis/blob/main/examples/typescript/scripts.ts
import Redis from 'ioredis';

const redis = new Redis(redisUrl);

// Lua 스크립트를 named command로 등록
redis.defineCommand('lockSeat', {
  numberOfKeys: 3,
  lua: LOCK_SEAT_LUA,
});

redis.defineCommand('unlockSeat', {
  numberOfKeys: 3,
  lua: UNLOCK_SEAT_LUA,
});

redis.defineCommand('getValidLockedSeats', {
  numberOfKeys: 1,
  lua: GET_VALID_LOCKED_SEATS_LUA,
});

// 사용: 자동으로 EVALSHA 시도 -> 실패 시 EVAL fallback
const result = await (redis as any).lockSeat(
  userSeatsKey, lockKey, lockedSeatsKey,
  userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix,
);
```
[VERIFIED: ioredis GitHub examples/typescript/scripts.ts]

### Provider 통합 아키텍처

```
[변경 전]
BookingModule
├── upstashRedisProvider (UPSTASH_REDIS) → @upstash/redis HTTP
├── ioredisClientProvider (IOREDIS_CLIENT) → ioredis TCP (pub/sub 전용)
└── BookingService → @Inject(UPSTASH_REDIS) for eval/set/get

[변경 후]
BookingModule
├── redisProvider (REDIS_CLIENT) → ioredis TCP (모든 용도)
└── BookingService → @Inject(REDIS_CLIENT)

PerformanceModule (추가)
├── CacheService → @Inject(REDIS_CLIENT) for cache get/set/del
└── PerformanceService → CacheService 주입
```

### 캐시 레이어 아키텍처

```typescript
// 캐시 서비스: NestJS provider로 구현
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }
}
```
[ASSUMED]

### 캐시 키 네이밍 컨벤션 (권장)

```
cache:performances:list:{genre}:{page}:{limit}:{sort}:{ended}:{sub}
cache:performances:detail:{id}
cache:home:banners
cache:home:hot
cache:home:new
```

TTL: 300초 (5분, D-08)
무효화: admin CRUD 시 관련 키 패턴 삭제
[ASSUMED]

### InMemoryRedis mock eval() 시그니처 변환

```typescript
// 변경 전 (Upstash 패턴):
async eval(_script: string, keys: string[], args: string[]): Promise<unknown>

// 변경 후 (ioredis 패턴):
async eval(
  _script: string,
  numKeys: number,
  ...keysAndArgs: string[]
): Promise<unknown> {
  const keys = keysAndArgs.slice(0, numKeys);
  const args = keysAndArgs.slice(numKeys);
  // 기존 dispatch 로직 유지 (keys.length + args.length 매칭)
  ...
}
```
[ASSUMED]

### Anti-Patterns to Avoid
- **ioredis에서 Upstash eval 시그니처 사용:** `redis.eval(script, keys[], args[])` 형태는 ioredis에서 동작하지 않는다. 반드시 `redis.eval(script, numKeys, ...keysAndArgs)` 형태 사용
- **KEYS 명령어 프로덕션 사용:** `redis.keys('pattern*')`은 O(N)으로 프로덕션에서 위험. 캐시 무효화 시 알려진 키를 직접 삭제하는 것이 안전. 소규모 키셋(< 100)에서만 사용 가능
- **TLS 없이 프로덕션 연결:** Memorystore for Valkey는 기본적으로 TLS 비활성화지만, PSC 내부 네트워크에서는 허용 가능. 외부 접근 시 반드시 TLS 활성화

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EVALSHA 캐싱 | 수동 SHA1 관리 + EVALSHA/EVAL 분기 | ioredis `defineCommand()` | 자동 캐싱, 실패 시 EVAL fallback 내장 |
| Redis 연결 관리 | 커스텀 reconnect 로직 | ioredis `retryStrategy` + `lazyConnect` | 이미 기존 코드에 구현됨, 그대로 유지 |
| 캐시 직렬화 | 커스텀 직렬화 | `JSON.stringify/parse` | 공연 데이터는 단순 JSON, 특별한 직렬화 불필요 |
| GCP 네트워킹 | 커스텀 VPN/터널 | Cloud Run Direct VPC Egress + PSC | GCP 관리형, 추가 비용 없음 |

## Common Pitfalls

### Pitfall 1: eval() 시그니처 불일치
**What goes wrong:** Upstash `eval(script, keys[], args[])` 패턴을 ioredis에 그대로 사용하면 ioredis가 두 번째 인자(배열)를 numKeys로 해석하려 해서 타입 에러 또는 런타임 에러 발생
**Why it happens:** 두 라이브러리의 eval() 시그니처가 근본적으로 다름
**How to avoid:** 모든 eval() 호출부를 찾아 `eval(script, numKeys, ...keys, ...args)` 형태로 변환. 테스트에서 mock eval 시그니처도 동시 업데이트
**Warning signs:** `ERR wrong number of arguments for 'eval' command` 또는 `TypeError`

### Pitfall 2: Memorystore PSC 서비스 연결 정책 누락
**What goes wrong:** Memorystore 인스턴스 생성 시 PSC 서비스 연결 정책이 없으면 `FAILED_PRECONDITION` 에러 발생
**Why it happens:** Memorystore for Valkey는 PSC 전용. 기존 Redis Memorystore(VPC peering)와 다른 네트워킹 모델
**How to avoid:** 인스턴스 생성 전에 반드시 `gcloud network-connectivity service-connection-policies create` 실행
**Warning signs:** 인스턴스가 `CREATING` 상태에서 멈추거나 실패

### Pitfall 3: Cloud Run에 VPC Egress 미설정
**What goes wrong:** Cloud Run 서비스가 Memorystore의 PSC 엔드포인트(내부 IP)에 접근 불가. `ECONNREFUSED` 또는 타임아웃
**Why it happens:** Cloud Run은 기본적으로 VPC 외부에서 실행. Direct VPC Egress 또는 VPC Connector 없이는 내부 IP 접근 불가
**How to avoid:** `gcloud run deploy --network=NETWORK --subnet=SUBNET --vpc-egress=private-ranges-only` 플래그 추가
**Warning signs:** 로컬에서는 동작하지만 Cloud Run 배포 후 Redis 연결 실패

### Pitfall 4: 캐시 무효화 누락
**What goes wrong:** admin에서 공연을 수정했는데 사용자에게 구 데이터가 5분간 보임
**Why it happens:** admin CRUD 컨트롤러에서 캐시 삭제 호출을 빠뜨림
**How to avoid:** `createPerformance`, `updatePerformance`, `deletePerformance` 각각에 캐시 무효화 로직 추가. 목록 캐시와 상세 캐시 모두 삭제
**Warning signs:** admin 수정 후 프론트엔드에서 변경사항 미반영

### Pitfall 5: InMemoryRedis mock과 ioredis eval 시그니처 불일치
**What goes wrong:** 로컬 개발 환경에서 InMemoryRedis mock의 eval()이 ioredis 패턴과 다르면 로컬에서는 동작하지만 프로덕션에서 실패
**Why it happens:** mock만 업데이트하고 실제 서비스 코드를 안 바꾸거나, 그 반대
**How to avoid:** mock과 서비스 코드를 동시에 변환. 테스트에서 eval() 호출 시그니처 검증
**Warning signs:** vitest 통과하지만 프로덕션 배포 후 좌석 잠금 실패

### Pitfall 6: deploy.yml에 REDIS_URL Secret 미추가
**What goes wrong:** Cloud Run 배포 후 Redis 연결 정보 없음 -> InMemoryRedis fallback으로 동작 (비영속적)
**Why it happens:** 기존 deploy.yml에 UPSTASH_* 환경변수가 없었고 (Upstash는 환경변수로 주입되지 않았을 수 있음), REDIS_URL 추가를 빠뜨림
**How to avoid:** deploy.yml의 secrets 섹션에 `REDIS_URL=redis-url:latest` 추가, GCP Secret Manager에 시크릿 생성
**Warning signs:** Cloud Run 로그에 `[redis] No REDIS_URL -- using in-memory mock` 경고

## Code Examples

### 1. ioredis 단일 Provider (변환 후)

```typescript
// apps/api/src/modules/booking/providers/redis.provider.ts
// Source: 기존 코드 기반 변환
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// InMemoryRedis: eval() 시그니처를 ioredis 패턴으로 변환
class InMemoryRedis {
  // ... (기존 set/get/del/sadd/srem/smembers/scard/ttl/expire 유지)

  async eval(
    _script: string,
    numKeys: number,
    ...keysAndArgs: (string | number)[]
  ): Promise<unknown> {
    const keys = keysAndArgs.slice(0, numKeys).map(String);
    const args = keysAndArgs.slice(numKeys).map(String);
    // 기존 dispatch 로직 (keys.length + args.length 매칭)
    if (keys.length === 3 && args.length === 5) return this.evalLockSeat(keys, args);
    if (keys.length === 3 && args.length === 2) return this.evalUnlockSeat(keys, args);
    if (keys.length === 1 && args.length === 1) return this.evalGetValidLockedSeats(keys, args);
    throw new Error('InMemoryRedis: unknown Lua script pattern');
  }
}

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IORedis | InMemoryRedis => {
    const url = config.get<string>('redis.url', '');

    if (!url) {
      console.warn('[redis] No REDIS_URL -- using in-memory mock.');
      return new InMemoryRedis() as unknown as IORedis;
    }

    const client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 5) return null;
        return Math.min(times * 500, 5000);
      },
    });

    client.on('error', (err: Error) => {
      console.error('[redis] Error:', err.message);
    });

    client.connect().catch(() => {});
    return client;
  },
};
```

### 2. BookingService eval() 변환

```typescript
// 변환 전 (Upstash):
const result = await this.redis.eval<[string, string, string, string, string], [number, string, string?]>(
  LOCK_SEAT_LUA,
  [userSeatsKey, lockKey, lockedSeatsKey],
  [userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix],
);

// 변환 후 (ioredis):
const result = await this.redis.eval(
  LOCK_SEAT_LUA,
  3,
  userSeatsKey, lockKey, lockedSeatsKey,
  userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix,
) as [number, string, string?];
```

### 3. 캐시 무효화 패턴

```typescript
// admin CRUD 후 캐시 무효화
async createPerformance(input: CreatePerformanceInput) {
  const result = await this.db.transaction(/* ... */);
  // 목록 캐시 무효화 (해당 장르의 모든 페이지)
  await this.cacheService.invalidatePattern(`cache:performances:list:${result.genre}:*`);
  await this.cacheService.invalidatePattern('cache:home:*');
  return result;
}
```

### 4. GCP 프로비저닝 명령어

```bash
# 1. API 활성화
gcloud services enable \
  networkconnectivity.googleapis.com \
  compute.googleapis.com \
  serviceconsumermanagement.googleapis.com \
  memorystore.googleapis.com

# 2. PSC 서비스 연결 정책 생성
gcloud network-connectivity service-connection-policies create grapit-valkey-policy \
  --network=default \
  --project=PROJECT_ID \
  --region=asia-northeast3 \
  --service-class=gcp-memorystore \
  --subnets=https://www.googleapis.com/compute/v1/projects/PROJECT_ID/regions/asia-northeast3/subnetworks/default

# 3. Memorystore for Valkey 인스턴스 생성
gcloud memorystore instances create grapit-valkey \
  --project=PROJECT_ID \
  --location=asia-northeast3 \
  --node-type=shared-core-nano \
  --shard-count=1 \
  --replica-count=0 \
  --engine-version=VALKEY_8_0 \
  --endpoints='[{"connections": [{"pscAutoConnection": {"network": "projects/PROJECT_ID/global/networks/default", "projectId": "PROJECT_ID"}}]}]'

# 4. 엔드포인트 확인
gcloud memorystore instances describe grapit-valkey \
  --location=asia-northeast3 \
  --format="yaml(discoveryEndpoints)"

# 5. Cloud Run에 Direct VPC Egress 추가 (deploy 시)
gcloud run deploy grapit-api \
  --network=default \
  --subnet=default \
  --vpc-egress=private-ranges-only \
  --region=asia-northeast3
```
[VERIFIED: GCP official docs]

**Node type 선택 근거:** `shared-core-nano`는 SLA 없음(개발/테스트용)이지만, 현재 프로젝트가 초기 단계(min-instances=0, 비용 최소화)이므로 적합. 트래픽 증가 시 `standard-small`로 업그레이드. [CITED: docs.cloud.google.com/memorystore/docs/valkey/instance-node-specification]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upstash HTTP + ioredis TCP 이원화 | ioredis 단일 TCP | Phase 7 | 복잡도 감소, 의존성 1개 제거 |
| Memorystore for Redis | Memorystore for Valkey | 2024 Q4 GA | Redis 라이선스 이슈 회피, 동일 API |
| Serverless VPC Connector | Direct VPC Egress | 2024 GA | 추가 비용 없음, 더 낮은 레이턴시 |

**Deprecated/outdated:**
- `@upstash/redis`: 프로젝트에서 제거 대상. Memorystore TCP 연결로 대체
- Serverless VPC Connector: GCP에서 Direct VPC Egress 권장으로 전환

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x |
| Config file | apps/api/vitest.config.ts (또는 package.json scripts) |
| Quick run command | `pnpm --filter @grapit/api test` |
| Full suite command | `pnpm test` (모노레포 전체) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALK-01 | ioredis 단일 provider로 eval() 정상 호출 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/booking/__tests__/booking.service.spec.ts` | ✅ (수정 필요) |
| VALK-03 | Lua 스크립트 3개 ioredis eval() 시그니처로 정상 실행 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/booking/__tests__/booking.service.spec.ts` | ✅ (시그니처 업데이트 필요) |
| VALK-04 | Socket.IO Redis adapter pub/sub 동작 | manual-only | N/A -- 코드 변경 없음, redis-io.adapter.ts 그대로 유지 | N/A |
| VALK-06 | 캐시 레이어 hit/miss/invalidation | unit | `pnpm --filter @grapit/api exec vitest run src/modules/performance/__tests__/cache.service.spec.ts` | ❌ Wave 0 |
| VALK-02 | Memorystore 프로비저닝 | manual-only | gcloud CLI 직접 실행 | N/A |
| VALK-05 | Cloud Run VPC 네트워킹 | manual-only | deploy 후 `gcloud run services describe` 확인 | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/api test`
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm lint`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` -- covers VALK-06
- [ ] `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` 업데이트 -- eval() mock 시그니처 변경

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | 기존 RolesGuard + JwtAuthGuard 유지 (캐시는 public 엔드포인트에만 적용) |
| V5 Input Validation | no | 캐시 키는 서버 측 생성, 사용자 입력 직접 사용 안 함 |
| V6 Cryptography | no | Memorystore PSC 내부 네트워크, TLS는 선택 |

### Known Threat Patterns for Redis/Valkey

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 캐시 poisoning (잘못된 데이터 캐싱) | Tampering | 캐시 키를 서버 측에서만 생성, 사용자 입력을 키에 직접 사용 안 함 |
| 캐시 stampede (TTL 만료 시 동시 DB 쿼리) | DoS | 5분 TTL + 소규모 트래픽이므로 현재 위험 낮음 |
| Redis 명령어 인젝션 | Tampering | Lua 스크립트는 하드코딩, 사용자 입력은 ARGV로만 전달 (이미 구현됨) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ioredis | VALK-01 | ✓ | 5.10.1 | -- |
| gcloud CLI | VALK-02, VALK-05 | 수동 확인 필요 | -- | 사용자 로컬 설치 필요 |
| GCP Memorystore API | VALK-02 | ✗ (활성화 필요) | -- | `gcloud services enable memorystore.googleapis.com` |
| VPC 네트워크 (default) | VALK-05 | ✓ (GCP 기본) | -- | -- |

**Missing dependencies with no fallback:**
- gcloud CLI: 사용자가 로컬에 설치해야 함 (인프라 프로비저닝 단계)

**Missing dependencies with fallback:**
- GCP APIs: `gcloud services enable` 명령어로 즉시 활성화 가능

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CacheService를 별도 Injectable로 구현하고 PerformanceModule에 주입하는 패턴 | Architecture Patterns | NestJS DI 구조 변경 필요. 대안: NestJS CacheModule 사용 가능하나 커스텀이 더 간단 |
| A2 | 캐시 키 네이밍에 `cache:` prefix 사용 | Architecture Patterns | 키 충돌 방지 목적. 다른 prefix도 가능 |
| A3 | `invalidatePattern()`에서 KEYS 명령어 사용 | Code Examples | 소규모 키셋에서만 안전. 대규모 시 SCAN으로 대체 필요 |
| A4 | InMemoryRedis mock의 eval() 시그니처를 `(script, numKeys, ...keysAndArgs)` 형태로 변환 | Architecture Patterns | mock 구현 세부사항. 기존 dispatch 로직은 유지 |
| A5 | shared-core-nano 노드 타입 선택 | Code Examples | SLA 없음. 프로덕션 트래픽 증가 시 standard-small 업그레이드 필요 |

## Open Questions

1. **Memorystore for Valkey TLS 설정**
   - What we know: PSC 내부 네트워크에서는 TLS 없이 연결 가능. 생성 시에만 TLS 설정 가능(후에 변경 불가)
   - What's unclear: 초기에 TLS 없이 시작해도 보안상 충분한지 (PSC가 네트워크 격리 제공)
   - Recommendation: PSC 내부 네트워크이므로 초기에는 TLS 없이 시작. 보안 요구사항 변경 시 인스턴스 재생성

2. **shared-core-nano vs standard-small**
   - What we know: nano는 SLA 없음, 1.12GB 하드 제한. standard-small은 SLA 있음, 5.2GB
   - What's unclear: 현재 좌석 잠금 + 캐시 데이터가 1.12GB 이내인지
   - Recommendation: 초기에 nano로 시작 (비용 최소화), 모니터링 후 필요 시 업그레이드. 좌석 잠금은 키당 ~100B, 캐시는 공연당 ~5KB이므로 현재 규모에서 충분

3. **deploy.yml의 VPC Egress 플래그 위치**
   - What we know: `google-github-actions/deploy-cloudrun@v3`의 `flags` 파라미터에 추가 가능
   - What's unclear: `--network`와 `--subnet`이 이미 Cloud Run 서비스에 설정되어 있는지, 또는 최초 추가인지
   - Recommendation: 현재 deploy.yml에는 VPC 관련 설정 없음. 플래그 추가 필요

## Sources

### Primary (HIGH confidence)
- [ioredis npm registry](https://www.npmjs.com/package/ioredis) - version 5.10.1 확인
- [@socket.io/redis-adapter npm](https://www.npmjs.com/package/@socket.io/redis-adapter) - version 8.3.0 확인
- [ioredis GitHub - TypeScript scripts example](https://github.com/redis/ioredis/blob/main/examples/typescript/scripts.ts) - defineCommand() 패턴
- [Valkey Lua scripting docs](https://valkey.io/topics/eval-intro/) - EVAL 명령어 Redis 호환 확인
- [GCP Memorystore for Valkey - Create instances](https://docs.cloud.google.com/memorystore/docs/valkey/create-instances) - gcloud 명령어
- [GCP Memorystore for Valkey - Networking](https://docs.cloud.google.com/memorystore/docs/valkey/networking) - PSC 전용 확인
- [GCP Memorystore for Valkey - Instance provisioning VPC](https://docs.cloud.google.com/memorystore/docs/valkey/instance-provisioning-vpc) - 서비스 연결 정책
- [GCP Cloud Run - Direct VPC](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc) - Direct VPC Egress 설정
- [GCP Memorystore for Valkey - Node specification](https://docs.cloud.google.com/memorystore/docs/valkey/instance-node-specification) - 노드 타입 스펙
- [Upstash Redis eval docs](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval) - Upstash eval 시그니처

### Secondary (MEDIUM confidence)
- [Memorystore for Valkey setup blog](https://oneuptime.com/blog/post/2026-02-17-how-to-set-up-memorystore-for-valkey-as-a-drop-in-redis-replacement-on-gcp/view) - 설정 가이드
- [Cloud Run Direct VPC Egress blog](https://cloud.google.com/blog/products/serverless/announcing-direct-vpc-egress-for-cloud-run) - 성능 이점

### Tertiary (LOW confidence)
- None

## Project Constraints (from CLAUDE.md)

- ES modules (import/export) 사용, CommonJS 금지
- Strict typing -- `any` 사용 금지 (InMemoryRedis에서 `as any` 제거 필요)
- Conventional commits 사용
- Co-Authored-By 트레일러 금지
- 변경 후 typecheck, lint, test 실행 필수
- `.env`는 모노레포 루트에 위치

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ioredis 5.10.1 npm registry 검증, Valkey 호환성 공식 문서 확인
- Architecture: HIGH - eval() 시그니처 차이 공식 문서로 확인, 기존 코드 분석 완료
- Pitfalls: HIGH - eval 시그니처 불일치, PSC 네트워킹 등 공식 문서 기반
- Infrastructure: MEDIUM - gcloud 명령어는 공식 문서이나 실제 프로비저닝은 프로젝트별 변수 존재

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days - stable libraries)
