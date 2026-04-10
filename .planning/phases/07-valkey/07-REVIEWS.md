---
phase: 7
reviewers: [codex, claude]
reviewed_at: 2026-04-10T05:40:00Z
plans_reviewed:
  - 07-01-PLAN.md
  - 07-02-PLAN.md
  - 07-03-PLAN.md
review_mode: retrospective
note: "Phase 7은 이미 ship된 상태(PR #13)에서 사후 회고 리뷰로 수집됨. 리뷰어는 계획 단계 품질을 대상으로 피드백을 제공."
---

# Cross-AI Plan Review — Phase 7 (Valkey 마이그레이션)

## Codex Review

### Summary

전체적으로는 3개 plan의 분리가 명확하고, `provider 통합 → 캐시 레이어 → GCP 인프라`라는 큰 흐름도 이해하기 쉽습니다. 특히 `must_haves`, `acceptance_criteria`, `verification`가 구체적이라 실행 가능성은 높았습니다. 다만 retrospective 관점에서 보면, 이 phase의 핵심 성공 조건이었던 `실제 Valkey 런타임 검증`, `Cloud Run 네트워크 연결`, `다중 인스턴스 pub/sub`, `프로덕션 misconfig 시 fail-safe`가 plan 수준에서 충분히 강제되지 않았습니다. 구조는 좋았지만, 운영 리스크를 막는 gate와 integration 검증이 약했습니다.

### Strengths

- `07-01-PLAN.md`, `07-02-PLAN.md`, `07-03-PLAN.md`로 책임을 분리한 점이 좋습니다. 코드 변경, 캐시 도입, 인프라 변경이 섞이지 않아 review와 rollback이 쉬운 구조입니다.
- `07-01-PLAN.md`는 Upstash `eval(script, keys[], args[])`에서 ioredis `eval(script, numKeys, ...keys, ...args)`로 바뀌는 핵심 변환 포인트를 정확히 짚었습니다. 이 phase에서 가장 깨지기 쉬운 부분을 제대로 식별했습니다.
- `InMemoryRedis` mock의 `eval()` 시그니처까지 같이 바꾸도록 한 점은 테스트 일관성 측면에서 좋습니다. 단순 import 교체로 끝내지 않은 점이 강점입니다.
- `07-02-PLAN.md`는 캐시 범위를 `공연 목록/상세 + 홈 배너/핫/신규`로 제한하고 검색 캐시는 제외했습니다. scope control이 잘 되어 있습니다.
- `07-02-PLAN.md`에서 admin CRUD 시 즉시 invalidation을 넣은 결정은 TTL만 믿지 않고 데이터 freshness를 보완하려는 설계로 적절합니다.
- `07-03-PLAN.md`는 Secret Manager를 통해 `REDIS_URL`을 주입하고, workflow에 plaintext를 넣지 않도록 한 점이 보안상 올바릅니다.
- 각 plan에 threat model을 별도로 둔 점은 좋습니다. 최소한 어떤 trust boundary가 바뀌는지 인식하고 있다는 신호입니다.

### Concerns

- **HIGH** — `07-01-PLAN.md` Task 1의 `REDIS_URL` 미설정 시 `InMemoryRedis` fallback은 프로덕션에서 매우 위험합니다. Cloud Run에서 secret 누락이나 연결 실패가 나면 앱이 hard fail하지 않고 인스턴스별 메모리 상태로 동작할 수 있어, 좌석 잠금/해제, pub/sub, 캐시 일관성이 조용히 깨집니다. 이 phase의 core value인 예매 안정성을 직접 위협합니다.
- **HIGH** — `07-03-PLAN.md`의 human checkpoint가 `non-blocking`인 점이 위험합니다. 이 phase 성공 조건 1, 2, 4, 5는 실제 Valkey와 Cloud Run 네트워크가 살아 있어야만 검증 가능한데, plan은 이를 release gate로 강제하지 않습니다. 결과적으로 "코드 완료"는 가능하지만 "phase goal 달성"은 미보장입니다.
- **HIGH** — `07-02-PLAN.md`의 `CacheService`는 `get()`/`set()`만 graceful degradation이고, `invalidate()`/`invalidatePattern()`은 예외를 그대로 전파합니다. admin DB 변경이 이미 commit된 뒤 cache invalidation에서 실패하면 request는 500으로 끝나고, 데이터는 바뀌었지만 stale cache는 남는 부분 실패 상태가 됩니다.
- **MEDIUM** — `07-02-PLAN.md`의 `findById()`는 `viewCount`를 DB에서 먼저 증가시키고, 그 뒤 cache hit면 캐시된 detail을 반환합니다. 즉 응답 payload의 `viewCount`는 stale할 수 있습니다. "증가는 항상 DB에서 실행"은 맞지만, "사용자가 보는 값"의 일관성은 보장하지 않습니다.
- **MEDIUM** — `07-02-PLAN.md`는 read-through cache만 있고 cache stampede 방어가 없습니다. `cache:home:*`나 인기 상세가 TTL 300초에 동시에 만료되면 DB에 burst가 갈 수 있습니다. 특히 홈 API는 동시 접근이 몰리기 쉬운 엔드포인트입니다.
- **MEDIUM** — `07-02-PLAN.md`의 `invalidatePattern()`이 `KEYS`를 사용합니다. threat model에서는 "현재 100개 미만"이라 accept했지만, list cache key는 `genre/page/limit/sort/ended/sub` 조합으로 늘어날 수 있고, 이 Valkey는 좌석 잠금 Lua/pubsub와 같은 인스턴스를 공유합니다. 운영 중 blocking command가 core booking path에 영향을 줄 수 있습니다.
- **MEDIUM** — `07-01-PLAN.md`의 ioredis factory는 `client.connect().catch(() => {})`로 startup failure를 삼키고, `retryStrategy`도 5회 후 종료합니다. 즉 앱이 "정상 기동된 것처럼" 보이지만 실제 Redis는 unusable한 상태가 될 수 있습니다. health/readiness 관점의 설계가 부족합니다.
- **MEDIUM** — `07-02-PLAN.md`는 `PerformanceModule`이 `BookingModule`을 import해서 `REDIS_CLIENT`를 받게 만듭니다. 이것은 infra provider가 feature module에 묶여 있는 구조라서 도메인 경계를 흐립니다. phase는 성공해도 설계 부채가 남습니다.
- **MEDIUM** — `07-03-PLAN.md`의 `scripts/provision-valkey.sh`는 `default` network/subnet, `shared-core-nano`, `asia-northeast3`를 강하게 하드코딩합니다. 현재 환경에는 맞을 수 있지만, 검증 가능한 전제나 override path가 없어서 재현성과 이식성이 떨어집니다.
- **LOW** — `07-03-PLAN.md`의 script는 policy create만 idempotent하게 처리하고 instance create, secret create/update, ACTIVE 상태 polling은 충분히 다루지 않습니다. 수동 운영 단계에서 실패 재시도가 거칠 수 있습니다.
- **LOW** — `07-02-PLAN.md`의 테스트는 `CacheService` unit test에 편중되어 있습니다. 정작 중요한 `PerformanceService`의 cache hit/miss 흐름, `AdminService` invalidation 호출, update/delete 후 stale data 방지 같은 통합 회귀 테스트가 없습니다.
- **LOW** — `07-02-PLAN.md`의 cache key는 서버 생성이라 poisoning 위험은 낮지만, user-derived query 조합 수가 커질 때 key explosion을 제어하는 설계는 없습니다. 지금은 괜찮아도 성장 시 비용이 생깁니다.

### Suggestions

- `InMemoryRedis` fallback은 `NODE_ENV=development|test`에서만 허용하고, production에서는 `REDIS_URL` 누락 또는 connect 실패 시 startup을 실패시키는 쪽이 맞습니다.
- `07-03` human checkpoint는 non-blocking이 아니라 release blocking gate여야 합니다. 최소한 `ACTIVE 상태`, `Cloud Run에서 PING 성공`, `2개 인스턴스 pub/sub`, `10분 TTL 해제`는 배포 승인 조건으로 걸어야 합니다.
- `CacheService.invalidate()`와 `invalidatePattern()`도 `try/catch + logging`으로 바꾸고, admin write path는 "DB commit 성공, cache invalidation best-effort"로 설계하거나 outbox/async job으로 분리하는 편이 안전합니다.
- `findById()`는 전체 detail을 캐시하지 말고, `viewCount`를 캐시 대상에서 제외하거나 cache hit 시 응답 직전에 `viewCount + 1`을 반영하는 방식으로 semantics를 명확히 해야 합니다.
- `KEYS` 대신 `SCAN`, 버전드 namespace, 또는 "list cache key index set" 같은 방식으로 invalidation 비용을 제한하는 설계가 더 적절합니다. 특히 booking lock과 같은 Redis를 쓰는 구조에서는 blocking command를 더 보수적으로 봐야 합니다.
- `REDIS_CLIENT`는 `BookingModule`이 아니라 별도 `RedisModule` 또는 shared infra module로 분리하는 게 맞습니다. 현재 plan은 기능적으로는 동작하지만 아키텍처 결합도가 불필요하게 높습니다.
- CI에 real Valkey integration test를 추가하는 것이 좋습니다. 최소한 Lua 3종, TTL, `eval()` 반환 타입, `CacheService` serialize/deserialize, Socket.IO adapter smoke 정도는 container 기반으로 검증할 수 있습니다.
- `scripts/provision-valkey.sh`는 `PROJECT_ID/REGION/NETWORK/SUBNET/NODE_TYPE`를 override 가능하게 하고, secret은 `create`보다 `versions add` 패턴을 포함하는 편이 운영성이 좋습니다.
- `cache stampede`는 당장 복잡한 distributed lock까지는 아니더라도, 짧은 jitter, stale-while-revalidate, single-flight 정도는 plan에 넣었어야 합니다.
- `07-02`에는 service-level tests를 추가해서 `첫 요청 DB → 둘째 요청 cache`, `admin update 후 detail/list cache miss`, `viewCount path`를 직접 검증하는 것이 좋습니다.

### Risk Assessment

**HIGH** — plan 문서 품질 자체는 준수하지만, 이 phase는 "예매 안정성"에 직결되는 infra migration입니다. 그런데 `07-01`의 silent fallback, `07-03`의 non-blocking runtime verification, real Valkey/pubsub/network에 대한 integration 부재 때문에 "코드는 맞아 보여도 운영에서는 실패"할 여지가 큽니다. 특히 misconfig 시 hard fail이 아니라 degraded success처럼 보이게 설계된 점이 가장 큰 리스크입니다.

---

## Claude CLI Review

### Summary

Phase 7의 3개 플랜은 **구조적으로 매우 잘 설계**되어 있으며, 특히 의사결정 추적성(D-01~D-11)과 인터페이스 명세가 탁월하다. 07-01은 타입 변환과 테스트 업데이트가 기계적으로 명확하고, 07-02는 캐시 레이어의 read-through/invalidate 전략이 체계적이며, 07-03은 인프라 프로비저닝을 재현 가능한 스크립트로 만들었다. 다만 **런타임 검증 공백**(실제 Valkey와의 통합 테스트 부재), **graceful degradation 설계의 프로덕션 안전성 문제**(InMemoryRedis fallback이 프로덕션 오설정을 조용히 숨김), 그리고 **KEYS 명령어 사용**으로 인한 향후 성능 리스크가 주요 우려 사항이다. 전반적으로 "코드 레벨"은 견고하나 "운영 레벨"의 안전장치가 부족하다.

### Strengths

- **의사결정 추적성이 탁월함** — D-01~D-11이 각 플랜의 action에 명시적으로 인용되어 있어("Per D-01, D-05, D-06") 왜 그렇게 하는지가 항상 명확하다. iovalkey/GLIDE 미채택 근거(D-03, D-04)까지 문서화되어 있어 미래의 재평가가 수월하다.
- **인터페이스 명세가 구체적** — 07-01의 `<interfaces>` 블록에 현재 Upstash eval 시그니처와 목표 ioredis 시그니처가 before/after로 나란히 제시되어 executor가 실수할 여지가 최소화되어 있다.
- **Wave 기반 병렬화 설계** — 07-02(Wave 2)와 07-03(Wave 2)이 모두 `depends_on: ["07-01"]`만 의존하여 병렬 실행 가능하다. 07-01이 REDIS_CLIENT symbol을 제공하면 캐시 구현과 인프라 작업이 독립적으로 진행된다.
- **TDD 적용** — 07-02 Task 1에 `tdd="true"` + `<behavior>` 블록으로 8개 테스트 케이스를 먼저 명세하고 있어 CacheService 품질을 보장한다.
- **캐시 키 네이밍 컨벤션** — `cache:performances:list:{genre}:{page}:{limit}:{sort}:{ended}:{sub|none}` 패턴이 무효화 시 pattern matching 가능한 구조로 설계되어 있다.
- **viewCount 증가 순서 명시** — 07-02에서 `findById`의 viewCount 증가를 "캐시 확인 전"에 실행하도록 명시한 것은 read-through 캐시의 잘 알려진 함정을 피한 세심한 설계다.
- **Non-blocking checkpoint** — 07-03 Task 2가 `gate="non-blocking"`으로 human-verify 처리되어 GCP 인증이라는 자동화 불가능 경계를 명확히 구분했다.
- **STRIDE 위협 모델** — 각 플랜에 trust boundary + threat register가 포함되어 캐시 poisoning(T-07-04), KEYS DoS(T-07-05) 등 주요 위협을 선제 식별했다.

### Concerns

#### HIGH

- **[HIGH] InMemoryRedis fallback이 프로덕션 오설정을 조용히 숨김** — 07-01 Task 1의 provider factory에서 Cloud Run Secret Manager 바인딩 실수로 `REDIS_URL`이 빈 문자열이면 **InMemoryRedis로 폴백되어 서비스가 기동된다**. 그러면 좌석 잠금이 인스턴스별로 고립되어(Socket.IO 어댑터도 fake pub/sub 없음) **중복 예매가 발생할 수 있다**. T-07-02에서 "accept"로 처리했지만 이는 운영 사고로 직결될 수 있는 리스크다. 프로덕션에서는 `NODE_ENV === 'production' && !url`일 때 **throw해야 한다**.

- **[HIGH] Lua 스크립트 numKeys 불일치 — unlockSeat** — 원본 Upstash 호출이 `eval<[string, string], number>(UNLOCK_SEAT_LUA, [lockKey, userSeatsKey, lockedSeatsKey], [userId, seatId])`로 **TypeScript 제네릭이 keys를 2개로 선언**했으나 실제 배열은 3개다(기존 타입 버그). 변환 시 numKeys=3이 맞지만, Lua 스크립트 내부가 KEYS[1..3]을 모두 참조하는지 검증하는 명시적 단계가 플랜에 빠져 있다.

- **[HIGH] Valkey에 대한 실제 런타임 테스트 0건** — 3개 플랜 전체에서 **실제 Valkey(또는 로컬 Redis) 컨테이너에 대한 통합 테스트가 전혀 없다**. 모든 테스트가 `createMockRedis()` 기반 유닛 테스트다. 이는 (1) Lua 스크립트가 Valkey 8.0 Lua 5.1 인터프리터에서 실제로 실행되는지, (2) `defineCommand()` 기반 EVALSHA 최적화가 캐시 미스 시에도 정상 동작하는지, (3) Socket.IO Redis adapter가 Valkey pub/sub로 실제 이벤트를 브로드캐스트하는지, (4) JSON.stringify/parse 라운드트립에서 Date, undefined, Decimal 등 엣지 케이스가 처리되는지를 놓친다. 07-HUMAN-UAT.md에서 다룬다고 되어 있지만, 플랜 단위에서 **로컬 Docker Compose로 Redis 띄우고 integration spec 1개**라도 돌리는 것이 표준적이다.

#### MEDIUM

- **[MEDIUM] `invalidatePattern`의 KEYS 명령어 — 프로덕션 차단 블로커** — `KEYS`는 **O(N) 블로킹 명령어**로 Valkey 단일 스레드가 KEYS 실행 동안 **모든 다른 명령어가 blocked**된다. admin CRUD가 `invalidatePattern('cache:performances:list:*')` + `invalidatePattern('cache:home:*')`를 **연속 2번 호출**해 블로킹 2회 발생. 공연 수가 늘고 페이지네이션 조합이 커지면 수천 개 키 생성 가능. `SCAN` + `UNLINK`(Valkey 4.0+) 조합이 비블로킹 대안이며, 좌석 잠금과 같은 Redis를 공유하므로 순간 latency spike가 예매 플로우에 영향을 준다.

- **[MEDIUM] Cache stampede(dogpile) 무방비** — TTL 만료 순간 동시에 10개 요청이 들어오면 **10개 요청 모두 DB 조회 실행**(thundering herd). 특히 핫 페이지(`cache:home:hot`, `cache:home:banners`)는 캐시 미스 시 트래픽이 집중된다. 최소한 stale-while-revalidate 또는 SETNX 기반 lock이 필요한데, 플랜에서 전혀 언급되지 않는다.

- **[MEDIUM] Graceful degradation의 silent failure** — CacheService `get()`/`set()`의 catch에서 **로그조차 남기지 않는다**. Valkey가 죽었는데 로그가 없으면 Sentry 알람이 울리지 않아 **"DB 부하 폭증 → 느림"으로 잘못 진단**하게 된다. 최소한 `logger.warn({ err, key }, 'cache operation failed')` 정도는 남기고 Sentry 브레드크럼 레벨로 추적해야 한다.

- **[MEDIUM] `invalidate`에는 try/catch 없음** — CacheService에서 get/set은 graceful degradation인데 invalidate/invalidatePattern은 try/catch가 없다. admin이 공연을 업데이트했는데 Redis가 일시 장애면 **admin API가 500 에러**를 던지고, DB 변경은 이미 커밋된 상태로 **캐시와 DB가 divergence**한다. 일관성과 사용자 경험 양쪽 모두 문제.

- **[MEDIUM] `ioredis.duplicate()` 사용 여부 불명** — `@socket.io/redis-adapter`는 **pub/sub에 2개의 별도 connection이 필요**(publisher/subscriber). 단일 REDIS_CLIENT에 Socket.IO adapter와 BookingService가 **동일 connection**을 공유하면, adapter가 subscribe 모드로 진입하는 순간 BookingService의 일반 command가 **SUBSCRIBE 상태 에러**로 모두 실패한다. 플랜에 명시적 확인 지침이 없다.

- **[MEDIUM] `lazyConnect: true` + `connect().catch(() => {})` 조합 위험** — `.catch(() => {})`로 connect 실패를 **완전히 무시**. Valkey가 기동 시 접근 불가 상태라면 BookingService가 DI로 주입받은 client는 **영원히 연결되지 않은 상태**로 남는다. `retryStrategy`가 5회 후 `null`을 반환하므로 **재시도 중단**. 이는 프로덕션에서 **silent outage**다. `@nestjs/terminus`가 스택에 있음에도 healthcheck에서 Redis 연결 상태를 체크하는 task가 플랜에 없다.

- **[MEDIUM] `maxRetriesPerRequest: 3`와 pub/sub 호환성** — `@socket.io/redis-adapter`가 내부적으로 요구하는 것은 `maxRetriesPerRequest: null` (무한 재시도)인 경우가 있다. adapter의 subscribe connection에서 동일 이슈가 발생할 수 있으므로 **`duplicate({ maxRetriesPerRequest: null })`**가 필요할 수 있다.

- **[MEDIUM] 07-03 프로비저닝 스크립트가 idempotent하지 않음** — `service-connection-policies create`에는 `|| echo ...`가 있지만, `memorystore instances create`에는 없다. 재실행 시 **instance already exists 에러로 중단**된다.

#### LOW

- **[LOW] 07-03 deploy.yml 검증이 grep 기반** — `yq` 기반 구조적 검증이 더 안전하지만, 규모상 grep으로도 수용 가능.
- **[LOW] 캐시 키에 version prefix 없음** — `cache:v1:performances:list:...` 형태가 스키마 변경 시 전체 무효화에 유리하다.
- **[LOW] `pnpm remove` idempotency** — 이미 제거된 상태에서 재실행 안전성 가정 부재.
- **[LOW] 07-02 `redis.keys` mock 경계 조건 부족** — 빈 배열/키 1개/여러 개 케이스가 구체적이지 않다.
- **[LOW] `JSON.parse` 실패 시 corrupt key 영구 잔존** — DEL하고 null 반환이 더 안전.
- **[LOW] BookingModule이 REDIS_CLIENT를 export하는 구조의 응집도** — PerformanceModule이 BookingModule을 import하는 것은 잘못된 의존 방향을 암시. 별도 `RedisModule`(global) 분리가 깔끔하나 1인 개발 오버헤드 고려하면 수용 가능.

### Suggestions

1. **프로덕션에서 `REDIS_URL` 없으면 throw** — provider factory를 수정해 `NODE_ENV === 'production'`일 때 hard fail. must_haves에 "프로덕션에서 REDIS_URL 미설정 시 부팅 실패" 추가.
2. **Healthcheck에 Redis 포함** — `@nestjs/terminus` 기반 `HealthController`에 Valkey ping 체크 추가. Cloud Run startup probe 연동으로 silent outage 방지.
3. **로컬 Docker Compose + 통합 테스트 1개** — `docker-compose.yml`에 Valkey 서비스 정의, `booking.service.integration.spec.ts`에서 실제 Valkey 컨테이너에 lockSeat → getSeatStatus → unlockSeat 플로우 테스트. Lua 스크립트 실제 실행을 한번이라도 검증.
4. **CacheService에 구조화된 로깅 + Sentry 브레드크럼** — NestJS Logger 주입 후 catch 블록에서 `logger.warn(...)` + `Sentry.addBreadcrumb(...)`.
5. **invalidatePattern을 SCAN + UNLINK로 구현** — 또는 "cache key registry SET"을 두고 무효화 시 해당 SET만 순회. KEYS 스캔을 완전히 제거.
6. **단순한 per-key lock으로 stampede 완화** — `getOrSet(key, loader, ttl)` helper에서 `SET NX PX`로 짧은 lock(2초) 획득한 요청만 DB 조회.
7. **`createSocketIoRedisAdapter`에 duplicate 옵션 확인** — 07-01 Task 1 action에 "pub/sub subscription이 `duplicate({ maxRetriesPerRequest: null })`로 독립 connection을 받는지 확인" 단계 추가.
8. **프로비저닝 스크립트 idempotent화** — `instances describe ... || instances create ...` 패턴.
9. **캐시 키에 version prefix** — `cache:v1:...`로 통일, 스키마 변경 시 `v2`로 일괄 무효화.
10. **`invalidate`/`invalidatePattern`에 try/catch + 에러 로그(non-throwing)** — 캐시 무효화 실패가 DB 커밋을 막지 않되 반드시 관측 가능해야 한다.
11. **`unlockSeat` numKeys 검증 테스트** — `expect(numKeys).toBe(3)`를 명시해 Lua 스크립트 실제 참조와 일치하는지 확인.

### Risk Assessment

**MEDIUM** — 코드 변경 자체는 LOW 리스크(eval 변환 기계적, 플랜 구체적, CacheService TDD 적용). 런타임 레벨은 MEDIUM~HIGH 리스크(통합 테스트 0건, InMemoryRedis silent fallback, lazyConnect silent failure, Socket.IO duplicate 확인 누락, KEYS 블로킹 명령어). Mitigation이 07-HUMAN-UAT.md로 미뤄져 있어 UAT 전 배포 금지 강한 차단이 없다면 블라인드 배포 위험. 롤백 용이성은 HIGH(git revert + GCP instance pause/delete, 데이터 마이그레이션 없음).

**핵심 권고:** HIGH 우려 3건 중 최소 2건(프로덕션 REDIS_URL 필수, 로컬 통합 테스트 1개)을 배포 전 추가 작업으로 처리하고, MEDIUM의 `invalidate` 비차단화와 healthcheck 추가는 Phase 8 이전에 fast-follow 티켓으로 정리 권장.

---

## Consensus Summary

두 리뷰어 모두 플랜 문서 자체의 구조와 추적성(의사결정, 인터페이스 명세, wave 병렬화, STRIDE)은 **높게 평가**했으나, **"코드는 맞지만 운영에서 조용히 실패할 수 있다"**는 동일한 본질적 우려를 제기했다. 핵심은 (1) InMemoryRedis silent fallback, (2) 실제 Valkey 런타임 통합 테스트 부재, (3) KEYS 기반 무효화 블로킹 리스크, (4) CacheService invalidate 경로의 일관성 공백이다.

### Agreed Strengths (2명 모두 언급)

- **플랜 분리와 책임 경계** — 07-01 (provider 통합) / 07-02 (캐시 레이어) / 07-03 (인프라)의 책임이 명확해 review와 rollback이 쉽다.
- **의사결정 추적성** — D-01~D-11과 threat model이 각 플랜에 명시적으로 인용되어 있어 "왜"가 항상 명확하다.
- **eval 시그니처 변환 식별** — phase에서 가장 깨지기 쉬운 Upstash → ioredis 시그니처 변환 포인트를 정확히 짚고, InMemoryRedis mock까지 함께 업데이트.
- **Scope control** — 검색 캐시 제외, 캐시 대상을 읽기 비율 높은 엔드포인트로 한정.
- **보안 기본기** — REDIS_URL을 Secret Manager로 주입, workflow에 plaintext 금지.

### Agreed Concerns (highest priority — 2명 모두 지적)

1. **[HIGH · 공통] InMemoryRedis silent fallback이 프로덕션 misconfig를 숨김**
   - 두 리뷰어 모두 T-07-02의 "accept" 처리를 가장 큰 리스크로 지목.
   - Cloud Run에서 REDIS_URL 누락 시 인스턴스별로 InMemoryRedis가 기동되어 좌석 잠금/pub/sub가 고립 → 중복 예매 발생 가능.
   - **조치:** `NODE_ENV === 'production'`이면 throw. `must_haves`에 "프로덕션 REDIS_URL 필수 부팅 실패" 추가.

2. **[HIGH · 공통] 실제 Valkey 런타임 통합 테스트 0건**
   - 모든 테스트가 mock 기반. Lua 3종, EVALSHA, Socket.IO adapter pub/sub, JSON 직렬화 엣지 케이스가 검증되지 않음.
   - 07-HUMAN-UAT.md로 미뤄져 있으나 플랜 단위 integration spec 1개가 표준.
   - **조치:** 로컬 Docker Compose + `booking.service.integration.spec.ts`로 lockSeat → unlockSeat 실제 Valkey 라운드트립 테스트 추가.

3. **[HIGH · 공통] 07-03 human checkpoint가 non-blocking → 런타임 검증이 release gate가 아님**
   - "코드 완료"와 "phase goal 달성" 사이의 gap. 실제 VPC 연결/다중 인스턴스 pub/sub가 배포 승인 조건으로 강제되지 않음.
   - **조치:** non-blocking → release blocking gate로 전환. ACTIVE 상태 / PING 성공 / 2개 인스턴스 pub/sub / 10분 TTL 해제를 gate 조건으로.

4. **[MEDIUM · 공통] KEYS 블로킹 명령어 사용**
   - 두 리뷰어 모두 T-07-05 "accept"를 재고하라고 주문. 좌석 잠금과 Redis 인스턴스를 공유하므로 순간 latency spike가 예매 플로우에 직접 영향.
   - **조치:** SCAN + UNLINK 또는 cache key registry SET 패턴으로 전환.

5. **[MEDIUM · 공통] Cache stampede 방어 부재**
   - read-through만 있고 TTL 만료 동시 요청 시 thundering herd 발생.
   - **조치:** stale-while-revalidate 또는 SETNX 기반 per-key lock 추가.

6. **[MEDIUM · 공통] `invalidate`/`invalidatePattern`의 예외 전파 문제**
   - admin DB commit 이후 cache invalidation 실패 시 API는 500, 캐시-DB divergence 발생.
   - **조치:** try/catch + logging으로 best-effort화. DB commit과 분리.

7. **[MEDIUM · 공통] lazyConnect + silent connect 실패 + healthcheck 부재**
   - Codex: "앱이 정상 기동된 것처럼 보이지만 Redis는 unusable."
   - Claude: "`@nestjs/terminus`가 있는데 Redis 체크가 플랜에 없음."
   - **조치:** HealthController에 Valkey ping 추가, Cloud Run startup probe 연동.

8. **[MEDIUM · 공통] BookingModule이 REDIS_CLIENT를 export하는 결합도 문제**
   - PerformanceModule → BookingModule import는 잘못된 의존 방향. 별도 RedisModule(global) 분리 권장.
   - Codex는 설계 부채로, Claude는 1인 개발 오버헤드 고려 시 수용 가능으로 평가(톤 차이 있음).

### Divergent Views (한 명만 언급 — 투자 가치 검토 필요)

- **[Codex only] `findById` viewCount stale** — 캐시된 detail이 stale viewCount를 포함할 수 있다. Claude는 "캐시 확인 전 증가"를 긍정적 strength로 평가했으나 Codex는 "사용자가 보는 값의 일관성"을 지적.
  - **판단:** 두 해석이 모순이 아니라 다른 레벨의 이야기. Codex 지적이 더 엄밀함. 응답 직전 viewCount 주입 패턴 권장.

- **[Codex only] 프로비저닝 스크립트 하드코딩** — region/subnet/node-type override path 부재. 재현성/이식성 관점 지적.
  - **판단:** 1인 개발에서는 수용 가능하나 향후 staging/dev 분리 시 리팩토링 필요.

- **[Claude only] `ioredis.duplicate()` / Socket.IO adapter 2-connection 요구** — pub/sub subscribe mode에서 일반 command가 실패할 수 있음. `maxRetriesPerRequest: null` 옵션 이슈까지 연계.
  - **판단:** 기술적 깊이가 있는 지적. 기존 `redis-io.adapter.ts`가 내부적으로 duplicate하는지 확인하는 task를 플랜에 명시했어야 함.

- **[Claude only] unlockSeat numKeys 검증** — 기존 TypeScript 제네릭 타입 버그(keys 선언 2개 vs 실제 3개)를 발견. Lua 스크립트 내부 참조 검증 단계가 플랜에 없음.
  - **판단:** 구체적이고 플랜에 반영되었어야 할 검증 단계. 07-VERIFICATION.md에서 확인 필요.

- **[Claude only] JSON.parse 실패 시 corrupt key 영구 잔존** — catch 시 DEL 후 null 반환이 안전.
  - **판단:** LOW이지만 간단한 개선.

### Overall Risk

| 리뷰어 | Risk |
|--------|------|
| Codex | **HIGH** |
| Claude | **MEDIUM** |

Codex가 더 보수적(HIGH). 차이는 "운영 사고 가능성"을 평가에 반영하는 무게 차이로, 이미 phase가 ship된 현 시점에서는 **두 리뷰어의 권고가 완전히 수렴**한다: HIGH 우려 3건(InMemoryRedis throw, 통합 테스트 1개, release gate)은 **Phase 8 이전 fast-follow**로 처리할 필요가 있고, MEDIUM 항목(healthcheck, invalidate 비차단, KEYS→SCAN, stampede)은 트래픽 증가 전 품질 개선 스프린트로 정리해야 한다.

### Next Actions (권장 fast-follow)

1. **즉시** — `07-HUMAN-UAT.md` 4건 실런타임 검증 완료 + Cloud Run 배포 승인 gate 재확인.
2. **Phase 8 전 quick phase** — `redis.provider.ts` production hard-fail, `HealthController`에 Valkey ping, `CacheService.invalidate*`에 try/catch + logger.warn 추가.
3. **품질 개선 백로그** — SCAN+UNLINK 전환, cache stampede 방어(getOrSet helper), RedisModule(global) 분리, Docker Compose 기반 integration spec.
4. **검증 권장** — `redis-io.adapter.ts`가 `duplicate({ maxRetriesPerRequest: null })`로 독립 subscribe connection을 만드는지 확인 (Claude 지적).
