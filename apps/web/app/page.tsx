'use client';

import { BannerSkeleton } from '@/components/skeletons';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { HotSection } from '@/components/home/hot-section';
import { NewSection } from '@/components/home/new-section';
import { GenreGrid } from '@/components/home/genre-grid';
import { useHomeBanners } from '@/hooks/use-performances';

export default function HomePage() {
  const { data: banners, isLoading: bannersLoading } = useHomeBanners();

  return (
    <main>
      <h1 className="sr-only">Grabit</h1>

      {/* Banner Carousel */}
      {bannersLoading ? (
        <BannerSkeleton />
      ) : (
        <BannerCarousel banners={banners ?? []} />
      )}

      {/* 빈 상태 안내 — 배너가 없고 로딩 완료인 경우 */}
      {!bannersLoading && (!banners || banners.length === 0) && (
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-12 text-center md:px-6">
          <p className="text-gray-500">
            공연을 검색하거나 장르별로 탐색해보세요.
          </p>
        </div>
      )}

      {/* Content sections */}
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
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
