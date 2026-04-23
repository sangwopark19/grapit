'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CancelConfirmModal } from '@/components/reservation/cancel-confirm-modal';
import type { ReservationDetail as ReservationDetailType, ReservationStatus } from '@grabit/shared';

const STATUS_CONFIG: Record<
  ReservationStatus,
  { label: string; className: string }
> = {
  CONFIRMED: {
    label: '예매완료',
    className: 'bg-[#F0FDF4] text-[#15803D] border-transparent',
  },
  CANCELLED: {
    label: '취소완료',
    className: 'bg-[#FEF2F2] text-[#C62828] border-transparent',
  },
  PENDING_PAYMENT: {
    label: '결제대기',
    className: 'bg-[#FFFBEB] text-[#8B6306] border-transparent',
  },
  FAILED: {
    label: '결제실패',
    className: 'bg-[#FEF2F2] text-[#C62828] border-transparent',
  },
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const day = days[date.getDay()];
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} (${day}) ${h}:${min}`;
}

function formatDeadline(dateString: string): string {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${h}:${min}까지`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-right text-sm font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}

interface ReservationDetailProps {
  reservation: ReservationDetailType;
  onCancel: (reason: string) => void;
  isCancelling: boolean;
}

export function ReservationDetailView({
  reservation,
  onCancel,
  isCancelling,
}: ReservationDetailProps) {
  const router = useRouter();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[reservation.status];

  const isDeadlinePassed = new Date(reservation.cancelDeadline) < new Date();
  const canCancel = reservation.status === 'CONFIRMED' && !isDeadlinePassed;
  const showCancelButton = reservation.status !== 'CANCELLED';

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">예매 상세</h1>
      </div>

      {/* Reservation number + status */}
      <Card className="py-4">
        <CardContent className="flex items-center justify-between">
          <span className="font-mono text-xl font-semibold tracking-wide" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {reservation.reservationNumber}
          </span>
          <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
        </CardContent>
      </Card>

      {/* Performance info */}
      <Card className="mt-4 py-4">
        <CardContent>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            공연 정보
          </h2>
          <InfoRow label="공연명" value={reservation.performanceTitle} />
          <Separator />
          <InfoRow
            label="공연일시"
            value={formatDateTime(reservation.showDateTime)}
          />
          <Separator />
          <InfoRow label="장소" value={reservation.venue} />
        </CardContent>
      </Card>

      {/* Seat info */}
      <Card className="mt-4 py-4">
        <CardContent>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            좌석 정보
          </h2>
          {reservation.seats.map((seat, idx) => (
            <div key={seat.seatId}>
              {idx > 0 && <Separator />}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">
                  {seat.tierName} {seat.row}열 {seat.number}번
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {seat.price.toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment info */}
      <Card className="mt-4 py-4">
        <CardContent>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            결제 정보
          </h2>
          <InfoRow
            label="결제금액"
            value={`${reservation.totalAmount.toLocaleString('ko-KR')}원`}
          />
          <Separator />
          <InfoRow label="결제수단" value={reservation.paymentMethod} />
          <Separator />
          <InfoRow
            label="결제일시"
            value={formatDateTime(reservation.paidAt)}
          />
        </CardContent>
      </Card>

      {/* Cancel info */}
      <Card className="mt-4 py-4">
        <CardContent>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            취소 정보
          </h2>
          <div className="flex items-start justify-between py-2">
            <span className="text-sm text-gray-600">취소마감시간</span>
            <div className="text-right">
              <span
                className={`text-sm font-semibold ${
                  isDeadlinePassed ? 'text-error' : 'text-gray-900'
                }`}
              >
                {formatDeadline(reservation.cancelDeadline)}
              </span>
              {isDeadlinePassed && (
                <p className="mt-0.5 text-xs text-[#C62828]">
                  취소 마감시간이 지났습니다
                </p>
              )}
            </div>
          </div>
          {reservation.cancelledAt && (
            <>
              <Separator />
              <InfoRow
                label="취소일시"
                value={formatDateTime(reservation.cancelledAt)}
              />
              {reservation.cancelReason && (
                <>
                  <Separator />
                  <InfoRow label="취소사유" value={reservation.cancelReason} />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cancel button */}
      {showCancelButton && (
        <div className="mt-6">
          {canCancel ? (
            <Button
              variant="destructive"
              className="h-12 w-full"
              onClick={() => setCancelModalOpen(true)}
            >
              예매 취소
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block w-full">
                    <Button
                      variant="destructive"
                      className="h-12 w-full"
                      aria-disabled="true"
                      disabled
                    >
                      예매 취소
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  취소 마감시간이 지났습니다
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Cancel modal */}
      <CancelConfirmModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        refundAmount={reservation.totalAmount}
        paymentMethod={reservation.paymentMethod}
        onConfirm={onCancel}
        isLoading={isCancelling}
      />
    </div>
  );
}
