'use client';

import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { Skeleton } from '@/components/ui/skeleton';
import { PerformanceCard } from '@/components/performance/performance-card';
import { useHotPerformances } from '@/hooks/use-performances';
import 'swiper/css';
import 'swiper/css/free-mode';

function HotSectionSkeleton() {
  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HotSection() {
  const { data: performances, isLoading } = useHotPerformances();

  if (isLoading) return <HotSectionSkeleton />;
  if (!performances?.length) return null;

  return (
    <section className="mt-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[28px] font-semibold leading-[1.2]">HOT 공연</h2>
        <Link
          href="/genre/musical?sort=popular"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          더보기
        </Link>
      </div>
      <Swiper
        modules={[FreeMode]}
        freeMode
        slidesPerView={1.5}
        spaceBetween={16}
        breakpoints={{
          768: { slidesPerView: 2.5 },
          1024: { slidesPerView: 4, spaceBetween: 24 },
        }}
      >
        {performances.map((p, i) => (
          <SwiperSlide key={p.id}>
            <PerformanceCard performance={p} priority={i < 2} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
