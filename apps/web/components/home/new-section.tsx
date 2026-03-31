'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { PerformanceCard } from '@/components/performance/performance-card';
import { useNewPerformances } from '@/hooks/use-performances';

function NewSectionSkeleton() {
  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function NewSection() {
  const { data: performances, isLoading } = useNewPerformances();

  if (isLoading) return <NewSectionSkeleton />;
  if (!performances?.length) return null;

  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[28px] font-semibold leading-[1.2]">신규 오픈</h2>
        <Link
          href="/genre/musical?sort=latest"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          더보기
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {performances.map((p) => (
          <PerformanceCard key={p.id} performance={p} />
        ))}
      </div>
    </section>
  );
}
