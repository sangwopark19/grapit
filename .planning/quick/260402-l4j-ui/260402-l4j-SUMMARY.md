---
phase: quick
plan: 260402-l4j
subsystem: web/ui
tags: [tailwind-v4, shadcn, css-fix]
dependency-graph:
  requires: []
  provides: [correct-modal-widths]
  affects: [alert-dialog, dialog, sheet]
tech-stack:
  added: []
  patterns: [explicit-rem-over-named-max-w]
key-files:
  modified:
    - apps/web/components/ui/alert-dialog.tsx
    - apps/web/components/ui/dialog.tsx
    - apps/web/components/ui/sheet.tsx
decisions:
  - Use explicit rem values instead of named Tailwind max-w utilities in v4
metrics:
  duration: 65s
  completed: 2026-04-02
---

# Quick Task 260402-l4j: Tailwind v4 max-w Named Utility Fix

Tailwind CSS v4 named max-width utilities (max-w-lg, max-w-xs, max-w-sm) resolve to spacing scale values (24px, 4px, 8px) instead of legacy width values (32rem, 20rem, 24rem), replaced all occurrences with explicit rem values in shadcn UI components.

## Root Cause

Tailwind CSS v4 changed `max-w-lg` to resolve via `var(--spacing-lg)` = 24px instead of the expected 32rem. Same issue for `max-w-xs` (4px instead of 20rem) and `max-w-sm` (8px instead of 24rem). This caused dialogs, alert dialogs, and sheets to render at tiny widths.

## Changes Made

| File | Before | After |
|------|--------|-------|
| alert-dialog.tsx | `data-[size=sm]:max-w-xs` | `data-[size=sm]:max-w-[20rem]` |
| alert-dialog.tsx | `data-[size=default]:sm:max-w-lg` | `data-[size=default]:sm:max-w-[32rem]` |
| dialog.tsx | `max-w-lg` | `max-w-[32rem]` |
| sheet.tsx (right) | `sm:max-w-sm` | `sm:max-w-[24rem]` |
| sheet.tsx (left) | `sm:max-w-sm` | `sm:max-w-[24rem]` |

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Replace named max-w with explicit rem values | a04befa | alert-dialog.tsx, dialog.tsx, sheet.tsx |

## Verification

- Confirmed zero remaining named max-width utilities (`max-w-xs`, `max-w-sm`, `max-w-lg`) across entire `apps/web/` directory
- `max-w-[calc(100%-2rem)]` in alert-dialog.tsx was already an explicit value and left unchanged

## Deviations from Plan

None - executed exactly as specified.

## Known Stubs

None.
