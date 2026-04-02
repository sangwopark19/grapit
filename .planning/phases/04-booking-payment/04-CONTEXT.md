# Phase 4: Booking + Payment - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

좌석 선택 완료 후 결제까지의 전체 플로우를 완성한다. `/booking/[performanceId]/checkout` 주문확인 페이지에서 Toss Payments 리다이렉트 결제를 처리하고, 결제 성공/실패 후 안내 페이지를 제공한다. 마이페이지에 예매 내역 탭을 추가하여 예매 조회/취소/환불을 지원하고, Admin에서 예매 목록 조회 및 환불 처리를 제공한다.

</domain>

<decisions>
## Implementation Decisions

### 결제 진입 화면
- **D-01:** "다음" 버튼 클릭 시 `/booking/[performanceId]/checkout` 별도 URL로 이동. 좌석선택→주문확인→결제 단계 분리 (NOL 티켓 방식)
- **D-02:** 주문확인 페이지 구성: 공연명/날짜/회차 + 좌석리스트(등급/열/번호/가격) + 총 결제금액 + 예매자정보(이름/연락처) + 취소/환불 규정 안내 + 약관동의 + 결제버튼
- **D-03:** "구매조건 확인 및 결제 동의" 체크박스 1개 필수 (전자상거래법 준수)
- **D-04:** Toss Payments 리다이렉트 방식으로 결제창 호출. 모바일에서 안정적
- **D-05:** checkout 페이지에도 BookingHeader의 카운트다운 타이머 유지. 기존 10분 TTL 그대로, 만료 시 좌석 해제 + 좌석선택으로 돌려보냄

### 결제 완료 & 확인
- **D-06:** 결제 성공 시 `/booking/complete?orderId=xxx` 전용 페이지. 체크마크 아이콘 + "예매 완료!" + 예매번호/공연/날짜/좌석/결제금액 요약 + "예매 내역 보기" / "홈으로" CTA
- **D-07:** 결제 실패/취소 시 `/booking/fail?code=xxx` 전용 페이지. X 아이콘 + 에러 메시지 + "선택한 좌석이 해제되었습니다" 안내 + "다시 예매하기" / "홈으로" CTA
- **D-08:** 결제 실패/취소 시 서버에서 해당 좌석 Redis 점유 즉시 해제

### 마이페이지 예매 관리
- **D-09:** 마이페이지 탭 분리: [예매내역](기본 탭) / [프로필]. 기존 ProfileForm은 프로필 탭으로 이동
- **D-10:** 예매내역 탭: 상태 필터(예매완료/취소·환불) + 카드형 목록(포스터 썸네일 + 공연명 + 날짜 + 좌석 + 금액 + 상태 배지). 클릭 시 상세 페이지 이동
- **D-11:** 예매 상세: `/mypage/bookings/[bookingId]` 별도 페이지. 예매번호, 상태, 공연정보(공연명/날짜/장소/좌석), 결제정보(결제수단/금액), 취소마감시간, 취소 버튼

### 취소/환불 정책
- **D-12:** 취소 마감: 공연 전날 18:00까지 취소 가능. 마감 후 취소 버튼 비활성화 + "취소 마감 시간이 지났습니다" 안내
- **D-13:** 전액 환불만 지원. 부분 취소(일부 좌석만) 없음. 예매 전체 취소 + 전액 환불
- **D-14:** 취소 확인 모달: "정말 취소하시겠습니까?" + 환불 금액/예상 환불일 표시. 실수 방지
- **D-15:** 환불은 Toss Payments 취소 API 호출. 원래 결제 수단으로 자동 환불

### Admin 환불 처리
- **D-16:** Admin 예매 관리 페이지: 예매 목록 테이블(예매번호, 사용자명, 공연명, 상태, 결제금액) + 상태 필터(전체/예매완료/취소) + 행별 환불 버튼. ADMN-04 충족

### Claude's Discretion
- 예매번호 생성 형식 (GRP-YYYYMMDD-NNN 등)
- Toss Payments webhook 처리 상세 (결제 확인, 가상계좌 입금 등)
- 결제 관련 DB 테이블 설계 (reservations, payments 등)
- 주문확인 페이지에서 예매자정보 표시 방식 (로그인 사용자 정보 자동 입력 vs 별도 입력)
- 결제 버튼 금액 포맷팅 (숫자 콤마 등)
- Admin 예매 목록 페이지네이션/검색 방식

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 아키텍처 & API
- `docs/03-ARCHITECTURE.md` — 시스템 아키텍처, API 엔드포인트 설계, DB 스키마. 특히 결제 시퀀스, 예매 상태 머신
- `docs/03-ARCHITECTURE.md` §ERD — 예매/결제 관련 테이블 관계

### 기존 예매 모듈 (Phase 3)
- `apps/api/src/modules/booking/booking.service.ts` — Redis 좌석 잠금 로직 (lockSeat, unlockSeat, getSeatStatus). 결제 성공 시 좌석 확정, 실패 시 해제 로직 추가 필요
- `apps/api/src/modules/booking/booking.controller.ts` — 기존 booking API (seats/lock, seats/lock/:id 등). 결제 관련 엔드포인트 추가 필요
- `apps/api/src/modules/booking/booking.gateway.ts` — WebSocket 게이트웨이. 결제 완료 시 좌석 상태 broadcast 필요
- `apps/api/src/database/schema/seat-inventories.ts` — seat_inventories 테이블. 결제 확정 시 sold 상태 업데이트

### 기존 프론트엔드 예매 컴포넌트
- `apps/web/components/booking/booking-page.tsx` — 좌석 선택 페이지. useBookingStore 상태 관리. "다음" 버튼에서 checkout으로 이동 연결 필요
- `apps/web/stores/use-booking-store.ts` — Zustand 예매 스토어 (selectedSeats, selectedShowtimeId, timerExpiresAt). checkout 페이지에서도 사용
- `apps/web/hooks/use-booking.ts` — 예매 관련 React Query 훅 (useSeatStatus, useLockSeat 등)

### 기존 마이페이지
- `apps/web/app/mypage/page.tsx` — 현재 ProfileForm만 있음. 탭 구조로 리팩토링 + 예매내역 탭 추가 필요

### UI/UX & PRD
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트 패턴. Primary/Secondary 컬러는 Phase 1 D-14~D-16 Grapit 고유 컬러 사용
- `docs/02-PRD.md` — 결제/예매 관련 기능 요구사항, 사용자 플로우
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 예매/결제 플로우 분석

### 기술 스택 참조
- `CLAUDE.md` §Technology Stack — @tosspayments/tosspayments-sdk 2.5.x, pg-boss (결제 후처리 job), zod (DTO 검증)
- `CLAUDE.md` §Redis Client Strategy — @upstash/redis (좌석 잠금/해제)

### 이전 Phase 컨텍스트
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 브랜드 컬러(D-14~D-16), 마이페이지 기본 구조(D-12: 예매 내역은 Phase 4에서 추가)
- `.planning/phases/02-catalog-admin/02-CONTEXT.md` — Admin 패널 구조(D-13~D-16)
- `.planning/phases/03-seat-map-real-time/03-CONTEXT.md` — 예매 플로우(D-01~D-13), 좌석 점유/타이머/실시간 UX

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/booking/booking-page.tsx` — 좌석 선택 완료 후 "다음" 버튼 → checkout 라우팅 연결점
- `apps/web/components/booking/booking-header.tsx` — BookingHeader + CountdownTimer → checkout 페이지에서 재사용
- `apps/web/stores/use-booking-store.ts` — selectedSeats, timerExpiresAt 등 → checkout 페이지에서 그대로 사용
- `apps/web/components/ui/` — shadcn 컴포넌트 (button, card, tabs, dialog, skeleton, sonner, checkbox 등)
- `apps/web/lib/api-client.ts` — API 클라이언트 (인터셉터, 401 리프레시). 결제/예매 API 호출에 재사용
- `apps/web/hooks/use-booking.ts` — 기존 예매 React Query 훅. 예매 관리 훅 추가 필요
- `apps/api/src/modules/booking/` — booking 모듈 (service, controller, gateway, providers). 결제/예매 관리 로직 확장
- `apps/api/src/database/schema/` — 기존 스키마. reservations, payments 테이블 추가 필요

### Established Patterns
- 상태관리: React Query (서버 상태) + Zustand (클라이언트 상태) + URL searchParams
- 유효성 검증: zod (프론트/백 공유)
- UI: shadcn/ui New York style + Tailwind v4 @theme 디자인 토큰
- API: NestJS 모듈 패턴 (auth, admin, booking, performance 모듈)
- DB: Drizzle ORM schema (apps/api/src/database/schema/)

### Integration Points
- booking-page.tsx "다음" 버튼 → `/booking/[performanceId]/checkout` 라우팅
- Toss Payments 리다이렉트 콜백 → `/booking/complete` 또는 `/booking/fail`
- 결제 성공 → Redis 좌석 잠금 해제 + seat_inventories sold 상태 + reservations 레코드 생성
- 결제 실패 → Redis 좌석 잠금 해제 + WebSocket broadcast
- 마이페이지 탭 → 기존 ProfileForm을 프로필 탭으로, 예매내역을 기본 탭으로
- Admin → 기존 admin 모듈에 예매 관리 페이지/API 추가

</code_context>

<specifics>
## Specific Ideas

- NOL 티켓의 주문확인 페이지 참조 (좌석리스트 + 총액 + 약관동의 + 결제버튼)
- Toss Payments 리다이렉트 결제: requestPayment() → successUrl/failUrl 콜백 패턴
- 결제 완료 페이지는 체크마크 아이콘으로 성공 감정 전달 (NOL 티켓/인터파크 참조)
- 마이페이지 예매 카드는 Phase 2 공연 카드(D-05) 스타일 참조하되 예매 정보에 맞게 변형
- Admin 예매 목록은 Phase 2 Admin 공연 목록(D-16) 테이블 패턴 재활용

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-booking-payment*
*Context gathered: 2026-04-02*
