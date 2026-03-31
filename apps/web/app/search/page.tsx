'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SearchIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { GenreChip } from '@/components/performance/genre-chip';
import { PerformanceGrid } from '@/components/performance/performance-grid';
import { PaginationNav } from '@/components/performance/pagination-nav';
import { useSearch } from '@/hooks/use-search';
import { GENRES, GENRE_LABELS } from '@grapit/shared';

const GENRE_FILTER_CHIPS = [
  { label: '전체', value: '' },
  ...GENRES.map((g) => ({ label: GENRE_LABELS[g], value: g })),
];

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const ended = searchParams.get('ended') === 'true';

  const { data, isLoading, isError } = useSearch();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== 'page') {
      params.delete('page');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  // No query -- prompt to search
  if (!q) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-6 py-16">
        <div className="flex flex-col items-center">
          <SearchIcon className="h-12 w-12 text-gray-400" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            공연을 검색하세요
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            공연명, 아티스트를 검색하세요
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      {/* Heading */}
      <h1 className="text-xl font-semibold text-gray-900">
        &apos;{q}&apos; 검색 결과
      </h1>
      <p className="mt-1 h-5 text-sm text-gray-600">
        {data ? `총 ${data.total}건` : '\u00A0'}
      </p>

      {/* Genre filter chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {GENRE_FILTER_CHIPS.map((chip) => (
          <GenreChip
            key={chip.value}
            label={chip.label}
            value={chip.value}
            isActive={genre === chip.value}
            onClick={() => updateParam('genre', chip.value)}
          />
        ))}
      </div>

      {/* Ended toggle */}
      <div className="mt-4 flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>판매종료 공연 포함</span>
          <Switch
            checked={ended}
            onCheckedChange={(checked: boolean) =>
              updateParam('ended', checked ? 'true' : '')
            }
          />
        </label>
      </div>

      {/* Results */}
      <div className="mt-6">
        {isError ? (
          <div className="flex flex-col items-center py-16">
            <p className="text-base text-gray-900">
              공연 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <PerformanceGrid
            performances={data?.data ?? []}
            isLoading={isLoading}
            emptyHeading="검색 결과가 없습니다"
            emptyBody="다른 키워드로 검색하거나 장르별 공연을 둘러보세요"
          />
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-12">
          <PaginationNav
            currentPage={data.page}
            totalPages={data.totalPages}
            onPageChange={(page) => updateParam('page', String(page))}
          />
        </div>
      )}
    </main>
  );
}
