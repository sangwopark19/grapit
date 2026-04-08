'use client';

import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
    }
    function handleOnline() {
      setIsOffline(false);
    }

    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[60] flex h-[44px] items-center justify-center gap-3 bg-error text-white"
    >
      <span className="text-caption font-semibold">
        인터넷 연결을 확인해주세요
      </span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md border border-white bg-transparent px-3 h-8 text-caption text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
