import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock socket.io-client
const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: false,
  io: { on: vi.fn(), off: vi.fn() },
};

vi.mock('@/lib/socket-client', () => ({
  createBookingSocket: vi.fn(() => mockSocket),
}));

// Mock booking store
const mockStore = {
  setConnected: vi.fn(),
  selectedSeats: [] as Array<{ seatId: string }>,
  removeSeat: vi.fn(),
};

vi.mock('@/stores/use-booking-store', () => ({
  useBookingStore: Object.assign(vi.fn(() => mockStore), {
    getState: vi.fn(() => mockStore),
  }),
}));

// Mock react-query
const mockQueryClient = {
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
};

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => mockQueryClient),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
    info: vi.fn(),
  },
}));

import { useBookingSocket } from '../use-socket';
import { createBookingSocket } from '@/lib/socket-client';

describe('useBookingSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects socket when showtimeId is provided', () => {
    renderHook(() => useBookingSocket('test-showtime-id'));

    expect(createBookingSocket).toHaveBeenCalled();
    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('emits join-showtime on connect', () => {
    renderHook(() => useBookingSocket('test-showtime-id'));

    // Find the 'connect' handler from on() calls
    const connectCall = (mockSocket.on as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    );
    expect(connectCall).toBeDefined();

    // Trigger the connect handler
    const connectHandler = connectCall![1] as () => void;
    connectHandler();

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'join-showtime',
      'test-showtime-id',
    );
  });

  it('calls setConnected(false) on disconnect', () => {
    renderHook(() => useBookingSocket('test-showtime-id'));

    // Find the 'disconnect' handler
    const disconnectCall = (mockSocket.on as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === 'disconnect',
    );
    expect(disconnectCall).toBeDefined();

    // Trigger the disconnect handler
    const disconnectHandler = disconnectCall![1] as () => void;
    disconnectHandler();

    expect(mockStore.setConnected).toHaveBeenCalledWith(false);
  });

  it('does nothing when showtimeId is null', () => {
    renderHook(() => useBookingSocket(null));

    expect(createBookingSocket).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useBookingSocket('test-showtime-id'),
    );

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'leave-showtime',
      'test-showtime-id',
    );
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
