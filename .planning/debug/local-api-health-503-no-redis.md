---
status: resolved
trigger: "Phase 13 UAT Test 1 — Fresh 시작 시 로컬 API /api/v1/health 가 503 Service Unavailable 반환"
created: 2026-04-24T00:00:00Z
updated: 2026-04-28T16:00:00+09:00
goal: find_root_cause_only
---

## Current Focus

hypothesis: "CONFIRMED. InMemoryRedis (REDIS_URL 미설정 시 로컬 dev fallback) 에 ping() 메서드가 없어서, RedisHealthIndicator.isHealthy() 가 this.redis.ping() 호출 시 TypeError 를 catch 블록으로 떨구고 indicator.down() 을 반환 → Terminus 가 HealthCheckError → 503."
test: "Source 전수 검사 완료 — redis.provider.ts 의 InMemoryRedis 클래스(lines 14-339) 에서 'ping' grep 0 matches. RedisHealthIndicator 는 32번 줄에서 this.redis.ping() 호출. 로컬 환경에 REDIS_URL 도 .env 파일도 없고 6379 LISTEN 도 없음."
expecting: "완료. Root cause 확정."
next_action: "Return ROOT CAUSE FOUND — fix는 plan-phase --gaps 에서 처리"

## Symptoms

expected: 로컬 dev 에서 API 서버를 fresh 로 띄웠을 때 `/api/v1/health` 가 200 반환
actual: `http://localhost:8080/api/v1/health` 접속 시 503 `{"statusCode":503,"message":"Service Unavailable Exception",...}` 반환. 다른 요소 (web 3000, grabit-postgres 컨테이너, seed admin@grabit.test) 는 정상.
errors: |
  {"statusCode":503,"message":"Service Unavailable Exception","timestamp":"..."}
reproduction: |
  1. 모노레포 루트에서 `.env` 의 REDIS_URL 이 unset 또는 empty 상태 (fresh 로컬 dev)
  2. docker 로 grabit-postgres 만 실행 (redis 컨테이너 없음, 6379 포트에 listener 없음)
  3. `pnpm --filter @grabit/api dev` 로 API 기동
  4. `curl http://localhost:8080/api/v1/health` → 503
started: UAT 시점 (2026-04-24). Phase 13 rename 은 health.controller/redis.provider 를 건드리지 않음 → pre-existing bug 로 추정.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-24T00:00:00Z
  checked: "Orchestrator pre-investigation note"
  found: "health.controller.ts:18 calls redisIndicator.isHealthy('redis'); redis.health.indicator.ts:32 calls this.redis.ping(); InMemoryRedis class in redis.provider.ts does not contain 'ping' (grep returned 0 matches)."
  implication: "Likely TypeError when calling ping() on InMemoryRedis, which becomes 503 via Terminus."

- timestamp: 2026-04-24T00:10:00Z
  checked: "apps/api/src/health/health.controller.ts (전체 21줄)"
  found: "HealthController.check() 가 health.check([() => this.redisIndicator.isHealthy('redis')]) 하나만 수행. REDIS_URL unset / NODE_ENV !== 'production' 인 로컬 dev 를 스킵하는 조건 가드 전혀 없음."
  implication: "Redis indicator 실패 = 전체 /health 503 — 다른 dependency (DB 등) 체크도 없는 순수 Redis-only health."

- timestamp: 2026-04-24T00:11:00Z
  checked: "apps/api/src/health/redis.health.indicator.ts (전체 41줄)"
  found: "line 32 await this.redis.ping(). try/catch 로 감싸져 있고 예외 시 indicator.down({ message: err.message }) 반환. REDIS_CLIENT 토큰으로 ioredis 인스턴스 주입받는다고 타입 선언됨(IORedis)."
  implication: "Catch 블록은 throw 하지 않고 down 결과를 반환하지만, Terminus HealthCheckService 는 any down → HealthCheckError → 503 변환."

- timestamp: 2026-04-24T00:12:00Z
  checked: "apps/api/src/modules/booking/providers/redis.provider.ts (전체 397줄), grep 'ping'"
  found: "InMemoryRedis 클래스 (lines 14-339) 에 ping 메서드 0 matches. 제공되는 메서드: set, decr, pttl, pipeline, get, del, sadd, srem, smembers, scard, ttl, expire, eval + private eval helpers. factory (line 351-395) 에서 REDIS_URL 없고 NODE_ENV !== production 일 때 'return new InMemoryRedis() as unknown as IORedis' — 타입 캐스팅으로 컴파일 타임 타입 체크 우회."
  implication: "ROOT CAUSE: 런타임에 this.redis.ping 은 undefined — this.redis.ping() 호출 시 즉시 synchronous TypeError ('this.redis.ping is not a function'). catch 로 떨어지고 indicator.down({ message: 'this.redis.ping is not a function' }) 반환 → 503."

- timestamp: 2026-04-24T00:13:00Z
  checked: "apps/api/src/modules/booking/providers/redis-io.adapter.ts lines 73-80 (RedisIoAdapter.connectToRedis)"
  found: "이미 동일 상황(InMemoryRedis mock)을 방어적으로 처리하고 있음: typeof maybeClient.duplicate !== 'function' 체크 후 warning log 남기고 falls back. 즉, InMemoryRedis 가 ioredis API 일부(ping, duplicate 등)를 구현하지 않는다는 사실은 codebase 의 다른 곳에서는 이미 알려진 제약."
  implication: "동일한 capability-probe 가드 패턴을 RedisHealthIndicator 에도 적용하거나, health controller 에서 dev-mode skip 가드를 적용하는 것이 해결의 방향. '이미 있는 패턴을 재사용한다' 는 신호."

- timestamp: 2026-04-24T00:14:00Z
  checked: "git log --follow apps/api/src/health/health.controller.ts, redis.health.indicator.ts, redis.provider.ts"
  found: "health.controller + redis.health.indicator: 7f34d8b feat(07-05) add RedisHealthIndicator to /health. redis.provider + InMemoryRedis: 8e25c79 fix(03) add in-memory Redis mock. Phase 13 (grapit→grabit rename) commits 가 이 세 파일을 건드리지 않음."
  implication: "Pre-existing bug — Phase 7 에서 RedisHealthIndicator 추가할 때 InMemoryRedis 에 ping() 이 없다는 점을 간과. 지금까지는 로컬 dev 할 때 /health 를 아무도 히트하지 않아서 숨어 있었음. Phase 13 UAT 에서 처음 노출됨. NOT a Phase 13 regression."

- timestamp: 2026-04-24T00:15:00Z
  checked: "apps/api/src/health/__tests__/redis.health.indicator.spec.ts"
  found: "기존 unit test 는 mockRedis = { ping: vi.fn() } 로 ping 메서드가 존재하는 mock 을 주입. 따라서 '실제 InMemoryRedis 에 ping() 이 없다' 라는 시나리오를 커버하지 않음. ping() resolves/rejects 시나리오만 있음."
  implication: "테스트 gap — fix 와 함께 'InMemoryRedis fallback 에서도 /health 가 200 을 반환해야 한다' 는 회귀 테스트 추가 필요. 구체적으로 health.controller.spec 또는 e2e 테스트에서 REDIS_URL 미설정 상태 시뮬레이션."

- timestamp: 2026-04-24T00:16:00Z
  checked: "apps/api/src/main.ts lines 74, 76"
  found: "globalPrefix 'api/v1' + default port 8080 — /api/v1/health 경로와 localhost:8080 재현 스텝 일치."
  implication: "Reproduction path 확정."

- timestamp: 2026-04-24T00:17:00Z
  checked: "apps/api/src/config/redis.config.ts + .env 존재 여부 + 6379 LISTEN"
  found: "redis.config.ts: url = process.env['REDIS_URL'] ?? ''. 워크트리 루트에 .env 없음 (Grep Path does not exist 확인). lsof -iTCP:6379 -sTCP:LISTEN exit 1 (아무것도 없음)."
  implication: "config.get('redis.url', '') → '' → factory가 InMemoryRedis fallback 경로 타게 되는 것이 확정. Provider 단에서 production 가드 (NODE_ENV === 'production' 시 throw) 는 있지만 dev 에서는 throw 없이 mock 반환."

## Resolution

root_cause: |
  RedisHealthIndicator 가 REDIS_CLIENT 토큰을 IORedis 로 타입 주장(assertion) 받지만,
  로컬 dev (REDIS_URL 미설정) 에서 redis.provider.ts 가 `new InMemoryRedis() as unknown as IORedis` 로 타입 캐스팅하여 반환한다.
  InMemoryRedis 클래스에는 ping() 메서드가 구현되어 있지 않다.
  결과적으로 health 엔드포인트 호출 시 indicator.isHealthy() 가 this.redis.ping() 을 호출 → 'this.redis.ping is not a function' TypeError → catch 에서 indicator.down() 반환 → Terminus 가 HealthCheckError 로 변환 → 503.
  HealthController 에도 dev-mode skip 가드가 없어 REDIS_URL 이 unset 이면 /health 전체가 실패한다.
  이 버그는 Phase 7-05 (7f34d8b) 에서 indicator 가 추가된 시점부터 존재했으며, Phase 13 rename 과는 무관한 pre-existing gap 이다. UAT 에서 처음 히트되어 노출됨.
fix: "Phase 17 implemented `InMemoryRedis.ping()` and a RedisHealthIndicator no-ping capability probe."
verification: "17-VERIFICATION.md passed. Focused provider/health tests 15/15, typecheck passed, lint exit 0."
files_changed:
  - apps/api/src/modules/booking/providers/redis.provider.ts
  - apps/api/src/health/redis.health.indicator.ts
