---
phase: 12
plan: 02
subsystem: web-hooks-and-admin-validation
tags: [wave-2, hook, admin, svg-validation, ux-02, ux-06, unified-parsing-contract]
requires:
  - apps/web/hooks/__tests__/use-is-mobile.test.ts (Plan 12-00 scaffolding — RED 4 cases)
  - apps/web/components/admin/__tests__/svg-preview.test.tsx (Plan 12-00 scaffolding — RED 6 + GREEN 1)
provides:
  - apps/web/hooks/use-is-mobile.ts (useIsMobile + getServerSnapshot named export)
  - apps/web/components/admin/svg-preview.tsx (handleSvgUpload validation pipeline)
  - apps/web/test-setup.ts (Blob.prototype.text + arrayBuffer jsdom polyfill)
affects:
  - apps/web/vitest.config.ts (setupFiles: ['./test-setup.ts'])
  - Plan 12-03 seat-map-viewer.tsx will import `useIsMobile` from this hook
tech-stack:
  added: []
  patterns:
    - "React 19 useSyncExternalStore pattern for SSR-safe media query subscription"
    - "Unified parsing contract: doc.querySelector('[data-stage]') searches root + all descendants"
    - "DOMParser + parsererror tagName + querySelector('parsererror') dual-guard for jsdom/browser parity"
    - "Named export of getServerSnapshot — SSR-fallback invariant becomes unit-testable (B-4)"
key-files:
  created:
    - apps/web/hooks/use-is-mobile.ts
    - apps/web/test-setup.ts
  modified:
    - apps/web/components/admin/svg-preview.tsx
    - apps/web/vitest.config.ts
decisions:
  - "B-4 getServerSnapshot named export — useSyncExternalStore 3rd arg reference AND separate unit-test import from the same function declaration. Single source of truth for SSR fallback (false)."
  - "UNIFIED PARSING CONTRACT (D-06/D-07 reviews revision): admin + viewer both use doc.querySelector('[data-stage]') which matches root + descendant. Eliminates root-only vs descendant UX-02 silent fail when admin passes and viewer doesn't detect."
  - "dual parsererror guard — (documentElement.tagName === 'parsererror') OR (doc.querySelector('parsererror'))) — covers both jsdom and real-browser DOMParser behavior. Real Firefox puts parsererror at document root for XML with fatal errors; Chrome puts it as descendant when tolerant-parsing an <html> input mode; jsdom behavior varies. Belt-and-suspenders."
  - "Rule 3 auto-fix: jsdom's Blob/File polyfill is missing .text() (Node 22+ native File has it but jsdom overrides globalThis.File). Added test-setup.ts polyfilling Blob.prototype.text + arrayBuffer to make Wave 0 tests pass. Production/browser runtime unaffected — polyfill only kicks in when the method is undefined."
  - "text variable hoisted outside try block so it can be reused in the seat-count step (file.text() called exactly once per upload, consistent with plan's interface contract)."
metrics:
  duration_minutes: 6
  tasks_completed: 2
  files_touched: 4
  completed_date: 2026-04-21
---

# Phase 12 Plan 02: Hook + Admin Validation Summary

**One-liner:** useIsMobile hook (useSyncExternalStore + matchMedia with B-4 getServerSnapshot named export) + admin SVG upload pipeline gaining DOMParser try/catch + unified `[data-stage]` contract + enum validation (D-06/D-07 reviews revision HIGH #2 + LOW #7), flipping 11 Wave 0 RED cases to GREEN.

## What Shipped

| File | Status | Role |
| --- | --- | --- |
| `apps/web/hooks/use-is-mobile.ts` | NEW (45 lines) | `useIsMobile()` hook + `getServerSnapshot()` named export |
| `apps/web/components/admin/svg-preview.tsx` | MODIFIED | `handleSvgUpload` gains 50-line validation pipeline before R2 PUT |
| `apps/web/test-setup.ts` | NEW | jsdom Blob.prototype.text + arrayBuffer polyfill (Rule 3 fix) |
| `apps/web/vitest.config.ts` | MODIFIED | `setupFiles: ['./test-setup.ts']` |

## Task 1 — useIsMobile Hook (commit `ed9e253`)

### Key excerpts from `apps/web/hooks/use-is-mobile.ts`

```ts
'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * SSR snapshot — 항상 false (desktop fallback).
 * ...Named export로도 노출하여 Wave 0 unit test가 SSR fallback 정합성을 직접 검증 (B-4).
 */
export function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- `'use client'` directive on line 1 — React 19 + Next.js 16 App Router compliant
- Strict return types, zero `any`
- `subscribe`/`getSnapshot`/`getServerSnapshot` are stable module-level function references (no reallocation per render)
- `getServerSnapshot` as named export → Plan 12-00 Test 4 `expect(getServerSnapshot()).toBe(false)` passes (B-4 auto-verification tier)

## Task 2 — Admin SVG Upload Validation (commit `d52654e`)

### Diff of `handleSvgUpload` in `svg-preview.tsx`

**Before** (size check → R2 PUT directly):

```tsx
if (file.size > 10 * 1024 * 1024) { toast.error('...10MB...'); return; }
try {
  const { uploadUrl, publicUrl } = await presignedUpload.mutateAsync({...});
  await fetch(uploadUrl, { method: 'PUT', body: file, ... });
  setSvgUrl(publicUrl);
  const text = await file.text();
  const seatCount = (text.match(/data-seat-id/g) || []).length;
  ...
}
```

**After** (size → try/catch DOMParser → stage marker → enum → then R2 PUT):

```tsx
if (file.size > 10 * 1024 * 1024) { toast.error('...10MB...'); return; }

const VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const;
let text: string;
let doc: Document;
try {
  text = await file.text();
  const parser = new DOMParser();
  doc = parser.parseFromString(text, 'image/svg+xml');
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
// UNIFIED CONTRACT: root + descendant 모두 탐색
const stageEl = doc.querySelector('[data-stage]');
const hasDataStage = stageEl !== null;

if (!hasStageText && !hasDataStage) {
  toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.');
  return;
}

if (hasDataStage) {
  const value = stageEl!.getAttribute('data-stage') ?? '';
  if (!VALID_STAGES.includes(value as (typeof VALID_STAGES)[number])) {
    toast.error('data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.');
    return;
  }
}

try {
  const { uploadUrl, publicUrl } = await presignedUpload.mutateAsync({...});
  await fetch(uploadUrl, { method: 'PUT', body: file, ... });
  setSvgUrl(publicUrl);
  // text 재사용 — file.text() 중복 호출 회피
  const seatCount = (text.match(/data-seat-id/g) || []).length;
  setTotalSeats(seatCount);
  toast.success('좌석맵 SVG가 업로드되었습니다.');
} catch { toast.error('SVG 업로드에 실패했습니다.'); }
```

### Validation invariants verified

| Invariant | Evidence |
|---|---|
| DOMParser line < `presignedUpload.mutateAsync` line | `awk` output: DOMParser=48, mutateAsync=90, valid=YES |
| Unified parsing contract (root + descendant) | `doc.querySelector('[data-stage]')` — single selector covers both |
| Enum: top\|right\|bottom\|left only | `VALID_STAGES` tuple + `.includes()` with typed narrowing |
| No regex-based stage detection | regex only used for seat-count `data-seat-id` (not stage) |
| `file.text()` called exactly once | hoisted `text` reused in seat count |
| useCallback deps unchanged | `[presignedUpload]` preserved |

## Verification Evidence

### Static checks

```
$ pnpm --filter @grapit/web typecheck
> tsc --noEmit
(exit 0)

$ pnpm --filter @grapit/web lint | tail -3
✖ 24 problems (0 errors, 24 warnings)
  0 errors and 6 warnings potentially fixable with the `--fix` option.
```

- **0 lint errors.** All 24 warnings pre-existing, none in files modified by this plan (verified via `grep svg-preview` / `grep use-is-mobile` against lint output — no hits).

### Target-file tests — 11/11 GREEN

```
$ pnpm --filter @grapit/web exec vitest run hooks/__tests__/use-is-mobile.test.ts components/admin/__tests__/svg-preview.test.tsx

 ✓ hooks/__tests__/use-is-mobile.test.ts (4 tests) 14ms
 ✓ components/admin/__tests__/svg-preview.test.tsx (7 tests) 345ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
```

### Case-level GREEN evidence

**use-is-mobile.test.ts** — 4 cases:
1. desktop viewport (max-width:767px 미일치) → false
2. mobile viewport (max-width:767px 일치) → true
3. matchMedia change event triggers hook re-render
4. **B-4** `getServerSnapshot()` returns false (SSR fallback invariant)

**svg-preview.test.tsx** — 7 cases:
1. `<text>STAGE</text>` SVG passes validation + R2 PUT called
2. root `data-stage="top"` passes validation
3. no stage marker → toast.error('스테이지 마커...') + mutateAsync NOT called
4. 10MB regression → size error toast, validation not reached (pre-existing GREEN)
5. **reviews revision HIGH #2** `<g data-stage="top">` descendant passes (unified contract)
6. **reviews revision HIGH #2** `data-stage="invalid-value"` → toast.error('top, right, bottom, left') + R2 PUT NOT called
7. **reviews revision LOW #7** malformed SVG `<svg><g data-stage="top"><rect data-seat-id="A-1"` → toast.error('SVG 형식이 올바르지 않습니다') + R2 PUT NOT called

### Full-suite baseline comparison

| | Test Files passed | Tests passed |
|---|---|---|
| After Wave 0 (PLAN 12-00 scaffolding) | 16/20 | 112/131 |
| After this plan (Wave 2) | 18/20 | 122/131 |
| Delta | **+2** | **+10** (11 new GREEN − 1 already-GREEN svg-preview size regression) |

Remaining 2 failing files + 9 failing tests are Plan 12-03 (seat-map-viewer) + Plan 12-03 (prefixSvgDefsIds helper) scope — expected RED until Wave 3.

### Nyquist sampling command (plan's primary verify)

```
$ pnpm --filter @grapit/web test -- use-is-mobile svg-preview --run
 ✓ hooks/__tests__/use-is-mobile.test.ts (4 tests)
 ✓ components/admin/__tests__/svg-preview.test.tsx (7 tests)
```

### Unified contract grep evidence (admin side)

```
apps/web/components/admin/svg-preview.tsx:
  HIT: DOMParser
  HIT: parseFromString
  HIT: image/svg+xml
  HIT: parsererror
  HIT: VALID_STAGES
  HIT: doc.querySelector('[data-stage]')
  HIT: toast.error
  HIT: 스테이지 마커가 없는 SVG
  HIT: top, right, bottom, left
  HIT: SVG 형식이 올바르지 않습니다
```

### Hook grep evidence

```
apps/web/hooks/use-is-mobile.ts:
  HIT: useSyncExternalStore
  HIT: matchMedia
  HIT: (max-width: 767px)
  HIT: export function getServerSnapshot
```

## Threat Model Disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| **T-12-01** (Tampering / Input Validation on SVG upload) | **mitigate** | DOMParser try/catch + parsererror dual-guard + stage marker check + enum validation executes before `presignedUpload.mutateAsync` + `fetch PUT`. Test cases 5/6/7 assert mutateAsync NOT called on validation failure. |
| Malicious `<script>` SVG / XSS via `dangerouslySetInnerHTML` | **accept (MVP) / defer** | D-19 tech-debt explicitly documented. Client-side validation only. Admin credential compromise remains latent risk. Plan 12-04 SUMMARY will record the tech-debt footnote per 12-REVIEWS.md LOW #9. |
| Oversize SVG DoS | mitigate (pre-existing) | `file.size > 10MB` unchanged, still first gate. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] jsdom Blob.prototype.text / arrayBuffer missing**
- **Found during:** Task 2 post-implementation test run — all well-formed SVG test cases were exiting via the parse-error toast, and the "스테이지 마커 없는" test received `'SVG 형식이 올바르지 않습니다'` instead of `'스테이지 마커...'`.
- **Root cause probe:** A throwaway test (`_probe.test.ts`) confirmed `File.prototype.text === undefined` under vitest + jsdom even though Node 24's native File has `.text()`. jsdom overrides `globalThis.File` with its own polyfill that does not implement the method. So `await file.text()` threw `TypeError: file.text is not a function`, caught by the Plan's new `try/catch`, flowing into the parse-error branch for *every* well-formed SVG.
- **Fix:** Added `apps/web/test-setup.ts` polyfilling `Blob.prototype.text` + `arrayBuffer` using `FileReader` (only installs when the method is undefined, so production browsers and Node-native File remain untouched). Registered it via `vitest.config.ts` `setupFiles: ['./test-setup.ts']`.
- **Files modified:** `apps/web/test-setup.ts` (new), `apps/web/vitest.config.ts`.
- **Commit:** `d52654e` (same commit as Task 2 — the polyfill is what makes Task 2's Wave 0 tests pass).
- **Scope justification:** Without this fix Wave 0 → Wave 2 RED→GREEN transition is impossible; the plan's Task 2 verify step (`pnpm test -- svg-preview --run` → 7 passed) hard-depends on it. Real browsers and production code are unaffected.

### Scope Clarifications (not deviations)

- No modifications to STATE.md / ROADMAP.md (worktree orchestrator owns those writes).
- No Task 2 modification to the 10MB size pre-check or the success path (size → try/catch (PUT) → setSvgUrl → seat count → toast.success). Preserved exactly as before per plan.
- `text` variable hoisted but otherwise the seat-count line + regex unchanged, preserving the `(text.match(/data-seat-id/g) || []).length` existing behavior.

## Reviews Revision Items Covered

- **HIGH #2 (unified parsing contract + enum):**
  - `doc.querySelector('[data-stage]')` — single selector matches root OR descendant (e.g. `<g data-stage="top">`)
  - `VALID_STAGES` tuple + `.includes()` rejects `data-stage="invalid-value"` with specific toast copy
  - Test cases 5 + 6 GREEN
- **LOW #7 (parse try/catch + malformed SVG toast):**
  - `try { file.text() + DOMParser.parseFromString() }` `catch { toast.error('SVG 형식이...') }`
  - Dual parsererror guard (documentElement + querySelector)
  - Test case 7 GREEN with malformed `'<svg><g data-stage="top"><rect data-seat-id="A-1"'`
- **B-4 (getServerSnapshot named export — SSR-fallback auto-verification):**
  - Exported from `use-is-mobile.ts` line 27 as `export function getServerSnapshot(): boolean { return false; }`
  - Same function reference passed as 3rd arg to `useSyncExternalStore` AND importable by Wave 0 test 4
  - Plan 12-00 Test 4 GREEN — direct unit assertion `expect(getServerSnapshot()).toBe(false)`

## Commits

| Task | Commit | Summary |
| --- | --- | --- |
| 1 | `ed9e253` | feat(12-02): add useIsMobile hook with getServerSnapshot named export |
| 2 | `d52654e` | feat(12-02): add admin SVG upload parsing + stage marker + enum validation (includes jsdom polyfill) |

## Known Stubs

None. Both files are fully functional production code:
- `use-is-mobile.ts` ships a complete React 19 hook with SSR fallback
- `svg-preview.tsx`'s validation pipeline is the final MVP form; only server-side re-validation (D-19) is deferred and explicitly tracked as tech debt.

## Threat Flags

None. No new trust boundaries introduced beyond the admin-browser → R2 boundary that the plan already enumerates.

## Self-Check: PASSED

Files verified:
- `apps/web/hooks/use-is-mobile.ts` → FOUND (45 lines)
- `apps/web/components/admin/svg-preview.tsx` → FOUND (modified)
- `apps/web/test-setup.ts` → FOUND
- `apps/web/vitest.config.ts` → FOUND (setupFiles updated)

Commits verified in `git log`:
- `ed9e253` → FOUND
- `d52654e` → FOUND

Target tests verified GREEN:
- use-is-mobile.test.ts (4/4)
- svg-preview.test.tsx (7/7)
