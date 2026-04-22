import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type {
  PerformanceListResponse,
  PerformanceWithDetails,
  PerformanceCardData,
  Banner,
} from '@grabit/shared';

export function usePerformances(genre: string) {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const sort = (searchParams.get('sort') ?? 'latest') as 'latest' | 'popular';
  const sub = searchParams.get('sub') ?? '';
  const ended = searchParams.get('ended') === 'true';

  return useQuery({
    queryKey: ['performances', genre, page, sort, sub, ended],
    queryFn: () => {
      const params = new URLSearchParams({
        genre,
        page: String(page),
        sort,
      });
      if (sub) params.set('sub', sub);
      if (ended) params.set('ended', 'true');
      return apiClient.get<PerformanceListResponse>(
        `/api/v1/performances?${params.toString()}`,
      );
    },
  });
}

export function usePerformanceDetail(id: string) {
  return useQuery({
    queryKey: ['performance', id],
    queryFn: () =>
      apiClient.get<PerformanceWithDetails>(`/api/v1/performances/${id}`),
    enabled: !!id,
  });
}

export function useHomeBanners() {
  return useQuery({
    queryKey: ['home', 'banners'],
    queryFn: () => apiClient.get<Banner[]>('/api/v1/home/banners'),
  });
}

export function useHotPerformances() {
  return useQuery({
    queryKey: ['home', 'hot'],
    queryFn: () =>
      apiClient.get<PerformanceCardData[]>('/api/v1/home/hot'),
  });
}

export function useNewPerformances() {
  return useQuery({
    queryKey: ['home', 'new'],
    queryFn: () =>
      apiClient.get<PerformanceCardData[]>('/api/v1/home/new'),
  });
}
