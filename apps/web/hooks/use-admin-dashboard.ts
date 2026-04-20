'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  DashboardSummaryDto,
  DashboardRevenueDto,
  DashboardGenreDto,
  DashboardPaymentDto,
  DashboardTopDto,
  DashboardPeriod,
} from '@grapit/shared';

const STALE_TIME = 30_000; // 서버 TTL 60s의 절반
const FOCUS_REFETCH = false; // D-11/UI-SPEC UX: 스켈레톤 깜빡임 방지

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'summary'],
    queryFn: () =>
      apiClient.get<DashboardSummaryDto>('/api/v1/admin/dashboard/summary'),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: FOCUS_REFETCH,
  });
}

export function useDashboardRevenue(period: DashboardPeriod) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'revenue', period],
    queryFn: () =>
      apiClient.get<DashboardRevenueDto>(
        `/api/v1/admin/dashboard/revenue?period=${period}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: FOCUS_REFETCH,
  });
}

export function useDashboardGenre(period: DashboardPeriod) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'genre', period],
    queryFn: () =>
      apiClient.get<DashboardGenreDto>(
        `/api/v1/admin/dashboard/genre?period=${period}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: FOCUS_REFETCH,
  });
}

export function useDashboardPayment(period: DashboardPeriod) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'payment', period],
    queryFn: () =>
      apiClient.get<DashboardPaymentDto>(
        `/api/v1/admin/dashboard/payment?period=${period}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: FOCUS_REFETCH,
  });
}

export function useDashboardTop10() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'top10'],
    queryFn: () =>
      apiClient.get<DashboardTopDto>(
        '/api/v1/admin/dashboard/top-performances',
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: FOCUS_REFETCH,
  });
}
