# Phase 6: 소셜 로그인 버그 수정 - Research

**Researched:** 2026-04-09
**Domain:** OAuth 소셜 로그인 (Passport.js + NestJS), 쿠키 기반 인증, 에러 핸들링
**Confidence:** HIGH

## Summary

소셜 로그인 재로그인 실패 버그의 근본 원인을 코드 분석을 통해 식별했다. **핵심 버그는 Passport strategy의 callbackURL 기본값과 실제 컨트롤러 라우트의 불일치**이다. 추가로 `handleSocialCallback`의 에러 핸들링 부재, SameSite 쿠키 cross-origin redirect 문제, 소셜 AuthGuard의 OAuth 에러 미처리 등 복합적인 문제가 존재한다.

버그 수정은 백엔드 3개 strategy 파일의 callbackURL 수정, handleSocialCallback에 try-catch 추가, AuthGuard에 handleRequest 오버라이드 추가, 프론트엔드 callback 페이지에 에러 상태 UI 추가로 구성된다. 기존 코드베이스의 패턴(Passport strategy, Zod validation, sonner toast, Drizzle ORM)을 그대로 활용하며 새로운 라이브러리 도입은 불필요하다.

**Primary recommendation:** callbackURL 불일치를 수정하고, OAuth 에러 전파 경로 전체(Guard -> Controller -> Frontend)에 구조화된 에러 핸들링을 추가한다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 최소 버그 수정이 아닌, 버그 수정 + 소셜 플로우 개선을 함께 진행
- **D-02:** 각 소셜 로그인 단계(provider callback, findOrCreateSocialUser, token 발급)에 구조화된 디버그 로깅 추가
- **D-03:** provider 응답 없음, 토큰 만료, DB 연결 실패 등 엣지 케이스별 적절한 에러 처리 추가
- **D-04:** 세 provider(카카오/네이버/구글)의 Passport strategy callbackURL이 실제 컨트롤러 라우트와 일치하는지 검증 및 수정
- **D-05:** Playwright E2E 테스트 자동화로 세 프로바이더 검증
- **D-06:** 전체 소셜 플로우(최초 소셜 회원가입 -> 로그아웃 -> 재로그인) E2E 테스트
- **D-07:** 테스트 계정 세팅 필요 (카카오/네이버/구글 각각)
- **D-08:** 소셜 로그인 실패 시 원인별 구체적 메시지 표시 (토큰 만료, provider 응답 없음, 이미 연결된 계정 등)
- **D-09:** 에러 메시지와 함께 재시도 버튼 제공

### Claude's Discretion
- 디버그 로깅의 구체적 포맷과 레벨 결정
- E2E 테스트 헬퍼 구조 설계
- 에러 코드 체계 설계

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | 소셜 로그인 재로그인 실패 버그 수정 (회원가입 후 로그아웃 -> 재로그인 불가, 카카오/네이버/구글 전부) | callbackURL 불일치 버그 식별 완료, SameSite 쿠키 이슈 분석 완료, 에러 핸들링 부재 확인 완료 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- ES modules (import/export) 사용, CommonJS 금지
- Strict typing -- `any` 사용 금지
- Conventional commits (feat:, fix:, test: 등)
- Co-Authored-By 트레일러 추가 금지
- 코드 변경 후 typecheck/lint 실행
- 테스트 먼저 작성 (비즈니스 로직, API 코드)
- vitest 사용 (Jest 아닌)
- 환경변수는 모노레포 루트 `.env`에 위치
- NestJS global prefix: `api/v1`

## Bug Analysis

### Bug 1: callbackURL 경로 불일치 (ROOT CAUSE - 재로그인 실패의 직접 원인)

**발견 위치:** `apps/api/src/modules/auth/strategies/*.ts` [VERIFIED: codebase grep]

| Provider | Strategy 기본 callbackURL | 실제 컨트롤러 라우트 (global prefix 적용) |
|----------|---------------------------|------------------------------------------|
| Kakao | `http://localhost:8080/api/v1/auth/kakao/callback` | `http://localhost:8080/api/v1/auth/social/kakao/callback` |
| Naver | `http://localhost:8080/api/v1/auth/naver/callback` | `http://localhost:8080/api/v1/auth/social/naver/callback` |
| Google | `http://localhost:8080/api/v1/auth/google/callback` | `http://localhost:8080/api/v1/auth/social/google/callback` |

**문제:** 기본 callbackURL에 `/social/` 세그먼트가 빠져 있다. 컨트롤러는 `@Controller('auth')` 아래 `@Get('social/kakao/callback')` 형태이므로 전체 경로는 `api/v1/auth/social/kakao/callback`이다. 환경변수(`KAKAO_CALLBACK_URL` 등)가 설정되어 있으면 동작할 수 있지만, 기본값 폴백에 의존하면 OAuth provider가 callback을 잘못된 URL로 보내게 된다.

**흥미로운 점:** 테스트 파일(spec.ts)에서는 올바른 URL(`/api/v1/auth/social/kakao/callback`)을 사용하고 있지만, 실제 strategy의 기본값은 `/social/`이 없는 URL이다. 이로 인해 테스트는 통과하지만 실제 동작은 실패하는 상황이 발생한다. [VERIFIED: codebase grep]

**수정:** 세 strategy 파일의 기본 callbackURL을 `/social/` 포함 경로로 수정.

### Bug 2: handleSocialCallback 에러 핸들링 부재

**발견 위치:** `apps/api/src/modules/auth/auth.controller.ts` 212-227행 [VERIFIED: codebase read]

```typescript
private async handleSocialCallback(req: Request, res: Response): Promise<void> {
  const profile = req.user as SocialProfile;
  const result = await this.authService.findOrCreateSocialUser(profile);
  // ... redirect
}
```

**문제:** `findOrCreateSocialUser`에서 예외가 발생하면(DB 연결 실패, 사용자 삭제 등) 에러가 NestJS 기본 에러 핸들러로 전파되어 JSON 에러 응답을 반환한다. 그러나 이 시점에서 브라우저는 OAuth redirect 중이므로 JSON 에러 응답이 사용자에게 그대로 노출된다.

**수정:** try-catch로 감싸고, 에러 발생 시 프론트엔드 `/auth?error=server_error` 등으로 redirect.

### Bug 3: SameSite 쿠키 + Cross-Origin Redirect 이슈

**발견 위치:** `apps/api/src/modules/auth/auth.controller.ts` 230-237행 [VERIFIED: codebase read]

```typescript
private setRefreshTokenCookie(res: Response, token: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    sameSite: isProduction ? 'strict' : 'lax',
  });
}
```

**문제:** OAuth 소셜 로그인 플로우에서:
1. 사용자가 프론트엔드(localhost:3000)에서 백엔드(localhost:8080)의 `/api/v1/auth/social/kakao`로 이동
2. 카카오 OAuth 페이지에서 인증 후 백엔드 callback URL로 redirect
3. 백엔드가 refreshToken 쿠키를 설정하고 프론트엔드로 redirect
4. 프론트엔드 callback 페이지에서 `/api/v1/auth/refresh` 호출

3->4 단계에서 쿠키가 cross-site 요청으로 간주될 수 있다. 개발 환경에서는 `sameSite: 'lax'`이므로 top-level navigation redirect에서는 쿠키가 전달되지만, `fetch` 요청에서는 전달되지 않을 수 있다.

**핵심:** `handleSocialCallback`에서 `setRefreshTokenCookie`를 호출한 후 프론트엔드로 redirect한다. 이 redirect는 백엔드 도메인(localhost:8080)에서 설정된 쿠키이므로, 프론트엔드(localhost:3000)에서 백엔드로 보내는 `fetch` 요청에 이 쿠키가 포함된다 -- `credentials: 'include'`와 CORS 설정이 올바르면 동작해야 한다.

**그러나** `sameSite: 'strict'` (프로덕션)에서는 OAuth redirect 체인 후 쿠키가 전달되지 않을 수 있다. OAuth 플로우는 외부 사이트(kakao, naver, google)를 거치기 때문에 `strict`은 쿠키 전달을 차단한다.

**수정:** 프로덕션에서도 `sameSite: 'lax'`를 사용해야 한다. `lax`는 top-level navigation에서는 쿠키를 전달하고, CSRF 공격의 주요 벡터인 cross-site POST는 차단한다. [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite]

### Bug 4: Social AuthGuard의 OAuth 에러 미처리

**발견 위치:** `apps/api/src/modules/auth/guards/social-auth.guard.ts` [VERIFIED: codebase read]

```typescript
export class KakaoAuthGuard extends AuthGuard('kakao') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

**문제:** OAuth provider가 에러를 반환하는 경우(사용자가 동의를 거부, 토큰 만료, provider 서버 오류 등) Passport가 내부적으로 `UnauthorizedException`을 throw한다. 현재 Guard에는 `handleRequest` 오버라이드가 없어서, 에러가 NestJS 기본 예외 필터로 전파되어 JSON 에러를 반환한다.

**수정:** `handleRequest` 메서드를 오버라이드하여 에러 시 프론트엔드로 redirect하도록 처리. 또는 컨트롤러 콜백 핸들러에서 `req.user`가 없는 경우를 처리.

## Architecture Patterns

### Recommended Fix Structure

```
apps/api/src/modules/auth/
  strategies/
    kakao.strategy.ts      # callbackURL 기본값 수정
    naver.strategy.ts      # callbackURL 기본값 수정
    google.strategy.ts     # callbackURL 기본값 수정
  guards/
    social-auth.guard.ts   # handleRequest 오버라이드 추가
  auth.controller.ts       # handleSocialCallback 에러 핸들링, 로깅 추가
  auth.service.ts          # findOrCreateSocialUser 로깅 추가

apps/web/
  app/auth/callback/page.tsx       # 에러 상태 UI 추가 (D-08, D-09)
  components/auth/login-form.tsx   # ?error= 쿼리 파라미터 에러 표시
```

### Pattern 1: Social Auth Error Flow (수정 후)

**What:** OAuth 에러가 프론트엔드까지 구조적으로 전달되는 플로우
**When to use:** 모든 소셜 로그인 에러 시나리오

```
[사용자] -> [소셜 Provider] -> [Backend Callback]
                                    |
                              성공? -> setRefreshTokenCookie + redirect /auth/callback?status=authenticated
                              실패? -> redirect /auth/callback?error=<error_code>&provider=<provider>
                                    |
                              [Frontend /auth/callback]
                                    |
                              error 파라미터? -> 에러 UI 표시 + "다시 로그인하기" 버튼
                              status=authenticated? -> /api/v1/auth/refresh -> 홈으로 이동
```

### Pattern 2: 구조화된 에러 코드 체계 (Claude's Discretion)

**What:** 백엔드에서 프론트엔드로 전달하는 소셜 로그인 에러 코드
**Recommendation:**

| Error Code | 의미 | 프론트엔드 메시지 |
|------------|------|-------------------|
| `oauth_denied` | 사용자가 OAuth 동의 거부 | 로그인이 취소되었습니다 |
| `oauth_failed` | Provider에서 인증 실패 | {provider} 로그인에 실패했습니다 |
| `token_expired` | 세션/토큰 만료 | 로그인 세션이 만료되었습니다 |
| `server_error` | 내부 서버 에러 | 일시적인 오류가 발생했습니다 |
| `account_conflict` | 이미 연결된 계정 | 이미 다른 계정에 연결된 소셜 계정입니다 |

### Pattern 3: 구조화된 디버그 로깅 (Claude's Discretion)

**What:** NestJS Logger를 사용한 소셜 로그인 단계별 로깅
**Recommendation:** NestJS 내장 `Logger` 클래스 사용 (외부 라이브러리 불필요)

```typescript
// Source: NestJS 기존 패턴
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(AuthController.name);

// 사용 예
this.logger.log(`Social callback received: provider=${profile.provider}, providerId=${profile.providerId}`);
this.logger.warn(`Social auth failed: provider=${provider}, error=${error.message}`);
this.logger.error(`findOrCreateSocialUser failed`, error.stack);
```

로깅 레벨 권장:
- `log` (INFO): 정상 플로우 (callback 수신, 사용자 조회 성공, 토큰 발급)
- `warn`: 복구 가능한 에러 (토큰 만료, 동의 거부)
- `error`: 복구 불가능한 에러 (DB 연결 실패, 예상치 못한 예외)

### Anti-Patterns to Avoid
- **에러를 삼키지 않기:** catch 블록에서 로깅 없이 에러를 무시하지 않는다
- **JSON 에러를 redirect 플로우에서 반환하지 않기:** OAuth callback에서는 항상 프론트엔드로 redirect해야 한다
- **쿠키 설정 후 바로 redirect하고 SameSite를 고려하지 않기:** cross-origin OAuth 플로우에서는 `sameSite: 'lax'`가 필수

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 인증 플로우 | 직접 OAuth 토큰 교환 구현 | passport-kakao, passport-naver-v2, passport-google-oauth20 | 이미 사용 중, 검증된 라이브러리 |
| JWT 생성/검증 | 직접 crypto 사용 | @nestjs/jwt (JwtService) | 이미 사용 중 |
| 쿠키 파싱 | 직접 header 파싱 | cookie-parser | 이미 사용 중 |
| 에러 로깅 | console.log | NestJS Logger | 프레임워크 내장, 레벨/컨텍스트 지원 |
| E2E 테스트 | 직접 HTTP 요청 스크립트 | @playwright/test | 결정사항 D-05 |

## Common Pitfalls

### Pitfall 1: OAuth Provider의 Redirect URI 등록 불일치

**What goes wrong:** callbackURL을 코드에서 수정해도, OAuth provider 개발자 콘솔(카카오, 네이버, 구글)에 등록된 Redirect URI와 일치하지 않으면 여전히 에러가 발생한다.
**Why it happens:** 코드만 수정하고 provider 설정을 업데이트하지 않음.
**How to avoid:** 코드 수정 후 반드시 각 provider의 개발자 콘솔에서 Redirect URI를 확인/업데이트한다.
**Warning signs:** OAuth 에러 "redirect_uri_mismatch" 또는 유사 에러 메시지.

### Pitfall 2: SameSite=Strict에서 OAuth 쿠키 누락

**What goes wrong:** 프로덕션에서 `sameSite: 'strict'` 설정 시 OAuth redirect 체인 후 쿠키가 전달되지 않아 refresh 요청이 실패한다.
**Why it happens:** OAuth 플로우는 외부 사이트(카카오/네이버/구글)를 경유하므로 strict 모드에서는 cross-site로 간주된다.
**How to avoid:** `sameSite: 'lax'`를 사용한다. Lax는 top-level navigation에서 쿠키를 전달하면서도 CSRF 방어를 유지한다.
**Warning signs:** 개발 환경에서는 잘 되지만 프로덕션에서 재로그인이 실패.

### Pitfall 3: Passport AuthGuard에서 에러가 JSON으로 반환됨

**What goes wrong:** OAuth provider가 에러를 반환하면 Passport가 `UnauthorizedException`을 throw하고, NestJS 기본 예외 필터가 JSON 응답을 반환한다. 브라우저에서는 이 JSON이 그대로 화면에 표시된다.
**Why it happens:** `handleRequest`를 오버라이드하지 않아 에러가 HTTP 응답으로 전환됨.
**How to avoid:** AuthGuard에 `handleRequest` 오버라이드를 추가하거나, 컨트롤러에서 `req.user` 없음을 체크하고 redirect한다.
**Warning signs:** 소셜 로그인 실패 시 JSON 에러 페이지가 표시됨.

### Pitfall 4: 프론트엔드 callback에서 에러 상태 없이 redirect만 반복

**What goes wrong:** 에러 시 `/auth`로 redirect하지만 에러 원인을 알 수 없어 사용자가 같은 동작을 반복한다.
**Why it happens:** 현재 코드는 에러 시 `toast.error` + `router.push('/auth')`만 수행. Toast는 redirect 후 사라진다.
**How to avoid:** 에러 코드를 query parameter로 전달하고 로그인 페이지에서 해당 에러를 표시한다.
**Warning signs:** 사용자가 소셜 로그인을 반복 시도하지만 계속 실패.

### Pitfall 5: Playwright E2E 테스트에서 OAuth 실제 인증 불가

**What goes wrong:** Playwright에서 카카오/네이버/구글의 실제 로그인 페이지를 자동화하려면 각 provider의 봇 감지(CAPTCHA, 2FA)에 의해 차단될 수 있다.
**Why it happens:** OAuth provider들은 자동화된 로그인을 차단한다.
**How to avoid:** 두 가지 접근법:
  1. **API-level mock:** 테스트 환경에서 Passport strategy를 mock하여 OAuth redirect 없이 직접 callback 엔드포인트 호출
  2. **실제 테스트 계정:** 각 provider의 테스트 앱/계정 사용 (D-07 결정사항). 단, CAPTCHA가 뜨지 않도록 테스트 앱 설정 필요
**Warning signs:** CI에서 E2E 테스트가 간헐적으로 실패.

## Code Examples

### Fix 1: Strategy callbackURL 수정

```typescript
// Source: apps/api/src/modules/auth/strategies/kakao.strategy.ts (수정 후)
// 변경점: /auth/kakao/callback -> /auth/social/kakao/callback
super({
  clientID: configService.get<string>('KAKAO_CLIENT_ID', 'not-configured'),
  clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET', 'not-configured'),
  callbackURL: configService.get<string>(
    'KAKAO_CALLBACK_URL',
    'http://localhost:8080/api/v1/auth/social/kakao/callback',
  ),
});
```

### Fix 2: handleSocialCallback 에러 핸들링

```typescript
// Source: apps/api/src/modules/auth/auth.controller.ts (수정 후)
private async handleSocialCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

  // req.user가 없으면 Guard 단계에서 에러 발생한 것
  if (!req.user) {
    this.logger.warn('Social callback received without user profile');
    res.redirect(`${frontendUrl}/auth/callback?error=oauth_failed`);
    return;
  }

  const profile = req.user as SocialProfile;

  try {
    this.logger.log(`Social callback: provider=${profile.provider}, providerId=${profile.providerId}`);
    const result = await this.authService.findOrCreateSocialUser(profile);

    if (result.status === 'authenticated') {
      if (result.refreshToken) {
        this.setRefreshTokenCookie(res, result.refreshToken);
      }
      res.redirect(`${frontendUrl}/auth/callback?status=authenticated`);
    } else {
      res.redirect(
        `${frontendUrl}/auth/callback?registrationToken=${result.registrationToken}&status=needs_registration`,
      );
    }
  } catch (error) {
    this.logger.error('Social callback processing failed', (error as Error).stack);
    res.redirect(`${frontendUrl}/auth/callback?error=server_error`);
  }
}
```

### Fix 3: SameSite 쿠키 수정

```typescript
// Source: apps/api/src/modules/auth/auth.controller.ts (수정 후)
private setRefreshTokenCookie(res: Response, token: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // OAuth redirect 체인에서 쿠키 전달을 위해 항상 lax
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}
```

### Fix 4: AuthGuard handleRequest 오버라이드

```typescript
// Source: apps/api/src/modules/auth/guards/social-auth.guard.ts (수정 후)
import { Injectable, type ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  private readonly logger = new Logger(KakaoAuthGuard.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    if (err || !user) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const res = context.switchToHttp().getResponse<Response>();
      this.logger.warn(`Kakao OAuth failed: ${err?.message ?? 'no user returned'}`);
      res.redirect(`${frontendUrl}/auth/callback?error=oauth_failed&provider=kakao`);
      return null as T;
    }
    return user;
  }
}
```

### Fix 5: 프론트엔드 에러 상태 UI (callback page)

```typescript
// Source: apps/web/app/auth/callback/page.tsx (에러 상태 추가 부분)
// UI-SPEC의 에러 메시지 매핑 사용
const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  oauth_denied: {
    title: '로그인이 취소되었습니다.',
    detail: '다시 로그인해주세요.',
  },
  oauth_failed: {
    title: '소셜 로그인에 실패했습니다.',
    detail: '잠시 후 다시 시도해주세요.',
  },
  token_expired: {
    title: '로그인 세션이 만료되었습니다.',
    detail: '다시 로그인해주세요.',
  },
  server_error: {
    title: '일시적인 오류가 발생했습니다.',
    detail: '잠시 후 다시 시도해주세요.',
  },
  account_conflict: {
    title: '이미 다른 계정에 연결된 소셜 계정입니다.',
    detail: '기존 계정으로 로그인해주세요.',
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sameSite: 'strict'` for auth cookies | `sameSite: 'lax'` for OAuth flows | Browser spec update (2020+) | Strict 은 OAuth redirect chain에서 쿠키 차단 |
| Passport 에러를 JSON으로 반환 | Guard에서 redirect로 처리 | NestJS 공식 가이드 | 브라우저 기반 OAuth에서 JSON 에러는 UX 파괴 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | callbackURL 기본값 불일치가 재로그인 실패의 주 원인이다 | Bug Analysis #1 | 환경변수가 올바르게 설정되어 있다면 이 기본값은 사용되지 않으므로 다른 원인을 찾아야 함 |
| A2 | 프로덕션에서 `sameSite: 'strict'`이 OAuth 쿠키 전달을 차단한다 | Bug Analysis #3 | 현재 프로덕션 미배포 상태라면 개발 환경에서는 `lax`이므로 이 이슈는 아직 발현되지 않았을 수 있음 |
| A3 | Playwright E2E에서 실제 OAuth 인증이 봇 감지에 차단될 수 있다 | Pitfall #5 | 테스트 앱 설정에 따라 다를 수 있음 -- 실제 테스트 시 확인 필요 |

## Open Questions

1. **환경변수 실제 설정 여부**
   - What we know: strategy 파일의 기본값에 버그가 있다
   - What's unclear: `.env` 파일에 `KAKAO_CALLBACK_URL` 등이 올바르게 설정되어 있는지 (`.env`는 gitignore이므로 확인 불가)
   - Recommendation: 환경변수 유무와 무관하게 기본값을 수정하고, `.env.example`에 올바른 예시를 추가한다

2. **프로덕션 배포 상태**
   - What we know: STATE.md에 따르면 아직 v1.1 계획 중
   - What's unclear: SameSite `strict` 이슈가 실제로 발현되었는지
   - Recommendation: 방어적으로 수정 (strict -> lax)하여 프로덕션 배포 시 문제 방지

3. **E2E 테스트 방식 결정**
   - What we know: D-05에서 Playwright E2E 결정, D-07에서 테스트 계정 필요
   - What's unclear: 실제 OAuth provider 로그인 자동화 가능 여부
   - Recommendation: 백엔드 callback 직접 호출 방식의 integration 테스트 + 수동 E2E 체크리스트 병행

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/api exec vitest run src/modules/auth` |
| Full suite command | `pnpm --filter @grapit/api test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01a | callbackURL이 컨트롤러 라우트와 일치 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/auth/strategies` | 기존 spec 파일 수정 필요 |
| AUTH-01b | findOrCreateSocialUser 재로그인 시 authenticated 반환 | unit | `pnpm --filter @grapit/api exec vitest run src/modules/auth/auth.service.spec.ts` | 기존 테스트 있음 |
| AUTH-01c | handleSocialCallback 에러 시 redirect | unit | `pnpm --filter @grapit/api exec vitest run src/modules/auth/auth.controller.spec.ts` | Wave 0 |
| AUTH-01d | AuthGuard OAuth 에러 시 redirect | unit | `pnpm --filter @grapit/api exec vitest run src/modules/auth/guards/social-auth.guard.spec.ts` | Wave 0 |
| AUTH-01e | E2E: 소셜 회원가입 -> 로그아웃 -> 재로그인 | e2e | Playwright (수동 검증 필요) | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/api exec vitest run src/modules/auth`
- **Per wave merge:** `pnpm --filter @grapit/api test`
- **Phase gate:** Full suite green + 수동 E2E 검증

### Wave 0 Gaps

- [ ] `apps/api/src/modules/auth/auth.controller.spec.ts` -- handleSocialCallback 에러 핸들링 테스트
- [ ] `apps/api/src/modules/auth/guards/social-auth.guard.spec.ts` -- handleRequest 오버라이드 테스트
- [ ] Playwright 설정: `pnpm --filter @grapit/web add -D @playwright/test` + `playwright.config.ts`
- [ ] 기존 strategy spec 파일에 callbackURL 검증 테스트 추가

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Passport.js OAuth strategies (기존) |
| V3 Session Management | yes | httpOnly secure cookie, token rotation (기존) |
| V4 Access Control | no | 이 phase에서 변경 없음 |
| V5 Input Validation | yes | zod validation (기존) |
| V6 Cryptography | no | 이 phase에서 변경 없음 |

### Known Threat Patterns for OAuth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth redirect URI manipulation | Spoofing | callbackURL 고정 + provider 콘솔 등록 |
| CSRF via OAuth state parameter | Tampering | Passport 내장 state 파라미터 (기본 활성화) |
| Token theft via cookie | Information Disclosure | httpOnly + secure + sameSite='lax' |
| Open redirect after OAuth | Elevation of Privilege | FRONTEND_URL 화이트리스트 검증 |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: 전체 auth 모듈 직접 읽고 분석 (strategies, guards, controller, service, frontend callback)
- callbackURL 불일치: `grep -r "callbackURL\|CALLBACK_URL"` 결과로 코드 vs 라우트 비교 [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)
- SameSite cookie behavior with OAuth: MDN Web Docs Set-Cookie/SameSite [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite]
- NestJS Passport Guard handleRequest pattern: NestJS 공식 문서 [CITED: docs.nestjs.com/recipes/passport]

### Tertiary (LOW confidence)
- Playwright OAuth 자동화 제한: 일반적인 OAuth 테스트 패턴 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Bug analysis: HIGH - 코드 직접 분석으로 callbackURL 불일치 확인
- Architecture patterns: HIGH - 기존 코드베이스 패턴 기반
- Pitfalls: MEDIUM - SameSite 이슈는 환경 의존적, E2E 제한은 가정

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (안정적인 도메인, 30일)
