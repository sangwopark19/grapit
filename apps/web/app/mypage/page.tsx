'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ProfileForm } from '@/components/auth/profile-form';
import { ReservationList } from '@/components/reservation/reservation-list';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMyReservations } from '@/hooks/use-reservations';

export default function MyPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') === 'reservations' ? 'reservations' : 'profile';

  const [filter, setFilter] = useState('all');
  const { data: reservations, isLoading, isFetching } = useMyReservations(
    activeTab === 'reservations' ? filter : undefined,
  );

  function handleTabChange(value: string) {
    if (value === 'reservations') {
      router.replace('/mypage?tab=reservations');
    } else {
      router.replace('/mypage');
    }
  }

  return (
    <AuthGuard>
      <main className="flex flex-1 justify-center px-4 pt-8 pb-16 md:pt-12">
        <div className="w-full max-w-[600px]">
          <h1 className="mb-6 text-heading font-semibold text-gray-900 md:mb-8">마이페이지</h1>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="profile">프로필</TabsTrigger>
              <TabsTrigger value="reservations">예매 내역</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              {user && <ProfileForm user={user} />}
            </TabsContent>

            <TabsContent value="reservations">
              <ReservationList
                reservations={reservations}
                isLoading={isLoading}
                isFetching={isFetching}
                filter={filter}
                onFilterChange={setFilter}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AuthGuard>
  );
}
