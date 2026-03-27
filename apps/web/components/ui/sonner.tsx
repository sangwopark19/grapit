'use client';

import { Toaster as SonnerToaster } from 'sonner';

function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      toastOptions={{
        duration: 3000,
        style: {
          fontFamily: 'var(--font-pretendard), system-ui, sans-serif',
        },
        classNames: {
          success: 'bg-success-surface text-success border-success/20',
          error: 'bg-error-surface text-error border-error/20',
        },
      }}
    />
  );
}

export { Toaster };
