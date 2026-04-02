'use client';

import { useControls } from 'react-zoom-pan-pinch';
import { Plus, Minus, Maximize2 } from 'lucide-react';

export function SeatMapControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => zoomIn()}
        aria-label="확대"
        className="flex size-10 items-center justify-center rounded-lg border bg-white shadow-sm hover:bg-gray-50"
      >
        <Plus className="size-5 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => zoomOut()}
        aria-label="축소"
        className="flex size-10 items-center justify-center rounded-lg border bg-white shadow-sm hover:bg-gray-50"
      >
        <Minus className="size-5 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        aria-label="전체 보기"
        className="flex size-10 items-center justify-center rounded-lg border bg-white shadow-sm hover:bg-gray-50"
      >
        <Maximize2 className="size-5 text-gray-700" />
      </button>
    </div>
  );
}
