'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { PerformanceStatus } from '@grapit/shared';
import { STATUS_LABELS } from '@grapit/shared';

const STATUS_STYLES: Record<PerformanceStatus, string> = {
  selling: 'bg-[#22C55E] text-white hover:bg-[#22C55E]',
  closing_soon: 'bg-[#FFB41B] text-[#1A1A2E] hover:bg-[#FFB41B]',
  ended: 'bg-[#A1A1AA] text-white hover:bg-[#A1A1AA]',
  upcoming: 'bg-[#6C3CE0] text-white hover:bg-[#6C3CE0]',
};

interface StatusBadgeProps {
  status: PerformanceStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        'border-transparent text-xs',
        STATUS_STYLES[status],
        className,
      )}
      aria-label={`상태: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
