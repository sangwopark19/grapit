import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct initial state when expiresAt is 600s from now', () => {
    const now = Date.now();
    const expiresAt = now + 600_000; // 10 minutes
    const onExpire = vi.fn();

    const { result } = renderHook(() => useCountdown(expiresAt, onExpire));

    expect(result.current.isActive).toBe(true);
    expect(result.current.isWarning).toBe(false);
    // Should be approximately 10 minutes (within 1 minute tolerance)
    expect(result.current.minutes).toBeGreaterThanOrEqual(9);
    expect(result.current.minutes).toBeLessThanOrEqual(10);
  });

  it('enters warning state at 3 minutes or less', () => {
    const now = Date.now();
    const expiresAt = now + 180_000; // exactly 3 minutes
    const onExpire = vi.fn();

    const { result } = renderHook(() => useCountdown(expiresAt, onExpire));

    expect(result.current.isWarning).toBe(true);
  });

  it('calls onExpire when remaining reaches 0', () => {
    const now = Date.now();
    const expiresAt = now + 2_000; // 2 seconds
    const onExpire = vi.fn();

    renderHook(() => useCountdown(expiresAt, onExpire));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('returns inactive state when expiresAt is null', () => {
    const onExpire = vi.fn();

    const { result } = renderHook(() => useCountdown(null, onExpire));

    expect(result.current.isActive).toBe(false);
    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(0);
    expect(result.current.isWarning).toBe(false);
  });

  it('cleans up interval on unmount', () => {
    const now = Date.now();
    const expiresAt = now + 60_000; // 1 minute
    const onExpire = vi.fn();

    const { unmount } = renderHook(() => useCountdown(expiresAt, onExpire));

    unmount();

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(onExpire).not.toHaveBeenCalled();
  });
});
