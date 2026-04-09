# Phase 04 — UI Review

**Audited:** 2026-04-07
**Baseline:** 04-UI-SPEC.md (approved 2026-04-02, shadcn New York preset)
**Screenshots:** 캡처 불가 (Playwright 브라우저 미설치). 코드 기반 감사로 진행.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 핵심 한국어 copy 완전 구현, `FAILED` 상태를 "환불완료"로 표기하는 의미 오류 발생 |
| 2. Visuals | 3/4 | 계층 구조 명확, 예매자 정보 표시 모드에서 레이블 누락 |
| 3. Color | 4/4 | accent 7곳 사용(스펙 7곳 지정), 시맨틱 색상 정확, 상태 배지 hex 스펙 일치 |
| 4. Typography | 2/4 | font-medium(500)이 16곳 사용 — 스펙은 400/600만 허용. 예매번호 text-2xl(24px) vs 스펙 text-display(28px) |
| 5. Spacing | 3/4 | 스펙 토큰 잘 준수, 마이페이지 max-w-[600px] vs 스펙 720px 불일치 |
| 6. Experience Design | 4/4 | 로딩/오류/빈 상태 모두 구현, 비파괴 액션 확인 모달, 취소 마감 강제, 리프레시 복구 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **font-medium(500) 16곳 사용** — UI-SPEC은 weight 400(regular)과 600(semibold)만 허용. font-medium은 허가되지 않은 세 번째 weight로 타이포그래피 일관성을 깨뜨림 — `reservation-detail.tsx`, `admin-booking-table.tsx`의 `font-medium`을 `font-semibold` 또는 `font-normal`로 교체하고, `InfoRow` 컴포넌트를 공통 인터페이스로 통일할 것.

2. **예매자 정보 표시 모드에 레이블 없음** — 비편집 모드에서 이름과 연락처 값만 `<p>` 태그로 표시됨. 스펙은 "이름 | 홍길동", "연락처 | 010-..." 행 구조를 요구 — `BookerInfoSection`의 표시 모드를 `<span className="text-sm text-gray-500">이름</span>` 레이블 + 값 패턴으로 변경.

3. **`FAILED` 상태를 "환불완료"로 표기** — `admin-booking-dashboard.tsx`의 STATUS_OPTIONS에서 `FAILED`를 `label: '환불완료'`로 매핑함. `FAILED`는 결제 실패 상태이며 환불과 의미가 다름. 또한 공유 타입에 `REFUNDED` 상태가 없어 스펙의 환불완료 상태를 표현할 수 없음 — 백엔드 타입에 `REFUNDED` 상태 추가 후 STATUS_CONFIG에 회색(#F5F5F7/#6B6B7B) 배지 매핑 추가.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**계약 이행 항목 (pass)**

| 스펙 Copy | 구현 파일 | 결과 |
|-----------|-----------|------|
| 결제하기 (페이지 제목) | `confirm-header.tsx:53` | 일치 |
| 남은시간 (타이머 레이블) | `confirm-header.tsx:62` | 일치 |
| 공연 정보, 선택 좌석, 예매자 정보, 약관 동의, 결제 수단 | `order-summary.tsx`, `booker-info-section.tsx`, `terms-agreement.tsx`, `confirm/page.tsx:176` | 모두 일치 |
| 전체 동의, 예매/취소 규정에 동의합니다 (필수), 개인정보 제3자 제공에 동의합니다 (필수), 보기 | `terms-agreement.tsx:51,63,87,76` | 일치 |
| 결제 처리 중..., 약관에 동의해주세요, 결제하기 | `confirm/page.tsx:143-147` | 일치 |
| 예매가 완료되었습니다, 예매번호, 예매내역 보기, 홈으로 | `booking-complete.tsx:39,46,132,139` | 일치 |
| 예매를 취소하시겠습니까?, 취소 후에는 복구할 수 없습니다., 단순 변심/일정 변경/다른 좌석으로 재예매/기타 | `cancel-confirm-modal.tsx:69,72,24-28` | 일치 |
| 예매 관리, 총 예매수, 총 매출액, 취소율 | `admin-booking-dashboard.tsx:74,79,85,91` | 일치 |
| 예매번호 또는 예매자명 검색 | `admin-booking-dashboard.tsx:103` | 일치 |
| 예매 내역이 없습니다, 원하는 공연을 찾아 예매해보세요, 공연 둘러보기 | `reservation-list.tsx:90-97` | 일치 |
| 예매 정보를 불러오지 못했습니다., 다시 시도 | `mypage/reservations/[id]/page.tsx:52-55` | 일치 |
| 결제에 실패했습니다. 다시 시도해주세요., 결제가 취소되었습니다. | `confirm/page.tsx:74,78` | 일치 |
| 좌석 점유 시간이 만료되어 좌석 선택 화면으로 이동합니다. | `confirm/page.tsx:95` | 일치 |

**미구현 / 불일치 항목 (fail)**

- **`FAILED` → "환불완료" 오표기** (`admin-booking-dashboard.tsx:23`): STATUS_OPTIONS에서 `FAILED` 값을 가진 항목에 `label: '환불완료'`를 부여. 결제 실패(FAILED)와 환불 완료(REFUNDED)는 다른 개념. 스펙의 `환불완료 (REFUNDED)` 상태가 공유 타입에 없어 발생한 문제.
- **Admin 빈 상태 body 문구** (`admin-booking-table.tsx:113`): "아직 예매가 접수되지 않았습니다" 구현됨. 스펙 일치.
- **admin 필터 "환불완료" 필터 값**: 스펙에서 `Filter: refunded | 환불완료`를 정의했으나 구현은 `FAILED`로 대체됨.

---

### Pillar 2: Visuals (3/4)

**잘 구현된 사항**

- ConfirmHeader: sticky top bar, h-14, white bg, border-b, shadow-sm — 스펙 레이아웃과 일치 (`confirm-header.tsx:43`)
- OrderSummary: 포스터 80x112px 썸네일 + 제목 + 날짜 + 장소 배치 — 스펙 일치 (`order-summary.tsx:32`)
- ReservationCard: poster 60x84px left + info right + status badge top-right — 스펙 일치 (`reservation-card.tsx:82`)
- AdminStatCard: h-[100px] fixed height + icon + label + value — 스펙 일치 (`admin-stat-card.tsx:28`)
- CTA 버튼 h-12(48px) 일관 적용 (confirm page, complete page, reservation detail)
- 취소 버튼 disabled 시 Tooltip으로 "취소 마감시간이 지났습니다" 표시 (`reservation-detail.tsx:244-246`)
- 성공 아이콘 CheckCircle2 h-16 w-16 — 시각적 강조점 명확 (`booking-complete.tsx:37`)

**미구현 / 개선 필요**

- **예매자 정보 표시 모드에 레이블 없음**: 비편집 상태에서 `<p>{displayName}</p>` `<p>{displayPhone}</p>`만 렌더링. 스펙 레이아웃은 "이름 | 홍길동", "연락처 | 010-..." 형식으로 레이블과 값을 구분. 접근성과 스캔 용이성이 떨어짐 (`booker-info-section.tsx:110-113`).
- **complete page py-12 vs 스펙 py-12**: 스펙은 `px-6 py-12` — 구현 일치. 정상.
- max-w 설정 이슈는 Spacing 섹션에서 별도 기술.

---

### Pillar 3: Color (4/4)

**Accent (#6C3CE0) 사용처 검증**

| 스펙 지정 사용처 | 구현 위치 | 결과 |
|-----------------|-----------|------|
| "결제하기" CTA 버튼 | `Button` 기본 variant → CSS --color-primary 적용 | 일치 |
| 예매내역 보기 버튼 (complete page) | `Button` 기본 variant | 일치 |
| 카운트다운 타이머 배경 (normal) | `confirm-header.tsx:57: 'bg-[#6C3CE0]'` | 일치 |
| 예매번호 텍스트 강조 (complete page) | `booking-complete.tsx:48: 'text-[#6C3CE0]'` | 일치 |
| 총 결제금액 텍스트 (confirm page) | `order-summary.tsx:76: 'text-[#6C3CE0]'` | 일치 |
| 마이페이지 active tab indicator | shadcn Tabs 기본 primary 색상 | 일치 |
| Admin active filter chip | `status-filter.tsx:28: 'bg-primary text-white'` | 일치 |

색상 토큰 일관성 우수. 하드코딩 hex는 모두 스펙에서 명시적으로 지정한 시맨틱 색상들 (상태 배지, 타이머 경고)이며 CSS 변수로 대체할 수 없는 Tailwind JIT 패턴으로 사용. 허가되지 않은 accent 오용 없음.

**상태 배지 색상** (`reservation-card.tsx:14-27`, `admin-booking-table.tsx:19-34`):
- CONFIRMED: bg-[#F0FDF4] text-[#15803D] — 스펙 일치
- CANCELLED: bg-[#FEF2F2] text-[#C62828] — 스펙 일치
- PENDING_PAYMENT: bg-[#FFFBEB] text-[#8B6306] — 스펙 일치
- FAILED: bg-[#FEF2F2] text-[#C62828] — CANCELLED와 동일 색상 적용 (REFUNDED 미구현으로 인한 대체)

---

### Pillar 4: Typography (2/4)

**폰트 사이즈 분포** (Phase 4 신규 파일 기준)

| 클래스 | 값 | 용도 | 스펙 |
|--------|-----|------|------|
| text-xs | 12px | 타이머 레이블 "남은시간", 수정 버튼 | Caption-이하 (스펙 미정의) |
| text-sm | 14px | 폼 레이블, 정보 텍스트, 좌석 요약, 메타 정보 | Caption (14px) — 일치 |
| text-base | 16px | 섹션 제목, CTA 버튼 텍스트, 카드 제목 | Body (16px) — 일치 |
| text-xl | 20px | 페이지 제목, Admin stat card 값 | Heading (20px) — 일치 |
| text-2xl | 24px | 예매번호 강조 (`booking-complete.tsx:48`) | 스펙: text-display(28px) — **불일치** |
| text-lg | 18px | `seat-selection-sheet.tsx:130` (Phase 3 파일) | 스펙 미허용 |

**폰트 웨이트 위반**

스펙은 weight 400(regular)과 600(semibold)만 허용.

- `font-medium`(500): **16곳** 사용 — 스펙 위반
  - `booking-complete.tsx:64` — 공연명 font-medium
  - `reservation-detail.tsx:67,148,187` — InfoRow value font-medium
  - `cancel-confirm-modal.tsx:81` — 레이블 font-medium
  - `admin-booking-table.tsx:71-89` (7개 TableHead) — 헤더 font-medium
  - `admin-booking-table.tsx:139,152` — 예매번호, 금액 font-medium
  - `admin-booking-detail-modal.tsx:55,189` — InfoRow value, 레이블 font-medium
- `font-normal`(400): 6곳 사용 — Phase 3 파일들에서 주로 사용, Phase 4 신규 파일에서는 불필요한 명시.

**예매번호 사이즈 불일치**

- 스펙: 28px (text-display), weight 600, monospace
- 구현: `text-2xl`(24px), weight 600, monospace font-family 적용
- 4px 차이. style={{ fontFamily }} 방식 대신 CSS 변수 `text-display` 토큰 미사용.

---

### Pillar 5: Spacing (3/4)

**스펙 준수 항목**

- confirm page max-w-[720px] — 스펙 일치 (`confirm/page.tsx:153`)
- reservation detail max-w-[720px] — 스펙 일치 (`reservations/[id]/page.tsx:33`)
- confirm page px-4 md:px-6, py-6 md:py-8 — 스펙 일치
- complete page px-6 py-12 — 스펙 일치 (`complete/page.tsx:138`)
- Admin stat card h-[100px] — 스펙 일치 (`admin-stat-card.tsx:28`)
- 포스터 80x112, 60x84 — 스펙 일치 (arbitrary px 허가 영역)
- CTA h-12(48px) — 스펙 "CTA button height: 48px" 일치

**불일치 항목**

- **마이페이지 max-w-[600px]** (`mypage/page.tsx:34`): 스펙은 예매 내역 페이지에 max-w-[720px] 일관성을 요구하나, 마이페이지 전체 컨테이너가 max-w-[600px]. 예매 내역 탭을 포함하므로 600px 제약이 예매 카드 목록에도 적용됨.
- **space-y-6 vs space-y-2xl**: confirm page 섹션 간격이 `space-y-6`(24px=lg)으로 구현됨. 스펙은 "Section gaps: lg(24px)" — 일치하나 스펙 토큰 이름(lg) 대신 Tailwind scale 숫자(6) 사용. 기능적으로는 동일.
- arbitrary px 사용: 스펙에서 명시적으로 허가된 고정 크기들(포스터, 카드 높이)에만 사용되고 있어 허용 범위 내.

---

### Pillar 6: Experience Design (4/4)

**로딩 상태**

- ReservationList: Skeleton 3개 (poster + info 패턴) — `reservation-list.tsx:53-69`
- 예매 상세 페이지: Skeleton card × 4 — `reservations/[id]/page.tsx:34-46`
- complete page: CompleteSkeleton (pulse animation) — `complete/page.tsx:13-26`
- Admin booking table: Skeleton rows × 5 — `admin-booking-table.tsx:95-106`
- TossPaymentWidget: Loader2 spinner during SDK init — `toss-payment-widget.tsx:129`
- Admin booking detail modal: Skeleton rows — `admin-booking-detail-modal.tsx:106-112`

**오류 상태**

- 결제 실패/취소: toast.error 3종 (PAY_PROCESS_CANCELED, message, generic) — `confirm/page.tsx:74-79`
- 타이머 만료: toast.error + router.replace 리다이렉트 — `confirm/page.tsx:95`
- TossPaymentWidget SDK 오류: 인라인 에러 UI (bg-red-50 박스) — `toss-payment-widget.tsx:118-124`
- NEXT_PUBLIC_TOSS_CLIENT_KEY 미설정: 그레이스풀 에러 메시지 — `toss-payment-widget.tsx:66-70`
- 예매 상세 로드 실패: isError 분기 + "다시 시도" 버튼 — `reservations/[id]/page.tsx:49-58`
- 취소 실패: toast.error — `reservations/[id]/page.tsx:27`
- 환불 실패: toast.error "환불 처리에 실패했습니다. 잠시 후 다시 시도해주세요." — `admin-booking-dashboard.tsx:64`

**빈 상태**

- 예매 없음(마이페이지): 메시지 + CTA "공연 둘러보기" — `reservation-list.tsx:87-99`
- Admin 예매 없음: 메시지 + body — `admin-booking-table.tsx:108-119`
- 검색 결과 없음: 동일 빈 상태 UI 재사용 (검색어 필터링 결과 0건)

**인터랙션 패턴**

- 예매 취소 AlertDialog: non-dismissible (onEscapeKeyDown preventDefault) — D-09 충족 (`cancel-confirm-modal.tsx:66`)
- 취소 확인 버튼: reason 미선택 시 disabled — `cancel-confirm-modal.tsx:120`
- 환불 확인 버튼: reason 빈 값 시 disabled — `admin-booking-detail-modal.tsx:233`
- 취소 마감 지난 경우 버튼 disabled + Tooltip — `reservation-detail.tsx:229-250`
- confirm page 새로고침 복구: orderId로 reservation 조회 — `complete/page.tsx:43-60`
- 좌석 미선택 상태 확인 페이지 진입 차단: redirect — `confirm/page.tsx:60-64`
- keepPreviousData 적용으로 필터 변경 시 레이아웃 쉬프트 방지 — `use-reservations.ts`

---

## Registry Safety

shadcn 초기화됨 (New York style). UI-SPEC.md의 Component Inventory는 모두 shadcn 공식 레지스트리(`ui.shadcn.com`) 컴포넌트만 사용. 써드파티 레지스트리 없음.

Registry audit: 0개 써드파티 블록 — 플래그 없음.

---

## Files Audited

**Phase 4 신규 파일**
- `apps/web/app/booking/[performanceId]/confirm/page.tsx`
- `apps/web/app/booking/[performanceId]/complete/page.tsx`
- `apps/web/app/mypage/reservations/[id]/page.tsx`
- `apps/web/components/booking/confirm-header.tsx`
- `apps/web/components/booking/order-summary.tsx`
- `apps/web/components/booking/booker-info-section.tsx`
- `apps/web/components/booking/terms-agreement.tsx`
- `apps/web/components/booking/toss-payment-widget.tsx`
- `apps/web/components/booking/booking-complete.tsx`
- `apps/web/components/reservation/reservation-card.tsx`
- `apps/web/components/reservation/reservation-list.tsx`
- `apps/web/components/reservation/reservation-detail.tsx`
- `apps/web/components/reservation/cancel-confirm-modal.tsx`
- `apps/web/components/admin/admin-booking-dashboard.tsx`
- `apps/web/components/admin/admin-stat-card.tsx`
- `apps/web/components/admin/admin-booking-table.tsx`
- `apps/web/components/admin/admin-booking-detail-modal.tsx`
- `apps/web/components/admin/admin-sidebar.tsx`
- `apps/web/app/mypage/page.tsx`
- `apps/web/hooks/use-reservations.ts`
- `packages/shared/src/types/booking.types.ts`

**참조 파일**
- `apps/web/app/globals.css` — 디자인 토큰 확인
- `apps/web/components.json` — shadcn 설정 확인
- `.planning/phases/04-booking-payment/04-UI-SPEC.md`
- `.planning/phases/04-booking-payment/04-CONTEXT.md`
