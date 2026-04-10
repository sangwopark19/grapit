# Phase 7: Valkey 마이그레이션 - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Upstash Redis(@upstash/redis HTTP) + ioredis(TCP) 이원화 구조를 Google Memorystore for Valkey + ioredis 단일 TCP 클라이언트로 전환하여 인프라를 단순화한다. 좌석 잠금 Lua 스크립트 호환성 확보, Socket.IO pub/sub 어댑터 유지, 공연 카탈로그 캐시 레이어 신규 구현을 포함한다.

</domain>

<decisions>
## Implementation Decisions

### 클라이언트 라이브러리
- **D-01:** `@upstash/redis` 제거, `ioredis` 단일 클라이언트로 통합 (Memorystore for Valkey TCP 연결)
- **D-02:** ioredis 유지 근거: @socket.io/redis-adapter 공식 지원, 2026년 1~3월 6개 릴리스로 활발 유지보수, 주간 1,470만 다운로드 검증된 생태계, Valkey 기본 커맨드 100% 호환
- **D-03:** iovalkey 미채택 — 마지막 릴리스 13개월 전(v0.3.1), 0.x 버전 미안정, @socket.io/redis-adapter 비공식, export 문서 불일치(이슈 #27 미해결), Valkey 조직 내 GLIDE가 1순위로 밀려 2순위 전락
- **D-04:** Valkey GLIDE 미채택 — 정적 Pub/Sub 모델이 Socket.IO adapter와 근본적 불호환, protobuf 오버헤드로 성능 열위

### 로컬 개발 환경
- **D-05:** env 없으면 InMemoryRedis mock, `REDIS_URL` 있으면 ioredis 접속 — 현재 패턴 유지
- **D-06:** InMemoryRedis mock의 `eval()` 시그니처를 ioredis 패턴(`eval(script, numKeys, ...keysAndArgs)`)에 맞춰 업데이트 (현재 Upstash 패턴에서 변환)

### 캐시 레이어 (VALK-06)
- **D-07:** 캐싱 대상: 공연 목록 API + 공연 상세 API (읽기 비율 높은 두 엔드포인트)
- **D-08:** TTL 5분 + admin CRUD(생성/수정/삭제) 시 해당 캐시 즉시 삭제(수동 무효화)
- **D-09:** 검색 결과 캐싱은 이 phase에서 제외 (쿼리 조합 복잡도 → 무효화 난이도 높음)

### GCP 인프라
- **D-10:** Memorystore for Valkey를 gcloud CLI로 프로비저닝 (Terraform은 1인 개발에서 오버헤드)
- **D-11:** Cloud Run → Valkey 연결은 Direct VPC Egress 사용 (Serverless VPC Connector 불필요, 추가 비용 없음, GCP 최신 권장)

### Claude's Discretion
- Lua 스크립트 3개(lockSeat, unlockSeat, getValidLockedSeats)의 eval() 시그니처 변환 세부사항 (Upstash → ioredis 패턴)
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
- `createSocketIoRedisAdapter`: ioredis 유지이므로 코드 변경 없이 그대로 사용
- `BookingGateway`: Socket.IO namespace `/booking`, room 기반 브로드캐스트
- `redisConfig`: NestJS ConfigModule registerAs 패턴

### Established Patterns
- NestJS DI: Symbol 기반 provider injection (`@Inject(UPSTASH_REDIS)`)
- Graceful degradation: Redis 미연결 시 InMemoryRedis로 fallback, ioredis 연결 실패 시 경고 로그만 출력
- Lua eval for atomicity: 좌석 잠금/해제를 Lua로 원자적 처리 (TOCTOU 방지)

### Integration Points
- `booking.service.ts`: `@Inject(UPSTASH_REDIS)` → ioredis provider로 교체, eval() 시그니처 변환
- `booking.module.ts`: `upstashRedisProvider` + `ioredisClientProvider` → 단일 ioredis provider로 통합
- `app.module.ts`: `redisConfig` 환경변수 정리
- `booking.service.spec.ts`: mock eval 시그니처 업데이트
- 캐시 레이어: `PerformanceModule`에 캐시 인터셉터 또는 서비스 레이어 캐시 추가

</code_context>

<specifics>
## Specific Ideas

- ioredis 유지이므로 Socket.IO adapter, pub/sub 관련 코드 변경 없음 — 마이그레이션 범위 최소화
- 핵심 작업: @upstash/redis 제거 후 Upstash `eval(script, keys[], args[])` → ioredis `eval(script, numKeys, ...keys, ...args)` 시그니처 변환
- `defineCommand()`로 Lua 스크립트를 래핑하면 EVALSHA 자동 최적화 가능 (선택적)
- 향후 재평가 시점: iovalkey 1.0 릴리스 + @socket.io/redis-adapter 공식 지원 시, 또는 ioredis deprecation 공식 선언 시

</specifics>

<deferred>
## Deferred Ideas

- 검색 결과 캐싱 — 쿼리 조합 복잡도가 높아 무효화 전략이 까다로움. 트래픽 증가 시 별도 phase에서 검토
- Valkey Cluster — 단일 노드로 현재 규모 충분 (REQUIREMENTS Out of Scope 확정)

</deferred>

---

*Phase: 07-valkey*
*Context gathered: 2026-04-10*
