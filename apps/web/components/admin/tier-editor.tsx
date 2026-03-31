'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { SeatMapConfig } from '@grapit/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface TierEditorProps {
  tiers: SeatMapConfig['tiers'];
  onChange: (tiers: SeatMapConfig['tiers']) => void;
}

export function TierEditor({ tiers, onChange }: TierEditorProps) {
  function updateTier(
    index: number,
    field: keyof SeatMapConfig['tiers'][number],
    value: string | string[],
  ) {
    const updated = [...tiers];
    if (field === 'seatIds') {
      updated[index] = { ...updated[index], seatIds: value as string[] };
    } else {
      updated[index] = { ...updated[index], [field]: value as string };
    }
    onChange(updated);
  }

  function addTier() {
    onChange([
      ...tiers,
      { tierName: '', color: '#6C3CE0', seatIds: [] },
    ]);
  }

  function removeTier(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">등급별 좌석 설정</h3>
      {tiers.length === 0 ? (
        <p className="text-sm text-gray-500">
          등급을 추가하여 좌석을 배정해주세요.
        </p>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={tier.tierName}
                  onChange={(e) =>
                    updateTier(index, 'tierName', e.target.value)
                  }
                  placeholder="등급명 (예: VIP)"
                  className="flex-1"
                />
                <input
                  type="color"
                  value={tier.color}
                  onChange={(e) =>
                    updateTier(index, 'color', e.target.value)
                  }
                  className="h-10 w-10 cursor-pointer rounded border"
                  aria-label={`${tier.tierName || '등급'} 색상`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTier(index)}
                  aria-label="등급 삭제"
                >
                  <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                </Button>
              </div>
              <Textarea
                value={tier.seatIds.join(', ')}
                onChange={(e) =>
                  updateTier(
                    index,
                    'seatIds',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="좌석 ID (콤마로 구분, e.g. A1, A2, A3)"
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" onClick={addTier}>
        <Plus className="mr-2 h-4 w-4" />
        등급 추가
      </Button>
    </div>
  );
}
