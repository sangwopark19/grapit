'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h2 className="text-xl font-semibold text-gray-900">
          문제가 발생했습니다
        </h2>
        <p className="text-base text-gray-500">
          일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <Button onClick={reset}>다시 시도</Button>
      </body>
    </html>
  );
}
