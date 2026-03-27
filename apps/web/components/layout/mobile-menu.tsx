'use client';

import * as React from 'react';
import Link from 'next/link';
import { X, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';

const GENRE_TABS = ['뮤지컬', '콘서트', '연극', '전시', '클래식'] as const;

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  userName?: string;
}

export function MobileMenu({
  isOpen,
  onClose,
  isAuthenticated = false,
  userName,
}: MobileMenuProps) {
  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-72 bg-white shadow-xl transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <span className="text-lg font-semibold text-primary">Grapit</span>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Auth section */}
        <div className="border-b border-gray-200 px-6 py-4">
          {isAuthenticated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                  {userName
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <span className="text-base font-medium text-gray-900">
                  {userName}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Link
                  href="/mypage"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
                >
                  <User className="h-4 w-4" />
                  마이페이지
                </Link>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/auth"
              onClick={onClose}
              className="block w-full rounded-lg bg-primary px-4 py-3 text-center text-base font-medium text-white"
            >
              로그인 / 회원가입
            </Link>
          )}
        </div>

        {/* Genre tabs */}
        <div className="px-6 py-4">
          <p className="mb-3 text-sm font-medium text-gray-500">카테고리</p>
          <div className="flex flex-col gap-1">
            {GENRE_TABS.map((tab) => (
              <button
                key={tab}
                disabled
                title="곧 오픈 예정입니다"
                className="cursor-not-allowed rounded-lg px-3 py-2 text-left text-base text-gray-900 opacity-40"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
