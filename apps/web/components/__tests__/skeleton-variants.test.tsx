import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceCardSkeleton } from '../skeletons/performance-card-skeleton';
import { BannerSkeleton } from '../skeletons/banner-skeleton';
import { GenreGridSkeleton } from '../skeletons/genre-grid-skeleton';
import { SectionSkeleton } from '../skeletons/section-skeleton';
import { DetailHeaderSkeleton } from '../skeletons/detail-header-skeleton';
import { DetailTabsSkeleton } from '../skeletons/detail-tabs-skeleton';
import { SearchResultsSkeleton } from '../skeletons/search-results-skeleton';
import { ReservationListSkeleton } from '../skeletons/reservation-list-skeleton';
import { ReservationDetailSkeleton } from '../skeletons/reservation-detail-skeleton';
import { SeatMapSkeleton } from '../skeletons/seat-map-skeleton';
import { MyPageProfileSkeleton } from '../skeletons/mypage-profile-skeleton';

describe('PerformanceCardSkeleton', () => {
  it('renders poster rectangle (aspect-[2/3]) and 3 text line Skeletons', () => {
    const { container } = render(<PerformanceCardSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    // 1 poster + 3 text lines = 4 skeletons
    expect(skeletons.length).toBe(4);

    // poster has aspect-[2/3]
    const poster = skeletons[0];
    expect(poster.className).toContain('aspect-[2/3]');
  });
});

describe('BannerSkeleton', () => {
  it('renders full-width rectangle with aspect-[2.5/1]', () => {
    const { container } = render(<BannerSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    expect(skeletons[0].className).toContain('aspect-[2.5/1]');
  });
});

describe('GenreGridSkeleton', () => {
  it('renders 8 rounded rectangles', () => {
    const { container } = render(<GenreGridSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons.length).toBe(8);
  });
});

describe('SectionSkeleton', () => {
  it('renders 4 horizontal card skeletons', () => {
    const { container } = render(<SectionSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    // title (1) + 4 cards * (poster + 2 text) = 1 + 12 = 13
    expect(skeletons.length).toBe(13);
  });
});

describe('DetailHeaderSkeleton', () => {
  it('renders poster + 5 text lines', () => {
    const { container } = render(<DetailHeaderSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    // 1 poster + 5 text lines = 6
    expect(skeletons.length).toBe(6);
  });
});

describe('ReservationListSkeleton', () => {
  it('renders 3 card skeletons', () => {
    const { container } = render(<ReservationListSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');

    expect(skeletons.length).toBe(3);
  });
});

describe('All skeletons accessibility', () => {
  const allSkeletons = [
    { name: 'PerformanceCardSkeleton', Component: PerformanceCardSkeleton },
    { name: 'BannerSkeleton', Component: BannerSkeleton },
    { name: 'GenreGridSkeleton', Component: GenreGridSkeleton },
    { name: 'SectionSkeleton', Component: SectionSkeleton },
    { name: 'DetailHeaderSkeleton', Component: DetailHeaderSkeleton },
    { name: 'DetailTabsSkeleton', Component: DetailTabsSkeleton },
    { name: 'SearchResultsSkeleton', Component: SearchResultsSkeleton },
    { name: 'ReservationListSkeleton', Component: ReservationListSkeleton },
    { name: 'ReservationDetailSkeleton', Component: ReservationDetailSkeleton },
    { name: 'SeatMapSkeleton', Component: SeatMapSkeleton },
    { name: 'MyPageProfileSkeleton', Component: MyPageProfileSkeleton },
  ];

  it.each(allSkeletons)('$name has aria-busy="true" attribute', ({ Component }) => {
    const { container } = render(<Component />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper.getAttribute('aria-busy')).toBe('true');
  });

  it.each(allSkeletons)(
    '$name has aria-label="콘텐츠를 불러오는 중입니다"',
    ({ Component }) => {
      const { container } = render(<Component />);
      const wrapper = container.firstElementChild as HTMLElement;

      expect(wrapper.getAttribute('aria-label')).toBe('콘텐츠를 불러오는 중입니다');
    },
  );
});
