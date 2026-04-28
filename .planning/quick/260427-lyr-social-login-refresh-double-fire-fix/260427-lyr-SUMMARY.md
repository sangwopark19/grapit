---
quick_id: 260427-lyr
description: "프로덕션 소셜 로그인이 매번 실패하는 회귀 핫픽스 — root layout `AuthInitializer` 와 `/auth/callback` 페이지가 동시에 `/auth/refresh` 를 호출해 refresh-token 도난 탐지가 트리거되던 race 차단"
status: complete
date: 2026-04-27
commits:
  - 70a3f65 (R1, PR #23 — useRef 가드, race 부분 차단에 그쳐 재발)
  - 56826c6 (R2, PR #24 — AuthInitializer 단일 호출자화로 race 소거)
verified: 2026-04-27 — 사용자가 프로덕션에서 Google 로그인 정상 동작 확인 (PR #24 머지 후 grabit-web 자동 배포)
---

# Summary — Quick Task 260427-lyr

## 결과

소셜 로그인(Google·Kakao·Naver) 콜백 처리 IIFE를 `useRef` guard로 마운트당 정확히 1회 실행되도록 잠갔다. 핫픽스 1줄 변경(`apps/web/app/auth/callback/page.tsx`).

## 진단 (gcloud 로그)

`grabit-api` 프로덕션 로그에서 모든 소셜 로그인 세션이 동일 패턴으로 깨지고 있음을 확인:

| 시각 (UTC) | status | path | 의미 |
|---|---|---|---|
| 06:43:58.313 | 302 | `/api/v1/auth/social/google` | 사용자 클릭 |
| 06:44:01.579 | 302 | `/api/v1/auth/social/google/callback` | Google→API, refresh 쿠키 set |
| 06:44:01.96x | LOG | `Social login authenticated` | API 인증 성공 |
| 06:44:02.398 | 204 | `/api/v1/auth/refresh` (preflight #1) | 첫 번째 발사 |
| 06:44:02.402 | 204 | `/api/v1/auth/refresh` (preflight #2) | **두 번째 발사 (4ms 차)** |
| 06:44:02.443 | **200** | `/api/v1/auth/refresh` | 첫 요청: 토큰 회전 성공 |
| 06:44:02.448 | **401** | `/api/v1/auth/refresh` | 두 번째 요청: 패밀리 revoke |

Chrome 145, Chrome 147, iPhone Safari 26.4 — UA 무관하게 100% 재현.

## 근본 원인

1. **클라이언트 (`apps/web/app/auth/callback/page.tsx`)**: useEffect 의존성 `[searchParams, setAuth, router]`가 Next.js 16 + React 19 환경에서 (Suspense 경계 + `useSearchParams()` 인스턴스 불안정성으로) 다회 실행됨 → `/auth/refresh` 동시 두 번 호출.
2. **서버 (`apps/api/src/modules/auth/auth.service.ts:167-174`)**: 동일 raw refresh token 재사용은 의도적으로 **token theft**로 간주, 해당 토큰의 family 전체를 revoke (보안 정책상 변경 불가).
3. **결과 race**: 콜백 페이지의 IIFE 두 개가 동시 실행 → 한쪽은 `setAuth`+`/`로 push, 다른 쪽은 `toast.error('로그인에 실패했습니다.')`+`/auth`로 push → 사용자는 거의 매번 후자를 보게 됨. 또한 family가 revoke되어 다음 페이지 로드도 실패.
4. **일반 로그인이 멀쩡한 이유**: onClick 핸들러가 단발성 `POST /auth/login` 호출 → 동일 race 없음.

## 적용한 수정

**파일:** `apps/web/app/auth/callback/page.tsx`

```diff
-import { useEffect, useState, Suspense } from 'react';
+import { useEffect, useRef, useState, Suspense } from 'react';
…
+  // 콜백 처리는 마운트당 정확히 1회만 발사되어야 한다.
+  // useEffect가 다회 실행되면 /auth/refresh 가 동시에 두 번 호출되어
+  // refresh-token rotation의 도난 탐지가 트리거 → 패밀리 전체 revoke → 401.
+  const hasRunRef = useRef(false);
+
   useEffect(() => {
+    if (hasRunRef.current) return;
+    hasRunRef.current = true;
+
     const errorCode = searchParams.get('error');
```

총 +9 / −1 라인.

## 검증

- `pnpm --filter @grabit/web run typecheck` → 통과 (errors: 0).
- `pnpm --filter @grabit/web run lint` → 신규 error 0, 기존 warning 22 (모두 무관 파일에서 사전 존재).
- 코드 리뷰: useEffect 안의 모든 분기(`error`, `needs_registration`, `authenticated`, `invalid`)가 단일 ref 가드 아래 정확히 1회 실행됨을 시각 확인.

## 비범위

- 백엔드 rotation/theft-detection 로직은 보안상 변경하지 않음.
- 콜백 페이지의 raw `fetch()` → `apiClient` 통합은 별도 정리 항목으로 보류.
- 기존에 family가 revoke된 사용자는 한 번 다시 로그인하면 정상 복구 (서버측 cleanup 불필요).

## 배포 후 확인 항목

핫픽스가 빌드/배포되어 사용자 브라우저에 적용된 뒤:
1. `gcloud logging read … "/auth/refresh"`에서 같은 IP/UA에 대해 `200`+`401`이 5ms 간격으로 따라붙는 패턴이 사라지는가.
2. `Social login authenticated` 직후 `/users/me` 호출이 정확히 1회만 발생하는가.

## 후속 발견 (Round 2)

첫 번째 수정 (`useRef` 가드)은 PR #23 으로 main 머지 후 grabit-web-00014 (07:16 KST) 로 배포되었으나 **동일 증상이 그대로 재현**.

`2026-04-27T07:17:56` 로그 재분석 결과:

```
56.474 LOG findOrCreateSocialUser
56.503 LOG Social login authenticated
56.915 204 OPTIONS /auth/refresh
56.933 200 POST   /auth/refresh
56.960 401 POST   /auth/refresh   ← 27ms 후 두 번째 POST
56.988 204 OPTIONS /users/me
57.003 304 GET    /users/me
```

여전히 `/auth/refresh` 가 두 번 호출되지만, **콜백 페이지 내부의 중복이 아니다**. 두 번째 호출자는 root layout (`apps/web/app/layout.tsx:24`) 의 `<AuthInitializer />` (`apps/web/components/auth/auth-initializer.tsx`) — 모든 페이지 마운트 시 `initializeAuth()` (`apps/web/lib/auth.ts`) 가 `/auth/refresh` + `/users/me` 를 호출해 `useAuthStore` 를 초기화하는 컴포넌트.

호출자 두 명:
- **AuthInitializer** (root layout): `useEffect` → `initializeAuth()` → POST `/auth/refresh` (cookie A)
- **CallbackContent** (page IIFE): `useEffect` → POST `/auth/refresh` (cookie A)

각자 다른 컴포넌트의 useEffect라 `useRef` 가드로 막을 수 없는 cross-component race. 첫 호출이 토큰 회전을 마치기 전에 두 번째 호출이 같은 cookie A 로 도착 → `auth.service.ts:167-174` 가 도난으로 간주, family revoke → 401.

### Round 2 수정

`apps/web/app/auth/callback/page.tsx` — `status=authenticated` 분기에서 직접 `/auth/refresh` + `/users/me` 호출하던 IIFE 제거. 대신 `useAuthStore` 의 `user` / `isInitialized` 를 관측하는 watch effect 로 대체:

- `user` 가 채워지면 → `router.push('/')`
- `isInitialized && !user` 면 (AuthInitializer 가 끝났는데 user 없음 = refresh 실패) → toast + `router.push('/auth')`

`hasRedirectedRef` 로 라우팅 1회 보장. `isProcessing` state 는 제거 (관측 모델로 충분).

이로써 `/auth/refresh` 호출자는 **AuthInitializer 단 하나**로 단일화되어 race 자체가 소거됨. backend rotation 정책은 그대로 유지.

## Files Touched (누적)

- `apps/web/app/auth/callback/page.tsx` (Round 1 +9/−1, Round 2 useEffect IIFE 제거 + watch effect 추가)

## Commits

- `70a3f65` (Round 1) — fix(quick-260427-lyr): guard /auth/callback useEffect from double-firing — **불충분, race 의 다른 호출자(AuthInitializer)를 못 막음**
- `56826c6` (Round 2) — fix(quick-260427-lyr): stop /auth/callback from racing AuthInitializer for /auth/refresh
