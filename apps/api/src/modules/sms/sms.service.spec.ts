/**
 * Phase 10.1: Infobip /sms/3/messages v3 전환
 * - OTP 생성: crypto.randomInt (Math.random 금지, OWASP A02)
 * - 저장: Valkey `sms:otp:{e164}` TTL 180s
 * - Verify: Valkey Lua VERIFY_AND_INCREMENT_LUA atomic script
 * - Infobip verify API 사용 안 함 (자체 구현)
 *
 * RED 상태: Plan 04 실행 전까지 SmsService에 OTP/Lua verify 로직 미존재
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, GoneException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service.js';
import { InfobipClient, InfobipApiError } from './infobip-client.js';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: actual.randomInt };
});
import * as nodeCrypto from 'node:crypto';

// ---------- Mocks ----------
// [Issue 1 / PR #16 review] sendVerificationCode now uses redis.pipeline() to
// SET the new OTP and DEL sms:attempts:{e164} together. The mock pipeline must
// be chainable (set/del return `this`) and exec must resolve to ioredis-style
// [Error|null, unknown][] tuples.
const mockPipeline = {
  set: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};
const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  decr: vi.fn(),
  pttl: vi.fn(),
  eval: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
};

function createConfigService(overrides: Record<string, string | undefined> = {}): ConfigService {
  const config: Record<string, string | undefined> = {
    INFOBIP_API_KEY: 'test-key',
    INFOBIP_BASE_URL: 'https://test.api.infobip.com',
    INFOBIP_SENDER: '0212345678',
    NODE_ENV: 'test',
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => config[key]),
  } as unknown as ConfigService;
}

describe('SmsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env['NODE_ENV'] = 'test';
    // Re-establish chainable behavior on pipeline mocks (cleared by clearAllMocks)
    mockPipeline.set.mockReturnThis();
    mockPipeline.del.mockReturnThis();
    // Default exec result: both ops succeed (null error, OK/1 result)
    mockPipeline.exec.mockResolvedValue([
      [null, 'OK'],
      [null, 1],
    ]);
  });

  // ---------- constructor ----------
  describe('constructor', () => {
    it('production에서 INFOBIP_API_KEY 미설정 시 throw', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).toThrow(
        /INFOBIP_API_KEY.*required in production/,
      );
    });

    it('production에서 INFOBIP_BASE_URL 빈 문자열이면 throw', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_BASE_URL: '',
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).toThrow(
        /required in production/,
      );
    });

    it('production에서 INFOBIP_SENDER 누락 시 throw', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: undefined,
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).toThrow(
        /INFOBIP_SENDER.*required in production/,
      );
    });

    it('non-production에서 3종 전부 미설정이면 isDevMock=true', () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_SENDER: undefined,
        NODE_ENV: 'test',
      });

      const service = new SmsService(configService, mockRedis as never);
      expect(service).toBeDefined();
    });

    it('non-production이어도 legacy env(APPLICATION_ID, MESSAGE_ID)를 참조하지 않는다', () => {
      const configService = createConfigService();
      new SmsService(configService, mockRedis as never);

      const getCalls = (configService.get as ReturnType<typeof vi.fn>).mock.calls;
      const requestedKeys = getCalls.map((call: unknown[]) => call[0]);
      expect(requestedKeys).not.toContain('INFOBIP_APPLICATION_ID');
      expect(requestedKeys).not.toContain('INFOBIP_MESSAGE_ID');
    });

    // ---------- WR-03: INFOBIP_SENDER format validation ----------
    it('[WR-03] production에서 INFOBIP_SENDER가 알파벳 포함 시 throw (KR MNO silent rewrite 방지)', () => {
      // Alphanumeric senders are silently rewritten by KR MNOs — Infobip then
      // returns 4xx for every send, and our 4xx rollback policy keeps the
      // phone-axis counter (abuse mitigation), permanently draining quotas.
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: 'Grapit',
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).toThrow(
        /INFOBIP_SENDER must be a KISA-registered numeric ID/,
      );
    });

    it('[WR-03] production에서 INFOBIP_SENDER가 4자리 미만의 숫자이면 throw', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: '123',
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).toThrow(
        /INFOBIP_SENDER must be a KISA-registered numeric ID/,
      );
    });

    it('[WR-03] production에서 INFOBIP_SENDER 길이 3 이하 시에도 값은 마스킹됨 (로그 유출 방지)', () => {
      // Prior `length <= 3 ? sender : ${slice}***` branch leaked the full
      // value for 1-3 char inputs (e.g., "abc" was echoed verbatim into the
      // boot-time error -> Cloud Logging). Always mask.
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: 'abc',
        NODE_ENV: 'production',
      });

      try {
        new SmsService(configService, mockRedis as never);
        expect.fail('should throw');
      } catch (err) {
        const msg = (err as Error).message;
        // Full 3-char value must not appear verbatim.
        expect(msg).not.toContain('"abc"');
        // First 2 chars + *** is the canonical mask.
        expect(msg).toContain('ab***');
      }
    });

    it('[WR-03] production에서 INFOBIP_SENDER 길이 1-2 시에는 *** 전용 마스킹', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: 'x',
        NODE_ENV: 'production',
      });

      try {
        new SmsService(configService, mockRedis as never);
        expect.fail('should throw');
      } catch (err) {
        const msg = (err as Error).message;
        // Prefix would be the entire value — emit *** only.
        expect(msg).not.toContain('"x"');
        expect(msg).toContain('"***"');
      }
    });

    it('[WR-03] production에서 INFOBIP_SENDER가 숫자 4-15자리면 통과', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: '0212345678',
        NODE_ENV: 'production',
      });

      expect(() => new SmsService(configService, mockRedis as never)).not.toThrow();
    });

    it('[WR-03] production에서 INFOBIP_SENDER 에러 메시지는 sender 값을 마스킹 (로그 유출 방지)', () => {
      process.env['NODE_ENV'] = 'production';
      const configService = createConfigService({
        INFOBIP_SENDER: 'SECRETVALUE',
        NODE_ENV: 'production',
      });

      try {
        new SmsService(configService, mockRedis as never);
        expect.fail('should throw');
      } catch (err) {
        const msg = (err as Error).message;
        // Only first 2 chars leak as prefix; full value must not appear.
        expect(msg).not.toContain('SECRETVALUE');
        expect(msg).toContain('SE***');
      }
    });

    it('[WR-03] non-production에서는 INFOBIP_SENDER 형식 검사를 스킵', () => {
      // Dev-friendly: allow anything (including "TEST") in local/test envs.
      process.env['NODE_ENV'] = 'test';
      const configService = createConfigService({
        INFOBIP_SENDER: 'TESTSENDER',
        NODE_ENV: 'test',
      });

      expect(() => new SmsService(configService, mockRedis as never)).not.toThrow();
    });
  });

  // ---------- sendVerificationCode ----------
  describe('sendVerificationCode', () => {
    it('중국 본토(+86) 번호 reject -- BadRequestException', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      await expect(service.sendVerificationCode('+8613912345678')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('dev mock에서 성공 반환 (Infobip 호출 없음)', async () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_SENDER: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);
      const sendSmsSpy = vi.spyOn(InfobipClient.prototype, 'sendSms');

      const result = await service.sendVerificationCode('01012345678');
      expect(result.success).toBe(true);
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it('resend cooldown SET NX fail 시 HttpException(429)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce(null); // NX fail = cooldown active
      mockRedis.pttl.mockResolvedValueOnce(25000);

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow(
        HttpException,
      );
    });

    it('Infobip sendSms 성공 시 Valkey에 OTP 6자리 저장 (sms:otp:{e164}, TTL 180s)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter = 1 (within limit)

      vi.spyOn(nodeCrypto, 'randomInt').mockReturnValueOnce(654321);
      vi.spyOn(InfobipClient.prototype, 'sendSms').mockResolvedValueOnce({
        messageId: 'mid-123',
        status: 'MESSAGE_ACCEPTED',
        groupId: 1,
      });
      // OTP storage now goes through redis.pipeline().set(...).del(...).exec()
      // — see beforeEach for default exec resolution.

      const result = await service.sendVerificationCode('+821012345678');
      expect(result.success).toBe(true);
      expect(mockPipeline.set).toHaveBeenCalledWith(
        expect.stringContaining('sms:otp:'),
        '654321',
        'PX',
        180000,
      );
    });

    it('메시지 본문이 [Grapit] 인증번호 XXXXXX (3분 이내 입력) 포맷으로 전송됨', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(nodeCrypto, 'randomInt').mockReturnValueOnce(654321);
      const sendSmsSpy = vi.spyOn(InfobipClient.prototype, 'sendSms').mockResolvedValueOnce({
        messageId: 'mid-456',
        status: 'MESSAGE_ACCEPTED',
        groupId: 1,
      });
      // OTP set via pipeline (default exec result from beforeEach)

      await service.sendVerificationCode('+821012345678');
      expect(sendSmsSpy).toHaveBeenCalledWith(
        '+821012345678',
        '[Grapit] 인증번호 654321 (3분 이내 입력)',
      );
    });

    it('OTP 생성 시 Math.random 대신 crypto.randomInt 사용', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      const randomIntSpy = vi.spyOn(nodeCrypto, 'randomInt').mockReturnValueOnce(123456);
      vi.spyOn(InfobipClient.prototype, 'sendSms').mockResolvedValueOnce({
        messageId: 'mid-789',
        status: 'MESSAGE_ACCEPTED',
        groupId: 1,
      });
      // OTP set via pipeline (default exec result from beforeEach)

      await service.sendVerificationCode('+821012345678');
      expect(randomIntSpy).toHaveBeenCalledWith(100000, 1000000);
    });

    it('Infobip sendSms 5xx 시 cooldown key DEL rollback', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(InfobipClient.prototype, 'sendSms').mockRejectedValueOnce(
        new InfobipApiError(500, 'Internal Server Error'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('sms:resend:'),
      );
    });

    it('Infobip sendSms 4xx 시 cooldown key 유지 (DEL 미호출)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(InfobipClient.prototype, 'sendSms').mockRejectedValueOnce(
        new InfobipApiError(400, 'Bad Request'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(mockRedis.del).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:resend:'),
      );
    });

    // ---------- Issue 2 (PR #16 review): phone-axis send counter rollback ----------
    it('Infobip sendSms 5xx 시 sms:phone:send:{e164} 카운터도 DECR rollback', async () => {
      // sms:phone:send:{e164} (5/3600s) was INCR'd before calling Infobip but
      // never decremented when the call failed transiently. A series of 5xx
      // errors could exhaust the user's hourly quota despite no SMS delivery.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK
      mockRedis.del.mockResolvedValueOnce(1); // cooldown DEL rollback resolves
      mockRedis.decr.mockResolvedValueOnce(0); // counter DECR rollback resolves

      vi.spyOn(InfobipClient.prototype, 'sendSms').mockRejectedValueOnce(
        new InfobipApiError(500, 'Internal Server Error'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(mockRedis.decr).toHaveBeenCalledWith(
        'sms:phone:send:+821012345678',
      );
    });

    it('Infobip sendSms 4xx 시 sms:phone:send: 카운터 유지 (DECR 미호출, 악용 방지)', async () => {
      // 4xx (incl. groupId=5 REJECTED converted by InfobipClient) is a
      // permanent rejection. Keep the counter so an abuser can't rapid-fire
      // REJECTED responses to drain real users' quotas.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(InfobipClient.prototype, 'sendSms').mockRejectedValueOnce(
        new InfobipApiError(400, 'REJECTED'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(mockRedis.decr).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:phone:send:'),
      );
    });

    it('non-InfobipApiError (network down 등) 시 sms:phone:send: 카운터 DECR rollback', async () => {
      // Matches existing shouldRollback logic: !(err instanceof InfobipApiError)
      // || err.status >= 500. Network/timeout errors should release the slot.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK
      mockRedis.del.mockResolvedValueOnce(1); // cooldown DEL rollback resolves
      mockRedis.decr.mockResolvedValueOnce(0); // counter DECR rollback resolves

      vi.spyOn(InfobipClient.prototype, 'sendSms').mockRejectedValueOnce(
        new Error('network down'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(mockRedis.decr).toHaveBeenCalledWith(
        'sms:phone:send:+821012345678',
      );
    });

    it('phone axis send counter Lua INCR: 6번째 호출 429', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass

      mockRedis.eval.mockResolvedValueOnce(6); // limit 5 초과

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow(
        HttpException,
      );
    });

    it('phone axis send counter Lua에 sms:phone:send: prefix 키 전달', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValue('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter = 1

      vi.spyOn(nodeCrypto, 'randomInt').mockReturnValueOnce(999999);
      vi.spyOn(InfobipClient.prototype, 'sendSms').mockResolvedValueOnce({
        messageId: 'mid-000',
        status: 'MESSAGE_ACCEPTED',
        groupId: 1,
      });

      await service.sendVerificationCode('+821012345678');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        expect.any(Number),
        expect.stringContaining('sms:phone:send:'),
        expect.any(Number),
      );
    });

    // ---------- Issue 1 (PR #16 review): sms:attempts reset on new OTP ----------
    it('신규 OTP 저장 시 sms:attempts:{e164}를 함께 DEL (재발송 후 5회 시도 보장)', async () => {
      // sms:attempts:{e164} TTL is 900s (set inside VERIFY_AND_INCREMENT_LUA),
      // longer than OTP TTL 180s. Without this DEL, a user who failed N
      // attempts on OTP#1 and then re-sends would start OTP#2 with attempts=N
      // already counted — the very first verify on OTP#2 could trigger
      // NO_MORE_ATTEMPTS. The pipeline keeps SET + DEL adjacent.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(nodeCrypto, 'randomInt').mockReturnValueOnce(424242);
      vi.spyOn(InfobipClient.prototype, 'sendSms').mockResolvedValueOnce({
        messageId: 'mid-att',
        status: 'MESSAGE_ACCEPTED',
        groupId: 1,
      });

      const result = await service.sendVerificationCode('+821012345678');

      expect(result.success).toBe(true);
      // Pipeline used (single round trip)
      expect(mockRedis.pipeline).toHaveBeenCalled();
      // SET OTP with TTL 180s
      expect(mockPipeline.set).toHaveBeenCalledWith(
        'sms:otp:+821012345678',
        '424242',
        'PX',
        180000,
      );
      // DEL stale attempts counter
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'sms:attempts:+821012345678',
      );
      // Success path must NOT release the cooldown (handled separately)
      expect(mockRedis.del).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:resend:'),
      );
    });

    it('OTP pipeline exec 에러 시 Infobip sendSms 미호출 (보안: 미저장 OTP로 SMS 보내지 않음)', async () => {
      // Defense-in-depth: if Valkey is down at pipeline.exec(), the OTP was
      // never stored. We must NOT send the SMS — the user would receive a
      // code they cannot verify.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK
      // Pipeline exec reports an error on the SET op
      mockPipeline.exec.mockResolvedValueOnce([
        [new Error('valkey down'), null],
        [null, 1],
      ]);
      mockRedis.del.mockResolvedValueOnce(1); // cooldown DEL rollback resolves
      mockRedis.decr.mockResolvedValueOnce(0); // counter DECR rollback resolves

      const sendSmsSpy = vi.spyOn(InfobipClient.prototype, 'sendSms');

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      expect(sendSmsSpy).not.toHaveBeenCalled();
    });
  });

  // ---------- verifyCode ----------
  describe('verifyCode', () => {
    it('dev mock에서 000000 성공', async () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_SENDER: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);

      const result = await service.verifyCode('01012345678', '000000');
      expect(result.verified).toBe(true);
    });

    it('dev mock에서 잘못된 코드 실패', async () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_SENDER: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);

      const result = await service.verifyCode('01012345678', '111111');
      expect(result.verified).toBe(false);
    });

    it('phone axis verify counter: 11번째 호출에서 429 (D-07)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(11); // limit 10 초과

      await expect(service.verifyCode('+821012345678', '123456')).rejects.toThrow(
        HttpException,
      );
    });

    it('Lua VERIFY_AND_INCREMENT 결과 ["VERIFIED", attempts] 시 verified: true + sms:verified:{e164} TTL 600s 저장', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(1); // phone axis verify counter OK
      mockRedis.eval.mockResolvedValueOnce(['VERIFIED', 1]); // VERIFY_AND_INCREMENT result

      const result = await service.verifyCode('+821012345678', '123456');
      expect(result.verified).toBe(true);

      // Lua script includes SETEX for sms:verified internally,
      // or service calls redis.set for sms:verified key
      // Either way, the verify script must reference sms:verified pattern
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('KEYS'),
        expect.any(Number),
        expect.stringContaining('sms:otp:'),
        expect.stringContaining('sms:attempts:'),
        expect.stringContaining('sms:verified:'),
        expect.any(String), // user code
        expect.any(String), // max attempts
        expect.any(String), // verified TTL
      );
    });

    it('Lua 결과 ["WRONG", remaining] 시 verified: false 반환', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(1); // phone axis verify counter OK
      mockRedis.eval.mockResolvedValueOnce(['WRONG', 3]); // VERIFY_AND_INCREMENT result

      const result = await service.verifyCode('+821012345678', '000000');
      expect(result.verified).toBe(false);
      expect(result.message).toContain('인증번호가 일치하지 않습니다');
    });

    it('Lua 결과 ["EXPIRED", 0] 시 GoneException', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(1); // phone axis verify counter OK
      mockRedis.eval.mockResolvedValueOnce(['EXPIRED', 0]); // VERIFY_AND_INCREMENT result

      await expect(service.verifyCode('+821012345678', '123456')).rejects.toThrow(
        GoneException,
      );
    });

    it('Lua 결과 ["NO_MORE_ATTEMPTS", 0] 시 GoneException', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(1); // phone axis verify counter OK
      mockRedis.eval.mockResolvedValueOnce(['NO_MORE_ATTEMPTS', 0]); // VERIFY_AND_INCREMENT result

      await expect(service.verifyCode('+821012345678', '999999')).rejects.toThrow(
        GoneException,
      );
    });

    it('Infobip verifyPin을 호출하지 않는다 (Valkey Lua 자체 검증)', () => {
      expect(InfobipClient.prototype).not.toHaveProperty('verifyPin');
    });

    // ---------- WR-04: verify-counter rollback on Valkey eval failure ----------
    it('[WR-04] Lua eval 실패 시 sms:phone:verify: 카운터 DECR rollback', async () => {
      // Transient Valkey failure (network blip, eval error) must release the
      // phone-axis verify slot that atomicIncr consumed before the Lua call.
      // Without this, each failure burns one of the user's 10/15min attempts
      // without delivering a verification outcome.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval
        .mockResolvedValueOnce(1)                                    // phone-axis counter
        .mockRejectedValueOnce(new Error('valkey eval transient'));  // Lua fails
      mockRedis.decr.mockResolvedValueOnce(0); // rollback resolves

      const result = await service.verifyCode('+821012345678', '123456');

      expect(result.verified).toBe(false);
      expect(mockRedis.decr).toHaveBeenCalledWith(
        'sms:phone:verify:+821012345678',
      );
    });

    it('[WR-04] GoneException은 verify 카운터를 rollback하지 않는다', async () => {
      // EXPIRED/NO_MORE_ATTEMPTS는 정상적인 검증 outcome이므로 카운터를 소모.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval
        .mockResolvedValueOnce(1)                  // phone-axis counter
        .mockResolvedValueOnce(['EXPIRED', 0]);    // OTP expired (legit outcome)

      await expect(
        service.verifyCode('+821012345678', '123456'),
      ).rejects.toThrow(GoneException);

      // DECR must NOT have been called — this is a legitimate verify outcome.
      expect(mockRedis.decr).not.toHaveBeenCalledWith(
        'sms:phone:verify:+821012345678',
      );
    });

    // ---------- WR-02: enumeration resistance on sms:verified flag ----------
    it('[WR-02] phone-axis 카운터는 Lua OTP 검증보다 먼저 INCR (enumeration 방지)', async () => {
      // If any verify branch runs before the rate-limit counter, an attacker
      // can probe arbitrary phones and learn which ones verified within the
      // last 10min based on the response shape. Ordering must be:
      // atomicIncr(phone_axis_verify) -> Lua VERIFY_AND_INCREMENT.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      // First eval call = phone-axis counter returns 1 (within limit).
      // Second eval call = Lua VERIFY_AND_INCREMENT result.
      mockRedis.eval
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(['WRONG', 4]);

      const result = await service.verifyCode('+821012345678', '000000');
      expect(result.verified).toBe(false);

      // Counter must have been incremented for this phone, ordered first.
      expect(mockRedis.eval).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INCR'),
        expect.any(Number),
        'sms:phone:verify:+821012345678',
        expect.any(Number),
      );
    });

    it('[WR-02] phone-axis 카운터 초과 시 429 (Lua 검증 미도달)', async () => {
      // Attacker-scenario regression: the 11th probe in the 15min window must
      // be rate-limited regardless of OTP state. Without counter-first
      // ordering, enumeration is unbounded.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval.mockResolvedValueOnce(11); // counter > 10

      await expect(service.verifyCode('+821012345678', '000000')).rejects.toThrow(
        HttpException,
      );

      // Only the counter eval should have run; Lua VERIFY_AND_INCREMENT must not.
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });

    // ---------- CR-01: no short-circuit on sms:verified flag ----------
    it('[CR-01] sms:verified 플래그가 세팅돼 있어도 잘못된 code는 거부 (impersonation 방지)', async () => {
      // PREVIOUS BUG: when `sms:verified:{e164}` == '1', verifyCode returned
      // `{ verified: true }` for ANY submitted code (including "000000") for
      // the 600s flag TTL. This allowed anyone who knew a recently-verified
      // phone to spoof verification on signup/password-reset.
      //
      // Fix: short-circuit removed. Every verify call must pass Lua
      // VERIFY_AND_INCREMENT with the correct stored OTP.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval
        .mockResolvedValueOnce(1)                       // phone-axis counter
        .mockResolvedValueOnce(['WRONG', 4]);           // Lua: wrong code

      // Even if redis.get('sms:verified:...') would have returned '1'
      // (simulating a recently-verified phone), the code path must not
      // consult it — and must return verified:false for a wrong code.
      mockRedis.get.mockResolvedValue('1');

      const result = await service.verifyCode('+821012345678', '000000');

      expect(result.verified).toBe(false);
      // sms:verified flag MUST NOT be consulted (no short-circuit path).
      expect(mockRedis.get).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:verified:'),
      );
    });

    it('[CR-01] sms:verified 플래그가 세팅돼 있어도 올바른 Lua VERIFIED 응답만 verified:true', async () => {
      // Positive regression: the legitimate path still works — the Lua script
      // DEL'd OTP on first VERIFIED so idempotent re-verify against the same
      // OTP returns EXPIRED (GoneException). That is the documented trade-off
      // of the CR-01 short-term mitigation.
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      mockRedis.eval
        .mockResolvedValueOnce(1)                       // phone-axis counter
        .mockResolvedValueOnce(['EXPIRED', 0]);         // OTP already consumed

      // sms:verified flag set from a prior verify.
      mockRedis.get.mockResolvedValue('1');

      await expect(
        service.verifyCode('+821012345678', '123456'),
      ).rejects.toThrow(GoneException);

      // Flag must not have short-circuited the GoneException.
      expect(mockRedis.get).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:verified:'),
      );
    });
  });
});
