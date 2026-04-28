---
phase: 16-legal-pages-launch-url
plan: 04
subsystem: content
tags: [legal-pages, markdown, placeholders, compliance, nextjs]

requires:
  - phase: 16-legal-pages-launch-url
    provides: Public legal SSG pages and raw markdown rendering from Plan 16-02
provides:
  - Legal markdown placeholders for business identity, privacy officer, revision history, and effective dates
  - Bracket-format grep gates for Plan 16-06 cutover checks
  - Build artifact proof that legal page markdown content is inlined into prerendered output
affects: [16-06, legal-pages, launch-url, human-uat]

tech-stack:
  added: []
  patterns:
    - "[라벨: 임시값] bracket placeholders in legal markdown"
    - "GFM revision-history table in privacy-policy.md"

key-files:
  created:
    - .planning/phases/16-legal-pages-launch-url/16-04-SUMMARY.md
  modified:
    - apps/web/content/legal/terms-of-service.md
    - apps/web/content/legal/privacy-policy.md
    - apps/web/content/legal/marketing-consent.md

key-decisions:
  - "Privacy KOPICO heading verification preserved the existing protected `개인정보의 처리 목적` H2 instead of changing 1~9조 for an over-specific grep."

patterns-established:
  - "Cutover placeholders use `[라벨: 임시값]` so later grep gates can detect unreplaced legal values."
  - "Legal revision history uses a GFM table rendered by the existing markdown pipeline."

requirements-completed: [D-06, D-07, D-08]

duration: 5min
completed: 2026-04-28
---

# Phase 16 Plan 04: Legal Placeholder Content Summary

**Legal markdown now exposes launch-cutover placeholders for business identity, privacy officer details, revision history, and effective dates**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-28T05:56:49Z
- **Completed:** 2026-04-28T06:01:35Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added 7 terms placeholders for business identity/contact and effective date.
- Added privacy officer placeholders, a GFM revision-history table, and effective-date placeholders.
- Replaced marketing consent's hardcoded effective date with a bracket placeholder.
- Verified markdown placeholders are inlined into prerendered legal page artifacts after `pnpm --filter @grabit/web build`.

## Task Commits

Each task was committed atomically:

1. **Task 1: terms business identity + effective date placeholders** - `faf78c5` (feat)
2. **Task 2: privacy officer + revision history placeholders** - `b844328` (feat)
3. **Task 3: marketing consent effective date placeholder** - `00de1ce` (feat)

**Plan metadata:** pending final docs commit.

## Files Created/Modified

- `apps/web/content/legal/terms-of-service.md` - Expands 제15조 with business identity/contact placeholders and replaces the terms effective date.
- `apps/web/content/legal/privacy-policy.md` - Expands 제10조 privacy officer information, adds 제11조 revision history table, and replaces the policy effective date.
- `apps/web/content/legal/marketing-consent.md` - Replaces the consent effective date while preserving the 5 existing H2 sections.
- `.planning/phases/16-legal-pages-launch-url/16-04-SUMMARY.md` - Execution summary and verification record.

## Verification

- `grep -cE '\[(사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|시행일):' apps/web/content/legal/terms-of-service.md` -> `7`
- `grep -cE '\[(보호책임자 실명|직책|전화번호|시행일|직전 시행일):' apps/web/content/legal/privacy-policy.md` -> `6`
- `grep -cE '\[시행일:' apps/web/content/legal/marketing-consent.md` -> `1`
- `grep -hEo '\[[가-힣 ]+: [^]]+\]' apps/web/content/legal/*.md | wc -l` -> `14`
- `grep -rF '2026년 4월 14일부터' apps/web/content/legal/` -> `0`
- `pnpm --filter @grabit/web build` -> passed.

## Build Artifacts

After the build, prerendered legal artifacts existed for all three public routes:

- `apps/web/.next/server/app/legal/terms.html`
- `apps/web/.next/server/app/legal/privacy.html`
- `apps/web/.next/server/app/legal/marketing.html`
- `apps/web/.next/server/app/legal/terms.rsc`
- `apps/web/.next/server/app/legal/privacy.rsc`
- `apps/web/.next/server/app/legal/marketing.rsc`

Artifact placeholder grep results:

| Route | Placeholder matches |
|-------|---------------------|
| `/legal/terms` | 29 |
| `/legal/privacy` | 24 |
| `/legal/marketing` | 4 |

The artifacts also contained the expected legal body text: `이용약관`, `개인정보처리방침`, and `마케팅 수신 동의`.

## Decisions Made

- Preserved the existing privacy 제1조 heading `개인정보의 처리 목적` because Task 2 explicitly forbids changing 1~9조. The plan's first KOPICO grep expected `수집·이용 목적`, so verification used the preserved `처리 목적` heading plus the remaining six KOPICO area greps.

## Deviations from Plan

### Auto-handled Issues

**1. [Rule 3 - Blocking] Over-specific KOPICO heading grep conflicted with protected content**
- **Found during:** Task 2 (privacy-policy.md 보호책임자 확장 + 개정 이력 표)
- **Issue:** The exact acceptance grep `^## 제[0-9]+조 \(.*수집·이용 목적` failed because the existing protected H2 is `## 제1조 (개인정보의 처리 목적)`.
- **Fix:** Kept 1~9조 unchanged and verified the same KOPICO area with `^## 제[0-9]+조 \(.*처리 목적`, then verified the other six standard areas unchanged.
- **Files modified:** None beyond the planned Task 2 privacy edits.
- **Verification:** `preserved_processing_purpose_heading=PASS`; `remaining_kopico_greps=PASS`.
- **Committed in:** `b844328`

---

**Total deviations:** 1 auto-handled (1 blocking verification mismatch)
**Impact on plan:** The content contract was preserved; no extra legal clauses or headings were changed.

## Issues Encountered

- `next build` rewrote tracked `apps/web/next-env.d.ts` from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This generated ownership-outside change was reverted after build verification.
- During Task 2 editing, an initial patch left the old `Grabit 대표` line in place. The line was removed before verification and before the task commit.

## Known Stubs

These are intentional legal cutover placeholders required by this plan and must be replaced before production cutover:

| File | Lines | Reason |
|------|-------|--------|
| `apps/web/content/legal/terms-of-service.md` | 75-80, 85 | Business identity/contact and terms effective date await user-provided registration values. |
| `apps/web/content/legal/privacy-policy.md` | 85-88, 97-98, 102 | Privacy officer details, revision dates, and policy effective date await cutover values. |
| `apps/web/content/legal/marketing-consent.md` | 32 | Marketing consent effective date awaits cutover date. |

## Authentication Gates

None.

## Threat Flags

None. The markdown-to-build-artifact placeholder surface was already covered by T-16-02 in the plan threat model.

## HUMAN-UAT Cutover Prereqs

- Replace `[사업자명: 000]`, `[대표자명: 000]`, `[사업자등록번호: 000-00-00000]`, `[통신판매업 신고번호: 제0000-서울강남-00000호]`, `[주소: 서울특별시 ...]`, and `[전화번호: 02-0000-0000]` with registered business values.
- Replace all `[시행일: YYYY-MM-DD]` tokens with the final production cutover date.
- Replace `[보호책임자 실명: 000]`, `[직책: 대표]`, `[전화번호: 000-0000-0000]`, and `[직전 시행일: 2026년 4월 14일]` as appropriate before Plan 16-06 cutover.
- Confirm Plan 16-06 build artifact grep fails if any `[라벨: 임시값]` token remains in `apps/web/.next/server/app/legal/`.

## User Setup Required

Business registration values, privacy officer details, and final cutover dates must be supplied by the user before production deployment. No external service authentication was needed for this plan.

## Next Phase Readiness

Ready for Plan 16-05. Plan 16-06 can use the bracket placeholder pattern to block production cutover until all legal placeholders are replaced.

## Self-Check: PASSED

- Created/modified files verified on disk.
- SUMMARY file verified on disk.
- Task commits verified in git log: `faf78c5`, `b844328`, `00de1ce`.
- No tracked file deletions were introduced by task commits.

---
*Phase: 16-legal-pages-launch-url*
*Completed: 2026-04-28*
