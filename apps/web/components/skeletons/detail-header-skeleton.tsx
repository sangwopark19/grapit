import { Skeleton } from '@/components/ui/skeleton';

export function DetailHeaderSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <div className="flex flex-col md:flex-row gap-6">
        <Skeleton className="aspect-[2/3] w-full md:w-[300px]" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-6 w-[60%]" />
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-4 w-[50%]" />
          <Skeleton className="h-4 w-[45%]" />
          <Skeleton className="h-4 w-[35%]" />
        </div>
      </div>
    </div>
  );
}
