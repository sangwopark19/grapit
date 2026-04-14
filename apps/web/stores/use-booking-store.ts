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

// ============================================================================
// E2E fixture hook (dev/test only) — Phase 9 DEBT-05 / REVIEWS.md HIGH-01
// Allows Playwright specs to inject booking state via `window.__BOOKING_FIXTURE__`
// so the confirm page doesn't redirect to /booking/:id (see confirm/page.tsx:62-66).
//
// Blocker B1 (revision-2): seats payload uses SeatSelection shape from
// packages/shared/src/types/booking.types.ts:30-37 — { seatId, tierName, price,
// row, number, tierColor? } — matching setBookingData's selectedSeats parameter.
//
// Production tree-shake: the `process.env.NODE_ENV !== 'production'` gate is
// resolved at build time by Next.js / Turbopack, removing this entire block
// from the production bundle.
// ============================================================================
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // Defer to next tick so the store is fully constructed when we read it.
  queueMicrotask(() => {
    const fixture = (
      window as unknown as {
        __BOOKING_FIXTURE__?: {
          performanceId: string;
          showtimeId: string;
          seats: SeatSelection[];
          performanceTitle: string;
          showDateTime: string;
          venue: string;
          posterUrl?: string;
        };
      }
    ).__BOOKING_FIXTURE__;

    if (fixture) {
      useBookingStore.getState().setBookingData({
        selectedSeats: fixture.seats,
        showtimeId: fixture.showtimeId,
        performanceId: fixture.performanceId,
        performanceTitle: fixture.performanceTitle,
        showDateTime: fixture.showDateTime,
        venue: fixture.venue,
        posterUrl: fixture.posterUrl ?? null,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
    }
  });
}
