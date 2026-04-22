'use client';

import { create } from 'zustand';
import type { UserProfile } from '@grabit/shared';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isInitialized: boolean;
  setAuth: (accessToken: string, user: UserProfile) => void;
  clearAuth: () => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isInitialized: false,
  setAuth: (accessToken, user) => set({ accessToken, user, isInitialized: true }),
  clearAuth: () => set({ accessToken: null, user: null }),
  setInitialized: () => set({ isInitialized: true }),
}));
