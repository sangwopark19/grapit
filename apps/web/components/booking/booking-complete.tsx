'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import type { ReservationDetail } from '@grapit/shared';

interface BookingCompleteProps {
  booking: ReservationDetail;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatPrice(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function BookingComplete({ booking }: BookingCompleteProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Success icon and heading */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <CheckCircle2 className="h-16 w-16 text-success" />
        <h1 className="text-xl font-semibold" tabIndex={-1} id="booking-complete-heading">
          예매가 완료되었습니다
        </h1>
      </div>

      {/* Reservation number */}
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-2 py-6">
          <span className="text-sm text-gray-500">예매번호</span>
          <span
            className="text-2xl font-semibold text-primary"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            aria-label={`예매번호 ${booking.reservationNumber}`}
          >
            {booking.reservationNumber}
          </span>
        </CardContent>
      </Card>

      {/* Performance info */}
      <Card className="w-full">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">공연 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">공연명</span>
              <span className="text-right font-semibold text-gray-900">{booking.performanceTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">공연일시</span>
              <span className="text-right text-gray-900">{formatDateTime(booking.showDateTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">장소</span>
              <span className="text-right text-gray-900">{booking.venue}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seat info */}
      <Card className="w-full">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">좌석 정보</h2>
          <ul className="space-y-2">
            {booking.seats.map((seat) => (
              <li key={seat.seatId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {seat.tierName} {seat.row}열 {seat.number}번
                </span>
                <span className="text-gray-900">{formatPrice(seat.price)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Payment info */}
      <Card className="w-full">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">결제 정보</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">결제금액</span>
              <span className="font-semibold text-primary">{formatPrice(booking.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">결제수단</span>
              <span className="text-gray-900">{booking.paymentMethod}</span>
            </div>
            {booking.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">결제일시</span>
                <span className="text-gray-900">{formatDateTime(booking.paidAt)}</span>
              </div>
            )}
            {booking.cancelDeadline && (
              <div className="flex justify-between">
                <span className="text-gray-500">취소마감시간</span>
                <span className="text-gray-900">{formatDateTime(booking.cancelDeadline)}까지</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* CTA buttons */}
      <div className="flex w-full flex-col gap-3 pb-8">
        <Button
          className="h-12 w-full"
          onClick={() => router.push('/mypage?tab=reservations')}
        >
          예매내역 보기
        </Button>
        <Button
          variant="ghost"
          className="h-12 w-full"
          onClick={() => router.push('/')}
        >
          홈으로
        </Button>
      </div>
    </div>
  );
}
