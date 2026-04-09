---
phase: 06-social-login-bugfix
plan: 01
subsystem: auth
tags: [bugfix, oauth, error-handling, logging, frontend-ui]
dependency_graph:
  requires: []
  provides: [social-login-bugfix, oauth-error-redirect, structured-logging]
  affects: [auth-controller, auth-service, callback-page, login-form]
tech_stack:
  added: []
  patterns: [nestjs-logger, guard-handleRequest-override, suspense-boundary]
key_files:
  created:
    - apps/api/src/modules/auth/guards/social-auth.guard.spec.ts
  modified:
    - apps/api/src/modules/auth/strategies/kakao.strategy.ts
    - apps/api/src/modules/auth/strategies/naver.strategy.ts
    - apps/api/src/modules/auth/strategies/google.strategy.ts
    - apps/api/src/modules/auth/guards/social-auth.guard.ts
    - apps/api/src/modules/auth/auth.controller.ts
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/strategies/kakao.strategy.spec.ts
    - apps/api/src/modules/auth/strategies/naver.strategy.spec.ts
    - apps/api/src/modules/auth/strategies/google.strategy.spec.ts
    - apps/web/app/auth/callback/page.tsx
    - apps/web/components/auth/login-form.tsx
decisions:
  - Guard에서 factory 패턴 대신 공통 helper 함수 + 개별 클래스 패턴 사용 (NestJS DI 안정성)
  - SocialErrorMessage를 별도 컴포넌트로 분리하고 Suspense 래핑 (useSearchParams 호환)
metrics:
  duration: 5m
  completed: "2026-04-09T07:02:40Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 12
  tests_total: 36
  files_changed: 12
---

# Phase 06 Plan 01: 소셜 로그인 버그 수정 + 에러 핸들링 + 프론트엔드 에러 UI Summary

Strategy callbackURL에 누락된 /social/ 세그먼트를 수정하고, AuthGuard handleRequest 오버라이드로 OAuth 에러를 프론트엔드로 redirect하며, callback 페이지에 에러 코드별 한국어 메시지 + 재시도 UI를 구현

## Changes Made

### Task 1: 백엔드 소셜 로그인 버그 수정 + 에러 핸들링 + 로깅 (b87001d)

**A. Strategy callbackURL 수정 (근본 원인 버그)**
- kakao.strategy.ts: `/auth/kakao/callback` -> `/auth/social/kakao/callback`
- naver.strategy.ts: `/auth/naver/callback` -> `/auth/social/naver/callback`
- google.strategy.ts: `/auth/google/callback` -> `/auth/social/google/callback`

**B. AuthGuard handleRequest 오버라이드**
- 공통 `handleSocialAuthRequest` 헬퍼 함수로 중복 제거
- OAuth 에러 시 JSON 대신 `?error=oauth_failed|oauth_denied&provider=` 파라미터로 프론트엔드 redirect
- NestJS Logger로 경고 로깅

**C. handleSocialCallback 에러 핸들링**
- `!req.user` null 체크 추가 (Guard redirect 후 케이스)
- `findOrCreateSocialUser` 호출을 try-catch로 감싸고 에러 시 `?error=server_error` redirect
- 각 단계에 구조화된 로깅 추가

**D. SameSite 쿠키 수정**
- `sameSite: isProduction ? 'strict' : 'lax'` -> `sameSite: 'lax'` (OAuth redirect chain 호환)

**E. auth.service.ts 로깅**
- findOrCreateSocialUser: 시작, 기존 사용자 발견, 새 사용자 등록 필요
- completeSocialRegistration: 시작, 완료

**F/G. 테스트**
- 3개 strategy spec에 callbackURL 기본값 검증 테스트 추가
- social-auth.guard.spec.ts 신규 생성 (9개 테스트)
- 전체 auth 모듈 36개 테스트 통과

### Task 2: 프론트엔드 에러 상태 UI + 로그인 페이지 에러 표시 (87925b1)

**A. callback/page.tsx 에러 상태**
- SOCIAL_ERROR_MESSAGES 상수 (oauth_denied, oauth_failed, token_expired, server_error, account_conflict)
- errorInfo 상태 + searchParams.get('error') 체크 (기존 status 체크 전)
- AlertCircle 아이콘 + 에러 메시지 + "다시 로그인하기" 버튼 UI

**B. login-form.tsx 소셜 에러 표시**
- SOCIAL_LOGIN_ERRORS 상수 + SocialErrorMessage 별도 컴포넌트
- Suspense 래핑으로 useSearchParams 호환성 확보
- Separator("또는") 아래, SocialLoginButton 위에 인라인 에러 표시

## Test Results

- 백엔드: 36 tests passed (auth module 전체), 0 failed
- 프론트엔드: build 성공 (타입 에러 없음)

## Deviations from Plan

### Auto-adjusted Issues

**1. [Rule 3 - Blocking] Guard factory 패턴 대신 개별 클래스 + 헬퍼 함수 패턴 사용**
- **Found during:** Task 1-B
- **Issue:** Plan에서 `createSocialAuthGuard` factory 패턴을 제안했으나, NestJS DI에서 factory 반환 클래스의 constructor 주입이 불안정할 수 있음
- **Fix:** Plan의 대안(IMPORTANT 주석)에 따라 개별 클래스로 구현하되 공통 로직을 `handleSocialAuthRequest` 헬퍼 함수로 추출
- **Files modified:** apps/api/src/modules/auth/guards/social-auth.guard.ts

**2. [Rule 2 - Missing functionality] SocialErrorMessage Suspense 래핑**
- **Found during:** Task 2-B
- **Issue:** login-form.tsx에서 useSearchParams를 직접 사용하면 Suspense boundary 없이 CSR bailout 경고 발생
- **Fix:** SocialErrorMessage를 별도 컴포넌트로 분리하고 Suspense로 래핑 (callback/page.tsx의 기존 패턴 참조)
- **Files modified:** apps/web/components/auth/login-form.tsx

## Self-Check: PASSED

- All 10 modified/created files exist
- Commit b87001d (Task 1) exists
- Commit 87925b1 (Task 2) exists
