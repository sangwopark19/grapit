import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
  }>;
}

export class TossPaymentError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TossPaymentError';
    this.code = code;
  }
}

@Injectable()
export class TossPaymentsClient {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.tosspayments.com/v1';

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TOSS_SECRET_KEY', '');
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`;
  }

  async confirmPayment(params: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }): Promise<TossPaymentResponse> {
    const response = await fetch(`${this.baseUrl}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: params.paymentKey,
        orderId: params.orderId,
        amount: params.amount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new TossPaymentError(
        data.code ?? 'UNKNOWN_ERROR',
        data.message ?? '결제 승인에 실패했습니다',
      );
    }

    return data as TossPaymentResponse;
  }

  async cancelPayment(paymentKey: string, reason: string): Promise<TossPaymentResponse> {
    const response = await fetch(`${this.baseUrl}/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new TossPaymentError(
        data.code ?? 'UNKNOWN_ERROR',
        data.message ?? '결제 취소에 실패했습니다',
      );
    }

    return data as TossPaymentResponse;
  }
}
