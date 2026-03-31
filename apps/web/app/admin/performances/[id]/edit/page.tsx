'use client';

import { use } from 'react';
import { useAdminPerformanceDetail } from '@/hooks/use-admin';
import { PerformanceForm } from '@/components/admin/performance-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminPerformanceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError } = useAdminPerformanceDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>데이터를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-semibold leading-[1.2]">
        공연 수정
      </h1>
      <PerformanceForm mode="edit" initialData={data} performanceId={id} />
    </div>
  );
}
