# Phase 03 — UI Review

**Audited:** 2026-04-02
**Baseline:** 03-UI-SPEC.md (approved 2026-04-01)
**Screenshots:** Not captured — Playwright browsers not installed (`npx playwright install` required). Audit conducted via code review only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All spec-required strings present and accurate |
| 2. Visuals | 3/4 | Selected seat checkmark overlay missing (D-09 gap) |
| 3. Color | 3/4 | Info toast uses hardcoded hex instead of CSS tokens; `font-medium` (500) appears despite 400/600-only spec |
| 4. Typography | 3/4 | `font-medium` (weight 500) used in 5 locations — not in spec's permitted 400/600 set |
| 5. Spacing | 4/4 | Consistent token-based spacing; arbitrary values confined to layout-specific dimensions |
| 6. Experience Design | 3/4 | "다음" button has no spinner during submission; keyboard seat navigation not implemented |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Selected seat checkmark overlay missing** — Users cannot visually distinguish "my selection" from plain available seats when zoomed out; spec D-09 requires a white checkmark (12px) overlaid on selected seats — add SVG `<text>` or `<path>` element injection inside `processedSvg` in `seat-map-viewer.tsx` when `isSelected` is true

2. **"다음" button shows no loading state during submission** — spec requires `spinner + "처리 중..."` while `isLoading` is true; currently the button just shows "다음" and is silently disabled — update `seat-selection-panel.tsx:95-99` and `seat-selection-sheet.tsx:146-154` to render `<Loader2 className="mr-2 size-4 animate-spin" />처리 중...` when `isLoading` is true

3. **`font-medium` (weight 500) used in 5 locations** — spec explicitly permits only 400 (regular) and 600 (semibold); `font-medium` appears in showtime chips, bottom sheet collapsed summary, date picker weekday labels, and section headings in `booking-page.tsx` — replace all with `font-normal` or `font-semibold` as context requires

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All copywriting contract strings verified present.

**Confirmed present:**
- CTA: `다음` (seat-selection-panel.tsx:98, seat-selection-sheet.tsx:151, :166)
- CTA disabled state: `좌석을 선택해주세요` (seat-selection-panel.tsx:98)
- Section labels: `날짜 선택` (booking-page.tsx:373), `회차 선택` (booking-page.tsx:386), `등급별 좌석 안내` (seat-legend.tsx:12), `선택 좌석` (seat-selection-panel.tsx:62)
- Panel total: `총 합계` (seat-selection-panel.tsx:81)
- Side panel max notice: `최대 4석까지 선택 가능합니다` (seat-selection-panel.tsx:75)
- Timer label: `남은시간` (countdown-timer.tsx:40, :64)
- Bottom sheet collapsed: `{n}석 선택 | {total}원` (seat-selection-sheet.tsx:159)

**Empty states confirmed:**
- `선택한 날짜에 예정된 회차가 없습니다` (showtime-chips.tsx:42)
- `좌석을 선택해주세요. 좌석맵에서 원하는 좌석을 탭하면 이곳에 표시됩니다.` (seat-selection-panel.tsx:65)
- `좌석 배치도가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.` (seat-map-viewer.tsx:226)

**Error states confirmed:**
- `이미 다른 사용자가 선택한 좌석입니다` (booking-page.tsx:190, :248)
- `최대 4석까지 선택할 수 있습니다. 다른 좌석을 먼저 해제해주세요.` (booking-page.tsx:206)
- `시간이 만료되었습니다` (timer-expired-modal.tsx:24)
- `선택하신 좌석의 점유 시간이 만료되었습니다. 처음부터 다시 좌석을 선택해주세요.` (timer-expired-modal.tsx:27)
- `처음으로` (timer-expired-modal.tsx:36)
- `실시간 연결이 끊어졌습니다. 재연결 중...` (use-socket.ts:43)
- `실시간 연결이 복구되었습니다` (use-socket.ts:29)
- `좌석 배치도를 불러오지 못했습니다. 새로고침해주세요.` (seat-map-viewer.tsx:63)
- `새로고침` button (seat-map-viewer.tsx:207)
- `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.` (booking-page.tsx:253)

**Minor note:** The Phase 4 placeholder toast `결제 기능은 준비 중입니다` (booking-page.tsx:293) is an intentional stub per plan — not a copywriting issue.

---

### Pillar 2: Visuals (3/4)

**Issue — Selected seat checkmark overlay not implemented (D-09 gap):**
- Spec D-09 states: "내가 선택한 좌석은 등급 색상 유지 + 두꺼운 테두리(stroke) + 체크마크로 강조"
- UI-SPEC.md Seat State Colors table: "My selection — Checkmark overlay icon (white, centered, 12px)"
- `seat-map-viewer.tsx:84-88`: `isSelected` branch sets tier color + `#1A1A2E` stroke 3px but does NOT inject a checkmark overlay
- This means a selected seat and an available seat look identical except for a dark border, which may not provide sufficient differentiation at small zoom levels

**Passing:**
- Clear focal point: seat map dominates the left column with side panel providing strong anchoring on desktop
- Icon-only buttons all have `aria-label`: back button (`뒤로가기`), zoom controls (`확대`, `축소`, `전체 보기`), seat remove (`좌석 선택 해제`)
- Visual hierarchy is solid: bold performance title in header, `text-xl font-semibold` for "선택 좌석" panel heading, `text-base font-semibold` for prices
- Loading states use Skeleton + Loader2 spinner with visual layering — meets spec
- Timer expired modal centers content correctly; `size="sm"` prop is still present (timer-expired-modal.tsx:20) but UAT Plan 4 was intended to remove it — the AlertDialogFooter at line 94 of alert-dialog.tsx shows `group-data-[size=sm]/alert-dialog-content:grid-cols-2` which applies a 2-column grid when `size="sm"` is set. Since the modal only has 1 `AlertDialogAction`, this creates a visual gap. Plan 4 documentation says to remove `size="sm"` but the implementation still has it.

---

### Pillar 3: Color (3/4)

**Accent (#6C3CE0 / bg-primary) usage — 7 unique elements:**
1. `bg-primary` — showtime chip active state (showtime-chips.tsx:59) ✓ spec reserved
2. `ring-primary` — calendar date focus ring (date-picker.tsx:69) ✓ spec reserved
3. `bg-primary` / `!bg-primary` — calendar selected date (date-picker.tsx:71) ✓ spec reserved
4. `text-primary` — calendar today indicator (date-picker.tsx:72) ✓ spec reserved
5. `bg-primary` — countdown timer normal state (countdown-timer.tsx:53) ✓ spec reserved
6. `border-primary` — side panel total price border-left (seat-selection-panel.tsx:80) ✓ spec reserved
7. `bg-primary` — "다음" CTA button (uses shadcn Button default variant) ✓ spec reserved

All 7 are within spec-declared reserved elements. No accent overuse.

**Hardcoded hex values in production code (non-test files):**
- `booking-page.tsx:191, :249` — `style: { backgroundColor: '#F3EFFF', color: '#6C3CE0' }` for info toast
  - These are spec-defined Info semantic colors (Info surface #F3EFFF, Info text #6C3CE0)
  - Should use CSS tokens if available. Since sonner `toast.info` doesn't accept className for the bubble, inline style is the only option — acceptable as a pragmatic necessity for sonner integration, but worth noting
- `seat-map-viewer.tsx:20` — `LOCKED_COLOR = '#D1D5DB'` and `seat-map-viewer.tsx:21` — `SELECTED_STROKE = '#1A1A2E'`
  - These are SVG attribute assignments via DOM manipulation (not Tailwind) — CSS tokens cannot be applied here
  - Both values match the spec exactly (#D1D5DB = Gray-300, #1A1A2E = Gray-900). Acceptable.
- `countdown-timer.tsx:53` — `bg-[#C62828]` for warning state
  - Spec defines Destructive color as `#C62828`. A CSS token (`bg-destructive`) would be cleaner but the value is correct.

**Minor issue: `bg-[#C62828]` vs `bg-destructive`** — countdown-timer.tsx:53 could use `bg-destructive` if the destructive token is configured in globals.css. Minor consistency issue.

---

### Pillar 4: Typography (3/4)

**Font sizes used (5 unique):** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
- Within bounds: spec defines Display (28px/text-3xl not used), Heading (20px/text-xl), Body (16px/text-base), Caption (14px/text-sm), plus `text-xs` for the "남은시간" label inside the timer pill — acceptable

**Font weights used: `font-normal`, `font-medium`, `font-semibold`**
- `font-medium` (weight 500) is NOT in the permitted set (spec: 400 regular, 600 semibold only)
- 5 occurrences in production components:
  - `showtime-chips.tsx:57` — chip text uses `font-medium`
  - `seat-selection-sheet.tsx:158` — collapsed summary `font-medium`
  - `date-picker.tsx:65` — weekday labels `font-medium`
  - `booking-page.tsx:372` — "날짜 선택" section label `font-medium`
  - `booking-page.tsx:385` — "회차 선택" section label `font-medium`
- These are small-text (text-sm) labels where `font-medium` provides mild emphasis. Replace with `font-normal` (they are Caption-role text per spec).

**Passing:**
- Countdown timer monospace: `font-mono text-base font-semibold` (countdown-timer.tsx:65) — matches spec exactly
- Performance title in header: `text-lg font-semibold` — acceptable for header context
- "선택 좌석" panel heading: `text-xl font-semibold` — matches spec Heading role (20px/600)
- Price values: `font-semibold` throughout seat-row.tsx, seat-selection-panel.tsx — matches spec

---

### Pillar 5: Spacing (4/4)

**Standard spacing tokens used consistently:**
- `gap-2` (8px = sm) — legend chips, zoom controls, seat row elements
- `gap-4` (16px = md) — legend tier items
- `gap-8` (32px = xl) — desktop two-column layout gap
- `space-y-6` (24px = lg) — left column section gaps
- `px-4/py-4` — mobile page padding (16px)
- `px-6/py-8` — desktop page padding (24px/32px)
- `p-6` — side panel internal padding (24px = lg)

**Arbitrary values — all justified by spec exceptions:**
- `max-w-[1280px]` — spec explicitly declares this as the booking page max-width (deviates from catalog's 1200px for seat map room)
- `w-[360px]` — spec declares "Side panel width (desktop): 360px fixed"
- `min-h-[300px]`, `min-h-[500px]` — seat map minimum heights (spec: map container height not token-based)
- `h-[200px]`, `h-[400px]` — skeleton placeholders, acceptable
- `border-l-[3px]` — spec declares "Side panel total price highlight border-left (3px solid)"
- `max-w-[200px]`, `max-w-[400px]` — header title truncation widths, layout-specific
- `pb-24` (96px) — bottom sheet clearance; 72px collapsed sheet + 24px breathing room. Slightly non-standard but justified by mobile UX requirement

No arbitrary spacing values exist for padding/margin within components. All use 4px multiples.

---

### Pillar 6: Experience Design (3/4)

**Loading states — well covered:**
- Page load: full-page Skeleton with header, 3-chip row, seat map skeleton, side panel skeleton (booking-page.tsx:319-344)
- Seat map SVG fetch: `Skeleton` + `Loader2 animate-spin` overlay (seat-map-viewer.tsx:213-219)
- Showtime chips: 3 skeleton chips when `isLoading` (showtime-chips.tsx:29-37)
- CTA button: `disabled` during `lockSeat.isPending` (booking-page.tsx:420, :433)

**Issue — CTA loading state lacks visual indicator:**
- Spec loading state: "Button shows spinner + '처리 중...' text. Disabled during submission."
- Actual: Button shows `좌석을 선택해주세요` (disabled) or `다음` (enabled) — when `isLoading=true` the button is disabled but still shows `다음` with no spinner and no copy change
- Affects both `seat-selection-panel.tsx:95-99` and `seat-selection-sheet.tsx:146-154`, `seat-selection-sheet.tsx:161-167`

**Error states — well covered:**
- SVG fetch failure: inline error message + "새로고침" button (seat-map-viewer.tsx:196-210)
- Seat lock 409: info toast with correct color (booking-page.tsx:248)
- Generic API error: error toast (booking-page.tsx:252)
- WebSocket disconnect/reconnect: `toast.loading` and `toast.success` in use-socket.ts

**Empty states — well covered:**
- No showtimes for date: empty state text (showtime-chips.tsx:39-45)
- No seats selected (panel): empty state paragraph (seat-selection-panel.tsx:63-67)
- Bottom sheet hidden when no seats: `if (selectedSeats.length === 0) return null` (seat-selection-sheet.tsx:102)
- No seat map configured: (seat-map-viewer.tsx:222-230)

**Destructive action confirmations — met per spec:**
- Seat deselection: immediate toggle, no confirmation — matches spec
- Timer expiry: non-dismissible AlertDialog with single CTA — matches spec (though `size="sm"` issue noted in Visuals)

**Issue — Keyboard navigation for seat map not implemented:**
- Spec accessibility section: "Arrow keys move focus between seats within the SVG grid. Enter/Space toggles selection. Tab moves focus out of seat map."
- No `onKeyDown`, `tabIndex`, or keyboard event handlers found on seat elements or the grid container
- `role="grid"` is set on the container but individual seats don't have `role="gridcell"` or `tabIndex` injected
- Impact: keyboard-only users cannot navigate or select seats

**Issue — `size="sm"` still present in timer-expired-modal.tsx:20:**
- Plan 4 intended to remove `size="sm"` from AlertDialogContent to fix the 2-column grid footer layout
- The `size="sm"` prop remains, triggering `AlertDialogFooter`'s `grid-cols-2` CSS rule (alert-dialog.tsx:94)
- With only one `AlertDialogAction`, the single button occupies the left half of a 2-column grid, appearing narrow and off-center
- Fix: remove `size="sm"` from `AlertDialogContent` in timer-expired-modal.tsx:20

**Aria coverage — strong:**
- `role="grid"` + `aria-label="좌석 배치도"` on SVG container
- `aria-live="polite"` on countdown timer
- `aria-live="assertive"` for 3-minute warning announcement
- `role="dialog"` + `aria-label="선택 좌석 패널"` on bottom sheet
- `aria-label` on all icon-only buttons
- `role="alertdialog"` is NOT set on timer-expired-modal (uses `AlertDialog` which Radix sets automatically via `role="alertdialog"`)

**Registry audit:** shadcn initialized at `apps/web/components.json`. UI-SPEC.md Registry Safety table lists only shadcn official blocks — no third-party registries. Registry audit not required.

---

## Files Audited

**Booking components:**
- `apps/web/components/booking/booking-page.tsx`
- `apps/web/components/booking/booking-header.tsx`
- `apps/web/components/booking/countdown-timer.tsx`
- `apps/web/components/booking/date-picker.tsx`
- `apps/web/components/booking/showtime-chips.tsx`
- `apps/web/components/booking/seat-legend.tsx`
- `apps/web/components/booking/seat-map-viewer.tsx`
- `apps/web/components/booking/seat-map-controls.tsx`
- `apps/web/components/booking/seat-row.tsx`
- `apps/web/components/booking/seat-selection-panel.tsx`
- `apps/web/components/booking/seat-selection-sheet.tsx`
- `apps/web/components/booking/timer-expired-modal.tsx`

**Supporting files:**
- `apps/web/hooks/use-socket.ts` (WebSocket toast copy)
- `apps/web/components/ui/alert-dialog.tsx` (AlertDialog internals for modal analysis)
- `apps/web/components.json` (registry safety)

**Planning artifacts:**
- `.planning/phases/03-seat-map-real-time/03-UI-SPEC.md`
- `.planning/phases/03-seat-map-real-time/03-CONTEXT.md`
- `.planning/phases/03-seat-map-real-time/03-01-SUMMARY.md` through `03-04-SUMMARY.md`
