---
phase: 16-legal-pages-launch-url
plan: 01
subsystem: testing
tags: [vitest, react-testing-library, legal-pages, metadata, footer]

requires:
  - phase: 16-legal-pages-launch-url
    provides: phase context, research, patterns, UI spec, validation map
provides:
  - Wave 0 RED tests for TermsMarkdown showH1 behavior
  - Wave 0 RED tests for legal page metadata and force-static exports
  - Wave 0 RED tests for Footer legal href contracts and marketing-link absence
affects: [16-02, 16-03, legal-pages, launch-url]

tech-stack:
  added: []
  patterns:
    - RTL component tests with container/querySelector and className assertions
    - import.meta.glob module contract tests for not-yet-created App Router pages
    - Footer href contract tests using closest('a').getAttribute('href')

key-files:
  created:
    - apps/web/components/legal/__tests__/terms-markdown.test.tsx
    - apps/web/app/legal/__tests__/metadata.test.ts
    - apps/web/components/layout/__tests__/footer.test.tsx
  modified: []

key-decisions:
  - "Wave 0 RED 상태를 정상 산출물로 기록하고, artifact 생성과 behavioral GREEN 상태를 분리 추적한다."
  - "Vite transform 단계에서 누락 page import가 collection을 막지 않도록 metadata test는 import.meta.glob lazy lookup으로 작성한다."

patterns-established:
  - "Wave 0 RED tests: missing future implementation must fail after Vitest collection, not during transform."
  - "Legal metadata contracts are tested as module exports only; server component default export rendering is intentionally not invoked."

requirements-completed: [D-09, D-10, D-13, D-03, D-04]

duration: 6min
completed: 2026-04-28
---

# Phase 16 Plan 01: Wave 0 Legal Contract Tests Summary

**Legal page launch contracts captured as Vitest RED tests for showH1 rendering, static page metadata, and Footer legal links**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T05:26:52Z
- **Completed:** 2026-04-28T05:32:52Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `TermsMarkdown` tests for default/explicit false H1 suppression, future `showH1=true` H1 rendering, and h2/p typography regression guards.
- Added legal page metadata tests for `/legal/terms`, `/legal/privacy`, and `/legal/marketing` title, description, canonical, robots, and `dynamic = 'force-static'`.
- Added Footer tests for `/legal/terms`, `/legal/privacy`, `mailto:support@heygrabit.com`, no `/legal/marketing` exposure, and copyright stability.

## Task Commits

Each task was committed atomically:

1. **Task 1: terms-markdown.test.tsx 작성** - `330f764` (test)
2. **Task 2: legal page metadata.test.ts 작성** - `0b1e733` (test)
3. **Task 3: footer.test.tsx 작성** - `79b21f2` (test)

## Files Created/Modified

- `apps/web/components/legal/__tests__/terms-markdown.test.tsx` - 5 tests for D-09 `showH1` behavior and existing markdown typography mappings.
- `apps/web/app/legal/__tests__/metadata.test.ts` - 6 tests for D-10/D-13 page metadata and static export contracts.
- `apps/web/components/layout/__tests__/footer.test.tsx` - 7 tests for D-03 href contracts, D-04 marketing-link absence, and Footer stability.

## Verification

- File existence: all 3 new test files exist.
- Test counts: `terms-markdown.test.tsx` 5 `it()`, `metadata.test.ts` 6 `it()`, `footer.test.tsx` 7 `it()`.
- Dependency check: `git diff -- apps/web/package.json` empty; no install or package changes.
- Plan-level Vitest command:
  - Command: `pnpm --filter @grabit/web exec vitest run components/legal/__tests__/terms-markdown.test.tsx app/legal/__tests__/metadata.test.ts components/layout/__tests__/footer.test.tsx --reporter=verbose`
  - Result: collected 3 test files and 18 tests.
  - Wave 0 distribution: 8 passed, 10 failed.

## Wave 0 RED Distribution

| File | Tests | Passed | Failed | Expected GREEN Wave |
|------|-------|--------|--------|---------------------|
| `terms-markdown.test.tsx` | 5 | 4 | 1 | Wave 1 / Plan 16-02 |
| `metadata.test.ts` | 6 | 0 | 6 | Wave 1 / Plan 16-02 |
| `footer.test.tsx` | 7 | 4 | 3 | Wave 2 / Plan 16-03 |

## Validation Map Status

| Task ID | Artifact 생성 | Behavioral GREEN | Notes |
|---------|---------------|------------------|-------|
| 16-01-01 | ✅ artifact | ⏳ behavior | `showH1=true` H1 rendering remains RED until TermsMarkdown gains the prop. |
| 16-01-02 | ✅ artifact | ⏳ behavior | `/legal/{terms,privacy,marketing}/page.tsx` modules are not created yet, so metadata tests are RED. |
| 16-01-03 | ✅ artifact | ⏳ behavior | Footer still renders `href="#"`, so legal href contract tests are RED. |

## Decisions Made

- Wave 0 RED tests are complete when Vitest can collect them and the failing assertions identify the future implementation contract.
- Metadata tests use lazy module lookup and do not render default server component exports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made metadata RED tests collect-safe under Vite import analysis**
- **Found during:** Task 2 (legal page metadata.test.ts 작성)
- **Issue:** Literal `await import('@/app/legal/terms/page')` caused Vite transform-time import resolution failure before any tests were collected.
- **Fix:** Replaced literal dynamic imports with `import.meta.glob<LegalPageModule>('../*/page.tsx')` and a typed `loadLegalPage(...)` helper. The helper retains the original alias import contract string in failure messages and lets current Wave 0 fail during test execution.
- **Files modified:** `apps/web/app/legal/__tests__/metadata.test.ts`
- **Verification:** `metadata.test.ts` now collects 6 tests, all failing with explicit missing-module RED messages.
- **Committed in:** `0b1e733`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The behavioral contract is unchanged. The adjustment was required so the Wave 0 RED suite is collectable by Vitest.

## Issues Encountered

- Expected RED failures remain by design: missing `showH1` implementation, missing legal page modules, and placeholder Footer hrefs.

## Known Stubs

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required in Plan 16-01.

## Next Phase Readiness

Ready for 16-02. Plan 16-02 should turn `terms-markdown.test.tsx` and `metadata.test.ts` behavioral status from `⏳ behavior` to `✅ behavior` while keeping Footer tests RED until Plan 16-03.

## Self-Check: PASSED

- Created test files verified on disk.
- SUMMARY file verified on disk.
- Task commits verified in git log: `330f764`, `0b1e733`, `79b21f2`.
- No tracked file deletions were introduced by task commits.

---
*Phase: 16-legal-pages-launch-url*
*Completed: 2026-04-28*
