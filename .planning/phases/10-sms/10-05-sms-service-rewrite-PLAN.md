---
phase: 10
plan: 05
type: execute
wave: 2
depends_on: [10-03, 10-04]
files_modified:
  - apps/api/src/modules/sms/sms.service.ts
  - apps/api/src/modules/sms/sms.module.ts
autonomous: true
requirements: [SMS-01, SMS-02, SMS-03, SMS-04]
must_haves:
  truths:
    - "SmsService 생성자가 production 환경에서 INFOBIP_* 4종 env 하나라도 비면 throw (hard-fail)"
    - "NODE_ENV !== 'production' && 4 env 미설정 시 dev mock 모드 활성"
    - "dev mock 모드에서 000000 코드만 verified=true"
    - "CN(+86) phone → BadRequestException with 중국 본토 메시지"
    - "30초 resend cooldown Valkey SET NX 기반 (`sms:resend:{e164}` PX 30000) — D-11"
    - "phone axis send 5/3600s counter Valkey INCR+EXPIRE (`sms:send_count:{e164}`) — D-06 phone 축 (Infobip 호출 전 차단)"
    - "phone axis verify 10/900s counter Valkey INCR+EXPIRE (`sms:verify_count:{e164}`) — D-07 phone 축 (Infobip pinAttempts=5 위 defense-in-depth 상위 레이어)"
    - "phone→pinId 매핑 Valkey에 저장 (`sms:pin:{e164}` PX 200000)"
    - "D-23 관측은 Infobip 대시보드 + Sentry + 구조화 로그 (자체 Prometheus 미구축)"
    - "PIN 만료/attempts exhausted 시 GoneException"
    - "verify success 시 sms:pin:{e164} del (single-use)"
    - "SmsModule이 BookingModule을 imports해서 REDIS_CLIENT 재사용"
    - "응답 shape 불변: sendVerificationCode → {success, message}, verifyCode → {verified, message?}"
  artifacts:
    - path: "apps/api/src/modules/sms/sms.service.ts"
      provides: "Infobip 기반 SMS 서비스 + Valkey 쿨다운 + phone axis counters (D-06/D-07) + dev mock + hard-fail 생성자"
      min_lines: 160
    - path: "apps/api/src/modules/sms/sms.module.ts"
      provides: "BookingModule import 추가로 REDIS_CLIENT 주입 가능"
      contains: "BookingModule"
  key_links:
    - from: "sms.service.ts"
      to: "REDIS_CLIENT (Phase 7 provider)"
      via: "@Inject(REDIS_CLIENT) private readonly redis: IORedis"
      pattern: "@Inject\\(REDIS_CLIENT\\)"
    - from: "sms.service.ts"
      to: "infobip-client.ts"
      via: "new InfobipClient(baseUrl, apiKey, appId, msgId) + client.sendPin / verifyPin"
      pattern: "new InfobipClient"
    - from: "sms.service.ts"
      to: "phone.util.ts"
      via: "parseE164(phone) + isChinaMainland(e164)"
      pattern: "parseE164|isChinaMainland"
    - from: "sms.service.ts"
      to: "@sentry/nestjs"
      via: "Sentry.withScope + captureException"
      pattern: "Sentry.withScope"
    - from: "sms.module.ts"
      to: "booking.module.ts"
      via: "imports: [BookingModule]"
      pattern: "BookingModule"
---

<objective>
SmsService를 Twilio에서 Infobip으로 완전 재작성. RESEARCH §"Code Examples > SMS Service main flow"를 구현. CONTEXT D-01~D-16, D-21~D-22를 task action에 반영. Plan 01의 sms.service.spec.ts를 RED→GREEN 전환이 완료 기준.

Purpose: Phase 10의 핵심 비즈니스 로직. Infobip에게 OTP 생성/검증/만료/시도횟수를 위임하고, Grapit 백엔드는 phone→pinId 매핑(Valkey), 30초 쿨다운(Valkey SET NX), CN 차단, dev mock, hard-fail만 책임. 응답 shape 불변 — auth.service.ts register/social-register 호출부 회귀 0.

Output: sms.service.ts(~150LOC) + sms.module.ts(BookingModule import 추가).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-sms/10-CONTEXT.md
@.planning/phases/10-sms/10-RESEARCH.md
@apps/api/src/modules/sms/sms.service.ts
@apps/api/src/modules/sms/sms.service.spec.ts
@apps/api/src/modules/sms/sms.module.ts
@apps/api/src/modules/sms/phone.util.ts
@apps/api/src/modules/sms/infobip-client.ts
@apps/api/src/modules/booking/providers/redis.provider.ts
@apps/api/src/modules/booking/booking.module.ts
@apps/api/src/modules/auth/auth.service.ts
@apps/api/src/common/filters/http-exception.filter.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <id>10-05-T1</id>
  <name>Task 1: SmsService 전면 재작성 (Infobip + Valkey + dev mock + hard-fail)</name>
  <files>apps/api/src/modules/sms/sms.service.ts</files>
  <behavior>
    구체 behavior는 Plan 01에서 작성한 sms.service.spec.ts 9 describe 블록으로 고정 + Task 3(T-phone-axis-counters) 추가 describe 블록:
    1. Production hard-fail (D-14, D-16) — 4 env 중 1개라도 빈 경우 constructor throw
    2. Dev mock mode (D-15, D-24) — 000000 universal, 그 외 거부
    3. CN(+86) reject (D-03) — BadRequestException
    4. Resend cooldown (D-11) — SET NX 실패 시 429
    5. Production sendPin success (SMS-02)
    6. Verify flow — expired PIN (D-12, SMS-04) — GoneException
    7. Verify flow — attempts exhausted (D-12)
    8. Verify flow — wrong pin
    9. Verify flow — success — redis.del 호출
    10. (Task 3) phone 5/h throttle — 동일 e164로 sendCount 6회째 429 throw (D-06)
    11. (Task 3) phone 10/15min throttle — 동일 e164로 verifyCount 11회째 429 throw (D-07)
  </behavior>
  <description>RESEARCH §"Code Examples > SMS Service main flow" 블록을 그대로 구현. 기존 Twilio 로직 100% 제거. phone.util + infobip-client를 의존성으로 사용. @Inject(REDIS_CLIENT)로 Phase 7 단일 ioredis 주입. Sentry withScope로 country/http_status/infobip_code tag 부착.</description>
  <read_first>
    - apps/api/src/modules/sms/sms.service.ts (기존 Twilio 버전 — 전면 교체)
    - apps/api/src/modules/sms/sms.service.spec.ts (Plan 01 RED — behavior contract)
    - .planning/phases/10-sms/10-RESEARCH.md §"Code Examples > SMS Service main flow"
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 4: Valkey Key Schema"
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 5: Sentry tag 주입"
    - .planning/phases/10-sms/10-RESEARCH.md §"Common Pitfalls" 1~6 (전부)
    - apps/api/src/modules/booking/providers/redis.provider.ts (REDIS_CLIENT symbol, ioredis set signature)
    - apps/api/src/common/filters/http-exception.filter.ts (Sentry capture 패턴)
    - apps/api/src/modules/auth/auth.service.ts:71, 393 (verifyCode 호출부 — 응답 shape 불변 확인)
  </read_first>
  <action>
    `apps/api/src/modules/sms/sms.service.ts` 전면 재작성. 기존 파일은 모두 삭제 후 다음 구조:

    ```typescript
    import {
      Inject,
      Injectable,
      BadRequestException,
      GoneException,
      Logger,
    } from '@nestjs/common';
    import { ConfigService } from '@nestjs/config';
    import * as Sentry from '@sentry/nestjs';
    import type IORedis from 'ioredis';
    import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';
    import { InfobipClient, InfobipApiError } from './infobip-client.js';
    import { parseE164, isChinaMainland } from './phone.util.js';

    const RESEND_COOLDOWN_MS = 30_000;           // D-11
    const PIN_MAPPING_TTL_MS = 200_000;          // PIN TTL 180s (D-10) + 20s clock skew
    const SEND_PHONE_AXIS_LIMIT = 5;             // D-06: phone 당 5회/3600s send 제한
    const SEND_PHONE_AXIS_WINDOW_SEC = 3600;     // D-06: 1h 윈도우
    const VERIFY_PHONE_AXIS_LIMIT = 10;          // D-07: phone 당 10회/900s verify 제한
    const VERIFY_PHONE_AXIS_WINDOW_SEC = 900;    // D-07: 15min 윈도우

    export interface SendResult { success: boolean; message: string }
    export interface VerifyResult { verified: boolean; message?: string }

    @Injectable()
    export class SmsService {
      private readonly logger = new Logger(SmsService.name);
      private readonly client: InfobipClient | null;
      private readonly isDevMock: boolean;

      constructor(
        configService: ConfigService,
        @Inject(REDIS_CLIENT) private readonly redis: IORedis,
      ) {
        // D-14, D-16: 4 env 전부 검증. Pitfall 2: ?.trim() 처리로 빈 문자열도 falsy
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
          // D-14 hard-fail: Phase 7 redis.provider 패턴 복제
          throw new Error(
            `[sms] ${missing.join(', ')} required in production. Silent dev mock disabled.`,
          );
        }

        this.isDevMock = !isProduction && missing.length > 0;
        this.client = this.isDevMock
          ? null
          : new InfobipClient(baseUrl, apiKey, applicationId, messageId);

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

        // Dev mock — cooldown skip, 즉시 success (RESEARCH Pattern 1 Caveat)
        if (this.isDevMock) {
          this.logger.log({ event: 'sms.sent', mode: 'dev_mock', phone: e164 });
          return { success: true, message: '인증번호가 발송되었습니다' };
        }

        // D-11: 30s resend cooldown via Valkey SET NX
        // ioredis flat signature: set(key, value, 'PX', ms, 'NX')
        const cooldownKey = `sms:resend:${e164}`;
        const acquired = await this.redis.set(
          cooldownKey,
          '1',
          'PX',
          RESEND_COOLDOWN_MS,
          'NX',
        );
        if (acquired === null) {
          const ttl = await this.redis.pttl(cooldownKey);
          this.logger.warn({ event: 'sms.rate_limited', phone: e164, layer: 'resend_cooldown' });
          throw new BadRequestException({
            statusCode: 429,
            message: '잠시 후 다시 시도해주세요',
            retryAfterMs: Math.max(ttl, 0),
          });
        }

        // D-06: phone axis counter — send 5/3600s
        // Valkey INCR + 첫 증가 시 EXPIRE (TTL 재설정 안 함 — fixed window)
        const sendCountKey = `sms:send_count:${e164}`;
        const sendCount = await this.redis.incr(sendCountKey);
        if (sendCount === 1) {
          await this.redis.expire(sendCountKey, SEND_PHONE_AXIS_WINDOW_SEC);
        }
        if (sendCount > SEND_PHONE_AXIS_LIMIT) {
          const ttl = await this.redis.ttl(sendCountKey);
          this.logger.warn({
            event: 'sms.rate_limited',
            phone: e164,
            layer: 'phone_axis_send',
            count: sendCount,
          });
          throw new BadRequestException({
            statusCode: 429,
            message: '잠시 후 다시 시도해주세요',
            retryAfterMs: Math.max(ttl, 0) * 1000,
          });
        }

        // Production: call Infobip
        try {
          const res = await this.client!.sendPin(e164);
          await this.redis.set(
            `sms:pin:${e164}`,
            res.pinId,
            'PX',
            PIN_MAPPING_TTL_MS,
          );
          this.logger.log({ event: 'sms.sent', phone: e164, pinId: res.pinId });
          return { success: true, message: '인증번호가 발송되었습니다' };
        } catch (err) {
          const country = e164.startsWith('+82') ? 'KR' : 'unknown';
          Sentry.withScope((scope) => {
            scope.setTag('provider', 'infobip');
            scope.setTag('country', country);
            if (err instanceof InfobipApiError) {
              scope.setTag('http_status', String(err.status));
            }
            scope.setLevel('error');
            Sentry.captureException(err);
          });
          this.logger.error({
            event: 'sms.send_failed',
            phone: e164,
            err: (err as Error).message,
          });
          throw new BadRequestException(
            '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
          );
        }
      }

      async verifyCode(phone: string, code: string): Promise<VerifyResult> {
        const e164 = parseE164(phone);

        // D-15, D-24: Dev mock — 000000 universal
        if (this.isDevMock) {
          if (code === '000000') {
            this.logger.log({ event: 'sms.verified', mode: 'dev_mock', phone: e164 });
            return { verified: true };
          }
          return { verified: false, message: '인증번호가 일치하지 않습니다' };
        }

        // D-07: phone axis counter — verify 10/900s (Infobip pinAttempts=5 위 defense-in-depth 상위 레이어)
        const verifyCountKey = `sms:verify_count:${e164}`;
        const verifyCount = await this.redis.incr(verifyCountKey);
        if (verifyCount === 1) {
          await this.redis.expire(verifyCountKey, VERIFY_PHONE_AXIS_WINDOW_SEC);
        }
        if (verifyCount > VERIFY_PHONE_AXIS_LIMIT) {
          const ttl = await this.redis.ttl(verifyCountKey);
          this.logger.warn({
            event: 'sms.rate_limited',
            phone: e164,
            layer: 'phone_axis_verify',
            count: verifyCount,
          });
          throw new BadRequestException({
            statusCode: 429,
            message: '잠시 후 다시 시도해주세요',
            retryAfterMs: Math.max(ttl, 0) * 1000,
          });
        }

        // Production: lookup phone→pinId
        const pinId = await this.redis.get(`sms:pin:${e164}`);
        if (!pinId) {
          // D-20: expired UX (프론트에서 '인증번호가 만료되었습니다. 재발송해주세요')
          throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
        }

        try {
          const res = await this.client!.verifyPin(pinId, code);
          if (res.verified) {
            await this.redis.del(`sms:pin:${e164}`);  // single-use
            this.logger.log({ event: 'sms.verified', phone: e164 });
            return { verified: true };
          }
          // D-12: attempts exhausted or PIN expired → 410 expired UX
          if (
            res.attemptsRemaining === 0 ||
            res.pinError === 'NO_MORE_PIN_ATTEMPTS' ||
            res.pinError === 'PIN_EXPIRED'
          ) {
            await this.redis.del(`sms:pin:${e164}`);
            throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
          }
          return { verified: false, message: '인증번호가 일치하지 않습니다' };
        } catch (err) {
          if (err instanceof GoneException) throw err;
          Sentry.withScope((scope) => {
            scope.setTag('provider', 'infobip');
            if (err instanceof InfobipApiError) {
              scope.setTag('http_status', String(err.status));
            }
            scope.setLevel('error');
            Sentry.captureException(err);
          });
          this.logger.error({
            event: 'sms.verify_failed',
            phone: e164,
            err: (err as Error).message,
          });
          return {
            verified: false,
            message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
          };
        }
      }
    }
    ```

    **중요 구현 포인트:**
    - `import Twilio from 'twilio'` 완전 제거
    - 응답 shape 유지: `SendResult`, `VerifyResult` export (auth.service.ts가 destructure)
    - Valkey 키 prefix:
      - `sms:resend:{e164}` — D-11 30s SET NX 쿨다운
      - `sms:send_count:{e164}` — D-06 phone axis send INCR+EXPIRE (3600s 윈도우, 5회 초과 시 429)
      - `sms:verify_count:{e164}` — D-07 phone axis verify INCR+EXPIRE (900s 윈도우, 10회 초과 시 429)
      - `sms:pin:{e164}` — phone→pinId 매핑 (PX 200000)
    - ioredis flat signature: `.set(key, value, 'PX', ms, 'NX')` + `.incr(key)` + `.expire(key, seconds)` + `.ttl(key)` (모두 실 ioredis에 존재). dev mock 경로는 Redis 접근 skip하므로 InMemoryRedis 우회 (phone axis 카운터도 production path에서만 동작)
    - **phone axis 카운터 동작 규칙:**
      - `INCR` 후 반환값이 1이면 첫 증가 → `EXPIRE`로 윈도우 TTL 설정 (fixed window, TTL 재설정 금지 — sliding 금지)
      - 반환값이 limit 초과면 `BadRequestException({ statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs })` throw
      - Infobip 호출 **전**에 차단해야 비용 절감 + Infobip 자체 rate limit 보완 (D-06 근거)
      - D-15 dev mock 경로는 phone axis 카운터 우회 (Infobip 호출 자체가 없으므로 방어 대상 외, 테스트 편의성)
    - Sentry tag: `provider`, `country`, `http_status` — D-21
    - 로깅: `event: 'sms.sent|sms.verified|sms.rate_limited|sms.credential_missing|sms.send_failed|sms.verify_failed'` — D-22 구조화 로그. `sms.rate_limited` 이벤트의 `layer` 필드로 `resend_cooldown | phone_axis_send | phone_axis_verify` 구분
    - 에러 메시지 한글 — UI-SPEC §"에러 메시지 카피" 일치
    - ESM `.js` 확장자 import 준수
    - D-23 관측 정책: 자체 Prometheus 미구축. Infobip 대시보드 + Sentry + 구조화 로그 3-layer 조합

    작성 후 `pnpm --filter @grapit/api test sms.service -- --run` 전 케이스 GREEN 확인.
  </action>
  <acceptance_criteria>
    - `! grep -q "twilio\\|Twilio" apps/api/src/modules/sms/sms.service.ts` (완전 제거)
    - `grep -q "import \\* as Sentry from '@sentry/nestjs'" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "@Inject(REDIS_CLIENT)" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "from '../booking/providers/redis.provider.js'" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "parseE164" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "isChinaMainland" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "InfobipClient" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "required in production" apps/api/src/modules/sms/sms.service.ts` (hard-fail 메시지)
    - `grep -q "sms:resend:" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "sms:send_count:" apps/api/src/modules/sms/sms.service.ts` (D-06 phone axis send)
    - `grep -q "sms:verify_count:" apps/api/src/modules/sms/sms.service.ts` (D-07 phone axis verify)
    - `grep -q "SEND_PHONE_AXIS_LIMIT\|SEND_PHONE_AXIS_WINDOW_SEC" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "VERIFY_PHONE_AXIS_LIMIT\|VERIFY_PHONE_AXIS_WINDOW_SEC" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "redis\.incr\|this\.redis\.incr" apps/api/src/modules/sms/sms.service.ts` (INCR 기반 카운터)
    - `grep -q "redis\.expire\|this\.redis\.expire" apps/api/src/modules/sms/sms.service.ts` (첫 증가 시 TTL 설정)
    - `grep -q "phone_axis_send\|phone_axis_verify" apps/api/src/modules/sms/sms.service.ts` (layer 로그)
    - `grep -q "sms:pin:" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "현재 중국 본토 SMS 인증은 지원되지 않습니다" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "GoneException" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "NO_MORE_PIN_ATTEMPTS" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "PIN_EXPIRED" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "'PX', RESEND_COOLDOWN_MS, 'NX'\\|'PX', 30_000, 'NX'\\|'PX',30000,'NX'" apps/api/src/modules/sms/sms.service.ts` (SET NX signature)
    - `grep -q "sms\\.sent\\|sms\\.verified\\|sms\\.rate_limited\\|sms\\.credential_missing" apps/api/src/modules/sms/sms.service.ts` (D-22 구조화 로그)
    - `grep -q "setTag('provider', 'infobip')" apps/api/src/modules/sms/sms.service.ts` (D-21)
    - `grep -q "setTag('country'" apps/api/src/modules/sms/sms.service.ts`
    - `grep -q "redis\\.del(\\`sms:pin:" apps/api/src/modules/sms/sms.service.ts` (single-use)
    - `pnpm --filter @grapit/api test sms.service -- --run` 전부 green
    - `! grep -c ": any" apps/api/src/modules/sms/sms.service.ts` == 0 (strict)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test sms.service -- --run 2>&1 | tail -20</automated>
  </verify>
  <requirements>SMS-02, SMS-03, SMS-04</requirements>
  <autonomous>true</autonomous>
  <commit>feat(10-05): rewrite SmsService on Infobip 2FA + Valkey cooldown + production hard-fail</commit>
  <done>SmsService Twilio 완전 제거, Infobip 기반 재작성 완료, sms.service.spec 9 describe GREEN, 응답 shape 불변</done>
</task>

<task type="auto">
  <id>10-05-T2</id>
  <name>Task 2: SmsModule에 BookingModule import 추가 (REDIS_CLIENT 재사용)</name>
  <files>apps/api/src/modules/sms/sms.module.ts</files>
  <description>RESEARCH §"Pattern 1: SmsModule import BookingModule (REDIS_CLIENT 재사용)" 그대로. BookingModule이 이미 redisProvider를 exports하므로 SmsModule은 imports만 추가하면 @Inject(REDIS_CLIENT)가 주입 가능.</description>
  <read_first>
    - apps/api/src/modules/sms/sms.module.ts (현재 imports 없음)
    - apps/api/src/modules/booking/booking.module.ts (exports에 redisProvider 있음)
    - .planning/phases/10-sms/10-RESEARCH.md §"Pattern 1"
  </read_first>
  <action>
    `apps/api/src/modules/sms/sms.module.ts` 수정:

    ```typescript
    import { Module } from '@nestjs/common';
    import { BookingModule } from '../booking/booking.module.js';
    import { SmsService } from './sms.service.js';
    import { SmsController } from './sms.controller.js';

    @Module({
      imports: [BookingModule],
      controllers: [SmsController],
      providers: [SmsService],
      exports: [SmsService],
    })
    export class SmsModule {}
    ```

    `BookingModule`이 이미 `exports: [BookingService, BookingGateway, redisProvider]`이므로 imports만 추가하면 REDIS_CLIENT 주입 가능 (booking.module.ts:16 확인).

    순환 의존 주의: BookingModule은 SmsModule을 imports하지 않으므로 단방향 안전.
  </action>
  <acceptance_criteria>
    - `grep -q "import { BookingModule }" apps/api/src/modules/sms/sms.module.ts`
    - `grep -q "imports: \\[BookingModule\\]" apps/api/src/modules/sms/sms.module.ts`
    - `pnpm --filter @grapit/api typecheck` SmsModule 관련 에러 0
    - 전체 API boot test: `pnpm --filter @grapit/api test -- --run` 실행 시 SmsService DI 에러 0 (REDIS_CLIENT provider not found 에러 없음)
  </acceptance_criteria>
  <verify>
    <automated>grep -q "imports: \[BookingModule\]" apps/api/src/modules/sms/sms.module.ts && pnpm --filter @grapit/api typecheck 2>&1 | tail -3</automated>
  </verify>
  <requirements>SMS-01, SMS-02</requirements>
  <autonomous>true</autonomous>
  <commit>refactor(10-05): import BookingModule into SmsModule to reuse REDIS_CLIENT</commit>
  <done>SmsModule.imports에 BookingModule 추가, typecheck green, REDIS_CLIENT DI 정상 해석</done>
</task>


<task type="auto" tdd="true">
  <id>10-05-T3</id>
  <name>Task 3: T-phone-axis-counters — send 5/3600s + verify 10/900s 단위 테스트 보강 (sms.service.spec.ts 확장)</name>
  <files>apps/api/src/modules/sms/sms.service.spec.ts</files>
  <behavior>
    Plan 01이 스캐폴딩한 sms.service.spec.ts에 두 describe 블록 추가 (RED→GREEN 대상):

    describe('phone 5/h throttle (D-06)'):
      - 동일 phone(`'01012345678'`)으로 `sendVerificationCode` 5회 호출 → 5회 모두 `{ success: true }` (`redis.incr` 1→5 반환 mock)
      - 6회째 호출 시 `redis.incr`가 6 반환 → `BadRequestException` throw with `statusCode: 429` + message `/잠시 후 다시 시도해주세요/` + `retryAfterMs > 0`
      - `sms:send_count:+821012345678` 키 사용 확인 (redis.incr 호출 인자 assertion)
      - 첫 호출 시 `redis.expire('sms:send_count:+821012345678', 3600)` 호출됨 (INCR === 1)
      - 2~6회차에는 expire 호출 없음 (fixed window)
      - Infobip sendPin이 6회째에는 호출되지 않음 (사전 차단 확인)

    describe('phone 10/15min throttle (D-07)'):
      - 동일 phone으로 `verifyCode` 10회 호출 → 10회 모두 정상 플로우 진입 (wrong pin 또는 성공)
      - 11회째 호출 시 `redis.incr`가 11 반환 → `BadRequestException` throw with `statusCode: 429` + `retryAfterMs > 0`
      - `sms:verify_count:+821012345678` 키 사용 확인
      - 첫 호출 시 `redis.expire('sms:verify_count:+821012345678', 900)` 호출됨
      - 11회째에는 Infobip verifyPin 호출 없이 사전 차단
      - dev mock 경로(000000)는 카운터 우회 — 11회 호출해도 전부 `{ verified: true }` (카운터 mock 호출 0건)

    describe('phone axis counter: dev mock bypass (D-15)'):
      - `NODE_ENV=development` + INFOBIP_* 미설정 (dev mock) → sendVerificationCode / verifyCode 모두 `redis.incr` 호출 없음
  </behavior>
  <description>Task 1에서 추가한 phone axis 카운터 로직(D-06 send 5/3600s, D-07 verify 10/900s)의 명시적 단위 테스트. Plan 01 Wave 0 스캐폴딩이 RED로 작성한 케이스(Plan 01 T3 Warning #6 fix)를 GREEN으로 전환하고, Task 1 코드가 실제로 INCR+EXPIRE 계약을 따르는지 회귀 방어.</description>
  <read_first>
    - apps/api/src/modules/sms/sms.service.spec.ts (Plan 01 Wave 0 RED 스캐폴딩 — send-code phone 5/h + verify-code phone 10/15min 케이스 추가됨)
    - apps/api/src/modules/sms/sms.service.ts (Task 1에서 추가된 카운터 로직)
    - .planning/phases/10-sms/10-CONTEXT.md D-06, D-07, D-15
    - .planning/phases/10-sms/10-RESEARCH.md §"Open Questions > #1 RESOLVED"
  </read_first>
  <action>
    Plan 01이 작성한 sms.service.spec.ts에 이미 phone 5/h / phone 10/15min 스켈레톤 케이스가 RED로 있어야 함 (Plan 01 T3 수정 후). 본 Task는 해당 describe 블록의 assertion 구체화 + GREEN 전환.

    mock 구조:
    ```typescript
    const mockRedis = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      pttl: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
    };
    ```

    각 테스트에서:
    - `mockRedis.set.mockResolvedValue('OK')` (cooldown acquired)
    - `mockRedis.incr.mockImplementation` 으로 순차적 값 반환 (1,2,3,...)
    - `mockRedis.expire.mockResolvedValue(1)`
    - `mockRedis.ttl.mockResolvedValue(3599)` (retryAfter 계산 assertion)
    - Infobip mock: send 6회째 호출 전 throw → `expect(mockSendPin).toHaveBeenCalledTimes(5)`

    dev mock 우회 테스트:
    - SmsService 생성자에 INFOBIP_* 미설정 + NODE_ENV='development' → `this.isDevMock === true`
    - sendVerificationCode / verifyCode 호출 후 `expect(mockRedis.incr).not.toHaveBeenCalled()` assertion

    모든 assertion 완료 후 `pnpm --filter @grapit/api test sms.service -- --run` 전부 GREEN.

    **주의사항:**
    - `-t` 필터 사용 시 테스트 이름 한글 인용부호 escape 주의 (예: `-t "phone 5/h throttle"`)
    - mock.calls로 redis.incr 인자 검증: `expect(mockRedis.incr).toHaveBeenCalledWith('sms:send_count:+821012345678')`
    - retryAfterMs 계산은 `ttl(seconds) * 1000`이므로 `ttl.mockResolvedValue(3599)` 시 retryAfterMs === 3599000 검증
  </action>
  <acceptance_criteria>
    - `grep -q "sms:send_count" apps/api/src/modules/sms/sms.service.ts` (구현 측)
    - `grep -q "sms:verify_count" apps/api/src/modules/sms/sms.service.ts` (구현 측)
    - `grep -q "phone 5/h\|phone 5/h throttle\|D-06" apps/api/src/modules/sms/sms.service.spec.ts` (spec에 케이스 존재)
    - `grep -q "phone 10/15min\|D-07" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "mockRedis.incr\|redis.incr" apps/api/src/modules/sms/sms.service.spec.ts`
    - `grep -q "sms:send_count:\|sms:verify_count:" apps/api/src/modules/sms/sms.service.spec.ts`
    - `pnpm --filter @grapit/api test sms.service.spec.ts -- --run -t "phone 5/h throttle"` exits 0
    - `pnpm --filter @grapit/api test sms.service.spec.ts -- --run -t "phone 10/15min throttle"` exits 0
    - `pnpm --filter @grapit/api test sms.service.spec.ts -- --run` 전 케이스 green (11 describe 블록 전부)
  </acceptance_criteria>
  <verify>
    <automated>pnpm --filter @grapit/api test sms.service.spec.ts -- --run 2>&1 | tail -20</automated>
  </verify>
  <requirements>SMS-01</requirements>
  <autonomous>true</autonomous>
  <commit>test(10-05): add phone axis counter tests (D-06 send 5/h, D-07 verify 10/15min)</commit>
  <done>sms.service.spec.ts에 phone axis counter describe 2 + dev mock bypass describe 1 추가, 전 케이스 GREEN, D-06/D-07 실 카운터 실 구현 검증 근거 확보</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| register/social-register → verifyCode 응답 | 응답 shape 회귀 시 phone 인증 우회 가능 |
| NODE_ENV + INFOBIP_* → dev mock vs production | 오탐지 시 production에서 `000000` 유니버설 코드로 가짜 phone 가입 가능 (Pitfall 2) |
| client phone 입력 → parseE164 → Valkey 키 | send와 verify 키 불일치 시 expired 오탐지 (Pitfall 3) |
| Sentry scope tag → 로그 | apiKey가 tag 값에 실수로 포함되면 secret leak |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-10-01 | Spoofing | Production silent dev fallback (`000000` bypass) | high | mitigate | `isProduction && missing.length > 0 → throw` hard-fail. `?.trim()` 처리로 빈 문자열 falsy. Plan 01 spec의 "Production hard-fail" describe 블록 전부 GREEN 필수 |
| T-10-02 | Tampering | Brute-force OTP guessing | high | mitigate | Infobip Application `pinAttempts=5` (D-12) + 본 Plan Task 1의 phone axis verify 10/900s Valkey INCR counter(D-07) + Plan 06 IP axis `@Throttle`. 3-layer — 본 plan의 phone 축이 다중 IP 우회 공격 방어 |
| T-10-03 | Tampering | SMS pumping (premium-rate fraud via 반복 send) | high | mitigate | 30s resend cooldown(Valkey SET NX, D-11) + 본 Plan Task 1의 phone axis send 5/3600s Valkey INCR counter(D-06) + Plan 06 IP axis 20/3600s + Infobip Application `sendPinPerPhoneNumberLimit=5/1h`. CN(+86) 차단으로 premium number 경로 차단. **phone 축 카운터가 Infobip 호출 전 차단 → 비용 유출 직접 방어** |
| T-10-04 | Information Disclosure | OTP enumeration | medium | accept | sendVerificationCode는 register 전 호출이므로 phone 등록 여부 검증 없음 — enumeration 표면 없음 |
| T-10-05 | Tampering | Replay attack (한 PIN 다회 사용) | medium | mitigate | verify 성공 시 `redis.del(sms:pin:{e164})` single-use 강제 |
| T-10-18 | Information Disclosure | Sentry scope tag에 secret 누출 | medium | mitigate | tag 값은 `country`, `http_status`, `infobip_code`만. `apiKey` 절대 미포함(코드 리뷰 확인) |
| T-10-19 | Tampering | phone normalization mismatch → expired 오탐지 | medium | mitigate | 모든 메서드 첫 줄 `parseE164(phone)` 호출. Plan 03의 phone.util spec으로 검증 |
| T-10-20 | Denial of Service | InMemoryRedis 미호환으로 dev throttle 깨짐 | medium | accept | dev mock 모드는 Redis 호출 skip으로 회피 (본 plan action 주석 명시). Plan 07에서 ThrottlerModule forRootAsync conditional storage로 대응 |

High severity 3건(T-10-01, T-10-02, T-10-03) 모두 본 plan에서 구체 완화 경로 제공 — spec GREEN이 검증 근거.
</threat_model>

<verification>
- `pnpm --filter @grapit/api test sms -- --run` 전부 green (sms.service, phone.util, infobip-client 합계)
- `pnpm --filter @grapit/api typecheck` green (twilio import 제거로 RED 해소)
- `pnpm --filter @grapit/api lint` 본 plan이 수정한 파일 기준 warning 0
</verification>

<success_criteria>
- SmsService 재작성 완료, 응답 shape 불변(auth.service.ts register/social-register 영향 0)
- sms.service.spec 9 describe 블록 전부 GREEN
- SmsModule BookingModule import로 REDIS_CLIENT DI 해결
- Twilio 코드 완전 제거 (`! grep -q Twilio apps/api/src/modules/sms/`)
</success_criteria>

<output>
Create `.planning/phases/10-sms/10-05-SUMMARY.md`: 재작성 diff 요약, hard-fail 검증 증거, 응답 shape 회귀 0 증거(auth.service.ts:71, 393 호출부 no-op 확인).
</output>
