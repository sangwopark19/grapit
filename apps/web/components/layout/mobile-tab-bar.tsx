'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: '/', label: '홈', icon: Home },
  { href: '/genre/musical', label: '카테고리', icon: LayoutGrid },
  { href: '/search', label: '검색', icon: Search },
  { href: '/mypage', label: '마이페이지', icon: User },
];

function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  // For category tab, match any /genre/* path
  if (href === '/genre/musical') {
    return pathname.startsWith('/genre');
  }
  return pathname.startsWith(href);
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] border-t border-border bg-white pb-safe md:hidden"
    >
      {TABS.map((tab) => {
        const active = isTabActive(tab.href, pathname);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5',
              active ? 'text-primary' : 'text-gray-400',
            )}
          >
            <Icon className="h-5 w-5" />
            <span
              className={cn(
                'text-[14px] leading-tight',
                active
                  ? 'font-semibold text-primary'
                  : 'font-normal text-gray-500',
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
