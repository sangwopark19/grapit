'use client';

import { useEffect } from 'react';
import { initializeAuth } from '@/lib/auth';

export function AuthInitializer() {
  useEffect(() => {
    void initializeAuth();
  }, []);

  return null;
}
