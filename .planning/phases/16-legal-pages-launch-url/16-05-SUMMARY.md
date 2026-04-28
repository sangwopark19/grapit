---
phase: 16-legal-pages-launch-url
plan: 05
subsystem: legal
tags: [legal-pages, signup-dialog, human-uat, cutover, nextjs]

requires:
  - phase: 16-legal-pages-launch-url
    provides: Public legal pages from Plan 16-02 and bracket placeholders from Plan 16-04
provides:
  - LegalDraftBanner removal from signup legal dialogs
  - Dialog-safe TermsMarkdown usage verification
  - Phase 16 cutover HUMAN-UAT checklist with mailbox, placeholder, URL, Footer, and dialog gates
affects: [16-06, legal-pages, launch-url, human-uat]

tech-stack:
  added: []
  patterns:
    - "Prop-less `<TermsMarkdown>` remains the signup dialog compatibility contract."
    - "Cutover gates use generic bracket placeholder grep against `apps/web/.next/server/app/legal/`."

key-files:
  created:
    - .planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md
    - .planning/phases/16-legal-pages-launch-url/16-05-SUMMARY.md
  modified:
    - apps/web/components/auth/signup-step2.tsx
  deleted:
    - apps/web/components/legal/legal-draft-banner.tsx

key-decisions:
  - "Removed the draft banner completely instead of adding an environment flag, matching D-05."
  - "Kept signup dialogs on prop-less `<TermsMarkdown>` so DialogTitle remains the only visible title."
  - "Centralized cutover prerequisites in `16-HUMAN-UAT.md` instead of changing legal markdown placeholders in this plan."

patterns-established:
  - "Legal launch UAT tracks cutover prereqs separately from implementation tasks."
  - "Generic bracket regex `\\[[^]\\n]+:[^]\\n]+\\]` is the placeholder leak gate for legal build artifacts."

requirements-completed: [D-05, D-07, D-08, D-11, D-15]

duration: 6min
completed: 2026-04-28
---

# Phase 16 Plan 05: Legal Draft Removal and Cutover UAT Summary

**Signup legal dialogs no longer show the draft banner, and Phase 16 cutover now has a mailbox, placeholder, URL, Footer, and dialog UAT gate**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-28T06:08:06Z
- **Completed:** 2026-04-28T06:14:43Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Deleted `LegalDraftBanner` and removed its only import/JSX usage from `signup-step2`.
- Preserved `LEGAL_CONTENT`, checkbox flow, Dialog structure, handlers, and prop-less `<TermsMarkdown>` usage.
- Added `16-HUMAN-UAT.md` with cutover prereqs, mailbox checks, generic bracket placeholder gate, and post-deploy URL/Footer/dialog UAT.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove legal draft banner from signup dialog** - `7de7f75` (fix)
2. **Task 2: Verify signup legal dialog regression** - `34a1efe` (chore, empty verification commit)
3. **Task 3: Add legal launch human UAT checklist** - `37cf1b2` (docs)

**Plan metadata:** pending final docs commit.

## Files Created/Modified

- `apps/web/components/legal/legal-draft-banner.tsx` - Deleted; removed `AlertTriangle` draft notice surface and its `role="note"` announcement.
- `apps/web/components/auth/signup-step2.tsx` - Removed only the `LegalDraftBanner` import and JSX line; kept dialog rendering on `<TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>`.
- `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md` - Added UAT-1~UAT-13 with 26 checkbox items, automated placeholder grep gates, mailbox prereqs, post-deploy URL checks, Footer checks, and signup dialog visual regression items.
- `.planning/phases/16-legal-pages-launch-url/16-05-SUMMARY.md` - Execution summary and verification record.

## Verification

- `test ! -f apps/web/components/legal/legal-draft-banner.tsx` -> passed.
- `! grep -rE 'LegalDraftBanner|legal-draft-banner' apps/web --include='*.ts' --include='*.tsx'` -> passed.
- `grep -c 'import { TermsMarkdown }' apps/web/components/auth/signup-step2.tsx` -> `1`.
- `grep -c '<TermsMarkdown>' apps/web/components/auth/signup-step2.tsx` -> `1`.
- `! grep -E '<TermsMarkdown showH1' apps/web/components/auth/signup-step2.tsx` -> passed.
- `grep -F 'LEGAL_CONTENT' apps/web/components/auth/signup-step2.tsx | wc -l` -> `7`.
- `grep -F 'as const satisfies' apps/web/components/auth/signup-step2.tsx` -> passed.
- `grep -c '<Dialog ' apps/web/components/auth/signup-step2.tsx` -> `1`.
- `grep -c 'Checkbox' apps/web/components/auth/signup-step2.tsx` -> `5`.
- `git diff apps/web/components/booking/terms-agreement.tsx` -> empty.
- `git diff apps/web/components/auth/ | grep -F '+++ b/' | grep -v signup-step2` -> empty.
- `pnpm --filter @grabit/web exec vitest run components/legal/__tests__/terms-markdown.test.tsx --reporter=verbose` -> 5/5 passed.
- `pnpm --filter @grabit/web typecheck` -> passed.
- `pnpm --filter @grabit/web build` -> passed; `/legal/terms`, `/legal/privacy`, `/legal/marketing` remained static (`○`) routes.
- `pnpm --filter @grabit/web lint` -> exit 0 with 22 pre-existing warnings outside this plan.
- `grep -c '^- \[ \] \*\*UAT-' .planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md` -> `26`.
- `grep -F "grep -rE '\[[^]\n]+:[^]\n]+\]'" .planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md` -> passed.

## Decisions Made

- Removed `LegalDraftBanner` as a file deletion rather than a runtime flag because D-05 defines launch readiness as the draft surface disappearing from the codebase.
- Recorded Task 2 as an empty verification commit because the task intentionally had no file changes but the plan requires atomic task commits.
- Added focused grep gates alongside the generic bracket regex so cutover sign-off can catch both broad `[label: value]` leaks and high-risk legal placeholders.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `next build` rewrote tracked `apps/web/next-env.d.ts` from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This is a known generated Next.js change from earlier Phase 16 plans and is outside Plan 16-05 ownership, so it was restored after verification.
- `pnpm --filter @grabit/web lint` still reports 22 pre-existing warnings in unrelated files and exits 0. No new lint errors were introduced.
- `gsd-sdk query requirements.mark-complete D-05 D-07 D-08 D-11 D-15` returned `not_found` for all five IDs because Phase 16 uses D-IDs as locked decision/acceptance units, not entries in `.planning/REQUIREMENTS.md`.

## Known Stubs

| File | Lines | Reason |
|------|-------|--------|
| `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md` | 19-42, 46-70, 102 | Documentation-only placeholder examples and cutover gate instructions. These do not flow to UI rendering and are the purpose of the UAT checklist. |

## Authentication Gates

None.

## Threat Flags

None. This plan deleted a UI component, preserved an existing dialog render contract, and added planning/UAT documentation only. No new endpoint, auth path, file access pattern, or trust boundary was introduced beyond the plan threat model.

## User Setup Required

Before production cutover, the user must complete the UAT prereqs documented in `16-HUMAN-UAT.md`:

- Replace business identity, privacy officer, and effective-date placeholders with real values.
- Confirm `support@heygrabit.com` and `privacy@heygrabit.com` receive external mail.
- Run the automated build artifact grep gates and confirm 0 placeholder matches.
- Perform post-deploy URL, Footer, and signup dialog checks.

## Next Phase Readiness

Ready for Plan 16-06. The codebase no longer references `LegalDraftBanner`, and the cutover checklist is in place for final placeholder replacement and production URL verification.

## Self-Check: PASSED

- Created files verified on disk: `16-HUMAN-UAT.md`, `16-05-SUMMARY.md`.
- Modified file verified on disk: `apps/web/components/auth/signup-step2.tsx`.
- Intentional deletion verified on disk: `apps/web/components/legal/legal-draft-banner.tsx`.
- Task commits verified in git log: `7de7f75`, `34a1efe`, `37cf1b2`.
- No unexpected tracked file deletions were introduced beyond the planned `legal-draft-banner.tsx` deletion.

---
*Phase: 16-legal-pages-launch-url*
*Completed: 2026-04-28*
