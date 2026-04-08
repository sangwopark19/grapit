'use client';

import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { SectionSkeleton } from '@/components/skeletons';
import { PerformanceCard } from '@/components/performance/performance-card';
import { useHotPerformances } from '@/hooks/use-performances';
import 'swiper/css';
import 'swiper/css/free-mode';

export function HotSection() {
  const { data: performances, isLoading } = useHotPerformances();

  if (isLoading) return <SectionSkeleton />;
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
