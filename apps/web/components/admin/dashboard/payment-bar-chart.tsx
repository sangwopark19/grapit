'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DashboardPaymentDto } from '@grabit/shared';

const chartConfig: ChartConfig = {
  count: { label: '건수', color: 'var(--chart-1)' },
};

interface Props {
  data: DashboardPaymentDto;
}

export function PaymentBarChart({ data }: Props) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return (
    <>
      <span className="sr-only">
        {`결제수단 분포: ${data.length}개 결제수단, 총 ${total.toLocaleString()}건`}
      </span>
      <ChartContainer
        config={chartConfig}
        className="h-[280px] w-full motion-reduce:[&_*]:!transition-none"
      >
        <BarChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="method"
            tickLine={false}
            axisLine={false}
            className="text-xs"
          />
          <YAxis tickLine={false} axisLine={false} className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent nameKey="method" />} />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </>
  );
}
