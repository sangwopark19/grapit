---
phase: 9
reviewers: [codex]
reviewed_at: 2026-04-14T02:53:37Z
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md, 09-03-PLAN.md]
skipped:
  - claude (self — running inside Claude Code)
  - gemini (CLI not installed)
  - opencode (CLI not installed)
  - coderabbit (CLI not installed)
---

# Cross-AI Plan Review — Phase 9: 기술부채 청산

> Independent adversarial review of `09-01-PLAN.md`, `09-02-PLAN.md`, `09-03-PLAN.md` by Codex CLI.
> Claude CLI was skipped (running inside Claude Code = same model family, lacks independence).

## Codex Review

# Phase 9 Review — 조건부 승인: Plan 3는 재작성 필요

## Summary
Phase 9 계획은 DEBT-01/02/03/04/06에 대해서는 비교적 구체적이고 실행 가능한 편입니다. 다만 roadmap success criteria를 역산하면 핵심 결함이 있습니다. 특히 `09-03-PLAN.md`는 Toss Payments “E2E 검증”을 달성하지 못하고 smoke test 수준에서 끝납니다. 또한 Plan 2의 EmailService는 실제 발송 코드까지는 가지만 password reset 링크를 통한 변경 완료, rate limiting, `FRONTEND_URL`/sender misconfig 검증이 빠져 있어 “실제 이메일이 발송되고 링크를 통해 비밀번호 변경 완료” 기준을 완전히 증명하지 못합니다.

## Strengths
- `09-01-PLAN.md`가 DEBT-03/04의 현 상태를 재진단한 점은 좋습니다. 이미 green인 `seat-map-viewer` production code를 건드리지 말라는 guardrail은 적절합니다.
- Plan 2의 `EmailService`는 `NODE_ENV=production && !RESEND_API_KEY` hard-fail을 명시해 silent fallback을 막습니다.
- Plan 2가 email enumeration 방지를 위해 `requestPasswordReset`의 user-not-found silent return을 보존하라고 명시한 점은 타당합니다.
- Plan 3의 `deploy.yml`에 `TOSS_*_TEST`를 넣지 말라는 negative check는 중요한 안전장치입니다.
- 각 plan이 파일 단위 산출물, acceptance criteria, 검증 명령을 제시해 executor가 따라가기 쉬운 구조입니다.

## Concerns
- [HIGH] `09-03-PLAN.md`는 DEBT-05를 실제로 닫지 못합니다. Task `9-03-t0`의 happy path는 “SDK 로딩 + widget mount”도 검증하지 않고, seeded booking이 없어 `/booking/test-performance-id` redirect만 확인합니다. `confirmIntercepted`도 `true`를 요구하지 않고 `typeof boolean`만 확인합니다. 이는 “Toss Payments 결제 플로우 E2E 검증 완료”가 아니라 route smoke test입니다. Seeded reservation, real confirm page render, widget mount assertion, confirm/success redirect 중 최소 하나는 실제로 통과해야 합니다.

- [HIGH] Plan 3의 cancel/decline 테스트도 실제 결제 실패 플로우가 아닙니다. URL query를 직접 주입해 toast 문구를 확인할 뿐입니다. 이 자체는 UI regression test로는 유용하지만 D-10/D-11의 “Toss sandbox + 실 SDK 연동” 검증을 대체하지 못합니다.

- [HIGH] `TOSS_CLIENT_KEY_TEST`가 없으면 CI에서 skip하고 exit 0이 됩니다. fork PR에서는 secrets가 없어 skip이 합리적일 수 있지만, `main` push에서도 secret 누락 시 green이 됩니다. 이러면 Phase 9 완료 후에도 Toss E2E가 한 번도 실행되지 않았을 수 있습니다. `main`/scheduled/manual run에서는 secret 누락을 fail로 처리해야 합니다.

- [HIGH] Plan 2는 password reset “링크를 통해 비밀번호 변경 완료”를 검증하지 않습니다. `EmailService` unit test와 `auth.service` wiring만으로는 reset email 수신, 링크 URL 구성, frontend reset page, `/auth/password-reset/confirm`까지 이어지는 성공 기준을 증명하지 못합니다. dev mock 로그에서 링크를 추출해 reset flow를 통과하는 integration/E2E 또는 최소 manual verification이 필요합니다.

- [HIGH] Plan 2의 public password reset endpoint에 rate limiting이 없습니다. console.log stub이 실제 Resend 발송으로 바뀌면 quota 소진, 사용자 스팸, abuse가 곧바로 가능해집니다. “Phase 10 범위”라고 미루기엔 DEBT-01에서 새 외부 side effect가 생깁니다. 기존 throttler가 없다면 최소 IP/email 기반 throttle을 추가하거나 명시적 risk acceptance와 운영 alert가 필요합니다.

- [MEDIUM] Plan 2의 Markdown raw import 전략이 문서 내에서 모순됩니다. objective는 `turbopack.rules: { '*.md': { type: 'raw' } }`를 권장한다고 말하지만 Task `9-02-t5`의 최종 예시는 `loaders: ['raw-loader']`입니다. 그런데 Task `9-02-t1`은 `raw-loader`를 설치하지 않습니다. `pnpm typecheck`만으로는 Turbopack loader 동작을 증명하지 못하므로 `pnpm --filter @grapit/web build` 또는 dev server smoke가 필요합니다.

- [MEDIUM] API 쪽 React Email TSX 빌드 리스크가 과소평가되어 있습니다. `apps/api/src/modules/auth/email/templates/password-reset.tsx`를 추가하면서 `apps/api/tsconfig.json`, Nest build, React runtime dependency가 실제로 준비되어 있는지 “확인”만 하라고 되어 있고 `files_modified`에는 반영되지 않습니다. `@react-email/components`가 React peer/runtime을 요구하면 API package에 `react` dependency가 필요할 수 있습니다.

- [MEDIUM] `EmailService`가 `RESEND_FROM_EMAIL` 누락 시 production에서도 `onboarding@resend.dev`로 fallback합니다. 비밀번호 재설정 메일은 deliverability와 phishing 신뢰가 중요하므로 production에서는 `RESEND_FROM_EMAIL`도 hard-fail하거나 검증된 sender domain만 허용하는 편이 안전합니다.

- [MEDIUM] `FRONTEND_URL` 검증이 없습니다. 현재 `resetLink = \`${frontendUrl}/auth/reset-password?...` 형태라 `FRONTEND_URL`이 없거나 HTTP이면 잘못된 링크가 발송될 수 있습니다. Plan 2 success criteria는 실제 링크 완료를 요구하므로 production에서 HTTPS URL hard-fail을 추가해야 합니다.

- [MEDIUM] legal MD 내용이 “실제 약관 텍스트” 기준을 만족하는지 불명확합니다. 예를 들어 `privacy-policy.md`에는 Twilio, Resend, Toss, 생년월일/성별 등 처리 항목이 들어가는데 실제 가입/처리 현황과 다르면 개인정보처리방침이 부정확해집니다. 초안 배너는 리스크를 줄이지만 “실제 약관”의 정확성 검증을 대체하지 못합니다.

- [MEDIUM] verification command 일부가 acceptance criteria와 충돌합니다. 예: `9-02-t3` verify는 `grep -c "console.log.*Password Reset" ... && ...` 형태인데 expected count가 0이면 `grep` exit status가 1이 되어 전체 command가 실패할 수 있습니다. expected-absence 검증은 `! grep -q` 또는 `test "$(grep -c ...)" = "0"`로 통일해야 합니다.

- [LOW] Plan 1의 TDD RED commit은 워크플로우에 따라 문제가 될 수 있습니다. “각 task commit”이 CI/PR 단위로 노출된다면 의도적으로 failing test commit을 만드는 것은 atomic green commit 원칙과 충돌합니다. 로컬 내부 단계라면 괜찮지만, push 단위라면 squash 또는 final green commit 전략을 명시해야 합니다.

- [LOW] Phase-level 범위가 “기술부채 12건”과 `DEBT-01~06` 6건 사이에서 혼재되어 있습니다. ROADMAP success criteria는 6건 중심이므로 괜찮지만, milestone target feature의 “12건”을 이 Phase가 전부 닫는 것처럼 표현하면 완료 판단이 흐려집니다.

## Suggestions
- Plan 3를 재작성하세요. 최소 기준: seeded booking/reservation setup, confirm page 진입, Toss widget iframe 또는 SDK ready state 확인, 결제 요청 후 success/cancel/error route 처리 중 하나를 실제로 end-to-end로 검증해야 합니다. `confirmIntercepted`는 반드시 `true` assert가 필요합니다.
- CI에서 `main` push 또는 scheduled/manual E2E는 `TOSS_CLIENT_KEY_TEST` 누락 시 fail로 바꾸고, fork PR만 skip하도록 분기하세요.
- Plan 2에 password reset flow verification을 추가하세요. dev mock으로 reset link를 생성하고 frontend reset page에서 새 비밀번호 변경까지 확인하는 integration/E2E 또는 명시적 manual UAT가 필요합니다.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL`을 production config validation 대상으로 묶으세요. `FRONTEND_URL`은 `https://` 시작 여부까지 검사하는 것이 좋습니다.
- Password reset request에 최소 rate limiting을 추가하거나, 기존 global throttling이 있다면 Plan 2 acceptance criteria에 “적용 확인”을 넣으세요.
- MD raw import는 하나로 결정하세요. `type: 'raw'`를 쓸지 `raw-loader`를 쓸지 정하고, 해당 dependency와 `next build` 검증을 plan에 반영해야 합니다.
- API React Email TSX 빌드는 `pnpm --filter @grapit/api build`를 acceptance criteria에 추가하세요. `typecheck`만으로 런타임 dependency와 Nest build를 충분히 검증하지 못합니다.
- Legal MD는 실제 수집 항목, 위탁사, 보유 기간, 회사 연락처가 현재 구현과 일치하는지 별도 checklist로 검증하세요.

## Risk Assessment
Overall risk: MEDIUM-HIGH

Justification: Plan 1은 낮은 리스크이고 Plan 2도 구현 방향은 대체로 타당하지만, public email 발송 side effect와 production config 검증 누락이 있습니다. 가장 큰 문제는 Plan 3입니다. 현재 형태로는 roadmap success criterion 4를 충족하지 못하고도 green이 될 수 있습니다. Phase 9를 “코드베이스 신뢰도 확보”로 마무리하려면 Toss E2E와 password reset 링크 완료 검증을 강화해야 합니다.

---

## Consensus Summary

> Only one independent reviewer (Codex) ran — consensus section mirrors Codex findings. Re-run with `gemini` or `opencode` installed for true cross-AI consensus.

### Top HIGH-severity concerns (block execution until addressed)

1. **Plan 3 (Toss E2E) does not close DEBT-05.** The happy-path spec asserts only URL routing — no seeded booking, no widget mount assertion, no real confirm flow. `confirmIntercepted` is checked by type, not value. Current design passes without exercising Toss sandbox end-to-end.
2. **CI E2E silently skips when `TOSS_CLIENT_KEY_TEST` is absent** even on `main` push — Phase 9 could be marked "done" despite Toss E2E never having executed.
3. **Plan 2 does not verify the full password reset link flow.** EmailService unit tests + auth.service wiring do not prove the roadmap success criterion "실제 이메일 발송 + 링크를 통해 비밀번호 변경 완료".
4. **No rate limiting on public `/auth/password-reset/request`.** Switching from `console.log` stub to real Resend send introduces abuse/quota-burn surface with no throttle.

### Top MEDIUM-severity concerns

- MD raw import strategy is internally inconsistent (`turbopack.rules` vs `raw-loader` vs no install). Needs a single decision plus `next build` verification.
- API-side React Email TSX build risk under-assessed — `@react-email/components` may require `react` runtime dep in `apps/api`.
- `EmailService` silently falls back to `onboarding@resend.dev` in production if `RESEND_FROM_EMAIL` is missing — should hard-fail like `RESEND_API_KEY`.
- `FRONTEND_URL` has no production validation (HTTPS prefix, non-empty) even though reset links embed it.
- Legal MD content accuracy vs actual data-processing reality is not checklist-verified (Twilio, Resend, Toss, 수집항목, 위탁사 등).
- Several `<verify>` blocks use `grep -c ... && ...` for expected-absence checks — will exit 1 on count=0 and mark green verify as red.

### LOW severity

- Plan 1's TDD RED intermediate commit may clash with "atomic green commit" policy if pushed to CI as-is.
- Milestone target "기술부채 12건" vs Phase 9 scope "DEBT-01~06 6건" framing inconsistency.

### Divergent views

N/A — single reviewer.

---

## Recommended actions before execution

1. **Rewrite Plan 3** — real E2E coverage (seeded reservation → confirm page → widget mount/SDK ready → assert confirm flow).
2. **Fix CI gate** — `main` push / scheduled / manual runs must fail when Toss test keys are missing; only fork PRs skip.
3. **Add password-reset-flow verification to Plan 2** — integration/E2E that pulls the reset link from dev mock log and completes password change, or an explicit manual UAT step.
4. **Add rate limiting** to `/auth/password-reset/request` or explicitly accept the risk in PLAN.md.
5. **Promote `RESEND_FROM_EMAIL` and `FRONTEND_URL` to hard-fail production config validation.**
6. **Decide MD raw import approach** (`turbopack.rules type: 'raw'` OR `raw-loader`) and make Plan 2 self-consistent; add `pnpm --filter @grapit/web build` acceptance.
7. **Add `pnpm --filter @grapit/api build` to Plan 2 acceptance** to validate React Email TSX + Nest build.
8. **Normalize expected-absence verify commands** to `! grep -q …` or `test "$(grep -c …)" = "0"`.

---

## How to incorporate this feedback

```
/gsd-plan-phase 9 --reviews
```

This will re-run planning with the REVIEWS.md concerns injected as additional constraints.

