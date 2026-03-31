'use client';

import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Skeleton } from '@/components/ui/skeleton';
import type { Banner } from '@grapit/shared';
import 'swiper/css';
import 'swiper/css/pagination';

interface BannerCarouselProps {
  banners: Banner[];
  isLoading?: boolean;
}

export function BannerCarousel({
  banners,
  isLoading = false,
}: BannerCarouselProps) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full md:h-[400px]" />;
  }

  if (banners.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center bg-gray-100 md:h-[400px]">
        <p className="text-sm text-gray-500">배너가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        loop={banners.length > 1}
        className="h-[200px] w-full md:h-[400px]"
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id}>
            {banner.linkUrl ? (
              <a href={banner.linkUrl} className="relative block h-full w-full">
                <Image
                  src={banner.imageUrl}
                  alt="프로모션 배너"
                  fill
                  className="object-cover"
                  priority
                />
              </a>
            ) : (
              <div className="relative h-full w-full">
                <Image
                  src={banner.imageUrl}
                  alt="프로모션 배너"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
