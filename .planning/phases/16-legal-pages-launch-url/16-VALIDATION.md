---
phase: 16
slug: legal-pages-launch-url
status: draft
nyquist_compliant: false  # will flip to true after Wave 0 lands with .md?raw transformer (Plan 02 Task 1)
wave_0_complete: false  # will flip to true after Plan 01 commits land + Plan 02 Task 1 patches env.d.ts/next.config.ts
created: 2026-04-28
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/web) + grep/find (build artifact assertions) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grabit/web test --run` |
| **Full suite command** | `pnpm --filter @grabit/web build && pnpm --filter @grabit/web test --run` |
| **Estimated runtime** | ~25 seconds (test) + ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grabit/web test --run`
- **After every plan wave:** Run full suite (build + test)
- **Before `/gsd-verify-work`:** Full suite must be green AND build artifact greps pass
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision Ref | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|--------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | D-09 | — | TermsMarkdown showH1 prop renders/hides H1 | unit | `pnpm --filter @grabit/web test terms-markdown` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 0 | D-10/D-13 | — | legal page metadata + force-static export shape | unit | `pnpm --filter @grabit/web test legal-page-metadata` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 0 | D-03 | — | Footer href contract (terms/privacy/mailto) | unit | `pnpm --filter @grabit/web test footer-links` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | D-09 | — | showH1 prop wired into TermsMarkdown | unit | `pnpm --filter @grabit/web test terms-markdown` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 1 | D-01/D-02 | — | `/legal/{terms,privacy,marketing}` 라우트 SSG 빌드 산출 | smoke | `pnpm --filter @grabit/web build && find apps/web/.next -path '*legal*' -name '*.html' \| wc -l` (≥3) | ✅ | ⬜ pending |
| 16-02-03 | 02 | 1 | D-13 | — | metadata title/canonical 검증 | unit | `pnpm --filter @grabit/web test legal-page-metadata` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 2 | D-03/D-04 | T-16-01 (오픈리디렉트 회피 — relative path 강제) | Footer 3 링크 실 경로 + mailto 변경 | unit + grep | `pnpm --filter @grabit/web test footer-links && grep -F 'href="/legal/terms"' apps/web/components/layout/footer.tsx` | ✅ | ⬜ pending |
| 16-04-01 | 04 | 3 | D-06/D-07 | T-16-02 (placeholder leak 방지) | terms/privacy/marketing MD 에 시행일 + 보호책임자 보강 | grep | `grep -E '시행일|개인정보 보호책임자' apps/web/content/legal/privacy-policy.md` | ✅ | ⬜ pending |
| 16-04-02 | 04 | 3 | D-07 | T-16-02 | 모든 placeholder 가 `[...]` bracket 형식으로 식별 가능 | grep | `grep -cE '\[.*[A-Za-z0-9가-힣].*\]' apps/web/content/legal/*.md` (≥1) | ✅ | ⬜ pending |
| 16-05-01 | 05 | 4 | D-05 | — | `legal-draft-banner.tsx` 파일 부재 | grep | `test ! -f apps/web/components/legal/legal-draft-banner.tsx` | ✅ | ⬜ pending |
| 16-05-02 | 05 | 4 | D-05 | — | signup-step2 LegalDraftBanner import/JSX 부재 | grep | `! grep -q 'LegalDraftBanner\|legal-draft-banner' apps/web/components/auth/signup-step2.tsx` | ✅ | ⬜ pending |
| 16-05-03 | 05 | 4 | D-11 | — | dialog 회귀 없음(typecheck + build pass) | build | `pnpm --filter @grabit/web typecheck && pnpm --filter @grabit/web build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/components/legal/__tests__/terms-markdown.test.tsx` — D-09 showH1 prop 테스트 (showH1=false → H1 미렌더, showH1=true → `text-display` H1 렌더)
- [ ] `apps/web/app/legal/__tests__/metadata.test.ts` — D-13 metadata 객체 shape 테스트 (title/description/alternates.canonical) + D-10 dynamic export 테스트
- [ ] `apps/web/components/layout/__tests__/footer.test.tsx` — D-03 Link href 검증 (terms/privacy 실 경로 + 고객센터 mailto)
- [ ] `apps/web/vitest.config.ts` — 기존 설정 유지(신규 install 없음)

*Existing infrastructure: vitest 3.x + @testing-library/react 16.x already present in apps/web.*

---

## Manual-Only Verifications

| Behavior | Decision Ref | Why Manual | Test Instructions |
|----------|--------------|------------|-------------------|
| 사업자등록번호·통신판매업 신고번호·대표자명 실값 주입 | D-07 | 1인 개발자 사업자 등록 완료 후 사용자가 직접 MD 수정 | (1) 사업자 등록 완료 → (2) `apps/web/content/legal/terms-of-service.md` placeholder 실값 치환 → (3) `grep -E '\[.+:\s*[\[（]?000-' apps/web/content/legal/*.md` 결과 0 확인 |
| `privacy@heygrabit.com` / `support@heygrabit.com` mailbox 수신 검증 | D-15 | DNS MX/alias 운영 작업 — 코드 외 | (1) DNS MX/alias 설정 → (2) Gmail/외부 메일에서 두 주소로 송신 → (3) 수신함 확인 → (4) HUMAN-UAT 체크 마킹 |
| 시행일자 cutover 일정 확정 후 MD 시행일 토큰 치환 | D-08 | cutover 일자는 prod 배포 시점에 결정 | (1) cutover D-day 확정 → (2) 3개 MD `[시행일: YYYY-MM-DD]` 일괄 치환 → (3) cutover commit/PR 생성 |
| 시각적 회귀 — signup-step2 LegalDraftBanner 제거 후 동의 모달 UX | D-05 | 시각 요소 제거 — automated visual diff 미구축 | (1) `pnpm --filter @grabit/web dev` → (2) `/auth/signup` step 2 진입 → (3) 약관/개보처/마케팅 dialog 3개 열어 LegalDraftBanner 노란 배너 부재 + 본문 정상 렌더 확인 |
| Footer Link 클릭 → SSG 페이지 정상 렌더 (golden path) | D-01/D-03 | UX 통합 검증 | (1) `pnpm --filter @grabit/web build && pnpm --filter @grabit/web start` → (2) 임의 페이지에서 Footer "이용약관" 클릭 → /legal/terms 정적 페이지 H1 + 본문 노출 확인 → (3) 개인정보처리방침/고객센터(mailto:) 동일 절차 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files)
- [ ] No watch-mode flags (vitest `--run` only)
- [ ] Feedback latency < 90s (test + smoke build)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
