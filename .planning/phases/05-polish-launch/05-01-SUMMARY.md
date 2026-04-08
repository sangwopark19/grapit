---
phase: 05-polish-launch
plan: 01
subsystem: ui
tags: [tailwind, responsive, mobile, tab-bar, lucide-react, next.js]

# Dependency graph
requires:
  - phase: 02-catalog-admin
    provides: LayoutShell, GNB, Footer, public page layout
  - phase: 04-booking-payment
    provides: BookingPage, confirm page, reservation pages
provides:
  - MobileTabBar bottom navigation component
  - Mobile-first responsive layout for all public pages
  - Collapsible date/showtime picker for mobile booking flow
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "md: breakpoint for mobile/desktop split (hidden md:block, md:hidden)"
    - "px-4 mobile gutter / md:px-6 desktop gutter"
    - "Collapsible UI pattern with useState + lg:block for mobile accordion"
    - "min-h-[44px] touch target enforcement on all interactive elements"

key-files:
  created:
    - apps/web/components/layout/mobile-tab-bar.tsx
    - apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx
  modified:
    - apps/web/app/layout-shell.tsx
    - apps/web/components/layout/gnb.tsx
    - apps/web/app/page.tsx
    - apps/web/app/genre/[genre]/page.tsx
    - apps/web/app/performance/[id]/page.tsx
    - apps/web/app/search/page.tsx
    - apps/web/app/mypage/page.tsx
    - apps/web/app/mypage/reservations/[id]/page.tsx
    - apps/web/components/booking/booking-page.tsx
    - apps/web/components/reservation/reservation-card.tsx

key-decisions:
  - "MobileTabBar uses /genre path prefix matching for category tab active state (covers all genre sub-pages)"
  - "LayoutShell wraps GNB/Footer in hidden md:block divs to hide on mobile instead of modifying GNB internals"
  - "GNB mobile hamburger menu and MobileMenu removed entirely (replaced by MobileTabBar)"
  - "Booking date/showtime picker uses CSS+state collapsible (not shadcn Accordion) to avoid extra dependency"
  - "Performance detail switched from lg: to md: breakpoint for earlier 2-column layout activation"

patterns-established:
  - "Mobile-first responsive: px-4 on mobile, md:px-6 on desktop"
  - "Tab bar pattern: fixed bottom nav with z-50, pb-[56px] content offset"
  - "Collapsible mobile UI: button toggle + useState + lg:block fallback"

requirements-completed: [INFR-01]

# Metrics
duration: 7min
completed: 2026-04-08
---

# Phase 5 Plan 01: Mobile Responsive Summary

**MobileTabBar 4-tab bottom navigation + 전체 공개 페이지 모바일 반응형 레이아웃 (px-4 gutter, 접힘식 날짜 선택, 포스터 전체폭, 44px 터치 타겟)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-08T00:39:58Z
- **Completed:** 2026-04-08T00:47:45Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- MobileTabBar 컴포넌트 생성: 4탭(홈/카테고리/검색/마이페이지), usePathname 기반 활성 상태, aria-current/role=navigation 접근성
- LayoutShell 통합: 모바일에서 GNB/Footer 숨기고 MobileTabBar 표시, pb-[56px] 하단 패딩
- 모든 공개 페이지 모바일 반응형: px-4 gutter, 공연 상세 포스터 max-h-[400px], 예매 접힘식 날짜/회차 선택
- 전체 인터랙티브 요소 44px 최소 터치 타겟 적용

## Task Commits

Each task was committed atomically:

1. **Task 1: MobileTabBar TDD RED** - `30b3bdd` (test)
2. **Task 1: MobileTabBar + LayoutShell + GNB GREEN** - `0f9c6a5` (feat)
3. **Task 2: 전체 공개 페이지 모바일 반응형 CSS** - `b57fe62` (feat)

## Files Created/Modified
- `apps/web/components/layout/mobile-tab-bar.tsx` - 모바일 하단 4탭 네비게이션 바
- `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` - MobileTabBar 8개 유닛 테스트
- `apps/web/app/layout-shell.tsx` - MobileTabBar 통합, GNB/Footer 모바일 숨김
- `apps/web/components/layout/gnb.tsx` - MobileMenu/hamburger 코드 제거
- `apps/web/app/page.tsx` - px-4 모바일 gutter
- `apps/web/app/genre/[genre]/page.tsx` - 모바일 필터 레이아웃, 터치 타겟
- `apps/web/app/performance/[id]/page.tsx` - md:flex-row 2단, 포스터 max-h-[400px]
- `apps/web/app/search/page.tsx` - px-4 모바일 gutter, 터치 타겟
- `apps/web/app/mypage/page.tsx` - 모바일 패딩 조정
- `apps/web/app/mypage/reservations/[id]/page.tsx` - px-4 md:px-6 반응형 패딩
- `apps/web/components/booking/booking-page.tsx` - 접힘식 날짜/회차 선택기
- `apps/web/components/reservation/reservation-card.tsx` - min-h-[44px] 터치 타겟

## Decisions Made
- MobileTabBar 카테고리 탭: `/genre` 접두사 매칭으로 모든 장르 하위 페이지에서 활성 표시
- LayoutShell에서 GNB/Footer를 `hidden md:block` div로 감싸서 모바일 숨김 (GNB 내부 수정 최소화)
- GNB에서 MobileMenu 관련 코드(import, state, hamburger 버튼) 완전 제거
- 공연 상세 페이지: lg: 대신 md: 브레이크포인트로 변경하여 768px부터 2단 레이아웃 활성화
- 예매 날짜 선택: shadcn Accordion 대신 직접 구현한 collapsible (추가 의존성 없음)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 모바일 레이아웃 기반 완성 -- 05-02 (Skeleton UI), 05-03 (Error Handling) 진행 가능
- GNB에서 제거된 MobileMenu 컴포넌트(`mobile-menu.tsx`)는 더 이상 사용되지 않으나 파일은 남아있음 (향후 정리 가능)

## Self-Check: PASSED

All files exist, all commits verified, all acceptance criteria met.

---
*Phase: 05-polish-launch*
*Completed: 2026-04-08*
