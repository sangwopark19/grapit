'use client';

import Link from 'next/link';
import {
  Music,
  Mic,
  Drama,
  Frame,
  Piano,
  Trophy,
  Baby,
  Tent,
} from 'lucide-react';
import type { Genre } from '@grapit/shared';
import { GENRE_LABELS } from '@grapit/shared';
import type { LucideIcon } from 'lucide-react';

const GENRE_ICONS: Record<Genre, LucideIcon> = {
  musical: Music,
  concert: Mic,
  play: Drama,
  exhibition: Frame,
  classic: Piano,
  sports: Trophy,
  kids_family: Baby,
  leisure_camping: Tent,
};

const GENRE_LIST: Genre[] = [
  'musical',
  'concert',
  'play',
  'exhibition',
  'classic',
  'sports',
  'kids_family',
  'leisure_camping',
];

// 빈 상태 발생 시: SearchIcon 대신 Telescope 또는 LayoutGrid 아이콘 사용
// 장르 바로가기는 정적 컴포넌트로 현재 빈 상태 없음
export function GenreGrid() {
  return (
    <section className="mt-10 pb-12">
      <h2 className="mb-6 text-display font-semibold leading-[1.2]">
        장르별 바로가기
      </h2>
      <div className="grid grid-cols-4 gap-4 lg:grid-cols-8">
        {GENRE_LIST.map((genre) => {
          const Icon = GENRE_ICONS[genre];
          return (
            <Link
              key={genre}
              href={`/genre/${genre}`}
              className="flex flex-col items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F7]">
                <Icon className="h-7 w-7 text-gray-700" />
              </div>
              <span className="text-sm text-gray-900">
                {GENRE_LABELS[genre]}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
