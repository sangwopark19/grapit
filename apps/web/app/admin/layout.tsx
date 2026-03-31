'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/use-auth-store';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) {
      router.replace('/');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized || !user || user.role !== 'admin') {
    return null;
  }

  function handleLogout() {
    clearAuth();
    router.replace('/auth');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-white px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="메뉴 열기">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] p-0">
                <SheetTitle className="sr-only">관리자 메뉴</SheetTitle>
                <AdminSidebar />
              </SheetContent>
            </Sheet>
          </div>
          <span className="text-lg font-semibold lg:hidden">Grapit Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 bg-[#F5F5F7] p-8">{children}</main>
      </div>
    </div>
  );
}
