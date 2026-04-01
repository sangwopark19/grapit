'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CountdownResult {
  minutes: number;
  seconds: number;
  isWarning: boolean;
  isActive: boolean;
}

export function useCountdown(
  expiresAt: number | null,
  onExpire: () => void,
): CountdownResult {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const calculateRemaining = useCallback(() => {
    if (expiresAt === null) return 0;
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(() => calculateRemaining());

  useEffect(() => {
    if (expiresAt === null) {
      setRemaining(0);
      return;
    }

    // Set initial value
    setRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const newRemaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setRemaining(newRemaining);

      if (newRemaining <= 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [expiresAt, calculateRemaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isWarning = remaining > 0 && remaining <= 180;
  const isActive = expiresAt !== null && remaining > 0;

  return { minutes, seconds, isWarning, isActive };
}
