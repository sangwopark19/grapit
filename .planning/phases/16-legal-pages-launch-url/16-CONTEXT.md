# Phase 16: Legal pages launch — 이용약관/개인정보처리방침/마케팅동의 공개 URL 구현 - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

한국 개인정보보호법·정보통신망법상 상시 공개 URL 요건을 충족하기 위해, 기존에 모달 dialog 안에서만 노출되던 3개 법적 문서(이용약관·개인정보처리방침·마케팅 수신 동의)를 App Router 의 영구 공개 페이지(`/legal/{terms,privacy,marketing}`)로 게시하고, Footer 의 placeholder `href="#"` 링크를 실제 경로로 교체한다. 콘텐츠 측면에서는 런칭 직전 phase 임을 전제로 LegalDraftBanner 를 제거하고 시행일·사업자 식별정보·개정 이력 같은 법정 필수 기재 사항을 보강한다. dialog UX 와 약관 동의 플로우는 변경하지 않는다.

본 phase 는 "URL 공개 + Footer 링크 + 콘텐츠 보강 + draft 표시 제거"의 4축 단일 phase이다. 약관 동의 이력 DB 저장, 쿠키 동의 배너, FAQ/CS 페이지 같은 새로운 capability 는 별도 phase 로 분리한다.

</domain>

<decisions>
## Implementation Decisions

### Routing & URL Structure
- **D-01:** 공개 경로는 `/legal/{terms,privacy,marketing}` 단일 그룹 — 짧은 별칭(`/terms` 등)이나 redirect 는 두지 않는다. 추후 `/legal/cookies` 등 확장 시 그룹 layout 공유 가능. 디렉토리는 `apps/web/app/legal/{terms,privacy,marketing}/page.tsx` 로 둔다 (route group `(legal)` 대신 명시적 `/legal/` URL 세그먼트 노출).
- **D-02:** `apps/web/app/legal/layout.tsx` 를 추가해 3개 페이지가 공통 컨테이너(상하 여백·max-width·main 랜드마크) + heading 구조를 공유한다. 기존 root layout 의 Header/Footer 는 자동 상속되므로 중복 렌더링 금지.
- **D-03:** Footer (`apps/web/components/layout/footer.tsx`) 의 3개 placeholder 링크 처리:
  - "이용약관" → `Link href="/legal/terms"`
  - "개인정보처리방침" → `Link href="/legal/privacy"` (font-semibold 유지 — 정통망법상 강조 의무)
  - "고객센터" → `<a href="mailto:support@heygrabit.com">` (Phase 16 scope 한도; FAQ/CS 페이지는 별도 phase)
- **D-04:** 마케팅 수신 동의 페이지 `/legal/marketing` 도 Footer 에는 노출하지 않는다 — 이용약관/개인정보처리방침과 달리 회원가입 동의 모달에서만 참조하면 충분. 단 페이지 자체는 dialog 와 향후 마이페이지 동의 철회 화면을 위해 공개해 둔다.

### Content & Draft Status
- **D-05:** `LegalDraftBanner` (`apps/web/components/legal/legal-draft-banner.tsx`) 는 컴포넌트 자체를 삭제하고, 유일한 사용처인 `apps/web/components/auth/signup-step2.tsx` 의 import + JSX 도 함께 제거한다. 이로써 dialog · 공개 페이지 양쪽에서 'draft' 표시가 사라진다 (런칭 시 법무 검토 완료 가정).
- **D-06:** 3개 MD 하단에 법정 필수 기재 섹션을 보강한다 (구조만 — 실값은 사용자가 주입). MD 내부 placeholder 토큰을 사용하여 빌드 시 치환하지 않고, MD 안에 그대로 한국어 문구로 작성:
  - 이용약관: 시행일, 사업자명·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처
  - 개인정보처리방침: 시행일, 직전 시행일(개정 이력), 개인정보 보호책임자 실명/직책/이메일/전화 (현재는 "Grabit 대표" 만 있음)
  - 마케팅 수신 동의: 시행일
- **D-07:** 사업자등록번호·통신판매업 신고번호·대표자명·정확한 주소 같은 1인 개발자 실값은 사용자가 등록 완료 후 직접 MD 에 채워 넣는다. Plan 은 placeholder 자리(예: `[사업자등록번호: 000-00-00000]`)를 만들고 PR description / HUMAN-UAT 에 사용자 작업 항목으로 명시. 빈 placeholder 상태로 prod 배포 금지(verification 단계에서 `\[.*\]` 매치 검사).
- **D-08:** 시행일은 본 phase 의 prod cutover 일자(예상 2026-04-29 ± Mailbox quick-task 완료일에 맞춤)로 통일. MD 작성 시점이 아니라 cutover 시점 기준이므로 Plan 의 D-day 작업 항목으로 분리.

### Rendering Pattern
- **D-09:** `TermsMarkdown` (`apps/web/components/legal/terms-markdown.tsx`) 에 `showH1?: boolean` prop 추가 (기본 `false` 로 dialog 하위 호환 유지). `true` 일 때만 `h1` 을 `text-display` 토큰으로 렌더. `'use client'` 지시문은 그대로 두지만 server component 인 `page.tsx` 에서 import 해 사용 가능 (React 의 client/server boundary 가 자동 처리).
- **D-10:** 3개 `page.tsx` 는 server component 로 작성하고 SSG 가 적용되도록 `export const dynamic = 'force-static'` 명시. raw-loader 로 import 한 MD 문자열을 `<TermsMarkdown showH1>` 에 전달. 빌드 산출물에 정적 HTML 포함 → CDN/Cloud Run 모두 fast 응답.
- **D-11:** dialog UX 는 변경 금지. `signup-step2` / `booking confirm terms-agreement` 는 기존 Dialog 안의 `<TermsMarkdown>{...}</TermsMarkdown>` 그대로 유지(D-05 에 따라 LegalDraftBanner 제거만 적용). 동의 체크박스 회귀 위험 최소화. 공개 URL 은 Footer 와 `signup-step2` 모달 하단 보조 링크로만 추가 노출 가능 (선택 사항 — Plan 에서 결정).

### SEO & Metadata
- **D-12:** 3개 페이지 모두 검색 엔진 색인을 허용한다(`robots: { index: true, follow: true }` 명시 또는 기본값 사용). PG·도메인 verification·브랜드 검색 노출 이점이 더 크다.
- **D-13:** 각 `page.tsx` 는 Next.js `Metadata` 객체로 다음을 export:
  - `title`: "이용약관 — Grabit" / "개인정보처리방침 — Grabit" / "마케팅 정보 수신 동의 — Grabit"
  - `description`: 1 문장 요약 (~120자 이내)
  - `alternates.canonical`: `https://heygrabit.com/legal/{terms,privacy,marketing}`
- **D-14:** JSON-LD `WebPage` 스키마는 본 phase 에 포함하지 않는다 (관리 비용 대비 효과 낮음). 추후 SEO 개선 phase 에서 검토.

### External Dependencies (Operations)
- **D-15:** `privacy@heygrabit.com` / `support@heygrabit.com` mailbox 실개통(수신 가능)은 Phase 16 의 hard prerequisite 로 명시하되, DNS MX/alias 설정·테스트 수신은 코드 외 운영 작업이므로 별도 quick-task 로 분리한다. Phase 16 의 `HUMAN-UAT.md` 에 "mailbox 수신 검증 완료" 체크 항목을 두어 cutover 게이트로 사용. quick-task 완료 전에는 Phase 16 prod 배포 금지.

### Claude's Discretion
- 각 `page.tsx` 의 본문 위 breadcrumb/뒤로가기 UI 는 디자인 통일성 차원에서 Plan/UI-SPEC 단계에서 자유롭게 결정. 단순 layout container 만으로 충분하면 추가 UI 없음 가능.
- `apps/web/app/legal/layout.tsx` 의 max-width/타이포는 기존 toCSS 토큰(globals.css)을 재사용. 새 토큰 도입 금지.
- 마케팅 수신 동의 페이지의 길이가 32라인으로 짧아 단일 페이지로 충분 — 별도 분리 섹션 없음.
- Plan 단계에서 "공개 URL 등록 후 LegalDraftBanner 컴포넌트·signup-step2 import 정리" 를 단일 commit 으로 묶을지 분리할지는 plan-phase 가 결정.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 16 Diagnosis & Background
- `.planning/debug/legal-pages-404-heygrabit.md` — Pre-existing gap 진단 보고서. App Router 에 어떤 page.tsx/route.ts 도 매핑되지 않은 사실, Phase 09-tech-debt DEBT-02 의 dialog-only 구현 의도, 권장 fix 방향(8개 항목) 정리.
- `.planning/STATE.md` Roadmap Evolution L80 — Phase 16 가 Phase 13 UAT Gap test 11 에서 도출된 pre-existing feature gap 임을 기록.
- `.planning/ROADMAP.md` L271-279 — Phase 16 정의 (Goal "[To be planned]" 이지만 description 에 scope 윤곽 명시).

### Existing Legal Content & Components (수정 대상)
- `apps/web/content/legal/terms-of-service.md` (78L) — 이용약관 KOPICO 기반 초안. D-06 에 따라 시행일·사업자정보 보강 대상.
- `apps/web/content/legal/privacy-policy.md` (93L) — 개인정보처리방침. 현 L82-86 "개인정보 보호책임자: Grabit 대표" 만 있어 실명/직책/연락처 보강 필요. L89 시행일 표기 확정 필요.
- `apps/web/content/legal/marketing-consent.md` (32L) — 마케팅 수신 동의. 시행일 추가만 필요.
- `apps/web/components/legal/terms-markdown.tsx` — D-09 에 따라 `showH1` prop 추가 대상. 현 `h1: () => null` 은 dialog 호환 위해 유지.
- `apps/web/components/legal/legal-draft-banner.tsx` — D-05 에 따라 컴포넌트 삭제 대상.
- `apps/web/components/auth/signup-step2.tsx` L15-19, L191 — `legal-draft-banner` import 제거 + JSX 사용처 제거. `LEGAL_CONTENT[dialogKey].content` 부분은 유지.
- `apps/web/components/layout/footer.tsx` — D-03 에 따라 placeholder 3개 링크 교체.

### Routing & Build
- `apps/web/next.config.ts` L46-49 turbopack rules — `*.md → raw-loader` 규칙은 기존대로 유지(D-10 의 SSG 가 raw 문자열을 받아 렌더). redirects 추가 없음 (D-01).
- `apps/web/app/layout.tsx` — root layout. Header + Footer 가 모든 라우트에 노출되므로 `apps/web/app/legal/layout.tsx` 는 container 만 담당.

### Phase 13 Lineage (브랜드 일관성)
- `.planning/phases/13-grapit-grabit-rename/13-CONTEXT.md` — `support@heygrabit.com`/`privacy@heygrabit.com` 이메일 도메인이 Phase 13 P02 D-07 에서 확정된 값. 본 phase 콘텐츠가 동일 도메인 사용.
- `apps/web/scripts/audit-brand-rename.sh` — `apps/web/app/legal/` 경로를 검증식에 명시한 흔적 (Phase 13-VALIDATION.md L66) — 본 phase 가 그 경로를 실제로 만든다는 점에서 경로 컨벤션 정합성 확보.

### Phase 13 Deferred Operations (Phase 16 prereq)
- `.planning/debug/password-reset-email-not-delivered-prod.md` — Phase 15 가 이미 `no-reply@heygrabit.com` 송신 cutover 를 마쳤으나, 본 phase 가 노출시키는 `privacy@`/`support@` mailbox 의 *수신* 인프라(MX/alias)는 별도 작업. Phase 13 P04 "Additional post-phase tasks" 에 mailbox 개통이 deferred 로 남아 있음 (D-15 quick-task 의 출처).

### Spec Lock
없음 — `*-SPEC.md` 미생성 (`/gsd-spec-phase` 미실행). 본 CONTEXT.md 가 단독 spec 역할 수행.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TermsMarkdown` (`apps/web/components/legal/terms-markdown.tsx`): h2/h3/p/ul/ol/li/strong/a/hr 8개 노드를 UI-SPEC §Typography 토큰(`text-base`, `text-caption`, `text-primary`)으로 매핑한 client component. `showH1` prop 만 추가하면 공개 페이지 헤더 노출 + dialog 호환을 모두 만족.
- raw-loader (`apps/web/next.config.ts:48`): `*.md → raw-loader` Turbopack 규칙이 이미 활성화. `import termsMd from '@/content/legal/terms-of-service.md'` 패턴이 server component(`page.tsx`)에서도 동작 — 별도 fs read 없이 정적 import 가능.
- shadcn Dialog (`apps/web/components/auth/signup-step2.tsx:191`): 기존 사용 그대로. dialog 본문이 `LEGAL_CONTENT[dialogKey].content` 객체에서 분기되므로 컴포넌트 변경 영향 없음.
- Footer (`apps/web/components/layout/footer.tsx:3-29`): 28라인의 단순 server component. Link 3개의 `href="#"` → 실제 경로 교체만 하면 됨.

### Established Patterns
- App Router 라우트 컨벤션: 18 개 page.tsx 가 모두 `apps/web/app/{domain}/...` 패턴. `legal/` 도 `genre/`, `mypage/`, `performance/` 와 동일한 평면 구조로 두는 것이 자연스러움.
- Next.js Metadata: 다른 page.tsx (예: `genre/[slug]/page.tsx`) 가 `export const metadata: Metadata = {...}` 패턴 사용. 동일 패턴 차용.
- SSG 강제: 기존 정적 페이지에서는 명시적 `force-static` 이 없는 곳이 많지만, 법적 문서는 명시하는 것이 prerender 보장 + Cloud Run cold-path 회피에 안전.
- 클라이언트 컴포넌트의 server import: 다른 페이지(예: home/hot-section.tsx)도 `'use client'` 컴포넌트를 server component 인 `page.tsx` 에서 그대로 import 함. TermsMarkdown 도 동일 패턴.

### Integration Points
- Footer 는 root `apps/web/app/layout.tsx` 에서 항상 렌더링되므로 D-03 변경은 모든 라우트에 즉시 노출.
- signup-step2 는 회원가입 step 2 의 핵심 컴포넌트 — D-05 의 LegalDraftBanner 제거가 회원가입 동의 UI 에 영향. 단순 시각 요소 제거(텍스트 동의 흐름 무관)이지만 시각적 회귀 테스트는 필요.
- booking confirm terms-agreement (별도 컴포넌트) — Phase 16 에서는 건드리지 않음. dialog 내부의 LegalDraftBanner 가 booking 쪽에는 없을 가능성 큼 (확인은 Plan 단계 grep 으로).
- Sentry: 새 라우트 3개 추가 — 기본 instrumentation 자동 포함. 별도 작업 없음.
- Resend: D-15 mailbox 는 *수신* 이라 Phase 15 의 *송신* (`no-reply@`) 와 별개 인프라. 충돌 없음.

</code_context>

<specifics>
## Specific Ideas

- 사용자는 "런칭 직전 phase" 라는 시간 축을 명확히 인식. 본 phase 의 모든 결정이 "PG 심사·도메인 verification·법무 리스크" 를 향한다는 일관된 방향성을 보임.
- D-07 의 사업자 식별정보 placeholder 방식은 사용자가 1인 개발자(개인사업자 등록 진행 가능성)이고, 실값 주입을 본인이 직접 하겠다는 명시적 의도 반영.
- D-12 의 SEO 정책에서 사용자는 "Index 허용" 을 즉답 — 브랜드 노출/도메인 verification 과의 trade-off 를 사전 인지한 결정.
- LegalDraftBanner 처리에서 컴포넌트 자체 소멸 방향(B1 옵션 1) 선택 — ENV 플래그 같은 운영 복잡도 회피 선호 패턴 확인.

</specifics>

<deferred>
## Deferred Ideas

- **쿠키 동의 배너**: GDPR/eprivacy 류 쿠키 배너는 별도 phase. 한국 개보법은 명시적 의무 아님이지만 EU 사용자 노출 시 위험. 출시 후 트래픽 모니터링 후 결정.
- **회원 약관 동의 이력 DB 저장**: 현재 회원가입 동의는 client state 만 — 어떤 시점에 어떤 버전 약관에 동의했는지 DB 미저장. 분쟁 대비 audit trail 필요. 별도 phase 로 약관 버전 테이블(`legal_consents`) + signup 시점 INSERT.
- **약관 변경 시 회원 재동의 알림 시스템**: D-06 의 시행일·개정 이력 표기와 별도로, 변경 시 마이페이지 푸시/이메일 알림 flow. 별도 phase.
- **/legal/contact (FAQ/CS 페이지)**: D-03 의 Footer 고객센터를 mailto 로 처리했으므로, 정식 고객센터 페이지는 별도 phase. 운영 트래픽 분석 후 우선순위 결정.
- **JSON-LD `WebPage` 스키마 추가**: D-14 에 따라 본 phase 에는 미포함. SEO 개선 phase 에서 일괄 추가 검토.
- **회원 마이페이지 마케팅 수신 동의 철회 UI**: marketing-consent.md 가 공개되면 자연스럽게 따라오는 화면. 별도 phase.
- **TOC (목차) 자동 생성**: 약관/개보처가 80-100라인 정도라 본 phase 에선 불필요. 콘텐츠가 길어지면 별도 phase 로 도입.
- **이용약관 PDF 다운로드 버튼**: 일부 사용자가 PDF 보존 선호. 별도 phase.

</deferred>

---

*Phase: 16-legal-pages-launch-url*
*Context gathered: 2026-04-27*
