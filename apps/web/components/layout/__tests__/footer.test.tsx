import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../footer';

describe('Footer (D-03, D-04)', () => {
  describe('링크 href 계약 (D-03)', () => {
    it('이용약관 링크가 /legal/terms 로 연결된다', () => {
      render(<Footer />);
      const link = screen.getByText('이용약관').closest('a');
      expect(link?.getAttribute('href')).toBe('/legal/terms');
    });

    it('개인정보처리방침 링크가 /legal/privacy 로 연결되며 font-semibold 강조를 유지한다 (정통망법)', () => {
      render(<Footer />);
      const link = screen.getByText('개인정보처리방침').closest('a');
      expect(link?.getAttribute('href')).toBe('/legal/privacy');
      expect(link?.className).toContain('font-semibold');
    });

    it('고객센터 링크가 mailto:support@heygrabit.com 으로 변경된다', () => {
      render(<Footer />);
      const link = screen.getByText('고객센터').closest('a');
      expect(link?.getAttribute('href')).toBe('mailto:support@heygrabit.com');
    });

    it('고객센터 링크에 target/rel 이 부착되지 않는다 (mailto 는 새 탭 의미 없음)', () => {
      render(<Footer />);
      const link = screen.getByText('고객센터').closest('a');
      expect(link?.getAttribute('target')).toBeNull();
      expect(link?.getAttribute('rel')).toBeNull();
    });
  });

  describe('마케팅 수신 동의 미노출 (D-04 회귀 가드)', () => {
    it('Footer 에 /legal/marketing 링크가 등장하지 않는다', () => {
      const { container } = render(<Footer />);
      expect(container.innerHTML).not.toContain('/legal/marketing');
    });

    it('Footer 에 "마케팅" 텍스트가 등장하지 않는다', () => {
      render(<Footer />);
      expect(screen.queryByText(/마케팅/)).toBeNull();
    });
  });

  describe('변경 금지 영역 (UI-SPEC §Layout Contract)', () => {
    it('Copyright 라인이 변경되지 않는다', () => {
      render(<Footer />);
      expect(screen.getByText(/© 2026 Grabit\. All rights reserved\./)).not.toBeNull();
    });
  });
});
