/**
 * Phase 10.1: Infobip /sms/3/messages v3 전환
 * - sendSms 전용 (verifyPin 블록 완전 제거)
 * - Request: { messages: [{ sender, destinations: [{ to }], content: { text } }] }
 * - Response: { messages: [{ messageId, status, destination }], bulkId }
 * - RED 상태: Plan 03 실행 전까지 sendSms/SendSmsResult 미존재
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InfobipClient,
  InfobipApiError,
  type SendSmsResult,
} from './infobip-client';
import sendFixture from './__fixtures__/infobip-send-response.json';

const BASE_URL = 'https://x.api.infobip.com';
const API_KEY  = 'test-api-key';
const SENDER   = '0212345678';

describe('InfobipClient', () => {
  let client: InfobipClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new InfobipClient(BASE_URL, API_KEY, SENDER);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendSms', () => {
    it('POST /sms/3/messages 경로로 호출', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+821012345678', 'test text');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/sms/3/messages`);
    });

    it('Authorization 헤더 "App {apiKey}"', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+821012345678', 'test text');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`App ${API_KEY}`);
    });

    it('Content-Type application/json', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+821012345678', 'test text');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('body는 { messages: [{ sender, destinations: [{ to }], content: { text } }] } 구조', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+821012345678', 'test text');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      const messages = body.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      expect(messages[0].sender).toBe(SENDER);
      const destinations = messages[0].destinations as Array<Record<string, string>>;
      expect(destinations[0].to).toBe('821012345678');
      const content = messages[0].content as Record<string, string>;
      expect(content.text).toBe('test text');
    });

    it('200 응답 시 SendSmsResult 반환', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      const result: SendSmsResult = await client.sendSms('+821012345678', 'test text');

      expect(result.messageId).toBe(sendFixture.messages[0].messageId);
      expect(result.groupId).toBe(1);
      expect(result.status).toBe('MESSAGE_ACCEPTED');
    });

    it('400 응답 시 InfobipApiError throw', async () => {
      const errorBody = '{"requestError":{"serviceException":{"text":"bad to"}}}';
      fetchSpy.mockResolvedValueOnce(
        new Response(errorBody, { status: 400 }),
      );

      await expect(client.sendSms('+821012345678', 'test')).rejects.toThrow(InfobipApiError);

      try {
        fetchSpy.mockResolvedValueOnce(
          new Response(errorBody, { status: 400 }),
        );
        await client.sendSms('+821012345678', 'test');
        expect.fail('Expected InfobipApiError');
      } catch (err) {
        const apiErr = err as InfobipApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.body).toContain('bad to');
      }
    });

    it('5xx 응답 시 InfobipApiError throw', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(client.sendSms('+821012345678', 'test')).rejects.toThrow(InfobipApiError);
    });

    it('AbortSignal.timeout 5초 설정', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+821012345678', 'test text');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
    });

    it('leading + 제거 (e164.replace 동작 확인)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendSms('+861391234XXXX', 'hi');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      const messages = body.messages as Array<Record<string, unknown>>;
      const destinations = messages[0].destinations as Array<Record<string, string>>;
      expect(destinations[0].to).toBe('861391234XXXX');
    });

    it('응답에 messages 배열이 비어있을 때 에러 throw', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [] }), { status: 200 }),
      );

      await expect(client.sendSms('+821012345678', 'test')).rejects.toThrow(/messages/i);
    });
  });

  describe('InfobipApiError', () => {
    it('status와 body를 캡처한다', () => {
      const err = new InfobipApiError(429, 'Too many requests');
      expect(err.status).toBe(429);
      expect(err.body).toBe('Too many requests');
      expect(err.name).toBe('InfobipApiError');
      expect(err.message).toContain('429');
      expect(err.message).toContain('Too many requests');
    });

    it('Error의 instance이다', () => {
      const err = new InfobipApiError(500, 'Server Error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
