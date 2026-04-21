---
phase: 11-admin-dashboard
fixed_at: 2026-04-20T17:40:30Z
review_path: .planning/phases/11-admin-dashboard/11-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-20T17:40:30Z
**Source review:** `.planning/phases/11-admin-dashboard/11-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 3
- Fixed: 3
- Skipped: 0

All three warnings from the re-review were addressable cleanly. No critical
findings were present. Six Info items are out of scope for this iteration
(scope = `critical_warning`).

## Fixed Issues

### WR-01: revenue-trend empty state is unreachable (skeleton always fills the array)

**Files modified:** `apps/web/app/admin/page.tsx`
**Commit:** `b671149`
**Applied fix:**

Changed the revenue panel's emptiness predicate from `d.length === 0`
(which the service-side bucket skeleton guarantees is never true) to
`d.length === 0 || d.every((b) => b.revenue === 0)`. This preserves the
padded 7/30/13-bucket array that `RevenueAreaChart` needs for its X-axis
shape while still letting `pickMode` return `'empty'` when every bucket's
revenue is zero, so the UI-SPEC D-01 empty copy ("해당 기간 동안 예매 내역이
없습니다") is actually reachable for the revenue section. `genre` and
`payment` paths were already correct and were left untouched.

**Verification:**
- `pnpm typecheck` (web): clean
- `pnpm test` (web): 110 tests pass

### WR-02: `buildWeeklyBucketSkeleton` weekNum formula is not ISO 8601

**Files modified:** `apps/api/src/modules/admin/kst-boundary.ts`
**Commit:** `6e9087c`
**Applied fix:**

Replaced the "days since Jan 1 ÷ 7 (ceil)" approximation with a proper ISO
8601 week number derived from Jan 4 of the Thursday's ISO year:

1. `target` = Thursday of the ISO week (unchanged from the prior code).
2. `isoYear = target.getUTCFullYear()` — the ISO year follows the Thursday,
   so Dec 29–31 of the calendar year can still sit in the next ISO year, and
   Jan 1–3 can still sit in the prior ISO year.
3. `week1Monday` = Monday of ISO week 1 of `isoYear`, computed from Jan 4
   minus `(jan4Day - 1)` days.
4. `weekNum = round((targetMonday - week1Monday) / 7 days) + 1`.

This matches Postgres `to_char(..., 'IYYY-"W"IW')` across year-boundary
weeks — e.g. the week of 2026-12-28..2027-01-03 now correctly labels as
`2026-W53` instead of the prior `2027-W01`, so the skeleton/DB Map-merge
no longer produces phantom + orphaned buckets on 90d windows that cross
December/January.

A targeted unit test for the 90d year-boundary case was not added in this
iteration (the existing `revenue-weekly` spec only asserts the array is
non-empty and contains `week|iyyy` in the serialized args). The review
explicitly listed a test as a deferrable follow-up; keeping this fix
narrowly scoped to the formula change.

**Verification:**
- `pnpm typecheck` (api): clean
- `pnpm test` (api): 273 tests pass

### WR-03: `getPaymentDistribution` hardcodes identifiers inside a raw SQL fragment

**Files modified:**
- `apps/api/src/modules/admin/admin-dashboard.service.ts`
- `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts`

**Commit:** `171ed32`
**Applied fix:**

Replaced the raw `sql\`reservations.status = 'CONFIRMED' AND payments.status
= 'DONE' AND reservations.created_at >= ${startUtc} AND reservations.created_at
< ${endUtc}\`` fragment with the typed
`and(eq(reservations.status, 'CONFIRMED'), eq(payments.status, 'DONE'),
gte(reservations.createdAt, startUtc), lt(reservations.createdAt, endUtc))`
composition. The `and`/`eq`/`gte`/`lt` helpers were already imported for the
rest of the file (summary/revenue/genre/top-performances), so no import
change was needed.

The two CONFIRMED+DONE predicate requirement (Pitfall 5 / review MEDIUM 5)
is preserved. Index eligibility for `idx_reservations_status` and the
`reservations.created_at` range filter is preserved because Drizzle emits
`reservations.status = $1 AND reservations.created_at >= $2 AND
reservations.created_at < $3` — the same shape the prior raw fragment
produced, without the identifier fragility that the review flagged for
future aliasing/CTE composition.

Test update: `admin-dashboard.service.spec.ts` `'payment'` block previously
asserted `JSON.stringify(whereArg)` contained `'CONFIRMED'` and `'DONE'`.
The new typed AST contains a PgTable <-> PgColumn cycle that throws inside
`JSON.stringify`. Replaced the serializer with a hand-rolled cycle-safe
`collectStrings(whereArg)` walker (uses `WeakSet` for the seen set) and
asserted both literals appear in the collected strings. The assertion intent
is identical; only the traversal mechanism is changed.

**Verification:**
- `pnpm typecheck` (api): clean
- `pnpm test` (api): 273 tests pass (admin-dashboard.service.spec.ts `'payment'`
  block passes with the updated collector)
- `pnpm lint` (api): no new warnings in modified files (the `as any` warnings
  on spec line 53 are pre-existing and outside the WR-03 edit hunks)

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-04-20T17:40:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
