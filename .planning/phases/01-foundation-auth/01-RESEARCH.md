# Phase 1: Foundation + Auth - Research

**Researched:** 2026-03-27
**Domain:** Monorepo scaffolding, authentication (email + social OAuth), JWT session management, PostgreSQL schema, Next.js 16 + NestJS 11 integration
**Confidence:** HIGH

## Summary

Phase 1은 프로젝트의 기반을 구축한다. pnpm workspace + Turborepo 기반 모노레포 안에 Next.js 16 프론트엔드(apps/web)와 NestJS 11 백엔드(apps/api), 공유 타입/스키마 패키지(packages/shared)를 배치한다. 인증 시스템은 이메일/비밀번호 가입 + 카카오/네이버/구글 소셜 로그인을 지원하며, JWT Access Token(15분) + httpOnly Cookie Refresh Token(7일, Rotation 방식)으로 세션을 유지한다.

DB는 Drizzle ORM + PostgreSQL로, users/social_accounts/refresh_tokens 테이블을 정의한다. 프론트엔드는 shadcn/ui 컴포넌트 + Pretendard 폰트 + Tailwind CSS 4로 구성하며, react-hook-form + zod로 폼 검증을 처리한다. SMS 인증은 Twilio Verify API를 사용하고, 비밀번호 재설정은 이메일 링크 방식으로 구현한다.

**Primary recommendation:** pnpm workspace + Turborepo 모노레포를 먼저 구성하고, Drizzle 스키마 + NestJS auth 모듈을 완성한 뒤, Next.js 페이지를 연결하는 순서로 진행한다. 개발 환경 DB는 Docker PostgreSQL을 사용한다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 가입 플로우는 이메일/비밀번호 or 소셜 로그인 -> 약관 동의 -> 추가 정보 입력 순서
- **D-02:** 약관 동의 3개: 이용약관(필수) + 개인정보처리방침(필수) + 마케팅 수신동의(선택). 전체동의 체크박스 포함
- **D-03:** 추가 정보 필수 입력: 이름, 성별, 국가, 생년월일, 전화번호(SMS 인증)
- **D-04:** 소셜 로그인(카카오/네이버/구글) 최초 가입 시에도 일반 회원가입과 동일하게 약관 동의 + 추가 정보 입력 필수
- **D-05:** 전화번호 인증은 SMS 인증코드 6자리 발송 + 검증 플로우로 구현 (NHN Cloud 또는 Twilio 연동)
- **D-06:** 로그인/회원가입은 통합 페이지(/auth)에서 탭 전환 방식. 소셜 로그인 버튼은 이메일 폼 아래 "또는" 구분선 하단에 배치
- **D-07:** 회원가입은 3단계 스텝: Step 1(이메일/비밀번호) -> Step 2(약관 동의) -> Step 3(추가 정보 + SMS 인증) -> 완료
- **D-08:** 로그인 실패 시 인라인 에러 메시지 (입력 필드 아래 빨간 텍스트). "이메일 또는 비밀번호가 일치하지 않습니다"
- **D-09:** 비밀번호 찾기 기능 Phase 1에 포함. 이메일 입력 -> 비밀번호 재설정 링크/임시 비밀번호 발송
- **D-10:** GNB는 풀 구조로 구현: 로고 + 장르 탭(placeholder, 비활성) + 검색바(placeholder) + 로그인/프로필 버튼
- **D-11:** 홈 페이지는 빈 상태 + CTA: 브랜드 로고 + "곧 다양한 공연이 찾아옵니다" + 로그인 유도
- **D-12:** 마이페이지 기본 구조: 프로필 정보 확인/수정 + 로그아웃 버튼
- **D-13:** 푸터에 이용약관, 개인정보처리방침 링크 포함
- **D-14:** Primary: #6C3CE0 (딥 퍼플), Secondary: #FF6B35 (오렌지), Accent: #00D4AA (티어 그린)
- **D-15:** Neutral: Gray-900 #1A1A2E, Gray-100 #F5F5F7, White #FFFFFF
- **D-16:** Semantic: Success #22C55E, Error #EF4444, Warning #FFB41B, Info #6C3CE0
- **D-17:** 폰트: Pretendard (Next.js localFont으로 셀프 호스팅)
- **D-18:** 좌석 등급별 색상은 Phase 3에서 결정

### Claude's Discretion
- 프로젝트 모노레포 구조 (apps/web, apps/api, packages/shared 등)
- SMS API 제공사 선택 (NHN Cloud vs Twilio -- 비용/편의성 기준)
- 비밀번호 재설정 방식 (임시 비밀번호 vs 재설정 링크)
- 비밀번호 유효성 검증 규칙 (최소 길이, 특수문자 등)
- 로딩/전환 애니메이션 세부 사항

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | 사용자가 이메일/비밀번호로 회원가입할 수 있다 | Drizzle users 스키마, argon2 해싱, zod validation, NestJS auth module, 3-step signup flow |
| AUTH-02 | 사용자가 이메일/비밀번호로 로그인할 수 있다 | passport-local strategy, JWT 발급, httpOnly cookie refresh token |
| AUTH-03 | 사용자가 카카오 소셜 로그인으로 가입/로그인할 수 있다 | passport-kakao v1.0.1, OAuth 2.0 code flow, social_accounts 테이블 |
| AUTH-04 | 사용자가 네이버 소셜 로그인으로 가입/로그인할 수 있다 | passport-naver-v2 v2.0.8, 동일 OAuth 패턴 |
| AUTH-05 | 사용자가 구글 소셜 로그인으로 가입/로그인할 수 있다 | passport-google-oauth20 v2.0.0, 동일 OAuth 패턴 |
| AUTH-06 | 로그인 세션이 브라우저 새로고침 후에도 유지된다 | JWT Access Token(메모리) + Refresh Token(httpOnly Cookie, 7일) + Rotation |
| AUTH-07 | 사용자가 로그아웃할 수 있다 | Refresh Token 삭제 (DB + Cookie clear), Access Token 클라이언트 제거 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- ES modules (import/export) 사용, CommonJS(require) 금지
- 함수형 패턴 선호, 클래스는 외부 인터페이스용에만
- Strict typing -- `any` 금지, 모든 변수에 타입
- 변경 후 typecheck 실행
- 변경 후 lint 실행, lint 에러 반드시 수정
- 비즈니스 로직/API 코드는 테스트 먼저 작성 (TDD)
- 변경 후 기존 테스트 실행하여 regression 확인
- Co-Authored-By 트레일러 금지
- Conventional commits (feat:, fix:, test:, refactor:, docs:)
- 한국어 응답

## Standard Stack

### Core (Phase 1 Scope)

| Library | Verified Version | Purpose | Registry Date |
|---------|-----------------|---------|---------------|
| next | 16.2.1 | SSR/SSG framework | current |
| react | 19.x (Next.js bundled) | UI library | current |
| @nestjs/core | 11.1.17 | API framework | current |
| @nestjs/cli | 11.0.16 | NestJS scaffolding/build | current |
| drizzle-orm | 0.45.1 | Database ORM | current |
| drizzle-kit | 0.31.10 | DB migrations CLI | current |
| pg | 8.20.0 | PostgreSQL driver | current |
| typescript | 6.0.2 | Type system | current |
| tailwindcss | 4.2.2 | Utility CSS | current |
| turbo | 2.8.20 | Monorepo task runner | current |
| pnpm | 10.28.1 (installed) | Package manager | current |

**NOTE on TypeScript:** npm registry shows 6.0.2 as latest. CLAUDE.md specifies 5.9.x. TypeScript 6.0 was released -- verify compatibility with NestJS 11 and Next.js 16. If stable, use 6.0.x; otherwise pin 5.9.x. Recommendation: use TypeScript 5.9.x as specified in CLAUDE.md stack until NestJS/Next.js officially document TS 6 support. Confidence: MEDIUM.

### Auth Libraries

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| @nestjs/jwt | 11.0.2 | JWT token sign/verify |
| @nestjs/passport | 11.0.5 | Passport integration module |
| passport | 0.7.0 | Auth middleware |
| passport-local | 1.0.0 | Email/password strategy |
| passport-jwt | 4.0.1 | JWT strategy (for AuthGuard) |
| passport-kakao | 1.0.1 | Kakao OAuth 2.0 |
| passport-naver-v2 | 2.0.8 | Naver OAuth 2.0 |
| passport-google-oauth20 | 2.0.0 | Google OAuth 2.0 |
| @types/passport-google-oauth20 | 2.0.17 | Google strategy types |
| @types/passport-kakao | 1.0.3 | Kakao strategy types |
| argon2 | 0.44.0 | Password hashing (OWASP recommended) |
| cookie-parser | 1.4.7 | Parse httpOnly cookies in NestJS |
| @types/cookie-parser | 1.4.10 | Types for cookie-parser |

### Validation & Forms

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| zod | 4.3.6 | Schema validation (front + back) |
| drizzle-zod | 0.8.3 | Drizzle schema -> Zod schema bridge |
| react-hook-form | 7.72.0 | Form state management |
| @hookform/resolvers | 5.2.2 | Zod resolver for react-hook-form |

### State & Data

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| @tanstack/react-query | 5.95.2 | Server state (API calls) |
| zustand | 5.0.12 | Client state (auth session) |

### UI & Styling

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| shadcn/ui | CLI-based | Component primitives (Radix UI) |
| sonner | 2.0.7 | Toast notifications |
| lucide-react | (shadcn default) | Icons |

### Backend Infra

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| @nestjs/config | 4.0.3 | Environment config |
| @nestjs/terminus | 11.1.1 | Health check endpoint |
| @nestjs/throttler | 6.5.0 | Rate limiting |
| helmet | 8.1.0 | Security headers |
| nodemailer | 8.0.4 | Email sending (password reset) |

### Dev Dependencies

| Library | Verified Version | Purpose |
|---------|-----------------|---------|
| vitest | 4.1.2 | Test runner |
| @testing-library/react | 16.3.2 | Component testing |
| @nestjs/testing | 11.1.17 | NestJS integration testing |
| eslint | 10.1.0 | Linting |
| prettier | 3.8.1 | Formatting |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Twilio (SMS) | NHN Cloud Notification | NHN Cloud is cheaper for Korean numbers but English docs are sparse; Twilio has excellent DX, global support, Verify API built-in |
| nodemailer (email) | @nestjs-modules/mailer | Wrapper adds complexity; nodemailer direct is simpler for single password reset use case |
| passport-naver-v2 | passport-naver (official) | Official package not updated for 5+ years; v2 provides more comprehensive profile data |

**Recommendation on SMS provider:** Use **Twilio Verify API**. Rationale:
1. Built-in verification flow (send + verify code in 2 API calls)
2. Excellent Node.js SDK and documentation
3. Rate limiting and fraud detection included
4. Free trial credits available for development
5. NHN Cloud has cheaper per-SMS cost for Korean numbers (~8 won vs ~$0.05) but requires Korean business registration for production account, which aligns with project constraints anyway
6. For a 1-person dev team, Twilio's DX advantage outweighs NHN Cloud's cost advantage at MVP scale

**Recommendation on password reset:** Use **email reset link** (not temporary password). Rationale:
1. More secure -- temporary passwords can be intercepted in email and reused
2. Standard UX pattern users expect (D-09 lists both options)
3. Token-based: generate a signed URL with expiry (1 hour), user clicks and sets new password
4. Implementation: nodemailer + JWT-signed reset token

**Recommendation on password validation rules:**
- Minimum 8 characters (D-07 Step 1 already states this in UI-SPEC)
- Must contain: English letter + number + special character
- Must not match email
- Zod schema enforces on both frontend and backend

## Architecture Patterns

### Recommended Monorepo Structure

```
grapit/
├── apps/
│   ├── web/                    # Next.js 16 (App Router)
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout (Pretendard font, providers)
│   │   │   ├── page.tsx        # Home (empty state + CTA)
│   │   │   ├── auth/
│   │   │   │   └── page.tsx    # Login/Signup unified page
│   │   │   ├── auth/
│   │   │   │   └── reset-password/
│   │   │   │       └── page.tsx
│   │   │   └── mypage/
│   │   │       └── page.tsx    # Profile
│   │   ├── components/
│   │   │   ├── ui/             # shadcn components
│   │   │   ├── layout/         # GNB, Footer
│   │   │   └── auth/           # LoginForm, SignupForm, SocialLoginButton, etc.
│   │   ├── lib/
│   │   │   ├── api.ts          # API client (fetch wrapper)
│   │   │   └── auth.ts         # Auth helpers (token storage, refresh logic)
│   │   ├── stores/
│   │   │   └── useAuthStore.ts # Zustand auth state
│   │   ├── public/
│   │   │   ├── fonts/          # PretendardVariable.woff2
│   │   │   └── icons/          # Kakao/Naver/Google SVG logos
│   │   ├── next.config.ts
│   │   ├── tailwind.css        # Tailwind v4 CSS-first config
│   │   └── package.json
│   └── api/                    # NestJS 11
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/
│       │   │   ├── guards/
│       │   │   │   ├── jwt-auth.guard.ts
│       │   │   │   └── roles.guard.ts
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   └── public.decorator.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   └── pipes/
│       │   │       └── zod-validation.pipe.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── local.strategy.ts
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   ├── kakao.strategy.ts
│       │   │   │   │   ├── naver.strategy.ts
│       │   │   │   │   └── google.strategy.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── login.dto.ts
│       │   │   │   │   ├── register.dto.ts
│       │   │   │   │   └── reset-password.dto.ts
│       │   │   │   └── guards/
│       │   │   │       └── social-auth.guard.ts
│       │   │   ├── user/
│       │   │   │   ├── user.module.ts
│       │   │   │   ├── user.controller.ts
│       │   │   │   ├── user.service.ts
│       │   │   │   └── user.repository.ts
│       │   │   └── sms/
│       │   │       ├── sms.module.ts
│       │   │       └── sms.service.ts    # Twilio Verify integration
│       │   ├── database/
│       │   │   ├── drizzle.module.ts     # Global DB module
│       │   │   ├── drizzle.provider.ts   # pg.Pool + drizzle instance
│       │   │   ├── schema/
│       │   │   │   ├── index.ts
│       │   │   │   ├── users.ts
│       │   │   │   ├── social-accounts.ts
│       │   │   │   ├── refresh-tokens.ts
│       │   │   │   └── terms-agreements.ts
│       │   │   └── migrations/
│       │   └── config/
│       │       ├── database.config.ts
│       │       └── auth.config.ts
│       ├── drizzle.config.ts
│       ├── test/
│       └── package.json
├── packages/
│   └── shared/                 # Shared types + schemas
│       ├── src/
│       │   ├── schemas/        # Zod schemas (shared between frontend/backend)
│       │   │   ├── auth.schema.ts
│       │   │   └── user.schema.ts
│       │   ├── types/          # TypeScript types
│       │   │   ├── auth.types.ts
│       │   │   └── user.types.ts
│       │   └── constants/
│       │       └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                # Root (turbo, shared dev deps)
├── tsconfig.base.json          # Shared TS config
├── .env.example
├── docker-compose.yml          # Local PostgreSQL
└── .gitignore
```

### Pattern 1: Drizzle ORM NestJS Provider

**What:** Global DrizzleModule that provides the database instance to all NestJS modules.
**When to use:** Every module that needs DB access imports DrizzleModule.

```typescript
// apps/api/src/database/drizzle.provider.ts
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const pool = new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
    });
    return drizzle(pool, { schema });
  },
};

export type DrizzleDB = NodePgDatabase<typeof schema>;
```

```typescript
// apps/api/src/database/drizzle.module.ts
import { Global, Module } from '@nestjs/common';
import { drizzleProvider } from './drizzle.provider';

@Global()
@Module({
  providers: [drizzleProvider],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
```

### Pattern 2: Auth Schema (Drizzle)

**What:** Users table with social accounts and refresh tokens.
**When to use:** Phase 1 initial migration.

```typescript
// apps/api/src/database/schema/users.ts
import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['male', 'female', 'unspecified']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),  // null for social-only users
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  gender: genderEnum('gender').notNull(),
  country: varchar('country', { length: 100 }).notNull().default('KR'),
  birthDate: varchar('birth_date', { length: 10 }).notNull(),  // YYYY-MM-DD
  isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  role: varchar('role', { length: 20 }).notNull().default('user'),  // user | admin
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// apps/api/src/database/schema/social-accounts.ts
export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).notNull(),  // kakao | naver | google
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  providerEmail: varchar('provider_email', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// apps/api/src/database/schema/refresh-tokens.ts
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// apps/api/src/database/schema/terms-agreements.ts
export const termsAgreements = pgTable('terms_agreements', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  termsOfService: boolean('terms_of_service').notNull(),        // 이용약관 (필수)
  privacyPolicy: boolean('privacy_policy').notNull(),           // 개인정보처리방침 (필수)
  marketingConsent: boolean('marketing_consent').notNull(),      // 마케팅 (선택)
  agreedAt: timestamp('agreed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Pattern 3: JWT + Refresh Token Rotation

**What:** Access Token in memory (short-lived) + Refresh Token in httpOnly cookie (long-lived, rotated on use).
**When to use:** Every authenticated request.

```typescript
// Auth flow (conceptual):
// 1. Login -> Issue Access Token (15min) + Refresh Token (7d)
// 2. Access Token stored in Zustand (memory-only, lost on refresh)
// 3. Refresh Token stored in httpOnly, Secure, SameSite=Strict cookie
// 4. On page load / token expired -> POST /auth/refresh (cookie auto-sent)
// 5. Server validates refresh token, rotates it (old revoked, new issued)
// 6. Returns new Access Token + sets new Refresh Token cookie

// Frontend: Zustand auth store
// stores/useAuthStore.ts
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
  isAuthenticated: () => get().accessToken !== null,
}));
```

### Pattern 4: Social Login OAuth Flow

**What:** Redirect-based OAuth 2.0 code flow with NestJS Passport.
**When to use:** Kakao, Naver, Google login.

```
1. User clicks "카카오로 시작하기"
2. Frontend redirects to: GET /api/v1/auth/social/kakao
3. NestJS Passport redirects to Kakao OAuth consent page
4. User authorizes -> Kakao redirects back with code
5. NestJS callback route exchanges code for tokens
6. Strategy extracts profile (email, name, provider ID)
7. AuthService: find or create user + social_account link
8. If new user (no matching social_account):
   a. Create partial user record (pending additional info)
   b. Return "needs_registration" status + temporary token
   c. Frontend shows Step 2 (약관) -> Step 3 (추가 정보)
9. If existing user: issue JWT tokens, redirect to home
```

### Pattern 5: ZodValidationPipe (NestJS)

**What:** Custom NestJS pipe that validates DTOs using Zod schemas.
**When to use:** Every controller endpoint that accepts body/params.

```typescript
// apps/api/src/common/pipes/zod-validation.pipe.ts
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
```

### Anti-Patterns to Avoid

- **Access Token in localStorage:** XSS vulnerability. Store in memory (Zustand) only.
- **Refresh Token in localStorage:** Use httpOnly cookie instead. JavaScript cannot read httpOnly cookies.
- **class-validator decorators:** Project uses zod + drizzle-zod. Do NOT use class-validator/class-transformer.
- **TypeORM/Prisma:** Project uses Drizzle ORM exclusively. Do NOT install alternative ORMs.
- **JWT blacklist in Redis for Phase 1:** Overkill. Short-lived access tokens (15min) + refresh token rotation is sufficient. Redis is not a Phase 1 dependency.
- **Global JWT guard without @Public:** All routes would require auth by default. Mark public routes with @Public decorator + custom guard logic.
- **Hardcoded OAuth credentials:** Use @nestjs/config with environment variables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/scrypt wrapper | argon2 (argon2id variant) | Memory-hard, OWASP recommended, pre-configured |
| SMS verification | Custom OTP generation + sending | Twilio Verify API | Rate limiting, fraud detection, retry logic built-in |
| JWT token management | Custom JWT sign/verify | @nestjs/jwt + @nestjs/passport | Battle-tested, NestJS ecosystem integration |
| Form validation | Custom regex validators | zod schemas (shared) | Type inference, reusable front+back, error formatting |
| OAuth flow | Custom HTTP calls to OAuth providers | passport-kakao/naver-v2/google-oauth20 | Handles token exchange, profile parsing, error cases |
| Cookie parsing | Custom cookie parsing | cookie-parser middleware | Handles encoding, signed cookies, edge cases |
| Rate limiting | Custom middleware | @nestjs/throttler | Configurable per-route, storage adapters |
| Password reset tokens | Custom random string | JWT-signed token with expiry | Tamper-proof, self-contained expiry, verifiable |
| Form state | useState for each field | react-hook-form + @hookform/resolvers | Uncontrolled inputs, minimal re-renders, zod integration |

**Key insight:** 1인 개발 프로젝트에서 인증/보안 관련 코드를 직접 작성하면 취약점이 생긴다. 검증된 라이브러리를 조합하는 것이 안전하고 빠르다.

## Common Pitfalls

### Pitfall 1: Social Login + Additional Info Flow
**What goes wrong:** 소셜 로그인 후 추가 정보(D-04) 입력이 필요한데, OAuth callback 후 상태 관리가 복잡해진다.
**Why it happens:** OAuth는 redirect 기반이라 SPA 상태가 초기화된다. 소셜 로그인 성공 후 "추가 정보 필요" 상태를 어디에 저장할지 결정이 필요하다.
**How to avoid:** OAuth callback에서 임시 토큰(registration_token)을 발급하고, 프론트엔드에서 이 토큰으로 추가 정보 제출 시 최종 회원가입을 완료한다. DB에는 pending 상태의 user 레코드를 먼저 생성하지 말고, 소셜 프로필 정보를 registration_token의 payload에 포함시킨다.
**Warning signs:** 소셜 로그인 후 페이지 새로고침 시 추가 정보 입력 화면이 사라지는 현상.

### Pitfall 2: Refresh Token Rotation Race Condition
**What goes wrong:** 여러 탭/요청이 동시에 refresh token을 사용하면 하나만 성공하고 나머지는 실패한다 (토큰이 이미 rotate됨).
**Why it happens:** Refresh Token Rotation은 사용 후 즉시 폐기하므로, 동시 요청 시 두 번째 요청의 토큰은 이미 revoked 상태.
**How to avoid:** Refresh token에 grace period (10-30초) 두기. 같은 tokenFamily 내에서 revoked 후 grace period 이내 요청은 새 토큰을 재발급한다. 또는 프론트엔드에서 refresh 요청을 queue에 넣어 한 번에 하나만 실행한다.
**Warning signs:** "Session expired" 에러가 간헐적으로 발생하며, 여러 탭을 열었을 때 재현됨.

### Pitfall 3: CORS Configuration Between Next.js and NestJS
**What goes wrong:** 개발 환경에서 Next.js(3000) -> NestJS(8080) 간 CORS 에러. 프로덕션에서 쿠키가 전송되지 않음.
**Why it happens:** httpOnly cookie 전송에는 `credentials: 'include'`와 서버의 `Access-Control-Allow-Credentials: true` + 정확한 origin(* 불가)이 필요.
**How to avoid:** 개발: NestJS에서 `app.enableCors({ origin: 'http://localhost:3000', credentials: true })`. 프로덕션: 같은 도메인(api.grapit.com)이면 CORS 불필요. 또는 Next.js proxy.ts로 API 요청을 프록시.
**Warning signs:** 브라우저 콘솔에 CORS 에러, 쿠키가 Set-Cookie 응답에 있지만 다음 요청에 포함되지 않음.

### Pitfall 4: Drizzle Schema vs Architecture Document Schema Mismatch
**What goes wrong:** docs/03-ARCHITECTURE.md의 ERD users 테이블 필드와 실제 구현 스키마가 다름.
**Why it happens:** Architecture 문서는 전체 프로젝트용이고 Phase 1에 필요한 필드가 모두 포함되어 있지 않다 (예: gender, country, birth_date 등 D-03 필드).
**How to avoid:** CONTEXT.md의 D-03 결정을 기준으로 users 테이블을 확장한다. Architecture 문서의 기본 필드에 Phase 1 추가 정보 필드를 합친다.
**Warning signs:** 회원가입 Step 3에서 필드가 DB에 없어서 에러 발생.

### Pitfall 5: argon2 Native Binding Build Failure
**What goes wrong:** argon2는 native C 바인딩이 필요하여 일부 환경에서 설치 실패.
**Why it happens:** macOS에서 Xcode Command Line Tools 미설치, Docker Alpine 이미지에서 build-essential 미포함.
**How to avoid:** 개발: `xcode-select --install` 확인. Docker: multi-stage build에서 build 단계에 `apk add --no-cache python3 make g++` 포함. CI: node:22-slim 이미지에 build-essential 설치.
**Warning signs:** `npm install` 시 `node-gyp rebuild` 에러.

### Pitfall 6: Next.js App Router + Client-Side Auth State
**What goes wrong:** Server Component에서 auth 상태에 접근하려 하면 Zustand store가 undefined.
**Why it happens:** Zustand은 클라이언트 전용이므로 Server Component에서 접근 불가. Auth 관련 UI는 Client Component여야 한다.
**How to avoid:** Auth 상태를 사용하는 컴포넌트는 반드시 `'use client'` 선언. 서버에서 인증 확인이 필요하면 cookie/header를 직접 읽는다. 레이아웃의 GNB는 Client Component로 분리.
**Warning signs:** "hydration mismatch" 에러, 서버 렌더링에서 항상 "로그인" 상태로 표시.

## Code Examples

### docker-compose.yml (Local PostgreSQL)

```yaml
# docker-compose.yml (project root)
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: grapit
      POSTGRES_USER: grapit
      POSTGRES_PASSWORD: grapit_dev
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Shared Zod Schemas

```typescript
// packages/shared/src/schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다')
  .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
  .regex(/[0-9]/, '숫자를 포함해야 합니다')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, '특수문자를 포함해야 합니다');

export const registerStep1Schema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요'),
  password: passwordSchema,
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
});

export const registerStep2Schema = z.object({
  termsOfService: z.literal(true, { errorMap: () => ({ message: '이용약관에 동의해주세요' }) }),
  privacyPolicy: z.literal(true, { errorMap: () => ({ message: '개인정보처리방침에 동의해주세요' }) }),
  marketingConsent: z.boolean(),
});

export const registerStep3Schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50),
  gender: z.enum(['male', 'female', 'unspecified']),
  country: z.string().min(1, '국가를 선택해주세요'),
  birthYear: z.string().regex(/^\d{4}$/, '올바른 연도를 입력해주세요'),
  birthMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, '올바른 월을 입력해주세요'),
  birthDay: z.string().regex(/^(0[1-9]|[12]\d|3[01])$/, '올바른 일을 입력해주세요'),
  phone: z.string().regex(/^01[016789]-?\d{3,4}-?\d{4}$/, '올바른 전화번호를 입력해주세요'),
  phoneVerificationCode: z.string().length(6, '인증번호 6자리를 입력해주세요'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterStep1Input = z.infer<typeof registerStep1Schema>;
export type RegisterStep2Input = z.infer<typeof registerStep2Schema>;
export type RegisterStep3Input = z.infer<typeof registerStep3Schema>;
```

### NestJS Auth Controller (Skeleton)

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Res, Get, UseGuards, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const oldToken = req.cookies?.refreshToken;
    const result = await this.authService.refreshTokens(oldToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    await this.authService.revokeRefreshToken(token);
    res.clearCookie('refreshToken');
    return { message: 'Logged out' };
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      path: '/api/v1/auth',  // Only sent to auth endpoints
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| class-validator DTOs | zod + drizzle-zod schemas | 2024-2025 | Single source of truth, front+back sharing |
| TypeORM decorators | Drizzle ORM code-first schema | 2024-2025 | SQL-first, tiny bundle, faster cold start |
| express-session (cookie sessions) | JWT + httpOnly Cookie Refresh | Standard | Stateless, scalable across instances |
| bcrypt password hashing | argon2id | OWASP 2024+ | Memory-hard, GPU/ASIC resistant |
| Tailwind CSS v3 (JS config) | Tailwind CSS v4 (CSS-first) | 2025 | No JS config file, 5x faster builds |
| Next.js middleware (proxy) | Next.js 16 proxy.ts | 2025 | Cleaner API proxying without middleware overhead |
| passport-naver (official) | passport-naver-v2 | 2020+ | More profile fields, actively maintained |
| Jest | Vitest | 2024+ | ESM-native, faster, TypeScript-first |

**Deprecated/outdated:**
- `@tosspayments/sdk`: Deprecated. Use `@tosspayments/tosspayments-sdk` (Phase 4)
- `passport-naver` (original): Not updated for 5+ years. Use `passport-naver-v2`
- Tailwind CSS v3 JS config: v4 uses CSS-first config
- `jest`: Use `vitest` for new projects

## Open Questions

1. **TypeScript 6.0 vs 5.9**
   - What we know: npm shows TS 6.0.2 as latest. CLAUDE.md specifies 5.9.x.
   - What's unclear: NestJS 11 and Next.js 16 official TS 6.0 support status.
   - Recommendation: Pin TypeScript 5.9.x per CLAUDE.md stack specification. Upgrade to 6.0 only after verifying framework compatibility. This is a low-risk decision that can be changed later.

2. **Social Login Callback URL Design**
   - What we know: OAuth requires callback URLs. Architecture doc shows `POST /auth/social/:provider`.
   - What's unclear: Whether to handle the OAuth redirect entirely server-side (NestJS redirect) or use a split flow (frontend initiates -> backend callback -> redirect to frontend).
   - Recommendation: Full server-side flow. NestJS handles redirect to provider and callback. On callback success, redirect to frontend with token in URL query (one-time code). Frontend exchanges code for JWT. This avoids CORS issues with OAuth redirects.

3. **Twilio Account for SMS**
   - What we know: Twilio Verify API is recommended.
   - What's unclear: Whether the developer has a Twilio account or needs to create one.
   - Recommendation: Use Twilio free trial for development. Provide mock SMS service for testing (env flag to skip actual SMS in dev/test). Production requires Twilio account upgrade.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes (higher) | 24.13.0 (installed) vs 22.x (target) | Use nvm/mise to install Node 22 LTS |
| pnpm | Monorepo | Yes | 10.28.1 | -- |
| Docker | Local PostgreSQL | Yes | 29.1.3 | Install PostgreSQL directly |
| PostgreSQL client (psql) | DB management | No | -- | Use Docker exec or pgAdmin |
| Git | Version control | Yes | 2.53.0 | -- |
| Turborepo | Monorepo tasks | No (global) | -- | Install via pnpm add turbo -Dw |

**NOTE on Node.js version:** System has Node.js 24.13.0 installed. CLAUDE.md specifies 22.22.x LTS. Node 24 may cause compatibility issues with NestJS 11 or some native modules (argon2). Recommendation: Use mise/nvm to install Node 22 LTS for this project. Add `.node-version` or `.nvmrc` file to project root.

**Missing dependencies with no fallback:**
- None (all core tools available)

**Missing dependencies with fallback:**
- PostgreSQL client (psql) -- use Docker exec: `docker exec -it grapit-postgres psql -U grapit`
- Node.js version mismatch -- use mise (already installed) to set Node 22 LTS

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | None -- Wave 0 must create vitest configs for both apps/web and apps/api |
| Quick run command | `pnpm --filter api test -- --run` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Email/password signup (3-step) | integration | `pnpm --filter api test -- --run src/modules/auth/auth.service.spec.ts` | Wave 0 |
| AUTH-02 | Email/password login | integration | `pnpm --filter api test -- --run src/modules/auth/auth.service.spec.ts` | Wave 0 |
| AUTH-03 | Kakao social login | integration | `pnpm --filter api test -- --run src/modules/auth/strategies/kakao.strategy.spec.ts` | Wave 0 |
| AUTH-04 | Naver social login | integration | `pnpm --filter api test -- --run src/modules/auth/strategies/naver.strategy.spec.ts` | Wave 0 |
| AUTH-05 | Google social login | integration | `pnpm --filter api test -- --run src/modules/auth/strategies/google.strategy.spec.ts` | Wave 0 |
| AUTH-06 | Session persistence (JWT + refresh) | integration | `pnpm --filter api test -- --run src/modules/auth/auth.service.spec.ts` | Wave 0 |
| AUTH-07 | Logout (token revocation) | integration | `pnpm --filter api test -- --run src/modules/auth/auth.service.spec.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter api test -- --run`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps

- [ ] `apps/api/vitest.config.ts` -- Vitest config for NestJS backend
- [ ] `apps/web/vitest.config.ts` -- Vitest config for Next.js frontend
- [ ] `apps/api/src/modules/auth/auth.service.spec.ts` -- Auth service tests (AUTH-01, AUTH-02, AUTH-06, AUTH-07)
- [ ] `apps/api/src/modules/auth/strategies/*.spec.ts` -- OAuth strategy tests (AUTH-03, AUTH-04, AUTH-05)
- [ ] `apps/api/test/setup.ts` -- Test setup (mock DB, test helpers)
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8` in both apps
- [ ] `packages/shared/vitest.config.ts` -- Shared schema validation tests

## Sources

### Primary (HIGH confidence)
- docs/03-ARCHITECTURE.md -- Auth flow (3.3), DB schema (4.1), module structure (3.1), API endpoints (3.2)
- docs/04-UIUX-GUIDE.md -- Design tokens, component patterns, layout structure
- .planning/phases/01-foundation-auth/01-UI-SPEC.md -- shadcn components, page contracts, color system
- CLAUDE.md Technology Stack -- Full stack specification with versions and alternatives
- npm registry -- All package versions verified via `npm view` (2026-03-27)

### Secondary (MEDIUM confidence)
- [Trilon: NestJS + DrizzleORM](https://trilon.io/blog/nestjs-drizzleorm-a-great-match) -- Provider pattern
- [DEV: Refresh Token Rotation NestJS](https://dev.to/zenstok/how-to-implement-refresh-tokens-with-token-rotation-in-nestjs-1deg) -- Token rotation implementation
- [DEV: Refresh Token httpOnly Cookie NestJS+React](https://dev.to/zenstok/part-33-how-to-implement-refresh-tokens-through-http-only-cookie-in-nestjs-and-react-265e) -- Cookie-based refresh pattern
- [NestJS Passport Docs](https://docs.nestjs.com/recipes/passport) -- Official Passport integration guide
- [passport-naver-v2 npm](https://www.npmjs.com/package/passport-naver-v2) -- Naver OAuth strategy
- [passport-kakao npm](https://www.npmjs.com/package/passport-kakao) -- Kakao OAuth strategy
- [Drizzle ORM PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg) -- Schema definition
- [Next.js 16 proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) -- API proxy configuration
- [pnpm Workspaces](https://pnpm.io/workspaces) -- Monorepo configuration
- [Turborepo Next.js Guide](https://turborepo.dev/docs/guides/frameworks/nextjs) -- Monorepo task setup

### Tertiary (LOW confidence)
- SMS pricing comparison -- NHN Cloud specific pricing not verified from official source
- TypeScript 6.0 NestJS/Next.js compatibility -- Not officially documented yet

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All versions verified against npm registry, architecture doc alignment confirmed
- Architecture: HIGH -- Based on project architecture doc + established monorepo patterns
- Pitfalls: HIGH -- Based on known issues with JWT rotation, OAuth flows, and Drizzle+NestJS integration
- SMS provider: MEDIUM -- Twilio recommendation is well-reasoned but NHN Cloud pricing unverified

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days -- stack is stable)
