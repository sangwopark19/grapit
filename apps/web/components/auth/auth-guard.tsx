'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isInitialized, accessToken } = useAuthStore();

  useEffect(() => {
    if (isInitialized && !accessToken) {
      router.push('/auth');
    }
  }, [isInitialized, accessToken, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}
