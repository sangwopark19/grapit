---
phase: 16-legal-pages-launch-url
status: human_needed
verified_at: 2026-04-28T17:41:00+09:00
verifier: codex
branch: gsd/phase-16-legal-pages-launch-url-pr
---

# Phase 16 Verification

## Verdict

Automated repository verification passed on the clean Phase 16 PR branch.

Production cutover still requires human/operator approval because Codex cannot verify external legal and operational facts:

- business registration and e-commerce disclosure values
- Infobip contracting entity, transfer country, and retention period
- `support@heygrabit.com` and `privacy@heygrabit.com` mailbox receipt
- final production cutover date

## Automated Checks

- `pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose` -> pass, 6 tests
- `rm -rf apps/web/.next && GRABIT_ENV=production pnpm --filter @grabit/web build` -> pass
- Source markdown focused placeholder gate -> pass
- Source markdown legacy placeholder/Twilio gate -> pass
- Production HTML focused placeholder gate -> pass
- Production HTML legacy placeholder/Twilio gate -> pass
- Robots `index, follow` HTML matches -> 6
- Canonical HTML matches -> 6
- JSON-LD absence gate -> pass
- `LegalDraftBanner` source/build absence gate -> pass

## Remaining Human Gate

Before merge or production cutover, complete the pending items in `16-HUMAN-UAT.md`:

- UAT-1a through UAT-1d legal factual sign-off
- UAT-3 and UAT-4 mailbox receipt verification
- UAT-5 through UAT-12 post-deploy URL, footer, and signup dialog smoke checks after deployment

## Ship Guidance

Create the PR as draft or keep it blocked until the human/operator gates above are completed.
