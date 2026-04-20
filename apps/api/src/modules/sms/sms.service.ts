import {
  Inject, Injectable, BadRequestException, GoneException, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { randomInt } from 'node:crypto';
import type IORedis from 'ioredis';
import { REDIS_CLIENT } from '../booking/providers/redis.provider.js';
import { InfobipClient, InfobipApiError } from './infobip-client.js';
import { parseE164, isChinaMainland } from './phone.util.js';

// Phase 10 constants (retained)
const RESEND_COOLDOWN_MS = 30_000;           // D-11: 30s resend cooldown
const SEND_PHONE_LIMIT = 5;                  // D-06: phone 5/3600s
const SEND_PHONE_WINDOW_SEC = 3600;          // D-06: 1h window
const VERIFY_PHONE_LIMIT = 10;               // D-07: phone 10/900s
const VERIFY_PHONE_WINDOW_SEC = 900;         // D-07: 15min window

// Phase 10.1 new constants
const OTP_TTL_MS = 180_000;                  // 3min -- matches message copy
const OTP_MAX_ATTEMPTS = 5;                  // replaces Infobip pinAttempts
const VERIFIED_FLAG_TTL_SEC = 600;           // verified flag 10min for signup re-check

/**
 * [Phase 10] Lua atomic INCR + conditional EXPIRE for phone axis rate-limit counters.
 * First INCR (result==1) sets TTL. Already-existing keys are incremented only.
 * Prevents zombie keys on process crash.
 * Returns: current count (number).
 */
const ATOMIC_INCR_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return count
`;

/**
 * [Phase 10.1 NEW] Atomic OTP verify + attempt counter + verified flag.
 * KEYS:
 *   [1] sms:otp:{e164}
 *   [2] sms:attempts:{e164}
 *   [3] sms:verified:{e164}
 * ARGV:
 *   [1] user-provided code (6 digits)
 *   [2] max attempts (e.g. '5')
 *   [3] verified flag TTL seconds (e.g. '600')
 * Returns: [result_string, number]
 *   {'VERIFIED', attempts}        -- correct. otp/attempts DEL, verified SETEX.
 *   {'WRONG', remaining}          -- wrong. attempts INCR(+EXPIRE if first).
 *   {'EXPIRED', 0}                -- otp expired/missing.
 *   {'NO_MORE_ATTEMPTS', 0}       -- exceeded. otp/attempts DEL.
 */
const VERIFY_AND_INCREMENT_LUA = `
local stored = redis.call('GET', KEYS[1])
if stored == false then
  return {'EXPIRED', 0}
end

local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[2], 900)
end

local max = tonumber(ARGV[2])
if attempts > max then
  redis.call('DEL', KEYS[1], KEYS[2])
  return {'NO_MORE_ATTEMPTS', 0}
end

if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('SETEX', KEYS[3], tonumber(ARGV[3]), '1')
  return {'VERIFIED', attempts}
end

return {'WRONG', max - attempts}
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
    // Phase 10.1: env 3 vars (APPLICATION_ID/MESSAGE_ID removed, SENDER added)
    const apiKey  = configService.get<string>('INFOBIP_API_KEY')?.trim()  ?? '';
    const baseUrl = configService.get<string>('INFOBIP_BASE_URL')?.trim() ?? '';
    const sender  = configService.get<string>('INFOBIP_SENDER')?.trim()   ?? '';
    const isProduction = process.env['NODE_ENV'] === 'production';

    const missing = [
      !apiKey  && 'INFOBIP_API_KEY',
      !baseUrl && 'INFOBIP_BASE_URL',
      !sender  && 'INFOBIP_SENDER',
    ].filter(Boolean) as string[];

    if (isProduction && missing.length > 0) {
      throw new Error(
        `[sms] ${missing.join(', ')} required in production. Silent dev mock disabled.`,
      );
    }

    // [WR-03] In production, reject alphanumeric sender IDs. KR MNOs silently
    // rewrite non-numeric senders, which causes Infobip to return 4xx for every
    // send. Our rollback policy keeps the phone-axis counter on 4xx (abuse
    // mitigation), so a sender-ID typo like `INFOBIP_SENDER=Grapit` would
    // permanently drain every user's 5/hour quota with zero delivery.
    // KISA-registered numeric senders (landline or pre-approved short codes)
    // are typically 4-15 digits. If Grapit adds non-KR routes later, relax
    // this to "numeric OR <= 11 alphanumeric chars" per Infobip sender-ID docs.
    if (isProduction && sender && !/^[0-9]{4,15}$/.test(sender)) {
      const masked = sender.length <= 3 ? sender : `${sender.slice(0, 2)}***`;
      throw new Error(
        `[sms] INFOBIP_SENDER must be a KISA-registered numeric ID (got "${masked}"). ` +
          'Alphanumeric senders are silently rewritten by KR MNOs and cause every send ' +
          'to fail with Infobip 4xx, draining users\' hourly quotas.',
      );
    }

    this.isDevMock = !isProduction && missing.length > 0;
    this.client = this.isDevMock ? null : new InfobipClient(baseUrl, apiKey, sender);

    if (this.isDevMock) {
      this.logger.warn({ event: 'sms.credential_missing', mode: 'dev_mock' });
    }
  }

  /**
   * [Phase 10] Atomic INCR + conditional EXPIRE via Lua.
   * Returns current count.
   */
  private async atomicIncr(key: string, windowSec: number): Promise<number> {
    return (await this.redis.eval(
      ATOMIC_INCR_LUA, 1, key, windowSec,
    )) as number;
  }

  /**
   * [Phase 10.1] 6-digit OTP. node:crypto.randomInt (OWASP A02 -- CSPRNG).
   */
  private generateOtp(): string {
    return String(randomInt(100000, 1000000));
  }

  async sendVerificationCode(phone: string): Promise<SendResult> {
    const e164 = parseE164(phone);

    // D-03: China mainland reject
    if (isChinaMainland(e164)) {
      throw new BadRequestException(
        '현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요',
      );
    }

    // Dev mock -- cooldown/counter/Infobip all skipped
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
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: Math.max(ttl, 0) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // D-06: phone axis send 5/3600s -- Lua atomic INCR+EXPIRE
    const sendCount = await this.atomicIncr(
      `sms:phone:send:${e164}`, SEND_PHONE_WINDOW_SEC,
    );
    if (sendCount > SEND_PHONE_LIMIT) {
      this.logger.warn({
        event: 'sms.rate_limited', phone: e164, layer: 'phone_axis_send', count: sendCount,
      });
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: SEND_PHONE_WINDOW_SEC * 1000 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // [Phase 10.1] Self-managed OTP generation + Valkey storage
    const otp = this.generateOtp();
    const text = `[Grapit] 인증번호 ${otp} (3분 이내 입력)`;

    try {
      // Store OTP first -- SMS delivery only matters after user receives it.
      // On sendSms failure, OTP naturally expires via TTL 180s. Next send overwrites.
      //
      // [Issue 1 / PR #16 review] Reset attempts counter atomically with new
      // OTP storage. sms:attempts:{e164} TTL is 900s (set inside
      // VERIFY_AND_INCREMENT_LUA on first INCR), longer than OTP TTL 180s.
      // Without this DEL, a user who failed N attempts on OTP#1 and then
      // re-sends would start OTP#2 with attempts=N already counted in Valkey
      // — the very first verify on the fresh OTP could trigger
      // NO_MORE_ATTEMPTS.
      //
      // ioredis pipeline keeps both ops in a single round trip and adjacent.
      // The verify path reads OTP first (KEYS[1]), so a Lua script is not
      // required — pipeline ordering is observably atomic for the consumer.
      const pipeline = this.redis.pipeline();
      pipeline.set(`sms:otp:${e164}`, otp, 'PX', OTP_TTL_MS);
      pipeline.del(`sms:attempts:${e164}`);
      const results = await pipeline.exec();
      // ioredis pipeline.exec returns Array<[Error|null, unknown]> | null.
      // Treat any op error as a failed send — flow into the catch below so the
      // SMS is NOT sent (otherwise the user would receive an unverifiable code).
      //
      // [WR-01] Guard against null per-entry: older @types/ioredis and
      // defensive codepaths in the repo elsewhere type entries as
      // `[Error|null, unknown] | null`. If Valkey returns null for a single op
      // (e.g. mid-pipeline connection reset), destructuring would throw a
      // TypeError inside `.some` and skip the "pipeline failed" guard. Use
      // index access instead of destructuring so null entries are handled
      // uniformly.
      if (!results || results.some((r) => !r || r[0])) {
        throw new Error('Failed to store OTP / reset attempts in Valkey');
      }

      await this.client!.sendSms(e164, text);
      this.logger.log({ event: 'sms.sent', phone: e164 });
      return { success: true, message: '인증번호가 발송되었습니다' };
    } catch (err) {
      // [Phase 10 review + Issue 2] Rollback policy
      // 5xx/timeout/network -> user didn't receive SMS -> release BOTH the
      //   30s cooldown AND the phone-axis hourly send slot. Otherwise a
      //   transient Infobip outage would burn the user's 5/hour quota
      //   without delivering anything (Issue 2 from PR #16 review).
      // 4xx (incl. groupId=5 REJECTED, converted by InfobipClient) -> permanent
      //   rejection -> keep both cooldown and counter (abuse mitigation).
      const shouldRollback =
        !(err instanceof InfobipApiError) || err.status >= 500;
      if (shouldRollback) {
        await Promise.all([
          this.redis.del(cooldownKey).catch(() => { /* best effort */ }),
          this.redis
            .decr(`sms:phone:send:${e164}`)
            .catch(() => { /* best effort */ }),
        ]);
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

  /**
   * Verify a user-supplied OTP against the Valkey-stored code.
   *
   * SECURITY NOTE: `verifyCode` is NOT a standalone authentication primitive.
   * A `{ verified: true }` response means "this phone successfully verified an
   * OTP within the last 10 minutes" — it does NOT prove that the CURRENT
   * request originated from the device that completed the original send/verify
   * handshake. Consumers (signup, password-reset) MUST correlate the verify
   * response with the session/state that initiated `/send-code` (e.g. a
   * server-issued token bound to the phone at verify-time). Without such
   * correlation, anyone who knows a just-verified phone number can spoof the
   * "verified" signal.
   *
   * Additionally, the phone-axis verify counter (D-07 — 10/900s) is
   * incremented BEFORE any idempotent-verify short-circuit to prevent a 10-min
   * enumeration oracle: without this ordering, an attacker could POST
   * `/verify-code { phone, code: "000000" }` for arbitrary phones and
   * distinguish verified-within-10min vs not based on response shape,
   * regardless of the code supplied.
   */
  async verifyCode(phone: string, code: string): Promise<VerifyResult> {
    const e164 = parseE164(phone);

    // Dev mock: 000000 universal
    if (this.isDevMock) {
      if (code === '000000') {
        this.logger.log({ event: 'sms.verified', mode: 'dev_mock', phone: e164 });
        return { verified: true };
      }
      return { verified: false, message: '인증번호가 일치하지 않습니다' };
    }

    // [WR-02] D-07 rate limit MUST run before any short-circuit — it is the
    // only signal that resists enumeration of the `sms:verified:{e164}` flag.
    // If we checked the verified flag first and returned early, the counter
    // would not increment and an attacker could probe unlimited phones to
    // distinguish "verified within last 10 min" vs not.
    const verifyCount = await this.atomicIncr(
      `sms:phone:verify:${e164}`, VERIFY_PHONE_WINDOW_SEC,
    );
    if (verifyCount > VERIFY_PHONE_LIMIT) {
      this.logger.warn({
        event: 'sms.rate_limited', phone: e164, layer: 'phone_axis_verify', count: verifyCount,
      });
      throw new HttpException(
        { statusCode: 429, message: '잠시 후 다시 시도해주세요', retryAfterMs: VERIFY_PHONE_WINDOW_SEC * 1000 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // [CR-01] SECURITY: previously we short-circuited to `{ verified: true }`
    // whenever `sms:verified:{e164}` was '1', regardless of the submitted code.
    // During the 600s flag TTL, any caller who knew a recently-verified phone
    // could pass verification with `code: "000000"` (or anything). This was an
    // impersonation primitive against every downstream consumer of verifyCode
    // (signup, password-reset, etc.).
    //
    // Short-term mitigation: remove the short-circuit entirely. Every verify
    // call must evaluate the Lua script against the actual OTP. Idempotent
    // re-verify after a successful first pass returns EXPIRED (GoneException)
    // because the OTP was DEL'd — downstream consumers should treat that as
    // "already verified" via explicit check OR re-send.
    //
    // The `sms:verified:{e164}` flag is still SETEX'd inside the Lua script on
    // VERIFIED; it remains available for downstream consumers to query
    // explicitly if they need an idempotency signal, but it no longer gates
    // the verify-response. Long-term plan (WR-02 follow-up): issue a
    // server-bound opaque token at verify-time and require it on downstream
    // endpoints.

    // [Phase 10.1] Valkey Lua atomic OTP verify
    try {
      const result = (await this.redis.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        `sms:otp:${e164}`,
        `sms:attempts:${e164}`,
        `sms:verified:${e164}`,
        code,
        String(OTP_MAX_ATTEMPTS),
        String(VERIFIED_FLAG_TTL_SEC),
      )) as [string, number];

      const [status] = result;
      switch (status) {
        case 'VERIFIED':
          this.logger.log({ event: 'sms.verified', phone: e164, attempts: result[1] });
          return { verified: true };
        case 'WRONG':
          this.logger.warn({ event: 'sms.verify_wrong', phone: e164, remaining: result[1] });
          return { verified: false, message: '인증번호가 일치하지 않습니다' };
        case 'EXPIRED':
          throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
        case 'NO_MORE_ATTEMPTS':
          this.logger.warn({ event: 'sms.verify_exhausted', phone: e164 });
          throw new GoneException('인증번호가 만료되었습니다. 재발송해주세요');
        default: {
          // Unreachable -- Lua script returns one of the above.
          const exhaustive: never = status as never;
          throw new Error(`Unknown VERIFY_AND_INCREMENT result: ${exhaustive}`);
        }
      }
    } catch (err) {
      if (err instanceof GoneException) throw err;
      // Valkey eval failure etc. -- log + propagate as user-facing generic message
      Sentry.withScope((scope) => {
        scope.setTag('provider', 'valkey');
        scope.setLevel('error');
        Sentry.captureException(err);
      });
      this.logger.error({ event: 'sms.verify_failed', phone: e164, err: (err as Error).message });
      return { verified: false, message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' };
    }
  }
}
