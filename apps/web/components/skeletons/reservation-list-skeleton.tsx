import { Skeleton } from '@/components/ui/skeleton';

export function ReservationListSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full" />
        ))}
      </div>
    </div>
  );
}
