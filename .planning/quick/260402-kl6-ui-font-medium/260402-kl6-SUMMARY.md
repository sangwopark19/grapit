---
phase: quick
plan: 260402-kl6
subsystem: frontend-booking
tags: [ui, font-weight, loading-state, checkmark, design-token]
dependency_graph:
  requires: [03-02, 03-03, 03-04]
  provides: [booking-ui-polish]
  affects: [seat-map-viewer, seat-selection-panel, seat-selection-sheet, showtime-chips, date-picker, booking-page, timer-expired-modal, countdown-timer]
tech_stack:
  added: []
  patterns: [svg-text-injection, conditional-loading-ui, design-token-usage]
key_files:
  created: []
  modified:
    - apps/web/components/booking/seat-map-viewer.tsx
    - apps/web/components/booking/seat-selection-panel.tsx
    - apps/web/components/booking/seat-selection-sheet.tsx
    - apps/web/components/booking/showtime-chips.tsx
    - apps/web/components/booking/date-picker.tsx
    - apps/web/components/booking/booking-page.tsx
    - apps/web/components/booking/timer-expired-modal.tsx
    - apps/web/components/booking/countdown-timer.tsx
decisions: []
metrics:
  duration: 2min
  completed: 2026-04-02
---

# Quick Task 260402-kl6: UI Font-Medium Removal and Booking Polish Summary

5 UI review fixes applied: selected seat checkmark SVG overlay, button loading spinners, font-medium to font-normal replacement across booking components, timer modal width correction, countdown timer destructive design token

## What Was Done

### Task 1: Selected seat checkmark + button loading states (c5b88a8)

**Fix 1 -- Checkmark overlay on selected seats:**
- In `seat-map-viewer.tsx` processedSvg useMemo, after applying selected seat styles (fill/stroke/stroke-width), a white checkmark `<text>` SVG element is injected as a sibling after each selected seat element
- Geometry detection reads `x/y/width/height` for `<rect>` or `cx/cy` for `<circle>` to compute center position
- Checkmark uses `text-anchor="middle"` and `dominant-baseline="central"` for precise centering, `pointer-events="none"` to avoid click interference

**Fix 2 -- Button loading states:**
- Added `Loader2` import from lucide-react to both `seat-selection-panel.tsx` and `seat-selection-sheet.tsx`
- Panel button conditionally renders `<Loader2 className="mr-2 size-4 animate-spin" />` with text when `isLoading` is true
- Sheet expanded and collapsed buttons both show spinner + text during loading

### Task 2: font-medium removal + timer modal + countdown token (e798fdc)

**Fix 3 -- font-medium replacement (5 locations):**
- `showtime-chips.tsx:57` -- chip button className
- `seat-selection-sheet.tsx:158` -- collapsed summary span
- `date-picker.tsx:65` -- weekday classNames
- `booking-page.tsx:372` -- "date selection" h2
- `booking-page.tsx:385` -- "showtime selection" h2

**Fix 4 -- Timer expired modal:**
- Removed `size="sm"` from `AlertDialogContent` in `timer-expired-modal.tsx`, restoring default `sm:max-w-lg` width so the single "start over" button renders full-width

**Fix 5 -- Countdown timer design token:**
- Replaced hardcoded `bg-[#C62828]` with `bg-destructive` in `countdown-timer.tsx` warning state

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `grep -rn "font-medium" apps/web/components/booking/` -- PASS (no results)
2. `grep -n "bg-[#C62828]" apps/web/components/booking/countdown-timer.tsx` -- PASS (no results)
3. `grep -n 'size="sm"' apps/web/components/booking/timer-expired-modal.tsx` -- PASS (no results)
4. Loader2 import and usage confirmed in both seat-selection-panel.tsx and seat-selection-sheet.tsx
5. TypeScript compilation -- no new errors introduced (pre-existing errors in test files and admin module are unrelated)

## Known Stubs

None.

## Self-Check: PASSED
