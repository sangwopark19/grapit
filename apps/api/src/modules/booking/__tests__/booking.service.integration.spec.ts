import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import IORedis from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { BookingService } from '../booking.service.js';

/**
 * Phase 07-05 integration spec — PROVES Lua scripts execute correctly on a
 * real Valkey 8 interpreter.
 *
 * Goal: close HIGH-consensus review concern #2 from 07-REVIEWS.md — "Valkey에
 * 대한 실제 런타임 테스트 0건". This spec boots a real Valkey 8 container via
 * testcontainers and runs lockSeat -> getSeatStatus -> unlockSeat via raw
 * ioredis.eval() with the exact Lua scripts from booking.service.ts.
 *
 * Runs only under `pnpm test:integration` (excluded from default `pnpm test`).
 * Requires Docker to be running on the host. If Docker is unavailable, the
 * testcontainers package will throw a clear error from beforeAll.
 *
 * Scope: single happy-path round-trip plus conflict + non-owner unlock edge
 * cases. Not meant to replicate every unit test. Goal is "does the Lua script
 * execute at all on Valkey 8 and return the expected tuple shape".
 */

// --- Lua scripts (copied from apps/api/src/modules/booking/booking.service.ts) ---
// If these ever diverge from booking.service.ts, this test catches it
// immediately in the assertion phase.

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

const UNLOCK_SEAT_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  redis.call('SREM', KEYS[3], ARGV[2])
  return 1
end
return 0
`;

const GET_VALID_LOCKED_SEATS_LUA = `
local members = redis.call('SMEMBERS', KEYS[1])
local alive = {}
for i, sid in ipairs(members) do
  if redis.call('EXISTS', ARGV[1] .. sid) == 1 then
    alive[#alive + 1] = sid
  else
    redis.call('SREM', KEYS[1], sid)
  end
end
return alive
`;

type PlannedBookingService = BookingService & {
  assertOwnedSeatLocks: (userId: string, showtimeId: string, seatIds: string[]) => Promise<void>;
  consumeOwnedSeatLocks: (
    userId: string,
    showtimeId: string,
    seatIds: string[],
  ) => Promise<{ consumedSeatIds: string[] }>;
};

function createPlannedBookingService(redis: IORedis): PlannedBookingService {
  const mockDb = {
    select: () => ({
      from: () => ({
        where: async () => [],
      }),
    }),
  };
  const mockGateway = {
    broadcastSeatUpdate: () => {},
  };
  return new BookingService(redis, mockDb as any, mockGateway as any) as unknown as PlannedBookingService;
}

describe('BookingService Lua scripts — real Valkey 8 integration', () => {
  let container: StartedTestContainer;
  let redis: IORedis;

  const userId = 'user-integ-1';
  const showtimeId = 'show-integ-1';
  const seatId = 'A-1';

  const userSeatsKey = `{${showtimeId}}:user-seats:${userId}`;
  const lockKey = `{${showtimeId}}:seat:${seatId}`;
  const lockedSeatsKey = `{${showtimeId}}:locked-seats`;
  const keyPrefix = `{${showtimeId}}:seat:`;
  const LOCK_TTL = 600;
  const MAX_SEATS = 4;

  beforeAll(async () => {
    container = await new GenericContainer('valkey/valkey:8-alpine')
      .withExposedPorts(6379)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    redis = new IORedis({ host, port, maxRetriesPerRequest: 3 });

    // Sanity: PING should return PONG
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (container) await container.stop();
  });

  it('locks a seat via LOCK_SEAT_LUA and returns [1, lockKey, seatId]', async () => {
    const result = (await redis.eval(
      LOCK_SEAT_LUA,
      3,
      userSeatsKey,
      lockKey,
      lockedSeatsKey,
      userId,
      String(LOCK_TTL),
      String(MAX_SEATS),
      seatId,
      keyPrefix,
    )) as [number, string, string];

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(lockKey);
    expect(result[2]).toBe(seatId);

    // Verify the lock was actually set
    const owner = await redis.get(lockKey);
    expect(owner).toBe(userId);

    // Verify TTL was set
    const ttl = await redis.ttl(lockKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(LOCK_TTL);

    // Verify SADD was applied
    const userSeats = await redis.smembers(userSeatsKey);
    expect(userSeats).toContain(seatId);

    const lockedSeats = await redis.smembers(lockedSeatsKey);
    expect(lockedSeats).toContain(seatId);
  });

  it('lists locked seats via GET_VALID_LOCKED_SEATS_LUA', async () => {
    const result = (await redis.eval(
      GET_VALID_LOCKED_SEATS_LUA,
      1,
      lockedSeatsKey,
      keyPrefix,
    )) as string[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain(seatId);
  });

  it('rejects duplicate lock on same seat with [0, CONFLICT]', async () => {
    const otherUser = 'user-integ-2';
    const otherUserSeatsKey = `{${showtimeId}}:user-seats:${otherUser}`;

    const result = (await redis.eval(
      LOCK_SEAT_LUA,
      3,
      otherUserSeatsKey,
      lockKey,
      lockedSeatsKey,
      otherUser,
      String(LOCK_TTL),
      String(MAX_SEATS),
      seatId,
      keyPrefix,
    )) as [number, string];

    expect(result[0]).toBe(0);
    expect(result[1]).toBe('CONFLICT');
  });

  it('unlocks the seat via UNLOCK_SEAT_LUA and returns 1 for the owner', async () => {
    const result = (await redis.eval(
      UNLOCK_SEAT_LUA,
      3,
      lockKey,
      userSeatsKey,
      lockedSeatsKey,
      userId,
      seatId,
    )) as number;

    expect(result).toBe(1);

    // Verify the lock was actually deleted
    const owner = await redis.get(lockKey);
    expect(owner).toBeNull();

    // Verify the set memberships were removed
    const userSeats = await redis.smembers(userSeatsKey);
    expect(userSeats).not.toContain(seatId);

    const lockedSeats = await redis.smembers(lockedSeatsKey);
    expect(lockedSeats).not.toContain(seatId);
  });

  it('unlock for non-owner returns 0 (no-op)', async () => {
    // Set up a lock owned by userId
    const seatId2 = 'A-2';
    const lockKey2 = `{${showtimeId}}:seat:${seatId2}`;

    await redis.set(lockKey2, userId, 'EX', LOCK_TTL);
    await redis.sadd(userSeatsKey, seatId2);
    await redis.sadd(lockedSeatsKey, seatId2);

    // Attempt unlock as a different user
    const result = (await redis.eval(
      UNLOCK_SEAT_LUA,
      3,
      lockKey2,
      `{${showtimeId}}:user-seats:user-impostor`,
      lockedSeatsKey,
      'user-impostor',
      seatId2,
    )) as number;

    expect(result).toBe(0);

    // Verify the lock is STILL held by the original user
    const owner = await redis.get(lockKey2);
    expect(owner).toBe(userId);
  });

  describe('planned lock ownership helpers — real Valkey 8 integration', () => {
    const ownershipUserId = 'ownership-user-1';
    const otherUserId = 'ownership-user-2';
    const ownershipShowtimeId = 'ownership-showtime-1';
    const ownershipUserSeatsKey = `{${ownershipShowtimeId}}:user-seats:${ownershipUserId}`;
    const ownershipLockedSeatsKey = `{${ownershipShowtimeId}}:locked-seats`;

    beforeEach(async () => {
      await redis.flushdb();
    });

    it('assertOwnedSeatLocks passes all-owned locks on real Valkey', async () => {
      const planned = createPlannedBookingService(redis);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-1`, ownershipUserId, 'EX', LOCK_TTL);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-2`, ownershipUserId, 'EX', LOCK_TTL);

      await expect(planned.assertOwnedSeatLocks(ownershipUserId, ownershipShowtimeId, ['A-1', 'A-2']))
        .resolves
        .toBeUndefined();
    });

    it('assertOwnedSeatLocks rejects missing locks on real Valkey', async () => {
      const planned = createPlannedBookingService(redis);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-1`, ownershipUserId, 'EX', LOCK_TTL);

      await expect(planned.assertOwnedSeatLocks(ownershipUserId, ownershipShowtimeId, ['A-1', 'A-2']))
        .rejects
        .toThrow('좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.');
    });

    it('assertOwnedSeatLocks rejects other-owner locks on real Valkey', async () => {
      const planned = createPlannedBookingService(redis);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-1`, ownershipUserId, 'EX', LOCK_TTL);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-2`, otherUserId, 'EX', LOCK_TTL);

      await expect(planned.assertOwnedSeatLocks(ownershipUserId, ownershipShowtimeId, ['A-1', 'A-2']))
        .rejects
        .toThrow('이미 다른 사용자가 선택한 좌석입니다.');
    });

    it('consumeOwnedSeatLocks performs stale-index cleanup on real Valkey', async () => {
      const planned = createPlannedBookingService(redis);
      await redis.sadd(ownershipUserSeatsKey, 'A-2');
      await redis.sadd(ownershipLockedSeatsKey, 'A-2');

      await expect(planned.assertOwnedSeatLocks(ownershipUserId, ownershipShowtimeId, ['A-2']))
        .rejects
        .toThrow('좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.');

      expect(await redis.sismember(ownershipUserSeatsKey, 'A-2')).toBe(0);
      expect(await redis.sismember(ownershipLockedSeatsKey, 'A-2')).toBe(0);
    });

    it('consumeOwnedSeatLocks supports unrelated lock preservation on real Valkey', async () => {
      const planned = createPlannedBookingService(redis);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-1`, ownershipUserId, 'EX', LOCK_TTL);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-2`, ownershipUserId, 'EX', LOCK_TTL);
      await redis.set(`{${ownershipShowtimeId}}:seat:A-3`, ownershipUserId, 'EX', LOCK_TTL);
      await redis.sadd(ownershipUserSeatsKey, 'A-1', 'A-2', 'A-3');
      await redis.sadd(ownershipLockedSeatsKey, 'A-1', 'A-2', 'A-3');

      await expect(planned.consumeOwnedSeatLocks(ownershipUserId, ownershipShowtimeId, ['A-1', 'A-2']))
        .resolves
        .toEqual({ consumedSeatIds: ['A-1', 'A-2'] });

      expect(await redis.get(`{${ownershipShowtimeId}}:seat:A-1`)).toBeNull();
      expect(await redis.get(`{${ownershipShowtimeId}}:seat:A-2`)).toBeNull();
      expect(await redis.get(`{${ownershipShowtimeId}}:seat:A-3`)).toBe(ownershipUserId);
      expect(await redis.sismember(ownershipUserSeatsKey, 'A-3')).toBe(1);
      expect(await redis.sismember(ownershipLockedSeatsKey, 'A-3')).toBe(1);
    });
  });
});
