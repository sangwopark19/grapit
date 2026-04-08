'use client';

import Link from 'next/link';
import { SectionSkeleton } from '@/components/skeletons';
import { PerformanceCard } from '@/components/performance/performance-card';
import { useNewPerformances } from '@/hooks/use-performances';

export function NewSection() {
  const { data: performances, isLoading } = useNewPerformances();

  if (isLoading) return <SectionSkeleton />;
  if (!performances?.length) return null;

  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-display font-semibold leading-[1.2]">신규 오픈</h2>
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
