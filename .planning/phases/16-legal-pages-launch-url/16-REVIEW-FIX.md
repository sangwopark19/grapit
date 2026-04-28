---
phase: 16-legal-pages-launch-url
fixed_at: 2026-04-28T07:31:49Z
review_path: .planning/phases/16-legal-pages-launch-url/16-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 3
skipped: 2
status: partial
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-04-28T07:31:49Z
**Source review:** `.planning/phases/16-legal-pages-launch-url/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 3
- Skipped: 2

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

## Skipped Issues

### CR-01: [BLOCKER] 공개 legal 문서에 placeholder 사업자/시행일 값이 그대로 노출됨

**File:** `apps/web/content/legal/terms-of-service.md:75`, `apps/web/content/legal/privacy-policy.md:85`, `apps/web/content/legal/marketing-consent.md:32`
**Reason:** skipped: actual legal/business identity data is not present in the repository. Replacing placeholders with inferred or synthetic 사업자명, 대표자명, 사업자등록번호, 통신판매업 신고번호, 주소, 전화번호, 개인정보 보호책임자, 시행일 would create false legal disclosures. Regression tests for placeholder removal would fail until the real values are supplied.
**Original issue:** production legal pages and signup consent dialog expose placeholder 사업자/시행일 values.

### CR-02: [BLOCKER] 개인정보처리방침이 실제 SMS provider와 다른 Twilio를 고지함

**File:** `apps/web/content/legal/privacy-policy.md:47`, `apps/web/content/legal/privacy-policy.md:57`
**Reason:** skipped: the codebase confirms the runtime SMS provider is Infobip, but the required privacy disclosure values are not available: exact contracting entity, transfer country, and retention period. Replacing Twilio with guessed Infobip legal details would still risk inaccurate overseas transfer disclosure. Human/legal input is required before editing the policy.
**Original issue:** privacy policy discloses Twilio while backend SMS implementation uses `InfobipClient` and `INFOBIP_*` env vars.

---

_Fixed: 2026-04-28T07:31:49Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
