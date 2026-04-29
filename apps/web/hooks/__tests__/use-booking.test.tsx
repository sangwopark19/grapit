import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useConfirmPayment, usePrepareReservation } from '../use-booking';
import { ApiClientError, apiClient } from '@/lib/api-client';
import type { ConfirmPaymentRequest, PrepareReservationRequest } from '@grabit/shared';

const { postMock, ApiClientErrorMock } = vi.hoisted(() => {
  class ApiClientError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'ApiClientError';
      this.statusCode = statusCode;
    }
  }

  return {
    postMock: vi.fn(),
    ApiClientErrorMock: ApiClientError,
  };
});

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: postMock,
  },
  ApiClientError: ApiClientErrorMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('use-booking payment mutations', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('usePrepareReservation() calls /api/v1/reservations/prepare with payload', async () => {
    const payload: PrepareReservationRequest = {
      orderId: 'GRP-LOCK-TEST',
      showtimeId: 'showtime-lock-test',
      seats: [{ seatId: 'A-1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
      amount: 50000,
    };
    postMock.mockResolvedValueOnce({ reservationId: 'reservation-lock-test', orderId: payload.orderId });

    const { result } = renderHook(() => usePrepareReservation(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync(payload)).resolves.toEqual({
      reservationId: 'reservation-lock-test',
      orderId: payload.orderId,
    });
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/reservations/prepare', payload);
  });

  it('useConfirmPayment() calls /api/v1/payments/confirm with payload', async () => {
    const payload: ConfirmPaymentRequest = {
      paymentKey: 'test_payment_key',
      orderId: 'GRP-LOCK-CONFIRM',
      amount: 50000,
    };
    postMock.mockResolvedValueOnce({
      id: 'reservation-lock-test',
      reservationNumber: 'GRP-LOCK-CONFIRM',
      status: 'CONFIRMED',
      performanceTitle: '락 테스트 공연',
      posterUrl: null,
      showDateTime: new Date().toISOString(),
      venue: '락 테스트 극장',
      seats: [{ seatId: 'A-1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
      totalAmount: 50000,
      createdAt: new Date().toISOString(),
      paymentMethod: 'card',
      paidAt: new Date().toISOString(),
      cancelDeadline: new Date().toISOString(),
      cancelledAt: null,
      cancelReason: null,
      paymentKey: payload.paymentKey,
    });

    const { result } = renderHook(() => useConfirmPayment(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/payments/confirm', payload);
  });

  it('keeps ApiClientError 409 lock-expired message as the mutation error', async () => {
    const payload: PrepareReservationRequest = {
      orderId: 'GRP-LOCK-EXPIRED',
      showtimeId: 'showtime-lock-test',
      seats: [{ seatId: 'A-1', tierName: 'VIP', price: 50000, row: 'A', number: '1' }],
      amount: 50000,
    };
    const error = new ApiClientError(
      '좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.',
      409,
    );
    postMock.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePrepareReservation(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync(payload)).rejects.toMatchObject({
      message: '좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.',
      statusCode: 409,
    });
  });
});
