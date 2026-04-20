---
phase: 11-admin-dashboard
reviewed: 2026-04-20T00:00:00Z
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
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 11 admin dashboard 구현 전반은 설계 의도(KST boundary pre-compute, 60s read-through cache, 4분할 API 병렬 fan-out, period 공유 + Top10 고정 30일)와 잘 맞으며, 인증·RBAC 경계(`APP_GUARD=JwtAuthGuard` 전역 + `@UseGuards(RolesGuard)@Roles('admin')`)도 일관됩니다. 쿼리는 Drizzle 타입으로 parameter binding되어 SQL injection 위험은 없습니다. 다만 다음 4건이 실제 런타임에서 문제가 될 여지가 있습니다.

1. `sql.raw("... reservations.created_at ...")`가 `performances.created_at` 컬럼과 이름이 같기 때문에, `getRevenueTrend`의 GROUP BY/SELECT는 문제없지만, `getPaymentDistribution`의 WHERE raw SQL fragment는 FROM 테이블 alias가 바뀌는 상황에 취약합니다(현재는 동작하나 방어적 개선 권장).
2. `buildWeeklyBucketSkeleton`이 포맷하는 ISO week label은 `IYYY`(ISO week-numbering year) 기반인데, Node 쪽은 "목요일이 속한 그레고리력 연도"를 쓰므로 1월 초/12월 말 경계의 주 1~2개에서 label이 어긋나고 DB 결과 머지가 실패해 해당 주가 0으로 채워집니다(빈 bucket처럼 보임).
3. `AdminDashboardController`가 `@Query(pipe)`로 전체 쿼리 객체를 validate하지만, NestJS는 pipe 인자 해석 시 "global ValidationPipe"가 있으면 object 통째 validate가 되고 없으면 string으로 해석되는 버전별 편차가 있습니다. 본 프로젝트에 global ValidationPipe가 없으므로 현재는 동작하지만, `@Query() query`에 타입 명시 없이 pipe만 붙는 형태는 실수 유발이 쉽고 `period` 파라미터만 분리해서 받는 형태가 더 안전합니다.
4. `RevenueAreaChart`가 빈 bucket(`revenue=0`)까지 포함한 배열을 그대로 렌더하므로 실제 매출이 하나도 없는 30d 기간이 들어오면 "empty 0-line"이 그려집니다. `pickMode(..., d => d.length === 0)`는 skeleton이 있는 한 항상 false라, empty 분기가 트리거되지 않습니다.

그 외 6건은 접근성·타이핑·일관성 관련 info 레벨 개선점입니다.

## Warnings

### WR-01: revenue trend의 empty 상태가 skeleton 때문에 영원히 트리거되지 않음

**File:** `apps/web/app/admin/page.tsx:61`
**Issue:**
```tsx
const revenueMode = pickMode(revenue, (d) => d.length === 0);
```
서버 `getRevenueTrend`는 `buildDailyBucketSkeleton(days)` / `buildWeeklyBucketSkeleton(weeks)`로 항상 `length >= 1` (30d면 30개, 7d면 7개, 90d면 13주) 배열을 반환합니다. 따라서 "해당 기간 동안 예매 내역이 없습니다" empty 카피가 화면에 절대 나타나지 않으며, 모든 revenue=0인 flat 라인만 찰나도 없이 항상 노출됩니다. Plan `11-UI-SPEC`가 요구하는 empty 상태가 사실상 dead code입니다.

같은 패턴이 `genre`/`payment`에는 문제 없습니다(서버가 빈 배열을 반환하므로).

**Fix:**
```tsx
// sum 기준으로 empty 판별 (또는 서비스에서 모든 revenue=0일 때 빈 배열 반환)
const revenueMode = pickMode(
  revenue,
  (d) => d.length === 0 || d.every((b) => b.revenue === 0),
);
```
또는 서비스 계층에서 모든 bucket의 revenue 합이 0이면 빈 배열을 반환하도록 수정. skeleton 반환 정책은 그대로 두되 UI가 "숫자 신호"를 기준으로 empty를 판정하게 하는 쪽이 DTO 호환성 면에서 낫습니다.

---

### WR-02: buildWeeklyBucketSkeleton의 year 필드가 ISO week-numbering year와 어긋남

**File:** `apps/api/src/modules/admin/kst-boundary.ts:80-103`
**Issue:**
DB 쿼리는 `to_char(date_trunc('week', ...), 'IYYY-"W"IW')`로 포맷합니다. `IYYY`는 **ISO 8601 week-numbering year**(해당 주의 목요일이 속한 연도)입니다. Skeleton은 아래처럼 계산합니다:
```ts
target.setUTCDate(target.getUTCDate() + 4 - dayNum); // 목요일
const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
const label = `${target.getUTCFullYear()}-W${...}`;
```
여기서 `target.getUTCFullYear()`는 목요일이 속한 **그레고리력 연도**로 대개 ISO year와 일치하지만, 일부 주에서는 어긋납니다. 예: 2026-01-01(목)이 속한 주는 ISO week `2026-W01`이 맞지만, 2025-12-29(월)을 골랐다면 목요일은 2026-01-01 → target.getUTCFullYear()=2026. OK. 문제가 생기는 건 반대 경계: 2025-01-01(수)은 ISO week `2025-W01`인데, 위 로직은 그대로 `2025-W01`로 잘 매칭됩니다(수요일 기준으로 `+4-3=+1` → 목요일=2025-01-02, year=2025). 하지만 `2024-12-30(월) 이 속한 주`는 ISO week `2025-W01`인데(ISO 기준), 만약 skeleton이 해당 월요일을 iteration의 day origin으로 잡았다면 `+4-1=+3` → `2025-01-02` → year=2025, OK. 반면 `2026-12-28(월)~2027-01-03(일)` 주는 ISO week `2026-W53`(2026-12-31이 목요일이므로) — 이 경우도 `+4-1=+3` → `2026-12-31` → year=2026, OK.

실제로 어긋나는 경계는 iteration origin이 **일요일**인 경우입니다. `dayNum = getUTCDay() || 7`에서 일요일=7, `+4-7=-3`으로 목요일을 과거로 이동합니다. 예: 2027-01-03(일) origin → 목요일=2026-12-31 → year=2026 → ISO label `2026-W53`. 같은 주의 월~토 origin은 `2027-01-03` 포함 주의 목요일=2026-12-31 역시 `2026-W53`. 일관되어 보이지만, `seen` Set 중복 제거는 정확히 하나의 origin만 남깁니다.

그런데 진짜 버그는 **weekNum 계산의 `yearStart` 참조**입니다:
```ts
const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
```
이 공식은 "1월 1일을 day 1로 보고 7로 나눈 올림"일 뿐, ISO week의 규칙(첫 목요일을 포함하는 주가 week 1)과 일치하지 않습니다. 예: 2027-01-01(금)이 속한 주는 ISO week `2026-W53`이 되어야 하는데, 위 공식은 `target=2027-01-07`(목) → yearStart=2027-01-01 → `(6*86400000/86400000+1)/7 = 1` → label `2027-W01`. Postgres는 같은 주를 `2026-W53`으로 라벨링하므로 머지가 실패합니다. 사용자 체감: 90d 뷰의 연말/연초 경계 1주에서 서버 값이 있어도 skeleton label과 매칭되지 않아 0으로 채워진 duplicate bucket이 보일 수 있습니다.

**Fix:** 표준 ISO week 공식을 사용합니다.
```ts
// target: 해당 주의 목요일 (UTC)
// ISO year: target.getUTCFullYear()
// ISO week 1: target의 ISO year 1월 4일이 속한 주의 월요일이 week 1의 월요일.
const isoYear = target.getUTCFullYear();
const jan4 = new Date(Date.UTC(isoYear, 0, 4));
const jan4Day = jan4.getUTCDay() || 7;
const week1Monday = new Date(jan4);
week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
const targetMonday = new Date(target);
targetMonday.setUTCDate(target.getUTCDate() - 3); // 목 → 월
const weekNum =
  Math.round((targetMonday.getTime() - week1Monday.getTime()) / (7 * DAY_MS)) + 1;
const label = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
```
또는 기존 로직으로 충분하다고 판단하면 최소한 "해당 90d 기간에 연말/연초를 포함하는 케이스"에 대한 단위 테스트를 추가해 회귀를 잡으세요(현재 `admin-dashboard.service.spec.ts`의 `revenue-weekly` 테스트는 bucket 형식만 대강 검증합니다).

---

### WR-03: getPaymentDistribution의 raw SQL fragment가 테이블 식별자를 하드코딩

**File:** `apps/api/src/modules/admin/admin-dashboard.service.ts:200`
**Issue:**
```ts
const paymentFilter = sql`reservations.status = 'CONFIRMED' AND payments.status = 'DONE' AND reservations.created_at >= ${startUtc} AND reservations.created_at < ${endUtc}`;
```
startUtc/endUtc는 parameter bind로 안전하지만, 테이블명(`reservations`, `payments`)과 컬럼명(`status`, `created_at`)이 raw 문자열입니다. 현재는 schema에서 테이블 이름이 그대로라 동작하지만, 향후 schema rename (`reservations` → `reservations_v2`), `drizzle-orm` 버전 업으로 자동 aliasing (`"reservations" as "r0"`), 또는 subquery 도입 등에서 SQL 컴파일 실패 혹은 잘못된 컬럼 바인딩으로 이어집니다. Drizzle의 Identifier 보간을 쓰면 이 리스크가 사라집니다.

같은 파일 `getRevenueTrend`의 `sql.raw("date_trunc('...', reservations.created_at AT TIME ZONE 'Asia/Seoul')")`도 동일 리스크를 가지지만, 주석에 이유(직렬화 순환 참조 회피)가 명시되어 있고 조건부 수용 가능합니다. payment는 그 제약이 없으므로 typed API로 바꾸는 쪽이 좋습니다.

**Fix:**
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

---

### WR-04: 카드 unit spec의 cache-set-ttl 테스트가 Symbol key DI 모드와 충돌할 수 있음

**File:** `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts:23-29`
**Issue:** Proxy handler가 `then`을 훅으로 잡아 Promise로 위장합니다:
```ts
if (prop === 'then') {
  return (resolve: (v: unknown) => void) => resolve(resolvedValue);
}
```
문제 1: `Symbol.toStringTag`, `Symbol.iterator` 등 Symbol 키 접근이 오면 `(..._args: unknown[]) => new Proxy({}, handler)`를 반환해 "always a truthy function"이 됩니다. `expect(whereSpy).toHaveBeenCalled()` 등의 Jest/vitest 내부 로직이 drizzle chain을 내성적으로 탐색하면 예상 외 상태로 번질 수 있습니다(현재는 통과하지만 vitest 업그레이드 시 잠재적 flaky).

문제 2: Promise interop이 thenable만 구현하고 `catch`, `finally`를 미구현합니다. `service.readThrough`가 `await this.cache.set(...)`을 기다리는데 `cache.set`은 실제 mock이라 문제 없지만, 만약 향후 `Promise.allSettled` 등을 끼워 넣으면 rejection이 조용히 무한 대기가 됩니다.

**Fix:** Drizzle 체인은 `.then` 대신 `.execute()` 또는 awaitable async 함수로 모킹하는 것이 안정적입니다.
```ts
function createChainMock(resolvedValue: unknown) {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          try { resolve(resolvedValue); } catch (e) { reject?.(e); }
        };
      }
      if (typeof prop === 'symbol') return undefined;
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}
```

또는 가능하면 controller spec에서처럼 `CacheService` 더미만 주입하고 service 단위 테스트는 integration(real db) 쪽으로 이관하는 쪽이 장기적으로 maintainable합니다.

---

## Info

### IN-01: period 쿼리 validation이 전체 object를 통으로 받아 오타 유발 가능

**File:** `apps/api/src/modules/admin/admin-dashboard.controller.ts:33-51`
**Issue:** `@Query(new ZodValidationPipe(periodQuerySchema)) query: { period: DashboardPeriod }` 형태는 NestJS가 `@Query()` 전체 쿼리 객체를 pipe로 보내는 동작에 의존합니다. `periodQuerySchema`는 object-schema라 현재는 잘 동작하지만, `@Query('period', ...)`처럼 명시적으로 키를 분리하고 `dashboardPeriodSchema`(enum 자체)를 넘기는 쪽이 오류 범위를 좁히고 테스트에서 typing 실수를 빨리 잡아줍니다.

**Fix:**
```ts
import { dashboardPeriodSchema } from '@grapit/shared';

@Get('revenue')
async getRevenue(
  @Query('period', new ZodValidationPipe(dashboardPeriodSchema.default('30d')))
  period: DashboardPeriod,
) {
  return this.service.getRevenueTrend(period);
}
```

---

### IN-02: useDashboardRevenue의 URL에서 period 인코딩 생략

**File:** `apps/web/hooks/use-admin-dashboard.ts:31-33, 42-44, 54-56`
**Issue:** `period`는 `'7d' | '30d' | '90d'` 리터럴이라 인코딩이 불필요하지만, 관습상 `URLSearchParams`를 쓰거나 `encodeURIComponent`를 통과시키는 것이 regression 내성에 좋습니다. 누군가 타입을 확장해서 임의의 string을 허용하도록 바꾸면 즉시 이슈가 됩니다.

**Fix:**
```ts
const search = new URLSearchParams({ period }).toString();
apiClient.get<DashboardRevenueDto>(`/api/v1/admin/dashboard/revenue?${search}`);
```

---

### IN-03: TopPerformancesTable에서 Next Image 대신 `<img>` 사용

**File:** `apps/web/components/admin/dashboard/top-performances-table.tsx:91-96`
**Issue:** `// eslint-disable-next-line @next/next/no-img-element`로 lint를 우회하고 있습니다. 포스터는 Cloudflare R2 원본 URL이 들어오는데, Next.js 16 기본 이미지 최적화를 쓰면 LCP와 dashboard 초기 렌더 시 b/w 사용량을 줄일 수 있습니다. Top10 표 포스터는 고정 40x40이므로 `<Image width={40} height={40} ... />`로 바꾸고 `next.config`의 `images.remotePatterns`에 R2 도메인이 이미 있는지 확인하세요.

**Fix:**
```tsx
import Image from 'next/image';
// ...
<Image
  src={row.posterUrl}
  alt={`${row.title} 포스터`}
  width={40}
  height={40}
  className="h-10 w-10 rounded object-cover"
/>
```
alt는 공연 맥락에 의미 있는 값(`"포스터"` 대신 공연명 포함)을 넣는 것이 WCAG 1.1.1 권장입니다. 현재 `alt=""`는 장식 이미지 취급인데, 포스터는 data cell의 보조 맥락을 전달하므로 공연명 alt가 적절합니다.

---

### IN-04: PaymentBarChart의 method 값이 한글/영문 혼재 가능

**File:** `apps/web/components/admin/dashboard/payment-bar-chart.tsx:31-39`
**Issue:** 백엔드 schema(`payments.method`)는 `varchar(50)`이고, `reservation.service.spec.ts` / `payment.service.spec.ts`에서는 `'카드'`(한글)로 seed되는 반면, `admin-dashboard.service.spec.ts`에서는 `'card'`(영문)로 mock됩니다. 실서비스 production 데이터가 Toss Payments SDK 응답(보통 `'카드'`, `'간편결제'` 등 한글)에서 들어오면 XAxis tick에 한글이 그대로 노출됩니다. 본 구현 자체가 잘못된 건 아니지만 i18n/label mapping 레이어가 없어 일관성이 결여될 여지가 있습니다. 차트 label을 도메인 상수로 매핑하는 테이블을 하나 두면 i18n과 차트 정렬 둘 다 해결됩니다.

**Fix:** `packages/shared`에 payment method → 한글 label map을 두고 차트에서 `data.map(d => ({ ...d, label: METHOD_LABEL[d.method] ?? d.method }))`로 변환.

---

### IN-05: `(status, created_at)` 복합 인덱스가 실제로는 없음

**File:** `apps/api/src/modules/admin/admin-dashboard.service.ts:42-46`, `apps/api/src/modules/admin/kst-boundary.ts:6`
**Issue:** 주석(`(status, created_at) index 활용 가능`)과 달리 실제 migration(`apps/api/src/database/migrations/meta/0006_snapshot.json` 조회 기준)은 `idx_reservations_status` 단일 컬럼만 존재합니다. 현재 구현은 `status='CONFIRMED' AND created_at BETWEEN ...`를 자주 실행하므로, 실제로 `(status, created_at)` composite index를 만들면 대시보드 cold-cache 쿼리 latency가 유의미하게 줄어듭니다. v1 성능 out-of-scope 원칙상 Warning이 아니라 Info로 기록.

**Fix:** `drizzle-kit generate`로 `reservations` 테이블에 `index('idx_reservations_status_created_at').on(table.status, table.createdAt)`를 추가하거나, SQL migration으로 수동 생성.

---

### IN-06: KST boundary의 days 입력에 음수/비정수 검증 부재

**File:** `apps/api/src/modules/admin/kst-boundary.ts:29`
**Issue:** `kstBoundaryToUtc(days)`는 내부 전용 헬퍼로, 호출 지점이 `daysForPeriod()`(enum 기반)와 상수(TOP_PERFORMANCES_WINDOW_DAYS=30)로 제한됩니다. 따라서 현재 악용 경로가 없습니다. 다만 `buildDailyBucketSkeleton`은 `for (let i = days - 1; i >= 0; i -= 1)`인데 `days=0`이면 빈 배열, `days=-1`이면 무한루프는 아니지만 빈 배열. 향후 다른 endpoint가 이 유틸을 재사용할 때를 대비해 가드를 추가하면 방어 깊이가 늘어납니다.

**Fix:**
```ts
export function kstBoundaryToUtc(days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 366) {
    throw new RangeError(`kstBoundaryToUtc: invalid days ${days}`);
  }
  // ... 기존 로직
}
```

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
