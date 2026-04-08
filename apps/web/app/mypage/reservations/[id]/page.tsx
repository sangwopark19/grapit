'use client';

import { use } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ReservationDetailView } from '@/components/reservation/reservation-detail';
import { useReservationDetail, useCancelReservation } from '@/hooks/use-reservations';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ReservationDetailPage({ params }: ReservationDetailPageProps) {
  const { id } = use(params);
  const { data: reservation, isLoading, isError, refetch } = useReservationDetail(id);
  const cancelMutation = useCancelReservation();

  async function handleCancel(reason: string) {
    try {
      await cancelMutation.mutateAsync({ id, reason });
      toast.success('예매가 취소되었습니다');
      refetch();
    } catch {
      toast.error('취소 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <AuthGuard>
      <main className="mx-auto max-w-[720px] px-4 py-6 md:px-6 md:py-8">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={`skeleton-${i}`} className="py-4">
                <CardContent className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-base font-semibold text-gray-900">
              예매 정보를 불러오지 못했습니다.
            </p>
            <Button className="mt-4" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {reservation && (
          <ReservationDetailView
            reservation={reservation}
            onCancel={handleCancel}
            isCancelling={cancelMutation.isPending}
          />
        )}
      </main>
    </AuthGuard>
  );
}
