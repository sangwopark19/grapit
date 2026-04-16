import { describe, it, expect } from 'vitest';
// Plan 03에서 구현 예정
import { parseE164, isChinaMainland } from './phone.util.js';

describe('parseE164', () => {
  it('한국 로컬 번호 010-1234-5678을 E.164로 변환', () => {
    expect(parseE164('010-1234-5678')).toBe('+821012345678');
  });

  it('한국 로컬 번호 01012345678을 E.164로 변환', () => {
    expect(parseE164('01012345678')).toBe('+821012345678');
  });

  it('이미 E.164 형식인 +821012345678은 그대로 통과', () => {
    expect(parseE164('+821012345678')).toBe('+821012345678');
  });

  it('태국 번호 +66812345678은 E.164로 통과', () => {
    expect(parseE164('+66812345678')).toBe('+66812345678');
  });

  it('잘못된 번호에 대해 throw', () => {
    expect(() => parseE164('12345')).toThrow();
  });

  it('빈 문자열에 대해 throw', () => {
    expect(() => parseE164('')).toThrow();
  });
});

describe('isChinaMainland', () => {
  it('+8613912345678은 중국 본토로 감지 (true)', () => {
    expect(isChinaMainland('+8613912345678')).toBe(true);
  });

  it('+821012345678은 한국이므로 false', () => {
    expect(isChinaMainland('+821012345678')).toBe(false);
  });

  it('+85212345678 홍콩은 중국 본토가 아님 (false)', () => {
    expect(isChinaMainland('+85212345678')).toBe(false);
  });

  it('+85312345678 마카오는 중국 본토가 아님 (false)', () => {
    expect(isChinaMainland('+85312345678')).toBe(false);
  });

  it('+886912345678 대만은 중국 본토가 아님 (false)', () => {
    expect(isChinaMainland('+886912345678')).toBe(false);
  });

  // Review #8 CN edge cases
  it('0086 prefix로 시작하는 중국 번호 감지', () => {
    expect(isChinaMainland('008613912345678')).toBe(true);
  });

  it('full-width + 기호가 포함된 +86 번호 감지 (U+FF0B)', () => {
    // \uFF0B = full-width plus sign
    expect(isChinaMainland('\uFF0B8613912345678')).toBe(true);
  });

  it('불완전한 +86 번호는 false (번호 길이 부족)', () => {
    expect(isChinaMainland('+861234')).toBe(false);
  });

  it('공백 포함 + 86 139 1234 5678 감지', () => {
    expect(isChinaMainland('+ 86 139 1234 5678')).toBe(true);
  });
});
