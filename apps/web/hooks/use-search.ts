import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { SearchResponse } from '@grapit/shared';

export function useSearch() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const ended = searchParams.get('ended') === 'true';
  const page = Number(searchParams.get('page') ?? '1');

  return useQuery({
    queryKey: ['search', q, genre, ended, page],
    queryFn: () => {
      const params = new URLSearchParams({ q, page: String(page) });
      if (genre) params.set('genre', genre);
      if (ended) params.set('ended', 'true');
      return apiClient.get<SearchResponse>(
        `/api/v1/search?${params.toString()}`,
      );
    },
    enabled: q.length > 0,
  });
}
