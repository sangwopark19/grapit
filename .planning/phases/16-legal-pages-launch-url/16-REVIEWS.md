---
phase: 16
reviewers: [codex]
reviewed_at: 2026-04-28T03:21:35Z
plans_reviewed:
  - 16-01-PLAN.md
  - 16-02-PLAN.md
  - 16-03-PLAN.md
  - 16-04-PLAN.md
  - 16-05-PLAN.md
unavailable_reviewers:
  - cursor (auth required — run `cursor agent login` or set CURSOR_API_KEY)
  - claude (skipped — running inside Claude Code per workflow rule)
  - gemini, opencode, qwen, coderabbit (CLI not installed)
---

# Cross-AI Plan Review — Phase 16: Legal pages launch

## Codex Review

> Reviewer: `codex` (OpenAI Codex CLI v0.125.0, model `gpt-5.5`, reasoning xhigh)

### 1. Summary

계획은 `/legal/{terms,privacy,marketing}` SSG 페이지와 Footer 연결 자체는 잘 쪼개져 있지만, "launch" phase로 보기에는 cutover가 계획 밖으로 밀려 있습니다. 특히 `Plan 16-04`가 법적 placeholder를 의도적으로 공개 콘텐츠에 넣고, `Plan 16-05`가 그 상태에서 `LegalDraftBanner`를 삭제하며, 실제 사업자 정보·시행일·mailbox 검증은 `HUMAN-UAT`로만 남깁니다. 코드 변경 난이도는 낮지만 placeholder leak, SEO 색인, dependency ordering 문제가 있어 전체 리스크는 높습니다.

### 2. Strengths

- `CONTEXT.md D-01/D-02/D-10`의 `/legal/*` 단일 URL 구조와 `force-static` SSG 방향은 phase goal과 잘 맞습니다.
- `Plan 16-01`의 `terms-markdown.test`, `metadata.test`, `footer.test`는 핵심 회귀 지점(showH1, metadata, Footer href)을 적절히 고정합니다.
- `Footer` href를 exact relative path와 `mailto:`로 검증하는 방식은 open redirect류 실수를 잘 막습니다.
- `TermsMarkdown showH1=false default`는 기존 dialog UX 회귀를 줄이는 좋은 설계입니다.
- `16-HUMAN-UAT.md`에 mailbox 수신 검증과 placeholder cutover gate를 모으려는 방향은 운영 리스크를 문서화한다는 점에서 필요합니다.

### 3. Concerns

- **HIGH:** `Plan 16-04`는 placeholder를 넣고 `Plan 16-05`는 `LegalDraftBanner`를 삭제하지만, 실제 placeholder 치환 plan이 없습니다. 이 상태는 "launch"가 아니라 "launch 준비 scaffold"입니다. `CONTEXT.md D-07/D-08/D-15`, `Plan 16-04`, `Plan 16-05 Task 3`가 서로 cutover를 요구하지만 executable wave가 없습니다.
- **HIGH:** `Plan 16-05` frontmatter `depends_on: [16-02]`는 잘못됐습니다. `16-HUMAN-UAT.md`는 `16-04-SUMMARY.md`와 placeholder pattern을 참조하므로 `16-04`에 의존해야 합니다. 자동 executor가 dependency만 믿으면 Wave 4가 Wave 3보다 먼저 실행될 수 있습니다.
- **HIGH:** placeholder leak gate가 불완전합니다. `Plan 16-05`의 grep은 `시행일|사업자등록번호|통신판매업|보호책임자 실명`만 잡고, `사업자명`, `대표자명`, `주소`, `전화번호`, `직책`, `직전 시행일`은 놓칩니다. `VALIDATION.md 16-04-02`의 "모든 placeholder bracket 검출" 목표와 불일치합니다.
- **HIGH:** `D-12`에서 robots index/follow를 명시하면서 placeholder 기간을 허용합니다. staging/preview/prod 어느 환경이든 공개 접근되면 placeholder가 색인될 수 있습니다. `LegalDraftBanner` 삭제와 결합하면 "검토 중"이라는 안전 신호도 사라집니다.
- **MEDIUM:** `Plan 16-01`은 RED test를 만들고도 `VALIDATION.md` status를 ✅로 표기하라고 합니다. artifact 생성 완료와 behavioral green을 같은 ✅로 쓰면 execution dashboard가 거짓 안정 상태가 됩니다.
- **MEDIUM:** `Plan 16-02 Task 3`의 SSG 검증은 stale `.next`에 취약합니다. `find apps/web/.next -path '*legal*' | wc -l ≥ 3`는 이전 build artifact가 남아도 통과할 수 있습니다.
- **MEDIUM:** `*.md?raw` Turbopack rule은 build에서 잡히겠지만, 기존 `*.md`와 신규 `*.md?raw` 두 import path가 공존합니다. `signup-step2`와 legal pages가 서로 다른 loader contract를 쓰게 되어 장기 유지보수 리스크가 생깁니다.
- **MEDIUM:** `privacy-policy.md`에 GFM table을 추가하지만 `TermsMarkdown`의 component mapping에는 `table/th/td` 스타일이 없습니다. 모바일에서 표 overflow가 날 가능성이 있습니다.
- **MEDIUM:** legal pages가 `'use client'`인 `TermsMarkdown`를 import하므로 정적 법적 문서에도 `react-markdown` client bundle/hydration 비용이 붙습니다. 성능상 치명적이지는 않지만 SSG 문서 페이지로는 과합니다.
- **MEDIUM:** 법적 completeness 검증이 약합니다. 계획은 개인정보 보호책임자와 시행일만 보강하지만, 기존 `privacy-policy.md`가 처리 목적, 보유 기간, 제3자 제공, 위탁, 권리 행사, 파기, 안전성 확보조치 등을 실제 서비스와 맞게 포함하는지 checklist가 없습니다. KISA 스팸 안내도 광고성 정보 전송의 수신거부/철회, 처리결과 통지, 정기적 수신동의 확인을 별도 의무로 설명합니다.
- **LOW:** `Plan 16-03` acceptance에서 source grep으로 `© 2026 Grabit...`를 요구하지만 기존 JSX가 `&copy;`면 false negative가 납니다. 계획 본문은 둘 다 OK라고 하면서 criteria는 하나만 허용합니다.
- **LOW:** `D-12/D-13`은 index/canonical만 다루고 sitemap/robots.txt 반영을 확인하지 않습니다. Footer discovery만으로도 충분할 수 있지만 SEO/PG verification 목적이면 sitemap 존재 여부를 확인해야 합니다.

### 4. Suggestions

- `Plan 16-06: Cutover`를 추가하세요. 사업자 정보·보호책임자·시행일 실값 치환, mailbox 수신 확인, clean build, placeholder zero grep, prod smoke까지 executable gate로 묶어야 합니다.
- `Plan 16-05 depends_on`을 `[16-02, 16-04]`로 수정하세요. 실제로는 `16-03`까지 포함해도 무방합니다.
- prod gate는 부분 regex가 아니라 다음처럼 모든 bracket placeholder를 차단하세요: `grep -RInE '\[[^]\n]+:[^]\n]+\]' apps/web/content/legal apps/web/.next` 결과 0건.
- placeholder가 남아 있는 동안은 `LegalDraftBanner`를 유지하거나, 최소한 preview/staging에서는 `noindex`를 강제하세요.
- SSG 검증 전에 `rm -rf apps/web/.next`를 실행하고, `next start` 후 `curl /legal/terms`, `/legal/privacy`, `/legal/marketing`로 HTTP 200 + body + canonical을 검증하세요.
- `TermsMarkdown`에 `table`, `thead`, `tbody`, `th`, `td` mapping을 추가하거나 privacy 개정 이력을 list로 바꾸세요. 모바일 overflow 테스트도 추가하는 편이 안전합니다.
- legal pages용 server Markdown renderer를 분리해 client bundle을 줄이세요. 기존 dialog는 client wrapper가 server-rendered markup을 받을 수 있는 구조로 재검토할 가치가 있습니다.
- `privacy-policy.md`와 `marketing-consent.md`에 별도 compliance checklist test/docs를 추가하세요. 특히 마케팅 철회 경로와 광고성 정보 전송 운영 의무는 "공개 URL"과 별개입니다.
- 공식 참고: [개인정보 포털 처리방침 예시](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=326), [KISA 불법스팸 규정 요약](https://spam.kisa.or.kr/spam/cm/cntnts/cntntsView.do?cntntsId=1086&mi=1061), [전자상거래법 제13조 정보 제공](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900618447).

### 5. Risk Assessment

**Overall: HIGH.** 코드 표면적은 작지만, phase goal이 법적 공개 URL "launch"인 점을 감안하면 placeholder leak, 잘못된 dependency graph, index/follow와 draft 제거의 조합이 치명적입니다. `Plan 16-02/03`까지는 비교적 안전하지만, `Plan 16-04/05`는 실제 cutover를 문서로 미루기 때문에 현재 계획만으로는 stated phase goal을 완전히 달성하지 못합니다.

---

## Cursor Review

> **Skipped:** Cursor agent CLI requires authentication on this workstation. Run `cursor agent login` or set `CURSOR_API_KEY` to enable Cursor reviews. (Re-run `/gsd-review --phase 16 --cursor` after authenticating to add Cursor's perspective.)

---

## Consensus Summary

> Single reviewer (codex) — no cross-reviewer consensus available. The findings below reflect codex's independent assessment only. To strengthen consensus, authenticate `cursor` and re-run `/gsd-review --phase 16 --cursor`, or install another CLI (`gemini`, `opencode`).

### Highest-Priority Findings (HIGH severity, single reviewer)

1. **No executable cutover wave.** Phase 16 is a "launch" but `LegalDraftBanner`는 16-05에서 제거되는 반면 실값(사업자등록번호·시행일·보호책임자) 치환은 HUMAN-UAT 문서로만 남아 있어 prod에 placeholder가 그대로 노출될 위험. `Plan 16-06: Cutover` 신설 권장.
2. **Plan 16-05 dependency 누락.** `depends_on: [16-02]`만 명시되어 있어 자동 executor가 16-04 placeholder 작업 전에 banner를 삭제할 가능성. `[16-02, 16-04]` (선택적으로 `16-03`)로 수정 필요.
3. **Placeholder grep 불완전.** 16-05의 leak gate가 `시행일|사업자등록번호|통신판매업|보호책임자 실명`만 검출 — 사업자명/대표자명/주소/전화번호/직책/직전 시행일은 누락. `\[[^]\n]+:[^]\n]+\]` 형태의 generic bracket regex로 대체 권장.
4. **D-12 robots index 정책과 placeholder 기간의 충돌.** index/follow=true 상태에서 placeholder가 색인될 수 있고 LegalDraftBanner 제거로 시각적 안전 신호도 소실. preview/staging는 noindex 강제, prod는 cutover 완료 후 banner 제거 순서.

### Notable MEDIUM Concerns (worth resolving before execute)

- `Plan 16-01` 의 RED 테스트를 `VALIDATION.md ✅` 로 표기하면 dashboard 의 truthfulness 손상 (artifact 생성과 behavioral green 분리 필요).
- `Plan 16-02 Task 3` SSG 검증이 stale `.next` 에 취약 — `rm -rf apps/web/.next` 후 검증 권장.
- `*.md?raw` 와 기존 `*.md` Turbopack 규칙 공존으로 loader contract 분기 — long-term 유지보수 리스크.
- `privacy-policy.md` GFM 표 추가 vs `TermsMarkdown` 의 table/th/td mapping 미정 — 모바일 overflow 위험.
- `'use client'` `TermsMarkdown` 을 SSG 페이지에서 import → 불필요한 client bundle/hydration 비용.
- 법적 completeness checklist 부재 — 처리목적/보유기간/제3자 제공/위탁/권리행사/파기/안전성 확보조치 등 항목 검증 없음.

### Divergent Views

해당 없음 — 단일 리뷰어.

### Recommended Next Step

`/gsd-plan-phase 16 --reviews` 로 codex feedback 을 plan 단계에 반영. 우선 (1) 16-05 depends_on 수정 + (2) generic bracket regex gate + (3) Plan 16-06 cutover 신설 + (4) preview noindex 강제까지가 명확한 plan-side 변경. 나머지(client bundle, table mapping, completeness checklist)는 Plan 본문 보강 또는 follow-up phase로 routing.

---

## Adjudication (Plan-Phase Replan)

> Adjudicated: 2026-04-28
> Replan invocation: `/gsd-plan-phase 16 --reviews`
> Adjudicator: gsd-planner (Claude Opus 4.7 1M context)

각 codex finding 에 대한 처리 결정을 plan 단위로 매핑한다.

### HIGH severity

| Finding ID | Description | Disposition | Rationale | Affected plans |
|------------|-------------|-------------|-----------|----------------|
| **HIGH-1** | Cutover wave 부재 — placeholder 가 prod 에 누출될 위험, "launch" 가 아닌 "scaffold" | **accept** | codex 권고대로 Plan 16-06 신설. (a) human-in-the-loop placeholder 실값 주입 (Task 1), (b) clean prod build + generic regex gate + robots/canonical 검증 (Task 2), (c) cutover commit + prod URL smoke (Task 3) 의 3 task 로 atomic launch 보장. depends_on=[16-02, 16-03, 16-04, 16-05] 로 모든 선행 wave 후행. autonomous: false (Task 1 manual). | **신설: 16-06** |
| **HIGH-2** | Plan 16-05 의 depends_on=[16-02] 만 명시 → executor 가 16-04 보다 먼저 실행 가능 | **accept** | 16-05 frontmatter 를 `depends_on: [16-02, 16-04]` 로 수정. Codex 권고 외 16-03 은 16-05 의 generic regex gate 와 무관하므로 미포함 (의존 불필요). | **수정: 16-05** |
| **HIGH-3** | placeholder leak grep 불완전 — 사업자명/대표자명/주소/전화번호/직책/직전 시행일 누락 | **accept** | codex 권고 generic bracket regex `\[[^]\n]+:[^]\n]+\]` 채택. 16-05 의 HUMAN-UAT.md UAT-1j + UAT-2e + STRIDE T-16-02 + key_links pattern + must_haves truths 모두 generic regex 로 교체. 16-06 의 cutover gate (Task 2-B + Task 3-C) 도 동일 regex 사용. Plan 16-04 의 placeholder bracket 형식 (`[라벨: 임시값]`) 과 정합. | **수정: 16-05, 신설: 16-06** |
| **HIGH-4** | D-12 robots index/follow=true + placeholder 기간 충돌 → 색인 위험 | **accept (preview noindex 환경 분기)** | D-12 의 "검색 엔진 색인 허용" lock 은 prod 기준 의도임을 RESEARCH/CONTEXT 의 PG·도메인 verification 맥락으로 해석. preview/staging/dev 는 별개 — 환경 변수 `GRABIT_ENV` 분기로 prod 만 index 허용, 그 외는 noindex 강제. D-12 의 spirit 안에서 안전 보강이며 violation 아님. 16-02 의 page.tsx 3건 모두 `const isProd = process.env.GRABIT_ENV === 'production'; robots: { index: isProd, follow: isProd }` 으로 패치. acceptance criteria + Task 3 검증 + 16-06 cutover gate 모두 GRABIT_ENV 주입 명시. | **수정: 16-02, 신설: 16-06** |

### MEDIUM severity

| Finding ID | Description | Disposition | Rationale | Affected plans |
|------------|-------------|-------------|-----------|----------------|
| **MED-1** | 16-01 의 RED 테스트와 VALIDATION ✅ 표기 충돌 → falsified green dashboard | **accept** | 16-01 의 output 섹션을 수정: VALIDATION.md status 갱신 시 두 차원 분리 표기. Artifact 생성 → `✅ artifact`, Behavioral GREEN → Wave 0 단계 `⏳ behavior` (RED 정상). Wave 1/2 완료 시 `✅ behavior` 로 갱신. SUMMARY.md 표기 규칙 명시. | **수정: 16-01** |
| **MED-2** | 16-02 Task 3 SSG 검증이 stale .next 에 취약 | **accept (rm -rf .next + clean prod build)** | 16-02 Task 3 action 에 `rm -rf apps/web/.next && GRABIT_ENV=production pnpm build` 명시. acceptance criteria 도 clean build 명령으로 갱신. codex 의 next start + curl smoke 는 1인 개발 비용 대비 효과 낮아 reject — Task 3 의 build artifact grep + 16-06 Task 3-C 의 prod URL smoke 로 충분. | **수정: 16-02, 16-06** |
| **MED-3** | `*.md?raw` vs `*.md` Turbopack rule 분기 → loader contract 분리 | **partial accept (코드 변경 없음)** | 두 rule 모두 동일한 raw-loader 를 사용하는 query 변형일 뿐 — 실제 loader contract 는 단일. 분리는 vitest jsdom 환경 호환을 위한 의도적 결정 (signup-step2 의 `*.md` import 는 D-11 dialog UX lock). 16-02 plan 본문에 결정 근거 + 호환성 분기 명문화. 코드 변경 없음. | **수정: 16-02** (Plan 본문 명문화만) |
| **MED-4** | privacy GFM 표 vs TermsMarkdown table 매핑 부재 → 모바일 overflow | **accept (옵션 A — TermsMarkdown 매핑 추가)** | 옵션 A 채택 — D-06 "개정 이력 GFM 표" 가 mobile overflow 없이 렌더되도록 TermsMarkdown 의 baseComponents 에 table/thead/tbody/tr/th/td 6개 매핑 추가. wrapper div `overflow-x-auto -mx-2` 로 모바일 가드. 16-02 Task 1 action + acceptance criteria 패치. (옵션 B — list 변환 — 은 D-06 "GFM 표" 명시 의도와 충돌하므로 reject.) | **수정: 16-02** |
| **MED-5** | `'use client'` TermsMarkdown 을 SSG 페이지 import → client bundle 비용 | **defer** | server-only Markdown renderer 분리는 D-09 lock + D-11 dialog UX 불변 lock 과 충돌 가능 (현재 dialog 도 동일 컴포넌트 사용). 본 phase scope 변경은 D-09/D-11 위반 위험. CONTEXT.md 의 Deferred Ideas 에 "server-only Markdown renderer 분리" 추가 권장 (별도 phase 에서 dialog client wrapper + page server renderer 분리 검토). 본 phase 에서 변경 없음. | **defer (16-CONTEXT.md Deferred Ideas 후속 추가 권장)** |
| **MED-6** | 법적 completeness checklist 부재 — KOPICO/KISA 권고 항목 미검증 | **accept (light version)** | Full version (콘텐츠 작성·법무 검토 plan 포함) 은 1인 개발 + 본 phase scope ("공개 URL + 콘텐츠 보강") 위반이라 reject. Light version 채택 — 16-04 Task 2 acceptance criteria 에 KOPICO 표준 H2 heading 7개 (처리 목적·보유 기간·제3자 제공·처리 위탁·정보주체 권리·파기·안전성 확보) 보존 회귀 grep 추가. 누락 항목은 사용자 HUMAN-UAT 책임으로 surfacing. CONTEXT D-06 의 "구조만 보강 (실값은 사용자 주입)" 정신과 정합. | **수정: 16-04** |

### LOW severity

| Finding ID | Description | Disposition | Rationale | Affected plans |
|------------|-------------|-------------|-----------|----------------|
| **LOW-1** | 16-03 Footer Copyright `© 2026 Grabit` vs `&copy;` false negative | **accept** | acceptance criteria 의 grep 을 OR 분기로 교체: `grep -E '(© 2026 Grabit\|&copy; 2026 Grabit)' apps/web/components/layout/footer.tsx`. JSX 본문이 `&copy;` HTML entity 또는 `©` literal 어느 쪽이든 매치. | **수정: 16-03** |
| **LOW-2** | sitemap/robots.txt 미검증 | **defer** | 본 phase scope 외. CONTEXT D-12/D-13 도 sitemap 미언급. SEO 개선 phase (별도) 에서 sitemap.xml + robots.txt 일괄 도입 검토. 본 phase 에서 변경 없음. | **defer** |

### 처리 요약

| Plan | 변경 유형 | Codex finding 처리 |
|------|-----------|--------------------|
| **16-01** | 본문 패치 | MED-1 (output section 분리 표기) |
| **16-02** | 본문 패치 | MED-2 (clean build), MED-3 (?raw 명문화), MED-4 (table 매핑), HIGH-4 (env-driven robots) |
| **16-03** | acceptance 패치 | LOW-1 (Copyright OR 분기) |
| **16-04** | acceptance 패치 | MED-6 light (KOPICO 7 heading grep) |
| **16-05** | frontmatter + 본문 패치 | HIGH-2 (depends_on=[16-02, 16-04]), HIGH-3 (generic bracket regex) |
| **16-06** | 신규 plan | HIGH-1 (atomic cutover wave), HIGH-3 (final regex gate), HIGH-4 (GRABIT_ENV 검증), MED-2 (rm -rf + clean build) |

### Wave 결과 (replan 후)

| Wave | Plan(s) | Autonomous | Description |
|------|---------|------------|-------------|
| 0 | 16-01 | yes | RED tests scaffolding |
| 1 | 16-02 | yes | TermsMarkdown showH1 + table mapping + 4 page.tsx + env-driven robots + clean build |
| 2 | 16-03 | yes | Footer href 3건 교체 |
| 3 | 16-04 | yes | 3 MD content augmentation + KOPICO 7 heading 회귀 가드 |
| 4 | 16-05 | yes | LegalDraftBanner 삭제 + signup-step2 정리 + HUMAN-UAT.md 작성 |
| **5** | **16-06** | **no (Task 1 manual)** | **Cutover: human placeholder injection + automated gate + prod cutover commit + smoke** |

### Deferred follow-ups

- **MED-5 deferred:** CONTEXT.md 의 Deferred Ideas 에 "server-only Markdown renderer 분리 (dialog client wrapper + page server renderer)" 추가 권장. 본 plan-phase 가 CONTEXT.md 를 변경하지 않으므로, 사용자가 별도 quick-task / 후속 phase 로 처리.
- **LOW-2 deferred:** SEO 개선 phase 에서 sitemap.xml + robots.txt 일괄 도입.

