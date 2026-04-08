import { Skeleton } from '@/components/ui/skeleton';

export function DetailTabsSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="h-10 flex gap-2">
        <Skeleton className="h-10 w-[80px]" />
        <Skeleton className="h-10 w-[80px]" />
        <Skeleton className="h-10 w-[80px]" />
      </div>
      <div className="space-y-3 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[90%]" />
      </div>
    </div>
  );
}
