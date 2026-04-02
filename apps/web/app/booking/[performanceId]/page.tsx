'use client';

import { use } from 'react';
import { BookingPage } from '@/components/booking/booking-page';

export default function BookingRoute({
  params,
}: {
  params: Promise<{ performanceId: string }>;
}) {
  const { performanceId } = use(params);
  return <BookingPage performanceId={performanceId} />;
}
