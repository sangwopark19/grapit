# Phase 7: Valkey 마이그레이션 - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Upstash Redis(@upstash/redis HTTP) + ioredis(TCP) 이원화 구조를 Google Memorystore for Valkey + iovalkey 단일 TCP 클라이언트로 전환하여 인프라를 단순화한다. 좌석 잠금 Lua 스크립트 호환성 확보, Socket.IO pub/sub 어댑터 전환, 공연 카탈로그 캐시 레이어 신규 구현을 포함한다.

</domain>

<decisions>
## Implementation Decisions

### 클라이언트 라이브러리
- **D-01:** `@upstash/redis` + `ioredis` 이원화를 `iovalkey` 단일 클라이언트로 전환 (ROADMAP 확정)
- **D-02:** iovalkey 선택 근거: ioredis 공식 포크로 API 동일, Socket.IO Redis adapter(`duplicate()`, 동적 subscribe) 완벽 호환, 순수 JS/TS(네이티브 바이너리 불필요), 성능 우위 (Valkey GLIDE 대비 18-22% 빠름)
- **D-03:** Valkey GLIDE 미채택 — 정적 Pub/Sub 모델이 Socket.IO adapter와 근본적 불호환, protobuf 오버헤드로 성능 열위, 마이그레이션 비용 10배 이상 (1-2일 vs 1-2시간)

### 로컬 개발 환경
- **D-04:** env 없으면 InMemoryRedis mock, `REDIS_URL` 있으면 iovalkey 접속 — 현재 패턴 유지
- **D-05:** InMemoryRedis mock의 `eval()` 시그니처를 iovalkey 패턴(`eval(script, numKeys, ...keysAndArgs)`)에 맞춰 업데이트

### 캐시 레이어 (VALK-06)
- **D-06:** 캐싱 대상: 공연 목록 API + 공연 상세 API (읽기 비율 높은 두 엔드포인트)
- **D-07:** TTL 5분 + admin CRUD(생성/수정/삭제) 시 해당 캐시 즉시 삭제(수동 무효화)
- **D-08:** 검색 결과 캐싱은 이 phase에서 제외 (쿼리 조합 복잡도 → 무효화 난이도 높음)

### GCP 인프라
- **D-09:** Memorystore for Valkey를 gcloud CLI로 프로비저닝 (Terraform은 1인 개발에서 오버헤드)
- **D-10:** Cloud Run → Valkey 연결은 Direct VPC Egress 사용 (Serverless VPC Connector 불필요, 추가 비용 없음, GCP 최신 권장)

### Claude's Discretion
- Lua 스크립트 3개(lockSeat, unlockSeat, getValidLockedSeats)의 iovalkey eval() 시그니처 변환 세부사항
- 캐시 키 네이밍 컨벤션 설계
- redis.config.ts 환경변수 정리 (UPSTASH_* 제거, REDIS_URL 통일)
- gcloud CLI 프로비저닝 스크립트 세부 파라미터 (인스턴스 크기, 리전 등)
- CI/CD 파이프라인 환경변수 마이그레이션

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Redis/Valkey 클라이언트
- `apps/api/src/modules/booking/providers/redis.provider.ts` — UPSTASH_REDIS + IOREDIS_CLIENT 두 provider, InMemoryRedis mock 클래스 (Lua eval 에뮬레이션 포함)
- `apps/api/src/config/redis.config.ts` — upstashUrl/upstashToken/ioredisUrl 환경변수 설정

### 좌석 잠금 Lua 스크립트
- `apps/api/src/modules/booking/booking.service.ts` — LOCK_SEAT_LUA, UNLOCK_SEAT_LUA, GET_VALID_LOCKED_SEATS_LUA 3개 Lua 스크립트 + eval() 호출부

### Socket.IO pub/sub
- `apps/api/src/modules/booking/providers/redis-io.adapter.ts` — createSocketIoRedisAdapter (ioredis duplicate() + @socket.io/redis-adapter)
- `apps/api/src/modules/booking/booking.gateway.ts` — WebSocket gateway, broadcastSeatUpdate

### 모듈 구조
- `apps/api/src/modules/booking/booking.module.ts` — BookingModule (upstashRedisProvider + ioredisClientProvider)
- `apps/api/src/app.module.ts` — redisConfig 로드

### 테스트
- `apps/api/src/modules/booking/__tests__/booking.service.spec.ts` — BookingService 유닛 테스트 (mock eval 호출)

### 프론트엔드 Socket.IO
- `apps/web/lib/socket-client.ts` — Socket.IO 클라이언트 설정
- `apps/web/hooks/use-socket.ts` — useSocket 훅

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InMemoryRedis` 클래스: 로컬 dev mock으로 SET/GET/DEL/SADD/SREM/SMEMBERS/SCARD/TTL/EXPIRE/eval 지원. eval은 keys.length + args.length 패턴 매칭으로 3개 Lua 스크립트 에뮬레이션
- `createSocketIoRedisAdapter`: ioredis → iovalkey로 import만 변경하면 동작
- `BookingGateway`: Socket.IO namespace `/booking`, room 기반 브로드캐스트
- `redisConfig`: NestJS ConfigModule registerAs 패턴

### Established Patterns
- NestJS DI: Symbol 기반 provider injection (`@Inject(UPSTASH_REDIS)`)
- Graceful degradation: Redis 미연결 시 InMemoryRedis로 fallback, ioredis 연결 실패 시 경고 로그만 출력
- Lua eval for atomicity: 좌석 잠금/해제를 Lua로 원자적 처리 (TOCTOU 방지)

### Integration Points
- `booking.service.ts`: `@Inject(UPSTASH_REDIS)` → iovalkey provider로 교체 필요
- `booking.module.ts`: `upstashRedisProvider` + `ioredisClientProvider` → 단일 valkey provider로 통합
- `app.module.ts`: `redisConfig` 환경변수 정리
- `booking.service.spec.ts`: mock eval 시그니처 업데이트
- 캐시 레이어: `PerformanceModule`에 캐시 인터셉터 또는 서비스 레이어 캐시 추가

</code_context>

<specifics>
## Specific Ideas

- iovalkey는 ioredis의 공식 포크이므로 `import { Redis } from 'iovalkey'`로 변경 후 기존 ioredis 코드가 그대로 동작
- Upstash `eval(script, keys[], args[])` → iovalkey `eval(script, numKeys, ...keys, ...args)` 시그니처 변환이 핵심 작업
- `defineCommand()`로 Lua 스크립트를 래핑하면 EVALSHA 자동 최적화 가능 (선택적)

</specifics>

<deferred>
## Deferred Ideas

- 검색 결과 캐싱 — 쿼리 조합 복잡도가 높아 무효화 전략이 까다로움. 트래픽 증가 시 별도 phase에서 검토
- Valkey Cluster — 단일 노드로 현재 규모 충분 (REQUIREMENTS Out of Scope 확정)

</deferred>

---

*Phase: 07-valkey*
*Context gathered: 2026-04-10*
