import { Skeleton } from '@/components/ui/skeleton';

export function MyPageProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-[50%]" />
          <Skeleton className="h-3 w-[40%]" />
          <Skeleton className="h-3 w-[30%]" />
        </div>
      </div>
    </div>
  );
}
