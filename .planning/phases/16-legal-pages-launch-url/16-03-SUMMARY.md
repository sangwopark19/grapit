---
phase: 16-legal-pages-launch-url
plan: 03
subsystem: frontend
tags: [nextjs, footer, legal-pages, mailto, vitest]

requires:
  - phase: 16-legal-pages-launch-url
    provides: Public `/legal/terms` and `/legal/privacy` routes from Plan 16-02
  - phase: 16-legal-pages-launch-url
    provides: Wave 0 Footer href contract tests from Plan 16-01
provides:
  - Footer links wired to `/legal/terms`, `/legal/privacy`, and `mailto:support@heygrabit.com`
  - D-04 guard preserving `/legal/marketing` absence from Footer navigation
  - T-16-01 mitigation through relative legal paths and a mailto-only support link
affects: [16-04, 16-05, 16-06, legal-pages, launch-url]

tech-stack:
  added: []
  patterns:
    - Next.js `<Link>` retained only for internal legal routes
    - Native `<a href="mailto:...">` used for customer support email links

key-files:
  created:
    - .planning/phases/16-legal-pages-launch-url/16-03-SUMMARY.md
  modified:
    - apps/web/components/layout/footer.tsx

key-decisions:
  - "Footer exposes only terms/privacy legal pages; `/legal/marketing` remains hidden from global navigation."
  - "Customer support uses a native mailto anchor instead of Next.js Link because it is not internal navigation."

patterns-established:
  - "Footer legal href contracts are protected by exact string tests and grep checks."

requirements-completed: [D-03, D-04]

duration: 2min
completed: 2026-04-28
---

# Phase 16 Plan 03: Footer Legal Link Wiring Summary

**Footer legal navigation now points to static legal pages and a support mailto while keeping marketing consent out of global navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-28T05:49:43Z
- **Completed:** 2026-04-28T05:51:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced the three Footer placeholder `href="#"` values with `/legal/terms`, `/legal/privacy`, and `mailto:support@heygrabit.com`.
- Preserved `font-semibold` only on the privacy link for the D-03 emphasis requirement.
- Kept `/legal/marketing` and "마케팅" absent from Footer, preserving the D-04 policy.
- Kept Footer layout tokens, separators, copyright, and visual styling unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Footer href 3건 교체 (D-03 + D-04 invariant)** - `774a50b` (feat)

## Files Created/Modified

- `apps/web/components/layout/footer.tsx` - Replaced Footer legal placeholders with two internal legal routes and one native support mailto anchor.

## Patch Summary

```diff
- <Link href="#" className="hover:underline">
+ <Link href="/legal/terms" className="hover:underline">

- <Link href="#" className="font-semibold hover:underline">
+ <Link href="/legal/privacy" className="font-semibold hover:underline">

- <Link href="#" className="hover:underline">
+ <a href="mailto:support@heygrabit.com" className="hover:underline">
```

## Verification

- Acceptance grep checks: 12/12 passed.
- Footer href pattern count: 3 matches for `/legal/terms`, `/legal/privacy`, and `mailto:support@heygrabit.com`.
- `pnpm --filter @grabit/web exec vitest run components/layout/__tests__/footer.test.tsx --reporter=verbose` -> 1 file passed, 7 tests passed.
- `pnpm --filter @grabit/web typecheck` -> passed.
- `pnpm --filter @grabit/web lint` -> exit 0 with 22 pre-existing warnings outside this plan.

## T-16-01 Threat Mitigation

- Terms and privacy links use relative paths only: `/legal/terms`, `/legal/privacy`.
- Customer support uses only the intended `mailto:support@heygrabit.com` scheme.
- No external host URL was introduced.
- Exact Footer tests and grep checks now guard against placeholder or marketing-link regressions.

## Decisions Made

- Customer support remains a native mailto link with no `target` or `rel`, matching the UI-SPEC contract.
- `/legal/marketing` stays available as a route from Plan 16-02 but is not surfaced in Footer navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Lint still reports 22 existing warnings in unrelated files and exits 0. No warning was introduced by this Footer-only change.

## Known Stubs

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required for Plan 16-03.

## Next Phase Readiness

Ready for Plan 16-04. Footer now points to the Plan 16-02 legal routes, and Wave 0 Footer tests are GREEN.

## Self-Check: PASSED

- Modified Footer file verified on disk.
- SUMMARY file verified on disk.
- Task commit verified in git log: `774a50b`.
- No tracked file deletions were introduced by the task commit.

---
*Phase: 16-legal-pages-launch-url*
*Completed: 2026-04-28*
