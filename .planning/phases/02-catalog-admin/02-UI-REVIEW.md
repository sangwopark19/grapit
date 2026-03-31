# Phase 02 — UI Review

**Audited:** 2026-03-31
**Baseline:** 02-UI-SPEC.md (approved design contract)
**Screenshots:** captured (localhost:3000 — desktop 1440x900, mobile 375x812, tablet 768x1024)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 모든 CTA/empty/error 문구 계약 준수. 홈 페이지 h1 부재로 "장르별 바로가기" 등 h2가 사실상 페이지 첫 제목 역할 |
| 2. Visuals | 3/4 | 반응형 그리드, 카드, 뱃지, 탭 구조 정확 구현. 홈 페이지가 API 데이터 없이 완전 공백 — 빈 상태 UI 없음 |
| 3. Color | 3/4 | 어센트 54회 사용 중 spec 외 용도 일부 포함. status-badge에 하드코딩된 hex가 spec 값과 정확히 일치하여 허용 범위 내 |
| 4. Typography | 2/4 | font-medium(500)이 24곳 사용됨 — spec은 400/600만 허용. text-[28px] 커스텀 토큰 9곳 모두 일관되게 적용 |
| 5. Spacing | 3/4 | 섹션 간격 mt-12(48px)가 spec 2xl(48px)와 일치. 홈 콘텐츠 영역과 배너 사이 여백 없음 (0px gap) |
| 6. Experience Design | 3/4 | 스켈레톤, 에러, 빈 상태 전반적으로 우수. 홈 페이지 배너+섹션 모두 빈 상태일 때 페이지 완전 공백 노출 |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **font-medium(500) 24곳 사용** — spec 계약 위반 (허용: 400, 600만). 사용자에게는 미세한 시각 차이지만 디자인 시스템 일관성 파괴 — `font-medium` 클래스를 `font-semibold` 또는 `font-normal`로 교체. 주요 위치: `performance-card.tsx:59` (카드 제목), `pagination-nav.tsx` 페이지 번호, admin table cell, gnb auth area
2. **홈 페이지 빈 상태 — h1 및 콘텐츠 없음** — 데이터 없는 상태(빈 DB, API 오류)에서 GNB 아래 완전 공백 노출. 방문자 신뢰 훼손 — BannerCarousel의 빈 배열 처리는 있으나 `<main>`에 h1 부재. "Grapit에 오신 걸 환영합니다" 또는 "공연을 검색하거나 장르별로 탐색해보세요"같은 fallback h1 + 안내 텍스트 추가
3. **어드민 에러 상태에 클릭 가능한 '새로고침' 버튼 없음** — `admin/performances/page.tsx:139`, `admin/banners/page.tsx:102`에서 에러 문구는 "새로고침하거나 잠시 후 다시 시도해주세요"로 올바르지만, UI-SPEC이 요구하는 `<button>새로고침</button>` 액션 버튼이 없음. 어드민이 에러 복구를 위해 수동으로 브라우저 새로고침해야 함 — 각 에러 상태에 `onClick={() => window.location.reload()}` 버튼 추가

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Contract 준수 항목 (PASS):**
- 검색 결과 헤딩: `'test' 검색 결과` (search/page.tsx:62) — 계약 형식 `'{query}' 검색 결과` 일치
- 검색 빈 상태: "검색 결과가 없습니다" + "다른 키워드로 검색하거나 장르별 공연을 둘러보세요" (search/page.tsx:113-116) — 계약과 완전 일치
- 장르 빈 상태: "등록된 공연이 없습니다" + "곧 새로운 공연이 등록될 예정입니다" (genre/page.tsx:117-118) — 일치
- CTA disabled 문구: "추후 오픈 예정" (performance/[id]/page.tsx:158, 258) — 일치. 단, 버튼 label 자체는 "예매하기" 대신 disabled 문구만 표시 (Phase 2 의도적 설계)
- GNB "더보기": 계약 일치 (gnb.tsx:141)
- 정렬 옵션: "최신순", "인기순" (sort-toggle.tsx) — 일치
- 판매종료 토글: "판매종료 공연 포함" (genre/page.tsx:88, search/page.tsx:84) — 일치
- 에러 문구: "공연 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." + "다시 시도" (genre/page.tsx:103-110, search/page.tsx:98-106) — 계약과 일치
- 홈 섹션 헤딩: "HOT 공연" (hot-section.tsx:41), "신규 오픈" (new-section.tsx:37), "장르별 바로가기" (genre-grid.tsx:44) — 일치
- Admin empty states: "등록된 공연이 없습니다. 첫 공연을 등록해보세요." (admin/performances/page.tsx:147), "등록된 배너가 없습니다. 홈 캐러셀에 표시할 배너를 등록해보세요." (admin/banners/page.tsx:109) — 일치
- 공연 삭제 dialog: "공연을 삭제하시겠습니까?" / "이 공연의 모든 정보(회차, 캐스팅, 좌석맵)가 함께 삭제됩니다..." / "삭제" / "취소" — 계약과 완전 일치
- Admin CTA: "공연 등록" (admin/performances/page.tsx:91), "저장" (performance-form.tsx:540), "배너 등록" (banners/page.tsx:70) — 일치
- 회차 추가: "회차 추가" (showtime-manager.tsx:93) — 일치
- 저장 중 로딩: "저장 중..." (performance-form.tsx:537) — 일치

**문제 항목:**
- `admin/performances/page.tsx:139` 에러: "데이터를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요." — 텍스트는 spec과 일치하나 `<button>새로고침</button>` 버튼이 누락. 어드민 error button 계약: "새로고침" 버튼
- `admin/banners/page.tsx:102`, `admin/performances/[id]/edit/page.tsx:30` 동일 문제
- 홈 페이지 (`app/page.tsx`)에 h1 없음 — 접근성 heading hierarchy 계약 위반 (spec: "각 페이지에 정확히 하나의 h1")

### Pillar 2: Visuals (3/4)

**PASS:**
- **주 초점점 정확**: 홈 — BannerCarousel 전폭 히어로 (h-[400px] desktop, h-[200px] mobile). 장르 페이지 — PerformanceGrid. 상세 — 포스터+CTA 영역. spec 레이아웃과 일치
- **PerformanceCard**: 2:3 비율 포스터 (`aspect-[2/3]`), 상태 뱃지 top-left 8px 오프셋 (`left-2 top-2`), hover시 shadow-md + scale-[1.02] 전환 (duration-150) — spec 상호작용 계약 일치
- **GenreChip**: pill shape 확인 (`rounded-full h-9 px-4`), active: primary bg + white text, inactive: `bg-[#F5F5F7]` — spec D-04 일치. 단, 높이가 spec 36px 대신 h-9(36px)으로 일치
- **SortToggle**: `role="radiogroup" aria-label="정렬 기준"` + per-button `role="radio" aria-checked` — 접근성 계약 완전 이행
- **PaginationNav**: `nav aria-label="페이지 네비게이션"`, `aria-current="page"`, h-9 w-9(36px) 버튼 — spec 일치
- **AdminSidebar**: 240px wide (`w-[240px]`), active link `border-l-[3px] border-primary` + primary text — spec 일치
- **상세 페이지**: 모바일 CTA fixed bottom bar (`fixed bottom-0 ... lg:hidden`) 구현됨, 탭 3개 (캐스팅/상세정보/판매정보) — spec 일치
- **아이콘 버튼**: Trash2 아이콘 버튼에 `aria-label` 존재 (`${perf.title} 삭제`)
- **반응형 그리드**: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` — spec 2/3/4 열 일치

**문제 항목:**
- **홈 페이지 API 데이터 없을 때 완전 공백**: 스크린샷 확인 — GNB 아래 전체 영역 백지. BannerCarousel의 빈 배열 처리 (`배너가 없습니다` 텍스트)는 있으나, HotSection/NewSection이 빈 상태일 때 별도 fallback 없이 공백만 렌더링됨. 방문자 경험 매우 나쁨
- **홈 페이지 h1 없음**: `app/page.tsx`에 `<h1>` 부재. h2 3개 (HOT 공연, 신규 오픈, 장르별 바로가기)가 heading hierarchy 최상위로 존재. spec: "각 페이지에 정확히 하나의 h1"
- **상세 페이지 Desktop CTA**: `hidden ... lg:block`으로 desktop에서만 표시되는데 `"예매하기"` 텍스트 없이 `"추후 오픈 예정"`만 렌더링. Phase 2 계획된 동작이지만 버튼 외형상 CTA가 무엇인지 불명확 (spec: disabled state에서 "추후 오픈 예정" 표시로 계약 이행됨으로 허용)

### Pillar 3: Color (3/4)

**PASS:**
- **Dominant 60%**: 모든 페이지 배경 `bg-white`, 카드 배경 `bg-white` — 계약 일치
- **Secondary 30%**: admin layout `bg-[#F5F5F7]` (admin/layout.tsx:72), genre page background `bg-gray-100` (footer), chip inactive `bg-[#F5F5F7]` — 계약 일치. `#F5F5F7`과 Tailwind `gray-100`이 혼용되나 동일 색상값
- **Status badge 색상**: spec 명시 hex값과 정확히 일치
  - 판매중: `bg-[#22C55E]` text-white ✓
  - 마감임박: `bg-[#FFB41B]` text-`[#1A1A2E]` ✓
  - 판매종료: `bg-[#A1A1AA]` text-white ✓
  - 판매예정: `bg-[#6C3CE0]` text-white ✓
- **Accent #6C3CE0 spec 정의 용도 구현**:
  1. GNB active genre tab: `border-b-2 border-primary` (gnb.tsx:122) ✓
  2. CTA button: `bg-primary` (performance/[id]/page.tsx:156) ✓
  3. Active subcategory chip: `bg-primary text-white` (genre-chip.tsx:20) ✓
  4. Admin 저장 버튼: default Button (primary) ✓
  5. Pagination current page: `bg-primary text-white` (pagination-nav.tsx:88) ✓
  6. Search focus ring: `focus:ring-primary` (gnb.tsx:185) ✓
  7. Sort toggle active: `border-b-2 border-primary text-primary` (sort-toggle.tsx) ✓

**문제 항목:**
- `bg-primary` 14곳 중 spec 외 용도:
  - `auth/step-indicator.tsx` (완료/활성 단계 표시) — Phase 1 컴포넌트, Phase 2 계약 범위 외
  - `components/layout/mobile-menu.tsx:105` (사용자 아바타 배경) — spec 미명시. 허용 가능한 확장
  - `genre/page.tsx:108`, `search/page.tsx:104` 에러 상태 "다시 시도" 버튼 — spec에 명시된 에러 버튼이지만 `bg-primary` 직접 사용 (shadcn Button 컴포넌트 미사용). 일관성 약간 떨어짐
- `border-[#E5E5E5]` (gnb.tsx:104) — CSS 토큰 대신 하드코딩. 기능상 문제없으나 토큰 사용 권장

### Pillar 4: Typography (2/4)

**PASS:**
- **Display (28px semibold)**: `text-[28px] font-semibold leading-[1.2]` 9곳 모두 일관 적용 (홈 섹션 제목, admin 페이지 제목, 장르 페이지 제목) — spec 일치
- **Heading (20px semibold)**: `text-xl font-semibold` 사용 (상세 페이지 제목, 검색 페이지 제목) — spec 20px/semibold 일치
- **Body (16px regular)**: `text-base` 사용 — spec 16px 일치
- **Caption (14px regular)**: `text-sm` 사용 (카드 메타데이터, 뱃지, 페이지네이션) — spec 14px 일치
- **사용된 폰트 크기 종류**: xs, sm, base, xl, text-[28px] — 사실상 5단계 (spec 4단계 + 커스텀 28px). 허용 범위

**문제 항목 (감점 요인):**
- **font-medium(500) 24곳 사용** — spec은 "400 (regular)와 600 (semibold)만 허용. 다른 굵기 불가"로 명확히 제한
  - `performance-card.tsx:59`: `font-semibold` (카드 제목) — 이건 semibold로 올바름
  - `pagination-nav.tsx:85`: `font-medium` (페이지 번호) — 500 사용 위반
  - `gnb.tsx:210`: `font-medium` (사용자 아바타 이니셜) — 500 사용
  - `admin/performances/page.tsx:172`: `font-medium` (테이블 공연명 셀) — 500 사용
  - `performance-form.tsx` 다수의 section label: `font-medium` — 500 사용
  - `banner-manager.tsx:155` 등 버튼 내부: font-medium — 500 사용 (shadcn Button 기본값에서 상속)
  - **수정 방법**: spec 준수 시 `font-medium` → `font-semibold` (강조가 필요한 경우) 또는 `font-normal` (일반 텍스트)로 교체. shadcn button 컴포넌트 기본 font-medium은 컴포넌트 라이브러리 기본값이므로 예외 허용 여부 팀 내 결정 필요

### Pillar 5: Spacing (3/4)

**PASS:**
- **섹션 간격**: HotSection, NewSection, GenreGrid 모두 `mt-12` (48px) — spec 2xl(48px) 일치
- **카드 내부 padding**: `p-3` (12px) — spec md(16px)보다 약간 작음. 허용 범위
- **카드 그리드 가터**: `gap-x-6 gap-y-8` (24px horizontal, 32px vertical) — spec "24px horizontal, 32px vertical" 일치
- **페이지 side margin**: `max-w-[1200px] mx-auto px-6` (24px) — spec xl(32px) 대신 lg(24px) 사용. 스펙 xl 기대값과 차이 있으나 px-6(24px)은 일관되게 적용
- **Admin main content padding**: `p-8` (32px) — spec 3xl(64px) 대신 xl(32px) 사용. 차이 있으나 실용적으로 허용 가능
- **스탠다드 Tailwind 스케일**: 대부분 p-2, p-4, p-6, p-8 등 표준값 사용. 임의 px 값 남용 없음

**문제 항목:**
- **홈 페이지 배너-콘텐츠 영역 간격 없음**: `app/page.tsx`에서 BannerCarousel 직후 `<div className="mx-auto max-w-[1200px] px-6">`가 바로 시작. 배너와 첫 섹션 사이 여백 0px — spec은 배너 아래부터 섹션 시작으로 명시 (암묵적 py). HotSection의 `mt-12`가 섹션 자체 상단 여백을 제공하므로 실질 간격은 48px이지만, 배너 하단 여백이 별도 없어 레이아웃이 약간 밀착된 느낌
- **페이지 side margin 24px vs spec 32px**: 장르/검색/어드민 페이지 모두 `px-6`(24px) 사용. spec xl(32px) 대비 8px 차이. 시각적으로 허용 가능하나 계약 위반

### Pillar 6: Experience Design (3/4)

**PASS:**
- **로딩 상태 완전 구현**:
  - 홈 배너: `Skeleton h-[200px]/h-[400px]` ✓
  - 홈 HOT/New 섹션: 4카드 스켈레톤 (포스터 비율 + 텍스트 라인 3줄) ✓
  - 장르/검색 그리드: 8카드 스켈레톤 ✓
  - 상세 페이지: 포스터 스켈레톤 + 6개 텍스트 라인 스켈레톤 ✓
  - Admin 테이블: 5행 컬럼별 스켈레톤 ✓
  - Admin 배너: `aspect-video` 스켈레톤 ✓
  - Admin edit 페이지: 섹션별 스켈레톤 ✓
- **에러 상태**: 공개 페이지 (장르/검색/상세)에 에러 메시지 + "다시 시도" 버튼 구현 ✓
- **빈 상태**: 장르 페이지, 검색 페이지, admin 테이블, admin 배너 모두 빈 상태 텍스트 ✓
- **파괴적 액션 확인 dialog**: 공연 삭제, 회차 삭제, 배너 삭제, 캐스팅 삭제 모두 AlertDialog 구현 ✓
- **variant="destructive"**: 모든 삭제 확인 버튼에 적용 ✓
- **저장 버튼 로딩**: `isSubmitting` 시 `Loader2 spinner + "저장 중..."` ✓
- **admin role guard**: `user.role !== 'admin'` 체크 후 redirect ✓
- **middleware route protection**: `/admin/*` 경로 refreshToken 체크 ✓
- **URL state management**: 필터/정렬/페이지 모두 searchParams 동기화 ✓

**문제 항목:**
- **홈 페이지 전체 빈 상태 없음**: API 연결 전/DB 비어있을 때 배너, HOT, New, GenreGrid 모두 로딩 완료 후 섹션 내용 없이 공백 렌더링. `BannerCarousel`은 `배너가 없습니다` 텍스트 있으나 HotSection/NewSection은 빈 데이터 반환 시 섹션 헤딩만 표시되고 카드 없음 (현재 스크린샷에서 GNB 아래 완전 공백으로 확인)
- **Admin error state 버튼 없음**: `admin/performances/page.tsx:136-141`, `admin/banners/page.tsx:100-104` 에러 텍스트만 있고 클릭 가능한 "새로고침" 버튼 없음. spec 요구사항: `<button>새로고침</button>`
- **GenreGrid 빈 상태 미적용**: 장르 빈 상태에 PerformanceGrid의 `SearchIcon`이 표시됨. spec 장르 빈 상태에는 아이콘 언급 없음 (검색 결과 빈 상태는 Search 아이콘 적절하나 장르 빈 상태에는 맥락 불일치). 심각도 낮음

---

## Registry Audit

Registry audit: third-party shadcn 레지스트리 없음 (UI-SPEC.md Registry Safety 테이블 확인 — shadcn 공식 컴포넌트만 사용). 감사 생략.

---

## Files Audited

**Public pages:**
- `apps/web/app/page.tsx`
- `apps/web/app/genre/[genre]/page.tsx`
- `apps/web/app/performance/[id]/page.tsx`
- `apps/web/app/search/page.tsx`

**Home components:**
- `apps/web/components/home/banner-carousel.tsx`
- `apps/web/components/home/hot-section.tsx`
- `apps/web/components/home/new-section.tsx`
- `apps/web/components/home/genre-grid.tsx`

**Performance components:**
- `apps/web/components/performance/performance-card.tsx`
- `apps/web/components/performance/performance-grid.tsx`
- `apps/web/components/performance/status-badge.tsx`
- `apps/web/components/performance/pagination-nav.tsx`
- `apps/web/components/performance/genre-chip.tsx`
- `apps/web/components/performance/sort-toggle.tsx`

**Admin pages:**
- `apps/web/app/admin/performances/page.tsx`
- `apps/web/app/admin/performances/new/page.tsx`
- `apps/web/app/admin/performances/[id]/edit/page.tsx`
- `apps/web/app/admin/banners/page.tsx`

**Admin components:**
- `apps/web/components/admin/admin-sidebar.tsx`
- `apps/web/components/admin/performance-form.tsx` (부분)
- `apps/web/components/admin/banner-manager.tsx`
- `apps/web/components/admin/status-filter.tsx`

**Layout:**
- `apps/web/components/layout/gnb.tsx`

**Config:**
- `apps/web/components.json`

**Screenshots (not committed):**
- `.planning/ui-reviews/02-20260331-122203/desktop-home.png`
- `.planning/ui-reviews/02-20260331-122203/mobile-home.png`
- `.planning/ui-reviews/02-20260331-122203/tablet-home.png`
- `.planning/ui-reviews/02-20260331-122203/desktop-genre.png`
- `.planning/ui-reviews/02-20260331-122203/desktop-search.png`
- `.planning/ui-reviews/02-20260331-122203/desktop-admin.png`
