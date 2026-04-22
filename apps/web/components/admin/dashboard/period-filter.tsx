'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DashboardPeriod } from '@grabit/shared';

interface PeriodFilterProps {
  value: DashboardPeriod;
  onChange: (v: DashboardPeriod) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as DashboardPeriod);
      }}
      aria-label="기간 선택"
    >
      <ToggleGroupItem value="7d">7일</ToggleGroupItem>
      <ToggleGroupItem value="30d">30일</ToggleGroupItem>
      <ToggleGroupItem value="90d">90일</ToggleGroupItem>
    </ToggleGroup>
  );
}
