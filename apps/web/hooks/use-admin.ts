'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  PerformanceListResponse,
  PerformanceWithDetails,
  Banner,
  CreatePerformanceInput,
  UpdatePerformanceInput,
  CreateBannerInput,
  SeatMapConfigInput,
} from '@grapit/shared';

// Performance list for admin table
export function useAdminPerformances(params: {
  status?: string;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'performances', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      searchParams.set('page', String(params.page ?? 1));
      return apiClient.get<PerformanceListResponse>(
        `/api/v1/admin/performances?${searchParams.toString()}`,
      );
    },
  });
}

// Performance detail for edit form
export function useAdminPerformanceDetail(id: string) {
  return useQuery({
    queryKey: ['admin', 'performance', id],
    queryFn: () =>
      apiClient.get<PerformanceWithDetails>(`/api/v1/performances/${id}`),
    enabled: !!id,
  });
}

// Create performance
export function useCreatePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePerformanceInput) =>
      apiClient.post<PerformanceWithDetails>(
        '/api/v1/admin/performances',
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'performances'] });
    },
  });
}

// Update performance
export function useUpdatePerformance(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePerformanceInput) =>
      apiClient.put<PerformanceWithDetails>(
        `/api/v1/admin/performances/${id}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'performances'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'performance', id],
      });
    },
  });
}

// Delete performance
export function useDeletePerformance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/admin/performances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'performances'] });
    },
  });
}

// Presigned upload URL
export function usePresignedUpload() {
  return useMutation({
    mutationFn: (params: {
      folder: string;
      contentType: string;
      extension: string;
    }) =>
      apiClient.post<{ uploadUrl: string; publicUrl: string; key: string }>(
        '/api/v1/admin/upload/presigned',
        params,
      ),
  });
}

// Save seat map config
export function useSaveSeatMap(performanceId: string) {
  return useMutation({
    mutationFn: (data: {
      svgUrl: string;
      seatConfig: SeatMapConfigInput;
      totalSeats: number;
    }) =>
      apiClient.post(
        `/api/v1/admin/performances/${performanceId}/seat-map`,
        data,
      ),
  });
}

// Banner hooks
export function useAdminBanners() {
  return useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: () => apiClient.get<Banner[]>('/api/v1/admin/banners'),
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBannerInput) =>
      apiClient.post<Banner>('/api/v1/admin/banners', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });
}

// Update banner (edit individual banner fields)
export function useUpdateBanner(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateBannerInput>) =>
      apiClient.put<Banner>(`/api/v1/admin/banners/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });
}

export function useReorderBanners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient.put('/api/v1/admin/banners/reorder', { orderedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });
}
