'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { BookingComplete } from '@/components/booking/booking-complete';
import { useConfirmPayment, useReservationByOrderId } from '@/hooks/use-booking';
import { ApiClientError } from '@/lib/api-client';
import { useBookingStore } from '@/stores/use-booking-store';
import type { ReservationDetail } from '@grabit/shared';

const LOCK_FAILURE_MESSAGES = [
  '좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.',
  '이미 다른 사용자가 선택한 좌석입니다.',
] as const;

function isLockFailureMessage(message: string): boolean {
  return LOCK_FAILURE_MESSAGES.some((candidate) => candidate === message);
}

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
  const parsedAmount = Number(amount);
  const hasValidAmount = amount !== null && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const clearBooking = useBookingStore((s) => s.clearBooking);
  const performanceId = useBookingStore((s) => s.performanceId);

  const confirmMutation = useConfirmPayment();
  const [bookingData, setBookingData] = useState<ReservationDetail | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationErrorMessage, setConfirmationErrorMessage] = useState<string | null>(null);
  const hasConfirmedRef = useRef(false);

  // Recovery: on refresh after confirm already succeeded, fetch by orderId
  const [confirmFailed, setConfirmFailed] = useState(false);
  const shouldRecover = confirmFailed && !!orderId;

  const {
    data: recoveredReservation,
    isFetched: recoveryFetched,
    isError: recoveryError,
  } = useReservationByOrderId(shouldRecover ? orderId : null);

  useEffect(() => {
    if (!shouldRecover || (!recoveryFetched && !recoveryError)) return;

    if (recoveredReservation?.status === 'CONFIRMED') {
      setBookingData(recoveredReservation);
      clearBooking();
      return;
    }

    setConfirmationErrorMessage('결제 확인에 실패했습니다. 예매 내역을 확인해주세요.');
    setConfirmFailed(false);
  }, [shouldRecover, recoveryFetched, recoveryError, recoveredReservation, clearBooking]);

  // Confirm payment on mount — only needs URL params (server has pending order)
  const confirmPayment = useCallback(async () => {
    if (hasConfirmedRef.current || !paymentKey || !orderId || !hasValidAmount) {
      return;
    }

    hasConfirmedRef.current = true;
    setIsConfirming(true);

    try {
      const result = await confirmMutation.mutateAsync({
        paymentKey,
        orderId,
        amount: parsedAmount,
      });

      setBookingData(result);
      clearBooking();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '결제 확인에 실패했습니다.';
      toast.error(errorMessage);
      if (
        err instanceof ApiClientError &&
        err.statusCode === 409 &&
        isLockFailureMessage(errorMessage)
      ) {
        setConfirmationErrorMessage(errorMessage);
        setConfirmFailed(false);
        return;
      }
      // Try recovery — maybe already confirmed on a previous attempt
      setConfirmFailed(true);
    } finally {
      setIsConfirming(false);
    }
  }, [
    paymentKey,
    orderId,
    parsedAmount,
    hasValidAmount,
    confirmMutation,
    clearBooking,
  ]);

  useEffect(() => {
    if (paymentKey && orderId && hasValidAmount) {
      confirmPayment();
    }
  }, [paymentKey, orderId, hasValidAmount, confirmPayment]);

  // Focus heading on success
  useEffect(() => {
    if (bookingData) {
      const heading = document.getElementById('booking-complete-heading');
      heading?.focus();
    }
  }, [bookingData]);

  // Handle missing params
  if (!paymentKey || !orderId || !hasValidAmount) {
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

  if (confirmationErrorMessage) {
    return (
      <main className="mx-auto flex min-h-[50vh] w-full max-w-[720px] items-center justify-center px-6 py-12">
        <section role="alert" className="w-full rounded-lg border border-red-200 bg-red-50 p-5 text-center">
          <h1 className="text-lg font-semibold text-red-700">예매를 완료하지 못했습니다</h1>
          <p className="mt-2 text-sm text-red-700">{confirmationErrorMessage}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {performanceId && (
              <button
                type="button"
                onClick={() => router.replace(`/booking/${performanceId}`)}
                className="text-sm font-medium text-primary underline"
              >
                좌석 다시 선택하기
              </button>
            )}
            <button
              type="button"
              onClick={() => router.replace('/mypage?tab=reservations')}
              className="text-sm font-medium text-primary underline"
            >
              예매 내역 확인
            </button>
          </div>
        </section>
      </main>
    );
  }

  // Loading state
  if (
    isConfirming ||
    (shouldRecover && !recoveryFetched && !recoveryError) ||
    (!bookingData && !confirmMutation.isError)
  ) {
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
