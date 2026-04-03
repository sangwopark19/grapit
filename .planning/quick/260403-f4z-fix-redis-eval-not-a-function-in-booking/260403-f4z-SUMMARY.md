# Quick Task 260403-f4z: Fix redis eval not a function in BookingService lockSeat

## Problem
`BookingService.lockSeat` calls `this.redis.eval()` (Lua script for atomic seat locking), but the `InMemoryRedis` mock used in local dev (when Upstash is not configured) didn't implement `eval`.

## Fix
Added `eval()` method to `InMemoryRedis` class that implements the LOCK_SEAT_LUA script logic in JavaScript:
1. Clean stale user-seats entries
2. Check max seats limit
3. SET NX with EX (atomic lock)
4. SADD to user-seats and locked-seats sets

## Files Modified
- `apps/api/src/modules/booking/providers/redis.provider.ts` — Added `eval()` to InMemoryRedis

## Verification
- tsc --noEmit: clean
- 98/98 tests pass
