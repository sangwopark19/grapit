import {
  Inject, Injectable, BadRequestException, GoneException, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type IORedis from 'ioredis';
import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';
import { InfobipClient, InfobipApiError } from './infobip-client.js';
import { parseE164, isChinaMainland } from './phone.util.js';

const RESEND_COOLDOWN_MS = 30_000;           // D-11: 30s resend cooldown
const PIN_MAPPING_TTL_MS = 200_000;          // PIN 180s + 20s clock skew
const SEND_PHONE_LIMIT = 5;                  // D-06: phone 5/3600s
const SEND_PHONE_WINDOW_SEC = 3600;          // D-06: 1h window
const VERIFY_PHONE_LIMIT = 10;               // D-07: phone 10/900s
const VERIFY_PHONE_WINDOW_SEC = 900;         // D-07: 15min window

/**
 * [Review #3 HIGH] Lua script: atomic INCR + conditional EXPIRE
 * 첫 INCR(결과=1)이면 EXPIRE 설정. 이미 존재하면 INCR만.
 * 프로세스 crash 시 TTL 없는 좀비 key 방지.
 * Returns: current count (number)
 */
const ATOMIC_INCR_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return count
`;

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
    // D-14, D-16: 4 env 전부 검증. Pitfall 2: ?.trim() 빈 문자열도 falsy
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
    this.client = this.isDevMock
      ? null
      : new InfobipClient(baseUrl, apiKey, applicationId, messageId);

    if (this.isDevMock) {
      this.logger.warn({ event: 'sms.credential_missing', mode: 'dev_mock' });
    }
  }

  /**
   * [Review #3] Atomic INCR + conditional EXPIRE via Lua.
   * Returns current count.
   */
  private async atomicIncr(key: string, windowSec: number): Promise<number> {
    const result = await this.redis.eval(
      ATOMIC_INCR_LUA, 1, key, windowSec,
    ) as number;
    return result;
  }

  async sendVerificationCode(phone: string): Promise<SendResult> {
    const e164 = parseE164(phone);

    // D-03: China mainland reject
    if (isChinaMainland(e164)) {
      throw new BadRequestException(
        '현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요',
      );
    }

    // Dev mock -- cooldown/counter skip
    if (this.isDevMock) {
      this.logger.log({ event: 'sms.sent', mode: 'dev_mock', phone: e164 });
      return { success: true, message: '인증번호가 발송되었습니다' };
    }

    // D-11: 30s resend cooldown via Valkey SET NX
    const cooldownKey = `sms:resend:${e164}`;
    const acquired = await this.redis.set(cooldownKey, '1', 'PX', RESEND_COOLDOWN_MS, 'NX');
    if (acquired === null) {
      const ttl = await this.redis.pttl(cooldownKey);
      this.logger.warn({ event: 'sms.rate_limited', phone: e164, layer: 'resend_cooldown' });
      // [Review #7] HTTP 429 통일: BadRequestException(400) -> HttpException(429)
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: Math.max(ttl, 0) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // D-06: phone axis send 5/3600s -- [Review #3] Lua atomic INCR+EXPIRE
    const sendCount = await this.atomicIncr(
      `sms:phone:send:${e164}`, SEND_PHONE_WINDOW_SEC,
    );
    if (sendCount > SEND_PHONE_LIMIT) {
      this.logger.warn({ event: 'sms.rate_limited', phone: e164, layer: 'phone_axis_send', count: sendCount });
      // [Review #7] HTTP 429 통일: BadRequestException(400) -> HttpException(429)
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: SEND_PHONE_WINDOW_SEC * 1000 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Production: call Infobip
    try {
      const res = await this.client!.sendPin(e164);
      await this.redis.set(`sms:pin:${e164}`, res.pinId, 'PX', PIN_MAPPING_TTL_MS);
      this.logger.log({ event: 'sms.sent', phone: e164, pinId: res.pinId });
      return { success: true, message: '인증번호가 발송되었습니다' };
    } catch (err) {
      // [Review #1 HIGH] Cooldown key rollback on failure
      // 5xx/timeout/network -> 사용자가 SMS 미수신인데 30s 차단 방지 -> cooldown DEL
      // 4xx(Infobip bad request) -> 사용자 실수/abuse 의심 -> cooldown 유지
      const shouldRollbackCooldown =
        !(err instanceof InfobipApiError) || err.status >= 500;
      if (shouldRollbackCooldown) {
        await this.redis.del(cooldownKey).catch(() => {/* best effort */});
      }

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

    // D-07: phone axis verify 10/900s -- [Review #3] Lua atomic INCR+EXPIRE
    const verifyCount = await this.atomicIncr(
      `sms:phone:verify:${e164}`, VERIFY_PHONE_WINDOW_SEC,
    );
    if (verifyCount > VERIFY_PHONE_LIMIT) {
      this.logger.warn({ event: 'sms.rate_limited', phone: e164, layer: 'phone_axis_verify', count: verifyCount });
      // [Review #7] HTTP 429 통일: BadRequestException(400) -> HttpException(429)
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: VERIFY_PHONE_WINDOW_SEC * 1000 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Lookup phone -> pinId
    const pinId = await this.redis.get(`sms:pin:${e164}`);
    if (!pinId) {
      throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
    }

    try {
      const res = await this.client!.verifyPin(pinId, code);
      if (res.verified) {
        await this.redis.del(`sms:pin:${e164}`);
        this.logger.log({ event: 'sms.verified', phone: e164 });
        return { verified: true };
      }
      // [Review #2] OTP max 5 attempts는 Infobip Application pinAttempts=5 위임.
      // 앱 레벨 attempt counter 의도적 미구현.
      // Infobip이 서버 사이드에서 5회 초과 시 PIN 즉시 무효화.
      // DEPLOY-CHECKLIST.md ss3 'pinAttempts: 5' 참조.
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
        if (err instanceof InfobipApiError) scope.setTag('http_status', String(err.status));
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.verify_failed', phone: e164, err: (err as Error).message });
      return { verified: false, message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' };
    }
  }
}
