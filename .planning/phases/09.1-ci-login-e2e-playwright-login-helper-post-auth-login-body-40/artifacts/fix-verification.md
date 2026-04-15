# Phase 09.1 — Fix verification (post cause-A / D-3 apply)

**CI run:** https://github.com/sangwopark19/grapit/actions/runs/24440280011
**Fix branch:** 9cee814 (fix(09.1): use || instead of ?? for env fallback)
**Repo secrets set:** TEST_USER_EMAIL, TEST_USER_PASSWORD (2026-04-15T06:40:00Z)

## Before (Plan 02 diff.md 요약)
- Playwright probe content-length: 26 (= `{"email":"","password":""}`)
- Playwright probe status: **401 Unauthorized**
- Server response: `{"statusCode":401,"message":"Unauthorized",...}`
- toss-payment.spec.ts: 9 passed + 3 fixme (skipped due to login 401)

## After
- Playwright probe content-length: 53 (= `{"email":"admin@grapit.test","password":"TestAdmin2026!"}` — server side rendered, env now propagates)
- Playwright probe status: **200** ✓
- Server response: `{"accessToken":"***","user":{"email":"***","name":"관리자","role":"admin",...}}` ✓
- Set-Cookie refreshToken present: ✓ (`refreshToken=...; HttpOnly; Secure; SameSite=None`)
- curl baseline: HTTP 200 (S5 regression 0) ✓
- Unit tests: 172 passed (api) + 95 passed (web) — 회귀 0
- E2E tests (Toss Payments): 10 passed (9 normal + 1 probe; 3 fixme 그대로 — Plan 04 복구 대상)

## 3 독립 신호 결과
- S1 (서버측 req 정상): ✓ (probe response 가 valid user object 반환 = passport-local validate 성공)
- S3 (response body 정상): ✓ (`accessToken` + `user` object 정상 직렬화)
- S5 (curl regression 0): ✓ (smoke test 여전히 HTTP 200)

## Remaining signal (Plan 04 에서 확정)
- S4 (toss-payment.spec.ts 3개 fixme → test 복구 후 12/12 green): pending

## Why bodyType/bodyKeys/rawBody 가 여전히 null 인가
진단 미들웨어가 NestJS 내부 body-parser 앞에서 실행되는 위치 한계 (Plan 02 SUMMARY §"Why diff.md ..." 참조). Plan 05 Wave 4 에서 미들웨어 자체가 제거되므로 위치 수정 불필요.

## Symptom-masking 의심 검토
RESEARCH.md §Proof-of-fix: "S4 만 green 이고 S1/S2 가 설명 없이 green 이면 symptom masking 의심".
- S1, S3, S5 모두 explicit 한 근거로 green:
  - S1 → probe response body 가 valid user object (passport-local 성공 증명)
  - S3 → accessToken + user 정상 (controller serialization 정상)
  - S5 → 서버 코드 변경 0 (helper + secret 만 수정)
- 따라서 symptom masking 가능성 ✗.
