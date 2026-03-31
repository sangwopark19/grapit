---
phase: 02-catalog-admin
plan: 05
subsystem: ui
tags: [tailwind, spacing, layout-shift, react-query, keepPreviousData, tabs, search]

# Dependency graph
requires:
  - phase: 02-catalog-admin/02-02
    provides: "Performance detail page and search page from catalog frontend"
provides:
  - "Corrected detail page spacing (CTA clearance, poster sizing, prose width, tab spacing)"
  - "Stable search page layout during genre chip toggling (keepPreviousData)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "keepPreviousData pattern for preventing layout shift on query parameter changes"
    - "TabsContent base class as single source of tab-content spacing"
    - "Fixed CTA bar clearance via responsive bottom padding (pb-20 lg:pb-8)"

key-files:
  created: []
  modified:
    - "apps/web/app/performance/[id]/page.tsx"
    - "apps/web/components/ui/tabs.tsx"
    - "apps/web/app/search/page.tsx"
    - "apps/web/hooks/use-search.ts"

key-decisions:
  - "TabsContent mt-6 base class replaces per-instance py-8 overrides"
  - "keepPreviousData prevents undefined flash during search refetch"
  - "Single empty-state source via PerformanceGrid (removed duplicate inline empty-state)"

patterns-established:
  - "keepPreviousData: Use on any useQuery where filter/page changes cause visible layout shift"
  - "Fixed bottom bar clearance: pb-20 lg:pb-8 pattern for mobile CTA bars"

requirements-completed: [PERF-02, SRCH-01, SRCH-02]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 02 Plan 05: UAT Gap Closure Summary

**Fixed 5 detail page spacing issues and search page layout shift via keepPreviousData and single empty-state source**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T05:55:28Z
- **Completed:** 2026-03-31T05:58:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed 5 compounding spacing issues on performance detail page (TabsContent py-8, CTA clearance, poster width, prose line length, separator spacing)
- Eliminated search page layout shift on genre chip toggle via keepPreviousData and single empty-state source
- Total count container always reserves space with h-5 height

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix performance detail page spacing (5 issues)** - `7f2d8a6` (fix)
2. **Task 2: Fix search page layout shift on genre chip toggle** - `f251d72` (fix)

## Files Created/Modified
- `apps/web/components/ui/tabs.tsx` - TabsContent base class mt-4 -> mt-6
- `apps/web/app/performance/[id]/page.tsx` - Removed py-8 overrides, added CTA clearance padding, constrained poster width, fixed prose width, normalized separator spacing
- `apps/web/hooks/use-search.ts` - Added keepPreviousData to useSearch hook
- `apps/web/app/search/page.tsx` - Removed duplicate empty-state, always-render total count container

## Decisions Made
- TabsContent mt-6 as single source of tab-content spacing instead of per-instance py-8 overrides
- keepPreviousData used instead of custom stale-while-revalidate logic (built-in TanStack Query feature)
- Removed duplicate empty-state block in favor of PerformanceGrid's internal empty handling (matches genre page pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `next lint` command fails with "Invalid project directory" error in Next.js 16.2.x -- this is a pre-existing infrastructure issue (no ESLint config exists in the project). Typecheck was the meaningful verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All UAT cosmetic gaps from Phase 2 are now closeable
- Phase 2 catalog-admin is ready for final acceptance

## Self-Check: PASSED

- All 4 modified files exist on disk
- Both task commits (7f2d8a6, f251d72) found in git log
- No stubs detected in modified files

---
*Phase: 02-catalog-admin*
*Completed: 2026-03-31*
