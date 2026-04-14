---
phase: 09-tech-debt
reviewed: 2026-04-14T16:45:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - .env.example
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - .gitignore
  - apps/api/package.json
  - apps/api/src/main.ts
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.module.ts
  - apps/api/src/modules/auth/auth.service.spec.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/email/email.module.ts
  - apps/api/src/modules/auth/email/email.service.spec.ts
  - apps/api/src/modules/auth/email/email.service.ts
  - apps/api/src/modules/auth/email/templates/password-reset.tsx
  - apps/api/tsconfig.json
  - apps/web/components/admin/admin-booking-detail-modal.tsx
  - apps/web/components/auth/signup-step2.tsx
  - apps/web/components/booking/booking-page.tsx
  - apps/web/components/legal/legal-draft-banner.tsx
  - apps/web/components/legal/terms-markdown.tsx
  - apps/web/components/ui/sonner.tsx
  - apps/web/content/legal/marketing-consent.md
  - apps/web/content/legal/privacy-policy.md
  - apps/web/content/legal/terms-of-service.md
  - apps/web/e2e/fixtures/booking-store.ts
  - apps/web/e2e/helpers/auth.ts
  - apps/web/e2e/toss-payment.spec.ts
  - apps/web/env.d.ts
  - apps/web/hooks/use-booking.ts
  - apps/web/lib/format-datetime.test.ts
  - apps/web/lib/format-datetime.ts
  - apps/web/next.config.ts
  - apps/web/package.json
  - apps/web/playwright.config.ts
  - apps/web/stores/use-booking-store.ts
  - package.json
findings:
  critical: 1
  warning: 7
  info: 9
  total: 17
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-14T16:45:00Z
**Depth:** standard
**Files Reviewed:** 34 (35 listed — `.env.example` denied by permission sandbox; skipped)
**Status:** issues_found

## Summary

Phase 9(기술 부채 해소) 변경분을 표준 깊이로 검토했다. 전반적으로 코드 품질은 양호하며, 특히 `EmailService`의 프로덕션 하드페일(RESEND_API_KEY/RESEND_FROM_EMAIL), `auth.service.ts`의 password-hash 포함 JWT secret을 통한 one-time token 보장, REVIEW-DRIVEN 리팩터링(REVIEWS.md HIGH-01/02/04) 흔적이 명확하다.

다만 다음 영역에서 개선이 필요하다.

1. **Critical 1건:** `resetPassword`가 JWT `sub`를 **signature 검증 없이** 파싱하여 곧바로 `userRepository.findById(sub)`에 사용한다. `sub` 값이 UUID라는 보장이 전혀 없고, 악의적 바디를 가진 위조 토큰으로 DB 쿼리 예외/정보 누출을 유발할 수 있다.
2. **Warning 7건:** (a) `bootstrap()` 최상위 Promise가 `.catch` 미부착이라 NestJS 초기화 예외가 조용히 사라짐, (b) 소셜 가입 사용자(`passwordHash === null`)도 `requestPasswordReset`이 진행되어 패스워드 계정 전환 위험, (c) `auth.module.ts`가 `ConfigModule.forFeature(authConfig)` 또는 전역 config를 주입하지 않아 `auth.jwtSecret` 네임스페이스 접근이 `AppModule`의 글로벌 설정에만 의존, (d) `next.config.ts`의 `allowedDevOrigins`에 개발자 사설 IP/ngrok 도메인 하드코딩, (e) `deploy.yml`의 Cloud Run URL과 Cloud SQL Proxy `sleep 3` 하드코딩/races, (f) `main.ts` CORS 동작의 복수 origin 처리 시 CORS spec 위반 소지, (g) `signup-step2.tsx` dialog key typing을 `string`으로 느슨하게 선언.
3. **Info 9건:** 테스트 파일 `as any` 패턴, JWT payload 타입 narrow 부재, 매직 넘버(`19456`, `MAX_SEATS`, 7-day ms), `formatDateTime` 비UTC 타임존 의존 테스트 등.

v1 범위 밖의 성능 이슈는 제외했다. 법률 MD 문서(`terms-of-service.md` 등)는 `LegalDraftBanner`가 명시적으로 초안임을 알리고 있어 Info 선에서 법적 정확성 체크리스트(09-02-LEGAL-ACCURACY-CHECKLIST.md)를 참조할 것을 권고한다.

---

## Critical Issues

### CR-01: `resetPassword` unverified JWT sub lookup allows DB query injection via forged token

**File:** `apps/api/src/modules/auth/auth.service.ts:243-259`

**Issue:**
`resetPassword`는 JWT 서명을 **검증하기 전에** payload에서 `sub`를 뽑아 `this.userRepository.findById(sub)`를 호출한다. 공격자가 임의의 base64url-encoded payload를 가진 토큰을 보내면:

```ts
// Line 247-250
const rawPayload = JSON.parse(
  Buffer.from(token.split('.')[1]!, 'base64url').toString(),
) as { sub: string };
sub = rawPayload.sub;
// Line 256
const user = await this.userRepository.findById(sub);
```

- `sub`이 UUID가 아니어도(예: `"'; DROP TABLE users--"`, `"12345"`, `"nested.object"`) 파싱만 성공하면 DB 레이어까지 전달된다.
- Drizzle는 parameterized query로 SQL injection은 막지만 PostgreSQL은 UUID 컬럼에 부적합한 값이 들어오면 `22P02 invalid input syntax for type uuid` 예외를 던진다. 이 예외가 `HttpExceptionFilter`를 뚫고 500 Internal Server Error로 회귀하면 scanner에게 코드 경로/DB 에러 문자열을 노출한다.
- 더 중요한 공격: 매우 긴 `sub`(수 MB)를 넣으면 Node.js의 `JSON.parse` + `Buffer.from` + DB 쿼리가 메모리/레이턴시 증폭기가 되어 payload-amplification DoS가 성립한다.

또한 `token.split('.')[1]!`에서 non-null 어서션은 dot이 없는 문자열(`"random"`)에 대해 `undefined`를 단언 후 `Buffer.from(undefined, 'base64url')`를 호출한다. 이는 `try/catch`로 잡히지만 **의도한 에러 경로가 아니다**. 파싱 실패와 서명 실패를 구분할 방법이 없다.

**Fix:**
JWT 서명을 먼저 검증하고, 검증된 `sub`로만 DB를 조회한다. `passwordHash` 기반 비밀번호 회전은 **2단계로 분리**: 먼저 `jwtSecret`만으로 서명 검증(sub 획득) → DB lookup → `jwtSecret + passwordHash` 재검증.

```ts
async resetPassword(token: string, newPassword: string): Promise<void> {
  // 1. Preliminary verify to extract sub safely (uses jwtSecret only).
  //    This catches forged/malformed tokens BEFORE any DB access.
  let preliminarySub: string;
  try {
    const jwtSecret = this.configService.get<string>('auth.jwtSecret')!;
    // Allow expired tokens here — we only need `sub` claim. Do NOT use
    // `ignoreExpiration: true` on the final verify.
    const decoded = await this.jwtService.verifyAsync<{ sub: string }>(
      token,
      { secret: jwtSecret, ignoreExpiration: true, complete: false },
    );
    if (typeof decoded.sub !== 'string' || !UUID_REGEX.test(decoded.sub)) {
      throw new Error('invalid sub');
    }
    preliminarySub = decoded.sub;
  } catch {
    throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
  }

  // 2. Lookup user AFTER sub is validated as UUID.
  const user = await this.userRepository.findById(preliminarySub);
  if (!user) {
    throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
  }

  // 3. Final verify with rotation-aware secret (jwtSecret + passwordHash).
  const fullSecret =
    this.configService.get<string>('auth.jwtSecret')! +
    (user.passwordHash ?? '');
  let payload: { sub: string; purpose: string };
  try {
    payload = await this.jwtService.verifyAsync(token, { secret: fullSecret });
  } catch {
    throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
  }
  if (payload.purpose !== 'password-reset') {
    throw new UnauthorizedException('유효하지 않은 재설정 토큰입니다');
  }
  // ... rest unchanged
}

// At module top:
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

**참고:** 기존 spec은 이 동작(partial-verify + full-verify)을 B4 케이스에서 이미 간접적으로 테스트 중이지만, 첫 단계 `jwtSecret`-only 검증이 누락돼 있어 test로 catch되지 않는다.

---

## Warnings

### WR-01: `bootstrap()` unhandled promise rejection silently crashes process

**File:** `apps/api/src/main.ts:61`

**Issue:**
`main.ts` 마지막 줄의 `bootstrap();`은 `.catch(...)`가 없다. NestJS 초기화 중 발생하는 모든 에러(DB 연결 실패, Redis 연결 실패, helmet 세팅 오류 등)가 unhandled promise rejection으로 끝난다. Node.js 22에서는 `--unhandled-rejections=throw` 기본 정책상 프로세스가 종료되지만, 에러 로그가 Cloud Run stdout으로 올라가는 형태가 보장되지 않는다(특히 `instrument.js`/Sentry 초기화 전에 rejection이 발생하면 Sentry도 캡처 못함).

**Fix:**
```ts
bootstrap().catch((err) => {
  // Use raw console.error — Logger may not be ready yet.
  console.error('[bootstrap] Fatal startup error:', err);
  process.exit(1);
});
```

### WR-02: `requestPasswordReset` dispatches reset email for social-only accounts (passwordHash === null)

**File:** `apps/api/src/modules/auth/auth.service.ts:219-241`

**Issue:**
소셜 로그인 전용 계정은 `passwordHash === null`이다. `requestPasswordReset`은:
- Line 223-225: `user`가 없으면 조용히 return (enumeration prevention, OK)
- Line 228-229: `secret = jwtSecret + (user.passwordHash ?? '')` — passwordHash가 null이면 secret은 단순히 `jwtSecret`
- Line 231-234: 리셋 토큰 서명, 이메일 발송 진행

즉 소셜 전용 유저에게도 리셋 링크가 날아가고, 유저가 링크를 열어 새 비밀번호를 입력하면 `resetPassword`가 성공해 `passwordHash`가 설정된다. 의도치 않은 **소셜 전용 → 비밀번호 계정 전환**이 일어난다. 또한 첫 리셋 시점에는 rotation entropy(`passwordHash`)가 빈 문자열이라 서명 회전이 사실상 `jwtSecret`만의 함수가 된다(one-time token 불변조건 약화).

**Fix:**
`user.passwordHash === null`인 경우 조용히 return(소셜 전용 계정은 비밀번호 리셋을 허용하지 않음), 또는 `passwordHash`가 없으면 사용자 공급 에러 메시지 없이 email enumeration만 방지한 채 return:

```ts
async requestPasswordReset(email: string): Promise<void> {
  const user = await this.userRepository.findByEmail(email);

  // Silently return if user not found OR social-only account
  // (no password to reset).
  if (!user || !user.passwordHash) {
    return;
  }
  // ... existing logic
}
```

단, 소셜 전용 유저에게 "이 계정은 카카오/네이버/구글로 로그인됩니다"라는 **별도** UX가 필요하다면, frontend에서 이를 명시적으로 안내해야 한다(현재 flow에서 enumeration을 피하려면 silent return이 최선).

### WR-03: `AuthModule` does not register `authConfig` → relies on global `AppModule` ordering

**File:** `apps/api/src/modules/auth/auth.module.ts:22-31`

**Issue:**
`auth.module.ts`는 `config.get<string>('auth.jwtSecret')`로 `auth` 네임스페이스에 접근한다. 하지만 해당 `@Module({})` 데코레이터 어디에도 `ConfigModule.forFeature(authConfig)`가 없다. `auth.config.ts`에 `registerAs('auth', ...)`가 정의돼 있으므로 **AppModule이 `ConfigModule.forRoot({ load: [authConfig], isGlobal: true })` 같은 형태로 전역 등록해야만** 동작한다. 모듈 독립성/테스트성(이 모듈만 isolate 로드 시 secret이 undefined)이 깨진다.

`auth.service.spec.ts`도 `mockConfigService.get`으로 우회 중이라 회귀를 못 잡는다.

**Fix:**
```ts
import { authConfig } from '../../config/auth.config.js';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    // ... rest
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret'),
        // ...
      }),
    }),
  ],
  // ...
})
export class AuthModule {}
```

AppModule이 이미 전역 등록하고 있다면 이 수정은 불필요하지만, 코드의 "Module == 자급자족 단위" 규약을 유지하려면 명시적으로 선언하는 것이 낫다. 최소한 review로 AppModule 등록 상태를 한 번 확인 필요.

### WR-04: `next.config.ts` `allowedDevOrigins` hardcodes developer-specific hostnames

**File:** `apps/web/next.config.ts:30`

**Issue:**
```ts
allowedDevOrigins: ['192.168.0.78', 'craig-paravail-yee.ngrok-free.dev'],
```

- `192.168.0.78`: 특정 개발자의 로컬 네트워크 IP
- `craig-paravail-yee.ngrok-free.dev`: 특정 ngrok 터널 URL (임시 domain, revoke시 다른 개발자는 사용 불가)

`allowedDevOrigins`는 dev-only(프로덕션 빌드에는 영향 없음)이므로 보안 위험은 없지만 **협업 품질 저하** — 다른 개발자가 체크아웃하면 자신의 ngrok/LAN IP 정보를 매번 수동 수정해야 한다.

**Fix:**
환경 변수 기반으로 전환:
```ts
const devOriginsEnv = process.env['NEXT_DEV_ALLOWED_ORIGINS'] ?? '';
const allowedDevOrigins = devOriginsEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // ...
};
```

또는 `.env.local`에서 `NEXT_DEV_ALLOWED_ORIGINS=192.168.0.78,craig-paravail-yee.ngrok-free.dev`로 분리.

### WR-05: `deploy.yml` hardcodes Cloud Run URLs and uses brittle `sleep 3` for Cloud SQL Proxy

**File:** `.github/workflows/deploy.yml:46-47, 87-89, 132-133`

**Issue:**
1. **하드코딩된 Cloud Run URL** (Line 87-89, 132-133): `grapit-api-d3c6wrfdbq-du.a.run.app`, `grapit-web-d3c6wrfdbq-du.a.run.app`가 deploy.yml 안에 박혀 있다. Cloud Run 서비스 ID는 첫 배포 후 변경 불가이지만, 프로젝트 이전/리전 변경 시 전역 검색/치환이 필요하다. 또한 PR 환경/staging 환경을 추가할 때 yml 복제가 필요해진다.
2. **Cloud SQL Proxy `sleep 3`** (Line 46): 프록시 시작을 단순히 3초 대기하는 방식이라 네트워크 변동/runner 부하 시 migration 단계에서 race가 발생할 수 있다. `drizzle-kit migrate`는 실패를 반환하지만 startup race의 진단 로그가 부족하다.

**Fix:**
1. Cloud Run URL을 GitHub environment secrets/variables로 추출:
```yaml
env_vars: |
  NODE_ENV=production
  FRONTEND_URL=${{ vars.CLOUD_RUN_WEB_URL }}
  KAKAO_CALLBACK_URL=${{ vars.CLOUD_RUN_API_URL }}/api/v1/auth/social/kakao/callback
  # ...
```

2. Cloud SQL Proxy readiness check(retry with timeout):
```yaml
- name: Start Cloud SQL Auth Proxy
  run: |
    curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.linux.amd64
    chmod +x cloud-sql-proxy
    ./cloud-sql-proxy ${{ secrets.CLOUD_SQL_CONNECTION_NAME }} --port=5432 &
    # Wait for proxy to accept connections (max 30s)
    for i in {1..30}; do
      if nc -z localhost 5432; then
        echo "Cloud SQL Proxy ready."
        exit 0
      fi
      sleep 1
    done
    echo "Cloud SQL Proxy failed to start within 30s" && exit 1
```

### WR-06: `main.ts` CORS `origin` becomes array-or-string; cookie handling unclear for multiple origins

**File:** `apps/api/src/main.ts:39-44`

**Issue:**
```ts
app.enableCors({
  origin: process.env['FRONTEND_URL']
    ? process.env['FRONTEND_URL'].split(',').map((o) => o.trim())
    : 'http://localhost:3000',
  credentials: true,
});
```

- `FRONTEND_URL`이 `"https://a.com,https://b.com"`이면 CORS `origin`은 `['https://a.com', 'https://b.com']`로 설정된다. 이는 express-cors에서는 허용되지만, **Cloud Run의 cookie `sameSite: 'none'` + `credentials: true`** 조합 시 각 origin마다 올바르게 `Access-Control-Allow-Origin`을 echo해야 한다. Express CORS 미들웨어는 배열 형태를 매 요청마다 정확히 echo하므로 기능은 작동하지만, `.split(',')`이 빈 문자열을 처리하지 않는다(`FRONTEND_URL=""`이면 `['']` → 모든 origin이 차단되며 원인 파악이 어렵다).
- Dev fallback `'http://localhost:3000'`과 prod array의 혼재는 디버깅을 어렵게 한다.

**Fix:**
빈 값 필터링 + 명확한 type:
```ts
const rawFrontend = process.env['FRONTEND_URL']?.trim() ?? '';
const origins = rawFrontend
  ? rawFrontend.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000'];

app.enableCors({
  origin: origins,
  credentials: true,
});
```
(`enableCors({ origin: string[] })`는 `origin: string[]`만 허용하므로 dev 기본값도 array로 통일.)

또한 production에서 `FRONTEND_URL`이 반드시 https여야 하는 `bootstrap` validation은 Line 19에 있지만, **`.split(',')` 결과 각 origin이 https인지 검사하지 않는다**. 여러 origin 허용 시 일부가 http면 mixed-content 전환이 조용히 허용되므로 각 origin 검증이 더 엄격해야 한다.

### WR-07: `signup-step2.tsx` `dialogKey` typed as `string` loses key type safety

**File:** `apps/web/components/auth/signup-step2.tsx:44, 179-185`

**Issue:**
```ts
const [dialogKey, setDialogKey] = useState<string>('termsOfService');
// ...
<DialogTitle>{LEGAL_CONTENT[dialogKey]?.title}</DialogTitle>
<TermsMarkdown>{LEGAL_CONTENT[dialogKey]?.content ?? ''}</TermsMarkdown>
```

`dialogKey`는 `string`으로 선언돼 있어 `LEGAL_CONTENT`의 key가 아닌 임의 값이 들어갈 수 있다. 현재 코드 흐름상 `handleViewTerms(key: string)`를 통해서만 호출되므로 런타임 문제는 없지만, TypeScript가 `optional chaining`을 강요하는 원인이 된다. CLAUDE.md의 **"Strict typing everywhere — no any, no untyped variables"** 규칙 위반 소지.

**Fix:**
```ts
type LegalKey = keyof typeof LEGAL_CONTENT;
const [dialogKey, setDialogKey] = useState<LegalKey>('termsOfService');

function handleViewTerms(key: LegalKey) {
  setDialogKey(key);
  setDialogOpen(true);
}
```
`LEGAL_CONTENT[dialogKey]`는 `undefined`가 될 수 없으므로 옵셔널 체이닝 제거 가능.

---

## Info

### IN-01: Test files use `as any` for DI mock injection

**File:** `apps/api/src/modules/auth/auth.service.spec.ts:147-150`

**Issue:**
CLAUDE.md가 `"no any, no untyped variables"`를 선언했지만 spec에서는 `mockUserRepo as any`, `mockDb as any` 등 4군데 사용. 테스트 파일에서는 실용적이나 공식 규약 위반. 유사 패턴이 reservation/payment/booking/admin spec에도 존재.

**Fix:**
DI 타겟별로 얕은 Partial mock 타입을 도입:
```ts
type UserRepoMock = Pick<UserRepository, 'findByEmail' | 'findById' | 'create' | 'updatePassword'>;
const mockUserRepo = { ... } satisfies UserRepoMock;
// new AuthService(..., mockUserRepo as UserRepository, ...)
```
또는 최소한 `as unknown as UserRepository`로 `any` 우회. 테스트 코드 전반의 일관성 문제이므로 별도 정리 작업 권장.

### IN-02: JWT payload types lack strict validation

**File:** `apps/api/src/modules/auth/auth.service.ts:247-250, 268-271, 380-382`

**Issue:**
`JSON.parse(...)`로 얻은 payload를 `as { sub: string }`로 단순 단언. 런타임에 실제 `sub` 타입이 string인지 확인하지 않는다. 마찬가지로 `verifyAsync`의 반환 타입도 generic으로만 지정돼 있다. JWT 서명은 통과해도 payload 구조가 예상과 다를 수 있다.

**Fix:**
zod 스키마로 payload 검증:
```ts
import { z } from 'zod';
const resetPayloadSchema = z.object({
  sub: z.string().uuid(),
  purpose: z.literal('password-reset'),
});
const payload = resetPayloadSchema.parse(await this.jwtService.verifyAsync(token, { secret }));
```

### IN-03: Magic numbers — argon2 params, refresh expiry ms, max seats

**Files:** `apps/api/src/modules/auth/auth.service.ts:79-82, 189-191, 486-488`; `apps/web/components/booking/booking-page.tsx:29`

**Issue:**
- `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` — 3번 중복(register, resetPassword, test). argon2 파라미터가 바뀌면 모든 곳을 동기화해야 한다.
- `REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000` — `ms-per-day`가 매번 재계산. 상수화 권장.
- `apps/web/components/booking/booking-page.tsx:29`의 `MAX_SEATS = 4`는 toast 메시지의 `'최대 4석까지 선택할 수 있습니다'`와 분리돼 있어 `MAX_SEATS`만 바꾸면 문구 mismatch.

**Fix:**
```ts
// shared constants
export const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

// Usage
`최대 ${MAX_SEATS}석까지 선택할 수 있습니다. 다른 좌석을 먼저 해제해주세요.`
```

### IN-04: `formatDateTime` test is timezone-dependent but claims "YYYY.MM.DD HH:mm"

**File:** `apps/web/lib/format-datetime.test.ts:13-18`

**Issue:**
```ts
it('formats a valid ISO date string to YYYY.MM.DD HH:mm', () => {
  const result = formatDateTime('2026-04-14T14:23:00Z');
  expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/);
  expect(result).toContain('2026.');
});
```

테스트가 UTC 입력을 로컬 타임존으로 출력하면서 `2026.`만 포함 검증(날짜가 앞뒤로 점프 가능). 예: 서버가 UTC-12에서 실행되면 `2026-04-14T14:23:00Z`의 로컬 시간은 `2026-04-14T02:23` 또는 `2026-04-13T02:23`일 수 있어 `2026.`은 맞지만 월/일이 불분명하다. CI runner 시간대에 따라 intermittent 하지 않더라도 의도가 모호하다.

**Fix:**
`process.env.TZ = 'Asia/Seoul'` 또는 `vi.useFakeTimers({ toFake: ['Date'] })` + 명시적 input/output로 테스트:
```ts
const originalTZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Seoul'; });
afterAll(() => { process.env.TZ = originalTZ; });

it('formats UTC 14:23 to KST 23:23', () => {
  expect(formatDateTime('2026-04-14T14:23:00Z')).toBe('2026.04.14 23:23');
});
```

### IN-05: React version mismatch in API — package.json pins `react ^19.2.4` for templates

**File:** `apps/api/package.json:46, 68`

**Issue:**
API 패키지는 `react: ^19.2.4` + `@types/react: ^19.2.14`를 설치한다(React Email 렌더링용). 하지만 CLAUDE.md는 **"Do not independently pin React"** 방침을 Next.js 플랫폼에만 적용한다. API 쪽은 `@react-email/components`가 peer dep으로 react를 요구하므로 pin은 필요하다. 다만 **`peerDependencies`로 선언하는 것이 더 올바르다** (`dependencies`로 두면 monorepo의 web 워크스페이스와 버전 drift 발생 시 `hoist` 문제 발생 가능).

**Fix:** 현재 설치로 기능은 동작하므로 긴급하지 않음. 향후 React 버전 up 시 web/api 동시 갱신 룰을 README/CONTRIBUTING에 명시 권장.

### IN-06: `auth.service.ts` step numbering comments are inconsistent

**File:** `apps/api/src/modules/auth/auth.service.ts:280, 288`

**Issue:**
`resetPassword` 내부 주석이 다음과 같이 중복된 번호로 재시작:
```ts
// 3. Verify JWT with the full secret (jwtSecret + passwordHash)  <- line 261
// ... 
// 2. Hash new password    <- line 280 (should be 4)
// 3. Update password      <- line 288 (should be 5)
// 4. Revoke all refresh tokens  <- line 291 (should be 6)
```

**Fix:** 주석 번호 정리만 하면 됨. 동작엔 영향 없음.

### IN-07: `legal-draft-banner.tsx` hardcodes `#8B6306` color instead of using token

**File:** `apps/web/components/legal/legal-draft-banner.tsx:20`

**Issue:**
주석에 `globals.css에 text-warning-foreground 전용 토큰이 없어 하드코딩된 dark ocher 유지`라고 명시돼 있어 의도적이나, 향후 디자인 토큰 정리 시 업데이트 대상. 현재는 의도적 trade-off이므로 정상.

**Fix:**
globals.css에 `--color-warning-foreground: #8B6306;` 토큰 추가 + Tailwind utility(`text-warning-foreground`) 확장. 동일한 하드코딩 색은 `warning` 계열 UI를 추가할 때마다 재등장할 가능성이 있음.

### IN-08: `toss-payment.spec.ts` UI regression tests share duplicated fixture setup

**File:** `apps/web/e2e/toss-payment.spec.ts:121-164`

**Issue:**
Scenario 2/3(`UI regression: cancel` / `decline`)이 동일한 `injectBookingFixture` 호출을 복제한다. Test 유지보수 시 여러 곳을 갱신해야 한다.

**Fix:** `test.beforeEach`에서 `loginAsTestUser` + `injectBookingFixture`를 공통화:
```ts
test.describe('Toss Payments E2E — UI regression only', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await injectBookingFixture(page, DEFAULT_FIXTURE);
  });
  // 각 테스트는 goto + assertion만 담당
});
```

### IN-09: `use-booking-store.ts` dev-only fixture hook may leak if `NODE_ENV` check fails at runtime

**File:** `apps/web/stores/use-booking-store.ts:123-153`

**Issue:**
```ts
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  queueMicrotask(() => { /* reads __BOOKING_FIXTURE__ */ });
}
```

주석은 "Turbopack이 빌드 타임에 `NODE_ENV` 치환으로 prod에서 트리-셰이킹"이라고 설명한다. 이는 Next.js 표준 동작이지만:
- Turbopack production 빌드에서 dead-code-elimination이 `if (false) { ... }` 블록까지 완전 제거한다는 보장을 docs에서 명시적으로 확인해야 한다.
- `queueMicrotask` 콜백은 클로저에 `__BOOKING_FIXTURE__` 접근 로직을 유지하므로, 컴파일러가 블록 전체를 제거하지 않으면 `window.__BOOKING_FIXTURE__` 읽기 코드가 prod 번들에 남는다(공격자가 `window.__BOOKING_FIXTURE__ = ...`를 세팅해서 booking state 조작 가능).

**Fix:**
방어 심층화: `if` 블록을 빌드 타임 상수로 명시적으로 감싼다:
```ts
const __DEV_FIXTURE_ENABLED = process.env.NODE_ENV === 'development';
if (__DEV_FIXTURE_ENABLED && typeof window !== 'undefined') { /* ... */ }
```
그리고 `pnpm --filter @grapit/web build`로 생성된 번들에서 `__BOOKING_FIXTURE__` 문자열이 제거됐는지 grep으로 회귀 확인(CI에 추가하면 이상적).

---

_Reviewed: 2026-04-14T16:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
