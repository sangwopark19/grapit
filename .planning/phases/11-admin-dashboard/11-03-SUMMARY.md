---
phase: 11-admin-dashboard
plan: 03
subsystem: admin-dashboard
tags: [admin, dashboard, frontend, shadcn, recharts, tanstack-query]
requires:
  - "@grapit/shared dashboard schemas + DTO types (Plan 01)"
  - "/api/v1/admin/dashboard/* endpoints (Plan 02, Wave 2 parallel)"
  - "shadcn new-york preset + components.json @/components/ui alias"
  - "existing AdminStatCard + Skeleton + Button + Table primitives"
provides:
  - "shadcn Chart primitives (ChartContainer/ChartTooltip/ChartLegend) at @/components/ui/chart"
  - "shadcn ToggleGroup primitives at @/components/ui/toggle-group"
  - "globals.css @theme --chart-1~5 purple monochromatic palette (#6C3CE0/#8B6DE8/#B8A3EF/#D1D1DB/#A1A1AA)"
  - "admin-sidebar.tsx NAV_ITEMS with top-most 대시보드 entry (LayoutDashboard icon) + logo href /admin + isActive exact-match for /admin"
  - "ChartPanelState / SectionError common 3-mode state component (review MEDIUM 7)"
  - "useDashboardSummary/Revenue/Genre/Payment/Top10 TanStack Query hooks (staleTime 30_000, refetchOnWindowFocus false)"
  - "RevenueAreaChart / GenreDonutChart / PaymentBarChart with sr-only summary + isAnimationActive=false + motion-reduce class (review LOW 13)"
  - "TopPerformancesTable with 3-mode state delegation"
  - "PeriodFilter ToggleGroup (7d/30d/90d, aria-label='기간 선택')"
  - "/admin page composing KPI + 3 charts + Top 10 with pickMode 3-mode separation (loading/empty/error/data)"
affects:
  - "apps/web/app/globals.css (+5 chart palette lines in @theme block)"
  - "apps/web/package.json (+recharts 3.8.0 transitive, +react-is 19.1.0, +@radix-ui/react-toggle-group via shadcn)"
  - "apps/web/components/ui/card.tsx (shadcn CLI import path normalization side-effect)"
  - "apps/web/components/admin/admin-sidebar.tsx (NAV + logo + isActive diff)"
  - "pnpm-lock.yaml (recharts + react-is + @radix-ui/react-toggle-group + react-toggle deps)"
tech-stack:
  added:
    - "recharts 3.8.0"
    - "@radix-ui/react-toggle-group (via shadcn toggle-group)"
    - "@radix-ui/react-toggle (transitive for toggle-group)"
    - "react-is 19.1.0 (Pitfall 1 workaround)"
  patterns:
    - "3-mode common state component (ChartPanelState) to prevent error/empty copy merging — review MEDIUM 7"
    - "pickMode helper to enforce discriminated union at the page level (isLoading -> loading, isError -> error, empty data -> empty, else data)"
    - "All charts use isAnimationActive={false} + motion-reduce:[&_*]:!transition-none for prefers-reduced-motion — review LOW 13"
    - "Each chart ships a sr-only summary describing bucket count + totals for screen readers"
    - "TanStack Query per-endpoint useQuery with staleTime 30_000 (half of server 60s TTL) + refetchOnWindowFocus false (prevents skeleton flash)"
    - "Sidebar isActive uses exact match for /admin, startsWith for nested admin routes (prevents all admin pages highlighting dashboard NAV)"
key-files:
  created:
    - "apps/web/components/ui/chart.tsx"
    - "apps/web/components/ui/toggle-group.tsx"
    - "apps/web/components/ui/toggle.tsx"
    - "apps/web/components/admin/dashboard/_state.tsx"
    - "apps/web/hooks/use-admin-dashboard.ts"
    - "apps/web/components/admin/dashboard/revenue-area-chart.tsx"
    - "apps/web/components/admin/dashboard/genre-donut-chart.tsx"
    - "apps/web/components/admin/dashboard/payment-bar-chart.tsx"
    - "apps/web/components/admin/dashboard/top-performances-table.tsx"
    - "apps/web/components/admin/dashboard/period-filter.tsx"
    - "apps/web/app/admin/page.tsx"
  modified:
    - "apps/web/app/globals.css"
    - "apps/web/components/admin/admin-sidebar.tsx"
    - "apps/web/components/ui/card.tsx"
    - "apps/web/package.json"
    - "pnpm-lock.yaml"
decisions:
  - "react-is@19.1.0 explicitly pinned as direct dep to preempt Pitfall 1 (recharts transitive mismatch) even though not strictly required at install time — insurance for React 19 ecosystem churn"
  - "globals.css --chart-1~5 injected into existing @theme block (not :root) because this project uses Tailwind CSS v4 CSS-first config — shadcn CLI did not auto-inject because @theme pattern, so manual edit was required"
  - "admin-sidebar logo text-lg → text-sm per UI-SPEC Typography contract (even though sidebar is technically out of UI-SPEC grep scope) — one-time alignment for consistency"
  - "pickMode helper isolated as plain function (not a custom hook) to avoid useQuery rules-of-hooks trap and keep state derivation pure"
  - "No AlertDialog, no destructive action UI (UI-SPEC: dashboard is read-only this phase)"
metrics:
  duration: "~6min"
  completed: "2026-04-20"
  tasks: 3
  files_created: 11
  files_modified: 5
  loc_added: 1541
---

# Phase 11 Plan 03: Wave 2 Web — admin dashboard composition Summary

**One-liner:** `/admin` 랜딩을 읽기 전용 대시보드로 전환. shadcn Chart/ToggleGroup 설치, purple-monochromatic --chart 팔레트 오버라이드, 5개 TanStack Query 훅 + ChartPanelState 3-mode 공통 컴포넌트 + 3종 차트(area/donut/bar) + Top 10 테이블 + 기간 필터 + 사이드바 NAV 2-line diff를 추가해 Wave 3(E2E)가 소비할 UI를 확정.

## Outcome

Plan 02 (backend) 병렬 실행을 가정한 Wave 2 web 레이어가 typecheck/lint GREEN 상태로 완성되었다.

- `/admin` 타이핑 또는 사이드바 로고 클릭 시 대시보드 랜딩이 렌더링된다 (D-01, D-02).
- 사이드바 NAV_ITEMS 최상단에 '대시보드' 엔트리가 LayoutDashboard 아이콘과 함께 추가되고, isActive 로직이 /admin은 exact match, 하위 경로는 startsWith로 분기되어 다른 admin 페이지에서 대시보드 NAV가 잘못 하이라이트되지 않는다 (D-03).
- KPI 4장 (오늘 예매수 / 오늘 매출 / 오늘 취소 / 활성 공연), 매출 추이 area chart, 장르 donut, 결제수단 bar, 인기 공연 Top 10 테이블, 7/30/90일 ToggleGroup이 페이지에 합성되어 있다.
- 7/30/90일 클릭 시 revenue/genre/payment 3개 쿼리가 period key 변경으로 동시 refetch된다 (D-11). Top 10은 period 영향 없이 고정 30일 (D-10).
- 차트 3종이 `var(--chart-1)` ~ `var(--chart-5)`의 purple-monochromatic 팔레트를 사용 (UI-SPEC).
- 모든 신규 client 컴포넌트(6개 dashboard 파일 + hook 파일)에 `'use client'` 지시어 존재 (Pitfall 3).
- recharts 3.8.0 pinned, react-is 19.1.0 직접 의존성에 추가 (Pitfall 1 사전 대비).
- 공통 `ChartPanelState` 컴포넌트가 loading/empty/error 3 모드를 명시적으로 분리해 review MEDIUM 7 "error가 empty에 흡수되는 문제"를 차단. Page 레벨에서는 `pickMode` 헬퍼가 4가지 상태(loading/empty/error/data)를 반환해 `isError || empty` 병합을 구조적으로 금지.
- 각 차트가 sr-only 요약(bucket 개수, 총합)을 제공하고 `isAnimationActive={false}` + `motion-reduce:[&_*]:!transition-none`로 `prefers-reduced-motion`을 존중 (review LOW 13).

## What Was Built

### Task 03-01 — shadcn chart + toggle-group 설치, --chart palette, 사이드바 diff

- `pnpm dlx shadcn@latest add chart toggle-group` 실행:
  - `apps/web/components/ui/chart.tsx` (374 lines) 생성
  - `apps/web/components/ui/toggle-group.tsx` (83 lines) 생성
  - `apps/web/components/ui/toggle.tsx` (47 lines) 생성 (toggle-group 의존)
  - `recharts@3.8.0` + `@radix-ui/react-toggle-group` + `@radix-ui/react-toggle` 의존성 자동 추가
  - `pnpm-lock.yaml` 자동 업데이트
  - CLI 부수 효과로 `components/ui/card.tsx`의 import 경로가 `@/lib` → `@/lib/index`로 정규화됨 (기능 동일)
- `pnpm add react-is@19.1.0` 직접 의존성 추가 (Pitfall 1 대비)
- `apps/web/app/globals.css`의 `@theme` 블록 끝에 chart palette 5 라인 수동 추가:
  ```css
  --chart-1: #6C3CE0;
  --chart-2: #8B6DE8;
  --chart-3: #B8A3EF;
  --chart-4: #D1D1DB;
  --chart-5: #A1A1AA;
  ```
  shadcn CLI가 `:root`에 주입하려 했지만 이 프로젝트는 Tailwind CSS v4 CSS-first config(`@theme` 블록)를 사용하므로 `:root` 주입이 발생하지 않았다 → 수동 edit이 정답 경로.
- `apps/web/components/admin/admin-sidebar.tsx` 3-diff 적용:
  - `lucide-react` import에 `LayoutDashboard` 추가
  - `NAV_ITEMS` 최상단에 `{ label: '대시보드', href: '/admin', icon: LayoutDashboard }` 삽입
  - 로고 Link `href="/admin/performances"` → `href="/admin"`, `text-lg` → `text-sm` (UI-SPEC Typography)
  - isActive 로직: `item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)` — dashboard NAV가 /admin/* 하위 경로에서 오탐되지 않도록
- **Verify:** `pnpm --filter @grapit/web lint` → 0 errors (18 pre-existing warnings)

### Task 03-02 — ChartPanelState + use-admin-dashboard.ts 훅 + 5개 dashboard 컴포넌트

- `apps/web/components/admin/dashboard/_state.tsx` (77 lines): `ChartPanelState` (mode='loading' | 'empty' | 'error' prop-based switcher, optional onRetry) + `SectionError` (KPI row 전용) 2개 export. empty/error 카피가 모드에 따라 명확히 분기된다 (review MEDIUM 7 대응).
- `apps/web/hooks/use-admin-dashboard.ts` (73 lines): `useDashboardSummary/Revenue/Genre/Payment/Top10` 5개 `useQuery` 훅. 모두 `staleTime: 30_000` + `refetchOnWindowFocus: false`. revenue/genre/payment는 `period` 파라미터를 queryKey에 포함해 D-11 "3차트 동시 refetch"를 TanStack Query cache invalidation 없이 자연스럽게 달성.
- `revenue-area-chart.tsx` (70 lines): recharts AreaChart + linearGradient fill + `var(--chart-1)` stroke + sr-only 요약.
- `genre-donut-chart.tsx` (63 lines): PieChart + `innerRadius=60/outerRadius=100` donut + 5-색 PALETTE rotation + sr-only 요약.
- `payment-bar-chart.tsx` (51 lines): BarChart + `var(--chart-1)` fill + `radius=[4,4,0,0]` + sr-only 요약.
- 3개 차트 모두 `isAnimationActive={false}` + `motion-reduce:[&_*]:!transition-none` 클래스 (review LOW 13).
- `top-performances-table.tsx` (117 lines): 순위/포스터(thumbnail fallback)/공연명/장르/예매수 5-column 테이블. 3-mode(loading skeleton rows / empty ChartPanelState / error ChartPanelState+retry)를 ChartPanelState 공통 컴포넌트로 delegates. UI-SPEC Copywriting verbatim ("아직 인기 공연이 없습니다" / "최근 30일 예매가 누적되면 랭킹이 표시됩니다").
- `period-filter.tsx` (26 lines): shadcn `ToggleGroup type="single"` + `aria-label="기간 선택"` + 7일/30일/90일 ToggleGroupItem.
- **UI-SPEC Typography 스캔:** `grep -rE "text-base|text-lg|text-2xl|text-3xl|font-medium|font-bold" apps/web/components/admin/dashboard/` → 0 matches.
- **Verify:** `pnpm --filter @grapit/web typecheck` → 0 exit (shared package 사전 빌드 후).

### Task 03-03 — /admin/page.tsx 대시보드 composition

- `apps/web/app/admin/page.tsx` (235 lines, `'use client'`): `AdminDashboardPage` default export.
- 5개 useQuery 훅 호출 (summary/revenue/genre/payment/top10), period 기본값 `useState<DashboardPeriod>('30d')`.
- `pickMode<T>` helper: `(query, isEmpty) → 'loading' | 'empty' | 'error' | 'data'` — `isError || empty` 병합 구조적 방지 (review MEDIUM 7).
- Composition 순서: `<header>` (h1 '대시보드' + 서브카피) → KPI row `<section aria-labelledby="kpi-heading">` (grid-cols-2 lg:grid-cols-4, SectionError on isError) → Revenue area `<section>` (TrendingUp icon + PeriodFilter + 매출 추이 + "최근 {N}일 기준" subcopy) → Genre/Payment 2-col grid (PieChart/CreditCard icons) → Top 10 `<section>` (Trophy icon + "최근 30일 예매 건수 기준" subcopy).
- KPI 카피 UI-SPEC verbatim: 오늘 예매수 / 오늘 매출 / 오늘 취소 / 활성 공연. Icons: Ticket / Banknote / RotateCcw / Theater.
- **UI-SPEC Typography 스캔:** 0 matches for `text-base|text-lg|text-2xl|text-3xl|font-medium|font-bold`.
- **isError || 병합 스캔:** 0 matches.
- **Verify:** `pnpm --filter @grapit/web typecheck` + `pnpm --filter @grapit/web lint` → 0 errors (18 pre-existing warnings unchanged).

## Files Changed

**Created (11):**
- `apps/web/components/ui/chart.tsx`
- `apps/web/components/ui/toggle-group.tsx`
- `apps/web/components/ui/toggle.tsx`
- `apps/web/components/admin/dashboard/_state.tsx`
- `apps/web/hooks/use-admin-dashboard.ts`
- `apps/web/components/admin/dashboard/revenue-area-chart.tsx`
- `apps/web/components/admin/dashboard/genre-donut-chart.tsx`
- `apps/web/components/admin/dashboard/payment-bar-chart.tsx`
- `apps/web/components/admin/dashboard/top-performances-table.tsx`
- `apps/web/components/admin/dashboard/period-filter.tsx`
- `apps/web/app/admin/page.tsx`

**Modified (5):**
- `apps/web/app/globals.css` (+5 `--chart-*` token lines in `@theme`)
- `apps/web/components/admin/admin-sidebar.tsx` (NAV + logo href + isActive diff)
- `apps/web/components/ui/card.tsx` (shadcn CLI import path normalization)
- `apps/web/package.json` (+recharts 3.8.0, +react-is 19.1.0, +@radix-ui/react-toggle-group)
- `pnpm-lock.yaml` (auto-updated)

## Commits

- `5bca2b1` — feat(11-03): install shadcn chart + toggle-group, purple palette, sidebar dashboard entry
- `50ebe8d` — feat(11-03): admin dashboard hooks + components (ChartPanelState, charts, table, filter)
- `faada0d` — feat(11-03): /admin landing dashboard composition with 3-mode state separation

## Verification Status

| Check | Status | Detail |
|-------|--------|--------|
| `test -f apps/web/components/ui/chart.tsx` | PASS | 374 lines |
| `test -f apps/web/components/ui/toggle-group.tsx` | PASS | 83 lines |
| `grep "recharts" apps/web/package.json` | PASS | `"recharts": "3.8.0"` |
| `grep "#6C3CE0" apps/web/app/globals.css` | PASS | purple palette injected into @theme |
| `grep "LayoutDashboard" admin-sidebar.tsx` | PASS | imported + used in NAV_ITEMS |
| `pnpm --filter @grapit/web typecheck` | PASS | 0 exit |
| `pnpm --filter @grapit/web lint` | PASS | 0 errors, 18 pre-existing warnings (unchanged) |
| `'use client'` scan (6 files dashboard + 1 hook) | PASS | all 7 files start with directive |
| sr-only summary in 3 charts | PASS | grep `sr-only` matches 1 per file |
| `isAnimationActive={false}` / `motion-reduce` in 3 charts | PASS | both present per file |
| UI-SPEC Typography scan (dashboard/ + page.tsx) | PASS | 0 matches for text-base/text-lg/text-2xl/text-3xl/font-medium/font-bold |
| `isError || ` merge scan | PASS | 0 matches |
| 5 hook exports | PASS | useDashboardSummary/Revenue/Genre/Payment/Top10 |
| staleTime 30_000 + refetchOnWindowFocus false | PASS | all 5 hooks |
| Period filter aria-label + 7일/30일/90일 copy | PASS | verbatim |
| Top 10 empty copy verbatim | PASS | "아직 인기 공연이 없습니다" + "최근 30일 예매가 누적되면 랭킹이 표시됩니다" |

## Deviations from Plan

None — plan executed exactly as written.

**Minor explanatory notes (not deviations):**
1. **card.tsx side-effect**: shadcn CLI auto-normalized its import `@/lib` → `@/lib/index` when re-processing ui components. Semantically identical (the `@/lib` alias resolves to `lib/index.ts`). Committed with Task 03-01.
2. **globals.css @theme vs :root**: shadcn CLI expected to inject `--chart-1~5` into `:root`, but this project uses Tailwind CSS v4 CSS-first config (`@theme` block). CLI did not auto-inject — manual edit into `@theme` was required (and was already anticipated by the plan).
3. **shared package build requirement**: First `typecheck` attempt after hooks creation showed `Cannot find module 'zod'` + other pre-existing errors. Root cause: `packages/shared/dist` was missing and root `node_modules` was partially populated. Resolved by running `pnpm install` + `pnpm --filter @grapit/shared build` (standard workspace workflow per CLAUDE.md conventions). Not a code deviation — tooling bootstrap step.

## Authentication Gates

None — this plan is frontend-only (page composition, hooks, UI primitives) and did not touch any authenticated runtime paths that would require login during execution. Playwright E2E (Plan 04) handles `loginAsTestUser(admin@grapit.test)` via existing seed.

## Threat Flags

None. The plan's declared threats (T-11-08 EoP on /admin, T-11-09 InfoDisc on posterUrl, T-11-10 Tampering on period) remain as designed:

- T-11-08: Dashboard page relies on existing `apps/web/app/admin/layout.tsx` `useAuthStore` guard (user.role !== 'admin' → redirect). **No change made to guard.**
- T-11-09: `posterUrl` in TopPerformancesTable is rendered via a plain `<img>` tag just like the rest of the admin booking table; posterUrl is already public CDN (Phase 8). No new surface.
- T-11-10: `period` state is a `useState<DashboardPeriod>('30d')` client value. Backend `dashboardPeriodSchema` zod enum (Plan 01) rejects anything outside `'7d'|'30d'|'90d'` with 400; frontend does not additionally validate (by design — API is trust boundary).

No new network surface introduced. No new auth paths. No schema changes.

## Known Stubs

None — all data paths wire through TanStack Query hooks to the real `/api/v1/admin/dashboard/*` endpoints (implemented by Plan 02 in the same Wave 2). Page-level state transitions (loading / empty / error / data) are all genuine.

Note: When Plan 02 is still in flight at runtime during Wave 2 parallel execution, endpoints may 404/500 — but this is the expected "error" mode of the dashboard and renders the 다시 시도 button correctly via ChartPanelState.

## Self-Check: PASSED

**Files verified (on disk):**
- FOUND: apps/web/components/ui/chart.tsx
- FOUND: apps/web/components/ui/toggle-group.tsx
- FOUND: apps/web/components/ui/toggle.tsx
- FOUND: apps/web/components/admin/dashboard/_state.tsx
- FOUND: apps/web/hooks/use-admin-dashboard.ts
- FOUND: apps/web/components/admin/dashboard/revenue-area-chart.tsx
- FOUND: apps/web/components/admin/dashboard/genre-donut-chart.tsx
- FOUND: apps/web/components/admin/dashboard/payment-bar-chart.tsx
- FOUND: apps/web/components/admin/dashboard/top-performances-table.tsx
- FOUND: apps/web/components/admin/dashboard/period-filter.tsx
- FOUND: apps/web/app/admin/page.tsx

**Modified files verified (git log):**
- FOUND: apps/web/app/globals.css (in 5bca2b1)
- FOUND: apps/web/components/admin/admin-sidebar.tsx (in 5bca2b1)
- FOUND: apps/web/components/ui/card.tsx (in 5bca2b1)
- FOUND: apps/web/package.json (in 5bca2b1)
- FOUND: pnpm-lock.yaml (in 5bca2b1)

**Commits verified (in git log):**
- FOUND: 5bca2b1 feat(11-03): install shadcn chart + toggle-group, purple palette, sidebar dashboard entry
- FOUND: 50ebe8d feat(11-03): admin dashboard hooks + components (ChartPanelState, charts, table, filter)
- FOUND: faada0d feat(11-03): /admin landing dashboard composition with 3-mode state separation
