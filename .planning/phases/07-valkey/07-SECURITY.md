---
phase: 07
slug: valkey
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-13
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| BookingService -> Redis | 내부 서비스에서 Redis 명령어 실행. Lua 스크립트 하드코딩, 사용자 입력은 ARGV로만 전달 | Lua eval args (seatId, userId, TTL) |
| Client -> BookingController | 클라이언트 좌석 잠금/해제 요청. JwtAuthGuard 인증 필수 | userId, seatId, showtimeId |
| CacheService -> Redis | 캐시 데이터 직렬화/역직렬화. 캐시 키는 서버 측 생성 | JSON-serialized public performance data |
| Client -> PerformanceController | Public 엔드포인트. 캐시된 데이터를 읽기 전용으로 반환 | Public performance/banner data |
| Admin -> AdminController | RolesGuard로 보호. admin만 캐시 무효화 트리거 가능 | CRUD operations triggering cache invalidation |
| Cloud Run -> Valkey (PSC) | Private Service Connect 내부 네트워크. 외부 접근 불가 | Redis protocol over TCP (private IP) |
| GitHub Actions -> GCP | Workload Identity Federation (OIDC)으로 인증 | Deploy artifacts, secret references |
| Secret Manager -> Cloud Run | IAM 기반 시크릿 접근 제어 | REDIS_URL connection string |
| config -> redis provider factory | Cloud Run secret binding → app startup. misconfig 감지 필수 | REDIS_URL env var |
| CacheService -> admin write path | Admin DB commit 이후 invalidate 실행. 캐시 에러가 HTTP 응답에 전파되면 안됨 | Cache invalidation commands |
| Socket.IO adapter -> ioredis pub/sub | 단일 ioredis 클라이언트 공유. duplicate()로 connection isolation | SUBSCRIBE/PUBLISH messages |
| Cloud Run liveness probe -> /health | 503 = unhealthy → instance restart. RedisHealthIndicator가 유일한 Valkey 상태 표시 | PING/PONG |
| test process -> Docker daemon | testcontainers가 Valkey container 스폰 (valkey/valkey:8-alpine) | Test data only (dev environment) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-07-01 | Tampering | redis.provider.ts eval() | mitigate | Lua 스크립트 하드코딩 (booking.service.ts:32,67,85). 사용자 입력은 ioredis flat args로만 전달 | closed |
| T-07-02 | Denial of Service | InMemoryRedis fallback | accept | 로컬 개발 전용. 프로덕션은 REDIS_URL 필수 (T-07-10에서 enforce) | closed |
| T-07-03 | Information Disclosure | redis.config.ts | mitigate | REDIS_URL은 환경변수 전용 (redis.config.ts:4). .env는 .gitignore. 프로덕션은 GCP Secret Manager | closed |
| T-07-04 | Tampering | cache.service.ts cache poisoning | mitigate | 캐시 키 서버 측 생성. 쿼리 파라미터는 Zod 검증 통과 값만 사용 | closed |
| T-07-05 | Denial of Service | KEYS 명령어 (invalidatePattern) | accept | 캐시 키 수 <1k로 KEYS가 수ms 이내 완료. 트래픽 증가 시 SCAN 교체 필요 (Phase 8+) | closed |
| T-07-06 | Information Disclosure | 캐시 데이터 | accept | @Public 엔드포인트 데이터만 캐시. 사용자별/인증 필요 데이터 미캐시 | closed |
| T-07-07 | Spoofing | deploy.yml GCP auth | mitigate | Workload Identity Federation (OIDC) via google-github-actions/auth@v3 (deploy.yml:33,114). 서비스 계정 키 파일 미사용 | closed |
| T-07-08 | Information Disclosure | REDIS_URL Secret | mitigate | GCP Secret Manager 저장 (deploy.yml:100 `REDIS_URL=redis-url:latest`). deploy.yml에 평문 미포함. IAM으로 Cloud Run SA에만 접근 허용 | closed |
| T-07-09 | Tampering | Valkey 네트워크 접근 | mitigate | PSC + Direct VPC Egress (deploy.yml:83 `--vpc-egress=private-ranges-only`). private IP만 VPC 경유 | closed |
| T-07-10 | Denial of Service | redis.provider.ts factory | mitigate | NODE_ENV=production && !url 시 Error throw (redis.provider.ts:227). 유닛 테스트 assert throw path (redis.provider.spec.ts:46) | closed |
| T-07-11 | Information Disclosure | cache.service.ts Logger.warn | mitigate | 로그에 err.message, key, op만 포함. 캐시 VALUE 미로그 (cache.service.ts:47-48,60-61,74-75,88-89) | closed |
| T-07-12 | Tampering | UNLOCK_SEAT_LUA numKeys | accept (already mitigated) | booking.service.spec.ts:206에서 `expect(numKeys).toBe(3)` assert. Lua KEYS[1..3] 참조 확인 | closed |
| T-07-13 | Denial of Service | redis-io.adapter.ts subClient | mitigate | duplicate()에 `{ maxRetriesPerRequest: null, enableReadyCheck: false }` 전달. SUBSCRIBE abort 방지 | closed |
| T-07-14 | Repudiation / Audit | 07-HUMAN-UAT.md release gate | mitigate | post-merge-smoke-test 전략 + Cloud Run revision rollback 절차. 1인 개발 audit trail 제공 | closed |
| T-07-15 | Denial of Service / Silent Outage | health.controller.ts + RedisHealthIndicator | mitigate | redis.ping() 기반 health check (redis.health.indicator.ts:32). Cloud Run liveness probe → 503 → instance restart. up/down/unexpected 3개 테스트 | closed |
| T-07-16 | Tampering | booking.service integration spec | mitigate | 실제 Valkey 8 컨테이너(valkey/valkey:8-alpine)에서 Lua 실행. Valkey-Redis Lua 호환성 검증 | closed |
| T-07-17 | Supply Chain | testcontainers + valkey image | accept | devDependency만. 프로덕션 미배포. testcontainers >5M weekly DL, valkey 공식 이미지 | closed |
| T-07-18 | Information Disclosure | HealthIndicator down message | mitigate | down() 경로에 err.message만 포함 (ECONNREFUSED 등). Redis URL/credentials/cache values 미로그 | closed |

*Status: open / closed*
*Disposition: mitigate (implementation required) / accept (documented risk) / transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-07-02 | InMemoryRedis는 로컬 개발 전용. 프로덕션에서는 T-07-10이 REDIS_URL 미설정 시 boot failure를 보장 | Developer | 2026-04-13 |
| AR-02 | T-07-05 | KEYS O(N) 명령어 사용. 현재 캐시 키 <1k개로 수ms 이내 완료. 키 폭증 시 SCAN으로 교체 필요 | Developer | 2026-04-13 |
| AR-03 | T-07-06 | Public 엔드포인트 데이터만 캐시. 인증 필요 데이터/사용자별 데이터는 캐시 대상 아님 | Developer | 2026-04-13 |
| AR-04 | T-07-12 | unlockSeat Lua numKeys=3은 유닛 테스트에서 이미 검증됨. 추가 코드 변경 불필요 | Developer | 2026-04-13 |
| AR-05 | T-07-17 | testcontainers + valkey 이미지는 devDependency로 프로덕션 미배포. 이미지 digest 고정은 follow-up | Developer | 2026-04-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-13 | 18 | 18 | 0 | Claude (secure-phase orchestrator) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-13
