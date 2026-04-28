---
phase: 16-legal-pages-launch-url
fixed_at: 2026-04-28T07:31:49Z
updated_at: 2026-04-28T08:35:00Z
review_path: .planning/phases/16-legal-pages-launch-url/16-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: external_signoff_pending
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-04-28T07:31:49Z
**Source review:** `.planning/phases/16-legal-pages-launch-url/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed in code/docs: 5
- External sign-off pending: CR-01/CR-02 legal factual verification

## Fixed Issues

### CR-03: [BLOCKER] 기본 build/test 환경에서 legal pages가 `noindex`로 생성됨

**Status:** fixed: requires human verification
**Files modified:** `apps/web/app/legal/robots.ts`, `apps/web/app/legal/terms/page.tsx`, `apps/web/app/legal/privacy/page.tsx`, `apps/web/app/legal/marketing/page.tsx`, `apps/web/app/legal/__tests__/metadata.test.ts`
**Commit:** `6d27542`
**Applied fix:** legal robots 판정을 `getLegalRobots()` helper로 모으고, `GRABIT_ENV`가 없더라도 `NODE_ENV=production`이면 `index/follow`를 허용하도록 변경했습니다. Metadata test는 production env를 명시하고 production fallback/preview noindex contract를 추가했습니다.
**Verification:**
- `pnpm --filter @grabit/web exec tsc --noEmit --pretty false` → exit 0
- `pnpm --filter @grabit/web exec vitest run app/legal/__tests__/metadata.test.ts` → exit 0, 8 tests passed

### WR-01: [WARNING] `react-markdown`의 `node` prop이 DOM attribute로 누출됨

**Status:** fixed
**Files modified:** `apps/web/components/legal/terms-markdown.tsx`, `apps/web/components/legal/__tests__/terms-markdown.test.tsx`
**Commit:** `c409d25`
**Applied fix:** 모든 DOM-rendering markdown component에서 `node` prop을 제거하고 나머지 props만 DOM에 전달하도록 변경했습니다. `[node]` attribute 누출 회귀 test를 추가했습니다.
**Verification:**
- `pnpm --filter @grabit/web exec tsc --noEmit --pretty false` → exit 0
- `pnpm --filter @grabit/web exec vitest run components/legal/__tests__/terms-markdown.test.tsx` → exit 0, 6 tests passed

### WR-02: [WARNING] root `.env` parser가 dotenv 문법을 제대로 처리하지 못함

**Status:** fixed
**Files modified:** `apps/web/next.config.ts`, `apps/web/package.json`, `pnpm-lock.yaml`
**Commit:** `1e7b573`
**Applied fix:** 수동 `.env` parser를 제거하고 `@next/env`의 `loadEnvConfig(resolve(__dirname, '../..'))`로 monorepo root env를 로드하도록 변경했습니다. pnpm strict resolution을 위해 `@next/env@16.2.1`을 web dependency에 명시했습니다.
**Verification:**
- `pnpm install --frozen-lockfile --lockfile-only` → exit 0
- `pnpm --filter @grabit/web exec node -e "import('@next/env').then(() => console.log('ok')).catch((err) => { console.error(err.message); process.exit(1); })"` → exit 0
- `pnpm --filter @grabit/web exec tsc --noEmit --pretty false` → exit 0
- `pnpm --filter @grabit/web exec next info` → exit 0, config loaded; non-fatal npm/yarn/version warnings only

## Follow-up Issues Now Addressed in Code/Docs

### CR-01: [BLOCKER] 공개 legal 문서에 placeholder 사업자/시행일 값이 그대로 노출됨

**File:** `apps/web/content/legal/terms-of-service.md:75`, `apps/web/content/legal/privacy-policy.md:85`, `apps/web/content/legal/marketing-consent.md:32`
**Status:** fixed in markdown and regression tests; requires external operator/legal sign-off before production cutover
**Files modified:** `apps/web/content/legal/terms-of-service.md`, `apps/web/content/legal/privacy-policy.md`, `apps/web/content/legal/marketing-consent.md`, `apps/web/content/legal/__tests__/legal-content.test.ts`, `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md`
**Applied fix:** placeholder 사업자/시행일 값은 실제 markdown 값으로 치환되었고 `legal-content.test.ts`가 placeholder/Twilio 회귀를 차단한다. Codex는 사업자등록증/통신판매업 신고증/mailbox 운영 가능 여부를 외부에서 검증할 수 없으므로, `16-HUMAN-UAT.md`에 현재 markdown 값과 필요한 증빙을 명시하고 `pending operator sign-off` gate로 남겼다.
**Verification:**
- `pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose` → pass
- `! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/content/legal/*.md` → pass

### CR-02: [BLOCKER] 개인정보처리방침이 실제 SMS provider와 다른 Twilio를 고지함

**File:** `apps/web/content/legal/privacy-policy.md:47`, `apps/web/content/legal/privacy-policy.md:57`
**Status:** fixed in markdown and regression tests; requires external operator/legal sign-off before production cutover
**Files modified:** `apps/web/content/legal/privacy-policy.md`, `apps/web/content/legal/__tests__/legal-content.test.ts`, `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md`
**Applied fix:** privacy policy no longer discloses Twilio and now discloses `Infobip Limited 및 그 계열사` with country/retention details. `legal-content.test.ts` asserts Twilio is absent and Infobip disclosure is present. Because exact contracting entity, transfer country, and retention period depend on external Infobip/legal records, `16-HUMAN-UAT.md` requires operator sign-off before production cutover.
**Verification:**
- `pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose` → pass
- `! rg -n 'Twilio' apps/web/content/legal/*.md` → pass

## Review Follow-up Fixes

### RF-01: HUMAN-UAT가 placeholder 치환 전 상태로 남아 있음

**Status:** fixed
**Files modified:** `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md`
**Applied fix:** UAT를 "placeholder 치환" 체크리스트에서 "현재 markdown 값의 증빙 대조 + operator sign-off" 체크리스트로 갱신했다. Cutover Approval은 실제 외부 검증 전까지 `pending external legal/operator sign-off`로 유지한다.

### RF-02: build artifact generic bracket regex가 Next RSC output에서 false positive 발생

**Status:** fixed
**Files modified:** `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md`, `.planning/phases/16-legal-pages-launch-url/16-06-PLAN.md`
**Applied fix:** `.rsc` 전체 generic regex gate를 제거하고 source markdown + `*.html` prerender output에 focused placeholder label regex를 적용하도록 문서화했다.

### RF-03: `curl -sI`로 본문 검증을 안내함

**Status:** fixed
**Files modified:** `.planning/phases/16-legal-pages-launch-url/16-HUMAN-UAT.md`
**Applied fix:** status 검증(`curl -fsSI`)과 body grep(`curl -fsS ... | grep -F`)을 분리했다.

---

_Fixed: 2026-04-28T07:31:49Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
