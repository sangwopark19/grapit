'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ConfirmHeader } from '@/components/booking/confirm-header';
import { OrderSummary } from '@/components/booking/order-summary';
import { BookerInfoSection } from '@/components/booking/booker-info-section';
import { TermsAgreement } from '@/components/booking/terms-agreement';
import { TossPaymentWidget, type TossPaymentWidgetRef } from '@/components/booking/toss-payment-widget';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/stores/use-booking-store';
import { useAuthStore } from '@/stores/use-auth-store';

function generateOrderId(): string {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `GRP-${Date.now()}-${random}`;
}

function ConfirmPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const performanceId = params.performanceId as string;

  const { selectedSeats, performanceTitle, showDateTime, venue, posterUrl, selectedShowtimeId } =
    useBookingStore();
  const user = useAuthStore((s) => s.user);

  const [agreed, setAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [bookerInfo, setBookerInfo] = useState<{ name: string; phone: string }>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  });

  const paymentWidgetRef = useRef<TossPaymentWidgetRef>(null);

  // Generate orderId once per mount
  const orderId = useMemo(() => generateOrderId(), []);

  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats],
  );

  const orderName = useMemo(() => {
    if (!performanceTitle) return '';
    const base = performanceTitle.length > 30 ? `${performanceTitle.slice(0, 30)}...` : performanceTitle;
    return selectedSeats.length > 1 ? `${base} 외 ${selectedSeats.length - 1}건` : base;
  }, [performanceTitle, selectedSeats.length]);

  // Redirect if no booking data
  useEffect(() => {
    if (selectedSeats.length === 0) {
      router.replace(`/booking/${performanceId}`);
    }
  }, [selectedSeats.length, performanceId, router]);

  // Handle error return from Toss
  useEffect(() => {
    const hasError = searchParams.get('error');
    if (hasError === 'true') {
      const code = searchParams.get('code');
      const message = searchParams.get('message');

      if (code === 'PAY_PROCESS_CANCELED') {
        toast.error('결제가 취소되었습니다.');
      } else if (message) {
        toast.error(message);
      } else {
        toast.error('결제에 실패했습니다. 다시 시도해주세요.');
      }

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('code');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [searchParams]);

  const handleExpire = useCallback(() => {
    toast.error('좌석 점유 시간이 만료되어 좌석 선택 화면으로 이동합니다.');
    router.replace(`/booking/${performanceId}`);
  }, [performanceId, router]);

  const handleWidgetReady = useCallback(() => {
    setWidgetReady(true);
  }, []);

  const handleAgreementChange = useCallback((value: boolean) => {
    setAgreed(value);
  }, []);

  const handleBookerUpdate = useCallback((data: { name: string; phone: string }) => {
    setBookerInfo(data);
  }, []);

  async function handlePayment() {
    if (!paymentWidgetRef.current || !agreed || isProcessing) return;

    setIsProcessing(true);
    try {
      await paymentWidgetRef.current.requestPayment();
      // The SDK redirects the browser. No code runs after this.
    } catch (err) {
      // If requestPayment throws (e.g., popup blocked, SDK error),
      // it means the redirect didn't happen. Reset state.
      setIsProcessing(false);
      const errorMessage =
        err instanceof Error ? err.message : '결제 요청에 실패했습니다.';
      toast.error(errorMessage);
    }
  }

  if (selectedSeats.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ctaDisabled = !agreed || isProcessing || !widgetReady;
  const ctaText = isProcessing
    ? '결제 처리 중...'
    : !agreed
      ? '약관에 동의해주세요'
      : '결제하기';

  return (
    <div className="flex min-h-dvh flex-col">
      <ConfirmHeader onExpire={handleExpire} />

      <main className="mx-auto w-full max-w-[720px] flex-1 space-y-6 px-4 py-6 md:px-6 md:py-8">
        {/* Order Summary */}
        <OrderSummary
          performanceTitle={performanceTitle ?? ''}
          posterUrl={posterUrl}
          showDateTime={showDateTime ?? ''}
          venue={venue ?? ''}
          seats={selectedSeats}
          totalPrice={totalPrice}
        />

        {/* Booker Info */}
        <BookerInfoSection
          userName={bookerInfo.name}
          userPhone={bookerInfo.phone}
          onUpdate={handleBookerUpdate}
        />

        {/* Terms Agreement */}
        <TermsAgreement agreed={agreed} onAgreementChange={handleAgreementChange} />

        {/* Payment Widget */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">결제 수단</h2>
          {user && (
            <TossPaymentWidget
              ref={paymentWidgetRef}
              orderId={orderId}
              orderName={orderName}
              amount={totalPrice}
              performanceId={performanceId}
              customerKey={user.id}
              customerName={bookerInfo.name}
              customerEmail={user.email}
              onReady={handleWidgetReady}
            />
          )}
        </section>

        {/* Desktop CTA */}
        <div className="hidden pb-8 md:block">
          <Button
            className="h-12 w-full text-base"
            disabled={ctaDisabled}
            onClick={handlePayment}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ctaText}
          </Button>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="sticky bottom-0 border-t bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
        <Button
          className="h-12 w-full text-base"
          disabled={ctaDisabled}
          onClick={handlePayment}
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {ctaText}
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <AuthGuard>
      <ConfirmPageContent />
    </AuthGuard>
  );
}
