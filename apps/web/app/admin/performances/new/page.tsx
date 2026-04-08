'use client';

import { PerformanceForm } from '@/components/admin/performance-form';

export default function AdminPerformanceNewPage() {
  return (
    <div>
      <h1 className="mb-6 text-display font-semibold leading-[1.2]">
        공연 등록
      </h1>
      <PerformanceForm mode="create" />
    </div>
  );
}
