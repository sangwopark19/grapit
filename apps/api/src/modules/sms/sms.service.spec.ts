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
const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  decr: vi.fn(),
  pttl: vi.fn(),
  eval: vi.fn(),
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
      mockRedis.set.mockResolvedValueOnce('OK'); // OTP redis set

      const result = await service.sendVerificationCode('+821012345678');
      expect(result.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
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
      mockRedis.set.mockResolvedValueOnce('OK'); // OTP redis set

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
      mockRedis.set.mockResolvedValueOnce('OK'); // OTP redis set

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
  });
});
