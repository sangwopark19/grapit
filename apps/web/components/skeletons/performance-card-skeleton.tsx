import { Skeleton } from '@/components/ui/skeleton';

export function PerformanceCardSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="space-y-2 mt-3">
        <Skeleton className="h-4 w-[70%]" />
        <Skeleton className="h-3 w-[50%]" />
        <Skeleton className="h-3 w-[40%]" />
      </div>
    </div>
  );
}
