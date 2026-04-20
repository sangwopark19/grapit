---
phase: 11-admin-dashboard
reviewed: 2026-04-20T12:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - apps/api/src/modules/admin/__tests__/admin-dashboard.controller.spec.ts
  - apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts
  - apps/api/src/modules/admin/admin-dashboard.controller.ts
  - apps/api/src/modules/admin/admin-dashboard.service.ts
  - apps/api/src/modules/admin/admin.module.ts
  - apps/api/src/modules/admin/kst-boundary.ts
  - apps/api/test/admin-dashboard.integration.spec.ts
  - apps/web/app/admin/page.tsx
  - apps/web/app/globals.css
  - apps/web/components/admin/admin-sidebar.tsx
  - apps/web/components/admin/dashboard/_state.tsx
  - apps/web/components/admin/dashboard/genre-donut-chart.tsx
  - apps/web/components/admin/dashboard/payment-bar-chart.tsx
  - apps/web/components/admin/dashboard/period-filter.tsx
  - apps/web/components/admin/dashboard/revenue-area-chart.tsx
  - apps/web/components/admin/dashboard/top-performances-table.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/chart.tsx
  - apps/web/components/ui/toggle-group.tsx
  - apps/web/components/ui/toggle.tsx
  - apps/web/e2e/admin-dashboard.spec.ts
  - apps/web/hooks/use-admin-dashboard.ts
  - apps/web/package.json
  - packages/shared/src/index.ts
  - packages/shared/src/schemas/admin-dashboard.schema.ts
  - packages/shared/src/types/admin-dashboard.types.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 11: Code Review Report (Re-review for PR #17)

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found
**Base commit:** `main`
**Branch:** `gsd/phase-11-admin-dashboard`

## Summary

Re-review of Phase 11 admin dashboard PR #17 after two post-review fix commits:
- `fc68183` — chart palette `--chart-*` mirrored to `:root` so recharts can resolve `var(--chart-1)` (Tailwind v4 `@theme` does not inject non-namespaced tokens into `:root`).
- `68d4af0` — E2E period-filter spec now queries `getByRole('radio', { name: '7일' })`, matching Radix ToggleGroup `type="single"` items (role=radio in single-select mode).

Both fixes are correct and the issues they resolved are no longer findings.

The implementation remains well aligned with UI-SPEC, threat model mitigations (T-11-03 RBAC via `@UseGuards(RolesGuard) + @Roles('admin')`, T-11-04 period validation via zod enum), and the caching contract (60 s read-through, per-key namespace `cache:admin:dashboard:{kind}:{params}`). Drizzle parameter binding eliminates SQL injection risk. JWT + RBAC posture matches existing admin controllers.

Remaining issues (all deferrable to follow-up tickets — none block merge):

1. **WR-01 (carried over)** — `getRevenueTrend` always returns a non-empty skeleton-backed array (30d → 30 buckets), so `pickMode((d) => d.length === 0)` can never select `empty` for the revenue panel. The UX spec's "해당 기간 동안 예매 내역이 없습니다" copy is therefore effectively dead code for the revenue section, and an all-zero period renders as a flat 0-line instead.
2. **WR-02 (carried over)** — `buildWeeklyBucketSkeleton`'s `weekNum` formula uses "days from Jan 1 ÷ 7" rather than the ISO 8601 week rule ("first Thursday of the year"), so for some year-boundary weeks the skeleton label diverges from Postgres `to_char(..., 'IYYY-"W"IW')`. On a 90d view spanning Dec/Jan this produces duplicate buckets where the real row is present but not merged.
3. **WR-03 (carried over)** — `getPaymentDistribution` uses a raw SQL WHERE fragment that hardcodes table/column identifiers (`reservations.status`, `payments.status`, `reservations.created_at`). Values are parameter-bound (safe), but hardcoded identifiers are fragile if Drizzle ever aliases the tables (e.g., on subquery composition). The fragment can be rewritten with the typed `and(eq(...))` API without losing index eligibility.

The 6 Info items carry over from the prior review; none are regressions introduced by the two post-review fixes. The earlier WR-04 (Proxy mock `then`-only hook hazard) is retained as Info IN-07 since it is a test-only concern and the test suite is green — it no longer rises to Warning.

## Warnings

### WR-01: revenue-trend empty state is unreachable (skeleton always fills the array)

**File:** `apps/web/app/admin/page.tsx:61`
**Issue:**
```tsx
const revenueMode = pickMode(revenue, (d) => d.length === 0);
```
`AdminDashboardService.getRevenueTrend` always pads the response with a full bucket skeleton (`buildDailyBucketSkeleton(days)` or `buildWeeklyBucketSkeleton(ceil(days/7))`), so `data.length` is 7 / 30 / 13 for `7d` / `30d` / `90d`, never 0. `pickMode` therefore never returns `empty`, the `ChartPanelState empty` branch is dead for the revenue section, and periods with zero revenue render as a flat 0-line (visually indistinguishable from "all zeros are real" vs "no bookings").

`genre` and `payment` do not have this problem — the service returns `[]` directly when the DB is empty, and `pickMode` selects `empty` correctly.

**Fix:** Detect empty via the numeric signal, not via array length.
```tsx
const revenueMode = pickMode(
  revenue,
  (d) => d.length === 0 || d.every((b) => b.revenue === 0),
);
```
Or, if you prefer the server to own the policy, return `[]` from `getRevenueTrend` when the DB produced zero rows and leave the skeleton merge inside the service only when `rows.length > 0`. Either approach restores the UI-SPEC D-01 empty copy.

---

### WR-02: `buildWeeklyBucketSkeleton` weekNum formula is not ISO 8601 — year-boundary weeks can mismatch Postgres `IYYY-"W"IW`

**File:** `apps/api/src/modules/admin/kst-boundary.ts:80-103`
**Issue:**
```ts
const target = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
const dayNum = target.getUTCDay() || 7;
target.setUTCDate(target.getUTCDate() + 4 - dayNum);          // move to Thursday of that week
const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
const label = `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
```
The formula computes "days since Jan 1 ÷ 7 (ceil)", which is **not** the ISO 8601 rule ("week 1 is the week containing the first Thursday of the ISO year"). Example: the week of 2027-01-01 (Fri) has its Thursday on 2027-01-07, so the formula labels it `2027-W01`, but Postgres `to_char(..., 'IYYY-"W"IW')` labels the week of 2026-12-28..2027-01-03 as `2026-W53`. On a 90d window that crosses a year boundary, the skeleton and the DB rows disagree on that week's label, so the Map-merge misses, producing a phantom 0-value bucket plus an unmerged real bucket elsewhere in the return array.

(The ISO-year quirks are rarer in 7d/30d windows because they use `IYYY-MM-DD` bucket format, which is calendar-correct. 90d + December/January is the risky range.)

**Fix:** Derive the week number from the Monday of ISO week 1 of the ISO year of the Thursday `target`.
```ts
// target = Thursday of the ISO week we want to label (already computed above)
const isoYear = target.getUTCFullYear();
const jan4 = new Date(Date.UTC(isoYear, 0, 4));
const jan4Day = jan4.getUTCDay() || 7;
const week1Monday = new Date(jan4);
week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
const targetMonday = new Date(target);
targetMonday.setUTCDate(target.getUTCDate() - 3); // Thu -> Mon
const weekNum =
  Math.round((targetMonday.getTime() - week1Monday.getTime()) / (7 * DAY_MS)) + 1;
const label = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
```
If you prefer to defer the rewrite, at minimum add a unit test covering a 90d window whose range includes Dec 28..Jan 3 so that any future regression surfaces in CI. The current `revenue-weekly` spec only asserts the array is non-empty and serialized args mention `week|iyyy`.

---

### WR-03: `getPaymentDistribution` hardcodes identifiers inside a raw SQL fragment

**File:** `apps/api/src/modules/admin/admin-dashboard.service.ts:200`
**Issue:**
```ts
const paymentFilter = sql`reservations.status = 'CONFIRMED' AND payments.status = 'DONE' AND reservations.created_at >= ${startUtc} AND reservations.created_at < ${endUtc}`;
```
`startUtc`/`endUtc` are parameter-bound (injection-safe), but the table and column identifiers (`reservations`, `payments`, `status`, `created_at`) are baked into the string. That works today because Drizzle does not alias these base tables on a two-table join, but:
- A future schema rename (e.g., `reservations` → `reservations_v2`) would silently break this query while the rest of the service keeps compiling.
- If the query is ever nested under a subquery or CTE, Drizzle may auto-alias (`"reservations" AS "r0"`) and the raw fragment would no longer bind.
- The sibling method `getRevenueTrend` also uses `sql.raw` for the bucket expression, but with a comment explaining why (avoiding a PgColumn serialization cycle). `getPaymentDistribution` has no such constraint — the two extra `eq()` predicates can be expressed with the typed API, which the same composite/secondary indexes still honor.

**Fix:** Replace the raw fragment with composed typed predicates.
```ts
const rows = await this.db
  .select({
    method: payments.method,
    count: sql<number>`count(*)::int`,
  })
  .from(payments)
  .innerJoin(reservations, eq(payments.reservationId, reservations.id))
  .where(
    and(
      eq(reservations.status, 'CONFIRMED'),
      eq(payments.status, 'DONE'),
      gte(reservations.createdAt, startUtc),
      lt(reservations.createdAt, endUtc),
    ),
  )
  .groupBy(payments.method)
  .orderBy(sql`count(*) desc`);
```
The unit test (`admin-dashboard.service.spec.ts` `'payment'` block) asserts that `CONFIRMED` and `DONE` appear in the serialized WHERE; after the rewrite, update the serialized-args assertion to match the Drizzle AST structure (or add a minimal integration test that joins real tables and verifies the grouping).

---

## Info

### IN-01: period validation uses full-object zod schema — prefer per-key pipe

**File:** `apps/api/src/modules/admin/admin-dashboard.controller.ts:33-51`
**Issue:** `@Query(new ZodValidationPipe(periodQuerySchema)) query: { period: DashboardPeriod }` validates the whole query object. This is currently correct because `periodQuerySchema` is `z.object({ period: … })`, but it couples the handler signature to schema shape and makes the manual type annotation on `query` easy to desync. Other controllers in the repo follow the same pattern, so this is a codebase-wide info item, not a Phase 11 regression.

**Fix (optional):**
```ts
@Get('revenue')
async getRevenue(
  @Query('period', new ZodValidationPipe(dashboardPeriodSchema.default('30d')))
  period: DashboardPeriod,
) {
  return this.service.getRevenueTrend(period);
}
```

---

### IN-02: `useDashboardRevenue` / `Genre` / `Payment` skip URLSearchParams encoding

**File:** `apps/web/hooks/use-admin-dashboard.ts:31-33, 42-44, 54-56`
**Issue:** `period` is a narrow literal (`'7d'|'30d'|'90d'`), so direct interpolation is safe — but using `URLSearchParams` is a cheap regression-proof habit if the type is ever widened to a free string.

**Fix:**
```ts
const search = new URLSearchParams({ period }).toString();
apiClient.get<DashboardRevenueDto>(`/api/v1/admin/dashboard/revenue?${search}`);
```

---

### IN-03: `TopPerformancesTable` uses `<img>` instead of `next/image`

**File:** `apps/web/components/admin/dashboard/top-performances-table.tsx:91-96`
**Issue:** The poster cell disables the `@next/next/no-img-element` ESLint rule and uses a raw `<img>` with `alt=""`. Two independent improvements:
1. Next 16 `Image` gives LCP/bandwidth wins and also enforces the configured `images.remotePatterns` allow-list (`apps/web/next.config.ts:64`). Confirm R2 domain is included before switching.
2. `alt=""` marks the image as decorative, but here it sits next to the title column in a ranking table and conveys identity — `alt={\`${row.title} 포스터\`}` is more WCAG 1.1.1-appropriate.

**Fix:**
```tsx
import Image from 'next/image';
<Image
  src={row.posterUrl}
  alt={`${row.title} 포스터`}
  width={40}
  height={40}
  className="h-10 w-10 rounded object-cover"
/>
```

---

### IN-04: `PaymentBarChart` XAxis label can mix Korean/English depending on data source

**File:** `apps/web/components/admin/dashboard/payment-bar-chart.tsx:31-39`
**Issue:** `payments.method` is `varchar(50)` with no canonical set. Production Toss Payments responses typically use Korean (`카드`, `간편결제`), while some seed/mock data uses English (`card`). The chart renders the raw value on the X axis, so display consistency depends entirely on upstream ingestion.

**Fix:** Add a shared `METHOD_LABEL` map in `packages/shared` and transform `data` before passing to the chart.

---

### IN-05: `(status, created_at)` composite index referenced in comments doesn't exist

**File:** `apps/api/src/modules/admin/admin-dashboard.service.ts:42-46`, `apps/api/src/modules/admin/kst-boundary.ts:6`
**Issue:** Comments across the service and KST-boundary helper claim the WHERE shape is chosen to use the `(status, created_at)` composite index, but `apps/api/src/database/schema/reservations.ts:22-28` only defines single-column indexes (`idx_reservations_status`, etc.). The current queries still work, but the comments are misleading and the production latency claim in the Phase 11 research doc overstates performance. v1 performance is explicitly out of scope for review, so this is Info.

**Fix:** Either add the composite index via a new Drizzle migration (`index('idx_reservations_status_created_at').on(table.status, table.createdAt)`) or update the comments to reflect the actual index coverage (`idx_reservations_status` only).

---

### IN-06: `kstBoundaryToUtc(days)` has no input guard

**File:** `apps/api/src/modules/admin/kst-boundary.ts:29`
**Issue:** All current call sites pass validated enum-derived integers (`7`, `30`, `90`) or the module constant `TOP_PERFORMANCES_WINDOW_DAYS = 30`, so there is no live exposure. Negative or non-integer values would pass silently and produce a backwards/empty range. Since the helper is exported for potential reuse, a defensive `Number.isInteger(days) && days >= 0 && days <= 366` check is cheap insurance.

---

### IN-07: drizzle chain mock proxy handles only `then` — potential vitest-upgrade flake

**File:** `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts:19-29`
**Issue:** `createChainMock` returns a Proxy whose `get` trap treats every non-`then` property (including `Symbol.toStringTag`, `Symbol.iterator`, `catch`, `finally`) as a chainable callable. Current tests pass, but:
- vitest/jest internals that introspect the returned object (e.g., `expect(...).toHaveBeenCalled`, Proxy diffing on failure) can accidentally follow the proxy into infinite chain expansion on a later vitest version.
- `Promise.allSettled`-style code added in the future would silently hang because rejection isn't plumbed.

This is downgraded from the prior WR-04 to Info — the unit suite is green and service behavior is covered more authoritatively by the testcontainers integration spec (`apps/api/test/admin-dashboard.integration.spec.ts`).

**Fix (if touched again):** return `undefined` for Symbol keys and wire `reject` into the `then` function:
```ts
get(_t, prop) {
  if (prop === 'then') {
    return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      try { resolve(resolvedValue); } catch (e) { reject?.(e); }
    };
  }
  if (typeof prop === 'symbol') return undefined;
  return () => new Proxy({}, handler);
}
```

---

## Notes on post-review fixes

- **`fc68183` chart palette on `:root`** — verified: the mirrored `--chart-1..5` declarations live in a plain `:root` block (globals.css:110-116) directly under the `@theme` block, with an explanatory comment and a sync-invariant note. All five chart components read these via `var(--chart-N)`. Correct Tailwind v4 behavior: `@theme` only auto-promotes namespaced token families (`--color-*`, `--spacing-*`, …) to `:root`, so non-namespaced families must be re-declared. No findings.
- **`68d4af0` radio role for period-filter E2E** — verified: Radix `ToggleGroup` with `type="single"` exposes items as `role="radio"` grouped under `role="radiogroup"`. The updated spec uses `getByRole('group', { name: '기간 선택' }).getByRole('radio', { name: '7일' })`, which matches the DOM produced by `components/ui/toggle-group.tsx`. No findings.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
