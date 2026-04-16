import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Plan 08에서 GREEN 전환 예정 (phone-verification 컴포넌트 재작성)
import { PhoneVerification } from '../phone-verification';

// API client mock
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('PhoneVerification', () => {
  const defaultProps = {
    phone: '01012345678',
    onPhoneChange: vi.fn(),
    onVerified: vi.fn(),
    isVerified: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  // ---------- 초기 상태 ----------
  describe('초기 상태', () => {
    it('"인증번호 발송" 버튼이 존재', () => {
      render(<PhoneVerification {...defaultProps} />);
      expect(screen.getByRole('button', { name: /인증번호 발송/ })).toBeInTheDocument();
    });

    it('인증번호 입력 필드가 숨겨져 있음', () => {
      render(<PhoneVerification {...defaultProps} />);
      expect(screen.queryByPlaceholderText(/인증번호 6자리/)).not.toBeInTheDocument();
    });
  });

  // ---------- 발송 후 상태 ----------
  describe('발송 후', () => {
    it('"인증번호 6자리" 입력 필드가 노출', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/인증번호 6자리/)).toBeInTheDocument();
      });
    });

    it('30초 쿨다운 라벨 "재발송 (Ns)" 표시', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));
      await waitFor(() => {
        // 쿨다운 버튼에 "재발송 (30s)" 또는 유사한 카운트다운 라벨이 포함
        expect(screen.getByText(/재발송.*\d+s/)).toBeInTheDocument();
      });
    });
  });

  // ---------- 쿨다운 종료 ----------
  describe('쿨다운 종료', () => {
    it('"재발송" 버튼이 활성화(outline variant)', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      // 30초 경과
      vi.advanceTimersByTime(30_000);

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /재발송/ });
        expect(btn).not.toBeDisabled();
      });
    });
  });

  // ---------- 에러 카피 ----------
  describe('에러 카피', () => {
    it('429 에러 시 "잠시 후 다시 시도해주세요"', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const error429 = new Error('잠시 후 다시 시도해주세요');
      (error429 as { status?: number }).status = 429;
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error429);

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      await waitFor(() => {
        expect(screen.getByText(/잠시 후 다시 시도해주세요/)).toBeInTheDocument();
      });
    });

    it('410 에러 시 "인증번호가 만료되었습니다. 재발송해주세요"', async () => {
      const { apiClient } = await import('@/lib/api-client');
      // 발송 먼저 성공
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      // verify에서 410 에러
      const error410 = new Error('인증번호가 만료되었습니다. 재발송해주세요');
      (error410 as { status?: number }).status = 410;
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error410);

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/인증번호 6자리/);
        expect(input).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/인증번호 6자리/);
      await user.type(codeInput, '123456');
      await user.click(screen.getByRole('button', { name: /확인/ }));

      await waitFor(() => {
        expect(screen.getByText(/인증번호가 만료되었습니다/)).toBeInTheDocument();
      });
    });

    it('400 에러 시 "인증번호가 일치하지 않습니다"', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      // verify에서 400
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        verified: false,
        message: '인증번호가 일치하지 않습니다',
      });

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/인증번호 6자리/);
        expect(input).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText(/인증번호 6자리/);
      await user.type(codeInput, '999999');
      await user.click(screen.getByRole('button', { name: /확인/ }));

      await waitFor(() => {
        expect(screen.getByText(/인증번호가 일치하지 않습니다/)).toBeInTheDocument();
      });
    });
  });

  // ---------- 국가 감지 안내 ----------
  describe('국가 감지', () => {
    it('+66 입력 시 "태국 번호로 SMS를 발송합니다" 텍스트 노출', () => {
      render(<PhoneVerification {...defaultProps} phone="+66812345678" />);
      expect(screen.getByText(/태국 번호로 SMS를 발송합니다/)).toBeInTheDocument();
    });
  });

  // ---------- 시도 횟수 미노출 (D-19) ----------
  describe('시도 횟수 미노출', () => {
    it('"남은 시도" 문구가 없음 (D-19)', () => {
      render(<PhoneVerification {...defaultProps} />);
      expect(screen.queryByText(/남은 시도/)).not.toBeInTheDocument();
    });
  });

  // ---------- 접근성 ----------
  describe('접근성', () => {
    it('autoComplete="one-time-code" 존재', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/인증번호 6자리/);
        expect(input).toHaveAttribute('autocomplete', 'one-time-code');
      });
    });

    it('쿨다운 상태에서 aria-label="재발송 대기 중" 존재', async () => {
      const { apiClient } = await import('@/lib/api-client');
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      await waitFor(() => {
        expect(screen.getByLabelText(/재발송 대기 중/)).toBeInTheDocument();
      });
    });

    it('에러 메시지에 role="alert" 존재', async () => {
      const { apiClient } = await import('@/lib/api-client');
      const err = new Error('잠시 후 다시 시도해주세요');
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);

      render(<PhoneVerification {...defaultProps} />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });
  });
});
