'use client';

import { cn } from '@/lib/cn';

type SortValue = 'latest' | 'popular';

interface SortToggleProps {
  value: SortValue;
  onChange: (v: SortValue) => void;
}

const OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
];

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="정렬 기준"
      className="flex items-center gap-1"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-semibold transition-colors duration-150',
            value === opt.value
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
