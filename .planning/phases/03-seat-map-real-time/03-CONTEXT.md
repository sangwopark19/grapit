# Phase 3: Seat Map + Real-Time - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 공연 상세에서 예매를 시작하면 별도 예매 페이지로 이동하여, 캘린더에서 날짜/회차를 선택하고, 인터랙티브 SVG 좌석맵에서 좌석을 골라, 다른 사용자의 선택이 실시간으로 반영되는 예매 진입 플로우를 완성한다. 결제(Phase 4)로 이어지는 "다음" 버튼까지가 범위.

</domain>

<decisions>
## Implementation Decisions

### 예매 플로우 화면 구성
- **D-01:** "예매하기" 클릭 시 `/booking/[performanceId]` 별도 페이지로 이동 (NOL 티켓 방식). 독립된 URL로 돌아가기/공유 가능
- **D-02:** 한 화면에 날짜 선택(react-day-picker 캘린더) + 회차 선택 + SVG 좌석맵을 통합 배치. 상단에 날짜/회차, 아래에 좌석맵
- **D-03:** 좌석 선택 최대 4석 제한 (NOL 티켓/인터파크 기준)

### 좌석맵 + 선택 패널 레이아웃
- **D-04:** 데스크톱: 좌석맵 좌측(넓은 영역) + 사이드 패널 우측(공연명, 날짜/회차, 선택 좌석 목록, 합계, 다음 버튼)
- **D-05:** 모바일: 좌석맵 전체 폭 + 하단 바텀시트(드래그로 높이 조절). 좌석 선택 시 바텀시트가 올라옴
- **D-06:** 좌석맵 바로 상단에 등급별 색상 범례(legend) 표시 — 등급명 + 색상 칩 + 가격

### 좌석 등급 색상 체계
- **D-07:** 기본 팔레트 제공: VIP=#6C3CE0(퍼플), R=#3B82F6(블루), S=#22C55E(그린), A=#F59E0B(앰버). Admin TierEditor에서 변경 가능. 새 등급 생성 시 순서대로 자동 할당
- **D-08:** 판매/점유된 좌석은 회색(#D1D5DB)으로 표시. X 마크 없이 회색만
- **D-09:** 내가 선택한 좌석은 등급 색상 유지 + 두꺼운 테두리(stroke) + 체크마크로 강조. 다른 사용자 점유 좌석과 명확히 구분

### 임시 점유 & 실시간 UX
- **D-10:** 예매 페이지 상단에 고정 카운트다운 타이머 "남은시간 MM:SS" 상시 표시. 3분 이하 시 빨간색으로 경고
- **D-11:** 타이머 만료 시 모달 안내("시간이 만료되었습니다") + "처음으로" 버튼으로 좌석 선택 화면 초기화. 연장 기능 없음
- **D-12:** 다른 사용자의 좌석 선택/해제 시 즉시 색상 전환 (애니메이션/페이드 없이 즉각 반영)
- **D-13:** 내가 선택하려던 좌석을 다른 사용자가 먼저 점유한 경우 토스트 메시지로 안내 ("이미 다른 사용자가 선택한 좌석입니다")

### Claude's Discretion
- react-zoom-pan-pinch 컴포넌트 구성 및 줌 레벨/제한 설정
- WebSocket 네임스페이스/룸 설계 (per-showtime room 등)
- Redis 키 구조 (seat lock key format, TTL 관리)
- 좌석맵 SVG 렌더링 최적화 전략 (1000+ seats 모바일 성능)
- 타이머 시작 시점 (첫 좌석 선택 시 vs 페이지 진입 시)
- 바텀시트 구현 방식 (라이브러리 vs 직접 구현)
- "다음" 버튼 클릭 후 Phase 4 연결 지점 (결제 전 확인 화면 등)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 아키텍처 & API
- `docs/03-ARCHITECTURE.md` — 시스템 아키텍처, WebSocket 설계, Redis 좌석 점유 시퀀스, API 엔드포인트. 특히 §3.5 좌석 점유 플로우, §4 WebSocket 게이트웨이
- `docs/03-ARCHITECTURE.md` §ERD — 좌석 관련 테이블 관계 (seat_maps, showtimes, performances)

### 기존 DB 스키마 & 타입
- `apps/api/src/database/schema/seat-maps.ts` — seat_maps 테이블 (svgUrl, seatConfig JSONB, totalSeats)
- `apps/api/src/database/schema/showtimes.ts` — showtimes 테이블 (performanceId, dateTime)
- `packages/shared/src/types/performance.types.ts` — SeatMapConfig, SeatMap, Showtime, PriceTier 타입 정의

### 기존 Admin 컴포넌트 (참조용)
- `apps/web/components/admin/svg-preview.tsx` — SVG 업로드/미리보기, data-seat-id 카운팅 로직. 예매 좌석맵 렌더링 시 참조
- `apps/web/components/admin/tier-editor.tsx` — 등급별 좌석 설정 UI. seatConfig 구조 참조

### UI/UX & PRD
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트 패턴. Primary/Secondary 컬러는 Phase 1 D-14~D-16 Grapit 고유 컬러 사용
- `docs/02-PRD.md` — 예매 플로우 요구사항, 좌석 선택 UX 참조
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 예매 플로우 분석, 좌석맵 화면 구성 참조

### 기술 스택 참조
- `CLAUDE.md` §Technology Stack — react-zoom-pan-pinch, react-day-picker, Socket.IO, @socket.io/redis-adapter, @upstash/redis, ioredis 버전 및 사용 패턴
- `CLAUDE.md` §Redis Client Strategy — @upstash/redis(HTTP, 좌석 잠금용) vs ioredis(TCP, Socket.IO pub/sub 전용) 구분

### 이전 Phase 컨텍스트
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 브랜드 컬러(D-14~D-16), 폰트(D-17), 앱 쉘 구조
- `.planning/phases/02-catalog-admin/02-CONTEXT.md` — 상세 페이지 레이아웃(D-09~D-12), Admin SVG 좌석맵(D-15)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/admin/svg-preview.tsx` — SVG 로드/렌더링, data-seat-id 파싱 로직 참조 가능
- `apps/web/components/admin/tier-editor.tsx` — 등급 색상/좌석ID 매핑 구조 참조
- `apps/web/components/ui/` — shadcn 컴포넌트 (button, card, tabs, dialog, skeleton, sonner, sheet 등)
- `apps/web/lib/api-client.ts` — API 클라이언트 (인터셉터, 401 리프레시). 예매 API 호출에 재사용
- `apps/web/hooks/` — use-performances.ts, use-admin.ts 패턴 참조하여 use-booking.ts 생성
- `packages/shared/src/types/performance.types.ts` — SeatMapConfig, Showtime, PriceTier 타입 공유

### Established Patterns
- 상태관리: React Query (서버 상태) + Zustand (클라이언트 상태: 선택 좌석, 타이머) + URL searchParams
- 유효성 검증: zod (프론트/백 공유)
- UI: shadcn/ui New York style + Tailwind v4 @theme 디자인 토큰
- API: NestJS 모듈 패턴 (auth, admin, performance, search 모듈 참조)
- DB: Drizzle ORM schema (apps/api/src/database/schema/)

### Integration Points
- 상세 페이지 예매 CTA (`/performance/[id]`) → Phase 3에서 활성화, `/booking/[performanceId]`로 라우팅
- seat_maps 테이블 seatConfig → 좌석맵 렌더링 시 등급별 색상/좌석ID 매핑에 사용
- showtimes 테이블 → 날짜/회차 선택 데이터 소스
- NestJS modules → booking, seat 모듈 추가 필요
- WebSocket 게이트웨이 → @nestjs/websockets + Socket.IO 신규 설정 필요
- Redis → @upstash/redis (좌석 잠금), ioredis (Socket.IO pub/sub) 신규 연동

</code_context>

<specifics>
## Specific Ideas

- NOL 티켓 예매 화면의 좌석 선택 플로우 참조 (날짜→회차→좌석맵 한 화면)
- 데스크톱 좌석맵 좌 + 사이드 패널 우 배치는 인터파크/예스24 좌석 선택과 유사
- 모바일 바텀시트는 좌석 선택 시 따라올라오는 방식 (네이버 지도 바텀시트 참조)
- 등급 색상 기본 팔레트는 NOL 티켓의 등급별 컬러 체계를 참고하되 Grapit 브랜드 컬러(#6C3CE0)를 VIP에 적용

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-seat-map-real-time*
*Context gathered: 2026-04-01*
