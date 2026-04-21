import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  kstBoundaryToUtc,
  kstTodayBoundaryUtc,
  buildDailyBucketSkeleton,
} from '../kst-boundary.js';

/**
 * kst-boundary 순수 함수 회귀 테스트.
 *
 * 배경: PR #17 코드리뷰에서 `kstTodayBoundaryUtc()` 가 `kstBoundaryToUtc(0)` 를 호출하여
 * startUtc === endUtc 가 되는 버그가 발견됨. 기존 service unit test는 DB mock 고정값을
 * 반환하므로 WHERE 절이 empty여도 green → 회귀 포착 불가. 이 테스트가 그 공백을 채운다.
 */
describe('kst-boundary', () => {
  const DAY_MS = 86_400_000;
  // 2026-04-20 12:00 UTC = 2026-04-20 21:00 KST (오늘은 2026-04-20 KST).
  const FIXED_NOW = new Date('2026-04-20T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('kstTodayBoundaryUtc', () => {
    it('returns a 24-hour window (startUtc !== endUtc) — regression for PR #17 empty-range bug', () => {
      const { startUtc, endUtc } = kstTodayBoundaryUtc();
      expect(endUtc.getTime() - startUtc.getTime()).toBe(DAY_MS);
      expect(startUtc.getTime()).toBeLessThan(endUtc.getTime());
    });

    it('aligns boundaries to KST midnight (UTC 15:00 of the previous calendar day)', () => {
      const { startUtc, endUtc } = kstTodayBoundaryUtc();
      // 2026-04-20 00:00 KST = 2026-04-19 15:00 UTC
      expect(startUtc.toISOString()).toBe('2026-04-19T15:00:00.000Z');
      // 2026-04-21 00:00 KST = 2026-04-20 15:00 UTC
      expect(endUtc.toISOString()).toBe('2026-04-20T15:00:00.000Z');
    });
  });

  describe('kstBoundaryToUtc', () => {
    it('returns a 7-day window for days=7 ending at tomorrow 00:00 KST', () => {
      const { startUtc, endUtc } = kstBoundaryToUtc(7);
      expect(endUtc.getTime() - startUtc.getTime()).toBe(7 * DAY_MS);
      expect(endUtc.toISOString()).toBe('2026-04-20T15:00:00.000Z');
      // 6 days ago 00:00 KST = 2026-04-14 00:00 KST = 2026-04-13 15:00 UTC
      expect(startUtc.toISOString()).toBe('2026-04-13T15:00:00.000Z');
    });

    it('returns a 30-day window for days=30 ending at tomorrow 00:00 KST', () => {
      const { startUtc, endUtc } = kstBoundaryToUtc(30);
      expect(endUtc.getTime() - startUtc.getTime()).toBe(30 * DAY_MS);
    });

    it('returns a 90-day window for days=90', () => {
      const { startUtc, endUtc } = kstBoundaryToUtc(90);
      expect(endUtc.getTime() - startUtc.getTime()).toBe(90 * DAY_MS);
    });

    it('throws RangeError for days=0 (prevents future empty-window regression)', () => {
      expect(() => kstBoundaryToUtc(0)).toThrow(RangeError);
    });

    it('throws RangeError for negative days', () => {
      expect(() => kstBoundaryToUtc(-1)).toThrow(RangeError);
    });

    it('throws RangeError for non-integer days', () => {
      expect(() => kstBoundaryToUtc(1.5)).toThrow(RangeError);
    });
  });

  describe('kstTodayBoundaryUtc and kstBoundaryToUtc(1) parity', () => {
    it('delegates to kstBoundaryToUtc(1) — same boundaries', () => {
      const today = kstTodayBoundaryUtc();
      const oneDay = kstBoundaryToUtc(1);
      expect(today.startUtc.getTime()).toBe(oneDay.startUtc.getTime());
      expect(today.endUtc.getTime()).toBe(oneDay.endUtc.getTime());
    });
  });

  describe('buildDailyBucketSkeleton alignment with kstBoundaryToUtc', () => {
    it('first bucket matches startUtc KST date for a 7-day window', () => {
      const { startUtc } = kstBoundaryToUtc(7);
      const buckets = buildDailyBucketSkeleton(7);
      expect(buckets).toHaveLength(7);
      // startUtc 는 6 days ago KST 00:00 = 2026-04-13 15:00 UTC → KST 로는 2026-04-14.
      // buckets[0] 는 가장 오래된 날짜.
      expect(buckets[0]).toBe('2026-04-14');
      expect(buckets[6]).toBe('2026-04-20');
      // 일관성: startUtc + 9h (KST 변환) 의 날짜가 buckets[0] 과 일치.
      const startKst = new Date(startUtc.getTime() + 9 * 60 * 60 * 1000);
      const y = startKst.getUTCFullYear();
      const m = String(startKst.getUTCMonth() + 1).padStart(2, '0');
      const d = String(startKst.getUTCDate()).padStart(2, '0');
      expect(`${y}-${m}-${d}`).toBe(buckets[0]);
    });
  });
});
