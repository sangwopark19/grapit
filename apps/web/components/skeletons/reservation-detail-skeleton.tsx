import { Skeleton } from '@/components/ui/skeleton';

export function ReservationDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="space-y-4">
        <Skeleton className="h-6 w-[50%]" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}
