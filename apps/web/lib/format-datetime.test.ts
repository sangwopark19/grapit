import { describe, it, expect } from 'vitest';
import { formatDateTime } from './format-datetime';

describe('formatDateTime', () => {
  it('returns em dash for null input', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns em dash for undefined input', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('formats a valid ISO date string to YYYY.MM.DD HH:mm', () => {
    const result = formatDateTime('2026-04-14T14:23:00Z');
    // 로컬 타임존에 따라 HH가 달라질 수 있으나, 연·월·일·콜론 포맷은 보장
    expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/);
    expect(result).toContain('2026.');
  });

  it('returns em dash for invalid date strings', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});
