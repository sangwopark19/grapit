'use client';

import { create } from 'zustand';
import type { SeatSelection } from '@grapit/shared';

interface BookingState {
  selectedDate: Date | null;
  selectedShowtimeId: string | null;
  selectedSeats: SeatSelection[];
  timerExpiresAt: number | null;
  isTimerExpired: boolean;
  isConnected: boolean;

  // Confirm page fields
  performanceId: string | null;
  performanceTitle: string | null;
  showDateTime: string | null;
  venue: string | null;
  posterUrl: string | null;
  expiresAt: number | null;

  setDate: (date: Date | null) => void;
  setShowtime: (id: string | null) => void;
  addSeat: (seat: SeatSelection) => void;
  removeSeat: (seatId: string) => void;
  clearSeats: () => void;
  setTimerExpiry: (expiresAt: number) => void;
  expireTimer: () => void;
  setConnected: (connected: boolean) => void;
  setBookingData: (data: {
    selectedSeats: SeatSelection[];
    showtimeId: string | null;
    performanceId: string | null;
    performanceTitle: string | null;
    showDateTime: string | null;
    venue: string | null;
    posterUrl: string | null;
    expiresAt: number | null;
  }) => void;
  clearBooking: () => void;
  resetBooking: () => void;
}

const initialState = {
  selectedDate: null,
  selectedShowtimeId: null,
  selectedSeats: [] as SeatSelection[],
  timerExpiresAt: null,
  isTimerExpired: false,
  isConnected: false,
  performanceId: null,
  performanceTitle: null,
  showDateTime: null,
  venue: null,
  posterUrl: null,
  expiresAt: null,
};

export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,

  setDate: (date) => set({ selectedDate: date }),

  setShowtime: (id) =>
    set({
      selectedShowtimeId: id,
      selectedSeats: [],
      timerExpiresAt: null,
      isTimerExpired: false,
    }),

  addSeat: (seat) =>
    set((state) => ({
      selectedSeats: [...state.selectedSeats, seat],
    })),

  removeSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.filter((s) => s.seatId !== seatId),
    })),

  clearSeats: () => set({ selectedSeats: [], timerExpiresAt: null, isTimerExpired: false }),

  setTimerExpiry: (expiresAt) =>
    set((state) => ({
      timerExpiresAt: state.timerExpiresAt === null ? expiresAt : state.timerExpiresAt,
    })),

  expireTimer: () => set({ isTimerExpired: true }),

  setConnected: (connected) => set({ isConnected: connected }),

  setBookingData: (data) =>
    set({
      selectedSeats: data.selectedSeats,
      selectedShowtimeId: data.showtimeId,
      performanceId: data.performanceId,
      performanceTitle: data.performanceTitle,
      showDateTime: data.showDateTime,
      venue: data.venue,
      posterUrl: data.posterUrl,
      expiresAt: data.expiresAt,
    }),

  clearBooking: () => set(initialState),

  resetBooking: () => set(initialState),
}));
