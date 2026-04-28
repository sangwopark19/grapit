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
