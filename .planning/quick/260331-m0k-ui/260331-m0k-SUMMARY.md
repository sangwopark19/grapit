---
phase: quick
plan: 260331-m0k
subsystem: web-ui
tags: [css, layout-shift, scrollbar-gutter, ux-fix]
dependency_graph:
  requires: []
  provides: [scrollbar-gutter-stable]
  affects: [all-pages-with-scrollbar-variation]
tech_stack:
  added: []
  patterns: [scrollbar-gutter-stable-for-layout-shift-prevention]
key_files:
  created: []
  modified: [apps/web/app/globals.css]
decisions:
  - scrollbar-gutter: stable over overflow-y: scroll (cleaner UX, no always-visible scrollbar)
metrics:
  duration: 33s
  completed: "2026-03-31T06:56:01Z"
---

# Quick Task 260331-m0k: scrollbar-gutter layout shift fix Summary

CSS scrollbar-gutter: stable on html element to prevent mx-auto container horizontal shift when scrollbar appears/disappears during genre filter tab switching.

## What Was Done

### Task 1: html에 scrollbar-gutter: stable 추가

Added `html { scrollbar-gutter: stable; }` rule to `apps/web/app/globals.css` between the `@theme` block and the `body` rule. This reserves scrollbar track space even when content doesn't overflow, eliminating the viewport width fluctuation that caused centered containers to shift horizontally on tab changes.

**Commit:** c797fbe

**Files modified:**
- `apps/web/app/globals.css` (4 lines added)

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **scrollbar-gutter: stable (not both-edges)** -- `both-edges` would add padding on both sides of the viewport, which is unnecessary and wastes horizontal space. `stable` alone reserves space only on the scrollbar side.

## Known Stubs

None.

## Verification Results

- `scrollbar-gutter: stable` present at line 71 of globals.css
- @theme block unchanged (lines 3-68)
- body rule unchanged (lines 74-80)

## Self-Check: PASSED
