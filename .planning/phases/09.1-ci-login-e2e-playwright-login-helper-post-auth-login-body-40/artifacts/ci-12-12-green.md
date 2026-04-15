# Phase 09.1 — CI 12/12 green evidence (S4 신호)

**CI run URL:** https://github.com/sangwopark19/grapit/actions/runs/24440704025
**Commit SHA:** 919c558 (fix(09.1): guard error toast in confirm page against StrictMode double-fire)
**Date:** 2026-04-15T06:55:20Z
**Cause branch applied:** A (per 09.1-03-SUMMARY.md — fix option D-3: helper `??` → `||` + GitHub TEST_USER_* secret 설정)
**Required follow-on fix:** confirm/page.tsx error toast useRef latch (against React StrictMode double-effect)

## Before (Phase 09 VERIFICATION)
- toss-payment.spec.ts: 9 passed, 3 test.fixme (login-dependent)

## After
- toss-payment.spec.ts: **12 passed, 0 test.fixme, 0 failed**
  - happy path: widget mounts AND confirm API intercepts on complete page ✓
  - UI regression: cancel error URL → toast renders ✓
  - UI regression: decline error URL → error message renders ✓
  - (기존 9 Toss 자체 테스트) ✓
- 추가: diagnostic probe spec 1 passed (Plan 05 에서 제거 예정)
- E2E 총 실행: **13 passed, 0 failed** (31.9s)
- Unit tests: 172 (api) + 95 (web) passed — 회귀 0
- Smoke curl baseline: HTTP 200 (S5 regression 0)
- CI conclusion: **success**

## Independent signals final

| Signal | Status | Evidence |
|--------|--------|----------|
| S1 (server req 정상화) | ✓ | probe response 의 valid user object (passport-local validate 성공) — fix-verification.md |
| S2 (wire header 정합) | ✓ | content-length 26 → 정상 53 byte, content-type/accept 양쪽 application/json — fix-verification.md |
| S3 (response body 정상) | ✓ | probe spec status=200 + accessToken + Set-Cookie:refreshToken — fix-verification.md |
| S4 (E2E 복구) | ✓ | **이 문서 — 13/13 passed (12 toss + 1 probe), 0 failed** |
| S5 (curl regression 0) | ✓ | CI "Smoke test login" step HTTP 200 유지 (4번의 CI run 모두) |

## Symptom-masking 검토 (RESEARCH.md §Proof-of-fix)

5 신호 모두 explicit 한 인과 chain 으로 설명됨, 어느 신호도 unexplained green 아님:
- S1/S2/S3: helper 의 `||` 변경 + GitHub secret 설정 → `{"email":"admin@grapit.test","password":"TestAdmin2026!"}` 정상 전송 → server 정상 인증
- S4: helper 가 정상 200 → toss-payment.spec.ts 의 happy path 가 login 통과 → 후속 navigation 정상
- S5: 서버 코드 0 변경 → 항상 green
- 부수 fix: React StrictMode double-effect 로 인한 duplicate toast 가 cancel/decline test 의 strict-mode locator 를 violate — useRef latch 로 해결 (login 과 무관, UX 개선 부작용)

→ symptom masking 가능성 ✗.

## Cleanup pending (Plan 05)

다음 진단/임시 코드 모두 제거:
- `apps/api/src/modules/auth/debug/req-debug.middleware.ts` (파일 삭제)
- `apps/api/src/main.ts` 의 rawBody:true 옵션, middleware import + 호출
- `.github/workflows/ci.yml` 의 3개 진단 step (Record runtime versions / DEBUG_AUTH_REQ env / Dump AUTH_LOGIN_DEBUG / E2E diagnostic probe)
- `apps/web/e2e/diagnostic/auth-login-probe.spec.ts` (파일 삭제)
- helper 의 Phase 09.1 JSDoc 블록 일부 (`||` 자체와 GitHub secrets 는 영구 유지)
- `.planning/phases/09-tech-debt/09-VERIFICATION.md` 의 deferred operational checklist 항목 close
