---
slug: phase16-review-doc-fixes
date: 2026-04-28
status: complete
---

# Phase 16 review doc fixes

## Goal

Resolve review findings against Phase 16 cutover documentation without claiming unverifiable external legal facts.

## Tasks

1. Update `16-HUMAN-UAT.md` from placeholder replacement instructions to current-value legal/operator sign-off.
2. Replace the RSC-wide generic placeholder grep with focused source markdown and HTML artifact gates.
3. Split post-deploy `curl` status checks from body grep checks.
4. Update `16-REVIEW-FIX.md` and create `16-06-SUMMARY.md` with current status and remaining external sign-off.

## Verification

```bash
pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose
rm -rf apps/web/.next && GRABIT_ENV=production pnpm --filter @grabit/web build
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/content/legal/*.md
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/.next/server/app/legal -g '*.html'
```
