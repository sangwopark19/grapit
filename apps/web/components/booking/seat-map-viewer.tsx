'use client';

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Loader2, RefreshCw } from 'lucide-react';
import type { SeatMapConfig, SeatState } from '@grapit/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SeatMapControls } from './seat-map-controls';

interface SeatMapViewerProps {
  svgUrl: string;
  seatConfig: SeatMapConfig;
  seatStates: Map<string, SeatState>;
  selectedSeatIds: Set<string>;
  onSeatClick: (seatId: string) => void;
  maxSelect: number;
}

const LOCKED_COLOR = '#D1D5DB';
const SELECTED_STROKE = '#1A1A2E';

export function SeatMapViewer({
  svgUrl,
  seatConfig,
  seatStates,
  selectedSeatIds,
  onSeatClick,
}: SeatMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [rawSvg, setRawSvg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build tier color map from seatConfig
  const tierColorMap = useMemo(() => {
    const map = new Map<string, { tierName: string; color: string }>();
    for (const tier of seatConfig.tiers) {
      for (const seatId of tier.seatIds) {
        map.set(seatId, { tierName: tier.tierName, color: tier.color });
      }
    }
    return map;
  }, [seatConfig]);

  // Fetch raw SVG
  useEffect(() => {
    if (!svgUrl) return;
    setIsLoading(true);
    setError(null);

    fetch(svgUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch SVG');
        return res.text();
      })
      .then((text) => {
        setRawSvg(text);
        setIsLoading(false);
      })
      .catch(() => {
        setError('좌석 배치도를 불러오지 못했습니다. 새로고침해주세요.');
        setIsLoading(false);
      });
  }, [svgUrl]);

  // Pre-process SVG string with colors baked in — survives re-renders
  const processedSvg = useMemo(() => {
    if (!rawSvg) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
    const seats = doc.querySelectorAll('[data-seat-id]');

    seats.forEach((el) => {
      const seatId = el.getAttribute('data-seat-id');
      if (!seatId) return;

      const tierInfo = tierColorMap.get(seatId);
      const state = seatStates.get(seatId) ?? 'available';
      const isSelected = selectedSeatIds.has(seatId);

      if (isSelected && tierInfo) {
        el.setAttribute('fill', tierInfo.color);
        el.setAttribute('stroke', SELECTED_STROKE);
        el.setAttribute('stroke-width', '3');
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');

        // Inject white checkmark centered on seat
        const svgNs = 'http://www.w3.org/2000/svg';
        const checkEl = doc.createElementNS(svgNs, 'text');
        let cx: number | null = null;
        let cy: number | null = null;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'rect') {
          const rx = parseFloat(el.getAttribute('x') ?? '0');
          const ry = parseFloat(el.getAttribute('y') ?? '0');
          const rw = parseFloat(el.getAttribute('width') ?? '0');
          const rh = parseFloat(el.getAttribute('height') ?? '0');
          cx = rx + rw / 2;
          cy = ry + rh / 2;
        } else if (tagName === 'circle') {
          cx = parseFloat(el.getAttribute('cx') ?? '0');
          cy = parseFloat(el.getAttribute('cy') ?? '0');
        }

        if (cx !== null && cy !== null) {
          checkEl.setAttribute('x', String(cx));
          checkEl.setAttribute('y', String(cy));
          checkEl.setAttribute('text-anchor', 'middle');
          checkEl.setAttribute('dominant-baseline', 'central');
          checkEl.setAttribute('fill', 'white');
          checkEl.setAttribute('font-size', '12');
          checkEl.setAttribute('font-weight', 'bold');
          checkEl.setAttribute('pointer-events', 'none');
          checkEl.textContent = '\u2713';
          el.parentNode?.insertBefore(checkEl, el.nextSibling);
        }
      } else if (state === 'locked' || state === 'sold') {
        el.setAttribute('fill', LOCKED_COLOR);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
      } else if (tierInfo) {
        el.setAttribute('fill', tierInfo.color);
        el.removeAttribute('stroke');
        el.setAttribute('stroke-width', '0');
        el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
      }
    });

    return doc.documentElement.outerHTML;
  }, [rawSvg, seatStates, selectedSeatIds, tierColorMap]);

  // Event delegation for seat clicks
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest<SVGElement>(
        '[data-seat-id]',
      );
      if (!target) return;

      const seatId = target.getAttribute('data-seat-id');
      if (!seatId) return;

      const state = seatStates.get(seatId) ?? 'available';
      if (state === 'sold') return;
      onSeatClick(seatId);
    },
    [seatStates, selectedSeatIds, onSeatClick],
  );

  // Hover tooltip — uses refs only, no state changes, no re-renders
  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest<SVGElement>(
        '[data-seat-id]',
      );
      if (!target) {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        return;
      }

      const seatId = target.getAttribute('data-seat-id');
      if (!seatId) return;

      const state = seatStates.get(seatId) ?? 'available';
      if (state !== 'available' && !selectedSeatIds.has(seatId)) {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        return;
      }

      const tierInfo = tierColorMap.get(seatId);
      if (!tierInfo) return;

      const parts = seatId.split('-');
      const row = parts[0] ?? seatId;
      const number = parts[1] ?? '';

      const rect = target.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect && tooltipRef.current) {
        const x = rect.left - containerRect.left + rect.width / 2;
        const y = rect.top - containerRect.top - 8;
        tooltipRef.current.textContent = `${tierInfo.tierName} ${row}${number ? `열 ${number}번` : ''}`;
        tooltipRef.current.style.left = `${x}px`;
        tooltipRef.current.style.top = `${y}px`;
        tooltipRef.current.style.display = 'block';

        if (state === 'available' && !selectedSeatIds.has(seatId)) {
          target.style.filter = 'brightness(1.15)';
          target.setAttribute('stroke', tierInfo.color);
          target.setAttribute('stroke-width', '2');
        }
      }
    },
    [seatStates, selectedSeatIds, tierColorMap],
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest<SVGElement>(
        '[data-seat-id]',
      );
      if (!target) return;

      if (tooltipRef.current) tooltipRef.current.style.display = 'none';

      const seatId = target.getAttribute('data-seat-id');
      if (!seatId) return;

      const isSelected = selectedSeatIds.has(seatId);
      if (isSelected) return;

      target.style.filter = '';
      const state = seatStates.get(seatId) ?? 'available';
      if (state === 'available') {
        target.removeAttribute('stroke');
        target.setAttribute('stroke-width', '0');
      }
    },
    [seatStates, selectedSeatIds, tierColorMap],
  );

  if (error) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg bg-gray-50 p-8 lg:min-h-[500px]">
        <p className="text-sm text-gray-600">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 size-4" />
          새로고침
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative flex min-h-[300px] items-center justify-center rounded-lg bg-gray-50 lg:min-h-[500px]">
        <Skeleton className="absolute inset-0 rounded-lg" />
        <Loader2 className="relative z-10 size-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!processedSvg) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg bg-gray-50 lg:min-h-[500px]">
        <p className="text-sm text-gray-500">
          좌석 배치도가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg bg-gray-50">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
      >
        <SeatMapControls />
        <TransformComponent
          wrapperClass="w-full min-h-[300px] lg:min-h-[500px]"
          contentClass="w-full"
        >
          <div
            ref={containerRef}
            role="grid"
            aria-label="좌석 배치도"
            onClick={handleClick}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            dangerouslySetInnerHTML={{ __html: processedSvg }}
          />
        </TransformComponent>
      </TransformWrapper>

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-50 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white"
        style={{ display: 'none', transform: 'translate(-50%, -100%)' }}
      />
    </div>
  );
}
