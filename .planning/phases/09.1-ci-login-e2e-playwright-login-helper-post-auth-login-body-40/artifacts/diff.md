# Phase 09.1 — AUTH_LOGIN_DEBUG curl vs Playwright diff

**CI run:** https://github.com/sangwopark19/grapit/actions/runs/24439879052
**Date:** 2026-04-15T06:33:16Z (curl) / 2026-04-15T06:33:29Z (Playwright probe)
**Node version:** v22.22.2
**OS:** Linux runnervm35a4x 6.17.0-1010-azure x86_64
**pnpm:** 10.28.1

## Side-by-side comparison

| Field | curl | Playwright |
|-------|------|------------|
| status (응답) | **200** | **401** |
| headers.host | localhost:8080 | localhost:8080 |
| headers.user-agent | curl/8.5.0 | Mozilla/.../Chrome/147.0.7727.15 |
| headers.accept | */* | application/json |
| headers.accept-encoding | absent | gzip,deflate,br |
| headers.content-type | application/json | application/json |
| **headers.content-length** | **57** | **26** ← 결정적 차이 |
| headers.transfer-encoding | absent | absent |
| headers.connection | absent | keep-alive |
| bodyType (middleware 관측) | undefined ※ | undefined ※ |
| bodyKeys | null ※ | null ※ |
| bodyEmail | null ※ | null ※ |
| bodyPasswordLen | null ※ | null ※ |
| rawBodyLen | null ※ | null ※ |
| rawBodyUtf8 | null ※ | null ※ |

※ 진단 미들웨어가 `app.use()` 로 등록되어 NestJS 내부 body-parser **앞** 에서 실행됨 — 양쪽 모두 req.body/req.rawBody 를 읽지 못함. 그러나 `headers.content-length` 만으로 충분한 진단이 가능했다.

## Response bodies

- **curl**: HTTP 200 + `{"accessToken":"***","user":{...,"email":"admin@grapit.test","name":"관리자","role":"admin",...}}` + `Set-Cookie: refreshToken=***`
- **Playwright**: HTTP 401 + `{"statusCode":401,"message":"Unauthorized","timestamp":"2026-04-15T06:33:29.489Z"}`

## 원인 범주 판정 (RESEARCH.md §Decision Tree 의 한계)

관찰 결과:
- [x] bodyType + bodyKeys 가 curl 과 동일한가? → **둘 다 undefined** (middleware 위치 한계로 관측 불가)
- [x] content-type 헤더가 application/json 인가? → **양쪽 모두 application/json** ✓
- [x] content-length 와 rawBodyLen 차이가 있는가? → **content-length 결정적 차이 (57 vs 26)**
- [x] transfer-encoding: chunked 가 Playwright 쪽에만 있는가? → **양쪽 모두 absent**

**확정 범주: A** (Playwright body 측 issue) — 단, 세부 원인이 plan 의 A 정의(인코딩/body-parser 미파싱)와 다름.

**근거:**

content-length=26 은 정확히 `{"email":"","password":""}` (26 bytes) 와 일치한다. Playwright 는 content-type, application/json, JSON 형식 모두 정상이며 단순히 **빈 문자열을 email/password 값으로 직렬화해 전송**하고 있다. 서버는 정상적으로 body 를 파싱하지만 passport-local 이 빈 credentials 를 reject 해 401 을 반환한다.

**진짜 root cause (Decision Tree 에 없던 4번째 가능성):**

1. `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` GitHub secret 이 repo 에 **미설정** (`gh secret list` 로 확인 — TOSS_*, GCP_*, R2_*, DATABASE_URL 만 존재).
2. ci.yml 의 `TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}` 가 **빈 문자열** 을 env 로 주입 (GitHub Actions 동작).
3. helper (`apps/web/e2e/helpers/auth.ts:32-33`) 와 probe (`apps/web/e2e/diagnostic/auth-login-probe.spec.ts:5-6`) 모두 `process.env['TEST_USER_EMAIL'] ?? 'admin@grapit.test'` 사용.
4. JS `??` 는 null/undefined 만 catch — **빈 문자열은 통과** → email = "" .
5. Playwright 가 `{"email":"","password":""}` 를 전송 → passport-local 401.

curl smoke test 가 HTTP 200 을 받는 이유: ci.yml 의 curl 명령은 **하드코딩된** 리터럴 `'{"email":"admin@grapit.test","password":"TestAdmin2026!"}'` 사용 (content-length=57 일치).

CONTEXT.md 의 가정 ("auth helper falls back to seed.mjs defaults when unset, which matches local developer flow") 이 틀렸다 — fallback 은 env var 가 아예 정의되지 않은 로컬 환경에서만 작동하고, GitHub Actions 의 빈 문자열 주입에서는 작동하지 않는다.

**다음 단계 (Plan 03 Wave 2 fix 분기 — Decision Tree 외 옵션 D 권장):**

| 분기 | 동작 | 권장도 |
|------|------|--------|
| A (node native fetch swap) | 효과 없음 — body 가 빈 문자열인 게 문제, fetch 종류 무관 | ✗ |
| B (Content-Type 교정) | 효과 없음 — content-type 정상 | ✗ |
| C (서버측 body-parser 변경) | 효과 없음 — 서버는 정상 동작 | ✗ |
| **D-1 (helper `??` → `||`)** | helper 에서 빈 문자열도 fallback 처리 — 단일 라인 수정, 즉시 효과 | ✓ 권장 |
| **D-2 (GitHub secret 설정)** | TEST_USER_EMAIL/PASSWORD secret 을 admin@grapit.test/TestAdmin2026! 로 설정 | ✓ 보완 |
| **D-3 (D-1 + D-2 둘 다)** | helper 견고성 + CI 명시성 둘 다 확보 | ✓✓ 최선 |

권장: **D-3 (defense in depth)** — helper 코드를 견고하게 만들고, CI secret 도 설정해 의도 명시.
