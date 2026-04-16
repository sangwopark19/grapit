# Phase 10: SMS 인증 실연동 - Research

**Researched:** 2026-04-16
**Domain:** Infobip 2FA SMS OTP + NestJS 11 ThrottlerStorage + Valkey/ioredis 재사용
**Confidence:** HIGH (Infobip 외부 SDK 선택, 패키지 호환성, 코드 통합 지점 모두 1차 소스로 검증됨)

## Summary

Phase 10은 Twilio Verify mock 골격을 Infobip 2FA PIN API 실연동으로 교체하면서, Phase 7에서 도입된 ioredis(`REDIS_CLIENT`) 단일 클라이언트를 (a) `@nest-lab/throttler-storage-redis@1.2.0`의 ThrottlerStorage 백엔드로, (b) 30s 재발송 쿨다운 키 저장소로 동시에 재사용한다. CONTEXT.md의 D-01~D-25는 그대로 유효하며, 본 RESEARCH는 7개의 미해결 기술 결정을 채운다:

1. **`@infobip-api/sdk` 미채택, 순수 fetch 채택** — 공식 Node SDK는 v0.3.2(2023-11-23) 이후 31개월 무릴리스, axios v1 의존, 2FA 모듈 README 미문서화. 4개 HTTP 호출(send PIN/verify PIN/+ optional health)을 native fetch로 직접 작성하면 ~80LOC 미만, axios 트랜지티브 의존 0, NestJS 11 + Node 22 native fetch와 자연스럽게 정합.
2. **`@nest-lab/throttler-storage-redis@1.2.0` 채택** — `peerDependencies` 명시적으로 `@nestjs/throttler >=6.0.0`, `@nestjs/common ^11.0.0`, `ioredis >=5.0.0` 지원. 대안 `nestjs-throttler-storage-redis@0.5.1`은 NestJS 10까지만 명시(11 미포함). `BOOKING_REDIS` 심볼은 존재하지 않고 실제 export는 `REDIS_CLIENT` (`apps/api/src/modules/booking/providers/redis.provider.ts:5`).
3. **libphonenumber-js/min (~80KB metadata) 백엔드만** — 프론트는 prefix 매칭으로 충분(번들 절약). 백엔드는 `parsePhoneNumberWithError` + `country === 'CN'` 분기로 +86 차단을 신뢰성 있게 수행.
4. **Valkey 키 스키마** — `sms:resend:{e164}` (TTL 30s, SET NX), `sms:pin:{e164}` (TTL 200s = PIN 180s + 20s 여유, value=pinId). pinId 클라이언트 노출 금지 → 응답 shape 불변.
5. **Infobip 콘솔 사전 구성** — Application + Message Template은 운영자가 콘솔에서 1회 생성하고 ID를 env로 주입(D-16). 코드에서 동적 생성 안 함.
6. **`SmsService` 응답 계약 불변** — `verifyCode(phone, code) → { verified: boolean; message?: string }`이 `auth.service.ts:71`에서 destructure됨. 변경 시 register/social-register 양쪽 회귀 발생.
7. **Sentry 패턴은 `import * as Sentry from '@sentry/nestjs'` + `Sentry.captureException()`** — 이미 `http-exception.filter.ts:7,19`에 정착된 패턴. 추가 setup 불필요. tag 주입은 `Sentry.withScope`로 phone country/provider 부착.

**Primary recommendation:** SmsService를 단일 `InfobipClient` 헬퍼(80LOC 내외 fetch wrapper) + `SmsService` 본체(쿨다운/Redis/dev mock 분기 ~150LOC)로 분리. 응답 계약 불변, dev mock 경로 유지(`000000` 유니버설 코드), production hard-fail 4-env 검증.

## Project Constraints (from CLAUDE.md)

> 본 phase 실행 시 반드시 준수해야 할 프로젝트 규칙. 위반 시 PR 거부 사유.

- **ES modules only** — `import/export`, `require()` 금지. 신규 파일 모두 `.js` 확장자 import (NodeNext)
- **Strict TypeScript** — `any` 금지, 모든 변수 타입 명시. fetch 응답은 `unknown` 받고 zod로 narrow하거나 explicit interface 캐스팅
- **Functional patterns 우선** — 클래스는 NestJS DI 인터페이스(SmsService, InfobipClient)에만 사용
- **Quality gates** — `pnpm --filter @grapit/api typecheck`, `pnpm --filter @grapit/api lint`, `pnpm --filter @grapit/api test`, `pnpm --filter @grapit/web typecheck`, `pnpm --filter @grapit/web lint`, `pnpm --filter @grapit/web test`, `pnpm --filter @grapit/web test:e2e` 전부 green 후 commit
- **Lint 정책** — 변경한 파일의 lint warning은 모두 수정. 기존 파일의 warning은 건드리지 않음
- **Pre-commit hooks 우회 금지** — `--no-verify` 사용 금지
- **Test before implementation** — SmsService 신규 메서드는 spec 먼저 작성
- **Conventional commits** — `feat(10-sms-XX)`, `refactor(10-sms-XX)`, `test(10-sms-XX)`. Co-Authored-By 트레일러 절대 추가 금지
- **Korean response language** — 사용자 향 문구는 한국어. 단 Infobip API 호출 코드 주석은 영어 OK (외부 API 명세 인용)
- **GSD workflow enforcement** — `/gsd:execute-phase`로 진입한 후에만 Edit/Write 도구 사용
- **환경변수** — 모노레포 루트 `/.env`만 사용. `apps/api/.env` 만들지 말 것. `INFOBIP_*` 4종 추가 시 `.env.example`도 함께 업데이트
- **Stack 강제** — Drizzle ORM(TypeORM/Prisma 금지), zod(class-validator 금지), vitest(Jest 금지), ioredis 단일 클라이언트(@upstash/redis 절대 추가 금지 — Phase 7에서 제거 완료)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SMS 프로바이더 (D-01 ~ D-04)**
- D-01: 프로바이더 = **Infobip 2FA API** (PIN API로 OTP 생성·검증·만료·재시도 서버 위임). 한국 도달률 최강(Kakao 사례), 태국·SEA 직결, 건당 ~35원
- D-02: 기존 Twilio 자산 전면 교체 — `apps/api/src/modules/sms/sms.service.ts` 재작성, `twilio` npm 의존성 제거, `TWILIO_*` env 삭제
- D-03: 중국 본토(+86) → `400 Bad Request` + 메시지 `"현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요"`
- D-04: 한국 발신번호 사전등록(KISA)은 Infobip 콘솔에서 운영자 수동 — 코드 범위 외, 운영 체크리스트로 기록

**Rate Limiting (D-05 ~ D-09)**
- D-05: 축 = IP + phone 조합 (OR 평가 — 둘 중 먼저 임계치 도달 시 차단)
- D-06: `/sms/send-code` = phone 5/시간 ⊕ IP 20/시간
- D-07: `/sms/verify-code` = phone 10회/15분
- D-08: Throttler storage = Valkey 공유 (`@nest-lab/throttler-storage-redis` + Phase 7 ioredis 재사용)
- D-09: 기존 password-reset throttler(`auth.controller.ts:120,133`)도 함께 Valkey storage로 이전

**OTP 정책 (D-10 ~ D-13)**
- D-10: PIN lifetime = 180초. Infobip Application `pinTimeToLive=3m`. `SMS_CODE_EXPIRY_SECONDS=180` 상수 불변
- D-11: 재발송 쿨다운 = 30초. Valkey 키 `sms:resend:{phone}` TTL 30s, SET NX 실패 시 429 + retryAfter
- D-12: 검증 실패 최대 = 5회. Infobip Application `pinAttempts=5`. 초과 시 PIN 즉시 무효화
- D-13: PIN 길이 = 6자리 숫자. Infobip Application `pinLength=6`, `pinType=NUMERIC`

**크리덴셜 (D-14 ~ D-17)**
- D-14: Production hard-fail — `NODE_ENV==='production'`이면서 `INFOBIP_API_KEY` 부재 시 `SmsService` 생성자 throw
- D-15: Dev/test mock — `NODE_ENV !== 'production' && !INFOBIP_API_KEY`일 때만. `000000` 유니버설 코드 non-production에서만 수락
- D-16: 필수 env 4종 — `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID`. 하나라도 비면 production hard-fail
- D-17: GCP Secret Manager + GitHub Actions secrets — `TWILIO_*` 4건 제거, `INFOBIP_*` 4건 추가

**프론트 UX (D-18 ~ D-20)**
- D-18: 재발송 버튼 = disabled + 카운트다운 라벨 (`재발송 (28s)`). 만료 타이머(3분)와 독립된 30s 타이머
- D-19: 시도 횟수 남은 회수 UI 노출 금지 (공격자 어포던스 방지)
- D-20: 에러 분기 — 429 → "잠시 후 다시 시도해주세요" / 410·422 → "인증번호가 만료되었습니다. 재발송해주세요" / 400 → "인증번호가 일치하지 않습니다"

**관측 (D-21 ~ D-23)**
- D-21: Sentry tag — `country`, `provider`, `http_status`, `infobip_code`. captureException level=error
- D-22: Cloud Run 구조화 로그 — `sms.sent`, `sms.verified`, `sms.rate_limited`, `sms.credential_missing`
- D-23: 단가/볼륨 메트릭은 Infobip 대시보드 의존. 자체 Prometheus 미구축

**E2E (D-24 ~ D-25)**
- D-24: CI Playwright = `NODE_ENV=test` + `INFOBIP_API_KEY` 미주입 → mock 모드 자동 진입. `000000` 유니버설 코드 활용
- D-25: 실 발송 스모크 = staging 수동. CI 실발송 절대 금지

### Claude's Discretion (이 RESEARCH가 채움)

- Infobip Node 클라이언트: 공식 SDK vs fetch → **fetch 채택** (Standard Stack 표 참조)
- `@nest-lab/throttler-storage-redis` 버전/호환성 → **v1.2.0 확정** (NestJS 11 명시 지원)
- password-reset throttler Valkey 이전을 별도 commit으로 분리 → **planner 권장: ThrottlerModule 전환을 단일 commit으로 묶음** (storage 변경은 전역, throttler 정책 옮김은 자동)
- 에러 메시지 정확 문구 → UI-SPEC.md §"Copywriting Contract" 확정 (D-20 기반)
- 재발송 쿨다운 Valkey 키 스키마 → `sms:resend:{e164}` TTL 30s + `sms:pin:{e164}` TTL 200s (Architecture Patterns §"Valkey Key Schema" 참조)
- 국가 코드 감지 → 백엔드 `libphonenumber-js/min` (강견고) + 프론트 prefix 매칭 (번들 절약)

### Deferred Ideas (OUT OF SCOPE)

- 중국 본토(+86) SMS fallback (중국 법인/ICP, email/voice OTP) → 별도 phase
- email OTP 다채널 fallback (Resend 재사용, Phase 9 인프라 활용)
- Silent Authentication / flashcall (Infobip 지원하지만 현재 필요성 낮음)
- 자체 Prometheus SMS 메트릭 (트래픽 증가 후)
- 푸시 알림 fallback (앱 출시 이후)
- 다중 SMS 프로바이더 fallback (PROJECT.md out-of-scope)
- 로그인 시 SMS 재인증 (PROJECT.md out-of-scope)
- PASS 본인인증 연동 (PROJECT.md out-of-scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SMS-01** | SMS 발송 rate limiting 구현 (phone/IP 기준) | Architecture §"Rate Limiting Wiring" — `@nest-lab/throttler-storage-redis@1.2.0` + `@Throttle({ default: { limit, ttl } })` v6 object signature. Send: phone 5/h ⊕ IP 20/h. Verify: phone 10/15min. Storage: Valkey via 기존 `REDIS_CLIENT`. |
| **SMS-02** | SMS 프로바이더 실 연동 (OTP 발송/검증) | Standard Stack — Infobip 2FA PIN API via native fetch. Don't Hand-Roll §"OTP State Management" — Infobip가 PIN/만료/재시도 위임. Code Examples §"Send PIN" / §"Verify PIN". |
| **SMS-03** | 프로덕션/개발 환경 자동 전환 유지 | Common Pitfalls §"Silent dev fallback in production" + Code Examples §"Hard-fail constructor" — Phase 7 `redis.provider.ts` 패턴 복제. dev mock은 `NODE_ENV !== 'production' && !INFOBIP_API_KEY`. |
| **SMS-04** | OTP 재시도 제한 및 만료 처리 | Infobip Application 설정 (§"Infobip Console Setup"): `pinAttempts=5`, `pinTimeToLive=3m`, `pinLength=6`, `pinType=NUMERIC`. 클라이언트 측 응답 매핑 §"Verify response mapping". |
</phase_requirements>

## Standard Stack

### Core Additions

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nest-lab/throttler-storage-redis` | 1.2.0 | Distributed throttler storage | [VERIFIED: npm view 2026-02-03 publish] peerDeps `@nestjs/common ^11`, `@nestjs/throttler >=6`, `ioredis >=5` — 정확히 본 프로젝트 매트릭스. 작성자 jmcdo29(NestJS 코어 컨트리뷰터)가 nest-lab monorepo로 유지. 1.2.0(2026-02-03) = 최근 7주 내 active maintenance |
| `libphonenumber-js` | 1.12.41 | E.164 정규화 + 국가 감지 (백엔드만) | [VERIFIED: npm view] Phase 10에서 +86 신뢰성 있게 차단하려면 국가 코드 prefix 매칭만으로 부족(예: +1242 바하마, +1264 앵귈라 모두 +1 시작). `parsePhoneNumberWithError(phone).country === 'CN'`로 판정. `libphonenumber-js/min` import로 metadata 80KB만 로드 |

### Removed

| Library | Version | Reason |
|---------|---------|--------|
| `twilio` | 5.13.1 | D-02 — Infobip 전환에 따라 전면 제거. `apps/api/package.json` dependency drop. lockfile 정리 필요 |

### Not Added (Considered, Rejected)

| Library | Version | Why Rejected |
|---------|---------|--------------|
| `@infobip-api/sdk` | 0.3.2 | [VERIFIED: npm view 2023-11-23 last publish] 31개월 무릴리스 — Infobip가 community 저장소(infobip-community/infobip-api-node-sdk)로 분리하고 사실상 추가 개발 정지. 2FA 모듈은 README 미문서화. 추가 의존성: axios ^1.6.0 + form-data ^4.0.0 — Node 22 native fetch와 중복. Cloud Run cold start +200ms 추정(axios 번들 ~50KB) |
| `nestjs-throttler-storage-redis` | 0.5.1 | [VERIFIED: npm view] peerDeps `@nestjs/common ^7..^10` — NestJS 11 미명시. 일부 사용자가 11에서 동작 보고하나 공식 미지원. 동일 범주에서 더 active한 `@nest-lab/throttler-storage-redis` 우선 |
| `axios` | 1.x | Node 22 native fetch로 동일 작업 가능. 트랜지티브 의존 0 추구 |
| `ky` / `got` | - | fetch wrapper 가치가 6개월래 줄어듦. Node 22 fetch + AbortSignal.timeout으로 충분 |

### Installation

```bash
# 백엔드 (apps/api)
pnpm --filter @grapit/api add @nest-lab/throttler-storage-redis@^1.2.0 libphonenumber-js@^1.12.41
pnpm --filter @grapit/api remove twilio

# 프론트엔드 (apps/web) — UI-SPEC §"의존성 추가" 권장 사항. planner 재량
pnpm --filter @grapit/web add libphonenumber-js@^1.12.41
```

**Version verification (2026-04-16):**
- `@nest-lab/throttler-storage-redis@1.2.0` — published 2026-02-03 [VERIFIED: npm view]
- `libphonenumber-js@1.12.41` — published 2026 [VERIFIED: npm view]
- `@infobip-api/sdk@0.3.2` — published 2023-11-23 (31 months stale) [VERIFIED: npm view]
- `nestjs-throttler-storage-redis@0.5.1` — peerDeps cap NestJS 10 [VERIFIED: npm view]

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/modules/sms/
├── sms.controller.ts          # 기존 + @Throttle 데코레이터 추가
├── sms.module.ts              # imports: [BookingModule] (REDIS_CLIENT 재사용)
├── sms.service.ts             # 재작성 — InfobipClient 호출 + Valkey 쿨다운 + dev mock
├── sms.service.spec.ts        # 재작성 — Infobip mock + Redis mock
├── infobip-client.ts          # NEW — fetch 기반 Infobip 2FA API wrapper (~80LOC)
├── infobip-client.spec.ts     # NEW — fetch mock 단위 테스트
└── phone.util.ts              # NEW — parseE164() + isChinaMainland() (libphonenumber-js)
```

### Pattern 1: SmsModule import BookingModule (REDIS_CLIENT 재사용)

**What:** Phase 7에서 `BookingModule`이 `redisProvider`(REDIS_CLIENT 심볼)를 export하고 있으므로(`booking.module.ts:16`), SmsModule이 BookingModule을 imports해서 동일 ioredis 인스턴스를 주입받는다.

**When to use:** 새 모듈에서 ioredis 클라이언트가 필요할 때. 별도 provider를 만들면 Cloud Run 인스턴스당 connection이 2개로 늘어나 Memorystore 연결 한도(기본 1000) 압박.

**Example:**
```typescript
// apps/api/src/modules/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { SmsService } from './sms.service.js';
import { SmsController } from './sms.controller.js';

@Module({
  imports: [BookingModule],          // REDIS_CLIENT 재export 통해 주입 가능
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
```

```typescript
// apps/api/src/modules/sms/sms.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type IORedis from 'ioredis';
import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';

@Injectable()
export class SmsService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    // ConfigService, InfobipClient ...
  ) {}
}
```

> **Caveat — InMemoryRedis는 `set(key, value, { nx, ex })` opts 객체 시그니처를 지원하나 ioredis는 `set(key, value, 'PX', ms, 'NX')` 가변 인자 시그니처.** `redis.provider.ts:20`의 InMemoryRedis는 ioredis flat signature와 다른 형태 — Phase 10 코드는 ioredis 시그니처를 사용해야 production에서 동작하고, 기존 InMemoryRedis는 booking 모듈 전용이므로 sms 쿨다운 키 사용 시 mock 보강이 필요할 수 있다. **Planner 결정 사항:** dev mock에서는 Infobip mock 분기에서 쿨다운도 mock 처리(Redis 호출 자체 skip)하면 InMemoryRedis 시그니처 갈등 회피.

### Pattern 2: ThrottlerModule.forRootAsync with Valkey storage

**What:** 기존 `ThrottlerModule.forRoot([{ ttl, limit }])` (`app.module.ts:29`)를 forRootAsync로 변경하여 ConfigService + REDIS_CLIENT를 주입하고 storage에 `ThrottlerStorageRedisService` 인스턴스 전달.

**Example:**
```typescript
// apps/api/src/app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { REDIS_CLIENT } from './modules/booking/providers/redis.provider.js';
import type IORedis from 'ioredis';

ThrottlerModule.forRootAsync({
  imports: [BookingModule],
  inject: [REDIS_CLIENT],
  useFactory: (redis: IORedis) => ({
    throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
    storage: new ThrottlerStorageRedisService(redis),
  }),
}),
```

**Why this signature:** `@nest-lab/throttler-storage-redis@1.2.0` 생성자는 4가지 형태를 받는다 — `()` (localhost), `(url: string)`, `(redis: Redis)` (ioredis 인스턴스), `(cluster: Cluster)`. 인스턴스 주입은 [CITED: jmcdo29/nest-lab README via WebFetch 2026-04-16] `new ThrottlerStorageRedisService(new Redis())` 형태로 명시 지원.

**Caveat — InMemoryRedis 호환성:** `redis.provider.ts:20`의 InMemoryRedis는 `set/get/del/sadd/srem/smembers/scard/ttl/expire/eval`만 구현. `ThrottlerStorageRedisService`가 내부적으로 사용하는 Lua 스크립트(`INCR` + `EXPIRE`)는 InMemoryRedis에 미구현. **Planner 결정 사항:** local dev에서 REDIS_URL 미설정 시 throttler가 깨질 가능성 — InMemoryRedis에 `incr` + `expire` 메서드 추가하거나, throttler storage를 dev에서는 in-memory로 분기. 권장: REDIS_URL 없을 때 storage 옵션을 omit해서 default in-memory throttler로 fallback (production hard-fail은 redis.provider 자체에서 이미 처리).

### Pattern 3: Infobip fetch wrapper (no SDK)

**What:** 4개 API 호출(`POST /2fa/2/pin`, `POST /2fa/2/pin/{pinId}/verify`, optional `GET /2fa/2/pin/{pinId}`, optional `POST /2fa/2/applications`)을 native fetch로 직접 호출. Authorization header는 `App {API_KEY}` 형식 [CITED: infobip.com/docs/essentials/api-essentials/api-authentication via WebFetch].

**Example:**
```typescript
// apps/api/src/modules/sms/infobip-client.ts
export interface InfobipSendPinResponse {
  pinId: string;
  to: string;
  ncStatus?: string;
  smsStatus?: string;
}
export interface InfobipVerifyPinResponse {
  msisdn: string;
  verified: boolean;
  attemptsRemaining: number;
  pinError?: 'NO_ERROR' | 'WRONG_PIN' | 'PIN_EXPIRED' | 'NO_MORE_PIN_ATTEMPTS' | string;
}

export class InfobipClient {
  constructor(
    private readonly baseUrl: string,        // e.g. https://xxxxx.api.infobip.com
    private readonly apiKey: string,
    private readonly applicationId: string,
    private readonly messageId: string,
  ) {}

  async sendPin(toE164: string): Promise<InfobipSendPinResponse> {
    const res = await fetch(`${this.baseUrl}/2fa/2/pin`, {
      method: 'POST',
      headers: {
        Authorization: `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        applicationId: this.applicationId,
        messageId: this.messageId,
        from: 'Grapit',                      // Infobip Application sender
        to: toE164.replace(/^\+/, ''),       // Infobip는 leading + 없는 E.164
      }),
      signal: AbortSignal.timeout(5000),     // Cloud Run 5s budget
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InfobipApiError(res.status, body);
    }
    return res.json() as Promise<InfobipSendPinResponse>;
  }

  async verifyPin(pinId: string, pin: string): Promise<InfobipVerifyPinResponse> {
    const res = await fetch(`${this.baseUrl}/2fa/2/pin/${encodeURIComponent(pinId)}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ pin }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InfobipApiError(res.status, body);
    }
    return res.json() as Promise<InfobipVerifyPinResponse>;
  }
}

export class InfobipApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Infobip API ${status}: ${body}`);
  }
}
```

**Sources:**
- Endpoints: [CITED: infobip.com/docs/2fa-service/using-2fa-api via WebSearch 2026-04-16]
- Auth header: [CITED: infobip.com/docs/essentials/api-essentials/api-authentication via WebFetch 2026-04-16] — `Authorization: App {API_KEY}`
- Base URL: [CITED: infobip.com/docs/essentials/api-essentials/base-url via WebSearch] — `xxxxx.api.infobip.com` 계정별 subdomain
- Response shape: [ASSUMED based on Infobip Java/Go client `TfaPinResponse` / `TfaVerifyPinResponse` symbols] — `pinId`, `verified`, `attemptsRemaining`, `pinError` 필드명. **검증 필요:** 첫 staging 호출 시 실제 응답 JSON으로 zod schema fixture 확보 (Validation Architecture §"Wave 0" 참조)

### Pattern 4: Valkey Key Schema

| Key | TTL | Value | Set Mode | Purpose |
|-----|-----|-------|----------|---------|
| `sms:resend:{e164}` | 30s | `1` (sentinel) | `SET key 1 PX 30000 NX` | D-11 재발송 쿨다운. NX 실패 시 429 |
| `sms:pin:{e164}` | 200s | `{pinId}` | `SET key {pinId} PX 200000` | phone→pinId 매핑. PIN TTL(180s) + 클럭 스큐 여유(20s) |

**왜 200s:** Infobip이 PIN을 만료시킨 직후에도 백엔드가 phone→pinId를 알아야 attempts/expired 분기 가능. 200s 후 자연 만료되면 재발송 강제.

**E.164 정규화 후 키 사용:** 클라이언트가 `010-1234-5678`을 보낼 수도 `01012345678`을 보낼 수도 있으므로 `parseE164()` 후 키 생성. 한국 번호는 `+821012345678`로 통일.

### Pattern 5: Sentry tag 주입 (`Sentry.withScope`)

**What:** 기존 패턴(`http-exception.filter.ts:7,19`)은 단순 `Sentry.captureException(exception)`. Phase 10 SMS 전용 컨텍스트(country, provider, http_status, infobip_code) 주입은 `Sentry.withScope`로 한정 범위 tag 부착.

**Example:**
```typescript
import * as Sentry from '@sentry/nestjs';

Sentry.withScope((scope) => {
  scope.setTag('provider', 'infobip');
  scope.setTag('country', country ?? 'unknown');
  scope.setTag('http_status', String(err.status));
  if (err instanceof InfobipApiError) {
    scope.setTag('infobip_code', extractInfobipErrorCode(err.body));
  }
  scope.setLevel('error');
  Sentry.captureException(err);
});
```

### Anti-Patterns to Avoid

- **응답 shape 변경:** `verifyCode(phone, code) → { verified, message? }` 시그니처를 `auth.service.ts:71`이 destructure. pinId를 응답에 노출하면 register 호출부 + 프론트 둘 다 회귀. 서버 세션 저장 모델로 가야 함 (Pattern 4).
- **별도 ioredis 인스턴스 생성:** `new IORedis(url)`을 SmsService 안에서 만들면 Cloud Run 인스턴스당 connection 2배. 항상 `@Inject(REDIS_CLIENT)`로 공유.
- **send-code에서 verifyCode가 phone→pinId 조회 실패 시 묵묵히 false 반환:** "PIN 만료" vs "잘못된 코드" 분기 불가. `sms:pin:{e164}` 미존재 시 `expired` 분기로 410 응답해야 D-20 UX 분기 정확.
- **Throttler v6 string TTL:** 과거 v5는 `@Throttle({ ttl: 60, limit: 5 })` 초 단위. v6은 ms 단위 + named throttlers 객체 시그니처. password-reset(`auth.controller.ts:120`)이 이미 `{ default: { limit: 3, ttl: 900000 } }` 정정 완료 — SMS도 동일 형태.
- **국가 감지를 prefix 매칭으로:** `+86`만 보면 안전해 보이지만 `+8612345`로 사용자가 잘못 입력 시 +86 + 한국번호로 오인 가능. libphonenumber-js의 `parsePhoneNumberWithError` 사용해서 country 코드 정확히 추출.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OTP 생성·만료·재시도 lock | 자체 PIN 생성기 + Valkey TTL + 카운터 | Infobip Application config (`pinAttempts=5`, `pinTimeToLive=3m`, `pinLength=6`, `pinType=NUMERIC`) | Infobip이 generate-store-validate-expire-lock 5단계 위임. 자체 구현 시 race condition (TOCTOU on attempt counter), brute-force lock 정확도, 시계 동기화 모두 직접 책임 |
| 분산 rate limiter (Cloud Run 멀티 인스턴스) | 자체 Redis INCR + EXPIRE Lua | `@nest-lab/throttler-storage-redis` + `@Throttle` 데코레이터 | Lua 스크립트 sliding window 알고리즘 정확도(throttler 패키지가 내부 처리), `@Throttle` 데코레이터 통합, password-reset 패턴 일관성 |
| E.164 정규화 + 국가 감지 | 정규식 + prefix lookup table | `libphonenumber-js` `parsePhoneNumberWithError` | E.164는 이론상 단순하지만 실제 +1(NANP) 지역코드 분기, 한국 010/011 prefix 변경 이력, 국가별 길이 차이 등 엣지 케이스 풍부 |
| HTTP retry / timeout / circuit breaker for Infobip | 자체 Promise.race + setTimeout + 3xx 처리 | Native `fetch` + `AbortSignal.timeout(5000)` | NestJS 11 + Node 22에서 fetch 표준. Infobip이 5xx 반환 시 단순 throw → Sentry capture → 사용자 "일시적 오류" 메시지로 충분. retry 추가는 SLO 측정 후 결정 |
| 영역별 Sentry 클라이언트 또는 메트릭 라이브러리 | Prometheus / OpenTelemetry / Datadog | 기존 `import * as Sentry from '@sentry/nestjs'` + 구조화 로그 (D-22, D-23) | 1인 개발 + Infobip 대시보드로 비용/볼륨 충분. 메트릭 인프라는 트래픽 증가 후 |

**Key insight:** Phase 10의 핵심은 "Infobip을 신뢰하는 것". 자체 OTP 로직 1줄도 추가하지 말고 phone↔pinId 매핑만 백엔드가 책임. 검증·만료·시도 횟수는 Infobip Application 설정으로 위임.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by grep `INFOBIP\|TWILIO`. SMS 코드는 DB 컬럼 없음(`schema/users.ts`에 phone, isPhoneVerified만 존재) | 데이터 마이그레이션 불필요 |
| Live service config | Infobip Console에 Application + Message Template **신규 생성 필요** (운영자 수동, D-04). Twilio Console에서 verify service 비활성/삭제 권장 | 운영 체크리스트 항목으로 별도 plan 또는 README 추가 |
| OS-registered state | None — 모든 SMS 호출은 NestJS 프로세스 내부 | 없음 |
| Secrets/env vars | `.env` (root) — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` 3개 제거. `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID` 4개 추가. GCP Secret Manager + GitHub Actions secrets 동일 변경 (D-17) | env 교체 / Cloud Run 환경변수 binding 갱신 |
| Build artifacts | None — `twilio` npm 패키지 제거 시 lockfile만 갱신, 빌드 산출물 별도 정리 불필요 | `pnpm install` 후 lockfile commit |

## Common Pitfalls

### Pitfall 1: Throttler @Throttle v6 시그니처 혼용

**What goes wrong:** `@Throttle({ limit: 5, ttl: 60 })` (v5 형태) 또는 `@Throttle({ default: { limit: 5, ttl: 60 } })` (TTL 초 단위) 작성 시 v6에서 default name 누락 또는 TTL ms 단위 mismatch로 throttle이 의도와 다르게 동작.

**Why it happens:** `@nestjs/throttler@6.0.0`부터 named throttlers (object signature) + TTL ms 단위로 변경. `auth.controller.ts:120`의 코멘트 `// v6 object signature, ttl = 900_000ms = 15min, NOT 900s`가 명시적으로 경고 중.

**How to avoid:** SMS 컨트롤러도 동일 패턴으로 작성:
```typescript
@Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })  // phone 5/시간
```
또는 named throttler로 IP/phone 별도 정의 (planner 재량 — 단일 default로 송수신 분리할지, ttl을 60_000 * 60으로 명시해 가독성 높일지).

**Warning signs:** 통합 테스트에서 limit이 1/3 또는 1/1000 정도로 어긋난 카운트로 동작. 또는 throttler가 작동하지 않음.

### Pitfall 2: Silent dev fallback이 production으로 흘러감

**What goes wrong:** `INFOBIP_API_KEY`가 production env 누락된 채 배포되면 SmsService가 dev mock 모드로 진입. `000000` 코드를 누구나 입력해도 verified=true → SMS 인증 우회로 가짜 phone으로 가입 가능.

**Why it happens:** `process.env.NODE_ENV`가 Cloud Run에서 자동 `production`이 아닐 수 있음 (deploy.yml에서 명시 주입 필요). 또는 `INFOBIP_API_KEY=""`(빈 문자열)이 falsy로 통과되면서 mock 진입.

**How to avoid:** Phase 7 `redis.provider.ts:225-231` 패턴 정확히 복제:
```typescript
constructor(/* ... */) {
  const apiKey = this.configService.get<string>('INFOBIP_API_KEY')?.trim();
  const baseUrl = this.configService.get<string>('INFOBIP_BASE_URL')?.trim();
  const applicationId = this.configService.get<string>('INFOBIP_APPLICATION_ID')?.trim();
  const messageId = this.configService.get<string>('INFOBIP_MESSAGE_ID')?.trim();
  const isProduction = process.env['NODE_ENV'] === 'production';

  const missing = [
    !apiKey && 'INFOBIP_API_KEY',
    !baseUrl && 'INFOBIP_BASE_URL',
    !applicationId && 'INFOBIP_APPLICATION_ID',
    !messageId && 'INFOBIP_MESSAGE_ID',
  ].filter(Boolean) as string[];

  if (isProduction && missing.length > 0) {
    throw new Error(
      `[sms] ${missing.join(', ')} required in production. Silent dev mock disabled.`,
    );
  }
  this.isDevMock = !isProduction && missing.length > 0;
  // ...
}
```

`?.trim()` 처리로 빈 문자열도 falsy 처리 (Phase 09.1 `??` vs `||` 교훈과 동일 함정).

**Warning signs:** Health check 통과하는데 `/sms/send-code`가 즉시 success 반환하면서 SMS는 도착 안 함. Cloud Run 로그에서 "DEV MOCK" 경고 출력.

### Pitfall 3: Phone normalization mismatch between send and verify

**What goes wrong:** 사용자가 send-code 시 `010-1234-5678` 입력, verify-code 시 `01012345678` 입력 → 백엔드가 두 번 다른 키로 정규화하면 `sms:pin:{e164}` 조회 실패 → "만료된 PIN" 오인.

**Why it happens:** 클라이언트 포맷 마스킹(`010-1234-5678`)과 raw 입력 혼재. 백엔드에서 매번 정규화하지 않고 raw string을 키로 사용하면 발생.

**How to avoid:** 모든 SmsService 메서드 첫 줄에 `const e164 = parseE164(phone)`. Valkey 키, Infobip API 호출, 에러 메시지에 항상 e164 사용. send와 verify가 동일 키 보장.

**Warning signs:** Staging 수동 테스트에서 1회 받은 SMS 코드를 입력했는데 "만료" 메시지. 백엔드 로그에서 send-code의 phone과 verify-code의 phone 문자열이 다름.

### Pitfall 4: Infobip Application 미생성 채로 코드 배포

**What goes wrong:** Infobip 콘솔에서 Application 또는 Message Template 미생성한 채 `INFOBIP_APPLICATION_ID=fake_id` 배포 → 첫 send-code 호출에서 Infobip이 404 또는 400 반환 → 사용자에게 "일시적 오류" 표시되고 가입 진행 불가.

**Why it happens:** D-04에서 운영자 수동 작업으로 분리됨. 코드 배포와 Infobip 콘솔 작업이 별도 시점에 진행되면 누락 가능.

**How to avoid:** Phase 10 deploy 체크리스트(별도 .md 또는 PR description)에 다음 단계 포함:
1. Infobip 포털 로그인 → 2FA → Applications → Create
2. `pinAttempts=5`, `allowMultiplePinVerifications=true`, `pinTimeToLive=3m`, `verifyPinLimit=1/3s`, `sendPinPerApplicationLimit=10000/1d`, `sendPinPerPhoneNumberLimit=5/1h`
3. Application ID 복사 → `INFOBIP_APPLICATION_ID` secret 등록
4. Messages → Create with `messageText="[Grapit] 인증번호 {{pin}} (3분 이내 입력)"`, `pinType=NUMERIC`, `pinLength=6`, `senderId=Grapit`
5. Message ID 복사 → `INFOBIP_MESSAGE_ID` secret 등록
6. 본인 번호로 staging 발송 검증

**Warning signs:** Infobip 응답이 404 또는 400 ("Application not found", "Message template invalid"). Sentry tag `infobip_code` 통해 가시화.

### Pitfall 5: ThrottlerStorage가 InMemoryRedis와 불호환

**What goes wrong:** Local dev에서 `REDIS_URL` 미설정 → `redis.provider.ts`가 InMemoryRedis fallback → `ThrottlerStorageRedisService`가 `INCR` 또는 EVAL 호출 시 `unknown command` 또는 `unknown Lua script pattern` throw → API 부팅 실패.

**Why it happens:** InMemoryRedis(`redis.provider.ts:14`)는 booking 모듈 전용으로 작성됨. throttler가 사용하는 명령(`INCR`, `EXPIRE`, `EVAL` for sliding window)이 미구현.

**How to avoid:** ThrottlerModule.forRootAsync useFactory 안에서 `redis instanceof IORedis` 체크 후 storage option 조건부:
```typescript
useFactory: (redis: IORedis | InMemoryRedis) => ({
  throttlers: [/* ... */],
  ...(typeof (redis as IORedis).incr === 'function'
    ? { storage: new ThrottlerStorageRedisService(redis as IORedis) }
    : {}),  // dev fallback: in-memory throttler
}),
```
또는 InMemoryRedis에 `incr`/`expire` 메서드 추가 (booking 모듈 영향 없으므로 안전).

**Warning signs:** `pnpm --filter @grapit/api dev`로 시작 시 "InMemoryRedis: unknown Lua script pattern" 에러. 또는 throttler 무관 엔드포인트가 죽음.

### Pitfall 6: PIN ID URL encoding 누락

**What goes wrong:** `pinId`가 영숫자 외 문자(예: `=`, `+`)를 포함하면 URL path에 raw 삽입 시 라우팅 오류.

**Why it happens:** Infobip pinId는 base64 또는 hex 형식인데 base64는 padding `=` 포함 가능.

**How to avoid:** `encodeURIComponent(pinId)`로 항상 escape (Pattern 3 코드 예시 참조).

**Warning signs:** verify-code가 항상 404 반환. Infobip 로그에 "Pin not found".

## Code Examples

### SMS Service main flow (verified pattern)

```typescript
// apps/api/src/modules/sms/sms.service.ts
import { Inject, Injectable, BadRequestException, GoneException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type IORedis from 'ioredis';
import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';
import { InfobipClient, InfobipApiError } from './infobip-client.js';
import { parseE164, isChinaMainland } from './phone.util.js';

const RESEND_COOLDOWN_MS = 30_000;
const PIN_MAPPING_TTL_MS = 200_000;  // PIN TTL 180s + 20s clock skew

export interface SendResult { success: boolean; message: string; }
export interface VerifyResult { verified: boolean; message?: string; }

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: InfobipClient | null;
  private readonly isDevMock: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {
    const apiKey = configService.get<string>('INFOBIP_API_KEY')?.trim() ?? '';
    const baseUrl = configService.get<string>('INFOBIP_BASE_URL')?.trim() ?? '';
    const applicationId = configService.get<string>('INFOBIP_APPLICATION_ID')?.trim() ?? '';
    const messageId = configService.get<string>('INFOBIP_MESSAGE_ID')?.trim() ?? '';
    const isProduction = process.env['NODE_ENV'] === 'production';

    const missing = [
      !apiKey && 'INFOBIP_API_KEY',
      !baseUrl && 'INFOBIP_BASE_URL',
      !applicationId && 'INFOBIP_APPLICATION_ID',
      !messageId && 'INFOBIP_MESSAGE_ID',
    ].filter(Boolean) as string[];

    if (isProduction && missing.length > 0) {
      throw new Error(
        `[sms] ${missing.join(', ')} required in production. Silent dev mock disabled.`,
      );
    }

    this.isDevMock = !isProduction && missing.length > 0;
    this.client = this.isDevMock ? null : new InfobipClient(baseUrl, apiKey, applicationId, messageId);

    if (this.isDevMock) {
      this.logger.warn({ event: 'sms.credential_missing', mode: 'dev_mock' });
    }
  }

  async sendVerificationCode(phone: string): Promise<SendResult> {
    const e164 = parseE164(phone);

    // D-03: China mainland reject
    if (isChinaMainland(e164)) {
      throw new BadRequestException(
        '현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요',
      );
    }

    // D-11: 30s resend cooldown via Valkey SET NX
    const cooldownKey = `sms:resend:${e164}`;
    const acquired = await this.redis.set(cooldownKey, '1', 'PX', RESEND_COOLDOWN_MS, 'NX');
    if (acquired === null && !this.isDevMock) {
      const ttl = await this.redis.pttl(cooldownKey);
      throw new BadRequestException({
        statusCode: 429,
        message: '잠시 후 다시 시도해주세요',
        retryAfterMs: Math.max(ttl, 0),
      });
    }

    // Dev mock
    if (this.isDevMock) {
      this.logger.log({ event: 'sms.sent', mode: 'dev_mock', phone: e164, code: '000000' });
      return { success: true, message: '인증번호가 발송되었습니다' };
    }

    // Production: call Infobip
    try {
      const res = await this.client!.sendPin(e164);
      // Store phone→pinId mapping (TTL 200s = PIN TTL + skew)
      await this.redis.set(`sms:pin:${e164}`, res.pinId, 'PX', PIN_MAPPING_TTL_MS);
      this.logger.log({ event: 'sms.sent', phone: e164, pinId: res.pinId });
      return { success: true, message: '인증번호가 발송되었습니다' };
    } catch (err) {
      const country = e164.startsWith('+82') ? 'KR' : 'unknown';
      Sentry.withScope((scope) => {
        scope.setTag('provider', 'infobip');
        scope.setTag('country', country);
        if (err instanceof InfobipApiError) scope.setTag('http_status', String(err.status));
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.send_failed', phone: e164, err: (err as Error).message });
      throw new BadRequestException('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  async verifyCode(phone: string, code: string): Promise<VerifyResult> {
    const e164 = parseE164(phone);

    // Dev mock: 000000 universal (D-15, D-24)
    if (this.isDevMock) {
      if (code === '000000') {
        this.logger.log({ event: 'sms.verified', mode: 'dev_mock', phone: e164 });
        return { verified: true };
      }
      return { verified: false, message: '인증번호가 일치하지 않습니다' };
    }

    // Production: lookup pinId from Valkey
    const pinId = await this.redis.get(`sms:pin:${e164}`);
    if (!pinId) {
      // PIN expired or never sent
      throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
    }

    try {
      const res = await this.client!.verifyPin(pinId, code);
      if (res.verified) {
        await this.redis.del(`sms:pin:${e164}`);  // 단일 사용
        this.logger.log({ event: 'sms.verified', phone: e164 });
        return { verified: true };
      }
      // attemptsRemaining=0 또는 PIN_EXPIRED → expired UX
      if (res.attemptsRemaining === 0 || res.pinError === 'NO_MORE_PIN_ATTEMPTS' || res.pinError === 'PIN_EXPIRED') {
        await this.redis.del(`sms:pin:${e164}`);
        throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
      }
      return { verified: false, message: '인증번호가 일치하지 않습니다' };
    } catch (err) {
      if (err instanceof GoneException) throw err;
      Sentry.withScope((scope) => {
        scope.setTag('provider', 'infobip');
        if (err instanceof InfobipApiError) scope.setTag('http_status', String(err.status));
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.verify_failed', phone: e164, err: (err as Error).message });
      return { verified: false, message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' };
    }
  }
}
```

### Phone util (libphonenumber-js)

```typescript
// apps/api/src/modules/sms/phone.util.ts
import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js/min';

export function parseE164(input: string): string {
  // Korean local format (010-1234-5678 or 01012345678) → +82
  const cleaned = input.replace(/[^+\d]/g, '');
  if (/^01[016789]\d{7,8}$/.test(cleaned)) {
    return `+82${cleaned.slice(1)}`;
  }
  try {
    const parsed = parsePhoneNumberWithError(cleaned.startsWith('+') ? cleaned : `+${cleaned}`);
    return parsed.number;  // Returns E.164
  } catch (err) {
    if (err instanceof ParseError) {
      throw new Error(`올바른 휴대폰 번호를 입력해주세요`);
    }
    throw err;
  }
}

export function isChinaMainland(e164: string): boolean {
  try {
    const parsed = parsePhoneNumberWithError(e164);
    return parsed.country === 'CN';
  } catch {
    return false;
  }
}
```

### Controller throttler decorators

```typescript
// apps/api/src/modules/sms/sms.controller.ts (additions)
import { Throttle } from '@nestjs/throttler';

@Public()
@HttpCode(HttpStatus.OK)
@Throttle({
  short: { name: 'short', limit: 5, ttl: 60 * 60 * 1000 },     // phone 5/시간 (D-06)
  long: { name: 'long', limit: 20, ttl: 60 * 60 * 1000 },      // IP 20/시간 (D-06)
})
@Post('send-code')
async sendCode(/* ... */) { /* ... */ }

@Public()
@HttpCode(HttpStatus.OK)
@Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })     // phone 10/15min (D-07)
@Post('verify-code')
async verifyCode(/* ... */) { /* ... */ }
```

> **Throttler tracker (phone vs IP 분리):** `@nestjs/throttler` 6은 기본적으로 IP 기준 trackId. phone 기반 trackId는 별도 `ThrottlerGuard` 확장 또는 `Throttle` `getTracker` 옵션 필요. **Planner 결정 사항:** 단순화를 위해 phone-based throttling은 Valkey 쿨다운 키 + send-code 엔드포인트 내부 phone counter로 대체할지, 정식 named throttler with custom getTracker로 갈지 선택. 권장: send-code의 IP 20/h는 throttler 데코레이터 + phone 5/h는 send-code 핸들러 내부 Valkey INCR + EXPIRE 조합 (decoupling 확실, 1인 개발 maintenance 유리).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Twilio Verify with US-routed delivery | Infobip 2FA with KISA-direct KT/SKT/LGU+ peering | 2024-2025 Kakao migration documented | 한국 OTP 수신 4h → 10min, 비용 ~$0.05 → ~$0.025 |
| In-process throttler memory | Distributed Redis throttler storage | NestJS throttler v6 (2025) | Cloud Run 멀티 인스턴스에서 정확한 글로벌 카운트 |
| Hand-rolled OTP store + retry counter | Provider-managed PIN application config | Infobip 2FA Application API (지속) | TOCTOU race condition 제거, brute-force lock 정확 |
| `class-validator` for DTO | `zod` + `drizzle-zod` | Project-wide (CLAUDE.md 정책) | 백엔드/프론트 schema 공유, ~37KB 번들 절약 |
| `@upstash/redis` HTTP client | `ioredis` TCP single client | Phase 7 (2026-Q1 Grapit) | Connection 수 절반, pub/sub 호환, Memorystore 표준 |

**Deprecated/outdated:**
- **`@infobip-api/sdk` (npm)** — Last release 2023-11-23. README는 WhatsApp/Email만 문서화, 2FA 미언급. Infobip이 community 저장소(infobip-community/infobip-api-node-sdk)로 이관 후 사실상 정지. 신규 프로젝트는 native fetch 권장.
- **Twilio Verify** — 한국 시장에서 도달률·비용 모두 Infobip 대비 열위. Phase 10 D-01 이미 결정.
- **`nestjs-throttler-storage-redis@0.5.x`** — peerDeps cap NestJS 10. 11+ 미명시. `@nest-lab/throttler-storage-redis@1.x` (NestJS 11 명시 지원) 사용.
- **NestJS Throttler v5 시그니처** — `@Throttle(limit, ttl)` 2-positional / `ttl=초`. v6은 `@Throttle({ name: { limit, ttl: ms } })` 객체. 본 프로젝트는 v6.4.0이므로 객체 + ms 강제.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Infobip verify response 정확한 필드명: `verified`, `attemptsRemaining`, `pinError`, `msisdn` | Pattern 3, Code Examples | Medium — 응답 매핑 코드를 staging 첫 호출에서 zod schema로 lock해야. 필드명이 `pinError` 대신 다른 enum이면 expired/invalid 분기 오류 |
| A2 | Infobip Application 응답에 `pinError` enum 값 `'NO_MORE_PIN_ATTEMPTS'`, `'PIN_EXPIRED'`, `'WRONG_PIN'` 포함 | Code Examples (verifyCode 410 분기) | Medium — enum 값이 다르면 410 vs 400 분기 부정확. 첫 staging 발송 시 실패 응답 캡쳐 필요 |
| A3 | Infobip base URL은 계정별 `xxxxx.api.infobip.com` subdomain | Pattern 3 | Low — 잘못되면 첫 호출 즉시 DNS resolution 실패. env로 주입하므로 운영자가 portal에서 정확한 값 복사 |
| A4 | `@nest-lab/throttler-storage-redis@1.2.0` 생성자가 ioredis 인스턴스 직접 수용 | Pattern 2 | Low — npm view peerDeps + WebFetch README 두 경로 확인. forRootAsync useFactory 패턴은 NestJS 표준 |
| A5 | InMemoryRedis가 throttler storage의 Lua/INCR 명령어 미지원 | Pitfall 5 | Low — `redis.provider.ts:14`의 InMemoryRedis 클래스 직접 확인, set/get/del/sadd/srem/smembers/scard/ttl/expire/eval만 구현. 결과는 dev에서 throttler off 또는 InMemoryRedis 보강 |
| A6 | Infobip Application 설정값(pinAttempts=5, pinTimeToLive=3m 등)은 콘솔 UI 또는 POST `/2fa/2/applications`로 모두 가능 | Pitfall 4 (체크리스트) | Low — 콘솔 UI는 검색 결과로 확인됨. 운영자가 콘솔에서 직접 입력하면 코드 변경 없음 |
| A7 | Cloud Run에서 Infobip API 호출 latency는 5초 budget 내 | Pattern 3 (`AbortSignal.timeout(5000)`) | Low — Infobip Korea 직결 인프라 + 지역 routing이면 일반적으로 200-800ms. 5s 여유는 이상치 대응 |
| A8 | 응답에 pinId를 노출하지 않고 phone→pinId를 Valkey에 저장하면 클라이언트 영향 0 | 설계 결정 | Low — `auth.service.ts:71` destructure는 `verified`만 사용. send-code 응답은 `{ success, message }` 그대로 |

## Open Questions

1. **Phone-based throttling tracker 구현 방식**
   - What we know: `@nestjs/throttler` 기본 trackId는 IP. phone-based는 custom ThrottlerGuard 확장 필요
   - What's unclear: D-06 "phone 5/h" 정확 구현 — (a) custom getTracker로 phone 추출 named throttler, (b) send-code 핸들러 내부 Valkey INCR로 직접 카운트
   - Recommendation: (b) 채택. 데코레이터로는 IP 20/h만, phone 5/h는 cooldown 키와 같은 위치(SmsService)에서 Valkey INCR + EXPIRE. 단순성 + visibility 우위. Planner 결정.

2. **password-reset throttler Valkey 이전을 SMS commit과 묶을지 분리할지**
   - What we know: D-09에서 함께 이전 결정. `auth.controller.ts:120,133` 두 곳
   - What's unclear: ThrottlerModule.forRoot → forRootAsync 변경은 모든 throttler에 영향 (전역). 별도 commit으로 분리하면 review 단순, 묶으면 atomic
   - Recommendation: 단일 commit `refactor(10-sms-XX): migrate ThrottlerModule to Valkey storage` — storage 변경 + password-reset 데코레이터 그대로 유지(코드 변경 없음). SMS 데코레이터 추가는 별도 commit. ThrottlerModule 변경은 password-reset 동작에 영향 없으므로 안전.

3. **Infobip Application 응답 필드명 정확 검증**
   - What we know: 검색 결과로 `verified`, `attemptsRemaining`, `pinError`, `msisdn` 추정
   - What's unclear: Infobip 공식 OpenAPI spec 또는 첫 staging 응답 캡쳐 전까지 100% 확정 불가
   - Recommendation: Wave 0에서 Infobip staging 계정으로 1회 send + verify (성공/실패 케이스) 호출 → 응답 JSON을 fixture로 저장 → zod schema lock. 코드 작성은 fixture 기반 진행.

4. **Cloud Run min-instances=0 + Infobip cold start 영향**
   - What we know: Cloud Run min-instances=0이면 첫 요청에서 NestJS 부팅 + Infobip DNS 초기화. 일반적 부팅 ~2-3s
   - What's unclear: Infobip 5s timeout이 cold start + DNS + TLS handshake + API call을 포함하는지
   - Recommendation: 문제 발생 시 min-instances=1로 변경 (월 ~$5 추가). Phase 10 초기 모니터링 이슈로만 우선 기록.

5. **CN(+86) 차단 메시지 노출 시점**
   - What we know: D-03 메시지는 백엔드 400 응답. UI-SPEC §"국가 감지 안내"에서 클릭 전 차단 미표시 결정
   - What's unclear: UX적으로 발송 시도 후 400을 받는 게 더 거친 경험인지, 입력 즉시 안내가 더 좋은지
   - Recommendation: UI-SPEC 결정대로 발송 시도 후 400 응답 표시. 이유: D-19 정신과 정합(UI에서 미리 차별 시그널 노출 안 함), libphonenumber-js 프론트 의존 회피 가능.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Infobip 2FA staging account | SMS-02 실 발송 검증 (D-25) | ❓ Unknown | — | 운영자가 [Infobip portal](https://portal.infobip.com) 가입 + 계정 활성화 필요 |
| Infobip API key (production) | SMS-02 production | ❓ Unknown | — | 운영자 콘솔 발급 |
| Valkey instance (Memorystore) | SMS-01 throttler storage, D-11 cooldown | ✓ | Phase 7에서 프로비저닝 | InMemoryRedis (dev only) |
| Node 22.x runtime | fetch + AbortSignal.timeout | ✓ | engines.node ">=22.0.0" (root package.json:18) | — |
| `@nestjs/throttler@6.x` | SMS-01 데코레이터 | ✓ | 6.4.0 (apps/api/package.json:28) | — |
| `ioredis@5.x` | REDIS_CLIENT 재사용 | ✓ | 5.10.1 (apps/api/package.json:38) | — |
| Sentry DSN | D-21 captureException | ✓ | `@sentry/nestjs ^10` 설치됨, instrument.ts:3 init | — |

**Missing dependencies with no fallback:**
- Infobip portal 계정/API key — D-25 staging 스모크와 production 모두 차단. **Phase 10 시작 전 운영자 사전 작업 필수**.

**Missing dependencies with fallback:**
- 없음 (Infobip 외 모든 의존성 충족)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x (apps/api) + Playwright 1.59.x (apps/web e2e) |
| Config file | `apps/api/vitest.config.ts`, `apps/api/vitest.integration.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` |
| Full suite command | `pnpm --filter @grapit/api test --run && pnpm --filter @grapit/web test --run && pnpm --filter @grapit/web test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SMS-01 | send-code phone 5/h ⊕ IP 20/h throttle | unit (Valkey INCR mock) + integration (testcontainers Valkey) | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` + `pnpm --filter @grapit/api test:integration` | ✅ unit (재작성), ❌ integration Wave 0 |
| SMS-01 | verify-code phone 10/15min throttle | integration (testcontainers Valkey) | `pnpm --filter @grapit/api test:integration --grep throttle` | ❌ Wave 0 |
| SMS-02 | Infobip sendPin success → success response | unit (fetch mock) | `pnpm --filter @grapit/api test infobip-client.spec.ts -- --run` | ❌ Wave 0 |
| SMS-02 | Infobip verifyPin verified=true → AuthResult | unit (mocked SmsService) | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` | ✅ (재작성) |
| SMS-02 | CN(+86) phone → 400 BadRequestException | unit | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` | ❌ Wave 0 |
| SMS-02 | Real SMS delivery (manual smoke) | manual | (manual on staging) | manual-only (D-25) |
| SMS-03 | NODE_ENV=production + INFOBIP_API_KEY=undefined → constructor throw | unit | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run -t "production hard-fail"` | ❌ Wave 0 |
| SMS-03 | NODE_ENV=development + no key → dev mock + accept 000000 | unit | (existing test pattern) | ✅ |
| SMS-04 | PIN expired → 410 GoneException ("재발송해주세요") | unit (Redis pin mapping miss) | `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` | ❌ Wave 0 |
| SMS-04 | attempts exhausted (Infobip pinError=NO_MORE_PIN_ATTEMPTS) → 410 | unit (Infobip mock) | (same) | ❌ Wave 0 |
| SMS-04 | resend cooldown 30s → 429 with retryAfter | unit (Valkey SET NX returns null) | (same) | ❌ Wave 0 |
| SMS-01~04 | Signup E2E with mock SMS (000000) preserved | e2e (Playwright CI) | `pnpm --filter @grapit/web test:e2e -- signup.spec.ts` | ❓ (Phase 10 신규 spec — 또는 social-login.spec.ts 확장) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/api test sms.service.spec.ts infobip-client.spec.ts -- --run` (~5s)
- **Per wave merge:** `pnpm --filter @grapit/api test --run && pnpm --filter @grapit/web test --run` (~30s)
- **Phase gate:** `pnpm --filter @grapit/api test --run && pnpm --filter @grapit/api test:integration && pnpm --filter @grapit/web test --run && pnpm --filter @grapit/web test:e2e` 전부 green + manual staging smoke (D-25)

### Wave 0 Gaps

- [ ] `apps/api/src/modules/sms/sms.service.spec.ts` — 재작성 (Twilio mock 제거, Infobip mock + Redis mock 도입). 커버 케이스: dev mock (000000), CN reject, hard-fail 생성자, cooldown 429, expired 410, attempts exhausted 410, verified true/false
- [ ] `apps/api/src/modules/sms/infobip-client.spec.ts` — 신규 (fetch global mock으로 sendPin + verifyPin URL/header/body 검증)
- [ ] `apps/api/src/modules/sms/phone.util.spec.ts` — 신규 (parseE164 한국/태국/+86 케이스, isChinaMainland 정확성)
- [ ] `apps/api/src/modules/sms/__tests__/sms.integration.spec.ts` — 신규 (testcontainers Valkey + 실제 throttler + Infobip fetch nock)
- [ ] `apps/web/components/auth/__tests__/phone-verification.test.tsx` — 신규 또는 확장 (4-state 버튼 transition, 30s 쿨다운 타이머, 에러 카피 분기)
- [ ] `apps/web/e2e/signup.spec.ts` — 신규 (CI mock 모드에서 회원가입 전체 플로우 + 000000 입력 검증) — 또는 기존 `social-login.spec.ts`에 phone-verification 단계 통과 확인 추가
- [ ] Infobip staging 응답 fixture — `apps/api/src/modules/sms/__fixtures__/infobip-{send,verify}-response.json` (실 staging 호출 1회로 수집)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Phone OTP via Infobip 2FA. Server-side PIN validation (no client-side bypass), single-use PIN (sms:pin:{e164} `del` after verify) |
| V3 Session Management | yes (간접) | OTP success → register endpoint creates session. JWT access + refresh rotation은 Phase 1에서 정착 |
| V4 Access Control | yes | `@Public` 데코레이터 + `@Throttle` 통한 anonymous endpoint 보호. send-code/verify-code는 등록 전 호출이므로 JWT 미요구하지만 throttle 강제 |
| V5 Input Validation | yes | zod schema (`sendCodeSchema`, `verifyCodeSchema` in sms.controller.ts), 추가로 백엔드에서 `parseE164` 후 `isChinaMainland` 차단 |
| V6 Cryptography | no | 자체 PIN 생성/저장 안 함 (Infobip 위임). Argon2id는 Phase 1에서 password 영역 |

### Known Threat Patterns for SMS OTP

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SMS pumping (premium-rate fraud) | Spoofing/Tampering | Infobip phone country validation + per-phone throttle (D-06 5/h) + per-IP throttle (20/h). Infobip이 자체 fraud detection도 운영 |
| Brute-force OTP guessing | Tampering | Infobip Application `pinAttempts=5` (D-12) + verify-code `phone 10/15min` throttle (D-07). 두 레이어로 ~50회/15min 상한 |
| OTP enumeration (사용자 존재 여부 추측) | Information Disclosure | send-code 응답 메시지를 phone 등록 여부에 무관하게 동일 ("인증번호가 발송되었습니다"). Phase 10 SMS는 register 전 호출이므로 enumeration 표면 자체 작음 |
| Replay attack (재사용) | Tampering | verify success 시 `del sms:pin:{e164}` (single-use). Infobip Application `allowMultiplePinVerifications=true` 설정 시에도 백엔드에서 1회로 강제 |
| Credential leak (Infobip API key) | Information Disclosure | GCP Secret Manager + GitHub Actions secrets (D-17). 코드 base 또는 .env에 hardcode 절대 금지. lint rule 또는 `.gitignore` 검증 |
| Cross-site request forgery on send-code | Tampering | NestJS controller는 cookie/credentials 없는 anonymous endpoint. CORS는 main.ts에서 origin allow-list. send-code 자체가 OTP 발송만 트리거하므로 CSRF 영향 낮음 (단 throttle 비용 소모는 가능 — IP throttle로 방어) |
| Telco bypass / SS7 attack | Spoofing | Infobip이 KISA 직결 KT/SKT/LGU+ 사용으로 신뢰 routing. 서비스 차원에서 추가 방어 비현실 |

## Reconsideration

> CONTEXT.md 결정 D-XX를 변경해야 하는 명확한 증거 — 본 RESEARCH에서 발견된 사항만 기록. 없으면 빈 섹션.

**없음.** D-01 ~ D-25 모든 결정이 본 RESEARCH의 검증으로 보강됨:

- D-01 Infobip 채택 ✓ (Kakao 사례 + KISA 직결 검증, native fetch로 SDK 비채택은 결정 강화)
- D-08 `@nest-lab/throttler-storage-redis` ✓ (v1.2.0 NestJS 11 명시 지원 확인, 대안 패키지보다 우위)
- D-10~D-13 OTP 정책 ✓ (Infobip Application `pinAttempts/pinTimeToLive/pinLength/pinType` 설정값으로 1:1 매핑 가능)
- D-14~D-16 Hard-fail 4-env ✓ (Phase 7 redis.provider.ts 패턴 그대로 복제 가능)

단, **운영 사전 작업 1건이 추가**됨 (Reconsideration이 아닌 deploy 체크리스트 항목):
- Infobip portal 계정 + Application + Message Template 사전 생성. Phase 10 코드 배포 전 별도 작업.

## Sources

### Primary (HIGH confidence)
- npm registry — `npm view @nest-lab/throttler-storage-redis version peerDependencies time` (2026-04-16 verified)
- npm registry — `npm view @infobip-api/sdk version time dependencies` (2023-11-23 last publish confirmed)
- npm registry — `npm view nestjs-throttler-storage-redis peerDependencies` (NestJS 10 cap confirmed)
- npm registry — `npm view libphonenumber-js version exports` (1.12.41 verified)
- 코드 직접 검증 — `apps/api/src/modules/booking/providers/redis.provider.ts:5` (REDIS_CLIENT export), `apps/api/src/modules/booking/booking.module.ts:16` (BookingModule exports redisProvider), `apps/api/src/app.module.ts:29` (ThrottlerModule.forRoot 현재 구성), `apps/api/src/modules/auth/auth.controller.ts:120,133` (password-reset throttler v6 pattern), `apps/api/src/common/filters/http-exception.filter.ts:7,19` (Sentry pattern)

### Secondary (MEDIUM confidence)
- [Infobip 2FA Service Docs](https://www.infobip.com/docs/2fa-service/using-2fa-api) — 엔드포인트 path 및 request body 필드 (WebSearch 2026-04-16)
- [Infobip API Authentication](https://www.infobip.com/docs/essentials/api-essentials/api-authentication) — `Authorization: App {API_KEY}` 형식 (WebFetch 2026-04-16)
- [Infobip Base URL Docs](https://www.infobip.com/docs/essentials/api-essentials/base-url) — `xxxxx.api.infobip.com` 계정별 subdomain (WebSearch 2026-04-16)
- [Infobip Java/Go/PHP/Python SDK READMEs on GitHub](https://github.com/infobip) — Application configuration examples (`pinAttempts`, `pinTimeToLive`, `verifyPinLimit`, `sendPinPerPhoneNumberLimit`)
- [Infobip Community Node SDK](https://github.com/infobip-community/infobip-api-node-sdk) — package name `@infobip-api/sdk`, last release date

### Tertiary (LOW confidence — needs Wave 0 fixture validation)
- Infobip verify response 정확한 필드명 (`verified`, `attemptsRemaining`, `pinError`, `msisdn`) — 검색 결과 + 다른 언어 클라이언트에서 추정. **첫 staging 응답으로 zod schema lock 필수**
- `pinError` enum 값 (`'NO_MORE_PIN_ATTEMPTS'`, `'PIN_EXPIRED'`, `'WRONG_PIN'`, `'NO_ERROR'`) — Infobip 다언어 클라이언트 코드에서 추정. 정확 enum은 staging 실패 응답 캡쳐로 확인

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm view 직접 검증으로 peerDeps + 마지막 publish 확인
- Architecture: HIGH — 기존 코드(redis.provider, booking.module, auth.controller, http-exception.filter) 직접 인용 + Phase 7 hard-fail 패턴 복제
- Pitfalls: HIGH (1, 2, 3, 6) / MEDIUM (4 운영) / MEDIUM (5 InMemoryRedis 미보강 가정)
- Infobip API 응답 매핑: MEDIUM — 공식 OpenAPI spec 추출 실패. Wave 0 staging fixture로 lock 권장
- Validation Architecture: HIGH — 기존 vitest + Playwright 인프라 활용, Wave 0 신규 파일 명확

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30일 — Infobip API stable, NestJS Throttler v6 stable, Phase 7 Valkey 인프라 stable)
