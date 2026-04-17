export interface SendSmsResult {
  messageId: string;
  status: string;
  groupId: number;
}

export class InfobipApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Infobip API ${status}: ${body}`);
    this.name = 'InfobipApiError';
  }
}

/**
 * Infobip SMS API v3 client — POST /sms/3/messages (2024-12 release).
 * Only requires baseUrl, apiKey, sender. PIN logic lives in SmsService + Valkey.
 * Production (KR): sender must be KISA-registered numeric; alphanumeric is rewritten by MNOs.
 */
export class InfobipClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly sender: string,
  ) {}

  async sendSms(e164: string, text: string): Promise<SendSmsResult> {
    const to = e164.replace(/^\+/, '');

    const res = await fetch(`${this.baseUrl}/sms/3/messages`, {
      method: 'POST',
      headers: {
        Authorization: `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            sender: this.sender,
            destinations: [{ to }],
            content: { text },
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InfobipApiError(res.status, body);
    }

    const data = (await res.json()) as {
      messages?: Array<{
        messageId?: string;
        status?: { name?: string; groupId?: number };
      }>;
    };
    const msg = data.messages?.[0];
    if (!msg || !msg.messageId) {
      throw new InfobipApiError(
        500,
        'Infobip response missing messages[0].messageId',
      );
    }

    return {
      messageId: msg.messageId,
      status: msg.status?.name ?? 'UNKNOWN',
      groupId: msg.status?.groupId ?? 0,
    };
  }
}
