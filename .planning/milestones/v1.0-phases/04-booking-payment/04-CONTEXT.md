# Phase 4: Booking + Payment - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3의 좌석 선택 완료("다음" 버튼) 이후부터 결제 확인 → Toss Payments 결제 → 예매 완료 → 마이페이지 예매 내역 조회/취소/환불 → Admin 예매 조회/환불 처리까지의 전체 예매 트랜잭션 플로우를 완성한다.

</domain>

<decisions>
## Implementation Decisions

### 결제 확인 화면 (주문서)
- **D-01:** Phase 3 "다음" 클릭 시 별도 주문서 페이지(`/booking/[performanceId]/confirm`)로 이동. 공연 정보 + 예매자 정보 + 선택 좌석/금액 요약 + 약관 동의 + 결제 위젯 + 결제하기 버튼을 한 페이지에 배치
- **D-02:** 예매자 정보는 회원 정보(이름/전화번호)를 자동 채우기하고 [수정] 버튼으로 변경 가능. 가입 시 이미 수집된 정보 활용 (Phase 1 D-03)
- **D-03:** Toss Payments 결제 위젯을 주문서 페이지 하단에 인라인 렌더링. 페이지 이탈 없이 결제 수단 선택 → 결제 진행. NOL 티켓 방식
- **D-04:** Phase 3의 임시점유 카운트다운 타이머를 주문서 페이지 상단에도 고정 표시. 10분 TTL 내 결제 완료 필요 안내

### 결제 결과 처리
- **D-05:** 결제 성공 시 전용 완료 페이지(`/booking/[performanceId]/complete`)로 이동. 예매번호 + 공연정보 + 좌석 + 결제금액/수단 + 취소마감시간 + [예매내역 보기]/[홈으로] 버튼 표시
- **D-06:** 결제 실패/취소 시 좌석 선택 화면으로 복귀. 에러 메시지(토스트) 표시 + 좌석 점유 유지(TTL 내). 재시도 안내. 별도 실패 페이지 없음

### 예매 내역 관리 (마이페이지)
- **D-07:** 마이페이지에 예매 내역 탭/섹션 추가. 카드형 목록(포스터 썸네일 + 공연명 + 날짜/시간 + 좌석 요약 + 상태 배지). 상단 상태 필터(전체/예매완료/취소완료)
- **D-08:** 카드 클릭 시 별도 예매 상세 페이지(`/mypage/reservations/[id]`)로 이동. 예매번호, 공연정보, 좌석 상세, 결제정보(금액/수단/일시), 취소마감시간, 취소 버튼 표시
- **D-09:** 전체 취소만 허용 (부분 취소 없음). 취소 버튼 클릭 → 확인 모달(취소 사유 선택 + 환불 예정 금액 안내) → 확인 → Toss Payments 환불 API → 취소 완료
- **D-10:** 취소 마감시간은 공연 시작시간 24시간 전. 마감 이후에는 취소 버튼 비활성 + "취소 마감시간이 지났습니다" 안내

### Admin 예매 관리
- **D-11:** Admin 예매 관리 화면은 대시보드 + 테이블 결합. 상단에 통계 카드(총 예매수, 매출액, 취소율) + 하단에 테이블(예매번호, 예매자, 공연명, 날짜, 좌석, 금액, 상태) + 상태 필터 + 검색(예매번호/예매자명). Phase 2 Admin 패턴(D-16) 확장
- **D-12:** 테이블 행 클릭 → 예매 상세 모달. 환불 버튼 + 환불 사유 입력 + 확인으로 Toss Payments 환불 API 호출. 개별 환불 처리 방식

### Toss Payments 연동 필수 규칙
- **D-13:** Toss Payments 결제 시스템 개발/연동 시 반드시 `mcp__tosspayments__*` MCP 도구를 사용하여 공식 문서를 참조할 것. SDK 버전, API 엔드포인트, 파라미터 등을 MCP에서 확인 후 구현

### Claude's Discretion
- 예매번호 포맷 (GRP-YYYYMMDD-NNN 등)
- Toss Payments SDK 초기화 및 결제 요청/승인/취소 API 호출 구조
- 결제 승인 서버사이드 검증 로직 (금액 위변조 방지)
- 예매/결제 DB 스키마 (reservations, payments 테이블 설계)
- 환불 금액 계산 로직 (전액 환불)
- 예매 상태 머신 (PENDING → CONFIRMED → CANCELLED 등)
- Admin 통계 카드 집계 쿼리 방식
- 에러 핸들링 전략 (결제 타임아웃, 네트워크 에러 등)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Toss Payments (최우선)
- **MCP 도구 필수 사용**: `mcp__tosspayments__get-v2-documents`, `mcp__tosspayments__document-by-id` — Toss Payments API 문서, SDK 사용법, 결제/승인/취소 API 스펙을 반드시 MCP에서 조회하여 구현
- `CLAUDE.md` §Technology Stack — `@tosspayments/tosspayments-sdk 2.5.x` (프론트엔드 SDK). `@tosspayments/sdk`는 deprecated

### 아키텍처 & API
- `docs/03-ARCHITECTURE.md` — 시스템 아키텍처, 결제 플로우 시퀀스, API 엔드포인트 설계. 특히 §결제 플로우, §에러 처리
- `docs/03-ARCHITECTURE.md` §ERD — 예매/결제 관련 테이블 관계

### 기존 DB 스키마 (Phase 3에서 추가된 것 포함)
- `apps/api/src/database/schema/` — 전체 스키마. 특히 performances, showtimes, seat-maps, price-tiers 테이블
- `packages/shared/src/types/performance.types.ts` — PriceTier, Showtime, SeatMapConfig 등 공유 타입

### UI/UX & PRD
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트 패턴
- `docs/02-PRD.md` — 예매/결제 요구사항, 사용자 플로우
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 예매 플로우 분석, 결제 화면 참조

### 이전 Phase 컨텍스트
- `.planning/phases/03-seat-map-real-time/03-CONTEXT.md` — 좌석 선택 플로우(D-01~D-13), "다음" 버튼이 Phase 4 진입점. 타이머(D-10~D-11), 좌석 점유(D-12~D-13)
- `.planning/phases/02-catalog-admin/02-CONTEXT.md` — Admin 테이블 패턴(D-16), 상세 페이지 구성(D-09~D-12)
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 브랜드 컬러(D-14~D-16), 마이페이지 구조(D-12), 회원 정보 수집 항목(D-03)

### 기술 스택
- `CLAUDE.md` §Technology Stack — React Query, Zustand, zod, react-hook-form 등 프론트엔드 라이브러리
- `CLAUDE.md` §Redis Client Strategy — @upstash/redis(좌석 잠금) vs ioredis(WebSocket pub/sub) 구분

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/api-client.ts` — API 클라이언트 (인터셉터, 401 리프레시). 결제/예매 API 호출에 재사용
- `apps/web/hooks/use-performances.ts`, `use-admin.ts` — React Query 훅 패턴 참조하여 use-booking.ts, use-reservations.ts 생성
- `apps/web/stores/use-auth-store.ts` — Zustand 스토어 패턴 참조. 예매 플로우 상태 관리에 활용
- `apps/web/components/ui/` — shadcn 컴포넌트 (button, card, tabs, dialog, skeleton, sonner, sheet 등)
- `apps/web/app/mypage/page.tsx` — 현재 프로필만 표시. 예매 내역 탭/섹션 추가 필요
- `apps/api/src/database/schema/price-tiers.ts` — 등급별 가격 스키마. 결제 금액 계산에 참조
- `packages/shared/src/types/performance.types.ts` — PriceTier, Showtime 등 공유 타입

### Established Patterns
- 상태관리: React Query (서버 상태) + Zustand (클라이언트 상태) + URL searchParams
- 유효성 검증: zod (프론트/백 공유)
- UI: shadcn/ui New York style + Tailwind v4 @theme 디자인 토큰
- API: NestJS 모듈 패턴 (auth, admin, performance, search + Phase 3의 booking, seat 모듈)
- DB: Drizzle ORM schema (apps/api/src/database/schema/)
- Admin: 테이블 + 상단 필터 + 검색 패턴 (Phase 2)

### Integration Points
- Phase 3 "다음" 버튼 → `/booking/[performanceId]/confirm` 주문서 페이지로 라우팅
- Phase 3 좌석 점유 데이터(Redis) → 주문서에서 선택 좌석 정보 표시 + TTL 타이머 계속
- Phase 3 WebSocket → 결제 완료 시 좌석 상태 확정 브로드캐스트
- price_tiers 테이블 → 결제 금액 계산 소스
- 마이페이지 (`/mypage`) → 예매 내역 탭/섹션 추가
- Admin 패널 → 예매 관리 메뉴 추가
- NestJS modules → reservation, payment 모듈 추가 필요

</code_context>

<specifics>
## Specific Ideas

- NOL 티켓의 주문서 페이지 참조 (공연정보 요약 + 예매자 정보 + 좌석/금액 + 약관 + 결제수단)
- Toss Payments 위젯은 인라인으로 주문서 하단에 배치하여 페이지 이탈 없는 결제 경험
- 결제 완료 화면은 예매번호를 크게 강조하고 취소마감 시간을 명시
- 마이페이지 예매 카드는 NOL 티켓의 예매 내역 카드 참조 (포스터 + 핵심 정보 + 상태 배지)
- Admin 예매 관리는 대시보드 통계 + 테이블 결합으로 한눈에 파악 가능하도록

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-booking-payment*
*Context gathered: 2026-04-02*
