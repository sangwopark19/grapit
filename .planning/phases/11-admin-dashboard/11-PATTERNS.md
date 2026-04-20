# Phase 11: 어드민 대시보드 - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 14 files to create/modify
**Analogs found:** 13 / 14 (1 file (`admin-dashboard.schemas.ts`)는 기존 zod 스키마 조각에서 직접 복사 가능, 완전 analog는 없음 — Match Quality: role-match)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/modules/admin/admin-dashboard.controller.ts` (new) | backend controller | request-response (GET × 5) | `apps/api/src/modules/admin/admin-booking.controller.ts` | exact |
| `apps/api/src/modules/admin/admin-dashboard.service.ts` (new) | backend service | read aggregation → cache → json response | `apps/api/src/modules/admin/admin-booking.service.ts` + `apps/api/src/modules/performance/cache.service.ts` | exact (compose) |
| `apps/api/src/modules/admin/admin-dashboard.schemas.ts` (new) | zod schema module | param validation (enum `'7d' \| '30d' \| '90d'`) | `packages/shared/src/schemas/booking.schema.ts` (`adminRefundSchema`) | role-match |
| `apps/api/src/modules/admin/admin.module.ts` (modify) | NestJS module wiring | DI registration | same file (current state) | exact |
| `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts` (new) | vitest unit spec | mock db + mock cache | `apps/api/src/modules/admin/admin-booking.service.spec.ts` + `apps/api/src/modules/performance/__tests__/cache.service.spec.ts` | exact |
| `apps/api/test/admin-dashboard.integration.spec.ts` (new) | vitest integration spec (testcontainers) | real Postgres + real Valkey roundtrip | `apps/api/test/sms-throttle.integration.spec.ts` | role-match (different subject, same framework/container pattern) |
| `apps/web/app/admin/page.tsx` (new) | Next.js App Router page | client-side composition (renders hooks-driven panels) | `apps/web/app/admin/bookings/page.tsx` (thin) + `apps/web/app/admin/performances/page.tsx` (full) | exact |
| `apps/web/hooks/use-admin-dashboard.ts` (new) | TanStack Query hook module | fetch via `apiClient.get<T>` + useQuery | `apps/web/hooks/use-admin.ts`, `apps/web/hooks/use-reservations.ts` | exact |
| `apps/web/components/admin/dashboard/revenue-area-chart.tsx` (new) | client component (chart wrapper) | render chart from TanStack Query data | shadcn Chart docs (no local analog — first chart in project) + `apps/web/components/admin/admin-stat-card.tsx` (props shape style) | partial (no existing chart — use RESEARCH §Code Example 3) |
| `apps/web/components/admin/dashboard/genre-donut-chart.tsx` (new) | client component | render donut from TanStack Query data | same as revenue-area-chart | partial |
| `apps/web/components/admin/dashboard/payment-bar-chart.tsx` (new) | client component | render bar from TanStack Query data | same as revenue-area-chart | partial |
| `apps/web/components/admin/dashboard/top-performances-table.tsx` (new) | client component (table) | tanstack query rows → table | `apps/web/components/admin/admin-booking-table.tsx` | exact |
| `apps/web/components/admin/dashboard/period-filter.tsx` (new) | client component (toggle group) | state lift to parent | `apps/web/components/admin/status-filter.tsx` (same project pattern) — 미열람, RESEARCH D-09 + shadcn toggle-group 기준 | role-match |
| `apps/web/components/admin/admin-sidebar.tsx` (modify — NAV_ITEMS + logo href) | client component | 2-line diff (add LayoutDashboard item, swap logo href) | current file itself | exact |
| `apps/web/components/ui/chart.tsx` (new — shadcn add) | shadcn primitive (pasted by CLI) | N/A (emitted file) | shadcn CLI output | exact |
| `apps/web/e2e/admin-dashboard.spec.ts` (new) | playwright e2e | loginAsTestUser + page.goto + assert | `apps/web/e2e/toss-payment.spec.ts` (login + navigation + assert pattern) | exact |

---

## Pattern Assignments

### `apps/api/src/modules/admin/admin-dashboard.controller.ts` (backend controller, request-response)

**Analog:** `apps/api/src/modules/admin/admin-booking.controller.ts`

**Imports pattern** (analog lines 1-14):
```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { adminRefundSchema, type AdminRefundInput } from '@grapit/shared';
import { AdminBookingService } from './admin-booking.service.js';
```

Note: `.js` 확장자 ESM import 컨벤션 필수 (CLAUDE.md).

**Controller decorator + guard pattern** (analog lines 16-19):
```typescript
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminBookingController {
  constructor(
    private readonly adminBookingService: AdminBookingService,
  ) {}
```

**For Phase 11:** apply to new `@Controller('admin/dashboard')` — `RolesGuard + @Roles('admin')` 동일 적용. 5개 엔드포인트는 `@Get('summary')`, `@Get('revenue')`, `@Get('genre')`, `@Get('payment')`, `@Get('top-performances')`.

**Zod validation + Query handler pattern** (analog lines 42-49, for POST; GET uses `@Query`):
```typescript
@Post('bookings/:id/refund')
async refundBooking(
  @Param('id') id: string,
  @Body(new ZodValidationPipe(adminRefundSchema)) body: AdminRefundInput,
) {
  await this.adminBookingService.refundBooking(id, body.reason);
  return { message: '환불이 처리되었습니다' };
}
```

**For Phase 11 GET with `@Query`:** RESEARCH §Pattern 4 Example already concrete:
```typescript
@Get('dashboard/revenue')
async getRevenue(
  @Query(new ZodValidationPipe(periodQuerySchema)) query: { period: DashboardPeriod },
) {
  return this.service.getRevenueTrend(query.period);
}
```

---

### `apps/api/src/modules/admin/admin-dashboard.service.ts` (backend service, CRUD-read + cache)

**Analog A:** `apps/api/src/modules/admin/admin-booking.service.ts` (aggregation queries)
**Analog B:** `apps/api/src/modules/performance/cache.service.ts` (cache wrapper)

**Imports pattern** (analog A lines 1-20, adapt by dropping write-side deps):
```typescript
import {
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.provider.js';
import {
  reservations,
  payments,
  showtimes,
  performances,
} from '../../database/schema/index.js';
import { CacheService } from '../performance/cache.service.js';
```

**Injectable + DI pattern** (analog A lines 31-39):
```typescript
@Injectable()
export class AdminBookingService {
  private readonly logger = new Logger(AdminBookingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tossClient: TossPaymentsClient,
    private readonly bookingGateway: BookingGateway,
  ) {}
```

**For Phase 11:** inject `DRIZZLE` + `CacheService` only (no toss/gateway):
```typescript
@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cache: CacheService,
  ) {}
```

**Drizzle aggregation pattern** (analog A lines 51-72) — copy these exact SQL idioms:
```typescript
// Stats: total bookings
const [totalResult] = await this.db
  .select({ count: sql<number>`count(*)::int` })
  .from(reservations);

// Stats: total revenue (CONFIRMED only)
const [revenueResult] = await this.db
  .select({ sum: sql<number>`coalesce(sum(${reservations.totalAmount}), 0)::int` })
  .from(reservations)
  .where(eq(reservations.status, 'CONFIRMED'));

// Stats: cancelled count
const [cancelledResult] = await this.db
  .select({ count: sql<number>`count(*)::int` })
  .from(reservations)
  .where(eq(reservations.status, 'CANCELLED'));
```

**KST 자정 필터 + date_trunc pattern** (RESEARCH §Pattern 2 Code Example — project에 기존 analog 없음, RESEARCH가 authoritative):
```typescript
const todayFilter = sql`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')
  AND ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' < date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') + interval '1 day'`;
```

**Read-through cache template** (analog B lines 41-65 for signature, RESEARCH §Pattern 1 for composition):
```typescript
// CacheService.get — null on miss/error (graceful)
async get<T>(key: string): Promise<T | null> { /* see cache.service.ts:41-53 */ }

// CacheService.set — ttlSeconds는 세 번째 인자 (DEFAULT_TTL=300 override)
async set(key: string, data: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void>
```

**For Phase 11 readThrough helper:**
```typescript
const DASHBOARD_CACHE_TTL = 60; // D-12 — always pass explicitly, never rely on DEFAULT_TTL

private async readThrough<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await this.cache.get<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await this.cache.set(key, fresh, DASHBOARD_CACHE_TTL);
  return fresh;
}
```

**Promise.all parallel aggregation** (RESEARCH §Pitfall 7 Code Example) — use for `getSummary()` 4-way fan-out:
```typescript
const [bookings, revenue, cancelled, active] = await Promise.all([
  this.db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(todayFilter),
  this.db.select({ sum: sql<number>`coalesce(sum(${reservations.totalAmount}), 0)::int` })
    .from(reservations).where(sql`${todayFilter} AND ${reservations.status} = 'CONFIRMED'`),
  this.db.select({ count: sql<number>`count(*)::int` })
    .from(reservations).where(sql`${todayFilter} AND ${reservations.status} = 'CANCELLED'`),
  this.db.select({ count: sql<number>`count(*)::int` })
    .from(performances).where(inArray(performances.status, ['selling', 'closing_soon'])),
]);
```

---

### `apps/api/src/modules/admin/admin-dashboard.schemas.ts` (zod schema module)

**Analog:** `packages/shared/src/schemas/booking.schema.ts` (lines 34-38 — `adminRefundSchema`)

**Schema pattern** (analog lines 28-38):
```typescript
import { z } from 'zod';

export const cancelReservationSchema = z.object({
  reason: z.string().min(1, '취소 사유를 입력해주세요').max(200, '취소 사유는 200자 이내로 입력해주세요'),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export const adminRefundSchema = z.object({
  reason: z.string().min(1, '환불 사유를 입력해주세요').max(200, '환불 사유는 200자 이내로 입력해주세요'),
});

export type AdminRefundInput = z.infer<typeof adminRefundSchema>;
```

**For Phase 11** (RESEARCH §Pattern 4 — schema 위치는 planner 재량, `packages/shared` 선호하면 `packages/shared/src/schemas/admin-dashboard.schema.ts`로 이동):
```typescript
import { z } from 'zod';

export const dashboardPeriodSchema = z.enum(['7d', '30d', '90d']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const periodQuerySchema = z.object({
  period: dashboardPeriodSchema.default('30d'),
});
```

`packages/shared/src/index.ts`의 re-export 패턴 준수 (lines 1-15):
```typescript
export * from './schemas/booking.schema';
// → add: export * from './schemas/admin-dashboard.schema';
```

---

### `apps/api/src/modules/admin/admin.module.ts` (module wiring, modify)

**Analog:** same file (current state, lines 1-19).

**Current state:**
```typescript
import { Module } from '@nestjs/common';
import { PerformanceModule } from '../performance/performance.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { BookingModule } from '../booking/booking.module.js';
import { AdminPerformanceController } from './admin-performance.controller.js';
import { AdminBannerController } from './admin-banner.controller.js';
import { AdminBookingController } from './admin-booking.controller.js';
import { LocalUploadController } from './local-upload.controller.js';
import { AdminService } from './admin.service.js';
import { AdminBookingService } from './admin-booking.service.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [PerformanceModule, PaymentModule, BookingModule],
  controllers: [AdminPerformanceController, AdminBannerController, AdminBookingController, LocalUploadController],
  providers: [AdminService, AdminBookingService, UploadService],
})
export class AdminModule {}
```

**For Phase 11 diff** (RESEARCH §Pattern 3):
- Add import: `AdminDashboardController`, `AdminDashboardService`
- Append to `controllers` array + `providers` array
- `imports: [PerformanceModule, ...]` — `PerformanceModule` **already exports** `CacheService` (see `performance/performance.module.ts:12 exports: [PerformanceService, CacheService]`) → zero additional wiring needed (resolves RESEARCH Open Question 1).

---

### `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts` (vitest unit spec)

**Analog A:** `apps/api/src/modules/admin/admin-booking.service.spec.ts`
**Analog B:** `apps/api/src/modules/performance/__tests__/cache.service.spec.ts`

**Imports + mock factory pattern** (analog A lines 1-13):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AdminBookingService } from './admin-booking.service.js';
import { TossPaymentsClient } from '../payment/toss-payments.client.js';

function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };
}
```

**Chainable proxy mock pattern for Drizzle query builder** (analog A lines 48-65):
```typescript
// Helper: creates a deeply chainable mock (supports any method chain)
function createChainMock(resolvedValue: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(resolvedValue);
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

// Stats queries: totalBookings, totalRevenue, cancelledCount, then list query
mockDb.select
  .mockReturnValueOnce(createChainMock([{ count: 10 }]))        // total bookings
  .mockReturnValueOnce(createChainMock([{ sum: 1500000 }]))     // total revenue
  .mockReturnValueOnce(createChainMock([{ count: 2 }]))         // cancelled count
  .mockReturnValueOnce(createChainMock([]));                     // bookings list (empty for simplicity)
```

**Constructor DI wiring** (analog A lines 35-43):
```typescript
service = new AdminBookingService(
  mockDb as any,
  mockTossClient as unknown as TossPaymentsClient,
);
```

**For Phase 11:** use `mockDb` + `mockCache` (mockCache = `{ get: vi.fn(), set: vi.fn(), invalidate: vi.fn(), invalidatePattern: vi.fn() }`).

**Cache test patterns** (analog B lines 36-70 — copy for cache-hit / cache-miss / graceful-degradation assertions):
```typescript
describe('get()', () => {
  it('returns null when key does not exist', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const result = await service.get<{ id: string }>('cache:test:missing');
    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalledWith('cache:test:missing');
  });
  // ...
});
```

**Test shape expected for Phase 11** (RESEARCH §Cache Correctness Test sketch):
```typescript
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
```

---

### `apps/api/test/admin-dashboard.integration.spec.ts` (vitest integration — testcontainers)

**Analog:** `apps/api/test/sms-throttle.integration.spec.ts`

**Imports + container setup pattern** (analog lines 1-11, 56-101):
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Test } from '@nestjs/testing';
import { type INestApplication, HttpStatus } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import IORedis from 'ioredis';
import request from 'supertest';

describe('...', () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let redis: IORedis;

  beforeAll(async () => {
    // Start Valkey container
    container = await new GenericContainer('valkey/valkey:8')
      .withExposedPorts(6379)
      .start();
    // ... create redis client, build TestingModule
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await redis?.quit();
    await container?.stop();
  });
});
```

**For Phase 11:** additionally start a **Postgres testcontainer** (RESEARCH §KST Boundary Test) — pattern for Postgres:
```typescript
// Need Postgres container too (not in analog; see drizzle docs)
const pgContainer = await new GenericContainer('postgres:16')
  .withExposedPorts(5432)
  .withEnvironment({ POSTGRES_PASSWORD: 'test' })
  .start();
```

**KST boundary seed + assertion pattern** (RESEARCH §KST Boundary Test):
```typescript
beforeEach(async () => {
  await db.delete(reservations);
  // Insert: 2026-04-20 23:59 KST  (= 2026-04-20 14:59 UTC)
  await db.insert(reservations).values({ ..., createdAt: new Date('2026-04-20T14:59:00Z') });
  // Insert: 2026-04-21 00:01 KST  (= 2026-04-20 15:01 UTC)
  await db.insert(reservations).values({ ..., createdAt: new Date('2026-04-20T15:01:00Z') });
});

it('counts 23:59 KST reservation into today when now is 2026-04-20 23:30 KST', async () => {
  const result = await service.getSummary(); // expect todayBookings=1
});
```

---

### `apps/web/app/admin/page.tsx` (Next.js App Router page, new)

**Analog:** `apps/web/app/admin/bookings/page.tsx` (thin shell) + `apps/web/components/admin/admin-booking-dashboard.tsx` (composition of hooks + StatCard grid)

**Thin page shell pattern** (analog `bookings/page.tsx` all 5 lines):
```typescript
import { AdminBookingDashboard } from '@/components/admin/admin-booking-dashboard';

export default function AdminBookingsPage() {
  return <AdminBookingDashboard />;
}
```

**Composition pattern from admin-booking-dashboard.tsx** (analog lines 1-17, 72-96):
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Ticket, Banknote, RotateCcw } from 'lucide-react';
import { AdminStatCard } from '@/components/admin/admin-stat-card';

export function AdminBookingDashboard() {
  // ...hooks here
  const stats = data?.stats;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">예매 관리</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AdminStatCard icon={Ticket} label="총 예매수" value={stats?.totalBookings ?? 0} format="count" />
        <AdminStatCard icon={Banknote} label="총 매출액" value={stats?.totalRevenue ?? 0} format="currency" />
        <AdminStatCard icon={RotateCcw} label="취소율" value={stats?.cancelRate ?? 0} format="percent" />
      </div>
      {/* ... */}
    </div>
  );
}
```

**For Phase 11:**
- Top `<h1>` uses `text-xl font-semibold text-gray-900` (UI-SPEC Typography row).
- KPI grid `grid-cols-2 lg:grid-cols-4 gap-4` (UI-SPEC Layout, 4 cards instead of 3).
- `AdminStatCard` icons per UI-SPEC §Icon assignments: `Ticket`, `Banknote`, `RotateCcw`, `Theater`.
- Page file **must** be `'use client'` (RESEARCH Pitfall 3 — recharts is client-only and hooks are client-only).

---

### `apps/web/hooks/use-admin-dashboard.ts` (TanStack Query hooks, new)

**Analog:** `apps/web/hooks/use-admin.ts` (lines 1-43), `apps/web/hooks/use-reservations.ts`

**Imports + useQuery shape pattern** (analog use-admin.ts lines 1-33):
```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  PerformanceListResponse,
  // ...
} from '@grapit/shared';

export function useAdminPerformances(params: {
  status?: string;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'performances', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      searchParams.set('page', String(params.page ?? 1));
      return apiClient.get<PerformanceListResponse>(
        `/api/v1/admin/performances?${searchParams.toString()}`,
      );
    },
  });
}
```

**keepPreviousData pattern** from `use-reservations.ts` lines 18-29 (optional for period-switching UX to avoid skeleton flash):
```typescript
import { keepPreviousData } from '@tanstack/react-query';

return useQuery({
  queryKey: ['reservations', 'me', status ?? 'all'],
  queryFn: () => { /* ... */ },
  placeholderData: keepPreviousData,
});
```

**For Phase 11 (RESEARCH §Pattern 5 Code Example 6):** 5 named hooks in single file with `staleTime=30_000` + `refetchOnWindowFocus: false`:
```typescript
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
// ... genre, payment, top10 (top10 has no period param)
```

---

### `apps/web/components/admin/dashboard/revenue-area-chart.tsx` (chart wrapper, new)

**Analog:** No existing chart in codebase — follow RESEARCH §Code Example 3 (authoritative) + `admin-stat-card.tsx` for props-typed client-component scaffolding.

**Client directive + props shape** (from admin-stat-card.tsx lines 1-10):
```typescript
'use client';

import type { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  format: 'count' | 'currency' | 'percent';
}
```

**For Phase 11** (RESEARCH §Code Example 3 — copy verbatim):
```typescript
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
    color: 'var(--chart-1)', // UI-SPEC: purple primary #6C3CE0
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
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
        <YAxis tickLine={false} axisLine={false} className="text-xs" />
        <ChartTooltip content={<ChartTooltipContent labelKey="bucket" nameKey="revenue" />} />
        <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" fill="url(#fillRevenue)" />
      </AreaChart>
    </ChartContainer>
  );
}
```

---

### `apps/web/components/admin/dashboard/genre-donut-chart.tsx` (chart wrapper, new)

**Analog:** RESEARCH §Code Example 4 (authoritative).

Copy verbatim from RESEARCH, `innerRadius={60} outerRadius={100}` for donut shape. PALETTE 5-color array uses `var(--chart-1)` through `var(--chart-5)` per UI-SPEC §Chart color palette (purple-gradient monochrome, not rainbow).

---

### `apps/web/components/admin/dashboard/payment-bar-chart.tsx` (chart wrapper, new)

**Analog:** No direct RESEARCH example, but pattern mirrors donut — adapt shadcn Chart `BarChart`:
```typescript
'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const chartConfig: ChartConfig = {
  count: { label: '건수', color: 'var(--chart-1)' },
};

export function PaymentBarChart({ data }: { data: { method: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="method" tickLine={false} axisLine={false} className="text-xs" />
        <YAxis tickLine={false} axisLine={false} className="text-xs" />
        <ChartTooltip content={<ChartTooltipContent nameKey="method" />} />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
```

---

### `apps/web/components/admin/dashboard/top-performances-table.tsx` (table, new)

**Analog:** `apps/web/components/admin/admin-booking-table.tsx`

**Imports pattern** (analog lines 1-13):
```typescript
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
```

**Table with skeleton + empty + rows tri-state pattern** (analog lines 66-167):
```typescript
<div className="rounded-lg bg-white shadow-sm">
  <Table>
    <TableHeader>
      <TableRow className="bg-[#F5F5F7]">
        <TableHead scope="col" className="text-sm font-semibold text-gray-600">예매번호</TableHead>
        {/* ... */}
      </TableRow>
    </TableHeader>
    <TableBody>
      {isLoading && Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          {/* ... */}
        </TableRow>
      ))}

      {!isLoading && bookings.length === 0 && (
        <TableRow>
          <TableCell colSpan={7} className="py-12 text-center">
            <p className="text-base font-semibold text-gray-900">예매 내역이 없습니다</p>
            <p className="mt-1 text-sm text-gray-600">아직 예매가 접수되지 않았습니다</p>
          </TableCell>
        </TableRow>
      )}

      {!isLoading && bookings.map((booking) => (
        <TableRow key={booking.id} /* ... */>
          {/* row cells */}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**For Phase 11:** columns = 순위 / 썸네일 / 공연명 / 장르 / 예매수. Empty state copy per UI-SPEC §Copywriting: `아직 인기 공연이 없습니다 / 최근 30일 예매가 누적되면 랭킹이 표시됩니다`.

---

### `apps/web/components/admin/dashboard/period-filter.tsx` (toggle group, new)

**Analog (conceptual):** `apps/web/components/admin/status-filter.tsx` (not read — name-based assumption from CONTEXT §code_context); `apps/web/components/ui/tabs.tsx` exists (see ls output).

**shadcn ToggleGroup install** (if absent):
```bash
cd apps/web && pnpm dlx shadcn@latest add toggle-group
```

**Pattern (UI-SPEC Component Inventory + interaction contract):**
```typescript
'use client';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DashboardPeriod } from '@grapit/shared';

interface PeriodFilterProps {
  value: DashboardPeriod;
  onChange: (v: DashboardPeriod) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as DashboardPeriod)}
      aria-label="기간 선택"
    >
      <ToggleGroupItem value="7d">7일</ToggleGroupItem>
      <ToggleGroupItem value="30d">30일</ToggleGroupItem>
      <ToggleGroupItem value="90d">90일</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

---

### `apps/web/components/admin/admin-sidebar.tsx` (modify, 2-line diff)

**Analog:** same file (current state).

**Current relevant lines** (1-24, 32):
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Theater, Image, Ticket } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { label: '공연 관리', href: '/admin/performances', icon: Theater },
  { label: '배너 관리', href: '/admin/banners', icon: Image },
  { label: '예매 관리', href: '/admin/bookings', icon: Ticket },
] as const;

// ...line 32:
<Link href="/admin/performances" className="text-lg font-semibold">
  Grapit Admin
</Link>
```

**For Phase 11 diff (CONTEXT D-02, D-03):**
1. Add `LayoutDashboard` to lucide-react import.
2. Prepend NAV_ITEMS: `{ label: '대시보드', href: '/admin', icon: LayoutDashboard }`.
3. Change line 32 `href="/admin/performances"` → `href="/admin"`.

**Active-item highlight pattern preserved** (lines 37-48 — `pathname.startsWith(item.href)` check will work for `/admin` exact match; but planner should use `pathname === '/admin'` for dashboard to avoid matching child admin routes, see Pitfall note):
```typescript
const isActive = pathname.startsWith(item.href);
// For dashboard NAV item specifically, use:
// const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
```

---

### `apps/web/components/ui/chart.tsx` (shadcn add, new)

**Analog:** shadcn CLI emission (no local analog).

**Installation** (RESEARCH §Standard Stack §Installation):
```bash
cd apps/web && pnpm dlx shadcn@latest add chart
# This emits apps/web/components/ui/chart.tsx and adds recharts to apps/web/package.json
# Also injects --chart-1~5 CSS variables into apps/web/app/globals.css :root block
```

**Post-install hand-edit** (UI-SPEC §Chart color palette — planner **must** override defaults):
```css
/* apps/web/app/globals.css :root */
--chart-1: #6C3CE0; /* primary */
--chart-2: #8B6DE8;
--chart-3: #B8A3EF;
--chart-4: #D1D1DB;
--chart-5: #A1A1AA;
```

---

### `apps/web/e2e/admin-dashboard.spec.ts` (playwright e2e, new)

**Analog:** `apps/web/e2e/toss-payment.spec.ts`

**Imports + login + navigate pattern** (analog lines 1-47):
```typescript
import { test, expect, type Route } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Admin Dashboard E2E', () => {
  test('landing-smoke: /admin renders dashboard with KPI + charts + Top10', async ({ page }) => {
    await loginAsTestUser(page); // seeds admin@grapit.test cookie (default in helpers/auth.ts:42)
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    // Assert h1 copy per UI-SPEC
    await expect(page.getByRole('heading', { name: '대시보드', level: 1 })).toBeVisible();
    // Assert KPI cards
    await expect(page.getByText('오늘 예매수')).toBeVisible();
    await expect(page.getByText('오늘 매출')).toBeVisible();
    // ... etc
  });
});
```

**Login helper** (`apps/web/e2e/helpers/auth.ts:42`) already seeds `admin@grapit.test` by default — ready to reuse.

**Period filter E2E pattern** (adapt from toss-payment.spec.ts URL-navigation style):
```typescript
test('period-filter: 30일 → 7일 클릭 시 3개 chart 동시 refetch', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/admin');
  await page.getByRole('group', { name: '기간 선택' }).getByText('7일').click();
  // Assert 3 charts re-render (waitForResponse × 3 on /api/v1/admin/dashboard/{revenue,genre,payment})
});
```

**Sidebar nav E2E pattern:**
```typescript
test('sidebar-nav: 대시보드 NAV 하이라이트', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/admin');
  // Active state class 'bg-primary/5 text-primary' on 대시보드 item
  const dashboardLink = page.getByRole('link', { name: /대시보드/ }).first();
  await expect(dashboardLink).toHaveClass(/text-primary/);
});
```

---

## Shared Patterns

### Authentication + Role Guard (backend)
**Source:** `apps/api/src/common/guards/roles.guard.ts` + `apps/api/src/common/decorators/roles.decorator.ts`
**Apply to:** `admin-dashboard.controller.ts`

**Guard definition** (roles.guard.ts lines 1-22):
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest() as { user: { role: string } };
    return requiredRoles.includes(user.role);
  }
}
```

**Decorator definition** (roles.decorator.ts, full file):
```typescript
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Apply pattern:**
```typescript
@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminDashboardController { /* ... */ }
```

---

### Cache Service (backend)
**Source:** `apps/api/src/modules/performance/cache.service.ts` (full file)
**Apply to:** `admin-dashboard.service.ts` — inject and wrap DB calls with `readThrough<T>()`

**Key API signatures** (cache.service.ts lines 41-65):
```typescript
async get<T>(key: string): Promise<T | null>;
async set(key: string, data: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void>;
async invalidate(...keys: string[]): Promise<void>;
async invalidatePattern(pattern: string): Promise<void>;
```

**Graceful degradation contract** (lines 46-52, 58-64) — already implemented:
- `get()` returns `null` on any error (swallow + warn log).
- `set()` swallows + warns — never throws.
- `invalidate*()` swallows + warns — DB commit never rolled back by cache outage.

**Critical rule** (RESEARCH Anti-Pattern §3): **never omit the 3rd arg to `set()`**. Always pass `60`:
```typescript
await this.cache.set(key, fresh, DASHBOARD_CACHE_TTL); // DASHBOARD_CACHE_TTL = 60
// NOT: await this.cache.set(key, fresh); // would default to 300 — D-12 violation
```

---

### Zod Validation Pipe (backend)
**Source:** `apps/api/src/common/pipes/zod-validation.pipe.ts` (full file)
**Apply to:** `admin-dashboard.controller.ts` `@Query` and `@Body` parameters

**Pipe implementation** (lines 1-31):
```typescript
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: unknown) {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const zodError = result.error as ZodError;
      throw new BadRequestException({
        message: 'Validation failed',
        errors: zodError.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
```

**Apply pattern:**
```typescript
@Get('dashboard/revenue')
async getRevenue(
  @Query(new ZodValidationPipe(periodQuerySchema)) query: { period: DashboardPeriod },
) { /* ... */ }
```

---

### Drizzle SQL Aggregation Idioms
**Source:** `apps/api/src/modules/admin/admin-booking.service.ts:51-72` + RESEARCH §Pattern 2 for KST
**Apply to:** every aggregation query in `admin-dashboard.service.ts`

**Count**: `sql<number>\`count(*)::int\``
**Sum coalesce**: `sql<number>\`coalesce(sum(${reservations.totalAmount}), 0)::int\``
**KST today filter**: `sql\`${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')\``
**Date truncation bucket** (90일 → week):
```typescript
const granularity = period === '90d' ? 'week' : 'day';
const bucket = sql`date_trunc(${sql.raw(`'${granularity}'`)}, ${reservations.createdAt} AT TIME ZONE 'Asia/Seoul')`;
```

---

### TanStack Query `useQuery` shape
**Source:** `apps/web/hooks/use-admin.ts:21-33`, `apps/web/hooks/use-reservations.ts:18-29`
**Apply to:** all hooks in `use-admin-dashboard.ts`

**Standard shape:**
```typescript
useQuery({
  queryKey: ['admin', 'dashboard', '<kind>', ...params],
  queryFn: () => apiClient.get<Dto>(`/api/v1/admin/dashboard/<kind>?<params>`),
  staleTime: 30_000, // half of server 60s TTL
  refetchOnWindowFocus: false, // prevent skeleton flash (RESEARCH Pattern 5 note)
});
```

---

### Client-component boundary
**Apply to:** `apps/web/app/admin/page.tsx` + all `apps/web/components/admin/dashboard/*.tsx` + `apps/web/hooks/use-admin-dashboard.ts`

**Rule** (RESEARCH Pitfall 3): every file that imports `recharts`, `useState`, `useQuery`, or shadcn Chart primitives **must** start with `'use client';`. The dashboard page itself is a client component since it uses hooks.

---

### Empty / Error / Loading State Copy
**Source:** UI-SPEC §Copywriting Contract
**Apply to:** all new dashboard components (verbatim, no paraphrasing)

| State | Copy |
|-------|------|
| Empty KPI=0 | `아직 데이터가 없습니다` / `오늘 예매가 접수되면 이곳에 표시됩니다` |
| Empty chart | `표시할 데이터가 없습니다` / `해당 기간 동안 {예매\|결제} 내역이 없습니다` |
| Empty Top10 | `아직 인기 공연이 없습니다` / `최근 30일 예매가 누적되면 랭킹이 표시됩니다` |
| Error | `대시보드를 불러오지 못했습니다` / `잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의하세요.` / `다시 시도` button |
| Loading | `@/components/ui/skeleton` 컴포넌트 (existing — confirmed in apps/web/components/ui/) |

Tone pattern from `admin-booking-table.tsx:112-117` — 존댓말, `text-base font-semibold text-gray-900` heading + `text-sm text-gray-600` body.

---

## No Analog Found

No file in this phase lacks an analog entirely. **Chart components** (area/donut/bar) have no *local* analog (first chart in project) but RESEARCH §Code Examples 3–4 are authoritative concrete templates — treated as partial match. Planner should copy RESEARCH code verbatim and apply UI-SPEC §Chart color palette override.

---

## Metadata

**Analog search scope:**
- `apps/api/src/modules/admin/*` (5 files scanned)
- `apps/api/src/modules/performance/*` (4 files scanned — cache.service + module)
- `apps/api/src/common/{guards,pipes,decorators}/*` (3 files scanned)
- `apps/api/test/*` (1 file scanned — sms-throttle.integration.spec.ts)
- `apps/api/src/database/schema/*` (2 files scanned — reservations, payments)
- `apps/web/hooks/*` (2 files scanned — use-admin, use-reservations)
- `apps/web/components/admin/*` (4 files scanned — stat-card, sidebar, booking-table, booking-dashboard)
- `apps/web/app/admin/*` (3 files scanned — layout, bookings/page, performances/page)
- `apps/web/e2e/*` (2 files scanned — toss-payment.spec, helpers/auth)
- `packages/shared/src/*` (2 files scanned — index.ts, schemas/booking.schema)

**Files scanned:** ~28

**Pattern extraction date:** 2026-04-20

**Key invariants to propagate into PLAN.md:**
1. Backend file imports must use `.js` extensions (ESM per CLAUDE.md).
2. `cache.set(key, value, 60)` — third arg mandatory; never omit.
3. KST boundary logic lives in SQL (`AT TIME ZONE 'Asia/Seoul'`), never in app code (`new Date()`).
4. All dashboard frontend files require `'use client'` directive.
5. Chart color palette: monochromatic purple-gradient per UI-SPEC (not shadcn defaults).
6. `PerformanceModule` already exports `CacheService` (performance.module.ts:12) — zero module wiring needed.
7. `loginAsTestUser` helper (e2e/helpers/auth.ts:42) defaults to `admin@grapit.test` — ready for Phase 11 E2E.
