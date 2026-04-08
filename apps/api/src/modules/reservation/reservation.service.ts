import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import {
  reservations,
  reservationSeats,
  payments,
  showtimes,
  performances,
  priceTiers,
  venues,
  seatInventories,
} from '../../database/schema/index.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';
import { BookingService } from '../booking/booking.service.js';
import { BookingGateway } from '../booking/booking.gateway.js';
import type {
  SeatSelection,
  ReservationStatus,
  ReservationListItem,
  ReservationDetail,
  ConfirmPaymentRequest,
  PrepareReservationRequest,
  PrepareReservationResponse,
} from '@grapit/shared';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tossClient: TossPaymentsClient,
    private readonly bookingService: BookingService,
    private readonly bookingGateway: BookingGateway,
  ) {}

  generateReservationNumber(): string {
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `GRP-${dateStr}-${random}`;
  }

  async calculateTotalAmount(seats: SeatSelection[], performanceId: string): Promise<number> {
    const tiers = await this.db
      .select()
      .from(priceTiers)
      .where(eq(priceTiers.performanceId, performanceId));

    const tierMap = new Map(tiers.map((t) => [t.tierName, t.price]));

    let total = 0;
    for (const seat of seats) {
      const tierPrice = tierMap.get(seat.tierName);
      if (tierPrice === undefined) {
        throw new BadRequestException('유효하지 않은 등급입니다');
      }
      total += tierPrice;
    }

    return total;
  }

  calculateCancelDeadline(showDateTime: Date): Date {
    return new Date(showDateTime.getTime() - 24 * 60 * 60 * 1000);
  }

  async prepareReservation(
    dto: PrepareReservationRequest,
    userId: string,
  ): Promise<PrepareReservationResponse> {
    // 1. Idempotency: if a reservation already exists for this orderId, return it
    const [existing] = await this.db
      .select({ id: reservations.id, tossOrderId: reservations.tossOrderId })
      .from(reservations)
      .where(eq(reservations.tossOrderId, dto.orderId));

    if (existing) {
      return { reservationId: existing.id, orderId: dto.orderId };
    }

    // 2. Get showtime to determine performanceId and dateTime
    const [showtime] = await this.db
      .select()
      .from(showtimes)
      .where(eq(showtimes.id, dto.showtimeId));

    if (!showtime) {
      throw new NotFoundException('회차를 찾을 수 없습니다');
    }

    // 3. Calculate expected amount from DB (fraud prevention)
    const expectedAmount = await this.calculateTotalAmount(dto.seats, showtime.performanceId);

    if (expectedAmount !== dto.amount) {
      throw new BadRequestException('금액이 일치하지 않습니다');
    }

    // 4. Create pending reservation + seats atomically
    const reservationNumber = this.generateReservationNumber();
    const cancelDeadline = this.calculateCancelDeadline(showtime.dateTime);

    const result = await this.db.transaction(async (tx) => {
      const [reservation] = await tx
        .insert(reservations)
        .values({
          userId,
          showtimeId: dto.showtimeId,
          tossOrderId: dto.orderId,
          reservationNumber,
          status: 'PENDING_PAYMENT',
          totalAmount: dto.amount,
          cancelDeadline,
        })
        .returning();

      const reservationId = reservation!.id;

      await tx.insert(reservationSeats).values(
        dto.seats.map((seat) => ({
          reservationId,
          seatId: seat.seatId,
          tierName: seat.tierName,
          price: seat.price,
          row: seat.row,
          number: seat.number,
        })),
      );

      return reservation!;
    });

    return { reservationId: result.id, orderId: dto.orderId };
  }

  async confirmAndCreateReservation(
    dto: ConfirmPaymentRequest,
    userId: string,
  ): Promise<ReservationDetail> {
    // 1. Idempotency: check if payment already exists for this orderId
    const [existingPayment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.tossOrderId, dto.orderId));

    if (existingPayment) {
      return this.getReservationDetail(existingPayment.reservationId, userId);
    }

    // 2. Look up pending reservation by tossOrderId
    const [reservation] = await this.db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.tossOrderId, dto.orderId),
          eq(reservations.userId, userId),
        ),
      );

    if (!reservation) {
      throw new NotFoundException('예매 정보를 찾을 수 없습니다. 다시 시도해주세요.');
    }

    if (reservation.status !== 'PENDING_PAYMENT') {
      // Already confirmed — return detail
      return this.getReservationDetail(reservation.id, userId);
    }

    // 3. Amount validation against the prepared reservation
    if (reservation.totalAmount !== dto.amount) {
      throw new BadRequestException('금액이 일치하지 않습니다');
    }

    // 4. Call Toss Payments confirm API
    const tossResponse = await this.tossClient.confirmPayment({
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    });

    // 5. Update reservation status + create payment record + mark seats sold
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(reservations)
          .set({
            status: 'CONFIRMED',
            updatedAt: new Date(),
          })
          .where(eq(reservations.id, reservation.id));

        await tx.insert(payments).values({
          reservationId: reservation.id,
          paymentKey: tossResponse.paymentKey,
          tossOrderId: tossResponse.orderId,
          method: tossResponse.method,
          amount: tossResponse.totalAmount,
          status: 'DONE',
          paidAt: new Date(tossResponse.approvedAt),
        });

        // Mark seats as sold in seat_inventories
        const resSeats = await tx
          .select({ seatId: reservationSeats.seatId })
          .from(reservationSeats)
          .where(eq(reservationSeats.reservationId, reservation.id));

        for (const seat of resSeats) {
          const [existing] = await tx
            .select({ id: seatInventories.id })
            .from(seatInventories)
            .where(
              and(
                eq(seatInventories.showtimeId, reservation.showtimeId),
                eq(seatInventories.seatId, seat.seatId),
              ),
            );

          if (existing) {
            await tx
              .update(seatInventories)
              .set({ status: 'sold', soldAt: new Date(), lockedBy: null, lockedUntil: null })
              .where(eq(seatInventories.id, existing.id));
          } else {
            await tx
              .insert(seatInventories)
              .values({
                showtimeId: reservation.showtimeId,
                seatId: seat.seatId,
                status: 'sold',
                soldAt: new Date(),
              });
          }
        }
      });
    } catch (dbError) {
      // Compensation: attempt to cancel the Toss payment
      this.logger.error(
        `DB transaction failed after Toss confirm. paymentKey=${tossResponse.paymentKey}, orderId=${dto.orderId}`,
        dbError instanceof Error ? dbError.stack : String(dbError),
      );
      try {
        await this.tossClient.cancelPayment(tossResponse.paymentKey, '서버 오류로 인한 자동 취소');
        this.logger.log(`Compensation cancel succeeded. paymentKey=${tossResponse.paymentKey}`);
      } catch (cancelError) {
        this.logger.error(
          `CRITICAL: Compensation cancel also failed. paymentKey=${tossResponse.paymentKey}. Manual refund required.`,
          cancelError instanceof Error ? cancelError.stack : String(cancelError),
        );
      }
      throw new InternalServerErrorException(
        '결제는 승인되었으나 처리 중 오류가 발생했습니다. 자동 취소를 시도했습니다. 고객센터에 문의해주세요.',
      );
    }

    // Release Redis locks for this user's seats in this showtime
    await this.bookingService.unlockAllSeats(userId, reservation.showtimeId);

    // Broadcast sold status via WebSocket for each seat
    const confirmedSeats = await this.db
      .select({ seatId: reservationSeats.seatId })
      .from(reservationSeats)
      .where(eq(reservationSeats.reservationId, reservation.id));

    for (const seat of confirmedSeats) {
      this.bookingGateway.broadcastSeatUpdate(reservation.showtimeId, seat.seatId, 'sold', userId);
    }

    return this.getReservationDetail(reservation.id, userId);
  }

  async getMyReservations(userId: string, status?: ReservationStatus): Promise<ReservationListItem[]> {
    const conditions = [eq(reservations.userId, userId)];
    if (status) {
      conditions.push(
        eq(reservations.status, status as typeof reservations.status.enumValues[number]),
      );
    }

    const rows = await this.db
      .select({
        reservation: {
          id: reservations.id,
          reservationNumber: reservations.reservationNumber,
          status: reservations.status,
          totalAmount: reservations.totalAmount,
          createdAt: reservations.createdAt,
        },
        showtime: {
          dateTime: showtimes.dateTime,
        },
        performance: {
          title: performances.title,
          posterUrl: performances.posterUrl,
        },
        venue: {
          name: venues.name,
        },
      })
      .from(reservations)
      .innerJoin(showtimes, eq(reservations.showtimeId, showtimes.id))
      .innerJoin(performances, eq(showtimes.performanceId, performances.id))
      .leftJoin(venues, eq(performances.venueId, venues.id))
      .where(and(...conditions))
      .orderBy(desc(reservations.createdAt));

    // Batch-fetch all seats for all reservations (eliminates N+1)
    const reservationIds = rows.map((r) => r.reservation.id);
    const allSeats = reservationIds.length > 0
      ? await this.db
          .select()
          .from(reservationSeats)
          .where(inArray(reservationSeats.reservationId, reservationIds))
      : [];
    const seatsByReservation = new Map<string, typeof allSeats>();
    for (const seat of allSeats) {
      const existing = seatsByReservation.get(seat.reservationId) ?? [];
      existing.push(seat);
      seatsByReservation.set(seat.reservationId, existing);
    }

    const result: ReservationListItem[] = rows.map((row) => {
      const seats = seatsByReservation.get(row.reservation.id) ?? [];
      return {
        id: row.reservation.id,
        reservationNumber: row.reservation.reservationNumber,
        status: row.reservation.status as ReservationStatus,
        performanceTitle: row.performance.title,
        posterUrl: row.performance.posterUrl,
        showDateTime: row.showtime.dateTime?.toISOString() ?? '',
        venue: row.venue?.name ?? '',
        seats: seats.map((s) => ({
          seatId: s.seatId,
          tierName: s.tierName,
          price: s.price,
          row: s.row,
          number: s.number,
        })),
        totalAmount: row.reservation.totalAmount,
        createdAt: row.reservation.createdAt?.toISOString() ?? '',
      };
    });

    return result;
  }

  async getReservationDetail(reservationId: string, userId: string): Promise<ReservationDetail> {
    const [row] = await this.db
      .select({
        reservation: {
          id: reservations.id,
          userId: reservations.userId,
          reservationNumber: reservations.reservationNumber,
          status: reservations.status,
          totalAmount: reservations.totalAmount,
          cancelDeadline: reservations.cancelDeadline,
          cancelledAt: reservations.cancelledAt,
          cancelReason: reservations.cancelReason,
          createdAt: reservations.createdAt,
        },
        showtime: {
          dateTime: showtimes.dateTime,
        },
        performance: {
          title: performances.title,
          posterUrl: performances.posterUrl,
        },
        venue: {
          name: venues.name,
        },
      })
      .from(reservations)
      .innerJoin(showtimes, eq(reservations.showtimeId, showtimes.id))
      .innerJoin(performances, eq(showtimes.performanceId, performances.id))
      .leftJoin(venues, eq(performances.venueId, venues.id))
      .where(and(eq(reservations.id, reservationId), eq(reservations.userId, userId)));

    if (!row) {
      throw new NotFoundException('예매를 찾을 수 없습니다');
    }

    const seats = await this.db
      .select()
      .from(reservationSeats)
      .where(eq(reservationSeats.reservationId, reservationId));

    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.reservationId, reservationId));

    return {
      id: row.reservation.id,
      reservationNumber: row.reservation.reservationNumber,
      status: row.reservation.status as ReservationStatus,
      performanceTitle: row.performance.title,
      posterUrl: row.performance.posterUrl,
      showDateTime: row.showtime.dateTime?.toISOString() ?? '',
      venue: row.venue?.name ?? '',
      seats: seats.map((s) => ({
        seatId: s.seatId,
        tierName: s.tierName,
        price: s.price,
        row: s.row,
        number: s.number,
      })),
      totalAmount: row.reservation.totalAmount,
      createdAt: row.reservation.createdAt?.toISOString() ?? '',
      paymentMethod: payment?.method ?? '',
      paidAt: payment?.paidAt?.toISOString() ?? '',
      cancelDeadline: row.reservation.cancelDeadline?.toISOString() ?? '',
      cancelledAt: row.reservation.cancelledAt?.toISOString() ?? null,
      cancelReason: row.reservation.cancelReason ?? null,
      paymentKey: payment?.paymentKey ?? '',
    };
  }

  async getReservationByOrderId(orderId: string, userId: string): Promise<ReservationDetail | null> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.tossOrderId, orderId));

    if (!payment) {
      return null;
    }

    // Verify ownership
    const [reservation] = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, payment.reservationId), eq(reservations.userId, userId)));

    if (!reservation) {
      return null;
    }

    return this.getReservationDetail(payment.reservationId, userId);
  }

  async cancelReservation(reservationId: string, userId: string, reason: string): Promise<void> {
    let showtimeId: string | undefined;

    try {
      await this.db.transaction(async (tx) => {
        // 1. SELECT FOR UPDATE to lock the reservation row (prevents double-cancel race)
        const result = await tx.execute(
          sql`SELECT id, user_id, showtime_id, status, cancel_deadline FROM reservations WHERE id = ${reservationId} FOR UPDATE`,
        );
        const row = result.rows[0] as
          | { id: string; user_id: string; showtime_id: string; status: string; cancel_deadline: Date }
          | undefined;

        if (!row || row.user_id !== userId) {
          throw new NotFoundException('예매를 찾을 수 없습니다');
        }

        if (row.status !== 'CONFIRMED') {
          throw new BadRequestException('취소할 수 없는 상태입니다');
        }

        if (new Date(row.cancel_deadline) <= new Date()) {
          throw new ForbiddenException('취소 마감시간이 지났습니다');
        }

        showtimeId = row.showtime_id;

        // 2. Get payment within transaction
        const [payment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.reservationId, reservationId));

        // 3. Call Toss cancel before DB updates
        if (payment) {
          await this.tossClient.cancelPayment(payment.paymentKey, reason);
        }

        // 4. Update reservation + payment + restore seats
        const now = new Date();
        await tx
          .update(reservations)
          .set({
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: reason,
            updatedAt: now,
          })
          .where(eq(reservations.id, reservationId));

        if (payment) {
          await tx
            .update(payments)
            .set({
              status: 'CANCELED',
              cancelledAt: now,
              cancelReason: reason,
            })
            .where(eq(payments.reservationId, reservationId));
        }

        // Restore seat_inventories to available
        const cancelledSeats = await tx
          .select({ seatId: reservationSeats.seatId })
          .from(reservationSeats)
          .where(eq(reservationSeats.reservationId, reservationId));

        for (const seat of cancelledSeats) {
          await tx
            .update(seatInventories)
            .set({ status: 'available', soldAt: null, lockedBy: null, lockedUntil: null })
            .where(
              and(
                eq(seatInventories.showtimeId, row.showtime_id),
                eq(seatInventories.seatId, seat.seatId),
              ),
            );
        }
      });
    } catch (error) {
      // Re-throw business exceptions as-is
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // Toss cancel succeeded but DB failed — log CRITICAL for manual reconciliation
      this.logger.error(
        `CRITICAL: DB transaction failed after Toss cancel. reservationId=${reservationId}. Manual reconciliation required.`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        '취소 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.',
      );
    }

    // Broadcast available status via WebSocket for each cancelled seat
    if (showtimeId) {
      const freedSeats = await this.db
        .select({ seatId: reservationSeats.seatId })
        .from(reservationSeats)
        .where(eq(reservationSeats.reservationId, reservationId));

      for (const seat of freedSeats) {
        this.bookingGateway.broadcastSeatUpdate(showtimeId, seat.seatId, 'available');
      }
    }
  }
}
