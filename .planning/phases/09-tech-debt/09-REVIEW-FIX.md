---
phase: 09-tech-debt
fixed_at: 2026-04-14T17:05:00Z
review_path: .planning/phases/09-tech-debt/09-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-04-14T17:05:00Z
**Source review:** `.planning/phases/09-tech-debt/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 8
- Fixed: 8
- Skipped: 0

모든 Critical + Warning severity finding 에 대해 fix 를 적용하고 vitest/tsc/eslint 를
순차 검증했다. Info(9건)는 scope 외.

## Fixed Issues

### CR-01: `resetPassword` unverified JWT sub lookup allows DB query injection via forged token

**Files modified:** `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.service.spec.ts`
**Commit:** bc3b434
**Applied fix:**
- `auth.service.ts` 상단에 `UUID_REGEX` 상수를 추가했고, 이를 사용해 `resetPassword` 의 경로를 3단계로 재설계했다.
  1) `jwtService.verifyAsync(token, { secret: jwtSecret, ignoreExpiration: true })` 로 *preliminary* 서명 검증 — 위조 토큰을 DB lookup 전에 즉시 401로 차단.
  2) decoded.sub 가 `UUID_REGEX` 를 통과해야 `userRepository.findById` 호출 — PostgreSQL 22P02 예외/payload-amplification DoS 차단.
  3) `jwtService.verifyAsync(token, { secret: jwtSecret + passwordHash })` 최종 검증 — one-time 토큰 회전(B4) 보장을 그대로 유지.
- `auth.service.spec.ts` 의 integration 테스트들(non-UUID sub: `'test-user-id'`, `'rotate-user-id'`)을 `randomUUID()` 기반 sub 로 교체, 그리고 `mockJwtService.verifyAsync` 가 preliminary/final 두 호출을 모두 올바르게 반환하도록 분기 mock 으로 업데이트.
- 최종적으로 21 tests (auth.service.spec.ts) / 169 tests (apps/api 전체) 모두 green.

### WR-01: `bootstrap()` unhandled promise rejection silently crashes process

**Files modified:** `apps/api/src/main.ts`
**Commit:** 405b2e4 (WR-06 과 함께)
**Applied fix:**
- `bootstrap().catch((err) => { console.error(...); process.exit(1); })` 부착.
- raw `console.error` 사용 — NestJS Logger 초기화 실패 가능성을 고려.

### WR-02: `requestPasswordReset` dispatches reset email for social-only accounts

**Files modified:** `apps/api/src/modules/auth/auth.service.ts`
**Commit:** bc3b434 (CR-01 과 같은 함수 영역이라 한 commit 에 통합)
**Applied fix:**
- `if (!user) return;` 를 `if (!user || !user.passwordHash) return;` 로 확장.
- 주석으로 의도를 명시: 소셜 전용 → 비밀번호 계정 전환 방지 + rotation entropy 유지 + enumeration 방지.
- 결과적으로 secret 조합에서 `?? ''` fallback 이 더 이상 필요 없어져 `user.passwordHash` 로 단순화.

### WR-03: `AuthModule` does not register `authConfig` → relies on global `AppModule` ordering

**Files modified:** `apps/api/src/modules/auth/auth.module.ts`
**Commit:** 00c47c4
**Applied fix:**
- `ConfigModule.forFeature(authConfig)` 을 AuthModule `imports` 배열 및 JwtModule.registerAsync 의 imports 에 명시적으로 등록.
- `authConfig` import 경로 추가: `../../config/auth.config.js`.
- AppModule 의 전역 `isGlobal: true` 유지되지만 모듈 자체의 자급자족성(단독 테스트/재사용) 확보.

### WR-04: `next.config.ts` `allowedDevOrigins` hardcodes developer-specific hostnames

**Files modified:** `apps/web/next.config.ts`
**Commit:** deb1abb
**Applied fix:**
- 하드코딩된 `['192.168.0.78', 'craig-paravail-yee.ngrok-free.dev']` 을 제거.
- `NEXT_DEV_ALLOWED_ORIGINS` 환경변수(콤마 구분)에서 origin 목록을 파싱하도록 변경.
- 빈 문자열 필터링 및 trim 처리.
- 각 개발자는 자신의 `.env.local` 에서 `NEXT_DEV_ALLOWED_ORIGINS=host1,host2` 로 개별 설정.

### WR-05: `deploy.yml` hardcodes Cloud Run URLs and uses brittle `sleep 3` for Cloud SQL Proxy

**Files modified:** `.github/workflows/deploy.yml`
**Commit:** d0291bc
**Applied fix:**
- Cloud Run URL 하드코딩 값(`grapit-api-d3c6wrfdbq-du.a.run.app`, `grapit-web-d3c6wrfdbq-du.a.run.app`)을 모두 GitHub Environment variables(`vars.CLOUD_RUN_API_URL`, `vars.CLOUD_RUN_WEB_URL`)로 치환.
  - `FRONTEND_URL`, `KAKAO_CALLBACK_URL`, `NAVER_CALLBACK_URL`, `GOOGLE_CALLBACK_URL` (deploy-api).
  - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (deploy-web build-args).
- Cloud SQL Auth Proxy 기동을 `sleep 3` 에서 `for i in $(seq 1 30); do nc -z localhost 5432; ...; sleep 1; done` readiness loop 로 교체. 최대 30초까지 포트가 accept 상태가 될 때까지 대기.

### WR-06: `main.ts` CORS `origin` becomes array-or-string; cookie handling unclear for multiple origins

**Files modified:** `apps/api/src/main.ts`
**Commit:** 405b2e4 (WR-01 과 함께)
**Applied fix:**
- `FRONTEND_URL` 파싱을 `bootstrap()` 상단의 공통 helper 블록으로 일원화.
- `trim()` + `split(',')` + `filter(Boolean)` 으로 빈 문자열 방지.
- production 모드에서 `frontendOrigins` 가 비어있으면 exit(1), 다중 origin 중 하나라도 `https://` 접두사가 없으면 exit(1) — 이전에는 첫 번째 값만 검사되어 `FRONTEND_URL=http://evil,https://legit.com` 같은 bypass 여지가 있었다.
- `corsOrigins` 를 항상 배열로 통일(dev default `['http://localhost:3000']` 포함) — express-cors 동작 일관성 확보.

### WR-07: `signup-step2.tsx` `dialogKey` typed as `string` loses key type safety

**Files modified:** `apps/web/components/auth/signup-step2.tsx`
**Commit:** 2d5f2a4
**Applied fix:**
- `LEGAL_CONTENT` 를 `as const satisfies Record<string, { title; content }>` 로 고정.
- `type LegalKey = keyof typeof LEGAL_CONTENT` 추출.
- `useState<string>` → `useState<LegalKey>`, `handleViewTerms(key: string)` → `handleViewTerms(key: LegalKey)`.
- JSX 의 `LEGAL_CONTENT[dialogKey]?.title`, `LEGAL_CONTENT[dialogKey]?.content ?? ''` 의 optional chaining 을 제거(컴파일 타임에 정의된 키만 허용되므로 런타임 undefined 불가능).
- CLAUDE.md 의 "Strict typing everywhere — no any, no untyped variables" 규약 준수.

## Skipped Issues

없음. 모든 in-scope finding 이 적용되었다.

## Verification Summary

각 fix commit 후 다음 검증을 수행했다:

- **Tier 1 (re-read):** 모든 변경된 파일을 다시 읽어 fix 반영 확인.
- **Tier 2 (tsc --noEmit):** `apps/api` 및 `apps/web` 패키지에서 각각 `pnpm exec tsc --noEmit` 실행 (exit 0).
- **Regression:**
  - `apps/api` vitest — 22 files / 169 tests passed.
  - `apps/web` vitest — 15 files / 91 tests passed.
  - `apps/api` ESLint — 0 errors, 24 warnings (모두 기존 warning, 수정 파일에서 새 warning 없음).
  - `apps/web` ESLint — 0 errors, 18 warnings (모두 기존 warning, 수정 파일에서 새 warning 없음).

## Remaining Info Findings (out of scope)

REVIEW.md 의 Info(9건, IN-01 ~ IN-09)는 본 fix scope(critical_warning) 밖이라 적용하지 않았다.
다음 iteration 또는 별도 tech-debt wave 에서 처리 권장 대상:

- IN-01: 테스트 spec 의 `as any` 패턴(다수 파일)
- IN-02: JWT payload zod 스키마 강화
- IN-03: argon2 파라미터 / 7-day ms / MAX_SEATS 상수화
- IN-04: `formatDateTime` 테스트 타임존 고정
- IN-05: `apps/api` react peerDependency 정리
- IN-06: `resetPassword` 주석 번호 인덱스 재정렬
- IN-07: warning-foreground 색상 토큰 정의
- IN-08: E2E fixture `beforeEach` 공통화
- IN-09: dev-only booking fixture 번들 제거 검증 (빌드 산출물 grep)

---

_Fixed: 2026-04-14T17:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
