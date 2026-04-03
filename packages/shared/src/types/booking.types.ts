export type ReservationStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

export interface SeatSelection {
  seatId: string;
  tierName: string;
  price: number;
  row: string;
  number: string;
}

export interface ReservationListItem {
  id: string;
  reservationNumber: string;
  status: ReservationStatus;
  performanceTitle: string;
  posterUrl: string | null;
  showDateTime: string;
  venue: string;
  seats: SeatSelection[];
  totalAmount: number;
  createdAt: string;
}

export interface ReservationDetail extends ReservationListItem {
  paymentMethod: string;
  paidAt: string;
  cancelDeadline: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  paymentKey: string;
}

export interface BookingStats {
  totalBookings: number;
  totalRevenue: number;
  cancelRate: number;
}

export interface AdminBookingListItem {
  id: string;
  reservationNumber: string;
  userName: string;
  userPhone: string;
  performanceTitle: string;
  showDateTime: string;
  seats: SeatSelection[];
  totalAmount: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface PaymentInfo {
  paymentKey: string;
  method: string;
  paidAt: string;
  amount: number;
}

export interface CancelReservationRequest {
  reason: string;
}

export interface AdminRefundRequest {
  reason: string;
}
