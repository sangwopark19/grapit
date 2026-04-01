'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import type { SeatUpdateEvent, SeatStatusResponse } from '@grapit/shared';
import { createBookingSocket } from '@/lib/socket-client';
import { useBookingStore } from '@/stores/use-booking-store';

export function useBookingSocket(showtimeId: string | null): void {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const hadPreviousConnection = useRef(false);

  useEffect(() => {
    if (!showtimeId) return;

    const socket = createBookingSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      useBookingStore.getState().setConnected(true);
      socket.emit('join-showtime', showtimeId);

      if (hadPreviousConnection.current) {
        // Reconnect after disconnect
        toast.success('실시간 연결이 복구되었습니다', {
          id: 'ws-status',
          duration: 3000,
        });
        queryClient.invalidateQueries({
          queryKey: ['seat-status', showtimeId],
        });
      }

      hadPreviousConnection.current = true;
    });

    socket.on('disconnect', () => {
      useBookingStore.getState().setConnected(false);
      toast.loading('실시간 연결이 끊어졌습니다. 재연결 중...', {
        id: 'ws-status',
      });
    });

    socket.on('seat-update', (data: SeatUpdateEvent) => {
      // Update React Query cache directly
      queryClient.setQueryData<SeatStatusResponse>(
        ['seat-status', showtimeId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            seats: { ...old.seats, [data.seatId]: data.status },
          };
        },
      );

      // Race condition check: if another user locked a seat we selected
      const store = useBookingStore.getState();
      if (data.status === 'locked') {
        const isOurSeat = store.selectedSeats.some(
          (s) => s.seatId === data.seatId,
        );
        if (isOurSeat) {
          store.removeSeat(data.seatId);
          toast.info('이미 다른 사용자가 선택한 좌석입니다', {
            style: { backgroundColor: '#F3EFFF', color: '#6C3CE0' },
          });
        }
      }
    });

    socket.connect();

    return () => {
      socket.emit('leave-showtime', showtimeId);
      socket.disconnect();
      socketRef.current = null;
      hadPreviousConnection.current = false;
    };
  }, [showtimeId, queryClient]);
}
