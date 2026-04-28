# Phase 16: Legal pages launch — 이용약관/개인정보처리방침/마케팅동의 공개 URL 구현 - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 13 (4 신규 + 5 수정 + 1 삭제 + 3 신규 테스트)
**Analogs found:** 12 / 13 (1건은 콘텐츠 MD 보강만이라 코드 analog N/A)

> Source-of-truth 우선순위: `16-CONTEXT.md` D-01~D-15 → `16-UI-SPEC.md` (특히 §Layout container, §Component Inventory, §Page.tsx 패턴) → `16-RESEARCH.md` §Critical Code Patterns. 본 PATTERNS.md 는 **codebase 의 실재 analog 파일** 을 매핑해 plan 의 "어디서 베껴 올지" 를 명시한다.

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `apps/web/app/legal/layout.tsx` | NEW | route-layout (server) | static / wrapper-only | `apps/web/app/booking/[performanceId]/layout.tsx` | role-match (둘 다 minimal server-component layout) |
| `apps/web/app/legal/terms/page.tsx` | NEW | route-page (server, SSG) | static-import + render | `apps/web/app/layout.tsx` (metadata export) + UI-SPEC §Page.tsx 패턴 | partial (codebase 에 SSG `force-static` page.tsx analog 부재) |
| `apps/web/app/legal/privacy/page.tsx` | NEW | route-page (server, SSG) | static-import + render | 동상 | 동상 |
| `apps/web/app/legal/marketing/page.tsx` | NEW | route-page (server, SSG) | static-import + render | 동상 | 동상 |
| `apps/web/components/legal/terms-markdown.tsx` | MODIFY | client component (renderer) | prop-driven render | (self) `apps/web/components/legal/terms-markdown.tsx` 본문 + UI-SPEC §Typography H1 매핑 | exact (자기 자신 + spec) |
| `apps/web/components/auth/signup-step2.tsx` | MODIFY | client component (form) | dialog UX | (self, 부분 제거만) | exact (self-edit) |
| `apps/web/components/layout/footer.tsx` | MODIFY | server component (chrome) | static link list | (self) `apps/web/components/layout/footer.tsx` | exact (self-edit) |
| `apps/web/components/legal/legal-draft-banner.tsx` | DELETE | client component (banner) | — | — | N/A (삭제) |
| `apps/web/content/legal/terms-of-service.md` | MODIFY (content) | content asset | — | (self) | exact (self-edit) |
| `apps/web/content/legal/privacy-policy.md` | MODIFY (content) | content asset | — | (self) | exact (self-edit) |
| `apps/web/content/legal/marketing-consent.md` | MODIFY (content) | content asset | — | (self) | exact (self-edit) |
| `apps/web/components/legal/__tests__/terms-markdown.test.tsx` | NEW (test) | unit test | RTL render assertion | `apps/web/components/performance/__tests__/status-badge.test.tsx` | exact (둘 다 simple-prop component RTL test) |
| `apps/web/app/legal/__tests__/metadata.test.ts` | NEW (test) | unit test (module import) | re-export assertion | `apps/web/components/performance/__tests__/status-badge.test.tsx` (vitest skeleton) | partial (codebase 에 metadata-import test 선례 없음) |
| `apps/web/components/layout/__tests__/footer.test.tsx` | NEW (test) | unit test | RTL render + href grep | `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` | exact (둘 다 layout/* server-ish chrome 의 link href 테스트) |

---

## Pattern Assignments

### `apps/web/app/legal/layout.tsx` (route-layout, server, NEW — D-02)

**Analog 1:** `apps/web/app/booking/[performanceId]/layout.tsx` (전 파일 9 LOC, server component, no `'use client'`).

```tsx
// apps/web/app/booking/[performanceId]/layout.tsx (lines 1-9, 전 파일)
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">{children}</div>
  );
}
```

**Analog 2 (negative — 따라 하지 말 것):** `apps/web/app/admin/layout.tsx` 는 `'use client'` + auth guard + sidebar 를 가진 무거운 layout. 본 phase 의 layout 은 그 반대 방향(server, container-only).

**무엇을 베낄 것:**
- Function signature `({ children }: { children: React.ReactNode })` 동일.
- `'use client'` 미부착 = server component.
- 단일 wrapper 엘리먼트 + `{children}`. 본 phase 는 `<div>` 대신 **`<main>`** 사용 (UI-SPEC §Layout Contract: root layout 에 `<main>` 없음 → legal layout 이 main landmark 책임).

**무엇을 바꿀 것 (UI-SPEC §Layout container exact values + RESEARCH §Critical Code Patterns L293-303):**
```tsx
// 최종 형태 (UI-SPEC L264-272 + RESEARCH L293-304)
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-16 md:px-6 md:pt-12 md:pb-24">
      {children}
    </main>
  );
}
```

**금지 (UI-SPEC §Component Inventory + §Layout Contract):**
- `'use client'` 부착 금지.
- `force-static` / `Metadata` export 금지 (page.tsx 책임).
- breadcrumb / back-link / wrapper card 추가 금지.
- root `apps/web/app/layout.tsx` 의 `<Providers>`/`<LayoutShell>` 내용 중복 렌더 금지 — Header/Footer 는 자동 상속.

---

### `apps/web/app/legal/terms/page.tsx` (route-page, server, SSG, NEW — D-01, D-10, D-13)

**Analog 1 (Metadata export 패턴):** `apps/web/app/layout.tsx` — codebase 에서 유일한 `Metadata` export 보유 파일.

```tsx
// apps/web/app/layout.tsx (lines 1, 10-13)
import type { Metadata } from 'next';
// ...
export const metadata: Metadata = {
  title: 'Grabit - 공연 티켓 예매',
  description: '공연, 전시, 스포츠 등 라이브 엔터테인먼트 티켓 예매 플랫폼',
};
```

**Analog 2 (server component import 패턴):** `apps/web/components/auth/signup-step2.tsx` (lines 15-19) — MD raw-loader import + TermsMarkdown 호출.

```tsx
// apps/web/components/auth/signup-step2.tsx (lines 15-19)
import termsOfServiceMd from '@/content/legal/terms-of-service.md';
import privacyPolicyMd from '@/content/legal/privacy-policy.md';
import marketingConsentMd from '@/content/legal/marketing-consent.md';
import { LegalDraftBanner } from '@/components/legal/legal-draft-banner';
import { TermsMarkdown } from '@/components/legal/terms-markdown';
```

**Analog 3 (raw-loader 매핑 활성화 확인):** `apps/web/next.config.ts` (lines 44-49):
```ts
turbopack: {
  root: resolve(__dirname, '../../'),
  rules: {
    '*.md': { as: '*.js', loaders: ['raw-loader'] },
  },
},
```
→ `import md from '@/content/legal/*.md'` 는 server component 에서도 동일하게 string 반환. **변경 금지.**

**Analog 4 (codebase 에 force-static page 부재):** Glob `apps/web/app/**/page.tsx` 18개 중 `force-static` / `force-dynamic` 명시 0건. 따라서 **Phase 16 이 codebase 최초의 SSG 명시 사례**. RESEARCH §Critical Code Patterns L310-335 + UI-SPEC §Page.tsx 패턴 L284-306 을 SoT 로 사용.

**무엇을 베낄 것 (UI-SPEC §Page.tsx 패턴 + RESEARCH §Critical Code Patterns 그대로):**
```tsx
// /legal/terms/page.tsx 최종 형태 (UI-SPEC L284-306, RESEARCH L312-334)
import type { Metadata } from 'next';
import termsMd from '@/content/legal/terms-of-service.md';
import { TermsMarkdown } from '@/components/legal/terms-markdown';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: '이용약관 — Grabit',
  description: 'Grabit 서비스 이용 조건과 회원·회사의 권리·의무를 안내합니다.',
  alternates: {
    canonical: 'https://heygrabit.com/legal/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  return <TermsMarkdown showH1>{termsMd}</TermsMarkdown>;
}
```

**3개 page.tsx 차이 (UI-SPEC §Copywriting Contract L201-210):**
| File | `import` | `title` | `description` | `canonical` |
|------|---------|--------|---------------|-------------|
| `terms/page.tsx` | `terms-of-service.md → termsMd` | `이용약관 — Grabit` | `Grabit 서비스 이용 조건과 회원·회사의 권리·의무를 안내합니다.` | `https://heygrabit.com/legal/terms` |
| `privacy/page.tsx` | `privacy-policy.md → privacyMd` | `개인정보처리방침 — Grabit` | `Grabit이 수집·이용하는 개인정보 항목과 처리 목적, 보유 기간 및 이용자의 권리를 안내합니다.` | `https://heygrabit.com/legal/privacy` |
| `marketing/page.tsx` | `marketing-consent.md → marketingMd` | `마케팅 정보 수신 동의 — Grabit` | `Grabit이 발송하는 마케팅 정보의 수신 항목, 전송 수단, 동의 거부 권리를 안내합니다.` | `https://heygrabit.com/legal/marketing` |

**금지 (UI-SPEC §Page.tsx 패턴 + §Out-of-Scope):**
- `'use client'` 부착 금지 (server component 유지).
- `<article>` / `<section>` wrapper 추가 금지 — TermsMarkdown 직접 렌더.
- "마지막 수정일" 별도 chrome 추가 금지 — MD 본문 부칙 활용.
- JSON-LD 추가 금지 (D-14).
- breadcrumb / back-link / TOC / anchor id 자동 생성 금지.

---

### `apps/web/components/legal/terms-markdown.tsx` (client component, MODIFY — D-09)

**Analog (self):** `apps/web/components/legal/terms-markdown.tsx` (전 파일 49 LOC, lines 1-49).

```tsx
// 현재 형태 (lines 1-14, 13 components 매핑 핵심)
'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: () => null,                                             // ← Phase 16 분기 대상
  h2: (props) => (
    <h2 className="mt-6 text-base font-semibold text-gray-900 first:mt-0" {...props} />
  ),
  // ... h3/p/ul/ol/li/strong/a/hr 매핑은 Phase 16 변경 금지
```

**기존 매핑 변경 금지 라인 (lines 15-41):** h2/h3/p/ul/ol/li/strong/a/hr 9개 — UI-SPEC §Typography 가 명시적으로 "변경 금지". dialog 회귀 위험.

**무엇을 바꿀 것 (UI-SPEC §Typography L91-119, RESEARCH §Critical Code Patterns L341-390):**
```tsx
// 최종 형태 (RESEARCH L350-390 그대로 + UI-SPEC L93-119)
'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const baseComponents: Components = {
  // 기존 9개 매핑 그대로 (h1 만 분리)
  h2: (props) => (<h2 className="mt-6 text-base font-semibold text-gray-900 first:mt-0" {...props} />),
  h3: (props) => (<h3 className="mt-4 text-caption font-semibold text-gray-800" {...props} />),
  p: (props) => (<p className="mt-2 text-caption leading-relaxed text-gray-700" {...props} />),
  ul: (props) => (<ul className="mt-2 ml-5 list-disc text-caption leading-relaxed text-gray-700" {...props} />),
  ol: (props) => (<ol className="mt-2 ml-5 list-decimal text-caption leading-relaxed text-gray-700" {...props} />),
  li: (props) => <li className="mt-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
  a: (props) => (
    <a className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
};

const buildComponents = (showH1: boolean): Components => ({
  ...baseComponents,
  h1: showH1
    ? (props) => (
        <h1 className="text-display font-semibold leading-[1.2] text-gray-900" {...props} />
      )
    : () => null,
});

export function TermsMarkdown({
  children,
  showH1 = false,
}: {
  children: string;
  showH1?: boolean;
}) {
  return (
    <ReactMarkdown components={buildComponents(showH1)} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
```

**핵심 계약:**
- **default `false`** — dialog 호출 `<TermsMarkdown>{md}</TermsMarkdown>` 호환. h1 → null.
- **`showH1` (boolean shorthand)** — page 호출 시 h1 → `text-display`.
- **H1 className 정확값:** `text-display font-semibold leading-[1.2] text-gray-900` (UI-SPEC §Typography L93-103).

---

### `apps/web/components/auth/signup-step2.tsx` (client component, MODIFY — D-05)

**Analog (self):** `apps/web/components/auth/signup-step2.tsx` (전 파일 196 LOC).

**제거할 라인 1 (line 18):**
```tsx
import { LegalDraftBanner } from '@/components/legal/legal-draft-banner';
```

**제거할 라인 2 (line 190):**
```tsx
        </DialogHeader>
        <LegalDraftBanner />                              // ← 이 줄만 제거
        <TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>
```

**유지할 것 (D-11 dialog UX 불변):**
- `LEGAL_CONTENT` 객체 (lines 30-34, `as const satisfies` 패턴 유지) — termsOfService/privacyPolicy/marketingConsent 3개 import 유지.
- `<TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>` 호출 형태 유지 — `showH1` prop 부착 **금지** (dialog 에서는 DialogTitle 이 이미 제목 역할, D-09 default false 시그니처와 정합).
- 동의 체크박스 / Dialog open state / 핸들러 / Button / Separator — 변경 금지.

**검증 패턴 (RESEARCH §Phase Requirements → Test Map D-11a):**
- `grep -E '<TermsMarkdown>' apps/web/components/auth/signup-step2.tsx` → 1건 매치 (showH1 부착 시 매치 0 — 회귀).
- `! grep -E 'LegalDraftBanner|legal-draft-banner' apps/web/components/auth/signup-step2.tsx` → 매치 0 (제거 검증).

---

### `apps/web/components/layout/footer.tsx` (server component, MODIFY — D-03)

**Analog (self):** `apps/web/components/layout/footer.tsx` (전 파일 29 LOC).

```tsx
// 현재 형태 (lines 1-29 전체)
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto min-h-[120px] bg-gray-100">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
          <Link href="#" className="hover:underline">                              {/* L9 */}
            이용약관
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="#" className="font-semibold hover:underline">                {/* L13 */}
            개인정보처리방침
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="#" className="hover:underline">                              {/* L17 */}
            고객센터
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          &copy; 2026 Grabit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

**Patch (UI-SPEC §Component Inventory diff L313-322 + D-03):**
```diff
- <Link href="#" className="hover:underline">이용약관</Link>
+ <Link href="/legal/terms" className="hover:underline">이용약관</Link>

- <Link href="#" className="font-semibold hover:underline">개인정보처리방침</Link>
+ <Link href="/legal/privacy" className="font-semibold hover:underline">개인정보처리방침</Link>

- <Link href="#" className="hover:underline">고객센터</Link>
+ <a href="mailto:support@heygrabit.com" className="hover:underline">고객센터</a>
```

**핵심 계약:**
- 3번째 링크는 `Link` (next/link) → `<a>` 로 컴포넌트 교체. `mailto:` 는 internal navigation 아님.
- `font-semibold` 클래스는 "개인정보처리방침" 에만 유지 (정통망법 강조 의무).
- `target="_blank"` / `rel` 부착 금지 (mailto:).
- 마케팅 수신 동의 (`/legal/marketing`) 는 Footer 노출 금지 (D-04).
- Copyright / `gap-2` / `text-gray-400` 구분자 / 배경색 / max-w-[1200px] — 변경 금지.

**Import 변경:**
- `Link` (next/link) — 유지 (2건 잔존).
- 추가 import 없음 (`<a>` 는 native).

---

### `apps/web/components/legal/legal-draft-banner.tsx` (DELETE — D-05)

**Analog:** N/A — 파일 자체 삭제.

**삭제 영향 (UI-SPEC §LegalDraftBanner 색상 소멸 + §접근성 소멸):**
- `lucide-react`/`AlertTriangle` import 1건 트리에서 제거.
- `bg-warning-surface` / `border-warning` / `text-[#8B6306]` 색상 사용처 -1.
- `role="note" aria-label="초안 안내"` SR announce 소멸 (D-05 명시적 의도).
- `globals.css` 의 `--color-warning-surface` 토큰은 다른 사용처가 있다면 유지 — 토큰 자체 제거 금지.

**제거 검증 (RESEARCH D-05a):**
- `! test -e apps/web/components/legal/legal-draft-banner.tsx` → 부재.

---

### `apps/web/content/legal/terms-of-service.md` (content asset, MODIFY — D-06, D-07)

**Analog (self):** 본문 78 LOC. Phase 16 은 본문 끝에 placeholder 섹션 추가만.

**보강할 placeholder (CONTEXT D-06):**
- 시행일: `**부칙**: 본 약관은 [시행일: YYYY-MM-DD] 부터 시행됩니다.` (D-08 cutover 일자로 후속 교체).
- 사업자명·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처 — `[사업자명: ...]`, `[대표자: ...]`, `[사업자등록번호: 000-00-00000]`, `[통신판매업신고: 제0000-...]`, `[사업장 주소: ...]`, `[고객센터 전화: ...]` 형태.

**검증 패턴 (RESEARCH D-06, D-07):**
- 본문 grep `\[(사업자명|대표자|사업자등록번호|통신판매업신고|시행일):` → 매치 (Wave 3).
- prod 빌드 산출물 grep `! grep -rE '\[.*:' apps/web/.next/server/app/legal/` → 매치 0 (Wave 5 cutover gate).

---

### `apps/web/content/legal/privacy-policy.md` (content asset, MODIFY — D-06)

**Analog (self):** 본문 93 LOC. L82-86 "개인정보 보호책임자: Grabit 대표" / L89 시행일 보강 대상.

**보강할 placeholder (CONTEXT D-06, RESEARCH §Implementation Approach Axis 3 L262-274):**
- 시행일: `**부칙**: 본 방침은 [시행일: YYYY-MM-DD] 부터 시행됩니다.`
- 직전 시행일 / 개정 이력 섹션 (RESEARCH L266-274 의 `### 개정 이력` 패턴):
  ```markdown
  ### 개정 이력
  - [YYYY-MM-DD]: 최초 시행
  ```
- 개인정보 보호책임자: `이름 [보호책임자 성명: ...]`, `직책 [보호책임자 직책: ...]`, `이메일 [privacy@heygrabit.com]` (이메일은 D-15 mailbox 와 정합), `전화 [...]`.

---

### `apps/web/content/legal/marketing-consent.md` (content asset, MODIFY — D-06)

**Analog (self):** 본문 32 LOC. 시행일 추가만.

**보강할 placeholder:**
- 본문 끝: `**부칙**: 본 동의 사항은 [시행일: YYYY-MM-DD] 부터 시행됩니다.`

---

### `apps/web/components/legal/__tests__/terms-markdown.test.tsx` (NEW unit test — D-09a/b)

**Analog 1:** `apps/web/components/performance/__tests__/status-badge.test.tsx` (전 파일 31 LOC).

```tsx
// status-badge.test.tsx (lines 1-15)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders correct label for selling status', () => {
    render(<StatusBadge status="selling" />);
    expect(screen.getByText('판매중')).toBeDefined();
  });
  // ...
});
```

**Analog 2 (className 검증 패턴):** `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` (lines 26-31):
```tsx
it('active tab uses primary color class when pathname matches href', () => {
  mockPathname.mockReturnValue('/');
  render(<MobileTabBar />);
  const homeLink = screen.getByText('홈').closest('a');
  expect(homeLink?.className).toContain('text-primary');
});
```

**무엇을 베낄 것:**
- `import { describe, it, expect } from 'vitest'` + `import { render, screen } from '@testing-library/react'` (codebase 표준 vitest+RTL 패턴).
- `render(<TermsMarkdown ...>{md}</TermsMarkdown>)` + `screen.getByText(...)` / `container.querySelector('h1')` 조합.
- className 검증은 mobile-tab-bar 의 `expect(el?.className).toContain(...)` 패턴 차용.

**테스트 케이스 매핑 (RESEARCH §Wave 0 Gaps):**
- D-09a: `it('default 시 h1 미렌더', () => { const { container } = render(<TermsMarkdown>{'# Title\n본문'}</TermsMarkdown>); expect(container.querySelector('h1')).toBeNull(); });`
- D-09b: `it('showH1 시 h1 렌더 + text-display 클래스', () => { const { container } = render(<TermsMarkdown showH1>{'# 이용약관'}</TermsMarkdown>); const h1 = container.querySelector('h1'); expect(h1?.textContent).toBe('이용약관'); expect(h1?.className).toContain('text-display'); expect(h1?.className).toContain('font-semibold'); });`
- (recommend) h2/p 매핑이 dialog/page 양쪽에서 동일하게 유지되는지 회귀 케이스 1건 추가.

**금지:**
- `'use client'` mock 금지 — TermsMarkdown 자체가 `'use client'` 이지만 vitest jsdom 환경에서 직접 render 가능 (codebase 의 다른 client component 테스트들도 동일 패턴).

---

### `apps/web/app/legal/__tests__/metadata.test.ts` (NEW unit test — D-13)

**Analog (partial):** codebase 에 page.tsx Metadata import 테스트 선례 없음. status-badge.test 의 vitest skeleton + Metadata API 의 plain-object 특성을 결합.

**무엇을 베낄 것:**
- `import { describe, it, expect } from 'vitest'` skeleton.
- TS path alias `@/app/legal/*/page` import (vitest config `apps/web/vitest.config.ts` alias 활성).

**테스트 케이스 매핑 (RESEARCH §Wave 0 Gaps + D-13):**
```ts
import { describe, it, expect } from 'vitest';
import { metadata as termsMetadata } from '@/app/legal/terms/page';
import { metadata as privacyMetadata } from '@/app/legal/privacy/page';
import { metadata as marketingMetadata } from '@/app/legal/marketing/page';

describe('Legal pages metadata', () => {
  it('terms metadata 매치', () => {
    expect(termsMetadata.title).toBe('이용약관 — Grabit');
    expect(termsMetadata.alternates?.canonical).toBe('https://heygrabit.com/legal/terms');
    expect(termsMetadata.robots).toMatchObject({ index: true, follow: true });
  });
  // privacy / marketing 동일 패턴
});
```

**주의 (RESEARCH §Wave 0 Gaps L576):** Next 16 server-component page.tsx 를 vitest 에서 직접 render 는 어려움. **export 된 `metadata` 객체만 검증** 하고 `export default function` 자체는 build-artifact grep (D-10b) 으로 위임.

**금지:**
- `dynamic = 'force-static'` 의 효과를 vitest 에서 검증 시도 금지 — 빌드 아티팩트 검증으로 위임 (RESEARCH D-10a).

---

### `apps/web/components/layout/__tests__/footer.test.tsx` (NEW unit test — D-03)

**Analog:** `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` (lines 1-50, 동일 디렉토리).

```tsx
// mobile-tab-bar.test.tsx (lines 40-44)
it('category tab has href="/genre/musical"', () => {
  render(<MobileTabBar />);
  const categoryLink = screen.getByText('카테고리').closest('a');
  expect(categoryLink?.getAttribute('href')).toBe('/genre/musical');
});
```

**무엇을 베낄 것:**
- `screen.getByText('이용약관').closest('a')` → `getAttribute('href')` 검증 패턴.
- 3개 링크 (`이용약관`, `개인정보처리방침`, `고객센터`) 각각 href 매치 케이스 1건씩.

**테스트 케이스 매핑 (RESEARCH D-03, D-04):**
- `이용약관` href === `/legal/terms`.
- `개인정보처리방침` href === `/legal/privacy` + className contains `font-semibold`.
- `고객센터` href === `mailto:support@heygrabit.com`.
- D-04 회귀: `expect(screen.queryByText(/마케팅/)).toBeNull()` 또는 footer.tsx 텍스트에 `/legal/marketing` 미포함 확인.

**금지:**
- `next/link` mock 금지 — Footer 의 `<Link>` 는 jsdom 에서 native `<a>` 로 렌더 (mobile-tab-bar 가 mock 한 건 `usePathname` 뿐).

---

## Shared Patterns

### Server-component layout container

**Source:** `apps/web/app/booking/[performanceId]/layout.tsx` (전체)

**Apply to:** `apps/web/app/legal/layout.tsx`

**Convention:**
- 함수 시그니처 `({ children }: { children: React.ReactNode })` 또는 `({ children }: { children: ReactNode })` (양쪽 codebase 다 통용).
- `'use client'` 부착 금지.
- 단일 wrapper 엘리먼트 + `{children}`.
- root layout 의 `Header`/`Footer` 자동 상속 → 중복 렌더 금지.

### Static MD raw-loader import

**Source:** `apps/web/next.config.ts:46-49` + `apps/web/components/auth/signup-step2.tsx:15-17`

**Apply to:** 3개 page.tsx (`legal/{terms,privacy,marketing}/page.tsx`)

**Convention:**
```tsx
import termsMd from '@/content/legal/terms-of-service.md';
// → string 으로 import 됨 (Turbopack rule: '*.md' as '*.js' loaders ['raw-loader'])
```
- 빌드 시점에 inline 됨 → SSG 산출물에 그대로 포함.
- server component 에서도 동작 (signup-step2 는 client 였으나 page.tsx server 에서도 동일 패턴 동작 — RESEARCH §Critical Code Patterns 검증).

### Metadata export 패턴 (Next 16 App Router)

**Source:** `apps/web/app/layout.tsx:1, 10-13` (codebase 유일 사례)

**Apply to:** 3개 page.tsx

**Convention:**
- `import type { Metadata } from 'next';`
- `export const metadata: Metadata = {...};`
- Phase 16 신규 추가 키: `alternates.canonical`, `robots: { index, follow }` (D-13, D-12).

**Phase 16 의 codebase-first contribution:**
- `export const dynamic = 'force-static'` — codebase 최초. 18개 기존 page.tsx 중 `force-static`/`force-dynamic` 명시 0건. RESEARCH §Tech Stack Verification 의 Context7 검증을 SoT 로 사용.

### shadcn/Tailwind 토큰 재사용 (신규 토큰 도입 금지)

**Source:** `apps/web/app/globals.css:5-67` (@theme 블록)

**Apply to:** layout container, TermsMarkdown H1, Footer

**Convention (UI-SPEC §Spacing/Typography/Color):**
- spacing: `xs(4)/sm(8)/md(16)/lg(24)/xl(32)/2xl(48)/3xl(64)` 8-point grid 토큰만.
- typography: `text-display(28)/text-base(16)/text-caption(14)` semantic 토큰만 (`text-lg/xl/2xl` 도입 금지).
- color: `text-gray-{700,800,900}`, `text-primary`, `border-gray-200` 만 사용.
- font-weight: `font-semibold(600)` + default(400) 만 (`font-medium/bold` 금지).
- 절대값 허용 단 1건: `max-w-[760px]` (UI-SPEC §Layout container 의 reading-optimized width 결정 부산물).

### vitest + RTL 단위 테스트 skeleton

**Source:** `apps/web/components/performance/__tests__/status-badge.test.tsx` (전 파일 31 LOC) + `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` (lines 1-50)

**Apply to:** 3개 신규 테스트 파일

**Convention:**
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component } from '../component';

describe('Component', () => {
  it('렌더링 / className / href 검증', () => {
    render(<Component />);
    expect(screen.getByText('...').closest('a')?.getAttribute('href')).toBe('...');
  });
});
```
- `vi.mock('next/navigation', ...)` 은 필요한 경우(Footer 는 불필요)에만 — mobile-tab-bar 는 usePathname mock, Footer 는 mock 0건.
- `userEvent.setup()` 은 interaction 테스트(Phase 16 미해당)에서만 필요.
- 한국어 테스트 문구 일관성 — codebase 의 다른 테스트들이 한국어 it() name 혼용 (network-banner, mobile-tab-bar 참고).

### LEGAL_CONTENT 객체 보존 (D-11 dialog UX 불변)

**Source:** `apps/web/components/auth/signup-step2.tsx:30-36`

**Apply to:** signup-step2 의 LegalDraftBanner 제거 작업

**Convention:**
- `LEGAL_CONTENT` 객체 (`as const satisfies Record<string, ...>`) 변경 금지.
- 3개 MD import (terms / privacy / marketing) 변경 금지.
- `<TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>` 호출 형태 그대로 (showH1 부착 금지).
- D-11 의 dialog UX 불변은 회귀 테스트로 보장 (RESEARCH D-11a grep).

---

## No Analog Found

| File | Role | Reason | Mitigation |
|------|------|--------|------------|
| `apps/web/app/legal/{terms,privacy,marketing}/page.tsx` (SSG `force-static` 부분) | route-page | codebase 18개 기존 page.tsx 중 `force-static` / `force-dynamic` 명시 0건 — Phase 16 이 첫 사례 | UI-SPEC §Page.tsx 패턴 L284-306 + RESEARCH §Critical Code Patterns L312-334 + Context7 verified Next 16 docs (RESEARCH §Tech Stack Verification L150-190) 를 SoT 로 사용. 빌드 아티팩트 grep 으로 효과 검증 (RESEARCH D-10a). |
| `apps/web/app/legal/__tests__/metadata.test.ts` | unit test (Metadata module import) | codebase 에 page.tsx 의 export 만 import 해 검증한 선례 없음 | status-badge.test 의 vitest skeleton 차용. server component default function 은 import 안 하고 `metadata` export 만 import → jsdom render 회피. |
| `apps/web/content/legal/*.md` placeholder 보강 | content asset | 코드 analog 부적합 (마크다운 콘텐츠) | RESEARCH §Implementation Approach Axis 3 L234-274 의 콘텐츠 패턴 + CONTEXT D-06/D-07/D-08 placeholder 토큰 형식 직접 채택. |

---

## Metadata

**Analog search scope:**
- `apps/web/app/**/page.tsx` (18 files)
- `apps/web/app/**/layout.tsx` (3 files)
- `apps/web/components/**/__tests__/*.test.{ts,tsx}` (16 files)
- `apps/web/components/legal/*.tsx` (2 files — self)
- `apps/web/components/layout/*.tsx` (3 files — Footer 외 mobile-tab-bar, layout-shell)
- `apps/web/components/auth/signup-step2.tsx` (1 file — self)
- `apps/web/next.config.ts` (raw-loader rule 검증)

**Files scanned:** ~45 (Glob + targeted Read)

**Pattern extraction date:** 2026-04-28

---

*Phase: 16-legal-pages-launch-url*
*Pattern map ready for `gsd-planner`. Plan 의 각 작업 항목은 본 문서의 "무엇을 베낄 것 / 무엇을 바꿀 것 / 금지" 3축을 직접 인용 가능.*
