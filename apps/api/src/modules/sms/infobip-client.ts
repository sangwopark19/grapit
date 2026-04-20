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
        status?: {
          name?: string;
          groupId?: number;
          description?: string;
        };
      }>;
    };
    const msg = data.messages?.[0];
    if (!msg || !msg.messageId) {
      throw new InfobipApiError(
        500,
        'Infobip response missing messages[0].messageId',
      );
    }

    // [Issue 3 / PR #16 review] Infobip /sms/3/messages may return HTTP 200
    // with status.groupId === 5 for synchronously rejected messages
    // (invalid destination, blocked sender, content rejected). Without explicit
    // detection, the OTP would be stored even though no SMS was delivered —
    // the user would be permanently unable to verify.
    //
    // Convert to InfobipApiError(400) so the caller treats it as a permanent
    // (4xx) error: cooldown is kept and the phone-axis send counter is NOT
    // rolled back (abuse mitigation).
    if (msg.status?.groupId === 5) {
      const name = msg.status?.name ?? 'REJECTED';
      const description =
        msg.status?.description ?? JSON.stringify(msg.status);
      throw new InfobipApiError(
        400,
        `Infobip rejected message: ${name} - ${description}`,
      );
    }

    return {
      messageId: msg.messageId,
      status: msg.status?.name ?? 'UNKNOWN',
      groupId: msg.status?.groupId ?? 0,
    };
  }
}
