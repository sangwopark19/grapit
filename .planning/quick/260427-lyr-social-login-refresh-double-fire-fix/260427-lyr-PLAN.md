---
quick_id: 260427-lyr
description: "프로덕션 소셜 로그인이 매번 실패하는 회귀 핫픽스 — `/auth/callback` 페이지 useEffect 더블 발사로 인한 refresh-token 패밀리 자살 차단"
created: 2026-04-27
status: planned
---

# Quick Task 260427-lyr — 소셜 로그인 refresh 더블 발사 핫픽스

## 배경 및 증상

- **증상:** 프로덕션(`heygrabit.com`)에서 일반 로그인은 성공하지만, 소셜 로그인(Google/Kakao/Naver)을 시도하면 항상 실패 토스트(`로그인에 실패했습니다.`)가 표시되며 `/auth`로 리다이렉트.
- **API 측:** `grabit-api` Cloud Run 로그에 `Social login authenticated: provider=google, providerId=...`가 매번 정상 출력 → API 자체는 인증 성공.
- **클라이언트 측:** API 실패가 아니라 **콜백 페이지 후처리가 깨지고 있음**.

## 로그 증거 (gcloud)

```
06:43:58.313  302  /api/v1/auth/social/google                   ← 클릭
06:44:01.579  302  /api/v1/auth/social/google/callback          ← Google 콜백, 쿠키 set
06:44:01.96x  LOG  AuthController: Social login authenticated   ← API OK
06:44:02.398  204  /api/v1/auth/refresh   (preflight)
06:44:02.402  204  /api/v1/auth/refresh   (preflight)            ← 두 번째 preflight!
06:44:02.443  200  /api/v1/auth/refresh                          ← 첫 요청 성공 (토큰 회전)
06:44:02.448  401  /api/v1/auth/refresh                          ← 두 번째 요청 401
```

iPhone Safari, Chrome 145, Chrome 147 — UA 무관하게 동일 패턴 재현.

## 근본 원인

1. `apps/web/app/auth/callback/page.tsx`의 `useEffect` 의존성 배열은 `[searchParams, setAuth, router]`.
2. Next.js 16 + React 19 환경에서 `useSearchParams()`는 렌더마다 새 인스턴스를 반환할 수 있고, Suspense/스트리밍 hydration으로 인해 페이지가 한 번 더 마운트되거나 effect가 재실행됨.
3. 결과적으로 `if (status === 'authenticated')` 분기 안의 IIFE가 두 번 발사되어 `/auth/refresh`가 동시에 두 번 호출됨.
4. 백엔드 `AuthService.refreshTokens` (`apps/api/src/modules/auth/auth.service.ts:147-214`)는 이미 revoked된 토큰을 다시 만나면 **토큰 도난(theft)** 으로 간주하고 패밀리 전체를 revoke (line 167-174):
   - 첫 요청: 토큰 검증 → revoke 마킹 → 새 토큰 발급 → 200
   - 두 번째 요청: 같은 raw token으로 도착 → `revokedAt`가 이미 set → 패밀리 전체 revoke → 401
5. 콜백 페이지 IIFE 두 개가 race로 진행:
   - 성공한 IIFE는 `setAuth` 후 `/`로 push
   - 실패한 IIFE는 `toast.error('로그인에 실패했습니다.')` + `/auth`로 push
   둘이 동시에 라우터를 호출하므로 사용자에게는 거의 매번 에러 토스트 + `/auth` 화면이 노출됨.
6. 추가 부작용: 패밀리가 즉시 revoke되어 다음 페이지 로드에서도 세션이 살아있지 않음 → "정말로 실패한 것처럼" 보임.

(일반 로그인은 onClick 핸들러에서 단발성 `POST /auth/login`만 호출하므로 동일 race가 발생하지 않음.)

## 비교: 동일 패턴 회피되는 다른 호출 경로

`apps/web/lib/api-client.ts`는 `refreshPromise` 변수를 이용해 동시 refresh를 dedupe하지만, 콜백 페이지는 raw `fetch()`를 직접 사용해 dedupe 우회. 이번 수정은 콜백 페이지에 한해 useRef guard를 추가해 실행 자체를 1회로 잠그는 것이 가장 안전.

## 수정 범위 (frontend-only, 1 task)

### Task 1 — `/auth/callback` useEffect 더블 발사 차단

**파일:** `apps/web/app/auth/callback/page.tsx`

**변경:**
1. `useRef`를 import에 추가.
2. `CallbackContent` 안에 `const hasRunRef = useRef(false);` 추가.
3. 기존 `useEffect` 시작 부분에서 `if (hasRunRef.current) return;` early-return 후 `hasRunRef.current = true;` 마킹.

**Action:** 한 번 마운트당 OAuth 콜백 처리 IIFE가 정확히 1회만 실행되도록 가드.

**Verify:**
- `pnpm --filter @grabit/web run typecheck` (또는 모노레포 root에서 `pnpm typecheck`) 통과.
- `pnpm --filter @grabit/web run lint`(존재 시) 통과.
- 코드 리뷰: useEffect 안의 모든 분기(에러, needs_registration, authenticated, invalid)가 모두 첫 실행에서 처리됨을 시각 확인.

**Done:** `apps/web/app/auth/callback/page.tsx`가 `hasRunRef` guard로 useEffect를 1회로 잠그고, lint/typecheck가 클린.

## must_haves (truths · artifacts · key_links)

- **Truth-1**: 동일 raw refresh token으로 두 번째 요청이 들어오면 백엔드는 의도적으로 패밀리 전체를 revoke한다 (`auth.service.ts:167-174`). 백엔드 동작은 보안 정책상 변경하지 않는다.
- **Truth-2**: 콜백 페이지의 useEffect는 의존성 변화 또는 hydration 재실행으로 다회 발사될 수 있다. 따라서 클라이언트 측에서 한 번만 발사되도록 명시적 guard가 필요하다.
- **Artifact**: `apps/web/app/auth/callback/page.tsx` 단일 파일 수정.
- **key_links**:
  - `apps/web/app/auth/callback/page.tsx:51-119`
  - `apps/api/src/modules/auth/auth.service.ts:147-214`
  - `apps/api/src/modules/auth/auth.controller.ts:220-262`

## 비범위 (Out of scope)

- `auth.service.ts`의 토큰 회전/도난 검증 로직 — 보안상 그대로 유지.
- `apiClient.refreshPromise` dedupe 통합 — 콜백 페이지는 빈손 상태(쿠키만 존재, accessToken 없음)에서 직접 `/refresh`를 부르는 특수 경로이므로 별도 가드가 더 단순.
- 다른 OAuth 분기(`needs_registration`, error)는 동일 useEffect 안에 있어 동일 guard로 함께 보호됨 — 별도 작업 없음.

## 검증 후 추가 관측

이 변경은 클라이언트 한 줄짜리 핫픽스이지만, 사용자가 이미 한 번 로그인 시도를 한 계정의 refresh 패밀리는 모두 revoke 되어 있을 수 있다. 배포 직후 로그에서 `200 /auth/refresh` 후 같은 IP에서 `401 /auth/refresh`가 즉시 따라오는 패턴이 사라지는지 확인 (수정이 적용된 빌드가 사용자 브라우저에 도달한 뒤).
