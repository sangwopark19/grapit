'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import type { ReservationListItem, ReservationStatus } from '@grapit/shared';

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

function formatDate(dateString: string): string {
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

function formatSeatSummary(
  seats: ReservationListItem['seats'],
): string {
  if (seats.length === 0) return '';
  const first = seats[0];
  const base = `${first.tierName} ${first.row}열 ${first.number}번`;
  if (seats.length === 1) return base;
  return `${base} 외 ${seats.length - 1}석`;
}

interface ReservationCardProps {
  reservation: ReservationListItem;
}

export function ReservationCard({ reservation }: ReservationCardProps) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[reservation.status];
  const dateFormatted = formatDate(reservation.showDateTime);
  const seatSummary = formatSeatSummary(reservation.seats);

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${reservation.performanceTitle} ${dateFormatted} ${statusConfig.label} 예매 상세 보기`}
      className="relative min-h-[44px] cursor-pointer rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
      onClick={() => router.push(`/mypage/reservations/${reservation.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/mypage/reservations/${reservation.id}`);
        }
      }}
    >
      <Badge className={`absolute right-4 top-4 ${statusConfig.className}`}>
        {statusConfig.label}
      </Badge>

      <div className="flex gap-4">
        {reservation.posterUrl ? (
          <div className="relative h-[84px] w-[60px] shrink-0 overflow-hidden rounded-md">
            <Image
              src={reservation.posterUrl}
              alt={`${reservation.performanceTitle} 포스터`}
              fill
              className="object-cover"
              sizes="60px"
            />
          </div>
        ) : (
          <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-md bg-gray-200 text-xs text-gray-400">
            N/A
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between pr-16">
          <div>
            <p className="truncate text-base font-semibold text-gray-900">
              {reservation.performanceTitle}
            </p>
            <p className="mt-1 text-sm text-gray-600">{dateFormatted}</p>
            {seatSummary && (
              <p className="mt-0.5 text-sm text-gray-600">{seatSummary}</p>
            )}
          </div>
          <p className="text-base font-semibold text-gray-900">
            {reservation.totalAmount.toLocaleString('ko-KR')}원
          </p>
        </div>
      </div>
    </div>
  );
}
