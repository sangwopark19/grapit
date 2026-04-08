'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/stores/use-booking-store';

interface ConfirmHeaderProps {
  onExpire: () => void;
}

export function ConfirmHeader({ onExpire }: ConfirmHeaderProps) {
  const router = useRouter();
  const expiresAt = useBookingStore((s) => s.expiresAt);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isWarning = remainingSeconds <= 180;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm md:h-14">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.back()}
        aria-label="뒤로 가기"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <h1 className="text-base font-semibold">결제하기</h1>

      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-white ${
          isWarning ? 'bg-destructive' : 'bg-primary'
        }`}
        aria-live={isWarning ? 'assertive' : 'polite'}
        aria-label={`남은시간 ${minutes}분 ${seconds}초`}
      >
        <span className="text-xs">남은시간</span>
        <span className="font-semibold" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {timerText}
        </span>
      </div>
    </header>
  );
}
