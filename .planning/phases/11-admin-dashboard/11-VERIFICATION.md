---
phase: 11-admin-dashboard
verified: 2026-04-20T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (roadmap success criteria), 11 human verification items pending
overrides_applied: 0
requirements_checked:
  - ADM-01
  - ADM-02
  - ADM-03
  - ADM-04
  - ADM-05
  - ADM-06
human_verification:
  - test: "라우팅 & 사이드바 상호작용"
    expected: "/admin 접근 시 대시보드 렌더, 사이드바 '대시보드' NAV 최상단 + LayoutDashboard 아이콘, 로고 클릭 시 /admin 이동, /admin/performances 이동 시 exact-match 하이라이트 해제"
    why_human: "navigation 렌더와 active state 시각적 확인은 실제 브라우저에서만 관찰 가능"
  - test: "KPI 카드 시각 렌더 (ADM-01)"
    expected: "KPI 4장 (오늘 예매수/매출/취소/활성 공연) + lucide 아이콘 + skeleton → 실제 값 전환 + 매출 ₩ + 천단위 구분"
    why_human: "format 함수의 시각적 출력과 transition 애니메이션은 실제 렌더링 필요"
  - test: "차트 렌더 (Pitfall 1 실측)"
    expected: "area/donut/bar 3개 차트가 실제 보라 팔레트로 렌더 + DevTools Elements에서 각 <svg> 자식 노드 > 0 (recharts blank regression 미발생)"
    why_human: "recharts 3.8.x + React 19 런타임 회귀는 정적 코드 검사로 잡을 수 없음. chart-blank-guard E2E 테스트가 작성되어 있으나 실행은 유예됨"
  - test: "UI-SPEC 색상 (Chart palette)"
    expected: "Area stroke/fill #6C3CE0 / donut 5단계 보라 gradient / shadcn 기본 oklch rainbow 색상 미노출"
    why_human: "색상 시각적 판단은 자동화 불가"
  - test: "기간 필터 (D-09, D-11)"
    expected: "7/30/90일 토글 + 초기 30일 / 7일 클릭 시 revenue/genre/payment 3개 요청 period=7d 동시 발생 / Top10은 30d 고정 / 90일 area chart x축 YYYY-WNN 주별 포맷"
    why_human: "period state 변경 → 3개 query refetch 동시성 + x축 포맷 시각 확인 필요"
  - test: "Top 10 렌더 (ADM-04)"
    expected: "컬럼 순위/포스터/공연명/장르/예매수 + desc 정렬 / 데이터 없을 때 empty 카피 + 서브카피 '최근 30일 예매 건수 기준'"
    why_human: "테이블 정렬 동작과 empty 상태 전환은 실제 데이터 환경에서 관찰"
  - test: "캐시 관찰 (ADM-06)"
    expected: "첫 로드 대비 새로고침 시 response time 현저히 짧아짐 / 60초 후 캐시 expire / CacheService 로그에 key만 노출"
    why_human: "Valkey round-trip 성능 차이와 TTL expire 관찰은 실행 환경 필요"
  - test: "비관리자 접근 차단 (T-11-03) - 브라우저 redirect"
    expected: "비로그인 curl → 401/403 / 일반 유저 /admin → /로 redirect (layout.tsx guard)"
    why_human: "controller access-control 자동화(3/3 PASS)는 완료. layout guard redirect는 브라우저 환경 필요"
  - test: "UI-SPEC Typography + Error/Empty 분리 (review MEDIUM 7/8) - 브라우저 검증"
    expected: "<h1>대시보드</h1> text-xl font-semibold / offline 시 'error' 카피와 'empty' 카피 별도 렌더 / '다시 시도' 버튼 클릭 refetch"
    why_human: "정적 스캔(0 violations)은 완료. error→retry refetch 동작은 브라우저 상호작용 필요"
  - test: "a11y (review LOW 13)"
    expected: "VoiceOver로 각 차트 sr-only 요약 읽힘 / Reduce Motion 활성화 시 차트 진입 애니메이션 스킵"
    why_human: "스크린리더 읽기 실측과 OS Reduce Motion 대응은 실제 환경에서만 관찰 가능"
  - test: "E2E 4개 실행 (Task 04-01 이월)"
    expected: "pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts → 4 passed (landing-smoke / period-filter / sidebar-nav / chart-blank-guard)"
    why_human: "Task 04-01 자동 검증에서 로컬 API 서버 미기동으로 E2E 실행 유예됨. 수동 환경 구성 후 실행 필요"
---

# Phase 11: 어드민 대시보드 Verification Report

**Phase Goal:** 관리자가 대시보드에서 예매/매출/장르 통계를 한눈에 파악하고 운영 의사결정을 내릴 수 있다
**Verified:** 2026-04-20T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 관리자가 /admin 대시보드에서 오늘의 예매 수, 매출, 취소 건수, 활성 공연 수를 확인 | VERIFIED | `apps/web/app/admin/page.tsx:86-112` — 4개 AdminStatCard (오늘 예매수/매출/취소/활성 공연). API: `admin-dashboard.service.ts:70-110` 4-way Promise.all fan-out (count/sum/count/count). Unit spec `summary` GREEN. |
| 2 | 일별/주별 매출 추이를 area chart로 시각화하여 트렌드 파악 가능 | VERIFIED | `apps/web/components/admin/dashboard/revenue-area-chart.tsx` AreaChart + linearGradient. API `admin-dashboard.service.ts:113-160` granularity day/week 분기 + bucket skeleton merge (빈 날짜/주 0 채움). Unit `revenue-weekly` + integration `revenue-daily` GREEN. |
| 3 | 장르별 예매 분포(donut)와 결제수단 분포(bar)가 차트로 표시 | VERIFIED | `genre-donut-chart.tsx` PieChart innerRadius=60/outerRadius=100. `payment-bar-chart.tsx` BarChart. API getGenreDistribution / getPaymentDistribution 구현. Unit specs `genre` + `payment` GREEN. |
| 4 | 인기 공연 Top 10 랭킹이 표시되어 운영 우선순위 판단 가능 | VERIFIED | `top-performances-table.tsx` 순위/포스터/공연명/장르/예매수 5열. API getTopPerformances LIMIT 10 desc (30일 고정). Integration spec `top10` GREEN. |
| 5 | 통계 쿼리 결과가 Valkey에 캐싱되어 대시보드 로딩이 빠름 | VERIFIED | `admin-dashboard.service.ts:60-67` readThrough<T> 헬퍼 + `cache.set(key, value, 60)` 5개 엔드포인트 모두 래핑. 키 `cache:admin:dashboard:{summary,revenue:${period},genre:${period},payment:${period},top10}`. Unit specs `cache-hit`/`cache-set-ttl`/`cache-degradation` GREEN. |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/schemas/admin-dashboard.schema.ts` | dashboardPeriodSchema + DashboardPeriod + periodQuerySchema | VERIFIED | 9 lines, exports 3 symbols, `enum(['7d','30d','90d']).default('30d')` |
| `packages/shared/src/types/admin-dashboard.types.ts` | 5 DTO types | VERIFIED | 35 lines, exports DashboardSummaryDto/RevenueDto/GenreDto/PaymentDto/TopDto + 4 bucket types |
| `packages/shared/src/index.ts` | re-export | VERIFIED | lines 6, 13 include schema + types re-exports |
| `apps/api/src/modules/admin/kst-boundary.ts` | kstBoundaryToUtc + helpers | VERIFIED | 104 lines, exports kstBoundaryToUtc/kstTodayBoundaryUtc/buildDailyBucketSkeleton/buildWeeklyBucketSkeleton |
| `apps/api/src/modules/admin/admin-dashboard.service.ts` | 5 methods + readThrough + 60s TTL | VERIFIED | 249 lines, `throw new Error('Not implemented')` 0건, readThrough + `DASHBOARD_CACHE_TTL=60`, 5개 cache key 확인, WHERE 절 raw createdAt 비교 (review MEDIUM 4) |
| `apps/api/src/modules/admin/admin-dashboard.controller.ts` | 5 @Get routes + guards | VERIFIED | 57 lines, `@Controller('admin/dashboard') + @UseGuards(RolesGuard) + @Roles('admin')`, 5 `@Get` handler, 3개 route에 ZodValidationPipe(periodQuerySchema) |
| `apps/api/src/modules/admin/admin.module.ts` | DI wiring | VERIFIED | controllers/providers 배열에 AdminDashboardController/Service 등록 |
| `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts` | 8 unit tests | VERIFIED | summary/kst-boundary/revenue-weekly/genre/payment/cache-hit/cache-set-ttl/cache-degradation 8 describe 확인, 실행 8/8 PASS |
| `apps/api/src/modules/admin/__tests__/admin-dashboard.controller.spec.ts` | 3 access-control tests | VERIFIED | 401/403/200 3 케이스 확인, 실행 3/3 PASS |
| `apps/api/test/admin-dashboard.integration.spec.ts` | 2 integration tests | VERIFIED | GenericContainer('postgres:16') + GenericContainer('valkey/valkey:8') + revenue-daily + top10 2개 테스트, 실행 2/2 PASS |
| `apps/web/hooks/use-admin-dashboard.ts` | 5 hooks | VERIFIED | useDashboardSummary/Revenue/Genre/Payment/Top10 5 exports, staleTime 30_000, refetchOnWindowFocus false |
| `apps/web/components/admin/dashboard/_state.tsx` | ChartPanelState 3-mode | VERIFIED | ChartPanelState + SectionError exports, mode='loading'|'empty'|'error' (review MEDIUM 7) |
| `apps/web/components/admin/dashboard/revenue-area-chart.tsx` | AreaChart + sr-only | VERIFIED | recharts AreaChart + linearGradient + sr-only + motion-reduce + isAnimationActive={false} |
| `apps/web/components/admin/dashboard/genre-donut-chart.tsx` | PieChart | VERIFIED | PieChart innerRadius=60/outerRadius=100 + PALETTE 5색 rotation + sr-only + motion-reduce |
| `apps/web/components/admin/dashboard/payment-bar-chart.tsx` | BarChart | VERIFIED | BarChart + var(--chart-1) + radius + sr-only + motion-reduce |
| `apps/web/components/admin/dashboard/top-performances-table.tsx` | 3-mode Top10 table | VERIFIED | 5-col Table + loading skeleton + empty/error via ChartPanelState |
| `apps/web/components/admin/dashboard/period-filter.tsx` | ToggleGroup 7/30/90d | VERIFIED | ToggleGroup type="single" + aria-label="기간 선택" + 7일/30일/90일 |
| `apps/web/app/admin/page.tsx` | composition | VERIFIED | 'use client' + 5 hook 호출 + pickMode helper + 4 KPI + 3 chart sections + Top10, UI-SPEC Typography 0 위반 |
| `apps/web/components/admin/admin-sidebar.tsx` | dashboard NAV | VERIFIED | NAV_ITEMS 최상단 '대시보드' + LayoutDashboard 아이콘 + href='/admin' + exact-match isActive |
| `apps/web/app/globals.css` | --chart-1~5 purple | VERIFIED | lines 49-53 모든 5개 hex 값 확인 (#6C3CE0/#8B6DE8/#B8A3EF/#D1D1DB/#A1A1AA) |
| `apps/web/components/ui/chart.tsx` + `toggle-group.tsx` | shadcn primitives | VERIFIED | 2 files present (shadcn CLI 설치) |
| `apps/web/package.json` | recharts 3.8.0 + react-is 19.1.0 | VERIFIED | line 42 recharts@3.8.0, line 38 react-is@19.1.0 |
| `apps/web/e2e/admin-dashboard.spec.ts` | 4 E2E tests | VERIFIED | landing-smoke + period-filter + sidebar-nav + chart-blank-guard 4 tests + loginAsTestUser |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `admin-dashboard.service.ts` | `kst-boundary.ts` | import `kstBoundaryToUtc/kstTodayBoundaryUtc/buildDailyBucketSkeleton/buildWeeklyBucketSkeleton` | WIRED | lines 19-24 import 확인, 함수 본문에서 호출 |
| `admin-dashboard.service.ts` | `cache.service.ts` | constructor DI `@Inject(CacheService)` | WIRED | line 57 `@Inject(CacheService) private readonly cache: CacheService` |
| `admin-dashboard.service.ts` | `drizzle.provider.ts` | `@Inject(DRIZZLE)` | WIRED | line 56 `@Inject(DRIZZLE) private readonly db: DrizzleDB` |
| `admin-dashboard.controller.ts` | `roles.guard.ts` | `@UseGuards(RolesGuard) + @Roles('admin')` | WIRED | lines 19-20 |
| `admin-dashboard.controller.ts` | `@grapit/shared periodQuerySchema` | `new ZodValidationPipe(periodQuerySchema)` | WIRED | line 34/41/48 — revenue/genre/payment 3개 route에 적용 |
| `admin.module.ts` | `AdminDashboardController/Service` | controllers + providers 배열 | WIRED | lines 22, 28 |
| `admin.module.ts` | `PerformanceModule (CacheService export)` | imports 배열 | WIRED | line 16 |
| `apps/web/app/admin/page.tsx` | `use-admin-dashboard.ts` | 5 hook imports + calls | WIRED | lines 25-31 import + lines 55-59 호출 |
| `use-admin-dashboard.ts` | `/api/v1/admin/dashboard/*` | `apiClient.get` | WIRED | 5개 queryFn 각각 `/api/v1/admin/dashboard/{summary,revenue,genre,payment,top-performances}` |
| `apps/web/components/admin/admin-sidebar.tsx` | `/admin (dashboard)` | `NAV_ITEMS` + `LayoutDashboard` icon | WIRED | lines 5, 9-13 |
| `apps/web/app/admin/page.tsx` | `_state.tsx` | `ChartPanelState/SectionError` import | WIRED | lines 22-24 |
| `revenue-area-chart.tsx` | `@/components/ui/chart` | `ChartContainer/ChartTooltip` import | WIRED | lines 4-9 |
| `apps/web/e2e/admin-dashboard.spec.ts` | `helpers/auth.ts` | `loginAsTestUser` import | WIRED | line 2 |
| `apps/api/test/admin-dashboard.integration.spec.ts` | `testcontainers` | `new GenericContainer('postgres:16')` + `valkey/valkey:8` | WIRED | lines 42, 51 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `/admin/page.tsx` (KPI cards) | `summary.data` | `useDashboardSummary` → `apiClient.get('/api/v1/admin/dashboard/summary')` → `AdminDashboardService.getSummary` → Drizzle count/sum queries on reservations + performances | Yes (when API live) | FLOWING (pending runtime) |
| `revenue-area-chart.tsx` | `data` prop | page.tsx `revenue.data` → `useDashboardRevenue` → `/api/v1/admin/dashboard/revenue` → service.getRevenueTrend → Drizzle date_trunc SQL + bucket skeleton merge | Yes (skeleton 채움 포함) | FLOWING |
| `genre-donut-chart.tsx` | `data` prop | `useDashboardGenre` → `/api/v1/admin/dashboard/genre` → service.getGenreDistribution → innerJoin performances+showtimes+reservations + GROUP BY genre | Yes | FLOWING |
| `payment-bar-chart.tsx` | `data` prop | `useDashboardPayment` → `/api/v1/admin/dashboard/payment` → service.getPaymentDistribution → innerJoin payments+reservations + WHERE CONFIRMED AND DONE | Yes | FLOWING |
| `top-performances-table.tsx` | `data` prop | `useDashboardTop10` → `/api/v1/admin/dashboard/top-performances` → service.getTopPerformances → 30d fixed window + ORDER BY count desc LIMIT 10 | Yes | FLOWING |

**Data flow completeness:** 모든 5개 시각화 컴포넌트가 실제 DB 쿼리 결과를 consume하도록 wire됨. 하드코딩 empty prop 없음. Integration 테스트(2/2 PASS)가 실제 Postgres+Valkey 환경에서 end-to-end 데이터 흐름을 증명함.

### Behavioral Spot-Checks

execution_note에 기록된 자동 검증 결과:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| AdminDashboardService 8 unit tests | `vitest run admin-dashboard.service.spec.ts` | 8/8 PASS | PASS |
| Controller access-control (401/403/200) | `vitest run admin-dashboard.controller.spec.ts` | 3/3 PASS | PASS |
| Integration (Postgres+Valkey testcontainers) | `test:integration -- admin-dashboard.integration.spec.ts` | 2/2 PASS | PASS |
| Web typecheck | `pnpm --filter @grapit/web typecheck` | 0 exit | PASS |
| Web lint | `pnpm --filter @grapit/web lint` | 0 errors (18 pre-existing warnings) | PASS |
| UI-SPEC Typography scope scan | grep -rE "text-base\|text-lg\|text-2xl\|text-3xl\|font-medium\|font-bold" dashboard/ + page.tsx | 0 violations | PASS |
| Monorepo test suite | `pnpm test` | 383/383 PASS (API 273 + Web 110) | PASS |
| E2E (4 tests) | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` | deferred (API 서버 미기동) | SKIP → human_verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADM-01 | 11-01,02,03,04 | 오늘 요약 카드 (예매수/매출/취소/활성 공연) | SATISFIED | AdminStatCard 4장 + getSummary() Promise.all 4 쿼리 + unit `summary` GREEN |
| ADM-02 | 11-01,02,03,04 | 매출 추이 차트 (일별/주별 area chart) | SATISFIED | RevenueAreaChart + getRevenueTrend + bucket skeleton (review MEDIUM 6) + unit `revenue-weekly` + integration `revenue-daily` GREEN |
| ADM-03 | 11-01,02,03,04 | 장르별 예매 분포 (donut chart) | SATISFIED | GenreDonutChart + getGenreDistribution (innerJoin + GROUP BY genre) + unit `genre` GREEN |
| ADM-04 | 11-01,02,03,04 | 인기 공연 랭킹 Top 10 | SATISFIED | TopPerformancesTable + getTopPerformances (30d 고정 D-10, LIMIT 10) + integration `top10` GREEN |
| ADM-05 | 11-01,02,03,04 | 결제수단 분포 (bar chart) | SATISFIED | PaymentBarChart + getPaymentDistribution (CONFIRMED AND DONE, review MEDIUM 5) + unit `payment` GREEN |
| ADM-06 | 11-01,02,03,04 | 캐싱 + 집계 쿼리 최적화 | SATISFIED | readThrough<T> + cache.set(key, value, 60) + TTL-only (D-13) + raw createdAt WHERE (review MEDIUM 4) + unit `cache-hit`/`cache-set-ttl`/`cache-degradation` GREEN |

All 6 requirement IDs from plan frontmatter (ADM-01~06) accounted for in REQUIREMENTS.md (어드민 대시보드 섹션) and marked `Complete` in Traceability table. No orphaned requirements.

### Anti-Patterns Found

Scan targets: 4개 plan의 `files_modified` + `key-files.created` 전체 범위

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `admin-dashboard.service.ts` | — | `throw new Error('Not implemented')` | — | 0건 — Plan 02가 완전히 교체함 |
| all dashboard component files | — | `text-base\|text-lg\|text-2xl\|text-3xl\|font-medium\|font-bold` | — | 0건 — UI-SPEC Typography scope scan 통과 |
| `admin-dashboard.service.ts` | — | `this.cache.invalidate` 수동 호출 | — | 0건 (D-13 TTL-only 준수) |
| `admin-dashboard.service.ts` | — | `new Date().*setHours` (Cloud Run UTC trap) | — | 0건, kstBoundaryToUtc 헬퍼 사용 |
| `_state.tsx`, `page.tsx` | — | `isError \|\| empty` 병합 (review MEDIUM 7) | — | 0건, pickMode helper로 구조적 분리 |
| `apps/api/test/sms-throttle.integration.spec.ts` | — | 2 failed | Info | Phase 10/10.1 파생 사전 존재 이슈, Phase 11 미변경 파일 — **Out of Scope** |

**No blockers found.**

### Human Verification Required

Task 04-02 수동 QA가 `/gsd-verify-work 11`로 유예됨. 아래 11개 항목은 실제 런타임 환경에서 검증 필요:

1. **라우팅 & 사이드바 상호작용** — `/admin` 렌더 + '대시보드' NAV active 하이라이트 + 로고 /admin 이동 + 다른 admin 페이지에서 exact-match 해제.
2. **KPI 카드 시각 렌더 (ADM-01)** — skeleton→실제값 전환 + ₩ 심볼 + 천단위 구분.
3. **차트 렌더 (Pitfall 1 실측)** — recharts 3.8.x + React 19 회귀 체크. `<svg>` 내 자식 노드 > 0. (chart-blank-guard E2E 테스트는 작성되었으나 실행 유예)
4. **UI-SPEC 색상** — area stroke/fill #6C3CE0, donut 5단계 보라 gradient, shadcn oklch rainbow 미노출.
5. **기간 필터 (D-09, D-11)** — 7일 클릭 시 3개 요청 동시 발생, 90d x축 YYYY-WNN 포맷.
6. **Top 10 렌더** — 정렬/empty 카피 'Top 10' '최근 30일 예매 건수 기준' verbatim.
7. **캐시 관찰 (ADM-06)** — 새로고침 시 response time 단축, 60s TTL expire, CacheService key-only 로깅.
8. **비관리자 layout redirect** — 일반 유저 /admin → / redirect (controller access-control 자동화는 3/3 GREEN).
9. **UI-SPEC Typography + Error/Empty (review MEDIUM 7/8)** — 정적 스캔 0 위반은 완료, offline error 카피와 empty 카피 분리 렌더 + retry 버튼.
10. **a11y (review LOW 13)** — VoiceOver sr-only 요약 + OS Reduce Motion 대응.
11. **E2E 4개 실행** — `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` 4 passed (landing-smoke/period-filter/sidebar-nav/chart-blank-guard). 로컬 API 서버 미기동으로 Task 04-01에서 유예됨.

### Gaps Summary

**자동 검증 기준으로 gaps 없음.** 모든 로드맵 Success Criteria 5/5, 필수 아티팩트 23/23, 키 링크 14/14, 데이터 흐름 5/5, 요구사항 6/6 VERIFIED. 383/383 monorepo tests PASS. UI-SPEC Typography 0 violations.

**유일한 Open 항목은 수동/런타임 검증 11개**로, 정적 코드 분석으로는 얻을 수 없는 클래스(시각 렌더, 색상 판별, 스크린리더 실측, 브라우저 redirect UX, recharts 런타임 회귀, E2E 실행). 이들은 Phase 11 작업자가 의도적으로 HUMAN-UAT.md로 분리하여 `/gsd-verify-work 11` 명령어로 추적하기로 결정함. 이는 approved deferral이며 phase 완료를 blocking하지 않는다.

**Out of Scope (not a Phase 11 regression):**
- `apps/api/test/sms-throttle.integration.spec.ts` 2 failed — Phase 10/10.1 파생 사전 이슈, Phase 11 파일 미변경. 별도 phase 처리 대상.

---

_Verified: 2026-04-20T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
