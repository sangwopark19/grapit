export type SeatState = 'available' | 'locked' | 'sold';

export interface SeatSelection {
  seatId: string;
  tierName: string;
  tierColor: string;
  row: string;
  number: string;
  price: number;
}

export interface LockSeatRequest {
  showtimeId: string;
  seatId: string;
}

export interface LockSeatResponse {
  success: boolean;
  lockId: string;
  seatId: string;
  expiresAt: number;
}

export interface SeatStatusResponse {
  showtimeId: string;
  seats: Record<string, SeatState>;
}

export interface SeatUpdateEvent {
  seatId: string;
  status: SeatState;
  userId?: string;
}

export interface UnlockAllResponse {
  unlockedSeats: string[];
}
