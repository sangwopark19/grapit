---
quick_id: 260420-ci-toss-secrets-restore
date: 2026-04-20
status: complete
external_changes:
  github_secrets_restored:
    - TOSS_CLIENT_KEY_TEST
    - TOSS_SECRET_KEY_TEST
files_changed:
  - .planning/quick/260420-cd7-deploy-secrets-missing-infobip-sentry-toss/260420-cd7-SUMMARY.md
ci_run: https://github.com/sangwopark19/grapit/actions/runs/24656038665
pr: https://github.com/sangwopark19/grapit/pull/17
---

# Quick Task — CI Toss test secrets 복구 — SUMMARY

## Task
PR #17 CI 실패 복구. `Verify Toss test secrets present` hard-gate exit 1.

## Root Cause
직전 quick task `260420-cd7` 의 "고아 시크릿 정리" 단계에서 `TOSS_CLIENT_KEY_TEST` / `TOSS_SECRET_KEY_TEST` 를 **deploy.yml 기준으로만 orphan 검사**하여 제거. 그러나 Phase 09-03 **D-13 격리** 설계상 이 두 secret 은 의도적으로 `deploy.yml` 주입 금지이며 `ci.yml` 전용 (E2E Toss 결제 spec + non-fork hard-gate) 이다.

즉, D-13 격리 시크릿은 deploy.yml 단독 기준 orphan 검사에서 반드시 false positive 로 잡힌다.

## Fix
1. `gh secret set TOSS_CLIENT_KEY_TEST` = `test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm`
2. `gh secret set TOSS_SECRET_KEY_TEST` = `test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6`
   - 값 출처: 09-03-PLAN.md §Installation — Toss 공식 docs 공개 테스트 키
   - 동일 값이 이미 `.env.example`, `NEXT_PUBLIC_TOSS_CLIENT_KEY` GitHub secret 에 존재 → 추가 노출 없음
3. `gh run rerun 24656038665` — PR #17 CI 재실행
4. `260420-cd7-SUMMARY.md` 에 보정 메모 추가 — 재발 방지

## Verification
- CI run `24656038665`: `success`, 2m59s (08:25:37 → 08:28:36 UTC)
- `Verify Toss test secrets present` step 통과 확인
- E2E Toss step 정상 수행

## Lesson
GitHub Secrets orphan 검사는 반드시 `.github/workflows/*.yml` **전체 파일** 기준 grep 으로 수행. 단일 workflow (`deploy.yml` 등) 만 검사하면 D-격리 전용 시크릿 (ci.yml-only, e2e-only 등) 이 체계적으로 false positive 로 걸린다.

향후 secret 제거 PR 체크리스트:
```bash
grep -rn "SECRET_NAME" .github/workflows/  # 모든 워크플로
grep -rn "SECRET_NAME" apps/*/e2e/         # Playwright spec
grep -rn "SECRET_NAME" .env.example         # 로컬 dev contract
```
3곳 모두 매치 없을 때만 orphan 으로 확정.
