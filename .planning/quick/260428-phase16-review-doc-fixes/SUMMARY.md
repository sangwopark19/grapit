---
slug: phase16-review-doc-fixes
date: 2026-04-28
status: complete
commit: pending
---

# SUMMARY: Phase 16 review doc fixes

## Changes

- Rewrote `16-HUMAN-UAT.md` around current legal markdown values and explicit external sign-off.
- Replaced the false-positive-prone RSC-wide generic bracket gate with source markdown + `*.html` focused placeholder gates.
- Split `curl -fsSI` status checks from `curl -fsS ... | grep -F` body checks.
- Updated `16-REVIEW-FIX.md` to reflect that CR-01/CR-02 are fixed in code/docs but still require external legal/operator sign-off.
- Added `16-06-SUMMARY.md` with automated verification results and remaining manual UAT.

## Verification

- `pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose` → pass, 6 tests
- `rm -rf apps/web/.next && GRABIT_ENV=production pnpm --filter @grabit/web build` → pass
- Source markdown placeholder/Twilio gates → pass
- HTML build artifact placeholder/Twilio gates → pass
- Robots/canonical HTML checks → pass
- JSON-LD and LegalDraftBanner absence gates → pass

## Remaining Gate

Production cutover remains pending until the user/operator completes legal factual sign-off and mailbox receipt verification in `16-HUMAN-UAT.md`.
