---
phase: 11-admin-dashboard
plan: 01
subsystem: admin-dashboard
tags: [admin, dashboard, testing, zod, red-tests, tdd, skeleton]
requires:
  - "@grapit/shared zod + type re-export pattern (packages/shared/src/index.ts)"
  - "AdminModule DI tokens (DRIZZLE, CacheService export from PerformanceModule)"
  - "admin@grapit.test seed user (STATE.md 260413-jw1)"
provides:
  - "dashboardPeriodSchema zod enum '7d'|'30d'|'90d' + periodQuerySchema default '30d'"
  - "5 response DTO types: DashboardSummaryDto, DashboardRevenueDto, DashboardGenreDto, DashboardPaymentDto, DashboardTopDto"
  - "AdminDashboardService skeleton (5 public methods throwing 'Not implemented')"
  - "AdminDashboardController skeleton (@Controller('admin/dashboard') + @UseGuards(RolesGuard) + @Roles('admin'), 5 @Get handlers)"
  - "RED unit spec: 8 tests (summary/kst-boundary/revenue-weekly/genre/payment/cache-hit/cache-set-ttl/cache-degradation)"
  - "RED controller access-control spec: 401/403/200 (review HIGH 3)"
  - "RED integration spec: Postgres 16 + Valkey 8 testcontainers (revenue-daily + top10)"
  - "RED Playwright E2E spec: 3 scenarios (landing-smoke/period-filter/sidebar-nav)"
affects:
  - "packages/shared/src/index.ts (2 export lines added)"
  - "apps/api/src/modules/admin/ (new skeleton files + __tests__/)"
  - "apps/api/test/ (new integration spec)"
  - "apps/web/e2e/ (new Playwright spec)"
tech-stack:
  added: []
  patterns:
    - "Interface-First: shared schema + DTO types committed before API/Web consumers (Plan 02/03 import from @grapit/shared)"
    - "RED via assertion failure (not module-not-found): skeleton throws 'Not implemented' so downstream specs fail with assertion errors — review HIGH 1"
    - "Chainable Proxy mock for Drizzle query builder (borrowed from admin-booking.service.spec.ts:47-58)"
    - "Test.createTestingModule + overrideGuard(RolesGuard) for access-control spec"
    - "testcontainers (postgres:16 + valkey/valkey:8) + drizzle migrator for integration spec"
key-files:
  created:
    - "packages/shared/src/schemas/admin-dashboard.schema.ts"
    - "packages/shared/src/types/admin-dashboard.types.ts"
    - "apps/api/src/modules/admin/admin-dashboard.service.ts"
    - "apps/api/src/modules/admin/admin-dashboard.controller.ts"
    - "apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts"
    - "apps/api/src/modules/admin/__tests__/admin-dashboard.controller.spec.ts"
    - "apps/api/test/admin-dashboard.integration.spec.ts"
    - "apps/web/e2e/admin-dashboard.spec.ts"
  modified:
    - "packages/shared/src/index.ts"
decisions:
  - "period enum 순서 ['7d','30d','90d'] + default '30d' locked per D-09"
  - "Cache key namespace 'cache:admin:dashboard:summary' + TTL=60 locked per D-12/D-14"
  - "KST boundary 검증은 컬럼 래핑 vs UTC-boundary-compare 두 구현 모두 수용하도록 느슨하게 assertion (serialized SQL이 'Asia/Seoul' 또는 createdAt 컬럼 참조 중 하나 포함 허용) — review MEDIUM 4"
  - "Integration spec uses drizzle migrator to apply real production schema (not manual raw SQL) for schema-drift safety"
  - "controller.spec uses overrideGuard(RolesGuard) + mode state variable for 3 access-control cases; admin case intentionally RED until Plan 02 implements handler body"
metrics:
  duration: "~8min"
  completed: "2026-04-20"
  tasks: 4
  files_created: 8
  files_modified: 1
  loc_added: 743
---

# Phase 11 Plan 01: Wave 1 RED tests + shared schema + skeleton Summary

**One-liner:** 대시보드 구현 전에 공유 zod schema + 응답 DTO 5종 + AdminDashboardService/Controller skeleton + 모든 자동 검증 테스트(RED, assertion-failure 기반)를 먼저 커밋하여 Plan 02/03 병렬 실행 기반과 Interface-First 계약을 수립.

## Outcome

Plan 02(API GREEN)와 Plan 03(Web GREEN)이 Wave 2에서 병렬 실행되기 위한 공유 타입 계약 + service/controller skeleton + 모든 자동화 RED 테스트가 확정되었다.

- `@grapit/shared` 가 `dashboardPeriodSchema`, `DashboardPeriod`, `periodQuerySchema` + 5개 응답 DTO 타입을 export한다 (Plan 02/03이 `import { ... } from '@grapit/shared'` 로 consume).
- `AdminDashboardService` / `AdminDashboardController` 는 skeleton 상태로 존재하며 모든 public method/handler가 `throw new Error('Not implemented')`. 이로 인해 downstream RED 테스트가 **module-not-found가 아닌 assertion failure** 로 실패한다 (review HIGH 1 대응).
- Controller는 skeleton 단계에서도 `@Controller('admin/dashboard') + @UseGuards(RolesGuard) + @Roles('admin')` 데코레이터를 완비하여 401/403/200 access control 테스트가 의미 있게 동작.
- 4개 spec 파일(RED): service unit / controller access-control / integration / E2E.

## What Was Built

### Task 01-01 — shared admin-dashboard schema + DTO types
- `packages/shared/src/schemas/admin-dashboard.schema.ts`: `z.enum(['7d','30d','90d'])` + `periodQuerySchema` (default `'30d'`)
- `packages/shared/src/types/admin-dashboard.types.ts`: 5개 DTO 인터페이스 + 4개 bucket 인터페이스 (`DashboardRevenueBucketDto`, `DashboardGenreBucketDto`, `DashboardPaymentBucketDto`, `DashboardTopPerformanceDto`)
- `packages/shared/src/index.ts`: re-export 2줄 추가
- **Verify:** `pnpm --filter @grapit/shared build` → 성공

### Task 01-02 — AdminDashboardService / Controller skeleton
- `admin-dashboard.service.ts` (47 lines): 5개 public method 모두 `throw new Error('Not implemented')`. DI는 `@Inject(DRIZZLE)` + `CacheService` 만 주입.
- `admin-dashboard.controller.ts` (52 lines): `@Controller('admin/dashboard')` + `@UseGuards(RolesGuard)` + `@Roles('admin')`. 5개 GET handler: `summary`, `revenue`, `genre`, `payment`, `top-performances`. `ZodValidationPipe(periodQuerySchema)` 적용된 `@Query` parameter 3개.
- **admin.module.ts 변경 없음** — Plan 02 Task 02-02가 모듈 wiring 담당.
- **Verify:** `pnpm --filter @grapit/api typecheck` → 성공

### Task 01-03 — admin-dashboard.service.spec.ts (RED, 8 tests)
- 194 lines. `vi.fn()` 기반 mockDb + mockCache.
- 테스트 8종 (`summary` / `kst-boundary` / `revenue-weekly` / `genre` / `payment` / `cache-hit` / `cache-set-ttl` / `cache-degradation`) 모두 skeleton의 `throw new Error('Not implemented')` 로 인해 **assertion failure**로 RED.
- `skip` / `todo` / `fixme` 0건.
- `cache:admin:dashboard:summary` 키 + `ttlSeconds=60` 하드코딩 (D-12, D-14).
- `kst-boundary` 테스트는 구현 방식에 중립적 (컬럼 래핑 또는 UTC-boundary-compare 모두 허용, review MEDIUM 4).
- **Verify:** `pnpm exec vitest run admin-dashboard.service.spec.ts` → 8/8 fail with `Error: Not implemented` (module-not-found 없음)

### Task 01-04 — controller.spec + integration.spec + e2e.spec (RED)
- **controller.spec.ts (96 lines):** `Test.createTestingModule` + `overrideGuard(RolesGuard)`. 3 케이스 (anonymous → 401, user → 403, admin → 500→RED).
- **integration.spec.ts (232 lines):** postgres:16 + valkey/valkey:8 testcontainers. Drizzle migrator로 실제 production 스키마 적용. 2 테스트 (revenue-daily / top10). Skeleton에서 `Error: Not implemented` 로 RED.
- **admin-dashboard.spec.ts E2E (78 lines):** `loginAsTestUser` (admin@grapit.test) + 3 시나리오 (landing-smoke / period-filter / sidebar-nav).
- **Verify:** controller spec 실행 시 1 fail (admin 500 expected 200) / 2 pass (401, 403) — 파일 단위 RED 유지.

## Files Changed

**Created (8):**
- `packages/shared/src/schemas/admin-dashboard.schema.ts`
- `packages/shared/src/types/admin-dashboard.types.ts`
- `apps/api/src/modules/admin/admin-dashboard.service.ts`
- `apps/api/src/modules/admin/admin-dashboard.controller.ts`
- `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts`
- `apps/api/src/modules/admin/__tests__/admin-dashboard.controller.spec.ts`
- `apps/api/test/admin-dashboard.integration.spec.ts`
- `apps/web/e2e/admin-dashboard.spec.ts`

**Modified (1):**
- `packages/shared/src/index.ts` (+2 re-export lines)

## Commits

- `9925253` — feat(11-01): shared admin-dashboard zod schema + DTO types
- `d852260` — feat(11-01): AdminDashboardService / Controller skeleton (throw Not implemented)
- `640279c` — test(11-01): admin-dashboard.service.spec RED unit tests (assertion failure)
- `f8d2c39` — test(11-01): admin-dashboard controller access-control + integration + e2e specs (RED)

## Verification Status

| Check | Status | Detail |
|-------|--------|--------|
| `pnpm --filter @grapit/shared build` | PASS | 0 exit |
| `pnpm --filter @grapit/api typecheck` | PASS | 0 exit |
| `vitest run admin-dashboard.service.spec.ts` | RED (8/8 fail) | assertion failure (`Error: Not implemented`), **no module-not-found** |
| `vitest run admin-dashboard.controller.spec.ts` | RED (1/3 fail) | admin case 500 → RED; 401/403 pass (guard override) |
| `apps/api/test/admin-dashboard.integration.spec.ts` exists | PASS | 232 lines, 2 testcontainer tests |
| `apps/web/e2e/admin-dashboard.spec.ts` exists | PASS | 78 lines, 3 scenarios with loginAsTestUser |
| git diff --stat | PASS | 9 files, 743 insertions (≥ 430 target) |

## Deviations from Plan

None — plan executed exactly as written. 단 integration spec의 `seedUser` 헬퍼는 `users` 테이블 스키마의 notNull 제약(gender, birthDate)에 맞춰 두 필드를 기본값으로 삽입하도록 작성했다 (schema 확인 결과 필수).

## Threat Flags

None. Plan 이 정의한 3개 위협(T-11-01 Tampering, T-11-02 Information Disclosure, T-11-03a EoP)은 모두 본 Wave에서 확정된 mitigation과 일치:
- T-11-01: `dashboardPeriodSchema`를 strict enum으로 정의 (Plan 02의 `ZodValidationPipe` 에서 400 응답)
- T-11-02: integration 테스트가 testcontainers 로컬 Postgres/Valkey 만 사용, 프로덕션 secret 미접근
- T-11-03a: controller skeleton이 `@UseGuards(RolesGuard) + @Roles('admin')` 완비, 401/403/200 access control 테스트가 RED로 회귀 방지

## Known Stubs

| File | Pattern | Why intentional | Resolved by |
|------|---------|-----------------|-------------|
| `apps/api/src/modules/admin/admin-dashboard.service.ts` | `throw new Error('Not implemented')` × 5 | RED 전략: downstream 테스트가 assertion failure로 실패하도록 강제 | Plan 02 Task 02-01 (service implementation) |
| `apps/api/src/modules/admin/admin-dashboard.controller.ts` | `throw new Error('Not implemented')` × 5 | 동일 — handler body는 Plan 02 Task 02-02 | Plan 02 Task 02-02 (controller handler body + AdminModule wiring) |

이 스텁들은 Plan 02의 **GREEN 전제조건**이며, Plan 01 scope에서 intentional. Plan 02가 완료되면 모든 테스트가 GREEN으로 전환된다.

## Next Actions (Plan 02/03)

- **Plan 02 (Wave 2, parallel with 03):** AdminDashboardService 5 method 실제 Drizzle 쿼리 구현 + AdminDashboardController handler body 구현 + admin.module.ts wiring. 모든 unit + controller + integration spec GREEN.
- **Plan 03 (Wave 2, parallel with 02):** `/admin/page.tsx` + `use-admin-dashboard.ts` + dashboard 컴포넌트 (chart/table/period-filter) + sidebar NAV_ITEMS 수정. E2E spec GREEN.

## Self-Check: PASSED

**Files verified:**
- FOUND: packages/shared/src/schemas/admin-dashboard.schema.ts
- FOUND: packages/shared/src/types/admin-dashboard.types.ts
- FOUND: apps/api/src/modules/admin/admin-dashboard.service.ts
- FOUND: apps/api/src/modules/admin/admin-dashboard.controller.ts
- FOUND: apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts
- FOUND: apps/api/src/modules/admin/__tests__/admin-dashboard.controller.spec.ts
- FOUND: apps/api/test/admin-dashboard.integration.spec.ts
- FOUND: apps/web/e2e/admin-dashboard.spec.ts

**Commits verified (in git log):**
- FOUND: 9925253
- FOUND: d852260
- FOUND: 640279c
- FOUND: f8d2c39
