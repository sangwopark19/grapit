---
quick_id: 260427-lyr
description: "프로덕션 소셜 로그인이 매번 실패하는 회귀 핫픽스 — `/auth/callback` 페이지 useEffect 더블 발사로 인한 refresh-token 패밀리 자살 차단"
status: complete
date: 2026-04-27
commit: 39ae868
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

## Files Touched

- `apps/web/app/auth/callback/page.tsx` (+9 / −1)

## Commit

`39ae868` — fix(quick-260427-lyr): guard /auth/callback useEffect from double-firing
