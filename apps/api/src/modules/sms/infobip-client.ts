export interface InfobipSendPinResponse {
  pinId: string;
  to: string;
  ncStatus?: string;
  smsStatus?: string;
}

export interface InfobipVerifyPinResponse {
  msisdn: string;
  verified: boolean;
  attemptsRemaining: number;
  pinError?:
    | 'NO_ERROR'
    | 'WRONG_PIN'
    | 'PIN_EXPIRED'
    | 'NO_MORE_PIN_ATTEMPTS'
    | string;
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

export class InfobipClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly applicationId: string,
    private readonly messageId: string,
  ) {}

  async sendPin(toE164: string): Promise<InfobipSendPinResponse> {
    const res = await fetch(`${this.baseUrl}/2fa/2/pin`, {
      method: 'POST',
      headers: {
        Authorization: `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        applicationId: this.applicationId,
        messageId: this.messageId,
        from: 'Grapit',
        to: toE164.replace(/^\+/, ''),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InfobipApiError(res.status, body);
    }

    return (await res.json()) as InfobipSendPinResponse;
  }

  async verifyPin(
    pinId: string,
    pin: string,
  ): Promise<InfobipVerifyPinResponse> {
    const res = await fetch(
      `${this.baseUrl}/2fa/2/pin/${encodeURIComponent(pinId)}/verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `App ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ pin }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new InfobipApiError(res.status, body);
    }

    return (await res.json()) as InfobipVerifyPinResponse;
  }
}
