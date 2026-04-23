---
phase: 13
reviewers: [codex]
reviewers_skipped:
  - name: claude
    reason: "running inside Claude Code (CLAUDE_CODE_ENTRYPOINT=cli) — skipped for independence"
  - name: cursor
    reason: "cursor agent authentication missing (Error: 'cursor agent login' required or CURSOR_API_KEY env var)"
  - name: gemini
    reason: "CLI not installed"
  - name: opencode
    reason: "CLI not installed"
  - name: qwen
    reason: "CLI not installed"
  - name: coderabbit
    reason: "CLI not installed"
reviewed_at: 2026-04-22T03:27:56Z
plans_reviewed:
  - 13-01-PLAN.md
  - 13-02-PLAN.md
  - 13-03-PLAN.md
  - 13-04-PLAN.md
---

# Cross-AI Plan Review — Phase 13

> **Reviewer coverage caveat:** Only **1 external CLI (codex, gpt-5.4)** produced a review this run. `claude` was skipped by design (same host as the running session), and `cursor` failed at authentication. The "Consensus" section below therefore summarizes single-reviewer findings rather than cross-validated consensus. Re-run `/gsd-review --phase 13 --cursor` after `cursor agent login` if multi-reviewer validation is required.

## Codex Review

**Summary**
Plan 13-01은 lockfile drift, SC-4, 예외 보존을 잘 의식했지만 현재 repo surface와 맞지 않아 그대로는 실패합니다. 실제로 `apps/api/test/admin-dashboard.integration.spec.ts`의 `grapit_test`, `apps/web/e2e/admin-dashboard.spec.ts`의 `admin@grapit.test`, `apps/api/src/modules/admin/upload.service.spec.ts`의 `grapit-uploads`/`cdn.grapit.kr`, `apps/api/src/modules/auth/email/templates/password-reset.tsx`의 `Grapit` comment 등이 계획에 빠져 있습니다.

Plan 13-02는 사용자 노출 copy 범위가 대체로 명확하지만 `email.service.spec.ts` frontmatter와 task 내용이 충돌하고, legal MD에 내부 deferred HTML comment를 넣는 것은 불필요하며 렌더링 누출 가능성이 있습니다. `sms.service.spec.ts`의 `INFOBIP_SENDER: 'Grapit'` 반례 fixture도 "브랜드 잔여" audit에서 false positive가 될 수 있어 허용 규칙이 필요합니다.

Plan 13-03은 가장 위험합니다. `deploy.yml`은 `vars.CLOUD_RUN_API_URL`을 OAuth callback env로 주입하는데, 계획은 이를 새 `.run.app` URL로 바꾸고 Plan 04는 provider에 `heygrabit.com` callback을 등록합니다. 이 둘이 불일치하면 OAuth가 깨집니다. 또한 새 Artifact Registry repo IAM, 두 번째 deploy 필요성, Sentry 검증 방식이 부족합니다.

Plan 13-04는 rollback/cleanup runbook을 둔 점은 맞지만, domain mapping을 `heygrabit.com -> grabit-web`으로만 전환하면서 `https://heygrabit.com/api/v1/health`를 검증합니다. 현재 web rewrites는 `localhost:8080` 대상이라 production에서 API routing 보장이 없습니다. API custom domain/path routing 설계가 먼저 확정돼야 합니다.

전체 Phase 13은 "rename" 자체보다 cutover 설계 리스크가 큽니다. P1/P2는 inventory 보강으로 해결 가능하지만, P3/P4는 API URL, OAuth callback URL, Cloud Run domain mapping 구조를 다시 정렬하지 않으면 성공 기준이 모순됩니다.

**Strengths**
- `pnpm-lock.yaml`을 같은 PR에서 재생성하고 `pnpm install --frozen-lockfile`로 검증하는 방향은 맞습니다.
- D-01 `grapit_dev`, D-03 local path, D-05 `grapit-cloudrun@`, D-07 synthetic email 예외를 명시한 점은 좋습니다.
- P3/P4를 `autonomous: false`와 human checkpoint로 분리한 판단은 적절합니다.
- SC-4를 별도 audit script로 강제하려는 접근은 필요합니다.
- cutover 전에 rollback capture를 요구하고, 구 리소스를 7일 유예하는 방향은 운영상 합리적입니다.

**Concerns**
- **HIGH**: P3/P4 OAuth callback URL이 모순됩니다. `.github/workflows/deploy.yml:99`는 `KAKAO_CALLBACK_URL=${{ vars.CLOUD_RUN_API_URL }}/...`를 주입하고, `apps/api/src/modules/auth/strategies/kakao.strategy.ts:26`는 그 값을 실제 callbackURL로 씁니다. Plan 03에서 `CLOUD_RUN_API_URL`을 `.run.app`으로 바꾸면 Plan 04의 `https://heygrabit.com/api/...` 등록과 불일치합니다.
- **HIGH**: `heygrabit.com/api/v1/health` 검증은 현재 구조상 성립하지 않을 수 있습니다. `apps/web/next.config.ts:50`의 rewrite destination은 `http://localhost:8080`입니다. Cloud Run web container 내부에 API가 같이 떠 있지 않으면 apex domain mapping만으로 API health가 200이 될 수 없습니다.
- **HIGH**: P1 inventory가 불완전합니다. 예: `apps/api/test/admin-dashboard.integration.spec.ts:47`의 `grapit_test`, `apps/api/src/modules/admin/upload.service.spec.ts:27`의 R2 fixture, `apps/api/src/modules/auth/email/templates/password-reset.tsx:8`의 `Grapit` comment가 누락됐습니다.
- **MEDIUM**: Plan 03 첫 deploy 후 GitHub variables를 갱신하고 재배포해야 하는데, acceptance가 "두 번째 deploy의 env/build args 반영"을 강제하지 않습니다.
- **MEDIUM**: 새 Artifact Registry repo 생성만 있고 GitHub deploy principal의 `artifactregistry.writer`, Cloud Run pull 권한 검증이 없습니다.
- **MEDIUM**: Sentry 검증이 약합니다. 404는 보통 Sentry issue가 아니고, SDK init만으로 이벤트가 생긴다는 가정도 부정확합니다.
- **MEDIUM**: cleanup script는 "7일 후 실행"을 comment로만 둡니다. 실수로 즉시 실행해도 막지 못합니다.
- **MEDIUM**: legal MD에 내부 deferred HTML comment를 넣는 것은 scope creep입니다. legal content는 사용자/법무 문서라 내부 TODO를 섞지 않는 편이 안전합니다.
- **LOW**: `rg -c ... | wc -l`은 occurrence count가 아니라 matching file line count입니다. no-match 시 `set -euo pipefail`과 함께 예상과 다르게 중단될 수 있습니다.
- **LOW**: "DO NOT modify any .planning file"와 active phase summary/UAT 문서 작성 요구가 충돌합니다. active phase folder는 예외라고 명시해야 합니다.

**Suggestions**
1. P1 시작 전에 `rg -l 'grapit|Grapit|@grapit/|@grapit\.com' --glob '!.planning/**' ...` 결과를 canonical inventory로 저장하고, 모든 non-allowed file을 plan에 추가하세요.
2. allowed exceptions 파일 단위 제외를 줄이고 line-level allowlist로 바꾸세요. 예외는 `grapit_dev`, `/grapit/.env`, `grapit-cloudrun@`, 필요 시 `INFOBIP_SENDER: 'Grapit'` 반례 fixture처럼 정확히 제한해야 합니다.
3. P3 전에 API routing 결정을 먼저 하세요. 선택지는 `api.heygrabit.com -> grabit-api` 별도 domain mapping, 또는 web의 `/api` rewrite를 실제 `grabit-api` URL로 바꾸는 방식입니다. 그 결정 없이는 P4 acceptance가 불가능합니다.
4. OAuth callback은 API runtime env와 provider console에 같은 URL을 넣으세요. 가능하면 cutover 전에 새 callback URL을 provider에 미리 추가하고, 구 callback은 7일 후 제거하세요.
5. Plan 03에 "variables 갱신 후 workflow_dispatch 재배포"를 필수 task로 만들고, Cloud Run revision env/build arg를 `gcloud run services describe ... --format`으로 검증하세요.
6. Sentry는 `/api/v1/sentry-test` 같은 authenticated/admin-only test endpoint나 one-off script로 `captureException`을 실제 호출하는 방식으로 검증하세요.
7. cleanup script에는 `--confirm-after-date YYYY-MM-DD`, current mapping `routeName=grabit-web`, 구 서비스 최근 요청 0건 같은 hard gate를 넣으세요.
8. deferred mailbox/Resend/Infobip 항목은 legal MD comment가 아니라 `13-04-SUMMARY.md`나 PROJECT Concerns에 기록하세요.

**Risk Assessment**
전체 risk는 **HIGH**입니다. P1/P2는 수정 가능한 inventory 문제지만, P3/P4는 현재 계획대로면 domain mapping, API routing, OAuth callback URL이 서로 맞지 않아 cutover 당일 실제 로그인/API가 깨질 가능성이 큽니다. API custom domain/path routing과 OAuth callback source of truth를 먼저 고정한 뒤 P3/P4를 다시 쓰는 것이 필요합니다.

---

## Cursor Review

Cursor review failed: Authentication required. Run `cursor agent login` first, or set `CURSOR_API_KEY` environment variable. Review skipped per workflow policy ("If a CLI fails, log the error and continue").

---

## Consensus Summary

> **Note:** Only 1 reviewer produced feedback. The following is a prioritized distillation of codex's findings rather than multi-source consensus. Treat HIGH items as blockers regardless.

### Agreed Strengths

_(single-reviewer)_

- lockfile 재생성을 rename과 동일 PR에 묶은 P1 전략.
- D-01/D-03/D-05/D-07 decision 예외를 acceptance criteria로 encode한 정확성.
- Plan 13-03/13-04를 `autonomous: false` + human checkpoint로 분리한 운영 판단.
- SC-4를 별도 `scripts/audit-brand-rename.sh`로 강제 검증.
- rollback capture + 7일 유예 + `.gitignore`로 rollback.yaml 커밋 차단 (T-13-23).

### Blocker-Tier Concerns (must address before execution)

1. **[HIGH] API routing을 먼저 확정하라.** Plan 13-04가 `curl -sI https://heygrabit.com/api/v1/health 200`을 acceptance로 두지만, `apps/web/next.config.ts:50`의 rewrite destination은 `http://localhost:8080`이라 prod에서는 web container가 API를 dev 모드로 proxy할 뿐이다. apex domain mapping만으로 API health가 200이 될지는 현재 구조로 증명되지 않았다. 선택지: (a) `api.heygrabit.com` 서브도메인을 `grabit-api`에 별도 domain mapping, (b) next.config rewrite destination을 `grabit-api` `.run.app` URL로 바꾸는 방식. **이 결정 없이는 Plan 13-03/13-04 재작업 불가피.**

2. **[HIGH] OAuth callback URL source-of-truth 일원화.** `.github/workflows/deploy.yml:99`가 `KAKAO_CALLBACK_URL=${{ vars.CLOUD_RUN_API_URL }}/...` 를 주입하고, `apps/api/src/modules/auth/strategies/kakao.strategy.ts:26`가 그 값을 실제 callbackURL로 사용. Plan 13-03 Task 4는 `CLOUD_RUN_API_URL`을 새 `.run.app` URL로 교체, Plan 13-04 Task 4는 provider console에 `heygrabit.com` URL을 등록. runtime env와 provider 등록이 서로 다르면 OAuth 완전 실패. **cutover 전에 provider 콘솔에 `heygrabit.com/api/v1/auth/social/{provider}/callback` 선등록 → runtime env도 동일 값으로 맞추기.**

3. **[HIGH] P1 rename inventory가 불완전.** Plan 13-01 frontmatter의 `files_modified` 목록이 실제 repo surface와 다름:
   - `apps/api/test/admin-dashboard.integration.spec.ts` (grapit_test)
   - `apps/web/e2e/admin-dashboard.spec.ts` (admin@grapit.test)
   - `apps/api/src/modules/admin/upload.service.spec.ts` (grapit-uploads / cdn.grapit.kr R2 fixture)
   - `apps/api/src/modules/auth/email/templates/password-reset.tsx` (Grapit comment)
   
   Plan 13-01 Task 1 STEP 4의 `git ls-files '*.ts' '*.tsx' '*.mjs' '*.js' | xargs rg -l '@grapit/'` bulk rename은 `@grapit/` 스코프만 잡고, `grapit_test` / `admin@grapit.test` / `grapit-uploads` / Title-case `Grapit` comment 는 놓친다. **Execute 전에 `rg -l 'grapit|Grapit|@grapit/|@grapit\.com'` full inventory를 돌려 Plan 13-01에 누락 파일 모두 추가해야 SC-1/SC-2 audit이 green 될 수 있음.**

### Medium-Tier Concerns (ship-blocking if unaddressed, but fixable in place)

4. **[MEDIUM] Plan 13-03 second-deploy 강제.** GitHub variables `CLOUD_RUN_{API,WEB}_URL` 갱신 후 `workflow_dispatch` 재배포가 "순서 주의" 노트로만 기술됨. acceptance_criteria에 "재배포 후 Cloud Run revision env/build arg 반영" 을 검증 step으로 승격.

5. **[MEDIUM] AR IAM 누락.** 새 `grabit` Artifact Registry repo 생성 후 GitHub deploy principal의 `roles/artifactregistry.writer`, Cloud Run pull principal의 `roles/artifactregistry.reader` 바인딩 검증이 없음. deploy workflow가 push 시점에 `Permission denied` 로 실패할 가능성.

6. **[MEDIUM] Sentry 이벤트 검증 수준.** 404는 Sentry 기본 capture 대상이 아니고, SDK init만으로 이벤트가 생긴다는 Plan 13-03 Task 4의 문구는 부정확. 신뢰성 있는 검증 경로는 admin-only test endpoint에서 `captureException` 을 one-off로 호출하는 것.

7. **[MEDIUM] cleanup 7-day gate를 enforce.** Plan 13-04 Task 5의 `scripts/cleanup-old-grapit-resources.sh`가 "T+7 이후에만 실행"을 상단 주석으로만 관리. hard gate (예: `--confirm-after-date YYYY-MM-DD`, current mapping `routeName=grabit-web` 확인, 구 서비스 최근 N시간 요청 0건 확인) 를 스크립트 자체 precondition으로 추가.

8. **[MEDIUM] Legal MD 내부 comment scope creep.** Plan 13-02 Task 3의 `<!-- [Phase 13 deferred follow-up] ... -->` HTML 주석은 legal/법무 문서에 내부 TODO 를 섞는 것. MDX 파싱 차이·렌더러 업그레이드 때 노출 위험. deferred 항목은 `13-04-SUMMARY.md` 또는 PROJECT.md Concerns 로 이관.

9. **[MEDIUM] SMS spec fixture false-positive.** Plan 13-02가 `sms.service.spec.ts` L299/L316의 `[Grapit]` 반례 fixture를 `[Grabit]` 으로 바꾸는데, KISA sender-ID 거부 반례 로서의 가독성이 사라짐. audit 관점에서도 `INFOBIP_SENDER: 'Grapit'` alphanumeric 거부 테스트 의도를 유지하려면 line-level allowlist + 주석 강화 필요.

### Low-Tier Concerns (cleanup items)

10. **[LOW] grep 검증 패턴 semantics.** `rg -c ... | wc -l` 은 occurrence 수가 아니라 matching file 수. `set -euo pipefail` + no-match 시 `rg -c` 가 exit 1 리턴 → pipe 전체가 실패. Plan 13-01/02의 여러 acceptance_criteria bash snippet이 이 함정에 걸릴 수 있음. `|| true` 추가 또는 `rg -c ... | awk ... or 0` 패턴으로 보완.

11. **[LOW] SC-4 가드와 active phase 문서 작성 충돌.** 여러 plan의 "DO NOT modify any `.planning/` file" 제약과 각 plan의 `output`에 `13-0N-SUMMARY.md` / `13-HUMAN-UAT.md` 생성 요구가 표면상 충돌. "active phase folder (`.planning/phases/13-grapit-grabit-rename/`)는 예외" 임을 모든 plan에서 일관된 문구로 명시.

### Divergent Views

_(N/A — single reviewer)_

---

## How to Apply This Review

각 concern을 Plan에 반영하려면:

```bash
# 1. Blocker concerns를 planner에게 전달해서 계획을 수정
/gsd-plan-phase 13 --reviews

# 2. 이 REVIEWS.md 를 planner가 자동으로 읽고 Concerns HIGH 부터 addressed
#    planner가 각 plan의 acceptance_criteria + files_modified + action step 을 업데이트
```

또는 개별 concern만 손으로 반영하려면 해당 plan의 `<tasks>` / `<acceptance_criteria>` 섹션을 직접 편집.

**권장:** HIGH 3건(#1 API routing, #2 OAuth callback SoT, #3 P1 inventory)은 `/gsd-discuss-phase 13 --partial` 로 재논의 → Plan 13-03/13-04 rewrite가 필요할 가능성이 큼.
