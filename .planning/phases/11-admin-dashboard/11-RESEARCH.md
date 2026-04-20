# Phase 11: 어드민 대시보드 - Research

**Researched:** 2026-04-20
**Domain:** Admin analytics dashboard (read-only aggregation + Valkey cache + charting)
**Confidence:** HIGH (stack, patterns, pitfalls 모두 공식 문서 + Context7 + 코드베이스 교차 검증)

## Summary

Phase 11은 `/admin` 랜딩을 읽기 전용 대시보드로 전환하고, KPI 4종 + area/donut/bar 3종 차트 + Top 10 랭킹을 Valkey 캐시(60s TTL) 뒤에 서빙한다. 기술적으로는 (1) **shadcn Chart + recharts 3.8.1** 신규 설치, (2) **Drizzle raw-SQL aggregation + PostgreSQL `date_trunc` with `AT TIME ZONE 'Asia/Seoul'`**, (3) **기존 `CacheService` 재사용 (read-through, 60s TTL, TTL-only invalidation)**, (4) **NestJS `AdminDashboardController`/`Service` 신설 + `AdminModule`에 provider 등록** 네 축으로 수렴한다. 모든 결정이 CONTEXT.md D-01 ~ D-15 로 선고정 상태이므로 리서처는 **alternatives를 탐색하지 않고, 선택된 스택의 "정확한 사용법"에만 집중**했다.

React 19 / Next.js 16 / Tailwind v4 조합은 recharts 3.8.x에서 공식 peer 범위에 포함되며, 2026-01에 보고된 React 19.2.3 렌더 회귀(recharts#6857)는 여전히 open 상태이나 재현 미확인이므로 **실측 검증 + react-is pnpm override 대비책**을 plan 안에 포함해야 한다. Drizzle 0.45는 raw SQL + `date_trunc at time zone`을 안전하게 지원하며, 기존 `admin-booking.service.ts`의 `count(*)::int` + `coalesce(sum(...), 0)::int` 스타일과 100% 일관된다. `CacheService`는 그대로 재사용 가능하되 Phase 7 `DEFAULT_TTL=300`이 기본값이므로 **모든 `set()` 호출에 `ttlSeconds=60`을 명시적으로 전달**해야 한다.

**Primary recommendation:** `AdminDashboardController`를 새 파일(`apps/api/src/modules/admin/admin-dashboard.controller.ts`)로 분리하고 `AdminDashboardService`가 `CacheService` + `DRIZZLE`만 주입받는 얇은 read-only service로 구성하라. 5개 엔드포인트(`summary` / `revenue` / `genre` / `payment` / `top-performances`)는 모두 동일 read-through 템플릿(`cache.get<T>(key) ?? (db query + cache.set(key, val, 60))`)을 따른다. 프론트는 `use-admin-dashboard.ts` 단일 훅 파일에 5개 `useQuery` 집중, staleTime=30s (서버 60s 캐시의 절반) + `refetchOnWindowFocus: false` (대시보드 고정 포커스 UX).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**라우팅 & IA**
- **D-01:** `/admin` 랜딩 = 대시보드. `apps/web/app/admin/page.tsx` 신규 생성하여 index에 대시보드 배치.
- **D-02:** `admin-sidebar.tsx:32` 로고 링크 `/admin/performances` → `/admin`으로 교체.
- **D-03:** sidebar NAV_ITEMS 최상단에 `{ label: '대시보드', href: '/admin', icon: LayoutDashboard }` 추가.
- **D-04:** `/admin/performances` 경로 자체는 변경 없음.

**차트 라이브러리**
- **D-05:** shadcn/ui Chart 채택 (recharts wrapper). `npx shadcn@latest add chart` 실행. CSS variable 기반 `--chart-1~5` 색상 토큰 + `ChartContainer`/`ChartTooltip`/`ChartLegend` 표준 사용.

**통계 의미론**
- **D-06:** "오늘" 기준 = Asia/Seoul 자정 ~ 다음 자정. `reservations.createdAt` 기준 필터.
- **D-07:** 매출 = `reservations.status = 'CONFIRMED'`의 `totalAmount` 누적합. 환불/취소 차감하지 않음.
- **D-08:** 취소율 = `CANCELLED 건수 / 전체 건수` (분모 = `reservations` 전체).
- **D-09:** 매출 추이 차트 기간 필터 = 7/30/90일 세그먼트 3단 버튼 (기본 30일). 7·30일=일별, 90일=주별.
- **D-10:** 인기 공연 Top 10 = 최근 30일 CONFIRMED 예매 건수 기준 GROUP BY performanceId ORDER BY count DESC LIMIT 10 (기간 고정).
- **D-11:** 장르 donut + 결제수단 bar 기간 = 상단 매출 추이 기간 필터와 공유.

**캐싱 전략**
- **D-12:** 캐시 TTL = 60초 일괄. Phase 7 `CacheService`의 `DEFAULT_TTL=300` 명시적 override.
- **D-13:** 무효화 전략 = TTL-only. 수동 invalidate 호출 없음.
- **D-14:** 키 네임스페이스 = `cache:admin:dashboard:{kind}:{params}` (예: `cache:admin:dashboard:summary`, `:revenue:30d`, `:genre:30d`, `:payment:30d`, `:top10`).
- **D-15:** 기존 `CacheService` 그대로 재사용. 새 서비스 만들지 않음.

### Claude's Discretion
- 대시보드 레이아웃 정확한 그리드 구성 (UI-SPEC에서 일부 확정)
- area/donut/bar 정확한 prop 시그니처, color mapping (UI-SPEC D chart palette 참조)
- 로딩 스켈레톤 / 에러 상태 UI 정확한 마크업 (UI-SPEC Interaction & State 참조)
- NestJS dashboard API 분리 여부 (권장: 신규 `admin-dashboard.controller.ts` + `admin-dashboard.service.ts`)
- 날짜 경계 처리(KST 자정): DB 레벨 `AT TIME ZONE 'Asia/Seoul'` vs 앱 레벨 `new Date()`
- 7/30/90일 버튼의 정확한 shadcn 컴포넌트 (ToggleGroup vs 3개 Button)
- Top 10 테이블 행당 표시 필드
- shadcn Chart CSS variable 기본값을 Grapit 브랜드 색상으로 커스텀할지

### Deferred Ideas (OUT OF SCOPE)
- 실시간 WebSocket 대시보드 (ADM-09)
- Excel/CSV 내보내기 (ADM-07)
- 퍼널/코호트 분석 (ADM-08)
- RBAC 세분화
- 동시 접속자 / 대기열 현황 카드
- 오늘 vs 어제 비교 증감률
- 날짜 범위 자유 데이트피커
- 자정 롤오버 WebSocket push
- Sentry 대시보드 쿼리 성능 메트릭
- 공연 CRUD 변경 시 dashboard 캐시 즉시 무효화

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADM-01 | 오늘 요약 카드 (예매 수, 매출, 취소, 활성 공연) | `AdminStatCard` 재사용 + summary API 1개 호출, Drizzle `count(*)::int` + `sum::int` 패턴 (Standard Stack §Backend aggregation) |
| ADM-02 | 매출 추이 차트 (일별/주별 area chart) | shadcn Chart `<AreaChart>` + `date_trunc` SQL 집계, 7/30일=day / 90일=week 자동 스위치 (Pattern 2: Time-series aggregation) |
| ADM-03 | 장르별 예매 분포 차트 (donut) | shadcn Chart `<PieChart innerRadius={60}>` + `performances.genre` GROUP BY (Code Example §Donut) |
| ADM-04 | 인기 공연 랭킹 Top 10 | 최근 30일 CONFIRMED `GROUP BY performanceId ORDER BY count DESC LIMIT 10` + performances join (Code Example §Top 10) |
| ADM-05 | 결제수단 분포 차트 (bar) | shadcn Chart `<BarChart>` + `payments.method` GROUP BY, CONFIRMED reservations 조인 (Code Example §Payment bar) |
| ADM-06 | 통계 데이터 캐싱 + 집계 쿼리 최적화 | `CacheService.get/set(..., 60)` read-through, 5개 엔드포인트 전부 동일 템플릿 (Pattern 1: Read-through cache) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 통계 집계 쿼리 (ADM-01~05) | API / Backend | Database | 집계식이 `GROUP BY` + 조인 + 시간대 변환을 포함하므로 DB가 계산, API가 응답 조립. FE는 가공 금지 |
| 캐시 read-through (ADM-06) | API / Backend | Cache (Valkey) | `CacheService` 재사용, `DRIZZLE` 주입. FE/브라우저는 캐시 키 인지하지 않음 |
| KST 자정 경계 처리 | Database | API / Backend | PostgreSQL `AT TIME ZONE 'Asia/Seoul'`로 DB 레벨에서 경계 계산 — 앱 서버 로컬 시간대(Cloud Run UTC)에 의존하지 않음 |
| 기간 필터 입력 검증 | API / Backend | — | Zod schema + `ZodValidationPipe`로 `period` query param을 `'7d' \| '30d' \| '90d'`로 파싱 |
| 차트 렌더링 | Browser / Client | — | recharts는 SSR 호환이나 초기 측정 문제 있음 → `'use client'` 필수 |
| 서버 상태 관리 | Browser / Client | API / Backend | TanStack Query `useQuery` staleTime=30s (서버 TTL 60s의 절반) |
| Admin role guard | Frontend Server (SSR) | Browser / Client | `apps/web/app/admin/layout.tsx` 기존 guard 재사용 — 신규 작업 없음 |
| 사이드바 네비게이션 | Browser / Client | — | `admin-sidebar.tsx` NAV_ITEMS 최상단에 '대시보드' 추가 (D-03) |

## Standard Stack

### Core (신규 설치)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | 차트 렌더링 엔진 (D3 기반) | shadcn Chart의 peer. React 19 공식 지원 (peer `^19.0.0`). 2026-03-25 배포된 최신 stable. Grapit 스택(React 19.1, Next.js 16.2, Tailwind v4.2) 전부 호환. `[VERIFIED: npm view recharts version → 3.8.1, peerDependencies → react ^19.0.0]` |
| @/components/ui/chart | shadcn emit | shadcn Chart primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`) | `npx shadcn@latest add chart` 실행 시 `apps/web/components/ui/chart.tsx` 복사 + `:root`에 `--chart-1~5` CSS 변수 주입. 기존 shadcn new-york preset과 동일한 스타일 규약 유지. `[VERIFIED: Context7 /shadcn-ui/ui]` |

### Core (재사용 — 신규 설치 없음)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| drizzle-orm | 0.45.x (설치됨) | raw SQL 집계 쿼리 (`date_trunc`, `AT TIME ZONE`, `count(*)::int`) | 기존 `admin-booking.service.ts:55-59` 패턴 100% 일관 재사용 |
| ioredis | 5.10.1 (설치됨) | `CacheService`의 backing TCP client | Phase 7 D-01~D-02 결정에 따라 단일 클라이언트 (Valkey 호환) |
| @tanstack/react-query | 5.95.2 (설치됨) | 서버 상태 패칭 + 브라우저 stale-while-revalidate | 기존 `use-admin.ts:21-33` 패턴 그대로 답습 |
| zod | 3.25.76 (설치됨) | query param 검증 | 기존 `@grapit/shared` schema 스타일 (`z.object` + `safeParse`) |
| lucide-react | 1.7.0 (설치됨) | 아이콘 (`LayoutDashboard`, `Ticket`, `Banknote`, `Trophy` 등) | UI-SPEC §Icon assignments 참조 |

### Supporting (shadcn 추가 설치 가능)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/components/ui/toggle-group | shadcn emit | 7/30/90일 기간 필터 세그먼트 | `npx shadcn@latest add toggle-group` (현재 `apps/web/components/ui/`에 없음). 대안: 기존 `button.tsx` 3개로 구성 가능 — planner 재량 |

### Version Pinning (프로젝트 CLAUDE.md 기준)

| Runtime / Framework | Version | Confidence |
|---------------------|---------|------------|
| Node.js | 22.22.x LTS | HIGH |
| TypeScript | 5.9.x | HIGH |
| Next.js | 16.2.x | HIGH (설치됨) |
| React | 19.1.x | HIGH (설치됨) |
| Tailwind CSS | 4.2.x | HIGH (설치됨) |
| NestJS | 11.1.x | HIGH (설치됨) |
| Drizzle ORM | 0.45.x | HIGH (설치됨) |
| ioredis | 5.10.1 | HIGH (설치됨) |
| @tanstack/react-query | 5.95.2 | HIGH (설치됨) |
| recharts | **3.8.1 (pin)** | HIGH (신규) |

**Installation (신규만):**
```bash
# apps/web workspace (중요: 모노레포 루트가 아닌 apps/web에서 실행)
cd apps/web && pnpm dlx shadcn@latest add chart
# 선택: 기간 필터용
cd apps/web && pnpm dlx shadcn@latest add toggle-group
```
shadcn CLI가 `apps/web/components/ui/chart.tsx`를 생성하고 `apps/web/package.json`에 `recharts: "^3.x"`를 추가하며 `apps/web/app/globals.css`의 `:root` 블록에 `--chart-1~5` CSS 변수를 주입한다. 이후 UI-SPEC §Chart color palette 매핑으로 **수동 덮어쓰기**가 필요하다 (purple gradient + gray, D-05 "브랜드 색상 커스텀").

**Version verification (plan 실행 직전 재확인):**
```bash
npm view recharts version          # Expected: 3.8.1 이상
npm view recharts peerDependencies # Expected: react ^19.0.0 포함
```

### Alternatives Considered (선고정으로 연구 생략)

CONTEXT.md D-05가 shadcn Chart를 locked decision으로 확정했으므로 Chart.js / Apache ECharts / Nivo / Visx 등 대안 탐색은 수행하지 않았다. 단 research 과정에서 발견된 **recharts 3.x React 19 회귀 이슈(Pitfall 3)**가 blocker로 확정될 경우 대체안 검토는 별도 phase에서 재개한다.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (Client)                                                     │
│                                                                      │
│  /admin/page.tsx ──────────────────────────────────┐                 │
│     │                                              │                 │
│     ├─ AdminStatCard × 4 (KPI row)                 │                 │
│     ├─ PeriodFilter (7/30/90일 ToggleGroup) ───────┤                 │
│     ├─ RevenueAreaChart    ─┐                      │                 │
│     ├─ GenreDonutChart     ─┤ (period-driven)      │                 │
│     ├─ PaymentBarChart     ─┘                      │                 │
│     └─ TopPerformancesTable (fixed 30d)            │                 │
│                                                    ▼                 │
│  use-admin-dashboard.ts (5 x useQuery, staleTime=30s)                │
│     │                                                                │
│     │ fetch with credentials (admin cookie)                          │
└─────┼────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API / Backend (NestJS — @grapit/api on Cloud Run)                    │
│                                                                      │
│  /api/v1/admin/dashboard/{summary|revenue|genre|payment|top-perf}    │
│     │                                                                │
│     ▼                                                                │
│  AdminDashboardController (@Roles('admin') + ZodValidationPipe)      │
│     │                                                                │
│     ▼                                                                │
│  AdminDashboardService.getX(params) ─── read-through ────────┐       │
│     │                                                        │       │
│     │ cache.get<T>(key) ─► HIT ─► return cached              │       │
│     │                                                        │       │
│     │ MISS                                                   │       │
│     ▼                                                        │       │
│  Drizzle raw SQL aggregation (count/sum + date_trunc         │       │
│     + AT TIME ZONE 'Asia/Seoul' + GROUP BY)                  │       │
│     │                                                        │       │
│     ▼                                                        │       │
│  cache.set(key, result, 60) ◄────────────────────────────────┘       │
│     │                                                                │
│     ▼                                                                │
│  Return DTO                                                          │
└──────┬─────────────────────────────────────┬─────────────────────────┘
       │                                     │
       ▼                                     ▼
┌────────────────────┐              ┌──────────────────────────────────┐
│ Valkey (Memorystore)│              │ Cloud SQL PostgreSQL 16          │
│  - cache:admin:     │              │  - reservations (status/total/   │
│    dashboard:*      │              │    createdAt/showtimeId)         │
│  - TTL=60s          │              │  - payments (method/amount/      │
│                     │              │    status)                       │
└────────────────────┘              │  - performances (genre/title)    │
                                    │  - showtimes (performanceId)     │
                                    └──────────────────────────────────┘
```

### Recommended Project Structure

```
apps/api/src/modules/admin/
├── admin.module.ts                      # modify: add AdminDashboardController + Service
├── admin-dashboard.controller.ts        # NEW — 5 GET routes
├── admin-dashboard.service.ts           # NEW — aggregation + cache
├── admin-dashboard.schema.ts            # NEW — zod query-param schemas
└── __tests__/
    └── admin-dashboard.service.spec.ts  # NEW — unit (mocked Drizzle + Cache)

apps/web/
├── app/admin/
│   ├── page.tsx                         # NEW — dashboard landing composition
│   └── layout.tsx                       # unchanged — existing role guard
├── components/admin/
│   ├── admin-sidebar.tsx                # modify: NAV_ITEMS + logo href
│   └── dashboard/                       # NEW folder
│       ├── revenue-area-chart.tsx
│       ├── genre-donut-chart.tsx
│       ├── payment-bar-chart.tsx
│       ├── top-performances-table.tsx
│       └── period-filter.tsx
├── components/ui/
│   └── chart.tsx                        # shadcn-added (NEW)
└── hooks/
    └── use-admin-dashboard.ts           # NEW — 5 useQuery hooks

packages/shared/src/
├── schemas/
│   └── admin-dashboard.schema.ts        # NEW — shared zod schemas
└── types/
    └── admin-dashboard.ts               # NEW — DTOs (re-exported)
```

### Pattern 1: Read-through Cache Template

**What:** 모든 대시보드 엔드포인트에 동일 read-through 패턴 적용. `CacheService.get` → miss면 DB 집계 → `set(key, val, 60)` → 반환.
**When to use:** 모든 5개 `AdminDashboardService` 메서드 (ADM-06 핵심).
**Example:**
```typescript
// apps/api/src/modules/admin/admin-dashboard.service.ts
// Source: extends apps/api/src/modules/performance/cache.service.ts pattern
import { Injectable, Inject } from '@nestjs/common';
import { CacheService } from '../performance/cache.service.js';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';

const DASHBOARD_CACHE_TTL = 60; // D-12

@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  private async readThrough<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await this.cache.set(key, fresh, DASHBOARD_CACHE_TTL); // 60s, D-12
    return fresh;
  }

  async getSummary(): Promise<DashboardSummaryDto> {
    return this.readThrough('cache:admin:dashboard:summary', async () => {
      // ... Drizzle aggregation (see Pattern 2)
    });
  }
}
```

**Why this pattern:**
- `CacheService.get()`과 `.set()`은 **graceful degradation** 구현 완료 — Redis 장애 시에도 DB fallback으로 요청이 성공 (swallow + warn). Phase 7 이미 검증됨.
- `cache.set`의 3번째 인자로 `60`을 **항상 명시적 전달** — `DEFAULT_TTL=300`을 override (D-12 명시).
- Key prefix `cache:admin:dashboard:*`는 `cache:performances:*` / `cache:home:*`와 격리되어 카탈로그 변경으로 dashboard가 영향받지 않음 (D-14).

### Pattern 2: KST Timezone-Aware Aggregation (DB-level)

**What:** PostgreSQL `AT TIME ZONE 'Asia/Seoul'`로 timestamp with tz 컬럼을 KST로 변환 후 `date_trunc`로 일/주 버킷으로 묶는다. **앱 레벨에서 `new Date()` 변환하지 않는다** (Cloud Run의 TZ=UTC이므로).
**When to use:** `getSummary()` (오늘 KPI), `getRevenueTrend()` (일별/주별 버킷).
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/sql + pattern from acharlop
// (github.com/drizzle-team/drizzle-orm/discussions/2893)
import { sql, eq, and, gte, lt, desc } from 'drizzle-orm';
import { reservations } from '../../database/schema/index.js';

// 오늘 예매 수 (KST 자정 기준)
const [todayBookings] = await this.db
  .select({ count: sql<number>`count(*)::int` })
  .from(reservations)
  .where(sql`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')`);

// 매출 추이 (일별, 최근 30일)
const revenueTrend = await this.db
  .select({
    bucket: sql<string>`to_char(
      date_trunc('day', ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul'),
      'YYYY-MM-DD'
    )`.mapWith(String),
    revenue: sql<number>`coalesce(sum(${reservations.totalAmount}), 0)::int`,
    count: sql<number>`count(*)::int`,
  })
  .from(reservations)
  .where(and(
    eq(reservations.status, 'CONFIRMED'),
    sql`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - interval '30 days'`,
  ))
  .groupBy(sql`date_trunc('day', ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul')`)
  .orderBy(sql`date_trunc('day', ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul')`);

// 매출 추이 (주별, 최근 90일) — 동일 패턴에서 'day' → 'week'
```

**Why this pattern:**
- `timestamp with time zone` 컬럼은 PostgreSQL 내부적으로 UTC 저장. `AT TIME ZONE 'Asia/Seoul'`로 KST 변환 후 `date_trunc`를 적용해야 KST 기준 자정/주경계가 된다. `[CITED: dev.to/jacksonkasi/the-developers-guide-to-never-messing-up-time-zones-again]`
- `date_trunc('day', ..)` 결과를 `to_char(..)` 없이 그대로 반환하면 `Date` 객체로 직렬화되어 KST/UTC 혼동 유발 → **문자열 `YYYY-MM-DD` (또는 `IYYY-IW` for week)로 명시 변환** 후 FE에 전달.
- `now() AT TIME ZONE 'Asia/Seoul'`은 DB 서버 시각 기준 — Cloud Run 인스턴스의 `new Date()`와 독립적이므로 테스트·운영 환경 모두 일관.

### Pattern 3: NestJS Module 확장 (AdminModule)

**What:** `AdminDashboardController`/`Service`를 새 파일로 생성하되 `AdminModule`에 provider 등록 — 새 NestJS 모듈을 파생하지 않는다.
**When to use:** 이번 phase 한정 (dashboard 5개 엔드포인트가 admin 관리 영역 내부이므로 모듈 분리 불필요).
**Example:**
```typescript
// apps/api/src/modules/admin/admin.module.ts (diff)
import { Module } from '@nestjs/common';
import { PerformanceModule } from '../performance/performance.module.js';
// ... existing imports
import { AdminDashboardController } from './admin-dashboard.controller.js';  // NEW
import { AdminDashboardService } from './admin-dashboard.service.js';        // NEW

@Module({
  imports: [PerformanceModule, PaymentModule, BookingModule], // PerformanceModule exports CacheService
  controllers: [
    AdminPerformanceController,
    AdminBannerController,
    AdminBookingController,
    LocalUploadController,
    AdminDashboardController,  // NEW
  ],
  providers: [
    AdminService,
    AdminBookingService,
    UploadService,
    AdminDashboardService,  // NEW
  ],
})
export class AdminModule {}
```
**전제:** `PerformanceModule`이 `CacheService`를 export 해야 `AdminDashboardService`가 `DI`로 주입받을 수 있다. 현재 `cache.service.ts`는 `PerformanceModule`에 등록되어 있으므로 `exports: [CacheService]` 선언 여부 확인 필요 (아니면 export 추가).

### Pattern 4: Zod Query Param Validation (shared schema)

**What:** `@grapit/shared/schemas/admin-dashboard.schema.ts`에 period enum schema 정의 후 API + FE 양쪽에서 공유.
**When to use:** 모든 period-driven 엔드포인트 (`/revenue`, `/genre`, `/payment`).
**Example:**
```typescript
// packages/shared/src/schemas/admin-dashboard.schema.ts
import { z } from 'zod';

export const dashboardPeriodSchema = z.enum(['7d', '30d', '90d']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const periodQuerySchema = z.object({
  period: dashboardPeriodSchema.default('30d'),
});

// apps/api/src/modules/admin/admin-dashboard.controller.ts
@Get('dashboard/revenue')
async getRevenue(
  @Query(new ZodValidationPipe(periodQuerySchema)) query: { period: DashboardPeriod },
) {
  return this.service.getRevenueTrend(query.period);
}
```
**Why:** 기존 `admin-booking.controller.ts:45`가 이미 `ZodValidationPipe(adminRefundSchema)` 패턴을 쓰고 있어 100% 일관. period → days 매핑 (`'7d' → 7, '30d' → 30, '90d' → 90`)은 service 내부에서 수행.

### Pattern 5: Frontend TanStack Query 훅 (`use-admin-dashboard.ts`)

**What:** 5개 엔드포인트 호출 훅을 단일 파일에 모은다. staleTime=30s + `refetchOnWindowFocus: false`.
**When to use:** 신규 파일 `apps/web/hooks/use-admin-dashboard.ts`.
**Example:**
```typescript
// Source: mirrors apps/web/hooks/use-admin.ts (existing pattern)
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { DashboardPeriod } from '@grapit/shared';

const STALE_TIME = 30_000; // 30s — half of server TTL (60s)

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'summary'],
    queryFn: () => apiClient.get<SummaryDto>('/api/v1/admin/dashboard/summary'),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false, // D-17 UI-SPEC Interaction Contract (focus refetch 수용하나 스켈레톤 깜빡임 방지)
  });
}

export function useDashboardRevenue(period: DashboardPeriod) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'revenue', period],
    queryFn: () => apiClient.get<RevenueDto>(`/api/v1/admin/dashboard/revenue?period=${period}`),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
}
// ...genre, payment, top10 (top10은 period param 없음)
```
**Note on staleTime choice:** UI-SPEC §Interaction은 `refetchOnWindowFocus: true`를 허용했지만, 60s 서버 TTL이 이미 신선도를 보장하므로 **`false`로 pin하고 FE staleTime=30s**을 권장한다 (창 재포커스 시 스켈레톤 깜빡임 제거). Planner가 UX 선호에 따라 `true`로 바꿀 재량 있음.

### Anti-Patterns to Avoid

- **`new Date()` 기반 KST 자정 계산:** Cloud Run 컨테이너는 `TZ=UTC` 기본값이므로 `new Date().setHours(0,0,0,0)`은 UTC 자정이 됨. **반드시 DB 레벨 `AT TIME ZONE 'Asia/Seoul'`** 사용 (Pattern 2).
- **`CacheService.invalidate()` 수동 호출:** D-13 TTL-only 확정. 공연 CRUD / 예매 생성 시 `cache:admin:dashboard:*` invalidate를 **절대 호출하지 않음**. 60s 내 자연 신선화.
- **`DEFAULT_TTL` 묵시 사용:** `cache.set(key, val)` (3번째 인자 누락)은 300초 TTL이 적용됨 — D-12 위배. **항상 `ttlSeconds=60`을 명시** (코드 리뷰 가드 포인트).
- **새 NestJS Module 생성:** `AdminDashboardModule`로 분리 시 `AdminModule`과 책임 중복 + `CacheService` re-export 필요. 기존 `AdminModule` 확장이 단순 (Pattern 3).
- **recharts 컴포넌트를 server component에서 import:** `recharts`는 DOM 측정이 필요하므로 server rendering 시 hydration 불일치. **`'use client'` 디렉티브 필수** (Pitfall 3 참조).
- **shadcn CLI를 모노레포 루트에서 실행:** `components.json`이 `apps/web/components.json`에만 있어 루트 실행 시 실패. **반드시 `cd apps/web && pnpm dlx shadcn@latest add chart`**.
- **차트 rainbow palette:** UI-SPEC §Chart color palette가 `#6C3CE0` → `#A1A1AA` gray의 **monochromatic purple + gray** 5단계를 locked — shadcn 기본 `--chart-1~5` (녹/파/주황/빨/보라 다색) 덮어써야 함.
- **`class-validator` / `class-transformer` 재도입:** 프로젝트 전체가 `zod + drizzle-zod` 단일 표준 (CLAUDE.md "What NOT to Use") — dashboard DTO도 zod로 정의.
- **서버 컴포넌트에서 `useQuery` 호출:** Next.js 16 App Router에서 `page.tsx`가 기본 server component지만 `use-admin-dashboard.ts`가 `'use client'` → dashboard page.tsx도 `'use client'` 필요 (또는 서버에서 children 조립 후 client charts 포함).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG 차트 렌더링 | 수동 SVG path 계산 | recharts `<AreaChart>` / `<PieChart>` / `<BarChart>` | d3 기반 축 tick 자동 계산, responsive container, ARIA 레이블 내장 |
| 차트 색상 테마 | 컴포넌트별 hex 하드코딩 | shadcn `--chart-1~5` CSS 변수 | 다크모드 대응 + 디자인 토큰 일관성 |
| 차트 툴팁 스타일 | 수제 floating div | `<ChartTooltip content={<ChartTooltipContent />} />` | shadcn 스타일 자동 적용, 키보드/터치 호환 |
| KST 자정 계산 | JS `new Date().setHours(0,0,0,0)` | PostgreSQL `date_trunc('day', ts AT TIME ZONE 'Asia/Seoul')` | Cloud Run UTC 환경 영향 제거, DST 자동 처리 |
| 주별 버킷 경계 | JS 요일 계산 loop | PostgreSQL `date_trunc('week', ..)` | ISO 8601 주 번호 자동 (월요일 시작) |
| 캐시 read-through 보일러플레이트 | 각 메서드에 try/catch + set 반복 | `private readThrough<T>(key, fetcher)` 공통 메서드 (Pattern 1) | 5개 엔드포인트 일관성 + 테스트 용이 |
| JSON 직렬화 후 파싱 오류 처리 | 수동 try/catch | 기존 `CacheService.get`이 이미 swallow + warn | Phase 7 이미 검증 |
| Zod query param parsing | `parseInt(query.period, 10)` | `ZodValidationPipe(periodQuerySchema)` | 타입 안전 + 잘못된 값 400 응답 자동 |
| Loading skeleton | 수제 pulse div | 기존 `@/components/ui/skeleton` | UI-SPEC §Component Inventory 확정 |
| 통화 포맷 | 수제 `toLocaleString` | 기존 `AdminStatCard` `format: 'currency'` | 1M 축약 규칙 기 내재 (`admin-stat-card.tsx:17-21`) |

**Key insight:** 이 phase는 **하드 문제 0개 + 새 비즈니스 로직 0개**. 순전히 기존 자산(`CacheService`, `AdminStatCard`, Drizzle SQL 스타일, ZodValidationPipe, apiClient)을 5개 read-only 쿼리 + 3개 차트 래퍼로 조립하는 **composition task**. 새로 "발명"할 것은 차트 래퍼 컴포넌트 몇 개뿐.

## Common Pitfalls

### Pitfall 1: recharts 3.x + React 19.2.x 렌더링 회귀
**What goes wrong:** React 19.2.3에서 recharts 3.6.0 차트가 DOM엔 있지만 시각적으로 blank 렌더링 (no error, no warning).
**Why it happens:** recharts가 내부적으로 `react-is` 패키지를 사용. React 19.2.3과 `react-is` 버전 불일치 시 `isForwardRef`/`isElement` 검사 실패 → 차트 내부 컴포넌트가 렌더링 중 silently skip.
**How to avoid:**
1. `recharts` 3.8.1 이상 pin (최신 stable이 회귀 수정 가능성 높음 — 실측 후 확정).
2. 설치 후 `apps/web/package.json` `dependencies.react-is` 확인 — 누락이면 `pnpm add -F @grapit/web react-is@19.1.0` 명시 추가.
3. 여전히 blank이면 모노레포 루트 `package.json`에 pnpm override 추가:
   ```json
   "pnpm": {
     "overrides": {
       "react-is": "19.1.0"
     }
   }
   ```
**Warning signs:** 개발 서버 로드 후 차트 영역만 흰 영역. DevTools Elements에 `<svg>`는 존재하나 `<path>`/`<g>` 자식 없음. Console warning 0건.
**Mitigation task (plan 포함 권장):** `apps/web/app/admin/page.tsx` 구현 후 첫 dev 실행 시 차트 3개 모두 렌더 여부 수동 확인 + Playwright E2E 스크린샷 테스트로 픽셀 회귀 감지.
`[CITED: github.com/recharts/recharts/issues/6857, github.com/recharts/recharts/issues/4558]`

### Pitfall 2: shadcn `chart.tsx` CSS 변수가 Tailwind v4 `@theme` 블록과 충돌
**What goes wrong:** shadcn CLI는 `:root { --chart-1: ... }`를 `globals.css` 최상단에 주입하는데, Tailwind v4에서는 `@theme { }` 블록 내 변수가 utility class를 생성함. `:root` 직접 선언은 theme에 노출되지 않아 Tailwind color utility가 `--chart-1`을 인식하지 못할 수 있음.
**Why it happens:** Tailwind v4의 CSS-first config는 `@theme` 블록 안의 `--color-*` 변수만 utility로 자동 매핑. `--chart-*`는 별개 prefix라 shadcn이 `:root` 에 직접 선언.
**How to avoid:**
1. shadcn Chart는 `var(--chart-N)` 을 CSS 변수로 **직접** 참조 (Tailwind class 아님) — 이 사용 방식은 Tailwind와 무관하게 동작.
2. 차트 내부 (`fill="var(--chart-1)"` 등)에 쓰고, KPI 카드 등 일반 UI는 기존 `--color-primary` / `bg-gray-100` 토큰 유지.
3. 만약 `bg-chart-1` 같은 Tailwind utility가 필요하면 `@theme` 블록에도 복사 선언 (UI-SPEC은 해당 요구 없음).
**Warning signs:** 차트 색상이 기본 shadcn oklch (청/녹/주) 톤으로 나타남 (브랜드 purple 미반영).
`[VERIFIED: WebFetch ui.shadcn.com/docs/components/chart — "Reference as var(--chart-1) (not hsl(var(--chart-1)))"]`

### Pitfall 3: recharts 컴포넌트를 server component에서 import
**What goes wrong:** Next.js 16 App Router에서 `page.tsx`가 기본 server component. recharts import 시 build error "Module not found: Can't resolve 'react-is' in server context" 또는 hydration mismatch.
**Why it happens:** recharts는 DOM 측정 (getBBox, resize observer) 필요 → SSR 불가능.
**How to avoid:**
1. 차트 래퍼 컴포넌트 최상단에 `'use client'` 명시.
2. `apps/web/app/admin/page.tsx`도 `'use client'` (TanStack Query 훅 사용하므로 어차피 필수).
3. 서버에서 초기 데이터 프리페치가 필요할 경우 `QueryClient` + `HydrationBoundary` 패턴 (v5 SSR)을 쓰되 이 phase에서는 과제 외.
**Warning signs:** build error `Module not found: Can't resolve ...`, 또는 `ReferenceError: window is not defined`.

### Pitfall 4: `reservations.status` enum 필터에서 `FAILED` 제외 혼동
**What goes wrong:** D-08 취소율 공식은 "분모 = `reservations` 전체"이므로 `PENDING_PAYMENT` + `FAILED`도 포함. 하지만 매출(D-07) 분자는 `CONFIRMED`만. 섞이면 취소율이 작게 나옴.
**Why it happens:** reservationStatusEnum은 4개 상태(`PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `FAILED`). 기존 `admin-booking.service.ts:52`의 `count(*)`은 **전체**임에 주의.
**How to avoid:** 공식 주석으로 문서화.
```typescript
// D-08: cancelRate = CANCELLED / (ALL statuses including FAILED & PENDING_PAYMENT)
const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(reservations);
const [cancelled] = await db.select({ count: sql<number>`count(*)::int` })
  .from(reservations).where(eq(reservations.status, 'CANCELLED'));
```
**Warning signs:** `cancelRate`가 `admin-booking.service.ts`의 기존 값과 다를 때.

### Pitfall 5: 결제수단 분포에서 CANCELED payment도 집계
**What goes wrong:** `payments.status`는 `READY|DONE|CANCELED|ABORTED|EXPIRED` 5개. 환불된 결제는 `CANCELED`로 남음 → 결제수단 분포에 포함하면 "이미 환불된 카드 결제"가 "최근 30일 카드 결제"로 이중 계산.
**Why it happens:** 결제수단은 `payments.method`이지만 결제 성공 여부는 `payments.status = 'DONE'` 또는 `reservations.status = 'CONFIRMED'` 조인으로 필터해야 함.
**How to avoid:** `ADM-05` 집계는 `reservations.status = 'CONFIRMED'`만 조인. D-07 "매출 = CONFIRMED"와 일관.
```typescript
// Pattern: count payments grouped by method for CONFIRMED reservations only
select({ method: payments.method, count: sql<number>`count(*)::int` })
  .from(payments)
  .innerJoin(reservations, eq(payments.reservationId, reservations.id))
  .where(and(
    eq(reservations.status, 'CONFIRMED'),
    sql`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - interval '30 days'`,
  ))
  .groupBy(payments.method);
```
**Warning signs:** 결제수단 bar 총합이 해당 기간 CONFIRMED 예매수와 불일치.

### Pitfall 6: "활성 공연" 정의 모호
**What goes wrong:** ADM-01 KPI 중 "활성 공연"의 정의가 CONTEXT.md에 locked 아님. `performanceStatusEnum`은 `upcoming|selling|closing_soon|ended` 4개 — 무엇을 "활성"으로 볼 것인가?
**Why it happens:** D-06~D-08이 오늘 예매/매출/취소율만 명시. "활성 공연"은 Discretion.
**How to avoid (권장):** `status IN ('selling', 'closing_soon')` 로 정의. `upcoming`은 아직 판매 전이고 `ended`는 판매 종료이므로 둘 다 제외. 이 정의를 plan의 code comment + VALIDATION 테스트 이름에 명시하여 추후 모호성 제거.
**Warning signs:** KPI "활성 공연" 수치가 관리자 직관과 불일치 (다른 화면에서 "판매 중" 카운트와 어긋남).

### Pitfall 7: `activePerformances` 를 예매 테이블이 아닌 `performances` 테이블에서 집계
**What goes wrong:** summary 쿼리가 `reservations`만 스캔해서 "활성 공연" KPI를 누락.
**Why it happens:** 오늘 예매수/매출/취소는 `reservations`에서 나오지만 활성 공연은 `performances.status` 기반 — 쿼리 타겟 테이블이 다름.
**How to avoid:** summary API가 4개 독립 쿼리를 병렬 실행 후 조립. `Promise.all` 로 동시 실행해 네트워크 라운드트립 감소.
```typescript
const [today, revenue, cancelled, active] = await Promise.all([
  this.db.select({ count: sql`count(*)::int` }).from(reservations).where(...),
  this.db.select({ sum: sql`coalesce(sum(${reservations.totalAmount}),0)::int` }).from(reservations).where(...),
  this.db.select({ count: sql`count(*)::int` }).from(reservations).where(...),
  this.db.select({ count: sql`count(*)::int` }).from(performances).where(inArray(performances.status, ['selling', 'closing_soon'])),
]);
```

### Pitfall 8: Drizzle SQL에서 `sql` 태그를 파라미터 바인딩 없이 문자열 인터폴레이션
**What goes wrong:** 동적 기간(7/30/90일)을 `sql.raw` 또는 문자열 연결로 주입 시 SQL injection 위험 + 타입 안전성 상실.
**How to avoid:** `sql` 태그 템플릿으로 Drizzle에 파라미터 바인딩 위임:
```typescript
const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90; // validated by zod before
.where(sql`${reservations.createdAt} >= now() - (${periodDays} || ' days')::interval`)
```
또는 `interval '30 days'` 리터럴은 상수 map으로 선택:
```typescript
const intervalSql = { '7d': sql`interval '7 days'`, '30d': sql`interval '30 days'`, '90d': sql`interval '90 days'` }[period];
```
**Warning signs:** Drizzle가 `[object Object]`를 SQL에 삽입, 또는 런타임 `SyntaxError`.
`[CITED: Drizzle docs https://orm.drizzle.team/docs/sql — "sql.raw() includes unescaped SQL directly"]`

## Runtime State Inventory

_이 phase는 신규 기능 추가 (rename/refactor 아님). 기존 데이터 마이그레이션 없음._

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: 새 테이블/컬럼 추가 없음, 기존 `reservations`/`payments`/`performances`/`showtimes` 스키마 그대로 read-only 집계 | 없음 |
| Live service config | None — verified: 신규 Cloud Run 환경변수 없음 (기존 `REDIS_URL` / `DATABASE_URL` 재사용) | 없음 |
| OS-registered state | None — verified: cron / pg-boss 작업 등록 없음 (캐시는 TTL-only) | 없음 |
| Secrets/env vars | None — verified: 신규 secret 0개 | 없음 |
| Build artifacts / installed packages | **recharts 신규 설치** + `apps/web/components/ui/chart.tsx` 생성 | `cd apps/web && pnpm dlx shadcn@latest add chart` 실행 후 `pnpm install` (monorepo lockfile 업데이트) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js + NestJS 런타임 | ✓ | 22.x | — |
| pnpm | Package manager | ✓ | 10.28.1 | — |
| PostgreSQL (dev) | Drizzle aggregation 테스트 | 프로젝트 dev Docker compose 확인 필요 | 16.x | testcontainers (기존 패턴, `apps/api/vitest.integration.config.ts`) |
| Valkey / Redis (dev) | CacheService read-through 테스트 | ✓ (Phase 7 완료) | 8.x | InMemoryRedis mock (기존 `redis.provider.ts`) |
| Docker | testcontainers | 로컬 개발자 머신 필수 | — | CI에서만 Docker-in-Docker 사용 (기존 패턴) |
| Playwright | E2E 대시보드 스모크 | ✓ | 1.59.1 | — |
| shadcn CLI | chart 컴포넌트 설치 | ✓ (npx 경유) | latest | — |

**Missing dependencies with no fallback:** 없음.

**Missing dependencies with fallback:** 없음.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| API framework | vitest 3.2.x (unit: `apps/api/vitest.config.ts`, integration: `apps/api/vitest.integration.config.ts`) |
| Web framework | vitest 3.2.x + @testing-library/react 16.x (`apps/web/vitest.config.ts`) |
| E2E framework | Playwright 1.59.1 (`apps/web/e2e/*.spec.ts`) |
| Quick run | API: `pnpm --filter @grapit/api test` <br> Web: `pnpm --filter @grapit/web test` |
| Full suite | 루트에서: `pnpm test` (turborepo → 모든 workspace 테스트) |
| Integration | API: `pnpm --filter @grapit/api test:integration` (testcontainers 기반 Valkey/Postgres 컨테이너) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADM-01 | summary API가 오늘 예매/매출/취소/활성공연 4개 수치 반환 | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::summary` | ❌ Wave 0 |
| ADM-01 | KST 23:59 예매는 오늘, 00:01 예매는 내일로 카운트 | unit (mock clock) | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::kst-boundary` | ❌ Wave 0 |
| ADM-02 | 일별 30일 revenue trend 반환 (배열 길이 ≤ 30) | unit + integration | `pnpm --filter @grapit/api test:integration -- admin-dashboard.integration.spec.ts::revenue-daily` | ❌ Wave 0 |
| ADM-02 | 주별 90일 revenue trend 반환 (배열 길이 ≤ 13) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::revenue-weekly` | ❌ Wave 0 |
| ADM-03 | 장르별 bookings count (7개 genre + '기타' 그룹) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::genre` | ❌ Wave 0 |
| ADM-04 | Top 10 performances (최근 30일 CONFIRMED, count desc) | unit + integration | `pnpm --filter @grapit/api test:integration -- admin-dashboard.integration.spec.ts::top10` | ❌ Wave 0 |
| ADM-05 | 결제수단별 count (CONFIRMED 결제만, status=DONE) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::payment` | ❌ Wave 0 |
| ADM-06 | Cache hit: cache.get이 값을 반환하면 DB 호출 0회 | unit (mock) | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::cache-hit` | ❌ Wave 0 |
| ADM-06 | Cache miss + set: cache.set이 정확히 ttlSeconds=60으로 호출 | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::cache-set-ttl` | ❌ Wave 0 |
| ADM-06 | Redis down graceful degradation: cache.get 실패 시 DB fallback | unit (mock throw) | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts::cache-degradation` | ❌ Wave 0 |
| ADM-01~05 UI | 대시보드 페이지 마운트 시 KPI/chart/table 4섹션 모두 렌더 | e2e smoke | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts::landing-smoke` | ❌ Wave 0 |
| D-09 UI | 기간 필터 30일 → 7일 클릭 시 3개 chart 동시 refetch | e2e | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts::period-filter` | ❌ Wave 0 |
| D-01/D-02/D-03 UI | `/admin` 접근 시 대시보드 렌더, sidebar '대시보드' 하이라이트 | e2e smoke | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts::sidebar-nav` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/api test admin-dashboard.service.spec.ts` (약 5-10초)
- **Per wave merge:** `pnpm test` (전체 monorepo turborepo 캐시 활용, ~30s)
- **Phase gate:** `pnpm test` + `pnpm --filter @grapit/api test:integration` + `pnpm --filter @grapit/web test:e2e`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts` — unit coverage (ADM-01~06 + cache patterns)
- [ ] `apps/api/test/admin-dashboard.integration.spec.ts` — integration w/ testcontainers (real Postgres + KST boundary + real cache)
- [ ] `apps/web/e2e/admin-dashboard.spec.ts` — E2E smoke + period filter + sidebar nav (기존 `admin-booking` E2E 없음 → 새로 기반)
- [ ] Playwright login helper에 admin seed 유저 사용 가능 여부 확인 (260413-jw1 admin@grapit.test seed 존재, 재사용)

*(프레임워크 install 불필요 — vitest/playwright 모두 기존 설치)*

### KST Boundary Test (mock clock)

핵심 회귀 포인트. vi.useFakeTimers + Postgres testcontainers 조합:
```typescript
// apps/api/test/admin-dashboard.integration.spec.ts (sketch)
beforeEach(async () => {
  await db.delete(reservations);
  // Insert: 2026-04-20 23:59 KST  (= 2026-04-20 14:59 UTC)
  await db.insert(reservations).values({ ..., createdAt: new Date('2026-04-20T14:59:00Z') });
  // Insert: 2026-04-21 00:01 KST  (= 2026-04-20 15:01 UTC)
  await db.insert(reservations).values({ ..., createdAt: new Date('2026-04-20T15:01:00Z') });
});

it('counts 23:59 KST reservation into today when now is 2026-04-20 23:30 KST', async () => {
  // Simulate now() via SET LOCAL with session time travel or just query with explicit today
  const result = await service.getSummary(); // expect todayBookings=1
});
```
프로덕션 now() 를 테스트에서 mock하기 어려울 경우, service에 `private getNow(): Date = () => new Date()` seam을 추가하고 unit test에서 override (integration은 real now).

### Cache Correctness Test (mock Redis)

```typescript
// apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts (sketch)
it('cache hit: does not call db when cache returns value', async () => {
  mockCache.get.mockResolvedValue({ todayBookings: 5, ... });
  const result = await service.getSummary();
  expect(mockDb.select).not.toHaveBeenCalled();
  expect(result.todayBookings).toBe(5);
});

it('cache set: called with ttlSeconds=60 exactly', async () => {
  mockCache.get.mockResolvedValue(null);
  mockDb.select.mockReturnValue(createChainMock([{ count: 10 }]));
  await service.getSummary();
  expect(mockCache.set).toHaveBeenCalledWith('cache:admin:dashboard:summary', expect.anything(), 60);
});

it('cache down: falls back to db gracefully', async () => {
  mockCache.get.mockResolvedValue(null); // graceful degradation already swallows errors internally
  mockCache.set.mockResolvedValue(undefined); // also swallows
  const result = await service.getSummary();
  expect(result).toBeDefined(); // no throw
});
```

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `apps/web/app/admin/layout.tsx`의 기존 admin role guard (useAuthStore), `@Roles('admin')` guard on controller |
| V3 Session Management | no | 신규 세션 없음, 기존 JWT cookie 재사용 |
| V4 Access Control | yes | `@Controller('admin/dashboard') @UseGuards(RolesGuard) @Roles('admin')` — `admin-booking.controller.ts:17-19` 패턴 그대로 |
| V5 Input Validation | yes | `ZodValidationPipe` + `periodQuerySchema` (Pattern 4) |
| V6 Cryptography | no | 신규 암호화 요구사항 없음 |
| V8 Data Protection | yes | 집계 결과는 PII 미포함 — 예매 수/매출/공연 제목만. 안전 |
| V9 Communications | yes | HTTPS (기존 Cloud Run 설정) |
| V12 Files & Resources | no | 파일 업로드 없음 |
| V14 Config | yes | `DASHBOARD_CACHE_TTL=60` 상수 하드코드 — env 분리 불필요 (TTL 값 공개되어도 위험 없음) |

### Known Threat Patterns for Admin Dashboard

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 비관리자가 dashboard API 직접 호출 | Elevation of Privilege | `@Roles('admin')` + RolesGuard (기존 패턴 재사용) |
| SQL injection via period param | Tampering | Zod enum validation + Drizzle sql tag 파라미터 바인딩 (Pitfall 8) |
| 민감 데이터 캐시 로그 노출 | Information Disclosure | `CacheService`가 이미 값이 아닌 `key` 구조만 로깅 (T-07-11 해결) |
| Denial of service via 느린 집계 쿼리 | DoS | 60s TTL이 DB 부하 흡수. 최악의 경우에도 `reservations` 인덱스(`idx_reservations_status`, `idx_reservations_created_at` 확인 필요) |
| Cache key 충돌로 다른 tenant 데이터 섞임 | Tampering | 단일 tenant (1인 관리자). 리스크 없음. 키 prefix `cache:admin:dashboard:*`는 네임스페이스 격리 유지 |

**Note on index coverage:** `reservations.createdAt`은 현재 인덱스 없음 (`reservations.ts:22-27` 확인 — status/userId/showtimeId/reservationNumber/tossOrderId만). 60s TTL이 커버하므로 당장은 불필요하나, **trend 쿼리가 slow query log에 나타나면 `idx_reservations_created_at` 추가 고려** (plan 외 관찰 과제). 현재 데이터량 기준 full scan 30일 필터는 acceptable.

## Code Examples

### Example 1: `getSummary()` 전체 구현 (ADM-01 + ADM-06)

```typescript
// apps/api/src/modules/admin/admin-dashboard.service.ts
// Source: compose from CacheService (apps/api/src/modules/performance/cache.service.ts)
//         + admin-booking.service.ts aggregation pattern
import { Injectable, Inject } from '@nestjs/common';
import { sql, eq, inArray } from 'drizzle-orm';
import { CacheService } from '../performance/cache.service.js';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import { reservations, performances } from '../../database/schema/index.js';

const DASHBOARD_CACHE_TTL = 60; // D-12

interface DashboardSummaryDto {
  todayBookings: number;
  todayRevenue: number;
  todayCancelled: number;
  activePerformances: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}

  private async readThrough<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetcher();
    await this.cache.set(key, fresh, DASHBOARD_CACHE_TTL);
    return fresh;
  }

  async getSummary(): Promise<DashboardSummaryDto> {
    return this.readThrough('cache:admin:dashboard:summary', async () => {
      const todayFilter = sql`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')
        AND ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' < date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') + interval '1 day'`;

      const [bookings, revenue, cancelled, active] = await Promise.all([
        this.db.select({ count: sql<number>`count(*)::int` })
          .from(reservations)
          .where(todayFilter),
        this.db.select({ sum: sql<number>`coalesce(sum(${reservations.totalAmount}), 0)::int` })
          .from(reservations)
          .where(sql`${todayFilter} AND ${reservations.status} = 'CONFIRMED'`),
        this.db.select({ count: sql<number>`count(*)::int` })
          .from(reservations)
          .where(sql`${todayFilter} AND ${reservations.status} = 'CANCELLED'`),
        this.db.select({ count: sql<number>`count(*)::int` })
          .from(performances)
          .where(inArray(performances.status, ['selling', 'closing_soon'])),
      ]);

      return {
        todayBookings: bookings[0]?.count ?? 0,
        todayRevenue: revenue[0]?.sum ?? 0,
        todayCancelled: cancelled[0]?.count ?? 0,
        activePerformances: active[0]?.count ?? 0,
      };
    });
  }
}
```

### Example 2: Revenue trend with daily/weekly auto-switch (ADM-02)

```typescript
async getRevenueTrend(period: DashboardPeriod): Promise<RevenueTrendDto[]> {
  return this.readThrough(`cache:admin:dashboard:revenue:${period}`, async () => {
    const granularity = period === '90d' ? 'week' : 'day';      // D-09
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const interval = sql.raw(`interval '${days} days'`);         // days is typed enum — safe
    const bucket = sql`date_trunc(${sql.raw(`'${granularity}'`)}, ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul')`;

    const rows = await this.db
      .select({
        bucket: sql<string>`to_char(${bucket}, ${granularity === 'week' ? sql.raw(`'IYYY-"W"IW'`) : sql.raw(`'YYYY-MM-DD'`)})`,
        revenue: sql<number>`coalesce(sum(${reservations.totalAmount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(reservations)
      .where(sql`${reservations.status} = 'CONFIRMED'
        AND ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - ${interval}`)
      .groupBy(bucket)
      .orderBy(bucket);

    return rows;
  });
}
```
**Note on `sql.raw` use:** `granularity` 와 `days`는 zod enum 으로 validated이므로 `sql.raw`에 넣어도 안전. 사용자 입력 문자열은 절대 `sql.raw`에 넣지 말 것 (Pitfall 8).

### Example 3: shadcn Chart Area 사용 (FE)

```typescript
// apps/web/components/admin/dashboard/revenue-area-chart.tsx
// Source: https://ui.shadcn.com/docs/components/chart
// + UI-SPEC §Chart color palette (--chart-1 = #6C3CE0 primary)
'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig: ChartConfig = {
  revenue: {
    label: '매출',
    color: 'var(--chart-1)', // UI-SPEC: purple primary
  },
};

export function RevenueAreaChart({ data }: { data: { bucket: string; revenue: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <AreaChart data={data} accessibilityLayer>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs"
        />
        <YAxis tickLine={false} axisLine={false} className="text-xs" />
        <ChartTooltip content={<ChartTooltipContent labelKey="bucket" nameKey="revenue" />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-1)"
          fill="url(#fillRevenue)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
```

### Example 4: shadcn Chart Donut 사용 (FE, ADM-03)

```typescript
// apps/web/components/admin/dashboard/genre-donut-chart.tsx
'use client';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function GenreDonutChart({ data }: { data: { genre: string; count: number }[] }) {
  const chartConfig = Object.fromEntries(
    data.map((d, i) => [d.genre, { label: d.genre, color: PALETTE[i % PALETTE.length] }]),
  );

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="genre" />} />
        <Pie data={data} dataKey="count" nameKey="genre" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="genre" />} />
      </PieChart>
    </ChartContainer>
  );
}
```

### Example 5: Top 10 performances query (ADM-04)

```typescript
async getTopPerformances(): Promise<TopPerformanceDto[]> {
  return this.readThrough('cache:admin:dashboard:top10', async () => {
    const thirtyDaysAgo = sql`date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') - interval '30 days'`;
    return this.db
      .select({
        performanceId: performances.id,
        title: performances.title,
        genre: performances.genre,
        posterUrl: performances.posterUrl,
        bookingCount: sql<number>`count(${reservations.id})::int`,
      })
      .from(reservations)
      .innerJoin(showtimes, eq(reservations.showtimeId, showtimes.id))
      .innerJoin(performances, eq(showtimes.performanceId, performances.id))
      .where(sql`${reservations.status} = 'CONFIRMED'
        AND ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= ${thirtyDaysAgo}`)
      .groupBy(performances.id, performances.title, performances.genre, performances.posterUrl)
      .orderBy(sql`count(${reservations.id}) desc`)
      .limit(10);
  });
}
```

### Example 6: TanStack Query 훅 세트 (FE)

```typescript
// apps/web/hooks/use-admin-dashboard.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  DashboardSummaryDto,
  DashboardRevenueDto,
  DashboardGenreDto,
  DashboardPaymentDto,
  DashboardTopDto,
  DashboardPeriod,
} from '@grapit/shared';

const STALE = 30_000;

export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['admin', 'dashboard', 'summary'],
    queryFn: () => apiClient.get<DashboardSummaryDto>('/api/v1/admin/dashboard/summary'),
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });

export const useDashboardRevenue = (period: DashboardPeriod) =>
  useQuery({
    queryKey: ['admin', 'dashboard', 'revenue', period],
    queryFn: () => apiClient.get<DashboardRevenueDto>(`/api/v1/admin/dashboard/revenue?period=${period}`),
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });

export const useDashboardGenre = (period: DashboardPeriod) =>
  useQuery({
    queryKey: ['admin', 'dashboard', 'genre', period],
    queryFn: () => apiClient.get<DashboardGenreDto>(`/api/v1/admin/dashboard/genre?period=${period}`),
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });

export const useDashboardPayment = (period: DashboardPeriod) =>
  useQuery({
    queryKey: ['admin', 'dashboard', 'payment', period],
    queryFn: () => apiClient.get<DashboardPaymentDto>(`/api/v1/admin/dashboard/payment?period=${period}`),
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });

export const useDashboardTop10 = () =>
  useQuery({
    queryKey: ['admin', 'dashboard', 'top10'],
    queryFn: () => apiClient.get<DashboardTopDto>('/api/v1/admin/dashboard/top-performances'),
    staleTime: STALE,
    refetchOnWindowFocus: false,
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `recharts` 2.x (React 18 only) | `recharts` 3.x (React 19 공식 지원) | 3.0 릴리스 2025-06 | peer warnings 제거, 단 react-is override 필요 여지 (Pitfall 1) |
| shadcn chart without Tailwind v4 | shadcn chart w/ Tailwind v4 CSS-first | 2025-08 (Tailwind v4 GA) | `:root { --chart-N }` 사용법 유효, `hsl(var(--chart-N))` 래핑 **미사용** (v4 token 호환) |
| Upstash HTTP Redis | ioredis TCP + Valkey | 2026-04-13 (Phase 7 완료) | `CacheService`는 이미 ioredis 전환 완료, 본 phase는 그대로 consume |
| class-validator DTO | zod + drizzle-zod | 2025-Q1 프로젝트 전체 표준 | dashboard DTO도 zod 사용 |
| Jest | vitest 3.x | 프로젝트 전체 | dashboard 테스트도 vitest |
| SSR + useEffect chart render | `'use client'` + `ChartContainer` | React 19 + Next.js 16 App Router | 모든 차트 래퍼에 `'use client'` 명시 (Pitfall 3) |

**Deprecated/outdated:**
- `recharts 2.x` 사용법(PropTypes-heavy): 3.x는 TypeScript-first. Generic types 강화.
- `Recharts` `<Tooltip>`/`<Legend>` 직접 사용: shadcn wrapper (`ChartTooltip`/`ChartLegend`) 사용 권장 (디자인 일관성).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PerformanceModule`이 `CacheService`를 외부 모듈에 export 가능 (exports 선언 또는 추가 가능) | Pattern 3 | **LOW** — `PerformanceModule`에 `exports: [CacheService]` 추가 필요할 수 있으나 이는 1줄 변경. 실제 `performance.module.ts` 확인은 plan 시 재점검 |
| A2 | "활성 공연" 정의 = `performances.status IN ('selling', 'closing_soon')` | Pitfall 6 | **MEDIUM** — Discretion 영역이나 대체 정의(판매 기간 내 + 매진 제외) 선택 여지. plan에서 code comment로 명시 필요 |
| A3 | reservation dataset 크기가 30일 full scan해도 60s TTL로 충분히 흡수 가능 | Security §DoS | **LOW** — Grapit MVP 규모 (초기 사용자 소수). 추후 slow query log 모니터링 필요 |
| A4 | `reservations.createdAt`이 예매 기준 시각 (결제 완료 시각 아님) | D-06 해석 | **LOW** — 테이블 스키마 확인됨. D-06이 `reservations.createdAt` 명시 |
| A5 | recharts 3.8.1이 React 19.2.3 회귀(#6857) 수정 포함 | Pitfall 1 | **MEDIUM** — 이슈 open 상태, 재현 미확인. plan Wave 0에 "차트 렌더 실측 + react-is override 대비" 포함 권장 |
| A6 | shadcn CLI `add chart`가 `apps/web/components.json` 기반으로 `apps/web/components/ui/chart.tsx`에 정확히 설치됨 | Installation | **LOW** — `components.json`에 `aliases.ui: "@/components/ui"` 설정 기 존재 (UI-SPEC confirmed) |
| A7 | 결제수단 분포(ADM-05)의 분자 = `payments` JOIN `reservations` WHERE `reservations.status='CONFIRMED'` | Pitfall 5 | **LOW** — D-07 매출 정의와 일관 (CONFIRMED 기준). 대체 정의 가능성 낮음 |
| A8 | Cloud Run `TZ` 환경변수 미설정 = UTC 기본값 | Pattern 2 | **LOW** — Cloud Run 문서 확인 가능, 컨테이너 Alpine/Debian 기본 UTC. 현재 프로젝트 Dockerfile에 `TZ` 설정 흔적 없음 |
| A9 | `date_trunc('week', ...)`의 주 시작이 월요일 (ISO 8601) | Example 2 | **LOW** — PostgreSQL 공식 동작, Asia/Seoul도 동일 (주 정의는 타임존과 독립) |
| A10 | TanStack Query v5의 `refetchOnWindowFocus: false` 동작이 Next.js 16 App Router에서 정상 | Pattern 5 | **LOW** — v5 글로벌 동작, Next.js 버전 무관 |

**Action on medium-risk assumptions:** Plan 생성 시 A2 (활성공연 정의), A5 (recharts 회귀 대비)는 명시적 code comment / Wave 0 verification task로 포함.

## Open Questions

1. **`PerformanceModule` export CacheService 여부**
   - What we know: `CacheService`가 `performance/cache.service.ts`에 있고 `PerformanceModule`에 provider로 등록되어 있을 가능성 높음.
   - What's unclear: `exports: [CacheService]` 선언이 이미 있는지. 없으면 `AdminDashboardService`에서 inject 실패.
   - Recommendation: Plan의 첫 task를 `performance.module.ts` 읽기 → 없으면 exports 추가하는 1-line diff task로 시작.

2. **Dev 환경 PostgreSQL 존재 여부**
   - What we know: `DATABASE_URL`이 프로덕션 및 개발 환경 모두에서 사용됨 (CLAUDE.md §Conventions). `apps/api/vitest.integration.config.ts`는 testcontainers 패턴 사용 (docker 필요).
   - What's unclear: 로컬 dev 워크플로우가 Cloud SQL proxy인지 Docker compose postgres인지 — 개발자 머신 기준.
   - Recommendation: Plan 실행 시 `docker ps | grep postgres` 또는 `.env`의 `DATABASE_URL`로 확인. 없으면 integration test 실행 skip하거나 dev env 설정이 Wave 0 블로커.

3. **Top 10의 썸네일 URL 유효성**
   - What we know: `performances.posterUrl`이 R2 CDN URL (Phase 8에서 프로덕션 연동됨).
   - What's unclear: 개발 환경에서 URL 접근 가능한지 (R2 public 버킷 + 커스텀 도메인 완료 상태지만 dev fallback 필요 여부).
   - Recommendation: Top 10 컴포넌트에 `posterUrl` null/404 대응 placeholder (lucide `Theater` 아이콘 등). UI-SPEC §Empty state 참조.

4. **기존 `admin-booking.service.ts`의 `getBookings` 와 중복 집계**
   - What we know: `admin-booking.service.ts:41-72`가 이미 `totalBookings` / `totalRevenue` / `cancelRate`를 계산 (bookings 리스트 응답에 포함).
   - What's unclear: dashboard summary를 bookings page에 재사용할 여지 — 하지만 D-07/D-08 정의가 "오늘" 기준인 반면 기존은 "전체". 별도.
   - Recommendation: 중복 제거 시도하지 말 것. 둘은 기간 필터가 달라 분리가 맞음. dashboard는 오늘, bookings page는 전체.

## Sources

### Primary (HIGH confidence)
- **Context7 `/shadcn-ui/ui`** — ChartContainer/ChartTooltip/chartConfig 구조 (Code Example 3, 4)
- **Context7 `/recharts/recharts`** — AreaChart 그라디언트 fill, PieChart `innerRadius` donut 패턴
- **Context7 `/tanstack/query`** — useQuery v5 options (`staleTime`, `gcTime`, `refetchOnWindowFocus`, `refetchInterval`)
- **Drizzle docs https://orm.drizzle.team/docs/sql** — sql 태그 vs sql.raw 사용법, `date_trunc` / `AT TIME ZONE` / `count(*)::int` / `coalesce(sum(...), 0)::int` 패턴
- **npm registry**: recharts@3.8.1 version + peerDependencies verified via `npm view`
- **Grapit 코드베이스** — `cache.service.ts`, `admin-booking.service.ts`, `admin.module.ts`, `zod-validation.pipe.ts`, `use-admin.ts` 실측

### Secondary (MEDIUM confidence)
- **dev.to guide https://dev.to/jacksonkasi/the-developers-guide-to-never-messing-up-time-zones-again-a-typescript-drizzle-and-postgresql-4970** — PostgreSQL + Drizzle + timezone best practice
- **GitHub discussion https://github.com/drizzle-team/drizzle-orm/discussions/2893** — acharlop의 검증된 sql + groupBy 패턴
- **shadcn docs https://ui.shadcn.com/docs/components/chart** — 설치 명령 + CSS var 규약

### Tertiary (LOW confidence, flagged for validation)
- **recharts#6857 React 19.2.3 회귀** — 이슈 open, 재현 미확인. Pitfall 1에서 workaround 제시하되 plan Wave 0에 실측 검증 task 권장.
- **Cloud Run 기본 TZ=UTC** — 일반 지식 + Dockerfile 흔적. 실 환경 `date` 커맨드로 확인 권장.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — 모든 라이브러리 npm registry + Context7 교차 검증, 버전 현재 (recharts 3.8.1 = 2026-03-25 배포).
- Architecture: **HIGH** — 기존 코드 패턴(`admin-booking.service.ts`, `cache.service.ts`, `use-admin.ts`) 직접 확장이므로 이질적 판단 불필요.
- Pitfalls: **MEDIUM-HIGH** — recharts 3.x + React 19.2.3 회귀(Pitfall 1)는 매개변수화된 관찰 영역. 나머지(KST, 캐시 TTL, zod, server component)는 HIGH.
- Security: **HIGH** — ASVS 매핑 기존 패턴(@Roles + ZodValidationPipe) 그대로 재사용. 신규 보안 표면 없음.
- Validation: **HIGH** — vitest + playwright 기존 인프라에 spec 파일 추가만 필요.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30일; stable stack, recharts React 19 생태계 회귀 이슈 진행 중이므로 재점검 필요할 수 있음)

## Project Constraints (from CLAUDE.md)

다음 프로젝트 directive가 대시보드 구현에 적용된다 (planner가 위반 여부 검증):

- **ESM only:** `import`/`export` 사용. `require` 금지. NestJS 파일 확장자 `.js` 명시 (기존 패턴).
- **No `any`, strict typing everywhere:** Drizzle sql 태그에 generic (`sql<number>`), zod inferred types 사용.
- **Functional patterns preferred:** Service는 class (NestJS DI 외부 인터페이스), 그 외 helper는 함수.
- **Typecheck after changes:** `pnpm typecheck` 통과 필수.
- **Lint after changes:** `pnpm lint` 통과 필수.
- **Tests before implementation for business logic/API:** `admin-dashboard.service.spec.ts`를 구현 이전에 먼저 작성 권장.
- **Korean 응답:** 커밋 메시지/PR 코멘트/문서 한국어 (conventional commits prefix는 영어 유지).
- **Conventional commits:** `feat(11)`, `test(11)`, `refactor(11)`, `docs(11)` 사용.
- **NEVER add Co-Authored-By trailers.** 사용자가 단독 저자.
- **NEVER bypass pre-commit hooks with `--no-verify`.**
- **No direct edits outside GSD workflow:** `/gsd:execute-phase`로 실행.
- **.env: monorepo root only.** 신규 env 없으므로 무관.
- **drizzle-kit: `DOTENV_CONFIG_PATH=../../.env` 필수.** 본 phase는 마이그레이션 없으므로 무관.
- **dev ports: web=3000, api=8080.** 변경 없음.
- **복잡도 최소화 (1인 개발).** 새 NestJS 모듈 분리 대신 `AdminModule` 확장, TTL-only 무효화 (복잡한 invalidate tree 회피).
- **모놀리스 우선.** 본 phase는 기존 monolith 내 read-only 레이어 추가.
- **실 서비스 런칭 목표.** E2E 스모크 테스트로 회귀 방지.
