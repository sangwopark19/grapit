---
phase: 02-catalog-admin
plan: 03
subsystem: ui
tags: [react-query, swiper, next.js, tailwind, shadcn, catalog, search]

requires:
  - phase: 02-01
    provides: shared types (PerformanceCardData, Banner, Genre, etc.), API schemas, shadcn components
  - phase: 01
    provides: GNB shell, auth store, api-client, layout, Tailwind tokens

provides:
  - React Query provider wrapping app
  - 4 public pages (home, genre, detail, search)
  - 10+ catalog UI components (PerformanceCard, StatusBadge, GenreChip, etc.)
  - Data-fetching hooks (usePerformances, useSearch, useHomeBanners, etc.)
  - Active GNB genre tabs with dropdown + search bar
  - Component smoke tests (StatusBadge, PaginationNav)

affects: [02-04-admin, 03-seat-map, 04-booking-payment]

tech-stack:
  added: ["@tanstack/react-query", "swiper"]
  patterns: [self-contained-section-components, url-searchparams-as-state, react-query-hooks]

key-files:
  created:
    - apps/web/app/providers.tsx
    - apps/web/app/genre/[genre]/page.tsx
    - apps/web/app/performance/[id]/page.tsx
    - apps/web/app/search/page.tsx
    - apps/web/components/performance/performance-card.tsx
    - apps/web/components/performance/status-badge.tsx
    - apps/web/components/performance/genre-chip.tsx
    - apps/web/components/performance/pagination-nav.tsx
    - apps/web/components/performance/sort-toggle.tsx
    - apps/web/components/performance/performance-grid.tsx
    - apps/web/components/home/banner-carousel.tsx
    - apps/web/components/home/genre-grid.tsx
    - apps/web/components/home/hot-section.tsx
    - apps/web/components/home/new-section.tsx
    - apps/web/hooks/use-performances.ts
    - apps/web/hooks/use-search.ts
    - apps/web/components/performance/__tests__/status-badge.test.tsx
    - apps/web/components/performance/__tests__/pagination-nav.test.tsx
  modified:
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/app/globals.css
    - apps/web/components/layout/gnb.tsx
    - apps/web/components/layout/mobile-menu.tsx

key-decisions:
  - "Self-contained section pattern: HotSection/NewSection call hooks internally, page.tsx renders without props"
  - "URL searchParams as filter state: genre/search pages use router.replace to update params without full nav"
  - "lib/index.ts barrel export added for shadcn @/lib import compatibility"

patterns-established:
  - "Self-contained section: components like HotSection own their data fetching (useHotPerformances) internally"
  - "URL state management: filter/sort/page state stored in URL searchParams via useSearchParams + router.replace"
  - "Performance card: reusable PerformanceCard used across home, genre, search pages"
  - "React Query hooks: one hook per data concern (usePerformances, useSearch, useHomeBanners)"

requirements-completed: [PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, SRCH-01, SRCH-02, SRCH-03]

duration: 9min
completed: 2026-03-31
---

# Phase 02 Plan 03: Public Pages Summary

**4 public catalog pages (home, genre, detail, search) with React Query data fetching, active GNB navigation, and 10+ shared UI components**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T00:47:37Z
- **Completed:** 2026-03-31T00:56:43Z
- **Tasks:** 2
- **Files modified:** 36

## Accomplishments
- Replaced placeholder homepage with full catalog: banner carousel, HOT/New sections, genre grid shortcuts
- Built genre category page with subcategory chips, sort toggle, ended filter, paginated grid
- Built performance detail page with poster, info panel, price table, 3 tabs (casting/detail/sales), disabled CTA
- Built search results page with genre filter chips, ended toggle, pagination, empty state
- Activated GNB genre tabs with active state, "더보기" dropdown (3 extra genres), and search bar
- Updated mobile menu with all 8 genre links and search input
- Created 9 passing component tests (5 StatusBadge + 4 PaginationNav)

## Task Commits

Each task was committed atomically:

1. **Task 1: React Query provider + shared components + hooks + tests** - `b338d27` (feat)
2. **Task 2: Public pages + GNB activation** - `6603459` (feat)

## Files Created/Modified

### Created
- `apps/web/app/providers.tsx` - React Query QueryClientProvider wrapper
- `apps/web/app/genre/[genre]/page.tsx` - Genre category page with filters/grid/pagination
- `apps/web/app/performance/[id]/page.tsx` - Performance detail with poster/info/tabs/CTA
- `apps/web/app/search/page.tsx` - Search results with genre filter/ended toggle
- `apps/web/components/performance/performance-card.tsx` - Poster + badge + info card component
- `apps/web/components/performance/status-badge.tsx` - Status badge (판매중/마감임박/판매종료/판매예정)
- `apps/web/components/performance/genre-chip.tsx` - Pill-shaped filter chip
- `apps/web/components/performance/pagination-nav.tsx` - Numbered pagination with ellipsis
- `apps/web/components/performance/sort-toggle.tsx` - 최신순/인기순 toggle group
- `apps/web/components/performance/performance-grid.tsx` - Responsive card grid with loading/empty states
- `apps/web/components/home/banner-carousel.tsx` - Swiper autoplay carousel for banners
- `apps/web/components/home/genre-grid.tsx` - 8-genre icon grid with links
- `apps/web/components/home/hot-section.tsx` - Self-contained HOT section (fetches own data)
- `apps/web/components/home/new-section.tsx` - Self-contained New section (fetches own data)
- `apps/web/hooks/use-performances.ts` - React Query hooks for performances, detail, banners, hot, new
- `apps/web/hooks/use-search.ts` - React Query hook for search results
- `apps/web/lib/index.ts` - Barrel export for @/lib compatibility
- `apps/web/components/performance/__tests__/status-badge.test.tsx` - 5 tests
- `apps/web/components/performance/__tests__/pagination-nav.test.tsx` - 4 tests

### Modified
- `apps/web/app/layout.tsx` - Wrapped with Providers (React Query)
- `apps/web/app/page.tsx` - Replaced placeholder with catalog homepage
- `apps/web/app/globals.css` - Added shake keyframe + scrollbar-hide utility
- `apps/web/components/layout/gnb.tsx` - Active genre tabs, dropdown, search bar
- `apps/web/components/layout/mobile-menu.tsx` - All 8 genres + search input

## Decisions Made
- **Self-contained section pattern:** HotSection/NewSection call their own hooks internally rather than receiving data as props from page.tsx. This keeps page.tsx clean and allows each section to manage its own loading/error states independently.
- **URL searchParams as state:** Genre and search pages use `useSearchParams` + `router.replace` for filter/sort/page state. This enables deep linking, browser back/forward, and shareable URLs.
- **lib/index.ts barrel export:** New shadcn components (from Plan 01 install) import from `@/lib` while Phase 1 components import from `@/lib/cn`. Added barrel export to support both patterns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/index.ts barrel export**
- **Found during:** Task 1 (shadcn component import)
- **Issue:** New shadcn UI components installed in Plan 01 use `import { cn } from "@/lib"` but no barrel export existed (only `@/lib/cn`)
- **Fix:** Created `apps/web/lib/index.ts` re-exporting cn
- **Files modified:** apps/web/lib/index.ts
- **Committed in:** b338d27

**2. [Rule 3 - Blocking] Synced shadcn UI components and package.json from main repo**
- **Found during:** Task 1 (component setup)
- **Issue:** Worktree was missing shadcn components (badge, card, skeleton, etc.) and npm dependencies (@tanstack/react-query, swiper) that Plan 01 had installed in main repo
- **Fix:** Copied UI components and synced package.json, ran pnpm install
- **Committed in:** b338d27

**3. [Rule 2 - Missing Critical] Added shake animation and scrollbar-hide CSS**
- **Found during:** Task 2 (GNB search + genre chip scroll)
- **Issue:** GNB search shake animation and horizontal chip scroll needed CSS utilities not in globals.css
- **Fix:** Added `@keyframes shake` and `.scrollbar-hide` to globals.css
- **Committed in:** 6603459

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All necessary for correct functionality. No scope creep.

## Known Stubs

None -- all components are wired to React Query hooks that call the API. Data will flow once the API backend is running.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All public pages ready for integration with Plan 02-04 (admin pages)
- Backend API endpoints (/api/v1/performances, /api/v1/home/*, /api/v1/search) must be built for data to render
- Performance detail CTA intentionally disabled -- will be activated in booking phase

## Self-Check: PASSED

- All 21 created files verified present
- Both task commits (b338d27, 6603459) verified in git log
- TypeScript compilation clean
- All 9 tests passing

---
*Phase: 02-catalog-admin*
*Completed: 2026-03-31*
