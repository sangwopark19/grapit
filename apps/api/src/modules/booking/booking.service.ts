import { Injectable, Inject, ConflictException } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { eq, and } from 'drizzle-orm';
import { UPSTASH_REDIS } from './providers/redis.provider.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { seatInventories } from '../../database/schema/seat-inventories.js';
import { BookingGateway } from './booking.gateway.js';
import type { LockSeatResponse, SeatState, SeatStatusResponse } from '@grapit/shared';

/** Maximum number of seats a user can lock per showtime (D-03) */
const MAX_SEATS = 4;

/** Lock TTL in seconds (10 minutes, per BOOK-03) */
const LOCK_TTL = 600;

@Injectable()
export class BookingService {
  constructor(
    @Inject(UPSTASH_REDIS) private readonly redis: Redis,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly gateway: BookingGateway,
  ) {}

  /**
   * Attempts to lock a seat for a user using Redis SET NX.
   * Writes to both user-seats and locked-seats Redis sets.
   */
  async lockSeat(userId: string, showtimeId: string, seatId: string): Promise<LockSeatResponse> {
    // 1. Check user seat count
    const currentCount = await this.redis.scard(`user-seats:${showtimeId}:${userId}`);
    if (currentCount >= MAX_SEATS) {
      throw new ConflictException(`최대 ${MAX_SEATS}석까지 선택할 수 있습니다`);
    }

    // 2. Attempt atomic lock via SET NX
    const lockKey = `seat:${showtimeId}:${seatId}`;
    const lockResult = await this.redis.set(lockKey, userId, { nx: true, ex: LOCK_TTL });

    if (lockResult === null) {
      throw new ConflictException('이미 다른 사용자가 선택한 좌석입니다');
    }

    // 3. Track user seats (with TTL matching lock)
    await this.redis.sadd(`user-seats:${showtimeId}:${userId}`, seatId);
    await this.redis.expire(`user-seats:${showtimeId}:${userId}`, LOCK_TTL);

    // 4. Track global locked seats (CRITICAL: populates set for getSeatStatus)
    await this.redis.sadd(`locked-seats:${showtimeId}`, seatId);

    // 5. Broadcast real-time update (include userId so sender can ignore own events)
    this.gateway.broadcastSeatUpdate(showtimeId, seatId, 'locked', userId);

    // 6. Return response
    return {
      success: true,
      lockId: lockKey,
      seatId,
      expiresAt: Date.now() + LOCK_TTL * 1000,
    };
  }

  /**
   * Releases a seat lock only if the caller is the owner.
   * Removes from both user-seats and locked-seats Redis sets.
   */
  async unlockSeat(userId: string, showtimeId: string, seatId: string): Promise<boolean> {
    const lockKey = `seat:${showtimeId}:${seatId}`;

    // 1. Check ownership
    const lockOwner = await this.redis.get(lockKey);
    if (lockOwner !== userId) {
      return false;
    }

    // 2. Delete lock
    await this.redis.del(lockKey);

    // 3. Remove from user set
    await this.redis.srem(`user-seats:${showtimeId}:${userId}`, seatId);

    // 4. Remove from global locked set (CRITICAL: keeps locked-seats in sync)
    await this.redis.srem(`locked-seats:${showtimeId}`, seatId);

    // 5. Broadcast real-time update
    this.gateway.broadcastSeatUpdate(showtimeId, seatId, 'available', userId);

    return true;
  }

  /**
   * Returns the current user's locked seats for a showtime.
   */
  async getMyLocks(userId: string, showtimeId: string): Promise<{ seatIds: string[]; expiresAt: number | null }> {
    const userSeats = await this.redis.smembers(`user-seats:${showtimeId}:${userId}`) as string[];

    if (userSeats.length === 0) {
      return { seatIds: [], expiresAt: null };
    }

    // Check the TTL of the first seat lock to estimate expiry
    const firstSeatKey = `seat:${showtimeId}:${userSeats[0]}`;
    const lockOwner = await this.redis.get(firstSeatKey);
    const expiresAt = lockOwner === userId ? Date.now() + LOCK_TTL * 1000 : null;

    // Filter to only seats still actually locked by this user
    const validSeats: string[] = [];
    for (const seatId of userSeats) {
      const owner = await this.redis.get(`seat:${showtimeId}:${seatId}`);
      if (owner === userId) validSeats.push(seatId);
    }

    return { seatIds: validSeats, expiresAt };
  }

  /**
   * Returns the status of all seats for a showtime.
   * Combines Redis locks + DB sold records.
   */
  async getSeatStatus(showtimeId: string): Promise<SeatStatusResponse> {
    // 1. Get locked seats from Redis
    const lockedSeats = await this.redis.smembers(`locked-seats:${showtimeId}`) as string[];

    // 2. Get sold seats from DB
    const soldSeats = await this.db
      .select({ seatId: seatInventories.seatId, status: seatInventories.status })
      .from(seatInventories)
      .where(
        and(
          eq(seatInventories.showtimeId, showtimeId),
          eq(seatInventories.status, 'sold'),
        ),
      );

    // 3. Build combined seat map
    const seats: Record<string, SeatState> = {};

    for (const seatId of lockedSeats) {
      seats[seatId] = 'locked';
    }

    for (const row of soldSeats) {
      seats[row.seatId] = 'sold';
    }

    return { showtimeId, seats };
  }
}
