import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeatMapViewer } from '../seat-map-viewer';
import type { SeatMapConfig, SeatState } from '@grapit/shared';

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-wrapper">{children}</div>
  ),
  TransformComponent: ({
    children,
  }: {
    children: React.ReactNode;
    wrapperClass?: string;
    contentClass?: string;
  }) => <div data-testid="transform-component">{children}</div>,
}));

vi.mock('../seat-map-controls', () => ({
  SeatMapControls: () => <div data-testid="seat-map-controls" />,
}));

const SVG_CONTENT = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <circle data-seat-id="A-1" cx="50" cy="50" r="15" />
  <circle data-seat-id="A-2" cx="100" cy="50" r="15" />
  <circle data-seat-id="B-1" cx="50" cy="100" r="15" />
</svg>
`;

const mockSeatConfig: SeatMapConfig = {
  tiers: [
    { tierName: 'VIP', color: '#6C3CE0', seatIds: ['A-1', 'A-2'] },
    { tierName: 'R', color: '#3B82F6', seatIds: ['B-1'] },
  ],
};

describe('SeatMapViewer', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SVG_CONTENT),
    });
  });

  it('renders available seats with tier color fill', async () => {
    const seatStates = new Map<string, SeatState>([
      ['A-1', 'available'],
      ['A-2', 'available'],
      ['B-1', 'available'],
    ]);

    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]');
      expect(seatA1).toBeTruthy();
      expect(seatA1?.getAttribute('fill')).toBe('#6C3CE0');
    });

    const seatB1 = container.querySelector('[data-seat-id="B-1"]');
    expect(seatB1?.getAttribute('fill')).toBe('#3B82F6');
  });

  it('renders locked/sold seats with gray fill and reduced opacity', async () => {
    const seatStates = new Map<string, SeatState>([
      ['A-1', 'locked'],
      ['A-2', 'sold'],
      ['B-1', 'available'],
    ]);

    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      const seatA1 = container.querySelector(
        '[data-seat-id="A-1"]',
      ) as SVGElement;
      expect(seatA1?.getAttribute('fill')).toBe('#D1D5DB');
      expect(seatA1?.style.opacity).toBe('0.6');
    });

    const seatA2 = container.querySelector(
      '[data-seat-id="A-2"]',
    ) as SVGElement;
    expect(seatA2?.getAttribute('fill')).toBe('#D1D5DB');
    expect(seatA2?.style.opacity).toBe('0.6');
  });

  it('calls onSeatClick when clicking an available seat', async () => {
    const onSeatClick = vi.fn();
    const seatStates = new Map<string, SeatState>([
      ['A-1', 'available'],
      ['A-2', 'locked'],
    ]);

    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set()}
        onSeatClick={onSeatClick}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-seat-id="A-1"]')).toBeTruthy();
    });

    const seatA1 = container.querySelector('[data-seat-id="A-1"]')!;
    fireEvent.click(seatA1);
    expect(onSeatClick).toHaveBeenCalledWith('A-1');
  });

  it('does NOT call onSeatClick when clicking a locked/sold seat', async () => {
    const onSeatClick = vi.fn();
    const seatStates = new Map<string, SeatState>([
      ['A-1', 'locked'],
    ]);

    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set()}
        onSeatClick={onSeatClick}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-seat-id="A-1"]')).toBeTruthy();
    });

    const seatA1 = container.querySelector('[data-seat-id="A-1"]')!;
    fireEvent.click(seatA1);
    expect(onSeatClick).not.toHaveBeenCalled();
  });

  it('renders selected seats with dark stroke', async () => {
    const seatStates = new Map<string, SeatState>([
      ['A-1', 'available'],
    ]);

    const { container } = render(
      <SeatMapViewer
        svgUrl="https://example.com/seats.svg"
        seatConfig={mockSeatConfig}
        seatStates={seatStates}
        selectedSeatIds={new Set(['A-1'])}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      const seatA1 = container.querySelector('[data-seat-id="A-1"]');
      expect(seatA1?.getAttribute('stroke')).toBe('#1A1A2E');
      expect(seatA1?.getAttribute('stroke-width')).toBe('3');
    });
  });

  it('shows error state when SVG fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });

    render(
      <SeatMapViewer
        svgUrl="https://example.com/bad.svg"
        seatConfig={mockSeatConfig}
        seatStates={new Map()}
        selectedSeatIds={new Set()}
        onSeatClick={() => {}}
        maxSelect={4}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          '좌석 배치도를 불러오지 못했습니다. 새로고침해주세요.',
        ),
      ).toBeDefined();
    });
  });
});
