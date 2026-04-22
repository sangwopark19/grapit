'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DashboardTopDto } from '@grabit/shared';
import { ChartPanelState } from './_state';

interface Props {
  data: DashboardTopDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function TopPerformancesTable({
  data,
  isLoading,
  isError,
  onRetry,
}: Props) {
  const rows = data ?? [];
  const showEmpty = !isLoading && !isError && rows.length === 0;
  const showError = !isLoading && isError;
  return (
    <div className="rounded-lg bg-white shadow-sm">
      {showError || showEmpty ? (
        <ChartPanelState
          mode={showError ? 'error' : 'empty'}
          heightClass="h-[280px]"
          onRetry={showError ? onRetry : undefined}
          emptyTitle="아직 인기 공연이 없습니다"
          emptyBody="최근 30일 예매가 누적되면 랭킹이 표시됩니다"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F5F5F7]">
              <TableHead scope="col" className="w-12 text-sm text-gray-600">
                순위
              </TableHead>
              <TableHead scope="col" className="w-16 text-sm text-gray-600">
                포스터
              </TableHead>
              <TableHead scope="col" className="text-sm text-gray-600">
                공연명
              </TableHead>
              <TableHead scope="col" className="w-32 text-sm text-gray-600">
                장르
              </TableHead>
              <TableHead scope="col" className="w-24 text-right text-sm text-gray-600">
                예매수
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-6" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-10 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading &&
              rows.map((row, i) => (
                <TableRow key={row.performanceId}>
                  <TableCell className="text-sm text-gray-900">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    {row.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.posterUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-gray-100" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {row.title}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {row.genre}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-900">
                    {row.bookingCount.toLocaleString()}건
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
