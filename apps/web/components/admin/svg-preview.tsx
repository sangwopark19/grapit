'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SeatMapConfig } from '@grapit/shared';
import { usePresignedUpload, useSaveSeatMap } from '@/hooks/use-admin';
import { TierEditor } from '@/components/admin/tier-editor';
import { Button } from '@/components/ui/button';

interface SvgPreviewProps {
  performanceId: string;
  currentSvgUrl?: string;
  currentConfig?: SeatMapConfig;
}

export function SvgPreview({
  performanceId,
  currentSvgUrl,
  currentConfig,
}: SvgPreviewProps) {
  const [svgUrl, setSvgUrl] = useState<string | null>(currentSvgUrl ?? null);
  const [tiers, setTiers] = useState<SeatMapConfig['tiers']>(
    currentConfig?.tiers ?? [],
  );
  const [totalSeats, setTotalSeats] = useState(0);

  const presignedUpload = usePresignedUpload();
  const saveSeatMap = useSaveSeatMap(performanceId);

  const handleSvgUpload = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('SVG 파일은 10MB 이하여야 합니다.');
        return;
      }

      // Phase 12 reviews revision (D-06/D-07 unified contract + HIGH #2 + LOW #7):
      // 1) try/catch로 file.text() + DOMParser를 감싸 parse 실패를 graceful 처리
      // 2) doc.querySelector('[data-stage]')로 root + descendant 모두 탐색 (viewer와 동일 계약)
      // 3) data-stage 값 enum 검증 (top|right|bottom|left)
      // DOMParser 사용 (정규식 금지, RESEARCH §Pitfall 8).
      const VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const;
      let text: string;
      let doc: Document;
      try {
        text = await file.text();
        const parser = new DOMParser();
        doc = parser.parseFromString(text, 'image/svg+xml');
        // parsererror tagName 가드: invalid XML은 documentElement.tagName === 'parsererror'
        if (
          doc.documentElement.tagName === 'parsererror' ||
          doc.querySelector('parsererror')
        ) {
          toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.');
          return;
        }
      } catch {
        toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.');
        return;
      }

      const hasStageText = Array.from(doc.querySelectorAll('text')).some(
        (t) => t.textContent?.trim() === 'STAGE',
      );
      // UNIFIED CONTRACT (reviews revision D-06/D-07): root + descendant 모두 탐색
      const stageEl = doc.querySelector('[data-stage]');
      const hasDataStage = stageEl !== null;

      if (!hasStageText && !hasDataStage) {
        toast.error(
          '스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.',
        );
        return;
      }

      // reviews revision HIGH #2: data-stage 발견 시 enum 검증
      if (hasDataStage) {
        const value = stageEl!.getAttribute('data-stage') ?? '';
        if (!VALID_STAGES.includes(value as (typeof VALID_STAGES)[number])) {
          toast.error(
            'data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.',
          );
          return;
        }
      }

      try {
        const { uploadUrl, publicUrl } =
          await presignedUpload.mutateAsync({
            folder: 'seat-maps',
            contentType: 'image/svg+xml',
            extension: 'svg',
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'image/svg+xml' },
        });
        setSvgUrl(publicUrl);

        // Count seats in SVG (text 변수는 위 검증에서 이미 읽음)
        const seatCount = (text.match(/data-seat-id/g) || []).length;
        setTotalSeats(seatCount);

        toast.success('좌석맵 SVG가 업로드되었습니다.');
      } catch {
        toast.error('SVG 업로드에 실패했습니다.');
      }
    },
    [presignedUpload],
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleSvgUpload(file);
    }
  }

  async function handleSave() {
    if (!svgUrl) {
      toast.error('SVG 파일을 먼저 업로드해주세요.');
      return;
    }
    try {
      await saveSeatMap.mutateAsync({
        svgUrl,
        seatConfig: { tiers },
        totalSeats,
      });
      toast.success('좌석맵이 저장되었습니다.');
    } catch {
      toast.error('좌석맵 저장에 실패했습니다.');
    }
  }

  return (
    <div className="space-y-4">
      {/* SVG Upload / Preview */}
      {svgUrl ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-white p-4">
            <object
              data={svgUrl}
              type="image/svg+xml"
              className="mx-auto max-h-[400px] w-full"
              aria-label="좌석맵 미리보기"
            >
              SVG를 표시할 수 없습니다.
            </object>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('svg-input')?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            다른 SVG 업로드
          </Button>
          {totalSeats > 0 && (
            <p className="text-sm text-gray-500">
              감지된 좌석 수: {totalSeats}개
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-primary hover:bg-primary/5"
          onClick={() => document.getElementById('svg-input')?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500">SVG 좌석맵 업로드</p>
          <p className="mt-1 text-xs text-gray-400">.svg 파일 (10MB 이하)</p>
        </div>
      )}
      <input
        id="svg-input"
        type="file"
        accept=".svg"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Tier Editor */}
      {svgUrl && (
        <>
          <TierEditor tiers={tiers} onChange={setTiers} />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveSeatMap.isPending}
            >
              {saveSeatMap.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '좌석맵 저장'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
