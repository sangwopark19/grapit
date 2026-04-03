'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Theater, Image, Ticket } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  {
    label: '공연 관리',
    href: '/admin/performances',
    icon: Theater,
  },
  {
    label: '배너 관리',
    href: '/admin/banners',
    icon: Image,
  },
  {
    label: '예매 관리',
    href: '/admin/bookings',
    icon: Ticket,
  },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[240px] shrink-0 border-r bg-white lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin/performances" className="text-lg font-semibold">
          Grapit Admin
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-4" aria-label="관리자 네비게이션">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'border-l-[3px] border-primary bg-primary/5 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
