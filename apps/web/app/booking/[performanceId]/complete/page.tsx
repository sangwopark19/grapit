'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { BookingComplete } from '@/components/booking/booking-complete';
import { useConfirmPayment, useReservationByOrderId } from '@/hooks/use-booking';
import { useBookingStore } from '@/stores/use-booking-store';
import type { ReservationDetail } from '@grabit/shared';

function CompleteSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[720px] animate-pulse space-y-6 px-6 py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-gray-200" />
        <div className="h-6 w-48 rounded bg-gray-200" />
      </div>
      <div className="h-24 rounded-xl bg-gray-100" />
      <div className="h-32 rounded-xl bg-gray-100" />
      <div className="h-32 rounded-xl bg-gray-100" />
      <div className="h-32 rounded-xl bg-gray-100" />
    </div>
  );
}

function CompletePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  const clearBooking = useBookingStore((s) => s.clearBooking);

  const confirmMutation = useConfirmPayment();
  const [bookingData, setBookingData] = useState<ReservationDetail | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const hasConfirmedRef = useRef(false);

  // Recovery: on refresh after confirm already succeeded, fetch by orderId
  const [confirmFailed, setConfirmFailed] = useState(false);
  const shouldRecover = confirmFailed && !!orderId;

  const { data: recoveredReservation } = useReservationByOrderId(
    shouldRecover ? orderId : null,
  );

  useEffect(() => {
    if (!shouldRecover || !recoveredReservation) return;

    if (recoveredReservation.status === 'CONFIRMED') {
      setBookingData(recoveredReservation);
    } else {
      toast.info('예매 내역에서 확인해주세요.');
      router.replace('/mypage?tab=reservations');
    }
  }, [shouldRecover, recoveredReservation, router]);

  // Confirm payment on mount — only needs URL params (server has pending order)
  const confirmPayment = useCallback(async () => {
    if (hasConfirmedRef.current || !paymentKey || !orderId || !amount) {
      return;
    }

    hasConfirmedRef.current = true;
    setIsConfirming(true);

    try {
      const result = await confirmMutation.mutateAsync({
        paymentKey,
        orderId,
        amount: Number(amount),
      });

      setBookingData(result);
      clearBooking();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '결제 확인에 실패했습니다.';
      toast.error(errorMessage);
      // Try recovery — maybe already confirmed on a previous attempt
      setConfirmFailed(true);
    } finally {
      setIsConfirming(false);
    }
  }, [
    paymentKey,
    orderId,
    amount,
    confirmMutation,
    clearBooking,
  ]);

  useEffect(() => {
    if (paymentKey && orderId && amount) {
      confirmPayment();
    }
  }, [paymentKey, orderId, amount, confirmPayment]);

  // Focus heading on success
  useEffect(() => {
    if (bookingData) {
      const heading = document.getElementById('booking-complete-heading');
      heading?.focus();
    }
  }, [bookingData]);

  // Handle missing params
  if (!paymentKey || !orderId) {
    if (!shouldRecover) {
      return (
        <div className="mx-auto flex min-h-[50vh] max-w-[720px] items-center justify-center px-6 py-12">
          <div className="text-center">
            <p className="text-gray-500">잘못된 접근입니다.</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-sm text-primary underline"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      );
    }
  }

  // Loading state
  if (isConfirming || (!bookingData && !confirmMutation.isError)) {
    return <CompleteSkeleton />;
  }

  // Success state
  if (bookingData) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-6 py-12">
        <BookingComplete booking={bookingData} />
      </main>
    );
  }

  // Fallback - should not reach here normally
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-[720px] items-center justify-center px-6 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function CompletePage() {
  return (
    <AuthGuard>
      <CompletePageContent />
    </AuthGuard>
  );
}
