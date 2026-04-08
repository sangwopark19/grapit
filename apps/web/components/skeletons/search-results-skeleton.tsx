import { Skeleton } from '@/components/ui/skeleton';

export function SearchResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-[80px] aspect-[2/3]" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[60%]" />
              <Skeleton className="h-3 w-[40%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
