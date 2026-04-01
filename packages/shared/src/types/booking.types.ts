export type SeatState = 'available' | 'locked' | 'sold';

export interface SeatSelection {
  seatId: string;
  tierName: string;
  tierColor: string;
  row: string;       // e.g. "A"
  number: string;    // e.g. "1"
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
  expiresAt: number;  // Unix ms timestamp
}

export interface SeatStatusResponse {
  showtimeId: string;
  seats: Record<string, SeatState>;  // seatId -> state
}

export interface SeatUpdateEvent {
  seatId: string;
  status: SeatState;
  userId?: string;
}
