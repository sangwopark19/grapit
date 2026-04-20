'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { DashboardRevenueDto } from '@grapit/shared';

const chartConfig: ChartConfig = {
  revenue: { label: '매출', color: 'var(--chart-1)' },
};

interface Props {
  data: DashboardRevenueDto;
}

export function RevenueAreaChart({ data }: Props) {
  const total = data.reduce((acc, d) => acc + d.revenue, 0);
  const nonZero = data.filter((d) => d.revenue > 0).length;
  return (
    <>
      <span className="sr-only">
        {`매출 추이: ${data.length}개 구간, 매출 발생 ${nonZero}개, 합계 ${total.toLocaleString()}원`}
      </span>
      <ChartContainer
        config={chartConfig}
        className="h-[280px] w-full motion-reduce:[&_*]:!transition-none"
      >
        <AreaChart data={data} accessibilityLayer>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--chart-1)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--chart-1)"
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs"
          />
          <YAxis tickLine={false} axisLine={false} className="text-xs" />
          <ChartTooltip
            content={<ChartTooltipContent labelKey="bucket" nameKey="revenue" />}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            fill="url(#fillRevenue)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </>
  );
}
