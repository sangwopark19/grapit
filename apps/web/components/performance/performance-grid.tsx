'use client';

import { SearchIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PerformanceCard } from './performance-card';
import type { PerformanceCardData } from '@grapit/shared';

interface PerformanceGridProps {
  performances: PerformanceCardData[];
  isLoading?: boolean;
  emptyHeading?: string;
  emptyBody?: string;
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg">
      <Skeleton className="aspect-[2/3] w-full rounded-t-lg" />
      <div className="p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
    </div>
  );
}

export function PerformanceGrid({
  performances,
  isLoading = false,
  emptyHeading = '등록된 공연이 없습니다',
  emptyBody = '곧 새로운 공연이 등록될 예정입니다',
}: PerformanceGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (performances.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <SearchIcon className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-xl font-semibold text-gray-900">
          {emptyHeading}
        </h3>
        <p className="mt-2 text-sm text-gray-600">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {performances.map((p) => (
        <PerformanceCard key={p.id} performance={p} />
      ))}
    </div>
  );
}
