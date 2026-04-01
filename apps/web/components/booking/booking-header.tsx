'use client';

import { ChevronLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingHeaderProps {
  performanceTitle: string;
  expiresAt: number | null;
  onBack: () => void;
}

export function BookingHeader({
  performanceTitle,
  expiresAt,
  onBack,
}: BookingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-white px-4 shadow-sm lg:h-14 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="뒤로가기"
      >
        <ChevronLeft className="size-5" />
      </Button>

      <h1 className="max-w-[200px] truncate text-lg font-semibold text-gray-900 lg:max-w-[400px]">
        {performanceTitle}
      </h1>

      <div className="w-9">
        {expiresAt !== null && (
          <div className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white">
            <Clock className="size-4" />
            <span className="font-mono">--:--</span>
          </div>
        )}
      </div>
    </header>
  );
}
