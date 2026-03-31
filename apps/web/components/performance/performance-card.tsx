'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Ticket } from 'lucide-react';
import { cn } from '@/lib/cn';
import { StatusBadge } from './status-badge';
import type { PerformanceCardData } from '@grapit/shared';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

interface PerformanceCardProps {
  performance: PerformanceCardData;
  className?: string;
}

export function PerformanceCard({
  performance,
  className,
}: PerformanceCardProps) {
  return (
    <Link
      href={`/performance/${performance.id}`}
      className={cn(
        'group block overflow-hidden rounded-lg bg-white shadow-sm transition-shadow duration-150 hover:shadow-md',
        className,
      )}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-t-lg bg-gray-200">
        {performance.posterUrl ? (
          <Image
            src={performance.posterUrl}
            alt={`${performance.title} 포스터`}
            fill
            className="object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 50vw, 25vw"
            quality={80}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Ticket className="h-12 w-12 text-gray-400" />
          </div>
        )}
        <StatusBadge
          status={performance.status}
          className="absolute left-2 top-2"
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
          {performance.title}
        </h3>
        {performance.venueName && (
          <p className="mt-1 line-clamp-1 text-sm text-gray-600">
            {performance.venueName}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-600">
          {formatDate(performance.startDate)} ~{' '}
          {formatDate(performance.endDate)}
        </p>
      </div>
    </Link>
  );
}
