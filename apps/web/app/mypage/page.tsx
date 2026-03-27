'use client';

import { useAuthStore } from '@/stores/use-auth-store';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ProfileForm } from '@/components/auth/profile-form';

export default function MyPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AuthGuard>
      <main className="flex flex-1 justify-center px-4 pt-12 pb-16">
        <div className="w-full max-w-[600px]">
          <h1 className="mb-8 text-[20px] font-semibold text-gray-900">마이페이지</h1>

          {user && <ProfileForm user={user} />}
        </div>
      </main>
    </AuthGuard>
  );
}
