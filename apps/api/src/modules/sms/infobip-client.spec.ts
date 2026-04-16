import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InfobipClient,
  InfobipApiError,
  type InfobipSendPinResponse,
  type InfobipVerifyPinResponse,
} from './infobip-client';
import sendFixture from './__fixtures__/infobip-send-response.json';
import verifyFixtures from './__fixtures__/infobip-verify-response.json';

const BASE_URL = 'https://x.api.infobip.com';
const API_KEY = 'test-api-key';
const APP_ID = 'test-app-id';
const MSG_ID = 'test-msg-id';

describe('InfobipClient', () => {
  let client: InfobipClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new InfobipClient(BASE_URL, API_KEY, APP_ID, MSG_ID);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendPin', () => {
    it('should POST to /2fa/2/pin with correct URL', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/2fa/2/pin`);
    });

    it('should set Authorization header to "App {apiKey}"', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`App ${API_KEY}`);
    });

    it('should set Content-Type and Accept to application/json', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
    });

    it('should include applicationId, messageId, from, and to in body', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, string>;
      expect(body).toEqual({
        applicationId: APP_ID,
        messageId: MSG_ID,
        from: 'Grapit',
        to: '821012345678',
      });
    });

    it('should strip leading + from phone number', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, string>;
      expect(body.to).toBe('821012345678');
      expect(body.to).not.toContain('+');
    });

    it('should return InfobipSendPinResponse on 200', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      const result: InfobipSendPinResponse = await client.sendPin('+821012345678');

      expect(result.pinId).toBe(sendFixture.pinId);
      expect(result.to).toBe(sendFixture.to);
      expect(result.smsStatus).toBe(sendFixture.smsStatus);
    });

    it('should throw InfobipApiError on 400', async () => {
      const errorBody = '{"requestError":{"serviceException":{"text":"Bad request"}}}';
      fetchSpy.mockResolvedValueOnce(
        new Response(errorBody, { status: 400 }),
      );

      await expect(client.sendPin('+821012345678')).rejects.toThrow(InfobipApiError);
    });

    it('should capture status and body in InfobipApiError on 400', async () => {
      const errorBody = '{"requestError":{"serviceException":{"text":"Bad request"}}}';
      fetchSpy.mockResolvedValueOnce(
        new Response(errorBody, { status: 400 }),
      );

      try {
        await client.sendPin('+821012345678');
        expect.fail('Expected InfobipApiError to be thrown');
      } catch (err) {
        const apiErr = err as InfobipApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.body).toBe(errorBody);
      }
    });

    it('should throw InfobipApiError on 500', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(client.sendPin('+821012345678')).rejects.toThrow(InfobipApiError);
    });

    it('should pass AbortSignal.timeout(5000)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(sendFixture), { status: 200 }),
      );

      await client.sendPin('+821012345678');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
    });
  });

  describe('verifyPin', () => {
    it('should POST to /2fa/2/pin/{encodedPinId}/verify', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      await client.verifyPin('simple-pin-id', '123456');

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/2fa/2/pin/simple-pin-id/verify`);
    });

    it('should URL-encode pinId with special characters (encodeURIComponent)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      const specialPinId = 'pinId/=+special';
      await client.verifyPin(specialPinId, '123456');

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/2fa/2/pin/${encodeURIComponent(specialPinId)}/verify`);
      expect(url).toContain('pinId%2F%3D%2Bspecial');
    });

    it('should send pin in request body', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      await client.verifyPin('pin-id', '123456');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, string>;
      expect(body).toEqual({ pin: '123456' });
    });

    it('should return InfobipVerifyPinResponse on success', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      const result: InfobipVerifyPinResponse = await client.verifyPin('pin-id', '123456');

      expect(result.verified).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.pinError).toBe('NO_ERROR');
    });

    it('should return wrong pin response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.wrongPin), { status: 200 }),
      );

      const result = await client.verifyPin('pin-id', '000000');

      expect(result.verified).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
      expect(result.pinError).toBe('WRONG_PIN');
    });

    it('should throw InfobipApiError on error response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );

      await expect(client.verifyPin('bad-pin', '123456')).rejects.toThrow(InfobipApiError);
    });

    it('should set Authorization header', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      await client.verifyPin('pin-id', '123456');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`App ${API_KEY}`);
    });

    it('should pass AbortSignal.timeout(5000)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(verifyFixtures.success), { status: 200 }),
      );

      await client.verifyPin('pin-id', '123456');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
    });
  });

  describe('InfobipApiError', () => {
    it('should capture status and body', () => {
      const err = new InfobipApiError(429, 'Too many requests');
      expect(err.status).toBe(429);
      expect(err.body).toBe('Too many requests');
      expect(err.name).toBe('InfobipApiError');
      expect(err.message).toContain('429');
      expect(err.message).toContain('Too many requests');
    });

    it('should be an instance of Error', () => {
      const err = new InfobipApiError(500, 'Server Error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
