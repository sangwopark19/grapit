---
phase: 09-tech-debt
plan: 04
subsystem: auth
tags: [reset-password, jwt, react, nextjs, useSearchParams, regression-fix]

requires:
  - phase: 09-tech-debt
    provides: 09-02 가 backend `POST /auth/password-reset/confirm` 엔드포인트와 이메일 발송 인프라를 이미 제공함 — 09-04 는 그 위에 frontend confirm UI 만 얹는 구조.

provides:
  - "Frontend confirm UI: `?token=` query 분기 + 새 비밀번호 입력 폼 + raw fetch 로 `/api/v1/auth/password-reset/confirm` 호출 + 401/429/400/네트워크 에러 분기"
  - "Backend regression fix (CR-02): preliminary verify 단계를 `verifyAsync` 에서 `decode` 로 교체. 합법 토큰이 false-reject 되던 문제 해소"
  - "Real JwtService integration 테스트 (3 cases) — mock 기반 spec 이 놓친 서명-검증 regression 을 봉쇄하는 회귀 가드"

affects:
  - phase 10+ 에서 인증/토큰 회전 로직을 다룰 때 "preliminary decode → final verify(secret + entropy)" 패턴 참조
  - 향후 다른 토큰 회전 (refresh / registration) 검증 시 동일 mock 함정 주의

tech-stack:
  added: []
  patterns:
    - "Token rotation 검증: preliminary decode (서명 검증 X, 형식만) → DB lookup → final verifyAsync(jwtSecret + passwordHash) (서명 + 만료 검증)"
    - "API client bypass: 401 자동 redirect 가 에러 UI 를 가리는 케이스에서는 raw `fetch` + `credentials: 'include'` 로 우회"
    - "Real-service integration test: mock spec 이 라이브러리 동작을 흉내내지 못하는 영역(서명 검증 등)에서 실제 JwtService 인스턴스를 주입한 integration 테스트로 회귀 가드 추가"

key-files:
  created:
    - "apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx — vitest 4 cases (request 회귀 + confirm 렌더 + 성공 경로 + 401 에러 UI)"
  modified:
    - "apps/web/app/auth/reset-password/page.tsx — `Suspense > ResetPasswordInner > (RequestView | ConfirmView)` 구조로 리팩터, token query 분기 추가"
    - "apps/api/src/modules/auth/auth.service.ts — preliminary verify 를 `jwtService.decode` 로 교체 (CR-02 fix), 주석 갱신"
    - "apps/api/src/modules/auth/auth.service.spec.ts — `decode` mock 추가, 기존 unit test mock 단순화, 새 integration `describe` 블록 (real JwtService) 추가"
    - ".planning/phases/09-tech-debt/09-04-PLAN.md — Task 5/6/7 (backend fix) 확장"

key-decisions:
  - "Option A 채택 — frontend page.tsx 에 token 분기. backend path/이메일 템플릿/auth.service URL 변경 없이 한 페이지 안에서 처리. (Option B: 별도 confirm 라우트 분리는 유지보수성 좋지만 변경 면적이 큼.)"
  - "Confirm 제출은 `apiClient.post` 가 아닌 raw `fetch` 사용. 이유: apiClient 는 401 응답 시 `/auth` 로 자동 redirect 하여 '유효하지 않은 링크' 에러 UI 가 노출되지 못함. reset-password 의 401 은 '토큰 무효' 의미이므로 자동 리다이렉트가 잘못된 의미 결합."
  - "CR-02 fix: preliminary 단계의 의도(DB lookup 전 sub 형식 검증으로 DoS/PG 22P02 가드)는 유지하면서 서명 검증을 제거. 서명/만료 검증은 final verifyAsync(jwtSecret + passwordHash) 한 곳에서 수행. 보안 약화 없음 — 위조 토큰은 final 단계에서 거부됨."
  - "Real JwtService integration 테스트를 spec 에 추가. mock 기반 spec 이 `mockJwtService.verifyAsync.mockImplementation(opts.secret 분기)` 로 서명-검증을 우회한 게 CR-01 regression 을 놓친 근본 원인. 같은 함정을 다시 못 만들도록 회귀 가드 3 케이스 (정상 토큰 success / sub 형식 위반 → 401 / 잘못된 secret 으로 서명 → final 401) 추가."

patterns-established:
  - "Form-route dual-mode: 동일 path (`/auth/reset-password`) 에서 query param 존재 여부로 request/confirm 모드 분기. `Suspense` 경계로 `useSearchParams` 의 SSR/prerender 제약 (Next.js 16) 해소."
  - "Token rotation 검증 2-단계 패턴: preliminary decode(형식만) → DB lookup → final verify(secret + entropy)."
  - "Mock spec 의 한계 보완: 라이브러리의 핵심 보안 동작(서명 검증)이 mock 으로 흉내 가능한 영역이면, 별도 real-service integration 테스트를 같은 spec 파일에 두어 회귀 가드를 만든다."

requirements-completed: ["DEBT-01"]

duration: 90min
completed: 2026-04-15T02:31:00Z
---

# Phase 09 / Plan 04: Reset Password Confirm UI + CR-02 Regression Fix

**비밀번호 재설정 이메일 링크 클릭 → 새 비밀번호 입력 → 변경 완료까지의 end-to-end 플로우를 frontend confirm UI 추가와 backend preliminary verify regression 해소로 닫음.**

## Performance

- **Duration:** 약 90분 (2 executor 세션 + 1 human-verify 사이클)
- **Started:** 2026-04-15T01:00:00Z (frontend 진단/구현)
- **Completed:** 2026-04-15T02:31:00Z (human-verify approved)
- **Tasks:** 7 / 7 (Task 1-3 frontend, Task 5-7 backend, Task 4 human-verify)
- **Files modified:** 4 (page.tsx, reset-password.test.tsx, auth.service.ts, auth.service.spec.ts) + 1 plan doc

## Accomplishments

- **DEBT-01 마무리** — Phase 9 UAT Test 11 의 마지막 미완 조각(이메일 링크 → 비밀번호 변경 완료) 을 닫음. 사용자 sangwopark19@gmail.com 계정으로 실 이메일 수신 → confirm 폼 → 비밀번호 변경 → 새 비밀번호로 로그인까지 end-to-end 검증.
- **CR-02 regression 해소** — `bc3b434 fix(09): CR-01 verify JWT signature before resetPassword DB lookup` 에서 도입된 silent regression (preliminary `verifyAsync` 가 합법 토큰의 서명 key 불일치로 401 을 던지던 문제) 을 발견 + TDD 로 수정. mock 기반 unit test 가 `mockJwtService.verifyAsync.mockImplementation(opts.secret 분기)` 로 서명 검증을 우회해 regression 을 놓쳤음.
- **회귀 가드 강화** — `auth.service.spec.ts` 에 real `@nestjs/jwt` JwtService 를 주입한 integration 테스트 3 케이스를 추가해 동일 mock 함정에 다시 빠지지 않게 함.

## Task Commits

1. **Task 1 (TDD RED): vitest 실패 테스트 추가** — `6e7258a` (test)
2. **Task 2 (TDD GREEN): page.tsx token 분기 + confirm 폼** — `2f47212` (feat)
3. **Task 3: web 품질 게이트 (typecheck/lint/test/build)** — 커밋 없음 (전부 exit 0)
4. **Plan expansion: backend CR-02 task 추가** — `29bef72` (docs)
5. **Task 5 (TDD RED): backend integration test (CR-02 reproducer)** — `05a0831` (test)
6. **Task 6 (TDD GREEN): preliminary verifyAsync → decode** — `4f3542e` (fix)
7. **Task 7: api 품질 게이트** — 커밋 없음 (전부 exit 0)
8. **Task 4 (human-verify checkpoint): dev 이메일 링크 → confirm 폼 → 비밀번호 변경 + 회귀 시나리오 6 확인** — approved by user 2026-04-15

## Files Created/Modified

### Frontend (Tasks 1-3)
- **`apps/web/app/auth/reset-password/page.tsx`** — `Suspense > ResetPasswordInner > (RequestView | ConfirmView)` 구조. `useSearchParams().get('token') ?? ''` 로 분기. `ConfirmView` 는 react-hook-form + `zodResolver(resetPasswordSchema)` (from `@grapit/shared`), raw `fetch('/api/v1/auth/password-reset/confirm', { credentials: 'include', body: { token, newPassword, newPasswordConfirm } })`, 200/401/429/400/네트워크 분기 처리, 401 에서 `tokenError=true` → "유효하지 않은 링크" 화면 + "다시 요청하기" Link.
- **`apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx`** — 신규. vitest + @testing-library/react. `next/navigation` / `next/link` / `sonner` mock. 4 cases: request 모드 회귀 / confirm 모드 렌더 / fetch 호출 검증 / 401 → 다시 요청하기 link.

### Backend (Tasks 5-6)
- **`apps/api/src/modules/auth/auth.service.ts`** — `resetPassword` 의 preliminary 단계를 `await this.jwtService.verifyAsync(token, { secret: jwtSecret, ignoreExpiration: true })` 에서 `this.jwtService.decode<{ sub?: unknown } | null>(token)` 로 교체. UUID_REGEX + null/object 가드는 유지. 주석을 "decode 로 sub 추출, 서명/만료는 final 단계에서" 로 갱신.
- **`apps/api/src/modules/auth/auth.service.spec.ts`** — `mockJwtService` 에 `decode` 필드 추가. 기존 `describe('resetPassword')` 의 unit test 는 `mockJwtService.decode.mockReturnValue({ sub, purpose: 'password-reset' })` 추가. integration `describe('requestPasswordReset → resetPassword 성공')` 의 `verifyAsync.mockImplementation` 에서 preliminary 분기 제거. 새 `describe('resetPassword (integration — real JwtService — CR-02 regression guard)')` 블록 — real JwtService 를 주입한 3 케이스 (정상 token 성공 / sub 형식 위반 → 401 / passwordHash 빠진 secret 으로 서명 → final 단계 401).

### Plan
- **`.planning/phases/09-tech-debt/09-04-PLAN.md`** — 신규(이전 untracked 였음). Task 5/6/7 (backend CR-02 fix) 확장 + Task 4 resume-signal 에 선행 조건 명시.

## Verification Evidence

### Frontend (Task 3)
- `pnpm --filter @grapit/web typecheck` → exit 0
- `pnpm --filter @grapit/web lint` → 0 errors, 18 warnings (모두 타 파일)
- `pnpm --filter @grapit/web test` → 16 files / 95 tests passed (reset-password 4/4 포함)
- `pnpm --filter @grapit/web build` → 성공, `/auth/reset-password` static prerender

### Backend (Tasks 5-7)
- TDD RED 확인: Task 5 commit 직전 24 tests 중 1 fail — `resetPassword (integration — real JwtService — CR-02 regression guard) > 정상 token ...` 이 `auth.service.ts:275` (이전 preliminary verify catch) 에서 `UnauthorizedException` throw. 정확히 regression 지점.
- TDD GREEN 확인: Task 6 commit 직후 24/24 auth.service tests pass.
- `pnpm --filter @grapit/api typecheck` → exit 0
- `pnpm --filter @grapit/api lint` → 0 errors, 28 warnings (전부 pre-existing)
- `pnpm --filter @grapit/api test` → 22 files / 172 tests pass
- `pnpm --filter @grapit/api build` → TSC 0 issues, SWC 115 files compiled

### Human UAT (Task 4)
- 2026-04-15 sangwopark19@gmail.com 계정으로 실 이메일 수신
- 시나리오 1-5 (정상 경로 + 회귀): 모두 success — confirm 폼 렌더, 비밀번호 변경, 새 비밀번호 로그인, 토큰 없는 접속 시 request 폼 정상
- 시나리오 6 (위조 토큰): `?token=invalid.fake.token` 접속 → confirm 폼 렌더 → 임의 비밀번호 제출 → backend 401 → "유효하지 않은 링크" 에러 UI + "다시 요청하기" 버튼 정상

### Grep-verifiable acceptance
```
OK: useSearchParams (page.tsx)
OK: /api/v1/auth/password-reset/confirm (page.tsx)
OK: newPassword (page.tsx)
OK: resetPasswordSchema (page.tsx — from @grapit/shared)
OK: jwtService.decode (auth.service.ts:269)
```

## Surprises / Notes

- **CR-01 regression 의 silent 통과**: 단위 테스트의 mock 이 라이브러리 동작을 분기로 흉내내면 보안 검증 자체가 무력화될 수 있다는 사실을 다시 확인. 향후 토큰 회전/서명 검증 관련 코드는 real-service integration 테스트를 동반하는 게 안전.
- **Next.js 16 useSearchParams + prerender**: client component 에서 `useSearchParams` 사용 시 `Suspense` 경계가 필수. Task 2 의 build 단계에서 한 번 에러 → `<Suspense fallback={null}>` 로 감싸 해결.
- **Plan expansion 사이클**: 1차 human UAT 가 발견한 CR-02 를 같은 plan 의 Task 5-7 로 확장한 사례. 별도 plan/phase 분리 대신 인접 발견을 한 SUMMARY 안에 묶어 컨텍스트 손실 최소화.
