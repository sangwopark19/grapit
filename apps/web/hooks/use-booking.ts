import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  Showtime,
  SeatStatusResponse,
  LockSeatRequest,
  LockSeatResponse,
} from '@grapit/shared';

export function useShowtimes(performanceId: string) {
  return useQuery({
    queryKey: ['showtimes', performanceId],
    queryFn: () =>
      apiClient.get<Showtime[]>(
        `/api/v1/performances/${performanceId}/showtimes`,
      ),
    enabled: !!performanceId,
  });
}

export function useSeatStatus(showtimeId: string | null) {
  return useQuery({
    queryKey: ['seat-status', showtimeId],
    queryFn: () =>
      apiClient.get<SeatStatusResponse>(
        `/api/v1/booking/schedules/${showtimeId}/seats`,
      ),
    enabled: !!showtimeId,
  });
}

export function useLockSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LockSeatRequest) =>
      apiClient.post<LockSeatResponse>('/api/v1/booking/seats/lock', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['seat-status', variables.showtimeId],
      });
    },
  });
}

export function useUnlockSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      showtimeId,
      seatId,
    }: {
      showtimeId: string;
      seatId: string;
    }) =>
      apiClient.delete<void>(
        `/api/v1/booking/seats/lock/${showtimeId}/${seatId}`,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['seat-status', variables.showtimeId],
      });
    },
  });
}
