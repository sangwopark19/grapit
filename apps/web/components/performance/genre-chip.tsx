'use client';

import { cn } from '@/lib/cn';

interface GenreChipProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
}

export function GenreChip({ label, isActive, onClick }: GenreChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-primary text-white'
          : 'bg-[#F5F5F7] text-gray-900 hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  );
}
