---
phase: 05-polish-launch
audit_date: 2026-04-08
baseline: 05-UI-SPEC.md (approved contract)
screenshots: not captured (Playwright browsers not installed)
---

# Phase 05 — UI Review

**Audited:** 2026-04-08
**Baseline:** 05-UI-SPEC.md design contract
**Screenshots:** Not captured — Playwright browsers not installed on this machine. Audit is code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 500 에러 메시지 STATUS_MESSAGES에 누락, 나머지 한국어 카피 계약과 일치 |
| 2. Visuals | 3/4 | 스켈레톤 11종 완성, `pb-safe` 유틸리티 미정의로 iOS 탭바 안전 영역 미적용 |
| 3. Color | 3/4 | 하드코딩 색상이 스펙 팔레트 내 값이나 Tailwind 토큰 미사용, booking-complete.tsx에 text-[#6C3CE0] 직접 사용 |
| 4. Typography | 3/4 | font-medium이 스펙 외 weight로 29곳에 사용, 선언 weight는 400/600(normal/semibold) 2종 뿐 |
| 5. Spacing | 3/4 | 스펙 외 arbitrary 픽셀값 사용 많음, 대부분 레이아웃 고정치(허용 범주)이나 일부 불필요한 arbitrary 존재 |
| 6. Experience Design | 4/4 | 로딩/에러/빈 상태 전 페이지 커버, 44px 터치 타겟 적용, 접근성 속성 완비 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **`pb-safe` 유틸리티 클래스 미정의** — iOS 노치 기기에서 MobileTabBar가 홈 인디케이터와 겹쳐 탭이 잘릴 수 있음 — `apps/web/app/globals.css`에 `.pb-safe { padding-bottom: env(safe-area-inset-bottom); }` 추가하거나 Tailwind v4 `@utility` 블록으로 정의

2. **`error-messages.ts`에 500 상태 코드 메시지 누락** — 서버 500 에러 발생 시 스펙이 요구하는 "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요." 대신 `DEFAULT_ERROR_MESSAGE`가 노출되어 메시지가 동일하지만 status-specific 매핑이 없어 추후 메시지 분기가 불가 — `apps/web/lib/error-messages.ts`의 `STATUS_MESSAGES`에 `500: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'` 추가

3. **`booking-complete.tsx`와 `order-summary.tsx`에 `text-[#6C3CE0]` 하드코딩** — 브랜드 컬러 변경 시 토큰 추적이 안 되고 디자인 시스템 일관성이 무너짐 — `text-[#6C3CE0]` → `text-primary`, `text-[#15803D]` → `text-success` 로 교체 (각각 `apps/web/components/booking/booking-complete.tsx:48,102`, `order-summary.tsx:76`)

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**계약 준수 항목:**
- MobileTabBar 4탭 라벨: 홈/카테고리/검색/마이페이지 — 스펙 D-03과 일치
- 네트워크 배너: "인터넷 연결을 확인해주세요" + "다시 시도" 버튼 — 스펙 D-11과 일치
- 404 페이지: "페이지를 찾을 수 없습니다" / "요청하신 페이지가 존재하지 않거나 이동되었습니다." / "홈으로 돌아가기" — 스펙 D-13과 완전 일치
- 글로벌 에러: "문제가 발생했습니다" / "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." / "다시 시도" — 스펙과 일치
- 에러 코드 포맷 `오류 코드: ERR-{status}` — `api-client.ts:120` 확인, 스펙 D-12와 일치
- 스켈레톤 aria-label: "콘텐츠를 불러오는 중입니다" — 11종 모두 확인

**미준수 항목:**
- `apps/web/lib/error-messages.ts`: `STATUS_MESSAGES`에 500 키 없음. 스펙은 "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요."를 별도 항목으로 선언했으나 현재는 `DEFAULT_ERROR_MESSAGE` 폴백에 의존. 기능적으로 동일한 텍스트가 노출되지만 명시적 매핑 없음.
- `apps/web/app/error.tsx:28`: 에러 코드가 `app/error.tsx`에는 존재하지만 `app/global-error.tsx`(Sentry 통합 버전)에는 에러 코드 표시 없음. 두 파일이 병존하는 구조에서 global-error.tsx는 ERR 코드를 미표시.

**Generic 라벨 검사:** "Submit", "Click Here", "OK", "Cancel", "Save" 등 영어 제네릭 라벨 없음. 모든 CTA가 한국어.

---

### Pillar 2: Visuals (3/4)

**완성된 항목:**
- 스켈레톤 11종 (`PerformanceCardSkeleton`, `BannerSkeleton`, `GenreGridSkeleton`, `SectionSkeleton`, `DetailHeaderSkeleton`, `DetailTabsSkeleton`, `SearchResultsSkeleton`, `ReservationListSkeleton`, `ReservationDetailSkeleton`, `SeatMapSkeleton`, `MyPageProfileSkeleton`) — 스펙 D-07/D-08 완전 충족
- 각 스켈레톤이 실제 컴포넌트 레이아웃을 반영 (aspect ratio, grid 구조 일치)
- 404 페이지: "( ._.) " 텍스트 이모지 48px 크기로 구현 (`text-[48px]`) — 스펙 일치
- MobileTabBar: 하단 고정, z-50, 전체폭, 4탭 균등 배치
- 공연 상세 모바일: 포스터 전체폭 + max-h-[400px] + 아래 정보 배치 — 스펙 D-05 일치
- NetworkBanner: 상단 고정 z-[60], 44px 높이 — 스펙 일치

**미준수/우려 항목:**
- `pb-safe` 클래스가 `globals.css`나 Tailwind 설정에 정의되지 않음. MobileTabBar(`mobile-tab-bar.tsx:39`)에 `pb-safe`를 사용하고 있으나 이 유틸리티는 Tailwind v4 기본 제공이 아님. iOS 사파리에서 홈 인디케이터가 탭 아이템과 겹칠 위험.
- `LayoutShell`에서 `pb-[56px]`를 content offset으로 적용하나 iOS 안전 영역(최대 34px)이 추가되지 않아 MobileTabBar와 콘텐츠가 실제로는 겹칠 수 있음. `pb-[56px] md:pb-0`이 아닌 `pb-[90px] md:pb-0` 또는 CSS 변수 활용 필요.
- 공연 상세 페이지(`performance/[id]/page.tsx:248`)의 모바일 하단 CTA 고정바(`z-40 h-16`)가 MobileTabBar(`z-50`)와 겹침 — MobileTabBar가 위에 렌더링되지만 h-16(64px) CTA 바가 탭바 위 공간을 침범.

---

### Pillar 3: Color (3/4)

**토큰 사용 현황:**
- `text-primary`, `bg-primary`, `border-primary`: 35개 파일에서 60회 — 액센트 남용 없음
- 토큰 사용 비율: 대부분의 컴포넌트가 Tailwind 토큰(`text-gray-900`, `bg-white`, `text-error`, `bg-error`) 사용

**하드코딩 색상 발견:**

| 파일 | 라인 | 값 | 판정 |
|------|------|----|------|
| `booking-complete.tsx` | 37 | `text-[#15803D]` | `text-success`로 교체 가능 |
| `booking-complete.tsx` | 48, 102 | `text-[#6C3CE0]` | `text-primary`로 교체 가능 |
| `order-summary.tsx` | 76 | `text-[#6C3CE0]` | `text-primary`로 교체 가능 |
| `booking-page.tsx` | 194 | `style={{ backgroundColor: '#F3EFFF', color: '#6C3CE0' }}` | `info-surface`/`info` 토큰 활용 또는 className으로 교체 |
| `confirm-header.tsx` | 57 | `'bg-[#C62828]'` | `bg-error`로 교체 가능 |
| `status-badge.tsx` | 9-12 | `#22C55E`, `#FFB41B`, `#A1A1AA`, `#6C3CE0` | 스펙 팔레트 내 값이나 semantic 토큰 미사용 |
| `seat-map-viewer.tsx` | 20-21 | `'#D1D5DB'`, `'#1A1A2E'` | JS 상수로 사용 (SVG 조작용) — 허용 범주 |

`social-login-button.tsx`의 카카오(`#FEE500`)/네이버(`#03C75A`)/구글 OAuth 브랜드 색상은 외부 브랜드 가이드라인에 따른 것으로 하드코딩이 정당함.

**60/30/10 비율:** 배경 흰색(60%) 유지, secondary(`#F5F5F7`) 서브 서피스(30%), primary(`#6C3CE0`) 포인트(10%) — 전반적으로 스펙 준수.

---

### Pillar 4: Typography (3/4)

**스펙 선언 weight:** 400(regular), 600(semibold) 2종만 허용

**위반 발견 — font-medium (weight 500):**
- `font-medium`이 14개 파일 29곳에서 사용됨
- 주요 발생 위치: `reservation-detail.tsx:67,148`, `admin-booking-detail-modal.tsx:55,189`, `admin-booking-table.tsx`(9곳), `signup-step3.tsx:155,230`, `step-indicator.tsx:32,50`
- 스펙은 weight 400과 600만 허용. `font-medium`(500)은 스펙 외 weight.

**스펙 선언 size 체계:**

| 스펙 토큰 | 값 | 사용 현황 |
|-----------|-----|----------|
| `text-caption` | 14px | network-banner.tsx, form.tsx 등 — 사용됨 |
| `text-base` | 16px | 전체 body 텍스트 — 사용됨 |
| `text-heading` | 20px | not-found.tsx, error.tsx, mypage — 사용됨 |
| `text-display` | 28px | genre-grid, hot-section, new-section — `text-[28px]`로 직접 값 입력 (토큰 미사용) |

**추가 발견 — text-xl(20px) 직접 사용:**
- `global-error.tsx:21`, `booking-complete.tsx:38`, `cancel-confirm-modal.tsx:69`, `seat-selection-panel.tsx:63` 등에서 `text-xl` 사용
- `text-xl`(20px)은 `text-heading`과 동일 값이나 토큰 대신 Tailwind 기본 클래스를 사용 — 일관성 문제

**`text-[28px]` 직접 입력:** hot-section.tsx:21, new-section.tsx:17, genre-grid.tsx:45, genre/[genre]/page.tsx:64, admin/performances/page.tsx:87 — `text-display` 토큰이 존재함에도 미사용

---

### Pillar 5: Spacing (3/4)

**스펙 spacing scale:** xs(4px)/sm(8px)/md(16px)/lg(24px)/xl(32px)/2xl(48px)/3xl(64px)

**주요 arbitrary 값 패턴:**

| 패턴 | 파일 | 판정 |
|------|------|------|
| `h-[56px]` | mobile-tab-bar.tsx | 탭바 높이 고정 — 스펙 명시 허용 |
| `h-[44px]` | network-banner.tsx | 배너 높이 고정 — 스펙 명시 허용 |
| `h-[84px] w-[60px]` | reservation-card.tsx | 포스터 썸네일 — 허용 범주 |
| `h-[120px]` | reservation-list-skeleton.tsx | 스켈레톤 카드 높이 — 스펙 명시 허용 |
| `h-[200px]` | reservation-detail-skeleton.tsx | 스켈레톤 블록 — 허용 범주 |
| `max-w-[1200px]`, `max-w-[1280px]` | 여러 페이지 | 레이아웃 제약 — 허용 범주 |
| `w-[240px]` | admin-sidebar.tsx | 사이드바 고정폭 — 허용 범주 |
| `w-[360px]` | seat-selection-panel.tsx | 패널 고정폭 — 허용 범주 |
| `pb-24` | booking-page.tsx:347,386 | 96px 패딩 — 스펙 외 값 |

**gutter 적용 확인:**
- 모바일 gutter `px-4` — page.tsx, genre/[genre]/page.tsx, search/page.tsx, mypage/page.tsx 모두 적용 확인
- 데스크톱 gutter `md:px-6` — 동일 파일들 확인

**불일치 발견:**
- `booking-page.tsx`의 `pb-24`(96px)가 스펙 spacing scale과 무관한 값. 모바일 bottom sheet 여백으로 추정되나 스펙에 명시 없음.
- `LayoutShell`의 `pb-[56px]`는 스펙 명시 값이나 iOS safe-area가 더해져야 함 (미반영).

---

### Pillar 6: Experience Design (4/4)

**로딩 상태 커버리지:**
- 45개 파일에서 loading/isLoading/skeleton 패턴 확인
- 홈(BannerSkeleton), 공연상세(DetailHeaderSkeleton + DetailTabsSkeleton), 검색(PerformanceGrid isLoading), 장르(PerformanceGrid isLoading), 마이페이지(ReservationList isLoading), 예매(Skeleton 인라인) — 전 페이지 커버

**에러 상태:**
- API 에러: 중앙화된 `api-client.ts` 에러 인터셉터로 sonner toast 5000ms 표시
- 네트워크 오프라인: NetworkBanner — navigator.onLine + 이벤트 리스너 패턴
- 401: redirect-only (toast 없음) — 스펙 의도대로 구현
- 글로벌: `app/global-error.tsx` (Sentry 통합), `app/error.tsx` (에러 코드 포함)
- 404: `app/not-found.tsx` 커스텀 페이지

**빈 상태:**
- 배너 없음: page.tsx — "공연을 검색하거나 장르별로 탐색해보세요" 메시지
- 검색 결과 없음: PerformanceGrid emptyHeading/emptyBody props
- 장르 공연 없음: PerformanceGrid "등록된 공연이 없습니다" / "곧 새로운 공연이 등록될 예정입니다"
- 캐스팅 없음: performance/[id]/page.tsx — "캐스팅 정보가 없습니다"

**터치 타겟:**
- `min-h-[44px]`: MobileTabBar 탭 링크, 예매 날짜 선택 토글, 검색/장르 에러 재시도 버튼, 공연상세 CTA, reservation-card
- 44px 기준 전반적으로 적용됨

**접근성:**
- MobileTabBar: `role="navigation"`, `aria-current="page"` — 스펙 완전 일치
- NetworkBanner: `role="alert"`, `aria-live="assertive"` — 스펙 완전 일치
- 스켈레톤: `aria-busy="true"`, `aria-label="콘텐츠를 불러오는 중입니다"` — 11종 모두 적용
- 404: `<h1>` 태그 사용, Link에 명확한 텍스트

**파괴적 액션 확인:** 예매 취소 확인 모달 — `AlertDialog` 기반 구현 (Phase 4 구현물)

---

## Registry Safety

shadcn이 초기화되어 있으나 UI-SPEC.md의 Registry Safety 테이블에서 **제3자 레지스트리 없음**으로 선언됨. shadcn 공식 레지스트리만 사용. 레지스트리 감사 불필요.

Registry audit: 0 third-party blocks — not applicable.

---

## Files Audited

**Phase 05 신규 생성 파일:**
- `apps/web/components/layout/mobile-tab-bar.tsx`
- `apps/web/components/layout/network-banner.tsx`
- `apps/web/app/not-found.tsx`
- `apps/web/app/error.tsx`
- `apps/web/app/global-error.tsx`
- `apps/web/lib/error-messages.ts`
- `apps/web/lib/api-client.ts`
- `apps/web/components/skeletons/performance-card-skeleton.tsx`
- `apps/web/components/skeletons/banner-skeleton.tsx`
- `apps/web/components/skeletons/genre-grid-skeleton.tsx`
- `apps/web/components/skeletons/section-skeleton.tsx`
- `apps/web/components/skeletons/detail-header-skeleton.tsx`
- `apps/web/components/skeletons/detail-tabs-skeleton.tsx`
- `apps/web/components/skeletons/search-results-skeleton.tsx`
- `apps/web/components/skeletons/reservation-list-skeleton.tsx`
- `apps/web/components/skeletons/reservation-detail-skeleton.tsx`
- `apps/web/components/skeletons/seat-map-skeleton.tsx`
- `apps/web/components/skeletons/mypage-profile-skeleton.tsx`
- `apps/web/components/skeletons/index.ts`

**Phase 05 수정 파일 (감사 대상):**
- `apps/web/app/layout-shell.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/genre/[genre]/page.tsx`
- `apps/web/app/performance/[id]/page.tsx`
- `apps/web/app/search/page.tsx`
- `apps/web/app/mypage/page.tsx`
- `apps/web/app/mypage/reservations/[id]/page.tsx`
- `apps/web/components/booking/booking-page.tsx`
- `apps/web/components/reservation/reservation-card.tsx`

**참조 파일:**
- `apps/web/app/globals.css`
- `apps/web/components/booking/booking-complete.tsx`
- `apps/web/components/booking/order-summary.tsx`
- `apps/web/components/booking/confirm-header.tsx`
- `apps/web/app/global-error.tsx`
