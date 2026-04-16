import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Plan 04에서 구현 예정
import { InfobipClient, InfobipApiError } from './infobip-client.js';
import sendFixture from './__fixtures__/infobip-send-response.json';
import verifyFixture from './__fixtures__/infobip-verify-response.json';

const BASE_URL = 'https://test.api.infobip.com';
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
    it('올바른 URL로 POST 요청', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendFixture),
      });

      await client.sendPin('+821012345678');

      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/2fa/2/pin`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('Authorization header에 "App {key}" 형식 사용', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendFixture),
      });

      await client.sendPin('+821012345678');

      const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`App ${API_KEY}`);
    });

    it('body에 applicationId, messageId, from, to 포함', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendFixture),
      });

      await client.sendPin('+821012345678');

      const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArgs.body as string) as Record<string, string>;
      expect(body).toMatchObject({
        applicationId: APP_ID,
        messageId: MSG_ID,
        from: 'Grapit',
      });
    });

    it('전화번호에서 leading + 제거 후 전송', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendFixture),
      });

      await client.sendPin('+821012345678');

      const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArgs.body as string) as Record<string, string>;
      expect(body['to']).toBe('821012345678');
    });

    it('4xx 응답 시 InfobipApiError throw', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      await expect(client.sendPin('+821012345678')).rejects.toThrow(InfobipApiError);
    });

    it('5xx 응답 시 InfobipApiError throw', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.sendPin('+821012345678')).rejects.toThrow(InfobipApiError);
    });

    it('timeout 시 AbortError 계열 에러 throw', async () => {
      fetchSpy.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

      await expect(client.sendPin('+821012345678')).rejects.toThrow('aborted');
    });
  });

  describe('verifyPin', () => {
    const PIN_ID = '9C817C6F8AF3D48F9FE553282AFA2B67';

    it('URL에 encodeURIComponent(pinId) 포함', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(verifyFixture.success),
      });

      await client.verifyPin(PIN_ID, '123456');

      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE_URL}/2fa/2/pin/${encodeURIComponent(PIN_ID)}/verify`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('body에 { pin } 포함', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(verifyFixture.success),
      });

      await client.verifyPin(PIN_ID, '123456');

      const callArgs = fetchSpy.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArgs.body as string) as Record<string, string>;
      expect(body).toEqual({ pin: '123456' });
    });

    it('성공 응답 반환', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(verifyFixture.success),
      });

      const result = await client.verifyPin(PIN_ID, '123456');
      expect(result.verified).toBe(true);
    });

    it('에러 응답 시 InfobipApiError throw', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Pin not found'),
      });

      await expect(client.verifyPin(PIN_ID, '123456')).rejects.toThrow(InfobipApiError);
    });
  });
});
