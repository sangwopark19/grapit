---
status: diagnosed
trigger: "heygrabit.com/terms, /privacy, /marketing 접속 시 404. 법적 문서는 MD 로 존재하지만 회원가입 step2 에서만 렌더링됨. 상설 공개 URL 부재가 pre-existing gap 인지 Phase 13 regression 인지 확인 필요."
created: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:30:00Z
---

## Current Focus

hypothesis: Pre-existing gap 확정 — 상설 법적 페이지가 App Router 트리에 **한 번도 생성된 적 없음**. Phase 09-tech-debt 이 legal MD 파일을 작성했지만 signup-step2 dialog 에만 연결했고, Phase 13 rename 은 파일 내용만 건드림. Footer 의 legal 링크는 `href="#"` 플레이스홀더. Phase 13 scope 와 무관한 기존 누락이며 별도 phase 필요.
test: (완료) Glob/Grep 전수 탐색 + git log --diff-filter=A + footer.tsx read + next.config 의 rewrites/redirects 확인 + middleware 부재 확인.
expecting: (확인됨) 어떤 page.tsx/route.ts 도 /terms, /privacy, /marketing, /legal/* 에 매핑되지 않음. 404 는 Next.js App Router 의 기본 not-found 응답.
next_action: Return ROOT CAUSE FOUND to caller

## Symptoms

expected: `https://heygrabit.com/terms`, `/privacy`, `/marketing` 접속 시 각각의 법적 문서가 HTML 페이지로 렌더링.
actual: `/terms` 404, `/legal/terms` 404. Next.js `x-nextjs-prerender: 1` — not-found 가 prerender 됨.
errors: HTTP 404.
reproduction: 브라우저에서 `https://heygrabit.com/terms` 접속 또는 curl.
started: UAT (2026-04-24) 에서 처음 확인됨 — 애초에 구현된 적 없음 (git 히스토리상 신규 파일 추가 0 건).

## Eliminated

- hypothesis: "의도된 라우트 이름 불일치 (/policies, /docs/legal 등 다른 경로로 구현됨)"
  evidence: "Glob `apps/web/app/**/{terms,privacy,marketing,legal,policy,policies}/**/*.{tsx,ts}` → No files found. Grep `/terms|/privacy|/marketing|/legal|/policy|/policies` 전체 apps/web 에서 signup-step2 import 3건 + booking confirm terms-agreement 1건만 매치. 다른 라우트 경로 없음."
  timestamp: 2026-04-24

- hypothesis: "Build artifact / Turbopack 설정으로 prerender 제외"
  evidence: "next.config.ts L50-61 rewrites 는 /api/:path*, /socket.io/:path* 두 건만. redirects 정의 없음. middleware.ts 파일 부재 (Glob 결과 없음). Turbopack rules 는 `*.md → raw-loader` 한 건 — 라우트 제외와 무관. 라우트 자체가 없으므로 prerender/exclude 대상이 아님."
  timestamp: 2026-04-24

## Evidence

- timestamp: 2026-04-24
  checked: "apps/web/app/**/page.tsx 전수 (Glob)"
  found: "18 개 page.tsx — admin/*, auth/*, booking/*, genre/*, mypage/*, performance/*, search, page.tsx(root) 뿐. legal/terms/privacy/marketing 관련 디렉터리 없음."
  implication: "App Router 에 법적 문서 공개 URL 이 물리적으로 존재하지 않음."

- timestamp: 2026-04-24
  checked: "apps/web/app/**/route.ts (Glob)"
  found: "admin/sentry-test/route.ts 1개뿐."
  implication: "API-style route handler 로도 법적 문서를 제공하지 않음."

- timestamp: 2026-04-24
  checked: "apps/web/content/legal/*.md + signup-step2 import (Grep)"
  found: "apps/web/content/legal/{terms-of-service,privacy-policy,marketing-consent}.md 3개 파일 존재 (Phase 09-tech-debt `ae7b433` 에서 최초 작성, Phase 13 commit `6dc66ea` 에서 @heygrabit.com 이메일 반영). signup-step2.tsx L15-17 이 `@/content/legal/*.md` 를 raw-loader 로 import 해 dialog 에 렌더링. booking/confirm/page.tsx 의 terms-agreement 컴포넌트 1건도 존재."
  implication: "법적 문서 '콘텐츠'는 준비 완료, 그러나 회원가입/예매 플로우 내부 모달로만 노출. next.config.ts L47 Turbopack rule `*.md → raw-loader` 가 이 import 를 가능하게 함."

- timestamp: 2026-04-24
  checked: "apps/web/components/layout/footer.tsx (Read)"
  found: "Footer L9, L13, L17 의 legal 링크 — `<Link href=\"#\">이용약관</Link>`, `<Link href=\"#\">개인정보처리방침</Link>`, `<Link href=\"#\">고객센터</Link>` — 세 건 모두 `href=\"#\"` 플레이스홀더."
  implication: "푸터는 설계상 legal 공개 URL 을 가리킬 의도가 있었으나, 실제 URL 구현이 없어 `#` 상태로 유지됨. Footer 에서 click 해도 현재 URL 의 top 으로 스크롤할 뿐 라우팅 없음."

- timestamp: 2026-04-24
  checked: "next.config.ts rewrites/redirects + middleware 부재"
  found: "next.config.ts L50-61 rewrites: `/api/:path*` + `/socket.io/:path*` 두 건뿐. redirects 섹션 없음. middleware.ts 파일 부재. Turbopack rules: `*.md → raw-loader` 단 하나."
  implication: "/terms 를 다른 곳으로 보내는 rewrite/redirect/middleware 없음. 라우트 부재 → 404 가 정상 동작."

- timestamp: 2026-04-24
  checked: "git log --all --diff-filter=A (apps/web/app/{terms,privacy,marketing,legal,policy}* 신규 파일 추가 이력)"
  found: "매치 0건."
  implication: "해당 경로에 page/route 파일이 생성된 이력이 모든 브랜치/모든 커밋에 없음 — 구현된 적 자체가 없음."

- timestamp: 2026-04-24
  checked: "Phase 13 plan scope 문서 (13-01-PLAN, 13-02-PLAN, 13-VALIDATION, 13-PATTERNS)"
  found: "13-VALIDATION.md L66: `rg -n \"grapit\\|Grapit\" apps/web/app/legal/ docs/legal/` → 0 라고 검증식 명시. 그러나 실제 apps/web/app/legal/ 디렉토리는 존재하지 않음. Phase 13 scope 는 `apps/web/content/legal/*.md` (3개 파일) 의 문자열 치환뿐 (13-02-PLAN L55-59, 13-PATTERNS L630-632). 신규 page.tsx/route.ts 생성 작업 전무."
  implication: "Phase 13 의 validation 매트릭스는 `apps/web/app/legal/` 가 이미 존재한다는 전제로 작성됐거나, 잘못된 경로를 적음. 어느 쪽이든 Phase 13 은 법적 공개 페이지를 생성할 의무가 없었음 — rename-only scope. UAT Test 11 이 기대한 `heygrabit.com/terms` 같은 URL 은 Phase 13 의 성공조건이 아니라 이전부터 미구현 상태로 남아있던 gap."

- timestamp: 2026-04-24
  checked: "Phase 09-tech-debt 관련 커밋 (git log grep)"
  found: "`ae7b433 feat(09-tech-debt): add KOPICO-based legal MD drafts + cross-border transfer clause + accuracy checklist (DEBT-02, MED, B3)` → legal MD 3개 최초 작성. `d94c64b feat(09-tech-debt): add LegalDraftBanner + TermsMarkdown components + WCAG AA contrast check (DEBT-02, W5)` → 렌더링 컴포넌트 작성. `a342a57 feat(09-tech-debt): wire legal MD + draft banner into signup-step2 (DEBT-02)` → signup step2 dialog 에 연결. `6dc66ea refactor(13-01): rename docs + legal MDs + add audit-brand-rename.sh (D-10 allowlist)` → Phase 13 에서 @heygrabit.com 이메일 반영."
  implication: "DEBT-02 의 초기 구현 의도는 '회원가입 동의 모달에 법적 문서 콘텐츠를 draft 상태로 표시' 였음 (LegalDraftBanner 컴포넌트 존재가 방증 — 확정본 아님을 사용자에게 고지). 독립 공개 페이지 (/terms 등) 구현은 DEBT-02 scope 에 들어간 적 없음. Phase 13 은 rename 만 담당."

## Resolution

root_cause: >
  Pre-existing feature gap — 프로젝트에 상설 법적 문서 공개 페이지 (/terms, /privacy, /marketing, /legal/* 등 어느 경로로도) 가 **한 번도 구현된 적 없음**. Phase 09-tech-debt DEBT-02 가 `apps/web/content/legal/*.md` 3개 파일과 `TermsMarkdown` 컴포넌트를 만들었으나 회원가입 step2 모달에만 연결했고, Phase 13 rename 은 해당 파일의 브랜드명·이메일 도메인 문자열만 치환했음. Footer legal 링크 3건은 `href="#"` 플레이스홀더로 남아있음. 라우트 부재 → Next.js App Router 가 404 를 prerender.

  Phase 13 scope 와는 **무관** (rename-only 였음). UAT Test 11 의 "heygrabit.com/terms 접속 시 법적 문서 렌더링" 기대는 Phase 13 success criteria (SC-1~SC-4) 에 포함되지 않았으며, 한국 개인정보보호법·정통망법상 개인정보처리방침·이용약관의 공개 URL 상시 노출은 **런칭 직전 별도 phase 로 반드시 필요한 신규 기능**.

fix: |
  (Scope: diagnose-only — 실제 패치는 적용하지 않음.)

  권장 방향 (새 phase 로 분리):
  1. apps/web/app/(legal)/ 라우트 그룹 또는 apps/web/app/legal/ 디렉토리 신규 생성.
     - apps/web/app/legal/terms/page.tsx
     - apps/web/app/legal/privacy/page.tsx
     - apps/web/app/legal/marketing/page.tsx
     (/terms, /privacy 같은 짧은 alias 가 필요하다면 별도 page.tsx 또는 next.config redirects 로 제공.)
  2. 각 page.tsx 는 기존 TermsMarkdown 컴포넌트를 재사용해 해당 MD 를 SSG 렌더링. 브랜드 Footer/GNB 컴포넌트 포함.
  3. LegalDraftBanner 는 런칭 전 '초안' 표시 → 런칭시 검토 완료 후 제거 또는 유지 결정 필요.
  4. Footer legal 링크 3건 href 를 `#` → 실제 경로로 교체 (이용약관, 개인정보처리방침, 고객센터).
  5. SEO: 각 page 에 metadata (title, description, noindex 는 선택) + JSON-LD 필요 여부 판단.
  6. 접근성: 문서 내 목차(TOC) + `lang` 속성 + heading 구조 (WCAG 2.1 AA) — TermsMarkdown 이 이미 커버하는지 확인.
  7. 공개 전 법무/KOPICO 기반 draft 검토 완료 확인 (DEBT-02 의 accuracy checklist 재확인).
  8. Phase 13 post-phase deferred 항목 (13-02 D-15, 13-04 "Additional post-phase tasks") 의 `support@heygrabit.com` / `privacy@heygrabit.com` mailbox 실개통도 이 신규 phase 의 전제 또는 병행 작업.

verification: |
  Scope: find_root_cause_only — verification 은 신규 phase 에서 수행.
  다음 acceptance 가 신규 phase 에서 필요:
    - `curl -sI https://heygrabit.com/legal/terms` HTTP 200 + HTML body 가 이용약관 헤더 포함
    - `curl -sI https://heygrabit.com/legal/privacy` HTTP 200
    - `curl -sI https://heygrabit.com/legal/marketing` HTTP 200
    - Footer legal 링크 3건 모두 유효 URL 로 라우팅 (`href !== '#'`)
    - pnpm --filter @grabit/web build exit 0 + 신규 3개 route prerender 확인
    - `grep -E '@heygrabit\.com' apps/web/content/legal/*.md | wc -l` ≥ 4 (기존 Phase 13 Plan 02 D-07 검증과 일치)

files_changed: []
