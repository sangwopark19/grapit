'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBookingDetail } from '@/hooks/use-reservations';
import type { ReservationStatus } from '@grapit/shared';

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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${h}:${min}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

interface AdminBookingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  onRefund: (id: string, reason: string) => void;
  isRefunding: boolean;
}

export function AdminBookingDetailModal({
  open,
  onOpenChange,
  bookingId,
  onRefund,
  isRefunding,
}: AdminBookingDetailModalProps) {
  const { data: booking, isLoading } = useAdminBookingDetail(
    open ? bookingId : null,
  );
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  function handleOpenChange(value: boolean) {
    if (!value) {
      setShowRefundForm(false);
      setRefundReason('');
    }
    onOpenChange(value);
  }

  function handleRefundConfirm() {
    if (!bookingId || !refundReason.trim()) return;
    onRefund(bookingId, refundReason.trim());
  }

  const statusConfig = booking ? STATUS_CONFIG[booking.status] : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>예매 상세</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-full" />
          </div>
        )}

        {booking && !showRefundForm && (
          <div className="space-y-1">
            <InfoRow label="예매번호" value={booking.reservationNumber} />
            <Separator />
            <InfoRow
              label="예매자"
              value={`${booking.userName} / ${booking.userPhone}`}
            />
            <Separator />
            <InfoRow label="공연명" value={booking.performanceTitle} />
            <Separator />
            <InfoRow
              label="공연일시"
              value={formatDateTime(booking.showDateTime)}
            />
            <Separator />
            <InfoRow
              label="좌석"
              value={booking.seats
                .map(
                  (s) => `${s.tierName} ${s.row}열 ${s.number}번`,
                )
                .join(', ')}
            />
            <Separator />
            <InfoRow
              label="결제금액"
              value={`${booking.totalAmount.toLocaleString('ko-KR')}원`}
            />
            <Separator />
            {booking.paymentInfo && (
              <>
                <InfoRow label="결제수단" value={booking.paymentInfo.method} />
                <Separator />
                <InfoRow
                  label="결제일시"
                  value={formatDateTime(booking.paymentInfo.paidAt)}
                />
                <Separator />
              </>
            )}
            <InfoRow
              label="상태"
              value={
                statusConfig ? (
                  <Badge className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                ) : (
                  booking.status
                )
              }
            />

            {booking.status === 'CONFIRMED' && (
              <Button
                variant="destructive"
                className="mt-4 w-full"
                onClick={() => setShowRefundForm(true)}
              >
                환불 처리
              </Button>
            )}
          </div>
        )}

        {booking && showRefundForm && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">
              환불을 진행하시겠습니까?
            </h3>

            <div>
              <label
                htmlFor="refund-reason"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                환불 사유
              </label>
              <Textarea
                id="refund-reason"
                placeholder="환불 사유를 입력하세요"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">환불 금액</span>
                <span className="text-base font-semibold text-gray-900">
                  {booking.totalAmount.toLocaleString('ko-KR')}원
                </span>
              </div>
              {booking.paymentInfo && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">환불 수단</span>
                  <span className="text-sm text-gray-600">
                    {booking.paymentInfo.method}으로 환불
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowRefundForm(false);
                  setRefundReason('');
                }}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!refundReason.trim() || isRefunding}
                onClick={handleRefundConfirm}
              >
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    환불 처리 중...
                  </>
                ) : (
                  '환불 확인'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
