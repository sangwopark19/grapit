'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReservationCard } from '@/components/reservation/reservation-card';
import type { ReservationListItem } from '@grapit/shared';

const FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'CONFIRMED', label: '예매완료' },
  { value: 'CANCELLED', label: '취소완료' },
] as const;

interface ReservationListProps {
  reservations: ReservationListItem[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function ReservationList({
  reservations,
  isLoading,
  isFetching,
  filter,
  onFilterChange,
}: ReservationListProps) {
  return (
    <div>
      {/* Filter chips */}
      <div className="flex gap-2" role="group" aria-label="예매 상태 필터">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? 'default' : 'ghost'}
            size="sm"
            className={
              filter === option.value
                ? ''
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }
            onClick={() => onFilterChange(option.value)}
            aria-pressed={filter === option.value}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex gap-4 rounded-lg border bg-white p-4"
            >
              <Skeleton className="h-[84px] w-[60px] shrink-0 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reservation cards */}
      {!isLoading && reservations && reservations.length > 0 && (
        <div
          className="mt-4 flex flex-col gap-4 transition-opacity duration-150"
          style={{ opacity: isFetching ? 0.5 : 1 }}
        >
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && reservations && reservations.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <p className="text-base font-semibold text-gray-900">
            예매 내역이 없습니다
          </p>
          <p className="mt-2 text-sm text-gray-600">
            원하는 공연을 찾아 예매해보세요
          </p>
          <Link href="/">
            <Button className="mt-6">공연 둘러보기</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
