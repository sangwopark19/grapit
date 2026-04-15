# Phase 09.1 — Cleanup verification

**Run date:** 2026-04-15
**Commit SHA:** e6fb188 (chore(09.1): remove diagnostic CI steps and DEBUG_AUTH_REQ env)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| grep AUTH_LOGIN_DEBUG in apps/ | 0 | 0 | ✓ |
| grep DEBUG_AUTH_REQ in apps/ | 0 | 0 | ✓ |
| grep AUTH_LOGIN_DEBUG\|DEBUG_AUTH_REQ in .github/ | 0 | 0 | ✓ |
| grep createAuthReqDebugMiddleware in apps/ | 0 | 0 | ✓ |
| grep req-debug in apps/ | 0 | 0 | ✓ |
| dir apps/api/src/modules/auth/debug | not exist | not exist | ✓ |
| dir apps/web/e2e/diagnostic | not exist | not exist | ✓ |
| `.env.example` 에 DEBUG_AUTH_REQ 0건 (Pitfall 3) | 0 | 0 (Plan 01 acceptance + Plan 03 verification 단계에서 모두 0건 확인 — 추가 변경 없음) | ✓ |

**Conclusion:** 진단 코드 완전 제거 확인.

## Verification commands (재현 가능)

```bash
grep -rn "AUTH_LOGIN_DEBUG" apps/ .github/ .env.example 2>/dev/null | wc -l   # 0
grep -rn "DEBUG_AUTH_REQ" apps/ .github/ .env.example 2>/dev/null | wc -l     # 0
grep -rn "createAuthReqDebugMiddleware" apps/ 2>/dev/null | wc -l             # 0
grep -rn "req-debug" apps/ 2>/dev/null | wc -l                                # 0
find apps/api/src/modules/auth/debug -type f 2>/dev/null | wc -l              # 0
find apps/web/e2e/diagnostic -type f 2>/dev/null | wc -l                      # 0
```

## Permanent retentions (영구 유지)

다음은 cleanup 대상이 아니며 영구 유지된다 (root cause fix 의 일부):
- `apps/web/e2e/helpers/auth.ts` 의 `||` env fallback (Phase 09.1 fix JSDoc 블록 포함)
- GitHub repo secrets `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
- `apps/web/e2e/toss-payment.spec.ts` 의 fixme 복구 + closure 주석
- `apps/web/app/booking/[performanceId]/confirm/page.tsx` 의 error toast useRef latch
