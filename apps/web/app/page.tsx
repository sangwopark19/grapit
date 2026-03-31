'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { HotSection } from '@/components/home/hot-section';
import { NewSection } from '@/components/home/new-section';
import { GenreGrid } from '@/components/home/genre-grid';
import { useHomeBanners } from '@/hooks/use-performances';

export default function HomePage() {
  const { data: banners, isLoading: bannersLoading } = useHomeBanners();

  return (
    <main>
      {/* Banner Carousel */}
      {bannersLoading ? (
        <Skeleton className="h-[200px] w-full md:h-[400px]" />
      ) : (
        <BannerCarousel banners={banners ?? []} />
      )}

      {/* Content sections */}
      <div className="mx-auto max-w-[1200px] px-6">
        {/* Self-contained: calls useHotPerformances() internally */}
        <HotSection />

        {/* Self-contained: calls useNewPerformances() internally */}
        <NewSection />

        {/* Static: no data fetching */}
        <GenreGrid />
      </div>
    </main>
  );
}
