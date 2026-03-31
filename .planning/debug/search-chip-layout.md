---
status: resolved
trigger: "Search page layout shifts when toggling genre chips — padding/margin changes on each toggle"
created: 2026-03-31T11:10:00Z
updated: 2026-03-31T11:12:00Z
---

## Current Focus

hypothesis: CONFIRMED — Layout shift caused by two issues: (1) conditional total-count paragraph adds/removes vertical space during refetch, (2) search page has duplicate empty-state handling creating different spacing paths vs genre page
test: Compared search page layout structure against genre page (which passes UAT)
expecting: Structural differences in spacing/conditional rendering between the two pages
next_action: Report root cause

## Symptoms

expected: Search page layout remains stable when toggling genre chips — padding/margin should not shift
actual: "잘 보이는데 장르 칩 누를때마다 패딩 마진이 바뀌어서 수정해야됨" (padding/margin changes every time genre chip is pressed)
errors: None — cosmetic only
reproduction: Visit /search?q=hamlet, toggle genre chip filters
started: Discovered during Phase 2 UAT

## Eliminated

- hypothesis: GenreChip component itself has unstable sizing on active/inactive toggle
  evidence: GenreChip uses fixed h-9, px-4, shrink-0 — size is stable regardless of isActive state. Only bg/text color changes.
  timestamp: 2026-03-31T11:11:00Z

## Evidence

- timestamp: 2026-03-31T11:11:00Z
  checked: GenreChip component (apps/web/components/performance/genre-chip.tsx)
  found: Stable sizing — h-9, shrink-0, px-4, rounded-full. Only color transitions on active toggle. No margin/padding changes.
  implication: Chip itself is not the cause. Problem is in the page layout.

- timestamp: 2026-03-31T11:11:30Z
  checked: Search page layout structure (apps/web/app/search/page.tsx lines 58-141)
  found: Three layout shift causes identified by comparing with genre page (/genre/[genre]/page.tsx):
    (1) Line 64-66: Conditional total count `{data && (<p className="mt-1 ...">총 {data.total}건</p>)}` — When genre chip is toggled, useSearch refetches. During refetch, `data` becomes stale/undefined momentarily (depending on react-query keepPreviousData config), causing this paragraph to appear/disappear, shifting everything below by ~24px (mt-1 + text-sm line height).
    (2) Lines 95-127: Search page has DUPLICATE empty-state handling — both an inline empty check (lines 109-117) AND passes emptyHeading/emptyBody to PerformanceGrid (line 120-124). PerformanceGrid already handles empty state internally (performance-grid.tsx lines 44-53). The inline check at lines 109-117 renders a different layout (no grid wrapper, just centered content) compared to PerformanceGrid's own empty state, and the conditional chain `isError ? ... : data && data.data.length === 0 && !isLoading ? ... : <PerformanceGrid>` creates layout thrashing during state transitions.
    (3) Lines 82-92 vs genre page lines 82-96: Search page ended toggle uses `mt-4` and `justify-end` (no left-side sort toggle), while genre page uses `mt-6` and `justify-between` with SortToggle. The search page filter row height and spacing is inconsistent.
  implication: Primary cause is (1) — the conditional total count paragraph appearing/disappearing during refetch cycles. Secondary cause is (2) — duplicate empty state paths.

- timestamp: 2026-03-31T11:12:00Z
  checked: useSearch hook (apps/web/hooks/use-search.ts)
  found: useQuery with queryKey ['search', q, genre, ended, page]. No placeholderData or keepPreviousData option set. When genre chip changes, the queryKey changes, react-query treats it as a new query — data resets to undefined until refetch completes.
  implication: Confirms cause (1). Without keepPreviousData, every chip toggle causes data=undefined -> conditional elements disappear -> layout shifts -> data arrives -> elements reappear -> layout shifts again. This is a double layout shift per chip toggle.

- timestamp: 2026-03-31T11:12:00Z
  checked: Genre page for comparison (apps/web/app/genre/[genre]/page.tsx)
  found: Genre page does NOT have a conditional total count paragraph. Genre page does NOT have duplicate empty state handling (delegates entirely to PerformanceGrid). Genre page uses consistent mt-8 before grid (vs mt-6 in search page). This is why genre page passed UAT but search page did not.
  implication: Confirms the root cause is specific to search page's extra conditional elements, not a shared component issue.

## Resolution

root_cause: |
  Two issues cause layout shift on genre chip toggle in the search page:

  PRIMARY: The total count paragraph (line 64-66) is conditionally rendered with `{data && ...}`.
  The useSearch hook has no `placeholderData: keepPreviousData` option, so when genre chip changes
  the queryKey, react-query resets data to undefined. This makes the paragraph disappear during
  refetch and reappear when data arrives — a double layout shift of ~24px per toggle.

  SECONDARY: The results section (lines 95-127) has redundant empty-state handling inline that
  duplicates what PerformanceGrid already provides internally. The ternary chain
  (isError -> inline empty -> PerformanceGrid) creates different layout structures during
  state transitions (loading -> empty -> populated), causing additional spacing inconsistency.

fix:
verification:
files_changed: []
