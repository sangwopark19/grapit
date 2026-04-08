import { Skeleton } from '@/components/ui/skeleton';

export function BannerSkeleton() {
  return (
    <div aria-busy="true" aria-label="콘텐츠를 불러오는 중입니다">
      <Skeleton className="aspect-[2.5/1] w-full" />
    </div>
  );
}
