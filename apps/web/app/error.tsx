'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api-client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-heading font-semibold text-gray-900">
        문제가 발생했습니다
      </h2>
      <p className="text-base text-gray-500">
        일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      {error instanceof ApiClientError && (
        <p className="text-caption text-gray-500">
          오류 코드: ERR-{error.statusCode}
        </p>
      )}
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
