'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AuthError({
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
        인증 중 오류가 발생했습니다
      </h2>
      <p className="text-base text-gray-500">
        잠시 후 다시 시도하거나, 홈으로 돌아가주세요.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          다시 시도
        </Button>
        <Button asChild>
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    </main>
  );
}
