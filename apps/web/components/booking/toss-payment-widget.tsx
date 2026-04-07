'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { Loader2 } from 'lucide-react';

interface TossPaymentWidgetProps {
  orderId: string;
  orderName: string;
  amount: number;
  performanceId: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  onReady: () => void;
}

export interface TossPaymentWidgetRef {
  requestPayment: () => Promise<void>;
}

export const TossPaymentWidget = forwardRef<TossPaymentWidgetRef, TossPaymentWidgetProps>(
  function TossPaymentWidget(
    {
      orderId,
      orderName,
      amount,
      performanceId,
      customerKey,
      customerName,
      customerEmail,
      onReady,
    },
    ref,
  ) {
    const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const readyRef = useRef(false);
    const initRef = useRef(false);

    // Expose requestPayment to parent via ref
    useImperativeHandle(ref, () => ({
      requestPayment: async () => {
        if (!widgets) {
          throw new Error('결제 위젯이 초기화되지 않았습니다');
        }
        await widgets.requestPayment({
          orderId,
          orderName,
          successUrl: `${window.location.origin}/booking/${performanceId}/complete`,
          failUrl: `${window.location.origin}/booking/${performanceId}/confirm?error=true`,
          customerEmail,
          customerName,
        });
      },
    }), [widgets, orderId, orderName, performanceId, customerEmail, customerName]);

    // Initialize Toss Payments SDK
    useEffect(() => {
      if (initRef.current) return;
      initRef.current = true;

      async function init() {
        try {
          const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
          if (!clientKey) {
            setError('결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.');
            setIsLoading(false);
            return;
          }

          const tossPayments = await loadTossPayments(clientKey);
          const w = tossPayments.widgets({ customerKey });
          setWidgets(w);
        } catch (err) {
          console.error('Toss Payments SDK 초기화 실패:', err);
          setError('결제 시스템 로딩에 실패했습니다. 페이지를 새로고침해주세요.');
          setIsLoading(false);
        }
      }

      init();
    }, [customerKey]);

    // Render payment methods and agreement after widgets is ready
    useEffect(() => {
      if (!widgets || readyRef.current) return;

      async function render() {
        try {
          await widgets!.setAmount({ currency: 'KRW', value: amount });

          await Promise.all([
            widgets!.renderPaymentMethods({
              selector: '#payment-method',
              variantKey: 'DEFAULT',
            }),
            widgets!.renderAgreement({
              selector: '#agreement',
              variantKey: 'AGREEMENT',
            }),
          ]);

          readyRef.current = true;
          setIsLoading(false);
          onReady();
        } catch (err) {
          console.error('결제 위젯 렌더링 실패:', err);
          setError('결제 위젯을 불러오는데 실패했습니다.');
          setIsLoading(false);
        }
      }

      render();
    }, [widgets, amount, onReady]);

    if (error) {
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {isLoading && (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}
        <div
          id="payment-method"
          aria-label="결제 수단 선택"
          className={isLoading ? 'hidden' : ''}
        />
        <div
          id="agreement"
          className={isLoading ? 'hidden' : ''}
        />
      </div>
    );
  },
);
