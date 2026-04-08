import { Skeleton } from '@/components/ui/skeleton';

export function SeatMapSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="aspect-[4/3] w-full" />
        <div className="space-y-3 md:w-[200px]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
