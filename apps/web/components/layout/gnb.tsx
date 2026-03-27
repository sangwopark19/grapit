'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, Search, ChevronDown, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { MobileMenu } from './mobile-menu';

const GENRE_TABS = ['뮤지컬', '콘서트', '연극', '전시', '클래식'] as const;

interface GNBProps {
  isAuthenticated?: boolean;
  userName?: string;
}

export function GNB({ isAuthenticated = false, userName }: GNBProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-[#E5E5E5] bg-white">
        <nav className="mx-auto flex h-full max-w-[1200px] items-center px-6">
          {/* Logo */}
          <Link
            href="/"
            className="mr-8 text-xl font-semibold text-primary"
          >
            Grapit
          </Link>

          {/* Genre tabs - hidden on mobile */}
          <div className="hidden items-center gap-1 md:flex">
            {GENRE_TABS.map((tab) => (
              <button
                key={tab}
                disabled
                title="곧 오픈 예정입니다"
                className="cursor-not-allowed px-3 py-2 text-base text-gray-900 opacity-40"
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search bar - hidden on mobile */}
          <div className="mr-4 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                disabled
                placeholder="공연명, 아티스트를 검색하세요"
                className="h-10 w-64 cursor-not-allowed rounded-lg bg-gray-100 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Auth area */}
          {isAuthenticated ? (
            <div ref={profileRef} className="relative hidden md:block">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                  {userInitials}
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-gray-500 transition-transform',
                    isProfileOpen && 'rotate-180'
                  )}
                />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <Link
                    href="/mypage"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-900 hover:bg-gray-100"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    마이페이지
                  </Link>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                    onClick={() => setIsProfileOpen(false)}
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              asChild
              className="hidden text-base text-gray-900 hover:text-primary md:inline-flex"
            >
              <Link href="/auth">로그인</Link>
            </Button>
          )}

          {/* Mobile: auth button + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {!isAuthenticated && (
              <Button variant="ghost" size="sm" asChild className="text-sm">
                <Link href="/auth">로그인</Link>
              </Button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-900 hover:bg-gray-100"
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isAuthenticated={isAuthenticated}
        userName={userName}
      />
    </>
  );
}
