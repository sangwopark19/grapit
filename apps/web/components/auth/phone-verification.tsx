'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { SMS_CODE_EXPIRY_SECONDS } from '@grapit/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PhoneVerificationProps {
  phone: string;
  onPhoneChange: (phone: string) => void;
  onVerified: (code: string) => void;
  isVerified: boolean;
  error?: string;
}

export function PhoneVerification({
  phone,
  onPhoneChange,
  onVerified,
  isVerified,
  error,
}: PhoneVerificationProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  useEffect(() => {
    if (timeLeft <= 0) {
      clearTimer();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [timeLeft, clearTimer]);

  const isExpired = codeSent && timeLeft === 0 && !isVerified;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatPhoneInput(value: string): string {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }

  function handlePhoneInput(value: string) {
    const formatted = formatPhoneInput(value);
    onPhoneChange(formatted.replace(/-/g, ''));
  }

  async function handleSendCode() {
    if (!phone || phone.length < 10) return;

    setIsSending(true);
    setVerifyError(null);
    try {
      await apiClient.post('/api/v1/sms/send-code', { phone });
      setCodeSent(true);
      setCode('');
      setTimeLeft(SMS_CODE_EXPIRY_SECONDS);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.';
      setVerifyError(message);
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerifyCode() {
    if (code.length !== 6) return;

    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await apiClient.post<{ verified: boolean; message: string }>(
        '/api/v1/sms/verify-code',
        { phone, code },
      );
      if (res.verified) {
        clearTimer();
        onVerified(code);
      } else {
        setVerifyError('인증번호가 일치하지 않습니다');
      }
    } catch {
      setVerifyError('인증번호가 일치하지 않습니다');
    } finally {
      setIsVerifying(false);
    }
  }

  const displayPhone = formatPhoneInput(phone);

  return (
    <div className="space-y-3">
      {/* Phone input + send button */}
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="010-0000-0000"
          value={displayPhone}
          onChange={(e) => handlePhoneInput(e.target.value)}
          disabled={isVerified}
          className="flex-1"
        />
        <Button
          type="button"
          variant={codeSent && !isExpired ? 'outline' : 'default'}
          size="default"
          onClick={handleSendCode}
          disabled={isSending || phone.length < 10 || isVerified}
          className="shrink-0"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              발송 중...
            </>
          ) : isExpired ? (
            '재발송'
          ) : codeSent ? (
            '재발송'
          ) : (
            '인증번호 발송'
          )}
        </Button>
      </div>

      {/* Error from phone field */}
      {error && !verifyError && (
        <p className="text-[14px] text-error">{error}</p>
      )}

      {/* Code input + timer */}
      {codeSent && !isVerified && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="인증번호 6자리"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setCode(v.slice(0, 6));
              }}
              disabled={isExpired}
              className="flex-1"
            />
            <Button
              type="button"
              size="default"
              onClick={handleVerifyCode}
              disabled={code.length !== 6 || isVerifying || isExpired}
              className="shrink-0"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '확인'
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {timeLeft > 0 ? (
              <span className="text-[14px] text-[#C62828]">
                {formatTime(timeLeft)}
              </span>
            ) : (
              <span className="text-[14px] text-[#C62828]">시간 만료</span>
            )}
          </div>
        </div>
      )}

      {/* Verify error */}
      {verifyError && (
        <p className="text-[14px] text-error animate-in fade-in duration-150">
          {verifyError}
        </p>
      )}

      {/* Verified state */}
      {isVerified && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
          <span className="text-[14px] text-[#15803D]">인증 완료</span>
        </div>
      )}
    </div>
  );
}
