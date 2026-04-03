'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ReservationListItem,
  ReservationDetail,
  AdminBookingListItem,
  BookingStats,
  PaymentInfo,
} from '@grapit/shared';

export function useMyReservations(status?: string) {
  return useQuery({
    queryKey: ['reservations', 'me', status ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      return apiClient.get<ReservationListItem[]>(
        `/api/v1/users/me/reservations${params.toString() ? `?${params.toString()}` : ''}`,
      );
    },
    placeholderData: keepPreviousData,
  });
}

export function useReservationDetail(id: string) {
  return useQuery({
    queryKey: ['reservations', id],
    queryFn: () =>
      apiClient.get<ReservationDetail>(`/api/v1/reservations/${id}`),
    enabled: !!id,
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.put(`/api/v1/reservations/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

export function useAdminBookings(params: {
  status?: string;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'bookings', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status && params.status !== 'all')
        searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      searchParams.set('page', String(params.page ?? 1));
      return apiClient.get<{
        bookings: AdminBookingListItem[];
        stats: BookingStats;
        total: number;
      }>(`/api/v1/admin/bookings?${searchParams.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminBookingDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'bookings', id],
    queryFn: () =>
      apiClient.get<AdminBookingListItem & { paymentInfo: PaymentInfo }>(
        `/api/v1/admin/bookings/${id}`,
      ),
    enabled: !!id,
  });
}

export function useAdminRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/api/v1/admin/bookings/${id}/refund`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
}
