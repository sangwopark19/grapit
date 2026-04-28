# Phase 16: Legal pages launch — 이용약관/개인정보처리방침/마케팅동의 공개 URL 구현 - Research

**Researched:** 2026-04-28
**Domain:** Next.js 16 App Router SSG + 한국 개보법/정통망법 런칭 컴플라이언스
**Confidence:** HIGH (CONTEXT.md + UI-SPEC.md 가 이미 강한 lock 을 제공. 본 RESEARCH 는 그 lock 을 검증하고 빈틈을 메우는 역할)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Routing & URL Structure**
- **D-01:** 공개 경로 `/legal/{terms,privacy,marketing}` 단일 그룹. 짧은 별칭(`/terms` 등)·redirect 없음. 디렉토리는 `apps/web/app/legal/{terms,privacy,marketing}/page.tsx`. route group `(legal)` 사용 금지 — 명시적 `/legal/` URL 세그먼트 노출.
- **D-02:** `apps/web/app/legal/layout.tsx` 가 3개 페이지 공통 컨테이너(상하 여백·max-width·main 랜드마크) + heading 구조 공유. 기존 root layout 의 Header/Footer 자동 상속이므로 중복 렌더링 금지.
- **D-03:** Footer 3개 placeholder 링크 처리:
  - "이용약관" → `Link href="/legal/terms"`
  - "개인정보처리방침" → `Link href="/legal/privacy"` (font-semibold 유지 — 정통망법상 강조 의무)
  - "고객센터" → `<a href="mailto:support@heygrabit.com">` (FAQ/CS 페이지는 별도 phase)
- **D-04:** `/legal/marketing` 은 Footer 미노출 — 이용약관/개인정보처리방침과 달리 회원가입 동의 모달에서만 참조하면 충분. 페이지 자체는 dialog · 향후 마이페이지 동의 철회 화면용으로 공개.

**Content & Draft Status**
- **D-05:** `LegalDraftBanner` 컴포넌트 자체 삭제. 유일한 사용처 `signup-step2.tsx` 의 import + JSX 도 함께 제거. dialog · 공개 페이지 양쪽에서 'draft' 표시 소멸.
- **D-06:** 3개 MD 하단에 법정 필수 기재 섹션 보강 (구조만 — 실값은 사용자 직접 주입). MD 안에 한국어 placeholder 토큰 그대로 작성:
  - 이용약관: 시행일, 사업자명·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처
  - 개인정보처리방침: 시행일, 직전 시행일(개정 이력), 개인정보 보호책임자 실명/직책/이메일/전화
  - 마케팅 수신 동의: 시행일
- **D-07:** 사업자등록번호 등 1인 개발자 실값은 사용자가 등록 완료 후 직접 MD 에 주입. Plan 은 placeholder 자리(예: `[사업자등록번호: 000-00-00000]`)만 만들고 PR description / HUMAN-UAT 에 사용자 작업 항목으로 명시. 빈 placeholder 상태로 prod 배포 금지(verification 단계에서 `\[.*\]` 매치 검사).
- **D-08:** 시행일 = 본 phase 의 prod cutover 일자(예상 2026-04-29). Plan 의 D-day 작업 항목으로 분리.

**Rendering Pattern**
- **D-09:** `TermsMarkdown` 에 `showH1?: boolean` prop 추가 (기본 `false` — dialog 호환). `true` 일 때만 `h1` 을 `text-display` 토큰으로 렌더. `'use client'` 지시문 그대로 두고 server component (`page.tsx`) 에서 import.
- **D-10:** 3개 `page.tsx` 는 server component, `export const dynamic = 'force-static'` 명시. raw-loader 로 import 한 MD 문자열을 `<TermsMarkdown showH1>` 에 전달. 빌드 산출물에 정적 HTML 포함.
- **D-11:** dialog UX 변경 금지. signup-step2 / booking confirm terms-agreement 는 기존 Dialog 안의 렌더 그대로 유지(D-05 LegalDraftBanner 제거만 적용). 동의 체크박스 회귀 위험 최소화. 공개 URL 을 dialog 하단 보조 링크로 추가 노출은 선택 — Plan 에서 결정.

**SEO & Metadata**
- **D-12:** 3개 페이지 모두 검색 엔진 색인 허용(`robots: { index: true, follow: true }` 명시 또는 기본값). PG·도메인 verification·브랜드 검색 노출 이점.
- **D-13:** 각 page.tsx 가 Next.js `Metadata` 객체로 다음 export:
  - `title`: "이용약관 — Grabit" / "개인정보처리방침 — Grabit" / "마케팅 정보 수신 동의 — Grabit"
  - `description`: 1 문장 요약 (~120자 이내)
  - `alternates.canonical`: `https://heygrabit.com/legal/{terms,privacy,marketing}`
- **D-14:** JSON-LD `WebPage` 스키마 본 phase 미포함.

**External Dependencies (Operations)**
- **D-15:** `privacy@heygrabit.com` / `support@heygrabit.com` mailbox 실개통은 Phase 16 hard prerequisite. DNS MX/alias 설정·테스트 수신은 코드 외 운영 작업이므로 별도 quick-task. `HUMAN-UAT.md` 의 "mailbox 수신 검증 완료" 체크 항목이 cutover 게이트.

### Claude's Discretion
- 각 page.tsx 의 본문 위 breadcrumb/뒤로가기 UI 는 Plan/UI-SPEC 단계에서 자유 결정. UI-SPEC 은 단순 layout container 만 채택 — **추가 UI 없음**.
- `apps/web/app/legal/layout.tsx` max-width/타이포는 기존 toCSS 토큰(globals.css) 재사용. UI-SPEC 이 `max-w-[760px]` reading-optimized 절대값 채택. **신규 토큰 도입 금지**.
- 마케팅 수신 동의 페이지(32라인)는 단일 페이지로 충분 — 별도 분리 섹션 없음.
- "공개 URL 등록 후 LegalDraftBanner 컴포넌트·signup-step2 import 정리" 단일 commit vs 분리 commit 은 plan-phase 가 결정.

### Deferred Ideas (OUT OF SCOPE)
- **쿠키 동의 배너** (GDPR/eprivacy)
- **회원 약관 동의 이력 DB 저장** (`legal_consents` 테이블 + signup INSERT)
- **약관 변경 시 회원 재동의 알림 시스템** (마이페이지 푸시/이메일)
- **/legal/contact (FAQ/CS 페이지)** — Footer mailto 로 처리
- **JSON-LD `WebPage` 스키마** (D-14)
- **회원 마이페이지 마케팅 수신 동의 철회 UI**
- **TOC 자동 생성**
- **이용약관 PDF 다운로드**
- **anchor 링크 자동 생성** (`<h2 id=...>`)
- **scroll spy / sticky nav**
- **dialog UX 변경** (체크박스 layout, Dialog 본문 구조)
- **다크 모드 / i18n / 다국어**
</user_constraints>

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | How Phase 16 Honors |
|-----------|--------|---------------------|
| ESM only (`type: "module"`) | apps/web/package.json | All new `.tsx` use `import/export` (verified — already enforced project-wide) |
| Strict typing, no `any` | global CLAUDE.md | `Components` type from react-markdown, `Metadata` from next, `ReactNode` for layout — all explicit |
| Run typecheck/lint after changes | global CLAUDE.md | `pnpm --filter @grabit/web typecheck` + `pnpm --filter @grabit/web lint` (existing scripts in apps/web/package.json) |
| Tests before implementation for business logic | global CLAUDE.md | Phase 16 is mostly chrome (page renders MD); but `terms-markdown.tsx showH1` prop adds branching → unit test for both branches |
| Use conventional commits, NO Co-Authored-By trailer | global CLAUDE.md | feat(16):/fix(16):/docs(16): + no trailer |
| Korean responses, 존댓말 tone | global CLAUDE.md | All UI copy 한국어 (이미 UI-SPEC §Copywriting 에 lock) |
| GSD workflow enforcement | project CLAUDE.md | This research itself is part of `/gsd-plan-phase 16` |
| Tech stack lock (Next 16 / React 19 / Tailwind v4 / NestJS 11 / Drizzle 0.45) | project CLAUDE.md | Phase 16 frontend-only — no backend/DB changes. All locks honored. |
| 1인 개발 — 복잡도 최소화 | project CLAUDE.md | 단순 SSG page × 3 + Footer href 3건 + 컴포넌트 1개 prop + 컴포넌트 1개 삭제. **신규 의존성 0건.** |
| `.env` at monorepo root | project CLAUDE.md | Phase 16 은 env 변수 사용 없음 — `legal/page.tsx` 는 build-time import 만 |

---

## Summary

Phase 16 은 한국 개보법(제30조)·정통망법상 상시 공개 URL 요건을 충족하기 위한 **기능 신규 4축 phase**: (1) `/legal/{terms,privacy,marketing}` SSG 페이지 3개 신규, (2) Footer placeholder href 3건 실 경로 교체, (3) 3개 MD 콘텐츠에 법정 필수 기재 placeholder 보강, (4) `LegalDraftBanner` 컴포넌트 + `signup-step2` 사용처 제거. CONTEXT.md (D-01~D-15) 와 UI-SPEC.md 가 시각·라우팅·메타데이터 계약을 거의 모든 차원에서 lock 하고 있어 본 RESEARCH 는 lock 의 기술적 검증 + 누락 영역(법적 컴플라이언스 항목 매핑·검증 패턴·시퀀싱) 을 보강한다.

핵심 발견: (a) Next 16 의 `export const dynamic = 'force-static'` 는 Context7 verified 동작 — 단 force-static 은 *fetch 캐시 + revalidate 정책* 의 의미가 강하고, build-time prerender 자체는 default 'auto' 도 빌드 산출물 조건을 만족하면 가능. 본 phase 는 명시 채택해 의도(=영구 정적) 를 코드로 표현. (b) `'use client'` 컴포넌트(`TermsMarkdown`)를 server `page.tsx` 에서 import 하는 것은 React 표준 boundary — hydration JS 가 함께 산출되지만 SSG HTML 본문은 서버에서 prerender 됨. 본문은 JS 미실행 상태에서도 100% 표시. (c) raw-loader 의 `*.md` Turbopack rule (next.config.ts:46-49) 은 server component import 에서도 동작 — `env.d.ts:4` 의 `declare module '*.md'` 가 타입 선언 제공. (d) booking confirm `terms-agreement.tsx` 는 `TermsMarkdown` / `LegalDraftBanner` 를 사용하지 **않음** (인라인 plain text + 자체 Dialog) — D-11 의 dialog UX 회귀 위험은 signup-step2 한 곳에 한정. (e) D-15 mailbox 운영 prereq 는 코드와 분리 — Plan 은 mailbox 검증을 코드 작업에 포함 금지, HUMAN-UAT cutover 게이트로만 처리.

**Primary recommendation:** UI-SPEC §Layout / §Component Inventory 에 명시된 file system invariants 를 그대로 따라 4-axis 작업을 단일 phase 단일 PR (commit 은 4개 wave 로 분리 가능) 로 처리. 신규 의존성 0건, 신규 환경변수 0건, 신규 디자인 토큰 0건. 검증은 (1) build 산출물 prerender 3개 확인, (2) Footer href grep, (3) signup-step2 LegalDraftBanner import grep = 0, (4) MD placeholder 미주입 차단 grep, (5) `LegalDraftBanner.tsx` 파일 부재 확인 5종.

---

<phase_requirements>
## Phase Requirements

CONTEXT.md `Phase requirement IDs (MUST address)` 가 명시한 바와 같이 본 phase 는 별도 REQ-ID 매핑이 없다 (REQUIREMENTS.md 의 v1.1 33건은 Phase 5~15 까지 모두 매핑됨; Phase 16 은 Phase 13 UAT Gap 에서 도출된 pre-existing feature gap — REQUIREMENTS.md 에 사후 추가되지 않은 상태). **D-01~D-15 가 사실상 본 phase 의 acceptance 단위로 작동**하므로 plan 은 D-ID 별 매핑을 사용한다.

| D-ID | 의무 | 본 RESEARCH 가 enable 하는 구현 근거 |
|------|------|------------------------------------|
| D-01 | `/legal/{terms,privacy,marketing}` 평면 디렉토리 신규 | §Implementation Approach Axis 1 |
| D-02 | `apps/web/app/legal/layout.tsx` 공유 container | §Critical Code Patterns §Layout |
| D-03 | Footer 3개 href 교체 (terms/privacy → Link, 고객센터 → mailto) | §Critical Code Patterns §Footer Patch |
| D-04 | `/legal/marketing` Footer 미노출 | §Implementation Approach Axis 2 |
| D-05 | `LegalDraftBanner` 삭제 + signup-step2 import/JSX 제거 | §Implementation Approach Axis 4 + §Validation §Regression |
| D-06 | 3개 MD 하단 placeholder 섹션 보강 | §Implementation Approach Axis 3 + §Compliance Mapping |
| D-07 | 사용자 직접 주입 위치만 placeholder 로 표기, 빈 placeholder 차단 | §Validation §Build artifact §Placeholder leak grep |
| D-08 | 시행일은 cutover 일자 (D-day 작업) | §Dependencies & Sequencing Wave 4 |
| D-09 | `TermsMarkdown showH1` prop 추가, 기본 false | §Critical Code Patterns §showH1 prop |
| D-10 | `export const dynamic = 'force-static'` SSG 명시 | §Tech Stack Verification §Next 16 + §Critical Code Patterns §Page |
| D-11 | dialog UX 변경 금지 | §Risks §Dialog regression + §Validation §Regression |
| D-12 | `robots: { index: true, follow: true }` | §Critical Code Patterns §Page |
| D-13 | Metadata title/description/alternates.canonical | §Tech Stack Verification §Metadata + §Critical Code Patterns §Page |
| D-14 | JSON-LD 미포함 | §Out-of-Scope Reaffirmation |
| D-15 | mailbox 수신 검증 (코드 외, HUMAN-UAT) | §Validation §Manual UAT |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 공개 URL `/legal/*` 라우팅 | Frontend Server (Next 16 SSR/SSG) | — | App Router 의 file-system routing — page.tsx 가 곧 라우트. SSG prerender 산출물이 Cloud Run 의 Next standalone container 에서 정적 응답으로 서빙. CDN(Cloudflare) 도 정적이므로 캐시 가능. |
| MD 콘텐츠 빌드타임 import | Build Pipeline (Turbopack raw-loader) | Frontend Server | `next.config.ts:46-49` 의 turbopack rule 이 빌드 시 MD → JS string 으로 인라인. 런타임 fs read 없음. 따라서 page rendering 은 runtime IO 0회. |
| 마크다운 → HTML 변환 | Browser / Frontend Server (`'use client'`) | — | `TermsMarkdown` 은 `'use client'` 지시문 보유. 그러나 server component 인 page.tsx 가 import 하면 React boundary 가 자동 처리: 첫 paint 는 서버 prerender HTML, 그 후 JS hydration. |
| Metadata (title/description/canonical/robots) | Frontend Server (Next Metadata API) | — | Next 16 `export const metadata: Metadata` 가 빌드 시 `<head>` 태그 인젝트. HTML 산출물에 정적으로 포함되어 검색엔진 즉시 인식. |
| Footer 링크 라우팅 | Browser (next/link client navigation) | Frontend Server | `<Link href="/legal/terms">` 는 prefetch + soft navigation. mailto 는 OS 기본 메일 클라이언트(완전히 browser/OS 책임). |
| dialog 내 MD 렌더 (signup) | Browser (`'use client'`) | — | signup-step2 자체가 client component. dialog 본문은 hydration 후에만 표시 (client state 의존). 변경 없음 (D-11). |

---

## Tech Stack Verification

| Stack 요소 | 버전(verified) | 근거 | 영향 |
|------------|---------------|------|------|
| Next.js | `^16.2.0` (apps/web/package.json L29) | [VERIFIED: package.json] | App Router + Turbopack rules + Metadata API + `dynamic = 'force-static'` 정상 |
| React | `^19.1.0` (L31) | [VERIFIED: package.json] | server/client component boundary 안정. `'use client'` 지시문이 server import 시 자동 처리. |
| TypeScript | `~5.9.0` (L52) | [VERIFIED: package.json] | `Components` type / `Metadata` type / `ReactNode` 모두 strict 인식 |
| react-markdown | `^10.1.0` (L40) | [VERIFIED: package.json] | h1~hr 매핑 안정. `Components` 타입 inference 문제 없음. |
| remark-gfm | `^4.0.1` (L43) | [VERIFIED: package.json] | GFM(테이블·strikethrough) 지원 — 개인정보처리방침의 국외이전 표(L54-57) 가 GFM 테이블이므로 필수. **변경 금지.** |
| raw-loader | `^4.0.2` (devDependencies L60) | [VERIFIED: package.json] | Turbopack rule (next.config.ts:46-49) 의 loader. `apps/web/env.d.ts:4` 가 `declare module '*.md'` 로 string 타입 export. |
| Node.js | `v24.13.0` (current shell) | [VERIFIED: shell] | Next 16 요구는 ≥ 20.9 — 안전 |
| Tailwind CSS | `^4.2.0` | [VERIFIED: package.json L51] | UI-SPEC §Spacing/§Typography 의 모든 토큰이 globals.css `@theme` 에 lock |

### Next 16 SSG / `force-static` 의미 (Context7 verified)

**[CITED: docs/01-app/02-guides/caching-without-cache-components.mdx]:**
```
export const dynamic = 'auto'
// 'auto' | 'force-dynamic' | 'error' | 'force-static'
```
> "Export the dynamic config option from a Page, Layout, or Route Handler to control caching behavior."

**해석:**
- `force-static` 은 *모든 fetch 가 캐시되고, 동적 함수(cookies/headers) 사용 시 빌드 실패* 라는 강한 정적 보장.
- 우리 page.tsx 는 fetch 도, 동적 함수도 사용하지 않음 (build-time MD import 만). 따라서 default `'auto'` 로도 prerender 됨. 그러나 D-10 명시 채택 = (a) 의도(=영구 정적) 를 코드로 표현, (b) 향후 누군가 `cookies()` 나 dynamic helper 추가 시 빌드 실패로 사고 차단.
- `revalidate = false` 는 다른 도구 (ISR off). `force-static` 과 보완 관계 — **본 phase 는 `force-static` 만으로 충분**, `revalidate` 는 명시 불필요.

**Layout vs Page 상속:**
- Next 16 Route Segment Config (`dynamic`/`revalidate` 등) 는 **layout 에서 명시해도 child page 에 자동 상속되지 않음 — 각 page 가 명시해야 함**. 이는 Next.js docs 의 "Route Segment Config" 명세. → 우리는 `apps/web/app/legal/layout.tsx` 에는 `dynamic` 미명시, **3개 page.tsx 각각에 `export const dynamic = 'force-static'` 명시**.

### `'use client'` + server import 동작

`TermsMarkdown` 이 `'use client'` 보유 → 빌드 시 client bundle 에 포함. server `page.tsx` 가 import → 빌드 시 React 가 boundary 인식, server prerender HTML 에 컴포넌트 출력 + client bundle 에 hydration 코드 동봉. **JS 미실행 환경(검색엔진 크롤러, JS 차단 사용자)에서도 본문 100% 표시** — 이것이 D-10 의 SSG 의도와 합치하는 이유.

검증: 빌드 후 `apps/web/.next/server/app/legal/terms.html` (또는 `.rsc`) 산출물에 `<h1>이용약관</h1>` 본문 텍스트가 포함되어야 함.

### Metadata API (Context7 verified)

**[CITED: docs/01-app/03-api-reference/04-functions/generate-metadata.mdx]:**
- `alternates.canonical` 은 string 또는 URL — **absolute URL 권장** ("https://heygrabit.com/legal/terms"). path-only 도 작동하지만 metadataBase 설정이 필요 → 우리는 root layout 에 `metadataBase` 미설정이므로 **absolute URL 채택** (D-13 lock 과 일치).
- `robots: { index: true, follow: true }` 는 `<meta name="robots" content="index, follow" />` 인젝트.
- `title`/`description` 은 root layout 의 metadata 와 자동 병합 (page metadata 가 win). 우리 root layout 은 `title: 'Grabit - 공연 티켓 예매'` — Phase 16 page 의 `title: '이용약관 — Grabit'` 가 덮어씀 (정확한 동작).

### Turbopack raw-loader 정합성

**[VERIFIED: codebase grep]:**
- `apps/web/next.config.ts:44-49`: `turbopack.rules: { '*.md': { as: '*.js', loaders: ['raw-loader'] } }`
- `apps/web/env.d.ts:4`: `declare module '*.md' { const content: string; export default content; }`
- 기존 사용처: `signup-step2.tsx:15-17` 이 3개 MD 모두 import 하여 dialog 에 전달 — Phase 9 부터 production 동작 검증됨.

**MD 변경 → 빌드 산출물 갱신:** Turbopack 은 `*.md` 를 source 로 추적 → MD 수정 시 dev server HMR · production build 모두 새 산출물 생성. Phase 16 의 D-06/D-07/D-08 placeholder 주입이 빌드 시점에 정상 인라인됨. **별도 cache invalidation 불필요.**

**Pitfall(verified):** `loaders: ['raw-loader']` 는 *Turbopack rules* 에만 등록. webpack fallback (legacy `next.config.js webpack: ...`) 은 Phase 16 에서 사용하지 않음 — apps/web 은 dev/prod 모두 turbopack (`apps/web/package.json:9` `"build": "next build"` 가 Next 16 부터는 turbopack 기본 활성, `"dev": "next dev --turbopack"`).

---

## Implementation Approach (per 4-axis)

### Axis 1: 공개 URL 신규 (D-01, D-02, D-10, D-12, D-13)

**파일 신규 생성:**
- `apps/web/app/legal/layout.tsx` (1 file, server component, ~10 lines)
- `apps/web/app/legal/terms/page.tsx` (1 file, server component, ~25 lines)
- `apps/web/app/legal/privacy/page.tsx` (1 file, server component, ~25 lines)
- `apps/web/app/legal/marketing/page.tsx` (1 file, server component, ~25 lines)

**계약:**
- layout.tsx 는 UI-SPEC L266-272 의 정확한 className 적용 (`mx-auto w-full max-w-[760px] px-4 pt-8 pb-16 md:px-6 md:pt-12 md:pb-24`). `<main>` landmark 1회.
- 각 page.tsx 는 (1) `'use client'` 없음(server), (2) `import termsMd from '@/content/legal/terms-of-service.md'`, (3) `export const dynamic = 'force-static'`, (4) `export const metadata: Metadata = {...}`, (5) default export 가 `<TermsMarkdown showH1>{termsMd}</TermsMarkdown>` 만 반환.
- **route group `(legal)` 사용 금지** (D-01) — `/legal/` 가 URL 에 보여야 함.

**왜 `apps/web/app/legal/layout.tsx` 가 안전한가:**
- `app/layout.tsx` (root) 가 GNB/Footer/MobileTabBar 를 `LayoutShell` 통해 자동 렌더 (`apps/web/app/layout-shell.tsx:8-36`). `LayoutShell` 의 분기(`isAdmin || isBookingCheckout`)가 `/legal` 에 미적용 → GNB/Footer/MobileTabBar 모두 자동 노출. **layout.tsx 가 직접 GNB/Footer 를 렌더하면 중복** — 단순 container 만 담당하는 것이 정답.

### Axis 2: Footer 링크 교체 (D-03, D-04)

**파일 수정:**
- `apps/web/components/layout/footer.tsx` (3개 `<Link href="#">` 교체)

**Diff:**
```diff
- <Link href="#" className="hover:underline">이용약관</Link>
+ <Link href="/legal/terms" className="hover:underline">이용약관</Link>

- <Link href="#" className="font-semibold hover:underline">개인정보처리방침</Link>
+ <Link href="/legal/privacy" className="font-semibold hover:underline">개인정보처리방침</Link>

- <Link href="#" className="hover:underline">고객센터</Link>
+ <a href="mailto:support@heygrabit.com" className="hover:underline">고객센터</a>
```

- 3번째 링크는 `Link` (next/link) → raw `<a>` 로 컴포넌트 교체. `mailto:` 는 internal navigation 이 아님 → next/link 의 prefetch/soft-navigation 의미 없음.
- 그 외 시각 요소(`gap-2`, `text-sm text-gray-900`, `text-gray-400` 구분자, copyright 라인) 변경 금지 (UI-SPEC §Layout Contract).
- `/legal/marketing` Footer 미노출 (D-04) — Footer 에는 terms/privacy 만.

**`Link` import 제거 여부:** `<Link>` 가 2건 남음 → import 유지. `<a>` 사용은 추가 import 불필요(HTML 기본).

### Axis 3: MD 콘텐츠 보강 (D-06, D-07, D-08)

**파일 수정:**
- `apps/web/content/legal/terms-of-service.md`
- `apps/web/content/legal/privacy-policy.md`
- `apps/web/content/legal/marketing-consent.md`

**계약 (D-06 의 보강 항목 매핑):**

| MD | 추가/수정 섹션 | placeholder 토큰 패턴 |
|----|---------------|---------------------|
| terms-of-service.md | 제15조 (연락처) 확장 + 부칙 (시행일·사업자정보) | `[사업자명: 000]`, `[대표자명: 000]`, `[사업자등록번호: 000-00-00000]`, `[통신판매업 신고번호: 제0000-서울강남-00000호]`, `[주소: 서울특별시 ...]`, `[전화번호: 02-0000-0000]`, `[시행일: 2026년 4월 29일]` |
| privacy-policy.md | 제10조 (개인정보 보호책임자) 확장 + 제11조 (개정 이력) 추가 + 적용일 placeholder | `[보호책임자 실명: 000]`, `[직책: 대표]`, `[전화번호: 000-0000-0000]`, `[시행일: 2026년 4월 29일]`, `[직전 시행일: 2026년 4월 14일]` (개정 이력 표) |
| marketing-consent.md | 본문 끝 시행일 교체 | `[시행일: 2026년 4월 29일]` |

**placeholder 컨벤션:**
- 한국어 라벨 + 콜론 + 빈 자리(예: `000-00-00000`) 또는 임시값.
- 정규식 검증 패턴: `\[(사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|시행일|직전 시행일|보호책임자 실명|직책):` — 빌드 후 산출물에서 이 패턴 매치 시 prod 배포 차단.
- D-08 시행일은 **cutover 당일 D-day 작업** 으로 분리 — 시행일 placeholder 만 cutover commit 에서 실값으로 교체.

**시행일 표기 형식 (한국 법규 관행 [ASSUMED]):**
- 한국 약관 관행상 `**부칙**: 본 약관은 2026년 4월 29일부터 시행됩니다.` 형식이 보편 (terms-of-service.md L78 이 이미 채택). 본 phase 도 동일 형식 유지.
- 개인정보처리방침은 `**본 방침은 2026년 4월 29일부터 적용됩니다.**` (privacy-policy.md L93) 형식 유지.
- ISO 8601 (`2026-04-29`) 단독 표기는 한국 법규 관행상 일반적이지 않음 — 한글 "년 월 일" 표기 권장. **이 형식 자체는 [ASSUMED] — 실제 KOPICO 가이드 강제 형식이 아님**. CONTEXT D-08 도 형식을 lock 하지 않음 → 기존 MD 형식 유지가 안전.

**개정 이력 (privacy-policy.md):**

```markdown
## 제11조 (개인정보처리방침의 변경)

본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.

### 개정 이력

| 버전 | 시행일 | 주요 변경사항 |
|------|--------|---------------|
| v1.1 | [시행일: 2026년 4월 29일] | 개인정보 보호책임자 정보 보강, 사업자 식별정보 추가 |
| v1.0 | 2026년 4월 14일 | 최초 시행 |
```

→ GFM 테이블이므로 `remark-gfm` (이미 설치) 가 렌더. `TermsMarkdown` 의 매핑은 table/thead/tbody/tr/th/td 에 매핑이 없어 react-markdown 기본 HTML 출력 — 시각적으로 단순하지만 가독은 충분 (UI-SPEC §Component Inventory 의 변경 금지 invariant 와 합치).

### Axis 4: LegalDraftBanner 제거 (D-05)

**파일 변경:**
- DELETE: `apps/web/components/legal/legal-draft-banner.tsx`
- MODIFY: `apps/web/components/auth/signup-step2.tsx` (L18 import 제거 + L190 `<LegalDraftBanner />` JSX 제거)

**이외 영향 없음 (verified):**
- `grep -rn "LegalDraftBanner\|legal-draft-banner" apps/web` → 단 1건(`signup-step2.tsx`) 만 매치 [VERIFIED: Grep tool 2026-04-28].
- `booking/terms-agreement.tsx` 는 `TermsMarkdown` / `LegalDraftBanner` 전부 미사용 (인라인 plain text + 자체 dialog) — D-11 의 dialog UX 회귀 위험은 signup-step2 한 곳에 한정.
- `lucide-react` 의 `AlertTriangle` import 가 `legal-draft-banner.tsx` 에서만 사용되었는지 확인 필요 — 다른 곳 사용 시 패키지 영향 없음 (다수 곳에서 lucide 다른 아이콘 사용 중).

---

## Critical Code Patterns

### Layout (`apps/web/app/legal/layout.tsx`)

```tsx
// Source: UI-SPEC L264-272, L41-50 spacing tokens
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-16 md:px-6 md:pt-12 md:pb-24">
      {children}
    </main>
  );
}
```

- server component (no `'use client'`).
- `<main>` landmark 1회 — root layout 에는 `<main>` 없음 (apps/web/app/layout.tsx + LayoutShell 모두 verified). 따라서 legal/layout.tsx 가 main semantic 책임.
- **`dynamic = 'force-static'` 명시 안 함** — 페이지 segment 별로 명시.

### Page (`apps/web/app/legal/terms/page.tsx`)

```tsx
// Source: UI-SPEC L284-306 + Context7 [VERIFIED: docs/01-app/03-api-reference/04-functions/generate-metadata.mdx]
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

- `/legal/privacy/page.tsx` 와 `/legal/marketing/page.tsx` 는 import 한 MD 변수와 metadata 값만 다름 (UI-SPEC §Copywriting L201-210 lock).
- **wrapper `<article>`/`<section>` 도입 금지** (UI-SPEC L308) — TermsMarkdown 직접 렌더가 layout `<main>` 안에 들어감.
- React 19 server component 가 client component (`TermsMarkdown`) 를 import → 정상 (Phase 16 핵심 boundary, [VERIFIED: codebase pattern]).

### `showH1` prop 추가 (`apps/web/components/legal/terms-markdown.tsx`)

```tsx
// Source: UI-SPEC L91-119, D-09
'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const baseComponents: Components = {
  // 기존 매핑 그대로 (h1 만 분기에서 처리)
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
        <h1
          className="text-display font-semibold leading-[1.2] text-gray-900"
          {...props}
        />
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

- **타입 시그니처 (`Components` from react-markdown 10.1):** `h1` 의 props 는 react-markdown 이 추론하는 `JSX.IntrinsicElements['h1']` 호환 타입 — 위 spread `{...props}` 로 충분 [VERIFIED: react-markdown v10 docs via Context7 indirectly + 기존 매핑이 동일 패턴].
- **default false:** dialog 에서 `<TermsMarkdown>{...}</TermsMarkdown>` 호출 시 prop 미지정 → 기존 동작 그대로 (h1: null) — dialog 회귀 위험 0.
- **page 에서:** `<TermsMarkdown showH1>{...}</TermsMarkdown>` (boolean shorthand) — h1 가 렌더됨.

### Footer Patch (`apps/web/components/layout/footer.tsx`)

§Implementation Approach Axis 2 의 diff 그대로. import 변경 없음 (`Link` 2건 잔존, `<a>` 1건 추가).

### signup-step2 patch (D-05 cleanup)

```diff
- import { LegalDraftBanner } from '@/components/legal/legal-draft-banner';
  import { TermsMarkdown } from '@/components/legal/terms-markdown';
```

```diff
        </DialogHeader>
-       <LegalDraftBanner />
        <TermsMarkdown>{LEGAL_CONTENT[dialogKey].content}</TermsMarkdown>
```

- 그 외 동의 체크박스 / Dialog 구조 / `LEGAL_CONTENT` 객체 / 핸들러 모두 변경 금지 (D-11).

---

## Compliance Mapping (한국 개보법·정통망법 런칭 요건)

> **Note:** 본 섹션의 법률 해석은 [ASSUMED] — Claude 의 학습 지식 기반. 실제 PG 심사·법무 검토 시 최종 확정 필요. 본 phase 는 **placeholder 슬롯과 기본 구조만 제공**하며, 사용자(개인사업자)가 실제 사업자등록·법무 검토 후 실값을 주입.

### 이용약관 — 전자상거래법·약관규제법 관점 [ASSUMED]

| 필수 기재 (관행) | 현 terms-of-service.md 상태 | Phase 16 보강 |
|------------------|----------------------------|---------------|
| 약관의 목적 | ✓ 제1조 (L3-4) | 변경 없음 |
| 용어 정의 | ✓ 제2조 (L6-12) | 변경 없음 |
| 약관 변경 절차 | ✓ 제3조 (L14-17) | 변경 없음 |
| 회원가입·자격 | ✓ 제4조 (L19-24) | 변경 없음 |
| 서비스 제공·중단 | ✓ 제6, 7조 | 변경 없음 |
| 결제·환불 | ✓ 제8, 9조 | 변경 없음 |
| 회원 의무 / 자격 상실 | ✓ 제10, 11조 | 변경 없음 |
| 면책조항 | ✓ 제13조 | 변경 없음 |
| 준거법·관할 | ✓ 제14조 (L68-69) | 변경 없음 |
| **사업자 식별정보 (전자상거래법 8조 / 정보통신망법 시행령 13조)** | △ 제15조 L72-74 에 서비스명/이메일만. **사업자등록번호·통신판매업 신고번호·대표자명·주소·전화번호 없음** | **D-06 추가 — 제15조 확장 또는 부칙 영역 placeholder 8건** |
| **시행일 명시** | ✓ 부칙 L78 (`2026년 4월 14일`) | **D-08 cutover 일자로 교체 예정 — placeholder** |

### 개인정보처리방침 — 개보법 30조 [ASSUMED]

| 필수 기재 (개보법 30조 1항) | 현 privacy-policy.md 상태 | Phase 16 보강 |
|----------------------------|---------------------------|---------------|
| 처리 목적 | ✓ 제1조 (L5-10) | 변경 없음 |
| 처리·보유 기간 | ✓ 제3조 (L30-35) | 변경 없음 |
| 제3자 제공 | ✓ 제4조 (L37-40) | 변경 없음 |
| 처리 위탁 | ✓ 제5조 (L42-48) | 변경 없음 |
| **국외이전 (28조의8)** | ✓ 제6조 + 표 (L50-59) | 변경 없음 |
| 정보주체 권리 | ✓ 제7조 (L61-69) | 변경 없음 |
| 파기 절차 | ✓ 제8조 (L71-73) | 변경 없음 |
| 안전성 확보조치 | ✓ 제9조 (L75-80) | 변경 없음 |
| 자동수집 (쿠키·로그) | ✓ 제2조 자동수집 항목 (L27-28) | 변경 없음 |
| **개인정보 보호책임자 (실명/직책/연락처/전화)** | △ 제10조 L82-86 에 "Grabit 대표" + email 만. **실명·직책·전화번호 없음** | **D-06 추가 — 제10조 확장 placeholder 4건** |
| 처리방침 변경 (개정 이력) | △ 제11조 L88-89 에 "변경시 7일전 공지" 만. **개정 이력 표 없음** | **D-06 추가 — 제11조 다음 "개정 이력" 표 + placeholder** |
| **시행일 명시** | ✓ L93 (`2026년 4월 14일`) | **D-08 cutover 일자로 교체 예정 — placeholder** |

### 마케팅 수신 동의 — 정통망법 50조의5 [ASSUMED]

| 필수 기재 | 현 marketing-consent.md 상태 | Phase 16 보강 |
|----------|----------------------------|---------------|
| 수집·이용 목적 | ✓ L5-9 | 변경 없음 |
| 수집·이용 항목 | ✓ L11-15 | 변경 없음 |
| 보유·이용 기간 | ✓ L17-19 | 변경 없음 |
| 전송 수단 | ✓ L21-24 | 변경 없음 |
| 동의 거부·철회 권리 | ✓ L26-28 | 변경 없음 |
| **시행일 명시** | ✓ L32 (`2026년 4월 14일`) | **D-08 cutover 일자로 교체 — placeholder** |

### 사업자 식별정보 노출 위치 [ASSUMED]

전자상거래법 8조 / 정통망법 시행령은 **"사업자 정보를 소비자가 쉽게 알 수 있도록"** 표시. 관행:
- **이용약관 본문** (제15조 또는 부칙) — 권장
- **Footer** 영역 — 권장 (그러나 본 phase 의 Footer 구조 변경은 D-03 의 3개 링크 교체에 한정 — 사업자 정보 라인 추가는 별도 phase)
- 결정: 본 phase 는 **이용약관 본문에만 placeholder 추가**. Footer 추가는 추후 phase (deferred — UI-SPEC 의 "Footer 카피 변경 없음" lock 와 일치).

---

## Risks & Mitigations

### R1: dialog 회귀 (D-11)
**위험:** `TermsMarkdown` 의 `showH1` prop 추가가 dialog 사용처(`signup-step2.tsx:191`, prop 미지정)에서 의도치 않게 H1 이 렌더되는 경우.
**완화:**
- prop default `false` lock — TypeScript 가 미지정 시 기본값 적용 보장.
- 회귀 테스트 (Wave 0 또는 Axis 4 wave): `<TermsMarkdown>{md}</TermsMarkdown>` 렌더 후 H1 텍스트가 DOM 에 없음 확인.
- signup-step2 변경 후 e2e/manual: 회원가입 step 2 → dialog 열기 → H1 미표시 + 본문 정상.

### R2: SSG 산출물 누락
**위험:** `force-static` 명시했으나 어떤 이유로 prerender 가 dynamic 으로 fallback 되어 빌드 산출물에 HTML 본문이 빠지는 경우.
**완화:**
- 빌드 후 `apps/web/.next/server/app/legal/{terms,privacy,marketing}/page.html` (또는 Next 16 의 정확한 paths — 빌드 로그 검증) 존재 확인.
- 빌드 로그에 `○ (Static)` 표시 grep — Next 16 build CLI 가 라우트별 prerender 상태 출력.
- 빌드 시 fetch/cookies/headers 함수 사용 시 force-static 이 build error 발생 → 정책상 사고 차단.

### R3: placeholder leak (prod 배포 전 실값 미주입)
**위험:** 사용자가 사업자 등록 전 prod 배포 → `[사업자등록번호: 000-00-00000]` 같은 placeholder 가 라이브 노출 → 법적/신뢰 리스크.
**완화:**
- HUMAN-UAT 체크리스트 항목: "MD 3개의 placeholder 모두 실값 주입 완료" 체크박스.
- 빌드 산출물 grep 검증 (자동화):
  ```bash
  if grep -rE '\[(사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|시행일|직전 시행일|보호책임자 실명|직책):' apps/web/.next/server/app/legal/; then
    echo "FAIL: placeholder leak in build output"; exit 1
  fi
  ```
- 본 검증을 PR description "사용자 작업 항목" 으로 명시. CI 에 추가하면 더 안전 (선택).

### R4: D-15 mailbox prereq 미완 상태에서 prod 배포
**위험:** `support@heygrabit.com` / `privacy@heygrabit.com` 미수신 상태에서 공개 페이지 라이브 → 사용자가 메일 보내도 bounce → 정통망법 정보주체 권리 보장 의무 위반.
**완화:**
- HUMAN-UAT 체크리스트 항목: "mailbox 수신 검증 완료 (외부 → support@/privacy@ 발송 후 inbox 도착 확인)" — cutover 게이트.
- 단순 PR description 명시만으로는 부족 — UAT 의 명시적 체크 항목으로 두어 verifier 가 인지하도록.
- mailbox 운영 작업은 별도 quick-task 로 분리 (D-15) — Phase 16 코드에는 포함 금지.

### R5: 정적 페이지의 Sentry 트래킹
**위험:** SSG 페이지에 Sentry instrumentation 추가가 정적 응답을 dynamic 으로 강등시키는 경우.
**완화:**
- `@sentry/nextjs` 는 root config (`apps/web/next.config.ts:72-77`) 에서 `withSentryConfig` 로 자동 wrap — page-level 코드 추가 불필요.
- SSG HTML 산출물에 Sentry browser SDK script 가 자동 인젝트되지만, 이는 client bundle 으로 분리되어 prerender 와 무관.
- 정적 페이지의 4xx/5xx 발생 가능성: `/legal/foo` 같은 not-found 는 Next 16 not-found.tsx 가 처리 — Sentry 자동 트래킹 (별도 작업 없음).

### R6: react-zoom-pan-pinch / 기타 거대 의존성과의 충돌
**위험:** 없음 — 본 phase 는 추가 의존성 0건. 기존 react-markdown / remark-gfm / raw-loader 만 사용.

### R7: Korean character encoding in MD raw import
**위험:** 한국어 문자열이 raw-loader 빌드 단계에서 깨지는 경우.
**완화 (기존 동작 검증됨):** Phase 9 부터 동일 패턴이 production 동작 — UTF-8 정상. 추가 검증 불필요.

### R8: Layout container 절대값 `max-w-[760px]` 의 디자인 시스템 일관성
**위험:** UI-SPEC 이 reading-optimized width 로 token 외 절대값 허용 — 다른 phase 에서 동일 절대값 재등장 시 기준 모호.
**완화:** UI-SPEC §Spacing L67-68 가 명시적 page-type 별 reading-width 예외 lock — Phase 16 단독 결정. 향후 reading-page 추가 시 동일 760px 사용 또는 token 화 결정.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.0 + @testing-library/react 16.3 + jsdom |
| Config file | `apps/web/vitest.config.ts` (verified, plugin: react, alias `@/*` set) |
| Setup file | `apps/web/test-setup.ts` (Blob polyfill — 이전 phase 잔여) |
| Quick run command | `pnpm --filter @grabit/web test -- terms-markdown` (혹은 변경 파일 패턴) |
| Full suite command | `pnpm --filter @grabit/web test` |
| Build verification | `pnpm --filter @grabit/web build` |
| Lint/Typecheck | `pnpm --filter @grabit/web lint` / `pnpm --filter @grabit/web typecheck` |

### Phase Requirements → Test Map

| D-ID | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| D-01 | `apps/web/app/legal/{terms,privacy,marketing}/page.tsx` 파일 존재 | smoke | `test -f apps/web/app/legal/terms/page.tsx && ...` | ❌ Wave 0/1 |
| D-02 | `apps/web/app/legal/layout.tsx` 가 `<main>` + max-w-[760px] 적용 | smoke | `grep -E 'max-w-\[760px\]' apps/web/app/legal/layout.tsx` | ❌ Wave 0/1 |
| D-03 | Footer 의 href 가 `/legal/terms`, `/legal/privacy`, `mailto:support@heygrabit.com` 매치 | smoke | `grep -E 'href="/legal/(terms\|privacy)"' apps/web/components/layout/footer.tsx && grep 'mailto:support@heygrabit.com'` | ❌ Wave 2 |
| D-04 | Footer 에 `/legal/marketing` 미매치 | regression-grep | `! grep '/legal/marketing' apps/web/components/layout/footer.tsx` | ❌ Wave 2 |
| D-05a | `LegalDraftBanner` 파일 부재 | smoke | `! test -e apps/web/components/legal/legal-draft-banner.tsx` | ❌ Wave 4 |
| D-05b | signup-step2 에 LegalDraftBanner import/JSX 없음 | regression-grep | `! grep -E 'LegalDraftBanner\|legal-draft-banner' apps/web/components/auth/signup-step2.tsx` | ❌ Wave 4 |
| D-06 | 3개 MD 에 placeholder 토큰 존재 (Plan 작성 단계) | grep | `grep -E '\[(사업자명\|보호책임자):' apps/web/content/legal/terms-of-service.md privacy-policy.md` | ❌ Wave 3 |
| D-07 | **Prod 빌드 산출물에 placeholder 미잔존** (cutover 게이트) | manual + grep | `! grep -rE '\[(사업자명\|보호책임자\|시행일):' apps/web/.next/server/app/legal/` | ❌ Wave 5 (cutover) |
| D-08 | 시행일 placeholder 가 cutover 일자로 교체됨 | manual UAT | "시행일 = 2026-04-29 (또는 cutover 일자) 확인" | ❌ Wave 5 (cutover) |
| D-09a | `TermsMarkdown showH1=false` (default) 시 H1 없음 | unit | `pnpm --filter @grabit/web test -- terms-markdown` | ❌ Wave 0 |
| D-09b | `TermsMarkdown showH1` 시 H1 렌더 + className 매치 | unit | (동상) | ❌ Wave 0 |
| D-10a | 빌드 시 3개 page 가 prerender (Static) | build-log grep | `pnpm --filter @grabit/web build 2>&1 \| grep -E '/legal/(terms\|privacy\|marketing).*Static'` | ❌ Wave 5 |
| D-10b | 빌드 산출물 HTML 본문에 H1 텍스트 + 시행일 텍스트 grep | build-artifact grep | `grep -E '이용약관' apps/web/.next/server/app/legal/terms*.html` (정확한 path 는 빌드 후 확인) | ❌ Wave 5 |
| D-11a | dialog 사용처 (signup-step2) 의 `<TermsMarkdown>` 호출이 prop 없음 | regression-grep | `grep -E '<TermsMarkdown>' apps/web/components/auth/signup-step2.tsx` (1건 매치 = OK) | ❌ Wave 4 |
| D-11b | booking confirm terms-agreement 변경 없음 | regression-grep | `git diff main -- apps/web/components/booking/terms-agreement.tsx` (= empty) | ❌ Wave 0 |
| D-12 | Build 산출물 HTML 에 `<meta name="robots" content="index, follow">` | build-artifact grep | `grep -E 'name="robots"' apps/web/.next/server/app/legal/terms*.html` | ❌ Wave 5 |
| D-13 | Build 산출물 HTML 에 `<title>` + canonical link 매치 | build-artifact grep | `grep -E '<title>이용약관' && grep -E 'rel="canonical".*heygrabit.com/legal/terms'` | ❌ Wave 5 |
| D-14 | JSON-LD 미포함 | regression-grep | `! grep -E 'application/ld\+json' apps/web/.next/server/app/legal/` | ❌ Wave 5 |
| D-15 | mailbox 수신 검증 완료 | manual UAT | 외부 → `support@/privacy@heygrabit.com` 발송 후 inbox 도착 확인 | N/A (external) |

### Sampling Rate

- **Per task commit:** 변경 파일 관련 테스트 (`pnpm --filter @grabit/web test -- <pattern>`).
- **Per wave merge:** Full vitest suite (`pnpm --filter @grabit/web test`) + lint + typecheck.
- **Pre-cutover gate:** Full build (`pnpm --filter @grabit/web build`) + 빌드 산출물 grep 5종 (D-07, D-10b, D-12, D-13, D-14) + HUMAN-UAT cutover 체크리스트.

### Wave 0 Gaps

- [ ] `apps/web/components/legal/__tests__/terms-markdown.test.tsx` (신규) — `showH1` prop 양방향 unit 테스트 (default false, explicit true) — D-09 커버
- [ ] `apps/web/app/__tests__/legal-pages.test.tsx` (신규, optional) — page.tsx 모듈 import 시 Metadata export 존재 확인 (smoke). **고려사항:** Next 16 page.tsx 는 server component 이므로 vitest jsdom 환경에서 직접 render 어려움 — `import { metadata } from '@/app/legal/terms/page'` 만 검증하는 형태로 한정.
- [ ] (선택) Playwright e2e: `/legal/terms`, `/legal/privacy`, `/legal/marketing` 200 + H1 텍스트 매치 — Phase 16 의 e2e 가치는 build-artifact grep 으로 대체 가능. **e2e 추가 권장하지 않음** — 1인 개발 복잡도 최소화.

*기존 test 인프라가 vitest + RTL 로 충분 — 추가 framework install 불필요.*

### Manual UAT (HUMAN-UAT.md)

| # | Item | Gate |
|---|------|------|
| UAT-1 | 3개 MD 의 placeholder 모두 실값 주입 완료 (사업자등록 후) | cutover prereq |
| UAT-2 | 시행일이 cutover 일자(예: 2026-04-29)로 통일 (D-08) | cutover prereq |
| UAT-3 | mailbox 수신 검증: 외부 메일 → `support@heygrabit.com` 발송 → inbox 도착 (D-15) | cutover prereq |
| UAT-4 | mailbox 수신 검증: 외부 메일 → `privacy@heygrabit.com` 발송 → inbox 도착 (D-15) | cutover prereq |
| UAT-5 | prod 환경에서 `https://heygrabit.com/legal/terms` HTTP 200 + 본문 렌더 | post-deploy |
| UAT-6 | prod `https://heygrabit.com/legal/privacy` HTTP 200 + 본문 렌더 | post-deploy |
| UAT-7 | prod `https://heygrabit.com/legal/marketing` HTTP 200 + 본문 렌더 | post-deploy |
| UAT-8 | prod Footer 클릭: 이용약관 → `/legal/terms` 이동 | post-deploy |
| UAT-9 | prod Footer 클릭: 개인정보처리방침 → `/legal/privacy` 이동 | post-deploy |
| UAT-10 | prod Footer 클릭: 고객센터 → OS 메일 클라이언트에 `support@heygrabit.com` prefilled | post-deploy |
| UAT-11 | 회원가입 step 2 → 약관 보기 dialog: 본문 정상 + draft banner 미표시 | post-deploy |
| UAT-12 | 회원가입 step 2 → 동의 체크박스 / 다음 버튼 동작 정상 (회귀 없음, D-11) | post-deploy |
| UAT-13 | (선택) Google Search Console 색인 요청 (D-12) | post-launch |

---

## Dependencies & Sequencing recommendation

### Wave 분할 권고 (4-axis 작업 순서)

본 phase 는 의존 그래프가 명확하고 짧음 — **단일 PR + 4 ~ 5 wave commit 분리** 권장:

```
Wave 0 (테스트 인프라 / 회귀 안전망)
└─ apps/web/components/legal/__tests__/terms-markdown.test.tsx (신규)
   - showH1=false → H1 없음 + 기존 매핑 보존
   - showH1=true → H1 렌더 + className 매치
   - 기존 8개 노드 매핑 (h2/h3/p/ul/ol/li/strong/a/hr) 변경 없음 회귀 검증

Wave 1 (Axis 1: 공개 URL 신규)
├─ apps/web/components/legal/terms-markdown.tsx (showH1 prop 추가)
├─ apps/web/app/legal/layout.tsx (신규)
├─ apps/web/app/legal/terms/page.tsx (신규)
├─ apps/web/app/legal/privacy/page.tsx (신규)
└─ apps/web/app/legal/marketing/page.tsx (신규)
   Verify: pnpm --filter @grabit/web typecheck && build && Wave 0 tests green

Wave 2 (Axis 2: Footer 링크)
└─ apps/web/components/layout/footer.tsx (3개 href 교체)

Wave 3 (Axis 3: MD 콘텐츠 placeholder 보강)
├─ apps/web/content/legal/terms-of-service.md
├─ apps/web/content/legal/privacy-policy.md
└─ apps/web/content/legal/marketing-consent.md
   ※ 시행일은 placeholder 로 두고, 실값 주입은 D-08 의 cutover 작업에서

Wave 4 (Axis 4: LegalDraftBanner 제거)
├─ DELETE apps/web/components/legal/legal-draft-banner.tsx
└─ apps/web/components/auth/signup-step2.tsx (import + JSX 제거)
   Verify: signup-step2 dialog 회귀 없음, D-05/D-11 grep checks pass

Wave 5 (Cutover D-day, 별도 commit/PR — 사용자 작업 후)
├─ MD 3개의 placeholder 실값 주입 (사업자등록번호 등)
├─ 시행일 placeholder → 실 cutover 일자 교체 (D-08)
└─ Build 산출물 grep 검증 (D-07/D-10b/D-12/D-13/D-14) + HUMAN-UAT cutover 게이트
```

**Wave 1 ↔ Wave 2 순서 중요:** Wave 1 이 먼저 — Footer 가 가리키는 라우트가 존재해야 Wave 2 의 href 교체가 의미를 가짐. Wave 2 만 단독 머지 시 prod 에서 404 발생.

**Wave 4 의 위치:** Wave 4 는 Wave 1~3 과 독립 — 어느 시점에 둬도 무관. 다만 **공개 페이지가 라이브 되기 전(Wave 5 cutover 이전)에 LegalDraftBanner 가 사라져야** 일관성. 그렇지 않으면 dialog 에서 사라졌으나 공개 페이지 등장 후 footer 링크 클릭 → '초안' 표시가 어디에서도 안 보임 + 사용자가 dialog 와 비교할 때 유의미한 차이 없음 → 무해. **순서 무관.**

### Single-PR vs Split-PR

**권장: 단일 PR (Phase 16 통합)** — 4~5 wave 가 모두 `gsd/phase-16-legal-pages-launch-url` 브랜치에서 sequential commit. 이유:
- 4-axis 가 한 phase 의 한 목적("법적 공개 URL 런칭") 으로 묶여 있어 review 단위가 같음.
- Wave 1 이 Wave 2 의 prereq — split PR 시 dependency 관리 부담.
- 1인 개발 복잡도 최소화 (CLAUDE.md 원칙).

**예외:** Wave 5 (cutover) 는 별도 PR/commit — 사용자가 사업자등록 완료 후 별도 시점에 머지. Phase 16 본 PR 은 placeholder 상태로 머지하고, cutover PR 이 placeholder → 실값 교체만 담당.

### Worktree

`.planning/config.json` 의 `use_worktrees: true` 적용 — Phase 16 작업은 `gsd/phase-16-legal-pages-launch-url` 브랜치 + worktree (이미 워크플로우 표준).

---

## Out-of-Scope Reaffirmation

CONTEXT §deferred + UI-SPEC §Out-of-Scope 와 일치:

- **JSON-LD `WebPage` 스키마** — D-14, SEO 개선 phase 에서 일괄 도입.
- **breadcrumb / back-link / TOC** — UI-SPEC 단순 layout 채택.
- **anchor 링크 자동 생성** (`<h2 id=...>`).
- **PDF 다운로드 버튼**.
- **scroll spy / sticky nav / in-page search**.
- **`/legal/contact` (FAQ/CS 페이지)** — Footer mailto 로 대체.
- **쿠키 동의 배너** — GDPR/eprivacy 별도 phase.
- **약관 동의 이력 DB 저장** (`legal_consents` 테이블 + signup INSERT).
- **약관 변경 시 회원 재동의 알림** (마이페이지 푸시/이메일).
- **회원 마이페이지 마케팅 수신 동의 철회 UI**.
- **dialog UX 변경** (체크박스 layout, Dialog 본문 구조) — D-11.
- **booking confirm terms-agreement 컴포넌트 수정** — Phase 16 범위 밖. (`grep` 결과 TermsMarkdown / LegalDraftBanner 미사용 [VERIFIED]).
- **Header / Footer / MobileTabBar 시각 변경** — Footer href 교체에 한정.
- **`globals.css` 토큰 추가/수정** — UI-SPEC 의 "기존 토큰 재사용, 새 토큰 도입 금지" 원칙.
- **다크 모드 / i18n / 다국어** — 한국어 단독.
- **사업자 식별정보 실값 주입** — D-07 사용자 직접 작업.
- **mailbox 운영 (DNS MX/alias 설정)** — D-15 별도 quick-task.
- **신규 의존성 install** — react-markdown / remark-gfm / raw-loader 모두 기존 설치.
- **재무·회계·결제 흐름 변경** — Phase 16 은 정적 콘텐츠 phase.

---

## Runtime State Inventory

> Phase 16 은 rename/refactor 가 아닌 **신규 라우트 추가 + 컴포넌트 1개 삭제** phase 이지만, Axis 4 의 컴포넌트 삭제가 잔존 import / 빌드 캐시에 영향 가능 — 따라서 간이 inventory 수행.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by grep (`legal-draft-banner` / `LegalDraftBanner` 만 검색) — DB 에 저장된 없음 | none |
| Live service config | None — Footer placeholder href="#" 는 코드 only. n8n/Datadog/Tailscale 설정과 무관 | none |
| OS-registered state | None — Phase 16 은 빌드/배포 외 OS 등록 작업 없음 (Cloud Run revision 만 — 자동 배포 표준 흐름) | none |
| Secrets/env vars | None — `.env` 추가 없음. `next.config.ts` 도 `NEXT_PUBLIC_R2_HOSTNAME` 외 신규 변수 없음 | none |
| Build artifacts / installed packages | `apps/web/.next/` 캐시는 `LegalDraftBanner` 컴포넌트의 stale chunk 보유 가능. CI 의 `pnpm build` 가 fresh build 이므로 prod 영향 없음. 로컬 dev 의 `.next` 캐시는 `next dev --turbopack` 이 자동 무효화. | (선택) 로컬에서 Wave 4 후 `rm -rf apps/web/.next` 한 번 실행 권장 — 안전 마진 |

**Nothing found in 4 of 5 categories** — verified by codebase grep.

---

## Environment Availability

> Phase 16 은 외부 서비스/CLI 의존성 거의 없음 — 다만 빌드/테스트 도구 확인.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next 16 build/test | ✓ | v24.13.0 (≥ 20.9 요구) | — |
| pnpm | monorepo workspace | ✓ | 10.28.1 | — |
| Next.js | App Router routing/SSG | ✓ | ^16.2.0 (verified package.json) | — |
| react-markdown | TermsMarkdown 렌더 | ✓ | ^10.1.0 | — |
| remark-gfm | GFM 테이블 렌더 (개정 이력 표) | ✓ | ^4.0.1 | — |
| raw-loader | MD raw import (Turbopack rule) | ✓ | ^4.0.2 (devDep) | — |
| vitest | unit test (terms-markdown.test.tsx) | ✓ | ^3.2.0 | — |
| @testing-library/react | DOM 검증 | ✓ | ^16.3.0 | — |
| Cloud Run + Cloudflare CDN | prod 정적 응답 | ✓ | (existing infra) | — |
| Resend (no-reply@heygrabit.com) | Phase 16 *코드* 영향 없음 (Phase 15 cutover 완료) | ✓ | — | — |
| **mailbox 수신 (`support@`/`privacy@heygrabit.com`)** | **D-15 cutover prereq** | **✗** | — | **Mailbox 운영 quick-task — Phase 16 코드와 분리** |

**Missing dependencies with no fallback:** mailbox 수신 (D-15) — Phase 16 code 머지는 가능하나 prod cutover 는 mailbox 검증 후.

**Missing dependencies with fallback:** none.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 한국 개보법 30조 1항의 필수 기재 항목 (개인정보 보호책임자 정보·자동수집·국외이전 등) 매핑 | §Compliance Mapping | LOW — privacy-policy.md L1 이 "개인정보 보호법 제30조에 따라" 명시 + 기존 콘텐츠가 KOPICO 기반(diagnosis 보고서 verified). 본 phase 의 보강 항목(보호책임자 실명·전화·개정 이력)은 관행 충족 — 사용자 법무 검토 시 추가 보강 가능. |
| A2 | 한국 약관 시행일 표기 형식 ("2026년 4월 29일부터 시행") | §Compliance Mapping + §Implementation Approach Axis 3 | LOW — 한국 약관 관행 + 기존 MD 형식 일관 유지. ISO 8601 (`2026-04-29`) 단독 표기 허용 여부와 무관. |
| A3 | 사업자 식별정보 노출 의무 위치(이용약관 본문 / Footer / 양쪽) | §Compliance Mapping | MEDIUM — 본 phase 는 약관 본문에만 추가. Footer 추가는 deferred. PG 심사 / 법무 검토 시 Footer 추가 요구 가능 — 별도 phase 로 처리. |
| A4 | `react-markdown` v10 의 `Components` 타입 시그니처 (`h1` 의 props 타입) | §Critical Code Patterns §showH1 | LOW — 기존 `terms-markdown.tsx:13-41` 에서 동일 패턴 (h2~hr) 동작 확인. v10 의 type export 가 정상. UI-SPEC L93-119 도 동일 시그니처 lock. |
| A5 | `apps/web/.next/server/app/legal/{slug}/page.html` build artifact path 형식 | §Validation §Build artifact | LOW — Next 16 의 standalone output 표준 path. 정확한 path 는 첫 빌드 후 검증. grep 의 path glob 으로 변동 흡수 가능 (`apps/web/.next/server/app/legal/**/*.html`). |
| A6 | dialog 본문에 공개 URL 보조 링크 추가 여부 (D-11 의 "선택 사항") | §Implementation Approach + §Risks | LOW — Plan 이 결정. 추가 시 색상/크기 contract 는 UI-SPEC L406 에 lock. **본 phase 의 default 권장: 추가하지 않음** (1인 개발 복잡도 최소화 + dialog UX 변경 금지 정신). |
| A7 | Sentry instrumentation 자동 적용 (정적 페이지 영향 없음) | §Risks §R5 | LOW — `@sentry/nextjs withSentryConfig` 는 root config wrap 으로 page-level 코드 0건. SSG prerender 와 충돌 사례 없음 (Sentry 공식 가이드 verified via Phase 15 cutover 경험). |
| A8 | `@grabit/web` package 의 lint/typecheck/test/build 스크립트가 그대로 유효 | §Validation §Test Framework | LOW — package.json verified 2026-04-28. |

**Assumptions 모두 LOW~MEDIUM** — 본 phase 의 lock 강도가 높아 unverified claim 의 영향이 작음. A3 만 MEDIUM (Footer 사업자 정보 추가 여부 — 사용자 법무 검토 후 별도 phase 결정).

---

## Open Questions

1. **dialog 하단 보조 링크 (D-11 선택 사항)**
   - What we know: UI-SPEC L406 가 색상/크기 contract 만 명시 (`text-caption text-gray-500 underline hover:text-primary` 톤의 `전체 보기 →`). Plan 재량.
   - What's unclear: 추가 vs 미추가의 사용자 가치 — dialog 사용 흐름에서 "더 자세한 약관 → 새 탭" 이 의미 있는가? (단순 정보 노출 의미 vs 가입 흐름 이탈 위험)
   - Recommendation: **미추가 권장** — 1인 개발 복잡도 최소화 + dialog UX 변경 금지 정신 (D-11) + 가입 이탈 위험 회피. 추후 사용자 피드백으로 결정.

2. **개정 이력 표 첫 row 의 v1.0 표기 정합성**
   - What we know: 기존 MD 의 시행일이 "2026년 4월 14일" 로 작성되어 있음 (terms-of-service.md L78, privacy-policy.md L93, marketing-consent.md L32) — Phase 9 작성 시점.
   - What's unclear: v1.0 = 2026-04-14 가 "실제 prod 라이브" 일자인가, "MD 작성" 일자인가?
   - Recommendation: 진실은 후자 — Phase 9 코드 작성 일자. Phase 16 cutover 가 첫 라이브 → **개정 이력 표는 v1.0 = (Phase 16 cutover 일자) 단일 row 만**. "이전 시행일" 개념은 사실상 의미 없음. **사용자 법무 검토 시 결정** — 본 phase 는 placeholder 로 두고 사용자 직접 주입.

3. **Build artifact grep 의 정확한 path**
   - What we know: Next 16 standalone build 의 output 은 `apps/web/.next/server/app/...` 구조. 정적 라우트는 `.html` 또는 `.rsc` 산출물.
   - What's unclear: SSG 페이지의 정확한 파일 이름 — `apps/web/.next/server/app/legal/terms/page.html` vs `apps/web/.next/server/app/legal/terms.html` vs `apps/web/.next/server/pages/legal/terms.html`.
   - Recommendation: **첫 빌드 후 `find apps/web/.next -name "*.html" -path "*legal*"` 로 정확 경로 확인** — Plan 의 검증 스크립트 작성 시 glob (`**/*.html`) 으로 안전 처리.

---

## Sources

### Primary (HIGH confidence — Context7 / official docs)

- **Next.js Metadata API** — [VERIFIED: Context7 docs/01-app/03-api-reference/04-functions/generate-metadata.mdx]
  - `alternates.canonical` 사용 패턴
  - `robots: { index, follow }` 패턴
  - static metadata vs generateMetadata 구분
- **Next.js Route Segment Config** — [VERIFIED: Context7 docs/01-app/02-guides/caching-without-cache-components.mdx]
  - `export const dynamic = 'auto' | 'force-dynamic' | 'error' | 'force-static'` enum
- **Next.js force-static for Route Handler** — [VERIFIED: Context7 docs/01-app/02-guides/backend-for-frontend.mdx]

### Secondary (HIGH confidence — codebase grep)

- `apps/web/package.json` — verified package versions (next ^16.2.0, react ^19.1.0, react-markdown ^10.1.0, remark-gfm ^4.0.1, raw-loader ^4.0.2)
- `apps/web/next.config.ts:44-49` — turbopack `*.md → raw-loader` rule
- `apps/web/env.d.ts:4` — `declare module '*.md'` type declaration
- `apps/web/app/layout.tsx` + `apps/web/app/layout-shell.tsx` — root layout / Header/Footer 자동 상속 동작
- `apps/web/components/legal/terms-markdown.tsx` — 기존 8개 노드 매핑 (h2~hr) verified
- `apps/web/components/booking/terms-agreement.tsx` — TermsMarkdown / LegalDraftBanner 미사용 verified (D-11 영향 범위 확정)
- `apps/web/components/auth/signup-step2.tsx` — LegalDraftBanner 유일 사용처 verified (Grep: 1 file matched)
- `.planning/phases/16-legal-pages-launch-url/16-CONTEXT.md` — D-01~D-15 lock
- `.planning/phases/16-legal-pages-launch-url/16-UI-SPEC.md` — 시각/카피/Layout 계약 lock
- `.planning/debug/legal-pages-404-heygrabit.md` — pre-existing gap 진단 (8개 권장 항목)

### Tertiary (LOW confidence — needs validation by user/legal)

- 한국 개보법 30조 1항 필수 기재 항목 매핑 [ASSUMED] — 사용자 법무 검토 필요
- 한국 약관 시행일 표기 형식 [ASSUMED] — 관행 기반, 강제 형식 아님
- 사업자 식별정보 Footer 노출 의무 [ASSUMED] — PG 심사 시 추가 요구 가능

---

## Metadata

**Confidence breakdown:**
- Standard stack (Next 16/React 19/raw-loader/Turbopack): **HIGH** — Context7 + codebase grep 양방 verified
- Architecture (4-axis 분할 + Wave 시퀀싱): **HIGH** — CONTEXT.md + UI-SPEC.md 가 강한 lock 제공
- Compliance mapping (개보법·정통망법·전자상거래법 항목): **MEDIUM** — Claude 학습 지식 기반 [ASSUMED], 사용자 법무 검토 필요
- Pitfalls (dialog 회귀, placeholder leak, mailbox prereq): **HIGH** — codebase grep 기반 + 사용자 명시 결정(D-11/D-15)
- Validation (test pyramid + build artifact grep): **HIGH** — vitest 인프라 verified + grep 패턴 단순

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30일 — Next 16 / react-markdown 안정 stack)
**Related artifacts:**
- `.planning/phases/16-legal-pages-launch-url/16-CONTEXT.md` (D-01~D-15)
- `.planning/phases/16-legal-pages-launch-url/16-UI-SPEC.md` (시각·카피·Layout 계약)
- `.planning/phases/16-legal-pages-launch-url/16-DISCUSSION-LOG.md` (논의 로그)
- `.planning/debug/legal-pages-404-heygrabit.md` (pre-existing gap 진단)

---

*Phase: 16-legal-pages-launch-url*
*Research completed: 2026-04-28*
