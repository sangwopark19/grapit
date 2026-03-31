---
phase: 02-catalog-admin
plan: 00
subsystem: testing
tags: [vitest, tdd, red-state, unit-test, drizzle-mock]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: "Test pattern (direct class instantiation, vi.fn() mocks, no NestJS TestingModule)"
  - phase: 02-01
    provides: "Drizzle schema, shared types, zod schemas for performances/venues/banners"
provides:
  - "RED-state test stubs for PerformanceService (10 tests)"
  - "RED-state test stubs for SearchService (5 tests)"
  - "RED-state test stubs for AdminService (11 tests)"
  - "RED-state test stubs for UploadService (4 tests)"
  - "RED-state test stubs for RolesGuard (3 tests)"
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mock() with factory for non-existent modules (RED state pattern)"
    - "Dynamic import after vi.mock for mocked service instantiation"
    - "Chainable Drizzle mock with select/from/where/limit/offset/orderBy"
    - "Transaction mock with callback-based tx injection"

key-files:
  created:
    - apps/api/src/modules/performance/performance.service.spec.ts
    - apps/api/src/modules/search/search.service.spec.ts
    - apps/api/src/modules/admin/admin.service.spec.ts
    - apps/api/src/modules/admin/upload.service.spec.ts
    - apps/api/src/common/guards/roles.guard.spec.ts
  modified: []

key-decisions:
  - "Used vi.mock() factory pattern to allow test files to load despite non-existent services"
  - "Dynamic import after vi.mock ensures mock is applied before service construction"
  - "Followed Phase 1 auth.service.spec.ts pattern exactly: direct class instantiation, no TestingModule"

patterns-established:
  - "RED-state tests: vi.mock module -> dynamic import -> new Service(mockDb) -> assert behavior"
  - "Drizzle chainable mock: select().from().where().limit().offset().orderBy() chain with terminal .then()"
  - "Transaction mock: db.transaction(cb => cb(mockTx)) with mockTx mirroring insert/select/update/delete"

requirements-completed: [PERF-01, PERF-02, SRCH-01, ADMN-01, ADMN-02, ADMN-03]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 02 Plan 00: Test Scaffolds Summary

**33 RED-state test stubs across 5 files for PerformanceService, SearchService, AdminService, UploadService, and RolesGuard using vitest + Drizzle mocks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T00:47:15Z
- **Completed:** 2026-03-31T00:51:06Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Created 5 test stub files with 33 failing tests covering all Phase 2 backend services
- Tests describe expected behavior contracts for Plan 02 implementation: catalog queries, full-text search, admin CRUD, R2 upload, RBAC
- All tests detected by vitest, all fail as expected (RED state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for PerformanceService, SearchService, AdminService, UploadService, and RolesGuard** - `5c7fc9a` (test)

## Files Created/Modified
- `apps/api/src/modules/performance/performance.service.spec.ts` - 10 tests: findByGenre (pagination, subcategory, ended filter, sort), findById (with relations, viewCount increment, null), home data queries (banners, hot, new)
- `apps/api/src/modules/search/search.service.spec.ts` - 5 tests: tsvector search, ILIKE fallback, genre filter, ended filter, paginated SearchResponse
- `apps/api/src/modules/admin/admin.service.spec.ts` - 11 tests: createPerformance (transaction, child tables, venue upsert), updatePerformance (fields, priceTier replace), deletePerformance, banner CRUD (create, update, delete, reorder), saveSeatMap upsert
- `apps/api/src/modules/admin/upload.service.spec.ts` - 4 tests: presigned URL generation (shape, UUID uniqueness, ContentType, publicUrl format)
- `apps/api/src/common/guards/roles.guard.spec.ts` - 3 tests: no metadata = allow, role match = allow, role mismatch = deny

## Decisions Made
- Used `vi.mock()` factory pattern so test files can load despite importing non-existent service modules. The factory returns a mock constructor. Dynamic `import()` inside beforeEach ensures the mock is applied before instantiation.
- Followed Phase 1 auth.service.spec.ts pattern (direct class instantiation, no NestJS TestingModule) per project decision D-04.
- Test counts: PerformanceService(10), SearchService(5), AdminService(11), UploadService(4), RolesGuard(3) = 33 total. The plan stated "11 tests" for Performance and "9 tests" for Admin, but the actual `it` blocks in the plan spec totaled 10 and 11 respectively. Implementation matches the specified `it` blocks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - these are test stubs by design (RED state). The actual service implementations will be created in Plan 02.

## Next Phase Readiness
- 33 failing tests ready for Plan 02 (GREEN phase) implementation
- Test contracts clearly specify expected method signatures, return shapes, and DB query patterns
- Mocks are structured to verify transaction usage, query chaining, and insert/update/delete operations
- Plan 02 executor can implement services to pass these tests

---
*Phase: 02-catalog-admin*
*Completed: 2026-03-31*
