---
phase: 12
plan: 00
subsystem: web-test-scaffolding
tags: [test, vitest, wave-0, tdd, scaffolding, ux]
requires:
  - apps/web/components/booking/seat-map-viewer.tsx (unchanged — viewer impl is Wave 1/3)
  - apps/web/components/admin/svg-preview.tsx (unchanged — validation impl is Wave 1 Plan 12-02)
provides:
  - vitest sampling entry points for Wave 1~3 (Nyquist compliance)
  - svg-preview.test.tsx (7 cases)
  - use-is-mobile.test.ts (4 cases, B-4 getServerSnapshot)
  - seat-map-viewer.test.tsx (17 cases: 7 existing + 10 new)
  - prefix-svg-defs-ids.test.ts (5 cases, dynamic import Option B)
affects:
  - test infrastructure only; no runtime code modified
tech-stack:
  added: []
  patterns:
    - "vi.hoisted for mock factory top-level const safety (B-3)"
    - "Dynamic import via variable specifier to defer module resolution (Task 2)"
    - "Dynamic import literal + @ts-ignore guard to satisfy grep + typecheck (Task 4)"
key-files:
  created:
    - apps/web/components/admin/__tests__/svg-preview.test.tsx
    - apps/web/hooks/__tests__/use-is-mobile.test.ts
    - apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts
  modified:
    - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
decisions:
  - "Task 2 useIsMobile import: use variable specifier const moduleSpecifier = '../use-is-mobile' + await import(moduleSpecifier) so TS bundler defers resolution (plan assumed literal await import would defer; empirically it does not under moduleResolution=bundler + strict)."
  - "Task 4 prefixSvgDefsIds import: keep literal await import('../prefix-svg-defs-ids') to satisfy plan's grep acceptance (x5 literal hits), guard with // @ts-ignore to prevent TS2307. Chose @ts-ignore over @ts-expect-error so that when Plan 12-03 Task 1 creates the module, the guards remain harmless (no retroactive typecheck failure in the merge)."
  - "Task 3 vi.hoisted mock factories: explicit generic signatures on vi.fn<(props: any) => void>() etc. Default inferred vi.fn(() => null) rejected callers with 1 argument (TS2554)."
metrics:
  duration_minutes: 10
  tasks_completed: 4
  files_touched: 4
  completed_date: 2026-04-21
---

# Phase 12 Plan 00: Wave 0 Test Scaffolding Summary

**One-liner:** RED-first vitest scaffolding for 4 modules (svg-preview admin validation, useIsMobile hook + getServerSnapshot SSR fallback, seat-map-viewer 10 new interactions, prefixSvgDefsIds helper), all discoverable by Nyquist sampling command and typecheck exit 0.

## What Shipped

| File | Status | Cases | Mode |
| --- | --- | --- | --- |
| `apps/web/components/admin/__tests__/svg-preview.test.tsx` | NEW | 7 | 1 GREEN (size regression) + 6 RED (Plan 12-02 target) |
| `apps/web/hooks/__tests__/use-is-mobile.test.ts` | NEW | 4 | 4 RED (module authored in Plan 12-02 Task 1) |
| `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` | MODIFIED | 17 (7 existing + 10 new) | 8 GREEN (7 regression + D-13 locked `transition:none` already inline) + 9 RED (Plan 12-03 target) |
| `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` | NEW | 5 | File-load FAIL (module missing) — counted as RED file; cases resume when Plan 12-03 Task 1 lands helper |

## Revision Items Covered

- **B-3 (vi.hoisted):** Mock factory references `transformWrapperSpy`, `mockUseIsMobile`, `miniMapSpy` via `vi.hoisted(...)` — ReferenceError 0 confirmed empirically (`grep -c "ReferenceError" = 0`).
- **B-4 (getServerSnapshot):** `use-is-mobile.test.ts` Test 4 imports `getServerSnapshot` and asserts `=== false`, establishing SSR-fallback auto-verification tier 1.
- **B-2-RESIDUAL-V2 Option C:** New case 1 asserts `el.style.transition` contains `fill 150ms` AND `el.getAttribute('fill')` → primary `#6C3CE0` after `useEffect` runs (Plan 12-03 Task 3 GREEN target).
- **B-2-RESIDUAL:** New case 7 exercises rerender from selected → unselected and advances 160ms of fake timers to verify `data-fading-out="true"` → DOM removal.
- **Reviews revision HIGH #1 (rapid reselect race guard):** New case 8 sequences select → unselect → 80ms → reselect → 200ms, asserting `data-fading-out` is NOT stuck (Plan 12-03 Task 2 per-seat timeout Map GREEN target).
- **Reviews revision HIGH #2 (unified parsing contract):**
  - svg-preview Test 5 (descendant `<g data-stage="top">` pass)
  - svg-preview Test 6 (invalid enum `data-stage="invalid-value"` reject with `'top, right, bottom, left'` message)
  - seat-map-viewer case 9 (descendant `<g data-stage="right">` → STAGE overlay on right side, `x > viewBox/2`).
- **Reviews revision MED #4 (D-13 BROADCAST PRIORITY):** seat-map-viewer case 10 asserts that a selected seat remaining selected but transitioning `available → locked` via `seatStates` re-render keeps `fill=#d1d5db` and `transition:none` (Plan 12-03 Task 3 useEffect skip GREEN target).
- **Reviews revision MED #6 (Wave 0 typecheck gate):** prefixSvgDefsIds test uses `await import('../prefix-svg-defs-ids')` literal guarded with `// @ts-ignore` to satisfy both the grep acceptance (literal x5) and `tsc --noEmit` exit 0.
- **Reviews revision LOW #7 (parse try/catch):** svg-preview Test 7 with malformed SVG asserts `toast.error` called with `'SVG 형식이 올바르지 않습니다'` and no mutateAsync / fetch.
- **W-2 (helper unit tests):** 5 cases for `prefixSvgDefsIds` (no defs / 1 id / multi / regex meta / malformed parse).

## Verification Evidence

### typecheck

```
$ pnpm --filter @grapit/web typecheck
> tsc --noEmit
(exit 0)
```

### Full vitest run summary

```
Test Files  4 failed | 16 passed (20)
     Tests 19 failed | 112 passed (131)
```

- 4 failing files = the 4 Wave 0 scaffolding files (expected RED until Wave 1~3 impl lands).
- 112 passing tests include all prior regression (api-client, seat-map-controls, seat-selection-panel, date-picker, skeletons, phone-verification, reset-password, use-countdown, use-socket, not-found, format-datetime, status-badge, pagination, mobile-tab-bar, network-banner, showtime-chips) PLUS 8 seat-map-viewer cases (7 original regression + new "locked `transition:none`" case which was already inline in the current impl) PLUS 1 svg-preview 10MB size-regression case.

### seat-map-viewer regression — all 7 pre-existing cases GREEN

Confirmed via `--reporter=verbose`:
- renders available seats with tier color fill
- renders locked/sold seats with gray fill and reduced opacity
- calls onSeatClick when clicking an available seat
- calls onSeatClick when clicking a locked seat (parent handles toast)
- does NOT call onSeatClick when clicking a sold seat
- renders selected seats with dark stroke
- shows error state when SVG fetch fails

ReferenceError count after Task 3 mock expansion: **0** (B-3 verified).

### Nyquist sampling

`pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview prefix-svg-defs-ids --run` discovers all 4 files and reports them in the run. Plan 12-VALIDATION.md §"Sampling Rate" guarantee met.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 typecheck failure from literal dynamic import**
- **Found during:** Task 2 post-write vitest + typecheck verification
- **Issue:** Plan's `await import('../use-is-mobile')` literal triggered TS2307 `Cannot find module '../use-is-mobile'` under `moduleResolution: bundler` + `strict: true`. Plan assumed dynamic imports defer resolution; TS 5.9 with bundler resolution does still resolve literal specifiers at compile time.
- **Fix:** Hoisted the specifier to a `const moduleSpecifier = '../use-is-mobile'` and used `await import(moduleSpecifier)`. Variable specifiers are not statically resolved. Wrapped module cast in a `loadModule()` helper typed against a local `UseIsMobileModule` interface for ergonomics.
- **Files modified:** `apps/web/hooks/__tests__/use-is-mobile.test.ts`
- **Commit:** c6ed8c7

**2. [Rule 3 - Blocking] Task 3 vi.hoisted mock factory signature TS2554**
- **Found during:** Task 3 post-write typecheck
- **Issue:** `vi.fn(() => null)` inferred `() => null` with zero-arg signature; callsites like `transformWrapperSpy(props)` and `miniMapSpy(props)` then failed `TS2554: Expected 0 arguments, but got 1.`
- **Fix:** Annotated the hoisted factories with explicit generics: `vi.fn<(props: any) => void>()`, `vi.fn<() => boolean>(() => false)`, `vi.fn<(props: any) => null>(() => null)`. Preserves runtime behavior; surfaces the intended call signature.
- **Files modified:** `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`
- **Commit:** 89b35f1

**3. [Rule 3 - Blocking] Task 4 typecheck failure + grep acceptance conflict**
- **Found during:** Task 4 post-write typecheck
- **Issue:** Plan Task 4 acceptance criterion required `grep -c "await import('../prefix-svg-defs-ids')" = 5` (literal occurrences) AND `pnpm --filter @grapit/web typecheck exit 0`. A literal `await import('../prefix-svg-defs-ids')` fails typecheck for the same reason as Task 2 (TS2307 × 5). The Task 2 workaround (variable specifier) would have failed the literal grep.
- **Fix:** Kept the literal `await import('../prefix-svg-defs-ids')` at each call site (grep acceptance satisfied at count 5), guarded each with `// @ts-ignore -- Wave 0 Option B: module authored in Plan 12-03 Task 1` (typecheck exit 0 satisfied). Chose `@ts-ignore` over `@ts-expect-error` so the guard remains harmless when Plan 12-03 Task 1 creates the module — Plan 12-03 can either leave the guards in place (inert) or remove them.
- **Files modified:** `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts`
- **Commit:** 487ea80

### Scope Clarifications (not deviations)

- No modifications to STATE.md or ROADMAP.md (worktree orchestrator owns those writes).
- No modifications to runtime code (Wave 0 is test-only).

## Commits

| Task | Commit | Summary |
| --- | --- | --- |
| 1 | edebb9a | test(12-00): add svg-preview admin upload validation test (7 cases) |
| 2 | c6ed8c7 | test(12-00): add useIsMobile hook test (4 cases including B-4 getServerSnapshot) |
| 3 | 89b35f1 | test(12-00): extend seat-map-viewer mocks (B-3 vi.hoisted) + 10 new cases |
| 4 | 487ea80 | test(12-00): add prefixSvgDefsIds helper test (W-2, 5 cases, dynamic import) |

## Known Stubs

None. Wave 0 is test-only scaffolding; no UI stubs to track. The RED test cases are intentional scaffolding for Wave 1~3 TDD GREEN transition, documented in each test's case-level commentary.

## Threat Flags

None. No new runtime surface introduced. T-12-01 (admin SVG validation) is mitigated in Plan 12-02.

## Self-Check: PASSED

Created files verified:
- `apps/web/components/admin/__tests__/svg-preview.test.tsx` → FOUND
- `apps/web/hooks/__tests__/use-is-mobile.test.ts` → FOUND
- `apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts` → FOUND
- `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` → FOUND (modified)

Commits verified in git log:
- edebb9a → FOUND
- c6ed8c7 → FOUND
- 89b35f1 → FOUND
- 487ea80 → FOUND
