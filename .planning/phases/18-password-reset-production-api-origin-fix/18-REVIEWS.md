---
phase: 18
reviewers: [claude]
failed_reviewers: [cursor]
skipped_reviewers:
  codex: "Skipped because the current runtime is Codex; review workflow requires avoiding the same CLI for independence."
  gemini: "CLI not installed."
  coderabbit: "CLI not installed."
  opencode: "CLI not installed."
  qwen: "CLI not installed."
  ollama: "Local OpenAI-compatible server not available at configured/default host."
  lm_studio: "Local OpenAI-compatible server not available at configured/default host."
  llama_cpp: "Local OpenAI-compatible server not available at configured/default host."
reviewed_at: 2026-04-29T03:12:03Z
plans_reviewed:
  - 18-01-PLAN.md
  - 18-02-PLAN.md
---

# Cross-AI Plan Review -- Phase 18

## Reviewer Execution

- Claude: completed successfully.
- Cursor: invoked but failed before review output due to missing authentication: `Error: Authentication required. Please run 'cursor agent login' first, or set CURSOR_API_KEY environment variable.`
- Codex: available but intentionally skipped because this session is running in Codex and the workflow calls for an independent CLI.

## Claude Review

# Phase 18 Plan Review

## Summary

Phase 18은 v1.1 audit가 식별한 password reset confirm flow의 production API origin break를 좁고 정확하게 닫는다. Plan 01은 `apiUrl()` shared helper로 4개 caller의 origin 중복을 제거하고 `next.config.ts`의 production rewrite 누수를 회귀 테스트로 고정하는 코드 변경이며, Plan 02는 production smoke evidence를 capture하는 UAT artifact 작업이다. Phase 09/15에서 확립된 reset-token 401 raw fetch UX와 Phase 13의 `api.heygrabit.com` 결정을 그대로 존중하면서, Phase 18이 추가로 고치려 하지 않는 backend/Resend/CORS 경계도 명확하다. 전반적으로 scope가 잘 잡혀 있고 TDD-first로 contract를 lock한다는 점에서 견고한 plan이지만, 인접한 `socket-client.ts`와 production build-time guard에 대한 후속 결정이 plan 외부에 남아 있다.

---

## Plan 18-01 Review

### Strengths

- **Scope discipline**: backend `AuthService.resetPassword`, EmailService, JWT secret 구조에 손대지 않고 frontend origin boundary 한 곳만 수정. Phase 09 plan summary가 명시한 "raw fetch must remain to keep token-401 UX"를 task action에 명시적으로 보존.
- **Contract-first TDD**: Task 1의 acceptance criteria가 단순히 `.toContain()`이 아니라 정확한 절대 URL과 production-localhost throw 메시지를 lock -- research가 식별한 "기존 테스트의 substring 함정"을 직접 폐쇄.
- **Test for the audit's exact failure mode**: Task 3의 `next-config.test.ts`는 `JSON.stringify(rewrites).not.toContain('localhost:8080')` 형태로 audit가 발견한 정확한 실패 모드를 회귀 가드로 고정. dev-mode positive assertion까지 둠.
- **Type-safe path**: `apiUrl(path: `/${string}`)`로 leading-slash 누락을 컴파일 타임에 차단.
- **Centralized localhost guard**: `apiUrl()`이 production에서 localhost variants(localhost, 127.0.0.1, optional port)를 throw -- Cloud Run에서 silent fallback 자체를 fail-loud로 만듦.

### Concerns

- **MEDIUM -- `NEXT_PUBLIC_API_URL` 빈 값이 production build에서 통과**: `apiUrl()`은 base가 비어 있으면 relative path를 반환한다. production rewrite도 `[]`라서 결과적으로 `/api/...`가 404가 되며 fail-loud 동작은 맞지만, audit가 다시 일어날 수 있는 정확한 실패 모드(deploy build-arg 누락)에 대한 자동 가드는 없다. Next.js 16 빌드 단계에서 `NEXT_PUBLIC_API_URL`이 비어 있으면 빌드 자체를 실패시키거나, 최소한 deploy.yml에 `[ -n "${{ vars.CLOUD_RUN_API_URL }}" ] || exit 1` precheck를 추가하면 회귀를 한 단계 더 막을 수 있다. Plan 18-01 안에서 다룰 수도, Phase 24 operational hardening으로 미룰 수도 있는데 결정이 없다.
- **MEDIUM -- `socket-client.ts`는 동일 패턴인데 wiring 대상에서 빠짐**: `apps/web/lib/socket-client.ts`는 `const WS_URL = process.env.NEXT_PUBLIC_WS_URL || ''`로 동일한 origin 중복을 가지고 있으며, deploy.yml은 `NEXT_PUBLIC_WS_URL=${{ vars.CLOUD_RUN_API_URL }}`로 같은 값을 사용한다. PATTERNS.md도 supporting analog로 명시함. password-reset 회귀 자체는 fix되지만 동일한 회귀 클래스(localhost 누수)가 socket 경로에 그대로 남는다. plan이 의도적으로 out-of-scope로 두었다면 명시가 필요하고, 작은 추가라면 `wsUrl()` 헬퍼를 같이 도입하는 편이 일관적이다.
- **LOW -- `LOCALHOST_RE`가 path를 가진 base URL은 비교하지 못함**: `^https?://(localhost|127\.0\.0\.1)(:\d+)?$/i`는 `http://localhost:8080/api` 같이 path가 붙은 잘못된 설정을 catch하지 못한다. trim + trailing-slash 제거만 하므로 edge case로 통과 가능. `0.0.0.0`이나 IPv6 `[::1]`도 unmatched.
- **LOW -- Sentry wrapper 하의 `next-config.test.ts` 신뢰성**: `withSentryConfig`가 dev/test에서 silently no-op이거나, 환경에 따라 `rewrites`를 함수 그대로 노출하지 않을 수 있다. plan이 "use it directly; do not change production code to satisfy the test"라고 명시했지만, Sentry config가 `silent: !process.env.CI`를 검사하므로 CI/local에서 동작 차이가 날 수 있다. Vitest에서 import 시 에러가 나거나 분석 결과가 다를 가능성이 있다.
- **LOW -- `NODE_ENV` runtime 체크의 클라이언트 번들 의미**: Next.js는 `process.env.NODE_ENV`를 빌드 시 인라이닝하므로 client-side bundle에서는 사실상 정적 상수가 된다. plan은 이를 가정하여 잘 작동하지만, 만약 `apiUrl()`이 server component/route handler 양쪽에서 import되면 빌드 모드가 일관되지 않을 우려가 있다 -- 현재 호출자(api-client/auth/login-form/reset-password page)는 모두 client이므로 문제 없음. 명시적 주석이 있으면 좋다.
- **LOW -- 기존 reset-password.test.tsx의 mock fetch가 절대 URL로 변경되어도 fetch mock은 같은 객체 -- 어떤 테스트도 base URL을 stub하지 않은 채 helper를 import할 경우 leak**: `vi.unstubAllEnvs()` 누락 시 다른 spec 파일이 영향을 받을 수 있음. Task 2에서 `afterEach(() => vi.unstubAllEnvs())`를 명시한 것은 좋지만, 기존 `mockSearchParams.current` 패턴과 같은 테스트 파일 안에서 module-level state도 reset 필요.

### Suggestions

1. **`apiUrl()` JSDoc에 build-time inlining 명시**: `/* NOTE: process.env.NEXT_PUBLIC_API_URL and NODE_ENV are inlined by Next.js at build time for browser bundles. The throw protects against deploy-arg misconfiguration. */` 같은 주석으로 의도를 lock.
2. **`socket-client.ts` 결정 명시**: Plan 01 frontmatter나 Plan 02 UAT 안에 "WS origin은 Phase 24 operational hardening sweep으로 이관"처럼 deferral을 한 줄 추가하면 audit 재발견을 방지.
3. **deploy.yml precheck 한 줄**: API/Web build 직전에 `if [ -z "${{ vars.CLOUD_RUN_API_URL }}" ]; then echo "::error::CLOUD_RUN_API_URL not set"; exit 1; fi`를 두면 build-arg 누락을 fail-fast.
4. **`LOCALHOST_RE` 보강 검토**: `0.0.0.0`과 path-suffixed 케이스를 테스트로 추가하거나, regex 대신 `URL` 객체로 hostname만 비교하는 게 더 안전.
5. **dev에서도 localhost가 아닌 임의 production 도메인이면 통과**: `NODE_ENV !== 'production' && LOCALHOST_RE.test(...)` 같은 추가 가드는 필요 없지만, dev에서 prod 도메인을 우연히 stub하지 못하도록 helper 자체에 dev mode label을 expose해도 좋음 (옵션).

### Risk Assessment

**LOW** -- 변경 범위가 좁고, 기존 테스트(`reset-password.test.tsx`, web full suite)가 회귀를 잡을 수 있다. 새 helper의 contract는 TDD로 lock되며, production-side 안전장치(throw on localhost, dev-only rewrite)가 fail-loud다. 식별된 인접 위험(socket-client, 빈 build arg)은 본 phase의 success criteria를 위협하지 않는다.

---

## Plan 18-02 Review

### Strengths

- **Phase 15 UAT 패턴 그대로 승계**: Pre-conditions/SC-1~4/Sign-off 구조와 redaction 규칙이 일관됨. 운영자가 이미 익숙한 형식.
- **Enumeration defense 함정 명시**: `auth.service.ts:226-235`의 social-only/미가입 silent return 동작을 UAT precondition에 박아둔 것은 Phase 15의 retrospective에서 학습한 layered failure를 잘 반영.
- **두 단계 automated gate**: Task 2가 fast focused smoke를 먼저 돌리고 그 다음 full gate를 돌리도록 분리 -- feedback loop 명확.
- **공격적인 redaction grep**: JWT/cookie/Set-Cookie/secret 키워드/임의 email까지 negative grep으로 검사. `no-reply@heygrabit.com`만 allow하는 inverse-match 패턴은 깔끔.
- **deploy.yml build-arg 계약 검증**: `--build-arg NEXT_PUBLIC_API_URL=...` 라인을 grep으로 명시 -- Phase 18이 cutover한 contract가 인프라 코드에 그대로 살아있음을 결정 보존.

### Concerns

- **MEDIUM -- Plan 01 deploy 시점에 대한 자동 게이트 부재**: Task 3은 "After Plan 01 is deployed to production"이라고만 명시. 실제 deployed Cloud Run revision이 Plan 01 변경을 포함하는지 (`gcloud run services describe grabit-web --region=asia-northeast3 --format='value(spec.template.spec.containers[0].image)'`로 git sha 확인) 또는 image digest 확인 step이 없다. Phase 15는 `grabit-api-00013-lkx`처럼 revision id를 기록했는데 18-HUMAN-UAT.md template에는 그런 revision pinning 항목만 있을 뿐 자동 검증이 없다. UAT 운영자가 잘못된 revision에서 smoke를 돌릴 가능성.
- **MEDIUM -- CUTOVER-04(Sentry capture) 검증이 negative-only**: `Resend send failed.*empty` grep은 부재 증명. 실제 Sentry capture branch가 production에서 동작하는지는 확인하지 않는다. Plan 02 frontmatter는 CUTOVER-04를 requirement로 lock했지만 task action은 "Sentry dashboard check is optional"로 두었다. 최소한 Sentry email-service tag로 Plan 15 cutover 이후 한 번이라도 event가 기록되었는지(혹은 의도적으로 0건) 명시적 statement가 필요.
- **MEDIUM -- Token redaction grep의 false negative 위험**: Korean planning prose 안에 reset link을 capture하지 않게 하는 것은 좋지만, 실제 production reset link은 `https://heygrabit.com/auth/reset-password?token=...` 형태다. grep `\\?token=`은 정확히 이 패턴을 잡지만 운영자가 `token = abc...` 처럼 띄어쓰기로 적으면 통과. 또 base64url JWT regex `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`는 헤더가 항상 `eyJ`로 시작한다는 가정에 의존. 안전하지만 완벽하지는 않음.
- **LOW -- email regex grep이 false positive 가능**: `[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}`가 production 운영 메모(`gmail.com 받은편지함`처럼 `@` 포함된 다른 표기)에서 매칭되지 않는 한 안전하나, sender allowlist(`no-reply@heygrabit.com`)가 한 줄 안에 user email과 같이 적히면 grep이 그 줄을 제외하지 못한다. `rg -v`는 line-level이므로 same-line co-occurrence가 위험.
- **LOW -- Task 2 phase-gate 명령이 무겁다**: `pnpm --filter @grabit/web test` 전체 suite + api auth/email tests + typecheck + focused. Plan 02만의 비용이 5분+. `<phase_gate>` 안에 다 묶어서 1회 통과 후 진행은 합리적이지만, fast smoke와 phase gate 사이에 web full suite와 api focused만 따로 실패할 경우 어느 단계에서 실패했는지 trace가 어려움. Task 2 record 단계에서 각 명령별 PASS/FAIL을 분리 기록하라는 지시가 이미 있으니 큰 문제는 아님.
- **LOW -- `CUTOVER-02/03`은 Phase 15 결과 재확인일 뿐**: Plan 02 frontmatter가 두 ID를 모두 list하지만, Phase 18이 새로 생성하는 evidence는 confirm POST URL과 login success 두 개이고 secret manager / Cloud Run revision 검증은 명시되지 않음. UAT artifact에 `gcloud secrets versions access latest --secret=resend-from-email` 결과를 기록하는 한 줄이 있으면 stale evidence를 안전하게 제거.
- **LOW -- Plan 02 success criteria의 "no full reset token, JWT, cookie header, or raw secret value" 검증이 partial**: 위 grep이 범용 secret(`SECRET=`, `API_KEY=`)만 catch. `Bearer eyJ...`, `Authorization:` header, `RESEND_API_KEY=re_...` 같은 raw key는 대부분 catch되지만 `password = ...` 같은 운영자 메모는 통과. 추가 patterns(`password\\s*[:=]`, `Bearer\\s+`)을 검토하면 더 안전.

### Suggestions

1. **Revision pin 검증 step 추가**: Task 3 안에 "Cloud Run web/api revision이 Plan 01 머지 commit의 image digest를 사용하는지 확인" 한 줄을 두고, `gcloud run services describe grabit-web --region=asia-northeast3 --format='value(spec.template.spec.containers[0].image)' | grep -F '<sha-prefix>'`로 자동 검증.
2. **Sentry positive evidence 기록 항목**: 18-HUMAN-UAT.md의 SC-4에 "Sentry `component:email-service` 최근 24h count: ___ (운영 트래픽 기준 0건 또는 의도적 1건 capture 확인)" 칸을 추가.
3. **Email/secret grep 견고화**: same-line co-occurrence를 막기 위해 `rg -n -i "([[:alnum:]._%+-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,})" --replace '$1' | rg -v "^no-reply@heygrabit\\.com$"` 식으로 추출 후 비교. 또는 `rg --pcre2`로 lookbehind 사용.
4. **CUTOVER-02/03 stale-recheck 한 줄**: `gcloud secrets versions access latest --secret=resend-from-email` 결과(`no-reply@heygrabit.com`)와 `gcloud run services describe grabit-api --region=asia-northeast3 --format='value(status.latestReadyRevisionName)'` 결과를 UAT 안에 기록.
5. **password-based UAT 계정 사전 준비 가이드**: Phase 15 UAT가 social-only 함정을 만난 retrospective를 인용하여 Pre-conditions에 "테스트 계정의 `passwordHash IS NOT NULL` 확인 -- 미보유 시 `https://heygrabit.com/auth/signup` 으로 새 계정 생성" 단계 추가.

### Risk Assessment

**LOW-MEDIUM** -- Plan 02는 본질적으로 evidence-capture artifact라 코드 회귀를 일으키지 않는다. 다만 (a) Plan 01 deploy 확인 부재로 UAT가 잘못된 revision에서 통과로 기록될 위험, (b) CUTOVER-04 positive 증거 부재, (c) redaction grep의 false negative가 LOW 보안 위험을 남긴다. 이 세 가지는 plan 자체 수정 한두 줄로 닫을 수 있다.

---

## Cross-Plan Observations

- **Wave dependency 명확**: Plan 02가 `depends_on: ["18-01"]`로 명시 + Plan 02 Task 3가 deploy after Plan 01을 요구. 자동 ordering OK.
- **요구사항 매핑 일관**: DEBT-01은 Plan 01/02 모두에, CUTOVER-01..06은 Plan 02에 집중. CUTOVER-06(email regression green)는 Plan 02 Task 2 phase_gate에서 실제 실행되어 닫힌다.
- **Phase 19/20과의 경계**: Plan 01이 reservation/payment ownership(Phase 19), Valkey runtime contract(Phase 20)에 손대지 않음. Audit가 식별한 다른 gap을 Phase 18로 흡수하지 않은 것은 좋은 scope discipline.
- **PATTERNS.md 활용**: Plan 01의 file 매핑이 PATTERNS.md analog와 1:1로 정렬되어 planner의 의도가 reviewer/executor에게 명확.

## Overall Risk Assessment

**LOW**

Justification: Phase 18은 좁고 잘 검증된 fix로, audit가 식별한 정확한 실패 모드를 TDD로 회귀 가드한다. backend 권한 경계, token 검증, EmailService Sentry 분기, Phase 13 도메인 결정을 그대로 보존하므로 새로운 보안/세션 회귀 위험이 거의 없다. Plan 01의 contract test와 Plan 02의 phase gate가 함께 production smoke까지 닫는다. 식별된 MEDIUM 우려(`socket-client.ts` 동일 패턴, deploy 시점 자동 검증 부재, CUTOVER-04 positive 증거)는 모두 plan 외부에서 재현 가능한 follow-up이며, 현재 phase의 success criteria 자체를 위협하지 않는다.

---

## Cursor Review

Cursor review did not produce feedback.

```text
Error: Authentication required. Please run 'cursor agent login' first, or set CURSOR_API_KEY environment variable.
```

---

## Consensus Summary

Only one independent reviewer completed successfully, so true 2+ reviewer consensus could not be established in this run. The summary below captures the completed Claude review and records where additional reviewer coverage is still missing.

### Agreed Strengths

- Phase 18 has tight scope: it fixes the production password reset API origin break without reopening backend reset-token authority, EmailService behavior, JWT/session flow, or unrelated payment/reservation gaps.
- Plan 18-01 is contract-first and tests the exact production failure mode: shared `apiUrl()`, absolute reset confirm URL, production localhost guard, and dev-only rewrite behavior.
- Plan 18-02 carries the Phase 15 UAT style forward and explicitly protects password reset evidence from PII, reset-token, JWT, cookie, and secret leakage.

### Agreed Concerns

- `NEXT_PUBLIC_API_URL` being empty in a production build remains a possible deployment-contract gap. The plan fails loudly at runtime through missing rewrite/404 behavior, but does not fail the build or deploy precheck.
- `apps/web/lib/socket-client.ts` appears to have a related origin-construction pattern that is intentionally or accidentally out of scope. The plan should either defer it explicitly or include a small websocket-origin helper follow-up.
- Plan 02's production UAT should pin the actual Cloud Run web/api revision or image digest that contains Plan 01, otherwise smoke evidence could accidentally be gathered against the wrong deployed revision.
- CUTOVER-04 Sentry/email observability evidence is currently mostly negative evidence. A positive or explicitly zero-count Sentry statement would make the UAT artifact stronger.
- The redaction gate is good, but can be made stricter for token spacing variants, same-line email allowlist issues, `Authorization:`/`Bearer`, and password/secret wording.

### Divergent Views

- No divergent reviewer views were available because Cursor could not authenticate and no second independent review completed.

### Recommended Planner Follow-up

- Add a deploy/build precheck for missing `CLOUD_RUN_API_URL` or explicitly defer it to an operational hardening phase.
- Decide whether `socket-client.ts` is in scope for Phase 18 or document a deferral.
- Add revision/image digest pinning to Plan 02 Task 3.
- Strengthen SC-4 with Sentry `component:email-service` recent count or an explicit "0 expected failures" record.
- Tighten redaction grep patterns before production UAT evidence collection.
