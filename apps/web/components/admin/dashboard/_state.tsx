'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

type Mode = 'loading' | 'empty' | 'error';

interface ChartPanelStateProps {
  mode: Mode;
  heightClass?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
}

/**
 * 3-mode 공통 상태 UI. loading/empty/error를 서로 다른 copy로 명시적으로 구분한다.
 * review MEDIUM 7: error가 empty로 흡수되지 않도록 mode를 prop으로 명시 요구.
 */
export function ChartPanelState({
  mode,
  heightClass = 'h-[280px]',
  onRetry,
  emptyTitle = '표시할 데이터가 없습니다',
  emptyBody = '해당 기간 동안 데이터가 없습니다',
}: ChartPanelStateProps) {
  if (mode === 'loading') {
    return <Skeleton className={`${heightClass} w-full`} />;
  }
  if (mode === 'error') {
    return (
      <div className={`flex ${heightClass} items-center justify-center`}>
        <div className="text-center">
          <p className="text-sm text-gray-900">대시보드를 불러오지 못했습니다</p>
          <p className="mt-1 text-xs text-gray-600">잠시 후 다시 시도해주세요</p>
          {onRetry ? (
            <Button onClick={onRetry} variant="outline" className="mt-3">
              다시 시도
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  // empty
  return (
    <div className={`flex ${heightClass} items-center justify-center`}>
      <div className="text-center">
        <p className="text-sm text-gray-900">{emptyTitle}</p>
        <p className="mt-1 text-xs text-gray-600">{emptyBody}</p>
      </div>
    </div>
  );
}

interface SectionErrorProps {
  onRetry?: () => void;
}

/**
 * KPI row 등 non-chart 섹션에서 사용하는 에러 blocker.
 */
export function SectionError({ onRetry }: SectionErrorProps) {
  return (
    <div className="col-span-full rounded-lg bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-900">대시보드를 불러오지 못했습니다</p>
      <p className="mt-1 text-xs text-gray-600">
        잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의하세요.
      </p>
      {onRetry ? (
        <Button onClick={onRetry} variant="outline" className="mt-3">
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
