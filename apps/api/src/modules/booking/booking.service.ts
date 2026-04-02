import { Injectable, Inject, ConflictException } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { eq, and } from 'drizzle-orm';
import { UPSTASH_REDIS } from './providers/redis.provider.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../database/drizzle.provider.js';
import { seatInventories } from '../../database/schema/seat-inventories.js';
import { BookingGateway } from './booking.gateway.js';
import type { LockSeatResponse, SeatState, SeatStatusResponse, UnlockAllResponse } from '@grapit/shared';

/** Maximum number of seats a user can lock per showtime (D-03) */
const MAX_SEATS = 4;

/** Lock TTL in seconds (10 minutes, per BOOK-03) */
const LOCK_TTL = 600;

/**
 * Lua script for atomic seat locking.
 * Cleans stale user-seats entries, checks count, SET NX, SADD + EXPIRE.
 *
 * KEYS[1] = user-seats:{showtimeId}:{userId}
 * KEYS[2] = seat:{showtimeId}:{seatId}
 * KEYS[3] = locked-seats:{showtimeId}
 * ARGV[1] = userId
 * ARGV[2] = LOCK_TTL (600)
 * ARGV[3] = MAX_SEATS (4)
 * ARGV[4] = seatId
 * ARGV[5] = key prefix "seat:{showtimeId}:"
 */
const LOCK_SEAT_LUA = `
local members = redis.call('SMEMBERS', KEYS[1])
local alive = 0
for i, sid in ipairs(members) do
  if redis.call('EXISTS', ARGV[5] .. sid) == 1 then
    alive = alive + 1
  else
    redis.call('SREM', KEYS[1], sid)
    redis.call('SREM', KEYS[3], sid)
  end
end
if alive >= tonumber(ARGV[3]) then
  return {0, 'MAX_SEATS'}
end
local ok = redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', tonumber(ARGV[2]))
if not ok then
  return {0, 'CONFLICT'}
end
redis.call('SADD', KEYS[1], ARGV[4])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
redis.call('SADD', KEYS[3], ARGV[4])
return {1, KEYS[2], ARGV[4]}
`;

@Injectable()
export class BookingService {
  constructor(
    @Inject(UPSTASH_REDIS) private readonly redis: Redis,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly gateway: BookingGateway,
  ) {}

  /**
   * Attempts to lock a seat for a user using a single Lua script (redis.eval).
   * Atomically: cleans stale user-seats, checks count, SET NX, SADD + EXPIRE.
   */
  async lockSeat(userId: string, showtimeId: string, seatId: string): Promise<LockSeatResponse> {
    const userSeatsKey = `user-seats:${showtimeId}:${userId}`;
    const lockKey = `seat:${showtimeId}:${seatId}`;
    const lockedSeatsKey = `locked-seats:${showtimeId}`;
    const keyPrefix = `seat:${showtimeId}:`;

    const result = await this.redis.eval<[string, string, string, string, string], [number, string, string?]>(
      LOCK_SEAT_LUA,
      [userSeatsKey, lockKey, lockedSeatsKey],
      [userId, String(LOCK_TTL), String(MAX_SEATS), seatId, keyPrefix],
    );

    const [status, reason] = result;

    if (status === 0) {
      if (reason === 'MAX_SEATS') {
        throw new ConflictException(`최대 ${MAX_SEATS}석까지 선택할 수 있습니다`);
      }
      throw new ConflictException('이미 다른 사용자가 선택한 좌석입니다');
    }

    // Broadcast real-time update (include userId so sender can ignore own events)
    this.gateway.broadcastSeatUpdate(showtimeId, seatId, 'locked', userId);

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
   * Unlocks ALL seats for a user in a showtime.
   * Used by timer reset to release all locks at once.
   * Not Lua-based because: called once per reset (no concurrency),
   * and we need per-seat broadcast calls in Node.
   */
  async unlockAllSeats(userId: string, showtimeId: string): Promise<UnlockAllResponse> {
    const userSeatsKey = `user-seats:${showtimeId}:${userId}`;
    const lockedSeatsKey = `locked-seats:${showtimeId}`;

    const members = await this.redis.smembers(userSeatsKey) as string[];

    if (members.length === 0) {
      return { unlockedSeats: [] };
    }

    const unlockedSeats: string[] = [];

    for (const seatId of members) {
      const lockKey = `seat:${showtimeId}:${seatId}`;
      const owner = await this.redis.get(lockKey);

      if (owner === userId) {
        await this.redis.del(lockKey);
        await this.redis.srem(lockedSeatsKey, seatId);
        this.gateway.broadcastSeatUpdate(showtimeId, seatId, 'available', userId);
        unlockedSeats.push(seatId);
      }
    }

    // Delete the user-seats key entirely
    await this.redis.del(userSeatsKey);

    return { unlockedSeats };
  }

  /**
   * Returns the current user's locked seats for a showtime.
   */
  async getMyLocks(userId: string, showtimeId: string): Promise<{ seatIds: string[]; expiresAt: number | null }> {
    const userSeats = await this.redis.smembers(`user-seats:${showtimeId}:${userId}`) as string[];

    if (userSeats.length === 0) {
      return { seatIds: [], expiresAt: null };
    }

    // Get actual remaining TTL from Redis
    const firstSeatKey = `seat:${showtimeId}:${userSeats[0]}`;
    const remainingTtl = await (this.redis as any).ttl(firstSeatKey) as number;
    const expiresAt = remainingTtl > 0 ? Date.now() + remainingTtl * 1000 : null;

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
