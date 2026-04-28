---
phase: 16-legal-pages-launch-url
reviewed: 2026-04-28T07:14:13Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/web/app/legal/__tests__/metadata.test.ts
  - apps/web/app/legal/layout.tsx
  - apps/web/app/legal/marketing/page.tsx
  - apps/web/app/legal/privacy/page.tsx
  - apps/web/app/legal/terms/page.tsx
  - apps/web/components/auth/signup-step2.tsx
  - apps/web/components/layout/__tests__/footer.test.tsx
  - apps/web/components/layout/footer.tsx
  - apps/web/components/legal/__tests__/terms-markdown.test.tsx
  - apps/web/components/legal/terms-markdown.tsx
  - apps/web/content/legal/marketing-consent.md
  - apps/web/content/legal/privacy-policy.md
  - apps/web/content/legal/terms-of-service.md
  - apps/web/env.d.ts
  - apps/web/next.config.ts
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-28T07:14:13Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

지정된 legal page, signup 약관 dialog, footer, markdown renderer, env/config 파일을 standard depth로 검토했습니다. 공개 legal content에 placeholder가 남아 있고, 실제 SMS provider와 privacy disclosure가 불일치하며, 기본 build/test 환경에서 legal pages가 `noindex`로 생성되는 문제가 확인되었습니다.

검증 중 `pnpm --filter @grabit/web test -- app/legal/__tests__/metadata.test.ts components/legal/__tests__/terms-markdown.test.tsx components/layout/__tests__/footer.test.tsx`는 metadata test 3건 실패로 exit 1을 반환했습니다. `pnpm --filter @grabit/web build`는 성공했지만, `GRABIT_ENV` 미설정 상태의 generated legal HTML은 `noindex, nofollow`를 포함했습니다.

## Critical Issues

### CR-01: [BLOCKER] 공개 legal 문서에 placeholder 사업자/시행일 값이 그대로 노출됨

**File:** `apps/web/content/legal/terms-of-service.md:75`, `apps/web/content/legal/privacy-policy.md:85`, `apps/web/content/legal/marketing-consent.md:32`

**Issue:** production에 그대로 배포되는 static legal pages와 signup consent dialog가 `[사업자명: 000]`, `[대표자명: 000]`, `[사업자등록번호: 000-00-00000]`, `[전화번호: 000-0000-0000]`, `[시행일: YYYY-MM-DD]` 같은 placeholder를 사용자에게 보여줍니다. 약관/개인정보처리방침/마케팅 동의는 회원가입 동의의 법적 근거가 되므로, placeholder 상태로 shipping하면 사용자가 실제 사업자, 책임자, 시행일을 확인할 수 없습니다.

**Fix:**
```markdown
- 사업자명: <실제 법인/상호명>
- 대표자명: <실제 대표자명>
- 사업자등록번호: <실제 사업자등록번호>
- 통신판매업 신고번호: <실제 신고번호>
- 사업장 주소: <실제 주소>
- 고객센터 전화번호: <실제 연락처>

**부칙**: 본 약관은 2026-MM-DD부터 시행됩니다.
```

실제 값으로 교체하고, legal markdown에 `YYYY-MM-DD`, `[.*000`, `[주소:` 같은 placeholder pattern이 남으면 실패하는 regression test를 추가하십시오.

### CR-02: [BLOCKER] 개인정보처리방침이 실제 SMS provider와 다른 Twilio를 고지함

**File:** `apps/web/content/legal/privacy-policy.md:47`, `apps/web/content/legal/privacy-policy.md:57`

**Issue:** privacy policy는 SMS 위탁/국외이전 수탁자를 `Twilio`로 고지하지만, 현재 backend SMS implementation은 `InfobipClient`와 `INFOBIP_*` 환경변수를 사용합니다. 사용자는 휴대전화번호가 실제로 이전/처리되는 업체가 아닌 다른 업체에 동의하게 되며, privacy disclosure와 runtime data flow가 불일치합니다.

**Fix:**
```markdown
- **SMS 발송**: Infobip — 휴대전화 인증 (국외 수탁 — 제6조 참조)

| Infobip | <이전 국가> | 휴대전화번호 | SMS 본인인증 OTP 발송 | <실제 보유·이용 기간> | 회원가입·재인증 시점, HTTPS API 전송 (TLS 1.2 이상) |
```

실제 계약 주체, 이전 국가, 보유 기간을 확인해 문서를 수정하거나, 구현을 Twilio로 되돌려 문서와 implementation을 일치시키십시오.

### CR-03: [BLOCKER] 기본 build/test 환경에서 legal pages가 `noindex`로 생성됨

**File:** `apps/web/app/legal/terms/page.tsx:16`, `apps/web/app/legal/privacy/page.tsx:8`, `apps/web/app/legal/marketing/page.tsx:8`, `apps/web/app/legal/__tests__/metadata.test.ts:45`

**Issue:** 세 legal page는 `process.env.GRABIT_ENV === 'production'`일 때만 `robots.index/follow`를 true로 설정합니다. 그런데 reviewed config/test scope에는 `GRABIT_ENV` 기본값 주입이 없고, metadata test도 env를 세팅하지 않습니다. 실제로 기본 환경에서 `pnpm --filter @grabit/web build`를 실행하면 `/legal/{terms,privacy,marketing}` HTML에 `noindex, nofollow`가 들어가고, metadata test는 `{ index: true, follow: true }` 기대값으로 3건 실패합니다. production build에서 env 주입이 누락되면 canonical legal pages가 검색엔진에 색인되지 않습니다.

**Fix:**
```ts
const isProd =
  process.env.GRABIT_ENV === 'production' ||
  (process.env.GRABIT_ENV == null && process.env.NODE_ENV === 'production');
```

또는 더 안전하게 `getLegalRobots()` helper를 만들고 deployment/test setup에서 `GRABIT_ENV=production`을 명시하십시오. `metadata.test.ts`는 production env를 set/reset한 뒤 module을 import하거나, production/non-production robots contract를 별도 case로 검증해야 합니다.

## Warnings

### WR-01: [WARNING] `react-markdown`의 `node` prop이 DOM attribute로 누출됨

**File:** `apps/web/components/legal/terms-markdown.tsx:18`

**Issue:** custom markdown component들이 `(props) => <h2 ... {...props} />` 형태로 모든 props를 DOM에 spread합니다. `react-markdown`은 renderer props에 AST `node`를 포함하므로 generated HTML에 `node="[object Object]"` 같은 invalid attribute가 붙습니다. build output에서도 legal page의 `h1`, `p`, `li` 등에 `node="[object Object]"`가 생성되는 것을 확인했습니다.

**Fix:**
```tsx
const stripNode = ({ node: _node, ...props }: Parameters<NonNullable<Components['p']>>[0]) => props;

p: ({ node: _node, ...props }) => (
  <p className="mt-2 text-caption leading-relaxed text-gray-700" {...props} />
),
h2: ({ node: _node, ...props }) => (
  <h2 className="mt-6 text-base font-semibold text-gray-900 first:mt-0" {...props} />
),
```

모든 DOM-rendering component에서 `node`를 제거하고 필요한 HTML props만 전달하십시오.

### WR-02: [WARNING] root `.env` parser가 dotenv 문법을 제대로 처리하지 못함

**File:** `apps/web/next.config.ts:10`

**Issue:** `next.config.ts`가 root `.env`를 직접 `split('\n')`/`indexOf('=')`로 파싱합니다. quoted value, inline comment, escaped newline/space 같은 일반적인 dotenv 문법을 처리하지 못하므로 `GRABIT_ENV="production"`처럼 작성하면 값이 `"production"`으로 들어가 robots 분기가 false가 됩니다. `NEXT_DEV_ALLOWED_ORIGINS`나 Sentry 설정도 같은 방식으로 잘못 읽힐 수 있습니다.

**Fix:**
```ts
import { loadEnvConfig } from '@next/env';
import { resolve } from 'path';

loadEnvConfig(resolve(__dirname, '../..'));
```

수동 parser를 제거하고 Next의 env loader 또는 `dotenv.config({ path: rootEnvPath })`를 사용하십시오.

---

_Reviewed: 2026-04-28T07:14:13Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
