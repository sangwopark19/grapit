# Grapit

## What This Is

공연·전시·스포츠 라이브 엔터테인먼트 티켓 예매 플랫폼. 장르별 큐레이션, SVG 기반 좌석 선택, Toss Payments 결제, 실시간 좌석 동기화를 갖춘 MVP가 배포되어 있다. 1인 개발, Next.js 16 + NestJS 11 모듈러 모놀리스.

## Core Value

사용자가 원하는 공연을 발견하고, 좌석을 직접 선택하여, 안정적으로 예매를 완료할 수 있는 것. 이 흐름이 끊기면 서비스의 의미가 없다.

## Requirements

### Validated

- ✓ 회원 인증 (이메일/소셜 로그인, 세션 유지, 토큰 관리) — v1.0
- ✓ 공연 카탈로그 (장르별 카테고리, 상세 정보, 포스터, 가격) — v1.0
- ✓ 통합 검색 (공연명, 장르 필터, 판매종료 토글) — v1.0
- ✓ Admin MVP (공연 CRUD, 회차 관리, SVG 좌석맵 업로드, 예매 조회/환불) — v1.0
- ✓ SVG 기반 좌석 배치도 (등급별 구분, 실시간 점유 상태, 확대/축소) — v1.0
- ✓ 예매 플로우 (날짜/회차 선택 → 좌석 선택 → 결제 → 완료) — v1.0
- ✓ 좌석 임시 점유 (Redis SET NX, 10분 TTL, 자동 해제) — v1.0
- ✓ Toss Payments 결제 연동 (카드/카카오페이/네이버페이/계좌이체) — v1.0
- ✓ 예매 확인/취소/환불 (마이페이지) — v1.0
- ✓ 모바일 반응형 + 스켈레톤 UI + 한국어 에러 핸들링 — v1.0
- ✓ CI/CD + Docker + Sentry + Cloud Run 배포 — v1.0
- ✓ Upstash Redis 제거, ioredis 단일 클라이언트로 Google Memorystore for Valkey 전환 — Phase 7 (v1.1) *(코드 레벨 완료, 런타임 검증은 07-HUMAN-UAT.md)*
- ✓ 공연 카탈로그 Redis 캐시 레이어 (read-through + admin CRUD 무효화) — Phase 7 (v1.1)

### Active

#### Current Milestone: v1.1 안정화 + 고도화

**Goal:** 인프라 안정화(기술부채 청산, Redis→Valkey 전환, R2 연동, SMS 인증 실연동)를 완료하고, 어드민 고도화 및 UX 현대화로 서비스 품질을 끌어올린다.

**Target features:**
- [ ] 기술부채 12건 청산 (password reset, 테스트 회귀, Toss E2E 등)
- [x] Upstash Redis → Google Valkey 전환 (좌석 잠금, pub/sub, 캐시 전부) — Phase 7 (코드 완료, 런타임 검증 4건은 배포 후)
- [ ] Cloudflare R2 완전 연동 (키 발급 → 프로덕션 업로드/서빙)
- [ ] SMS 인증 실연동 (dev mock → 실제 SMS 발송/검증)
- [ ] 어드민 고도화 + 통계 대시보드
- [ ] UX 현대화 — 디자인 트렌드 반영 + SVG 좌석맵 UX 개선

### Out of Scope

- 대기열 시스템 — 트래픽 낮은 초기에는 불필요
- 랭킹 시스템 — 예매 데이터 축적 필요
- 오픈예정/티켓캐스트 — 사용자 기반 확보 후
- 프로모션/타임딜/쿠폰 — 마케팅 단계에서 추가
- 로터리 티켓(추첨제) — 높은 구현 복잡도
- 관람후기/기대평 — 소셜 기능은 코어 플로우 안정 후
- 다국어 지원 — 한국 시장 집중
- 모바일 앱 (Expo) — 웹 우선 검증, PMF 확인 후
- 실시간 채팅/커뮤니티 — 서비스 성격에 맞지 않음
- 본인인증(PASS) — 초기에는 불필요
- 인라인 SVG 좌석맵 편집기 — 외부 도구에서 제작 후 업로드로 충분

## Context

### Current State (v1.0 shipped)

- **코드베이스:** 23,547 LOC TypeScript, 331 commits
- **Tech stack:** Next.js 16 + NestJS 11 + Drizzle ORM + PostgreSQL 16 + Google Memorystore for Valkey (ioredis) + Socket.IO + Toss Payments
- **배포:** Cloud Run (서울 asia-northeast3), GitHub Actions CI/CD, Sentry 에러 추적
- **테스트:** 63 백엔드 유닛 테스트, 45 프론트엔드 테스트
- **알려진 기술 부채:** 12건 (password reset stub, 테스트 회귀 1건, Toss E2E 미검증 등)

### 참조 사이트
NOL 티켓(nol.interpark.com/ticket)을 상세 분석한 5개 문서가 docs/에 있음:
- `01-SITE-ANALYSIS-REPORT.md` — 사이트맵, URL 패턴, GNB, 예매 플로우
- `02-PRD.md` — 기능 요구사항 (P0~P2), 사용자 페르소나, 데이터 모델
- `03-ARCHITECTURE.md` — 시스템 아키텍처, ERD, API 설계, 동시성 처리
- `04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트, 레이아웃, 접근성
- `05-ADMIN-PREDICTION.md` — 관리자 기능 역추론

### 타겟 페르소나
1. 공연 매니아 "지현" (28세) — 월 2~3회 관람, 좌석 위치 민감, 캐스팅 체크
2. 캐주얼 관람객 "민수" (35세) — 가족 단위, 할인 관심, 모바일 우선
3. 콘서트 팬 "수진" (22세) — 티켓팅 경쟁, 간편결제 선호

## Constraints

- **1인 개발**: 모든 영역(프론트/백/인프라)을 혼자 담당 — 복잡도를 최소화하고 모놀리스 우선
- **Tech Stack**: docs/03-ARCHITECTURE.md에 정의된 스택을 그대로 따름
- **결제**: Toss Payments SDK 연동 (PG사 계약 및 사업자등록 필요)
- **인프라**: GCP 서울 리전 (asia-northeast3) 기반, 초기 min-instances=0으로 비용 최소화
- **SVG 좌석맵**: MVP부터 SVG 기반 좌석 선택 구현 (외부 제작 SVG 업로드 방식)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS 모듈러 모놀리스 | 1인 개발에서 마이크로서비스는 오버헤드 | ✓ Good — 5개 모듈 깔끔하게 분리, 배포 단순 |
| PostgreSQL 기반 검색 (ES 제거) | tsvector + pg_trgm으로 충분 | ✓ Good — <100k 규모에서 성능 문제 없음 |
| Toss Payments | SDK 기반 연동 용이, 개발자 경험 최상 | ✓ Good — SDK v2 위젯 연동 완료, 4개 결제 수단 |
| SVG 좌석맵 MVP 포함 | 핵심 차별점, 등급 자동배정은 UX 열화 | ✓ Good — react-zoom-pan-pinch로 모바일 포함 구현 |
| Cloud Run (GCP) | 서울 리전 저지연, 자동 확장 | ✓ Good — Docker 빌드 + CI/CD 파이프라인 완성 |
| Admin을 /admin 라우트로 | 별도 앱 분리 불필요 | ✓ Good — LayoutShell 조건부 렌더링으로 깔끔 분리 |
| Drizzle ORM (TypeORM/Prisma 제외) | 14x 낮은 지연, ~7kb 번들, SQL-first | ✓ Good — 스키마 기반 zod 통합, 빠른 cold start |
| Access token Zustand 메모리 저장 | OWASP XSS 방어 best practice | ✓ Good — localStorage 노출 없음, 401 자동 refresh |
| ~~Redis 이원화 (Upstash HTTP + ioredis TCP)~~ | ~~Pub/Sub는 TCP 필수, 나머지는 서버리스 HTTP~~ | ✗ Reversed in Phase 7 — ioredis 단일화 + Google Memorystore for Valkey(VPC private endpoint)로 전환. 이원화의 운영 복잡도가 Valkey 전환 비용보다 커서 `@upstash/redis` 제거 |
| ioredis 단일 클라이언트 + Memorystore Valkey | Cloud Run Direct VPC Egress로 private endpoint 직결, Lua 스크립트 호환성 + Socket.IO Redis adapter 양쪽을 동일 클라이언트로 처리 | Phase 7 — 코드 완료 (plans 01~05), 배포 후 런타임 검증 4건 대기 |
| Production REDIS_URL hard-fail + InMemoryRedis dev-only | 미설정 시 silent fallback → 조용한 운영 장애 원인이 됨. `NODE_ENV=production`이면 throw, dev/test만 mock 허용 | Phase 7 Plan 04 — cross-AI 리뷰 HIGH #1 대응 |
| CacheService invalidate best-effort | Redis 장애가 admin CRUD API를 500으로 떨어뜨리면 안 됨 → try/catch + warn 로그만 | Phase 7 Plan 04 — cross-AI 리뷰 MEDIUM #6 대응 |
| testcontainers 기반 Valkey 통합 테스트 (격리 vitest config) | Lua 스크립트가 실제 Valkey Lua 5.1 interpreter에서 돌아가는지 단위 테스트로는 검증 불가. `pnpm test:integration`으로만 실행되어 기본 피드백 루프 보호 | Phase 7 Plan 05 — cross-AI 리뷰 HIGH #2 대응 |
| HealthController Valkey ping (Terminus 11) | Cloud Run liveness probe가 Valkey 장애를 즉시 감지 → silent outage 차단 | Phase 7 Plan 05 — cross-AI 리뷰 MEDIUM #7 대응 |
| Family-based refresh token rotation | 토큰 탈취 감지 | ✓ Good — SHA-256 해시 저장, 가족 단위 무효화 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after Phase 7 re-verification (plans 04+05: operational safety fix-ups, health indicator, testcontainers integration)*
