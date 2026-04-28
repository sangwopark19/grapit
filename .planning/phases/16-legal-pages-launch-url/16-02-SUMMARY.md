---
phase: 16-legal-pages-launch-url
plan: 02
subsystem: frontend
tags: [nextjs, app-router, legal-pages, metadata, vitest, turbopack]

requires:
  - phase: 16-legal-pages-launch-url
    provides: Wave 0 legal contract tests from Plan 16-01
provides:
  - Public `/legal/terms`, `/legal/privacy`, and `/legal/marketing` SSG routes
  - `TermsMarkdown showH1` rendering contract with dialog-compatible default
  - `*.md?raw` declaration and Turbopack raw-loader support
  - Production `index/follow` and non-production `noindex` robots metadata split
affects: [16-03, 16-04, 16-05, 16-06, legal-pages, launch-url]

tech-stack:
  added: []
  patterns:
    - Next App Router static legal pages with `dynamic = 'force-static'`
    - Vite/Turbopack-compatible markdown raw imports via `?raw`
    - Env-driven legal page robots metadata using `GRABIT_ENV`

key-files:
  created:
    - apps/web/app/legal/layout.tsx
    - apps/web/app/legal/terms/page.tsx
    - apps/web/app/legal/privacy/page.tsx
    - apps/web/app/legal/marketing/page.tsx
  modified:
    - apps/web/components/legal/terms-markdown.tsx
    - apps/web/env.d.ts
    - apps/web/next.config.ts

key-decisions:
  - "Legal page metadata keeps production indexing but forces non-production noindex through `process.env.GRABIT_ENV === 'production'`."
  - "`?raw` markdown imports are used for public legal pages while preserving existing `.md` imports for signup dialogs."

patterns-established:
  - "Public legal routes render markdown through `<TermsMarkdown showH1>` with no extra article/section wrapper."
  - "Build artifact verification checks both production `index, follow` and non-production `noindex` outputs."

requirements-completed: [D-01, D-02, D-09, D-10, D-11, D-12, D-13, D-14]

duration: 6min
completed: 2026-04-28
---

# Phase 16 Plan 02: Legal Static Pages Summary

**Static public legal pages backed by raw markdown imports, env-driven robots metadata, and dialog-safe H1 rendering**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T05:37:47Z
- **Completed:** 2026-04-28T05:43:38Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `/legal/terms`, `/legal/privacy`, and `/legal/marketing` as `force-static` App Router pages.
- Added the shared legal `<main>` container with `max-w-[760px]` reading width.
- Added `showH1?: boolean` to `TermsMarkdown`, defaulting to `false` for signup dialog compatibility.
- Added GFM table styling to `TermsMarkdown` for legal revision-history tables.
- Added `*.md?raw` type and Turbopack loader support while preserving existing `*.md` imports.
- Verified production builds output `index, follow`; non-production builds output `noindex`.

## Task Commits

Each task was committed atomically:

1. **Task 1: TermsMarkdown showH1 + md?raw support** - `63d3520` (feat)
2. **Task 2: legal layout + static pages** - `c3e4a18` (feat)
3. **Task 3: build artifact verification** - `62df76c` (chore, empty verification commit)

## Files Created/Modified

- `apps/web/components/legal/terms-markdown.tsx` - Adds `showH1` branching, preserves h2/h3/p/ul/ol/li/strong/a/hr mappings, and adds table element mappings.
- `apps/web/env.d.ts` - Adds `*.md?raw` module declaration and `ImportMeta.glob` typing needed by the Wave 0 metadata test.
- `apps/web/next.config.ts` - Adds the `*.md?raw` Turbopack raw-loader rule while preserving `*.md`.
- `apps/web/app/legal/layout.tsx` - Provides the shared legal page `<main>` container.
- `apps/web/app/legal/terms/page.tsx` - Publishes the terms page with canonical metadata and raw markdown content.
- `apps/web/app/legal/privacy/page.tsx` - Publishes the privacy page with canonical metadata and raw markdown content.
- `apps/web/app/legal/marketing/page.tsx` - Publishes the marketing consent page with canonical metadata and raw markdown content.

## Verification

- `pnpm --filter @grabit/web exec vitest run components/legal/__tests__/terms-markdown.test.tsx --reporter=verbose` → 5/5 passed.
- `GRABIT_ENV=production pnpm --filter @grabit/web exec vitest run app/legal/__tests__/metadata.test.ts --reporter=verbose` → 6/6 passed.
- `GRABIT_ENV=production pnpm --filter @grabit/web exec vitest run components/legal/__tests__/terms-markdown.test.tsx app/legal/__tests__/metadata.test.ts --reporter=verbose` → 11/11 passed.
- `pnpm --filter @grabit/web typecheck` → passed.
- `pnpm --filter @grabit/web lint` → exit 0 with 22 pre-existing warnings outside this plan.
- `rm -rf apps/web/.next && GRABIT_ENV=production pnpm --filter @grabit/web build` → passed; build output lists `○ /legal/terms`, `○ /legal/privacy`, `○ /legal/marketing`.
- `rm -rf apps/web/.next && pnpm --filter @grabit/web build` → passed; legal HTML contains `noindex`.
- Final clean production build restored `.next` to production state.

## Build Artifacts

Production build generated these primary legal route artifacts:

- `apps/web/.next/server/app/legal/terms.html`
- `apps/web/.next/server/app/legal/privacy.html`
- `apps/web/.next/server/app/legal/marketing.html`
- `apps/web/.next/server/app/legal/terms.rsc`
- `apps/web/.next/server/app/legal/privacy.rsc`
- `apps/web/.next/server/app/legal/marketing.rsc`

Artifact grep results after final production build:

| Check | Result |
|-------|--------|
| Legal HTML/RSC artifacts | 54 matches including standalone copies |
| `index, follow` in legal HTML | 6 matches |
| `rel="canonical"` in legal HTML | 6 matches |
| `name="robots"` in legal HTML | 6 matches |
| `이용약관` terms body | 2 matches |
| `개인정보처리방침` privacy body | 2 matches |
| `마케팅 수신 동의` marketing body | 2 matches |
| non-production `noindex` | 6 matches |
| `application/ld+json` under `apps/web/app/legal/` | 0 matches |

## Decisions Made

- Metadata tests were run with `GRABIT_ENV=production` because Plan 16-01 tests assert the production `index/follow` contract, while Plan 16-02 intentionally adds non-production `noindex`.
- The build verification covers both sides of that env split so preview/staging safety and production SEO behavior are both checked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `ImportMeta.glob` typing for Wave 0 metadata test**
- **Found during:** Task 1 (TermsMarkdown showH1 prop 추가 + env.d.ts/next.config.ts 보강)
- **Issue:** `pnpm --filter @grabit/web typecheck` failed because `apps/web/app/legal/__tests__/metadata.test.ts` uses `import.meta.glob`, but the project had no `ImportMeta.glob` type declaration.
- **Fix:** Added a minimal generic `ImportMeta.glob<T>()` declaration in `apps/web/env.d.ts`.
- **Files modified:** `apps/web/env.d.ts`
- **Verification:** `pnpm --filter @grabit/web typecheck` passed.
- **Committed in:** `63d3520`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required for the plan's typecheck gate and did not alter runtime behavior.

## Issues Encountered

- `next build` rewrote tracked `apps/web/next-env.d.ts` from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This generated change is outside plan ownership, so it was reverted after verification.
- `pnpm --filter @grabit/web lint` reports 22 existing warnings in unrelated files and exits 0. No new lint errors were introduced by this plan.

## Known Stubs

None. The `placeholder` text found by stub scan appears only in page comments explaining noindex protection and does not flow to UI rendering.

## Authentication Gates

None.

## User Setup Required

None for Plan 16-02. Plan 16-06 remains responsible for final production cutover details such as `GRABIT_ENV=production` deployment configuration and placeholder replacement.

## Threat Flags

None. New public routes, build-time markdown import, server/client boundary, and crawler-facing SSG output were already covered by the plan threat model.

## Next Phase Readiness

Ready for Plan 16-03. The Footer tests remain expected RED until that plan replaces placeholder footer links.

## Self-Check: PASSED

- Created/modified files verified on disk.
- SUMMARY file verified on disk.
- Task commits verified in git log: `63d3520`, `c3e4a18`, `62df76c`.
- No tracked file deletions were introduced by task commits.

---
*Phase: 16-legal-pages-launch-url*
*Completed: 2026-04-28*
