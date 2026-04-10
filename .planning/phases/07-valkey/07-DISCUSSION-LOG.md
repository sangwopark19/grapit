# Phase 7: Valkey 마이그레이션 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 07-valkey
**Areas discussed:** 클라이언트 라이브러리, 로컬 개발 환경, 캐시 레이어 설계, GCP 인프라 전략

---

## 클라이언트 라이브러리

### Round 1: iovalkey vs Valkey GLIDE

ROADMAP.md에서 iovalkey로 초기 확정되어 있어 locked decision으로 처리.
사용자 요청으로 iovalkey vs Valkey GLIDE 심층 비교 분석 수행:

| 항목 | iovalkey | Valkey GLIDE |
|------|----------|-------------|
| 코어 | 순수 TypeScript (ioredis 포크) | Rust 코어 + Node.js protobuf 바인딩 |
| Socket.IO adapter 호환 | 완벽 (duplicate(), 동적 subscribe) | 불가 (정적 Pub/Sub, duplicate() 미지원) |
| eval() → invokeScript() | 시그니처 변경만 | 전면 교체 (Script 클래스) |
| 성능 | 8,158 ops/s (SET) | 6,585 ops/s (-19%) |
| 마이그레이션 비용 | 1-2시간 | 1-2일 |

결론: GLIDE 미채택 (Socket.IO adapter 근본적 불호환)

### Round 2: iovalkey vs ioredis 유지 (사용자 추가 요청)

사용자가 iovalkey와 ioredis 중 어느 것이 더 적합한지 추가 심층 조사 요청.

| 항목 | ioredis | iovalkey |
|------|---------|---------|
| 최신 버전 | v5.10.1 (2026-03-19) | v0.3.1 (2025-03-10) |
| 최근 릴리스 | 2026년 1~3월 6개 릴리스 | 13개월째 릴리스 없음 |
| npm 주간 다운로드 | 1,470만 | 수만 (극소량) |
| @socket.io/redis-adapter | 공식 지원 | 비공식 (언급 없음) |
| 버전 안정성 | v5.x (안정) | v0.x (1.0 미도달) |
| Valkey 호환 | 기본 커맨드 100% 호환 | 공식 지원 |

iovalkey 우려사항: 13개월 릴리스 없음, export 문서 불일치(#27 미해결), Valkey 조직 내 GLIDE 1순위로 밀려남

**User's choice:** ioredis 유지 (ROADMAP 수정 — iovalkey → ioredis)
**Notes:** @upstash/redis만 제거하고 ioredis 단일 클라이언트로 통합. 향후 iovalkey 1.0 + @socket.io/redis-adapter 공식 지원 시 재평가.

---

## 로컬 개발 환경

| Option | Description | Selected |
|--------|-------------|----------|
| 둘 다 지원 (추천) | env 없으면 InMemoryRedis, REDIS_URL 있으면 ioredis 접속. 현재 패턴 유지 | ✓ |
| Docker Valkey 컨테이너 | docker-compose 구성. 실제 환경 동일. Docker 의존성 추가 | |
| mock 제거, Docker만 | InMemoryRedis 삭제하고 Docker Valkey로 통일 | |

**User's choice:** 둘 다 지원 (추천)
**Notes:** 기존 graceful degradation 패턴 유지. mock eval() 시그니처만 ioredis에 맞춰 업데이트.

---

## 캐시 레이어 설계 (VALK-06)

### 캐싱 대상 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 목록 + 상세 (추천) | 공연 목록 + 상세 API 캐싱. admin CRUD 시 무효화 | ✓ |
| 목록 + 상세 + 검색 | 위 + 검색 결과 캐싱. 캐시 키 복잡도 증가, 무효화 난이도 높음 | |
| 상세만 | 공연 상세만 캐싱. 최소 복잡도 | |

### TTL/무효화 전략

| Option | Description | Selected |
|--------|-------------|----------|
| TTL 5분 + admin 수동 무효화 (추천) | 5분 TTL 자동 만료 + admin CRUD 시 해당 캐시 즉시 삭제 | ✓ |
| TTL 10분 + 태그 기반 무효화 | 긴 TTL + 캐시 태그로 선택적 무효화. 구현 복잡도 상승 | |
| Claude에게 위임 | 캐시 전략 세부 사항은 구현 시 최적 판단에 맡김 | |

**User's choice:** 목록+상세, TTL 5분+수동 무효화
**Notes:** 검색 결과 캐싱은 deferred (쿼리 조합 복잡도)

---

## GCP 인프라 전략

### 프로비저닝 방식

| Option | Description | Selected |
|--------|-------------|----------|
| gcloud CLI (추천) | CLI 명령어로 프로비저닝. 1인 개발에서 Terraform 오버헤드 회피 | ✓ |
| Terraform | IaC로 인프라 버전 관리. 재현성 높지만 학습/세팅 비용 | |
| GCP 콘솔 수동 | 웹 콘솔에서 클릭 생성. 가장 빠르지만 재현성 낮음 | |

### VPC 네트워킹

| Option | Description | Selected |
|--------|-------------|----------|
| Direct VPC Egress (추천) | Cloud Run에서 VPC로 직접 접속. 추가 인스턴스 비용 없음. GCP 최신 권장 | ✓ |
| PSC (Private Service Connect) | Google 네트워크로 비공개 접속. 보안 높음. 설정 복잡 | |
| Claude에게 위임 | VPC 세부 사항은 리서처/계획 단계에서 결정 | |

**User's choice:** gcloud CLI + Direct VPC Egress
**Notes:** 없음

---

## Claude's Discretion

- Lua 스크립트 eval() 시그니처 변환 세부사항
- 캐시 키 네이밍 컨벤션
- redis.config.ts 환경변수 정리
- gcloud CLI 프로비저닝 파라미터
- CI/CD 환경변수 마이그레이션

## Deferred Ideas

- 검색 결과 캐싱 — 쿼리 조합 복잡도 높아 별도 phase에서 검토
