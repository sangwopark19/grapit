---
plan: 260331-l6q
status: complete
started: 2026-03-31T06:15:00Z
completed: 2026-03-31T06:20:00Z
---

# Quick Task 260331-l6q: Fix select box + detail page UI bugs

## What was done

### Task 1: Add missing shadcn CSS variables
- Added 17 semantic color tokens to `@theme` block in `globals.css`
- Maps: `popover`→white, `foreground`→gray-900, `muted`→gray-100/gray-600, `accent`→gray-100, `border`→gray-200, `input`→gray-300, `ring`→primary, `destructive`→error
- **Fixes**: Select dropdown transparency, card backgrounds, badge variants, button hover states, focus rings across all pages

### Task 2: Fix poster desktop alignment
- Added `lg:mx-0` to poster div in `performance/[id]/page.tsx`
- `mx-auto` now only centers poster on mobile; desktop flex-row left-aligns properly

## Commits
- `5afc040` fix(ui): add missing shadcn CSS variables to globals.css
- `8fbd009` fix(detail): correct poster alignment on desktop flex layout

## Key files
- `apps/web/app/globals.css` — shadcn semantic tokens added
- `apps/web/app/performance/[id]/page.tsx` — poster lg:mx-0

## Self-Check: PASSED
- [x] Typecheck passes
- [x] Select dropdown has opaque background (bg-popover → #ffffff)
- [x] Poster centered mobile, left-aligned desktop
