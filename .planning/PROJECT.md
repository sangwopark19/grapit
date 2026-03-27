# Grapit

## What This Is

공연·전시·스포츠 등 라이브 엔터테인먼트 티켓 예매 플랫폼. NOL 티켓(인터파크)을 참조하여 장르별 큐레이션, SVG 기반 좌석 선택, 원스톱 예매 플로우를 제공한다. 실제 서비스 런칭을 목표로 1인 개발로 진행한다.

## Core Value

사용자가 원하는 공연을 발견하고, 좌석을 직접 선택하여, 안정적으로 예매를 완료할 수 있는 것. 이 흐름이 끊기면 서비스의 의미가 없다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 회원 인증 (이메일/소셜 로그인, 세션 유지, 토큰 관리)
- [ ] 공연 카탈로그 (장르별 카테고리, 상세 정보, 포스터, 가격)
- [ ] 통합 검색 (공연명, 아티스트, 장르 필터)
- [ ] SVG 기반 좌석 배치도 (등급별 구분, 실시간 점유 상태, 확대/축소)
- [ ] 예매 플로우 (날짜/회차 선택 → 좌석 선택 → 결제 → 완료)
- [ ] 좌석 임시 점유 (Redis SET NX, 10분 TTL)
- [ ] Toss Payments 결제 연동 (카드, 간편결제)
- [ ] 예매 확인/취소/환불 (마이페이지)
- [ ] Admin MVP (공연 CRUD, 회차 관리, 예매 조회/환불 처리)

### Out of Scope

- 대기열 시스템 — Phase 2에서 구현 (트래픽 낮은 초기에는 불필요)
- 랭킹 시스템 — Phase 2에서 구현 (예매 데이터 축적 필요)
- 오픈예정/티켓캐스트 — Phase 2에서 구현
- 프로모션/타임딜/쿠폰 — Phase 2에서 구현
- 로터리 티켓(추첨제) — Phase 3에서 구현
- 캐스팅 일정 조회 — Phase 3에서 구현
- 관람후기/기대평 — Phase 3에서 구현
- 다국어 지원 — Phase 3 이후
- 모바일 앱 (Expo) — Phase 4
- MD Shop / 토핑 — Phase 4
- 실시간 채팅/커뮤니티 — 서비스 성격에 맞지 않음
- OAuth 외 인증 (본인인증/PASS) — 초기에는 불필요

## Context

### 참조 사이트
NOL 티켓(nol.interpark.com/ticket)을 상세 분석한 5개 문서가 docs/에 있음:
- `01-SITE-ANALYSIS-REPORT.md` — 사이트맵, URL 패턴, GNB, 예매 플로우
- `02-PRD.md` — 기능 요구사항 (P0~P2), 사용자 페르소나, 데이터 모델
- `03-ARCHITECTURE.md` — 시스템 아키텍처, ERD, API 설계, 동시성 처리
- `04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트, 레이아웃, 접근성
- `05-ADMIN-PREDICTION.md` — 관리자 기능 역추론

### 기술 스택
| 계층 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router, React 19, TypeScript 5.9) |
| 백엔드 | NestJS 11 (모듈러 모놀리스) |
| 메인 DB | Cloud SQL for PostgreSQL 16 (서울 리전) |
| 캐시/실시간 | Upstash Redis (좌석 점유, 실시간 pub/sub) |
| 오브젝트 스토리지 | Cloudflare R2 |
| CDN/WAF | Cloudflare |
| 배포 | Google Cloud Run (서울, asia-northeast3) |
| 결제 | Toss Payments |
| 에러 추적 | Sentry |
| CI/CD | GitHub Actions |

### 아키텍처 핵심 결정
- **모듈러 모놀리스:** 마이크로서비스 대신 NestJS Module 기반 단일 배포. 인메모리 호출로 오버헤드 제거
- **Just Use Postgres:** 검색(tsvector + pg_trgm), Job Queue(pgboss/SKIP LOCKED)를 PostgreSQL로 통합
- **Redis는 실시간 전용:** 좌석 임시 점유(SET NX), 실시간 좌석 상태 브로드캐스트(Pub/Sub)에만 사용
- **SVG 좌석맵:** 외부 도구(Figma 등)에서 SVG 제작 → Admin에서 업로드. 인라인 편집기는 Phase 3 이후

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
| NestJS 모듈러 모놀리스 | 1인 개발에서 마이크로서비스는 오버헤드. 모듈 분리로 관심사 격리하되 단일 배포 유지 | — Pending |
| PostgreSQL 기반 검색 (ES 제거) | tsvector + pg_trgm으로 공연 검색 충분. 별도 검색 엔진 운영 비용 제거 | — Pending |
| Toss Payments | 문서 품질 우수, SDK 기반 연동 용이, 국내 PG 중 개발자 경험 최상 | — Pending |
| SVG 좌석맵 MVP 포함 | 티켓 플랫폼의 핵심 차별점. 등급 자동배정은 사용자 경험 열화 | — Pending |
| Cloud Run (GCP) | 서울 리전 저지연, 자동 확장, 컨테이너 기반 배포 | — Pending |
| Admin을 Next.js /admin 라우트로 | 별도 앱 분리 불필요. MVP에서는 같은 앱 내 라우트 그룹으로 구현 | — Pending |

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
*Last updated: 2026-03-27 after initialization*
