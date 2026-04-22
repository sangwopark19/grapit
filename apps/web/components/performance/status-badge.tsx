'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { PerformanceStatus } from '@grabit/shared';
import { STATUS_LABELS } from '@grabit/shared';

const STATUS_STYLES: Record<PerformanceStatus, string> = {
  selling: 'bg-success text-white hover:bg-success',
  closing_soon: 'bg-warning text-foreground hover:bg-warning',
  ended: 'bg-gray-400 text-white hover:bg-gray-400',
  upcoming: 'bg-primary text-white hover:bg-primary',
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
