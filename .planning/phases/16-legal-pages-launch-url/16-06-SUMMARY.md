---
phase: 16-legal-pages-launch-url
plan: 06
status: pending_external_signoff
updated: 2026-04-28
cutover_date: 2026-04-28
commit: pending
---

# Phase 16-06 Summary — Cutover Gate Status

## Current Status

Phase 16 runtime implementation is ready from an automated build/test perspective, but production cutover is still blocked on external legal/operator sign-off.

Codex verified repository and build artifacts only. Codex did not verify external documents such as 사업자등록증, 통신판매업 신고증, Infobip contract/console settings, or mailbox ownership.

## Legal Values Requiring Operator Sign-Off

| Area | Current markdown value | Required evidence | Status |
|------|------------------------|-------------------|--------|
| Business identity | `(주)아이콘스`, `정승준`, `109-86-27576` | 사업자등록증 | pending |
| E-commerce disclosure | `2025-서울마포-1494`, `서울특별시 마포구 월드컵로8길 69` | 통신판매업 신고증 | pending |
| Contact channels | `02-325-179`, `support@heygrabit.com`, `privacy@heygrabit.com` | 전화/mailbox 수신 검증 | pending |
| Privacy officer | `정승준`, `대표`, `02-325-179` | 내부 지정/운영자 확인 | pending |
| SMS overseas transfer | `Infobip Limited 및 그 계열사`, `독일 (Germany)`, `발송일로부터 3개월` | Infobip 계약/콘솔/법무 검토 | pending |
| Effective date | `2026-04-28` | 실제 prod cutover 일자 | pending |

## Automated Verification

Executed on 2026-04-28:

- Source placeholder/Twilio gate: pass
- `pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose`: pass, 6 tests
- `rm -rf apps/web/.next && GRABIT_ENV=production pnpm --filter @grabit/web build`: pass
- HTML placeholder/Twilio gate on `apps/web/.next/server/app/legal -g '*.html'`: pass
- Robots `index, follow` HTML matches: 6 including standalone duplicate output
- Canonical HTML matches: 6 including standalone duplicate output
- JSON-LD absence gate: pass
- `LegalDraftBanner` source absence gate: pass

## Gate Adjustment

The previous generic bracket regex over `apps/web/.next/server/app/legal/` was removed from the cutover instructions because Next 16 RSC segment files (`*.rsc`) create false positives unrelated to legal placeholders.

The active gate now checks:

```bash
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/content/legal/*.md
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/.next/server/app/legal -g '*.html'
```

## Remaining Manual UAT

- Complete `16-HUMAN-UAT.md` UAT-1a through UAT-1d legal factual sign-off.
- Verify `support@heygrabit.com` and `privacy@heygrabit.com` mailbox receipt.
- Confirm `GRABIT_ENV=production` is set in the production deploy/runtime path.
- Run post-deploy URL, footer, and signup dialog smoke checks.

## Review Follow-Up Mapping

| Review finding | Status |
|----------------|--------|
| P1 Legal factual sign-off required | Gated in `16-HUMAN-UAT.md`; pending external sign-off |
| P2 UAT docs stale after placeholder replacement | Fixed |
| P2 Generic placeholder gate false-positives on RSC output | Fixed with HTML-focused gate |
| P3 HEAD request used for body validation | Fixed by splitting status and body commands |
