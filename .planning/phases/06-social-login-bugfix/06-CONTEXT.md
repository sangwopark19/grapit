# Phase 6: 소셜 로그인 버그 수정 - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

카카오/네이버/구글 소셜 로그인 사용자가 로그아웃 후 재로그인할 수 있도록 버그를 수정한다. 버그 수정과 함께 소셜 로그인 플로우의 디버그 로깅, 에러 핸들링, callback URL 정합성을 개선한다.

</domain>

<decisions>
## Implementation Decisions

### 수정 범위
- **D-01:** 최소 버그 수정이 아닌, 버그 수정 + 소셜 플로우 개선을 함께 진행
- **D-02:** 각 소셜 로그인 단계(provider callback, findOrCreateSocialUser, token 발급)에 구조화된 디버그 로깅 추가
- **D-03:** provider 응답 없음, 토큰 만료, DB 연결 실패 등 엣지 케이스별 적절한 에러 처리 추가
- **D-04:** 세 provider(카카오/네이버/구글)의 Passport strategy callbackURL이 실제 컨트롤러 라우트와 일치하는지 검증 및 수정

### 테스트 검증
- **D-05:** Playwright E2E 테스트 자동화로 세 프로바이더 검증
- **D-06:** 전체 소셜 플로우(최초 소셜 회원가입 → 로그아웃 → 재로그인) E2E 테스트
- **D-07:** 테스트 계정 세팅 필요 (카카오/네이버/구글 각각)

### 에러 UX
- **D-08:** 소셜 로그인 실패 시 원인별 구체적 메시지 표시 (토큰 만료, provider 응답 없음, 이미 연결된 계정 등)
- **D-09:** 에러 메시지와 함께 재시도 버튼 제공

### Claude's Discretion
- 디버그 로깅의 구체적 포맷과 레벨 결정
- E2E 테스트 헬퍼 구조 설계
- 에러 코드 체계 설계

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 소셜 로그인 백엔드
- `apps/api/src/modules/auth/auth.service.ts` -- findOrCreateSocialUser, completeSocialRegistration 로직
- `apps/api/src/modules/auth/auth.controller.ts` -- 소셜 OAuth 엔드포인트, handleSocialCallback
- `apps/api/src/modules/auth/strategies/kakao.strategy.ts` -- 카카오 Passport strategy + callbackURL
- `apps/api/src/modules/auth/strategies/naver.strategy.ts` -- 네이버 Passport strategy
- `apps/api/src/modules/auth/strategies/google.strategy.ts` -- 구글 Passport strategy
- `apps/api/src/modules/auth/guards/social-auth.guard.ts` -- 소셜 인증 가드
- `apps/api/src/modules/auth/interfaces/social-profile.interface.ts` -- SocialProfile 인터페이스
- `apps/api/src/database/schema/social-accounts.ts` -- social_accounts 스키마 (provider+providerId unique)

### 소셜 로그인 프론트엔드
- `apps/web/app/auth/callback/page.tsx` -- OAuth 콜백 처리, 회원가입 완료 플로우
- `apps/web/components/auth/social-login-button.tsx` -- 소셜 로그인 버튼 컴포넌트
- `apps/web/components/auth/login-form.tsx` -- 로그인 폼 (소셜 로그인 포함)

### 공유 타입
- `packages/shared/src/types/auth.types.ts` -- SocialAuthResult 타입 정의

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthService.findOrCreateSocialUser`: 이미 social_accounts 조회 → authenticated/needs_registration 분기 구현됨
- `AuthService.generateTokenPair`: access token + refresh token 생성 + DB 저장 로직 존재
- `AuthService.setRefreshTokenCookie`: httpOnly secure cookie 설정 헬퍼 존재
- `CallbackContent` 컴포넌트: 소셜 콜백 페이지에서 authenticated/needs_registration 분기 처리 존재

### Established Patterns
- Passport strategy 패턴: provider별 strategy 클래스 + AuthGuard 조합
- Refresh token rotation: family 기반 토큰 회전 + SHA-256 해싱
- Zod validation pipe: DTO 검증에 ZodValidationPipe 사용
- Toast 알림: sonner를 사용한 에러/성공 알림

### Integration Points
- Kakao strategy callbackURL 기본값 `/api/v1/auth/kakao/callback`이 컨트롤러 라우트 `/auth/social/kakao/callback`과 불일치 가능성
- 프론트엔드 callback 페이지에서 `/api/v1/auth/refresh` 호출 시 cookie 전달 (credentials: 'include')
- `NEXT_PUBLIC_API_URL` 환경변수로 API 서버 URL 결정
- SameSite cookie 설정이 redirect 후 cookie 전달에 영향

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-social-login-bugfix*
*Context gathered: 2026-04-09*
