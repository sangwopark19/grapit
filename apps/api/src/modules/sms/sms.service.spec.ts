import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, GoneException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Plan 05에서 GREEN 전환 예정 (Infobip 기반 재작성)
import { SmsService } from './sms.service.js';
// Plan 04에서 구현 예정
import { InfobipClient, InfobipApiError } from './infobip-client.js';

/**
 * [Review #2 OTP max attempts]
 * OTP max 5 attempts는 Infobip Application pinAttempts=5 위임.
 * 앱 레벨 카운터 불필요 -- Infobip가 서버 사이드에서 강제.
 * DEPLOY-CHECKLIST.md ss3 'pinAttempts: 5' 참조.
 */

// ---------- Mocks ----------
const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  pttl: vi.fn(),
  eval: vi.fn(),
};

function createConfigService(overrides: Record<string, string | undefined> = {}): ConfigService {
  const config: Record<string, string | undefined> = {
    INFOBIP_API_KEY: 'test-key',
    INFOBIP_BASE_URL: 'https://test.api.infobip.com',
    INFOBIP_APPLICATION_ID: 'test-app-id',
    INFOBIP_MESSAGE_ID: 'test-msg-id',
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
    process.env['NODE_ENV'] = 'test';
  });

  // ---------- constructor ----------
  describe('constructor', () => {
    it('production에서 4 env 중 1개라도 비면 throw (D-14, D-16)', () => {
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

    it('dev mock: 4 env 전부 미설정 + non-production이면 isDevMock=true (D-15)', () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_APPLICATION_ID: undefined,
        INFOBIP_MESSAGE_ID: undefined,
        NODE_ENV: 'test',
      });

      // Should not throw
      const service = new SmsService(configService, mockRedis as never);
      expect(service).toBeDefined();
    });
  });

  // ---------- sendVerificationCode ----------
  describe('sendVerificationCode', () => {
    it('중국 본토(+86) 번호 reject -- BadRequestException (D-03)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      await expect(service.sendVerificationCode('+8613912345678')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('dev mock에서 성공 반환 (000000)', async () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_APPLICATION_ID: undefined,
        INFOBIP_MESSAGE_ID: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);

      const result = await service.sendVerificationCode('01012345678');
      expect(result.success).toBe(true);
    });

    it('resend cooldown SET NX fail시 429 반환', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce(null); // NX fail = cooldown active
      mockRedis.pttl.mockResolvedValueOnce(25000);

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Infobip sendPin 성공 시 redis SET pinId', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter = 1 (within limit)

      vi.spyOn(InfobipClient.prototype, 'sendPin').mockResolvedValueOnce({
        pinId: 'test-pin-id',
        to: '821012345678',
        ncStatus: 'NC_DESTINATION_REACHABLE',
        smsStatus: 'MESSAGE_SENT',
      });
      mockRedis.set.mockResolvedValueOnce('OK'); // pinId redis set

      const result = await service.sendVerificationCode('+821012345678');
      expect(result.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('sms:pin:'),
        'test-pin-id',
        'PX',
        expect.any(Number),
      );
    });

    // [Review #1 cooldown rollback]
    it('Infobip sendPin 5xx/timeout 시 cooldown key 삭제(DEL) -- rollback', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(InfobipClient.prototype, 'sendPin').mockRejectedValueOnce(
        new InfobipApiError(500, 'Internal Server Error'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      // cooldown key rollback -- DEL 호출 확인
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('sms:resend:'),
      );
    });

    it('Infobip sendPin 4xx 시 cooldown key 유지 (DEL 미호출)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // phone counter OK

      vi.spyOn(InfobipClient.prototype, 'sendPin').mockRejectedValueOnce(
        new InfobipApiError(400, 'Bad Request'),
      );

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow();

      // 4xx에서는 cooldown key를 유지해야 함 (사용자 입력 오류)
      expect(mockRedis.del).not.toHaveBeenCalledWith(
        expect.stringContaining('sms:resend:'),
      );
    });

    // [Review #3 Valkey atomicity] phone axis counter Lua script
    it('phone axis counter: 6번째 호출에서 429 (D-06)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValueOnce('OK'); // cooldown NX pass

      // Lua EVAL이 6 반환 -- limit 5 초과
      mockRedis.eval.mockResolvedValueOnce(6);

      await expect(service.sendVerificationCode('+821012345678')).rejects.toThrow(
        BadRequestException,
      );
    });

    // [Review #3 Valkey atomicity]
    it('phone axis counter Lua script가 INCR + conditional EXPIRE를 원자적으로 실행', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.set.mockResolvedValue('OK'); // cooldown NX pass
      mockRedis.eval.mockResolvedValueOnce(1); // first call, counter = 1

      vi.spyOn(InfobipClient.prototype, 'sendPin').mockResolvedValueOnce({
        pinId: 'pin-1',
        to: '821012345678',
        ncStatus: 'NC_DESTINATION_REACHABLE',
        smsStatus: 'MESSAGE_SENT',
      });

      await service.sendVerificationCode('+821012345678');

      // Lua eval이 atomic INCR + EXPIRE 스크립트로 호출되었는지 확인
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        expect.any(Number),
        expect.stringContaining('sms:phone:'),
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
        INFOBIP_APPLICATION_ID: undefined,
        INFOBIP_MESSAGE_ID: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);

      const result = await service.verifyCode('01012345678', '000000');
      expect(result.verified).toBe(true);
    });

    it('dev mock에서 잘못된 코드 실패', async () => {
      const configService = createConfigService({
        INFOBIP_API_KEY: undefined,
        INFOBIP_BASE_URL: undefined,
        INFOBIP_APPLICATION_ID: undefined,
        INFOBIP_MESSAGE_ID: undefined,
      });
      const service = new SmsService(configService, mockRedis as never);

      const result = await service.verifyCode('01012345678', '111111');
      expect(result.verified).toBe(false);
    });

    it('pinId 없음(만료) 시 GoneException', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.get.mockResolvedValueOnce(null);

      await expect(service.verifyCode('+821012345678', '123456')).rejects.toThrow(
        GoneException,
      );
    });

    it('Infobip verified=true 시 redis.del', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.get.mockResolvedValueOnce('test-pin-id');
      mockRedis.eval.mockResolvedValueOnce(1); // verify counter OK

      vi.spyOn(InfobipClient.prototype, 'verifyPin').mockResolvedValueOnce({
        msisdn: '821012345678',
        verified: true,
        attemptsRemaining: 0,
        pinError: 'NO_ERROR',
      });

      const result = await service.verifyCode('+821012345678', '123456');
      expect(result.verified).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('sms:pin:'));
    });

    it('attemptsRemaining=0 / NO_MORE_PIN_ATTEMPTS 시 GoneException', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.get.mockResolvedValueOnce('test-pin-id');
      mockRedis.eval.mockResolvedValueOnce(1); // verify counter OK

      vi.spyOn(InfobipClient.prototype, 'verifyPin').mockResolvedValueOnce({
        msisdn: '821012345678',
        verified: false,
        attemptsRemaining: 0,
        pinError: 'NO_MORE_PIN_ATTEMPTS',
      });

      await expect(service.verifyCode('+821012345678', '999999')).rejects.toThrow(
        GoneException,
      );
    });

    it('WRONG_PIN 시 verified false 반환', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);
      mockRedis.get.mockResolvedValueOnce('test-pin-id');
      mockRedis.eval.mockResolvedValueOnce(1); // verify counter OK

      vi.spyOn(InfobipClient.prototype, 'verifyPin').mockResolvedValueOnce({
        msisdn: '821012345678',
        verified: false,
        attemptsRemaining: 3,
        pinError: 'WRONG_PIN',
      });

      const result = await service.verifyCode('+821012345678', '999999');
      expect(result.verified).toBe(false);
    });

    it('phone axis verify counter: 11번째 호출에서 429 (D-07)', async () => {
      const configService = createConfigService();
      const service = new SmsService(configService, mockRedis as never);

      // Lua EVAL이 11 반환 -- limit 10 초과
      mockRedis.eval.mockResolvedValueOnce(11);

      await expect(service.verifyCode('+821012345678', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
