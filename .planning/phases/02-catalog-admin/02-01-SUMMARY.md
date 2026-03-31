---
phase: 02-catalog-admin
plan: 01
subsystem: database
tags: [drizzle, postgresql, tsvector, pg_trgm, shadcn, zod, s3, tanstack-query]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: Drizzle ORM setup, schema pattern (users.ts), shared package structure, apiClient
provides:
  - 7 catalog DB tables (venues, performances, showtimes, price_tiers, castings, seat_maps, banners)
  - Genre/status enums with Korean labels
  - Full-text search via tsvector + pg_trgm
  - Shared zod schemas for create/update/query/search
  - Shared TypeScript interfaces for all catalog domain types
  - 11 shadcn UI components for Phase 2 UI
  - apiClient PUT method
affects: [02-02, 02-03, 02-04, 03-seat-map]

# Tech tracking
tech-stack:
  added: [swiper, "@tanstack/react-query", sharp, "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", drizzle-zod, radix-ui]
  patterns: [pgEnum for domain enums, tsvector generated column for FTS, jsonb for seat config, barrel export in lib/index.ts]

key-files:
  created:
    - apps/api/src/database/schema/performances.ts
    - apps/api/src/database/schema/venues.ts
    - apps/api/src/database/schema/showtimes.ts
    - apps/api/src/database/schema/price-tiers.ts
    - apps/api/src/database/schema/castings.ts
    - apps/api/src/database/schema/seat-maps.ts
    - apps/api/src/database/schema/banners.ts
    - apps/api/src/database/migrations/0001_motionless_miek.sql
    - packages/shared/src/types/performance.types.ts
    - packages/shared/src/schemas/performance.schema.ts
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/dropdown-menu.tsx
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/alert-dialog.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/textarea.tsx
    - apps/web/components/ui/skeleton.tsx
    - apps/web/components/ui/sheet.tsx
    - apps/web/components/ui/tooltip.tsx
    - apps/web/components/ui/switch.tsx
    - apps/web/lib/index.ts
  modified:
    - apps/api/src/database/schema/index.ts
    - packages/shared/src/constants/index.ts
    - packages/shared/src/index.ts
    - apps/web/lib/api-client.ts
    - apps/web/package.json
    - apps/api/package.json

key-decisions:
  - "radix-ui meta-package installed for shadcn v4 component compatibility (new import pattern)"
  - "lib/index.ts barrel export created to resolve shadcn @/lib import convention"
  - "search_vector added via custom migration SQL (Drizzle lacks native tsvector support)"

patterns-established:
  - "pgEnum for domain enums (genre, performance_status) in schema files"
  - "Custom migration SQL for PostgreSQL features unsupported by Drizzle (tsvector, pg_trgm)"
  - "Shared types mirror DB schema but use string for dates (ISO format for JSON transport)"
  - "lib/index.ts barrel re-export for shadcn component imports"

requirements-completed: [PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, ADMN-01, ADMN-02, ADMN-03]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 2 Plan 1: Data Foundation Summary

**7 Drizzle catalog tables with FTS indexes, shared zod schemas/types, 11 shadcn components, and Phase 2 npm dependencies**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T00:35:42Z
- **Completed:** 2026-03-31T00:42:22Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments
- 7 new database tables (venues, performances, showtimes, price_tiers, castings, seat_maps, banners) with proper FK relations and cascade deletes
- Full-text search infrastructure with pg_trgm extension, trigram GIN index on title, and tsvector generated column
- Shared TypeScript types and zod validation schemas for all catalog domain entities, importable from both frontend and backend
- 11 shadcn UI components installed for catalog and admin page development
- apiClient extended with PUT method for update operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Install all Phase 2 dependencies (npm + shadcn)** - `c0386e1` (feat)
2. **Task 2: Create Drizzle DB schema for catalog + admin tables** - `7f64574` (feat)
3. **Task 3: Create shared types, zod schemas, and constants** - `88fa156` (feat)

## Files Created/Modified
- `apps/api/src/database/schema/performances.ts` - Performances table with genre/status enums and trgm index
- `apps/api/src/database/schema/venues.ts` - Venues table
- `apps/api/src/database/schema/showtimes.ts` - Showtimes table with performance FK
- `apps/api/src/database/schema/price-tiers.ts` - Price tiers table with performance FK
- `apps/api/src/database/schema/castings.ts` - Castings table with performance FK
- `apps/api/src/database/schema/seat-maps.ts` - Seat maps table with jsonb config and performance FK
- `apps/api/src/database/schema/banners.ts` - Banners table with active flag and sort order
- `apps/api/src/database/schema/index.ts` - Re-exports all 11 schema tables
- `apps/api/src/database/migrations/0001_motionless_miek.sql` - Migration with pg_trgm + search_vector
- `packages/shared/src/types/performance.types.ts` - All catalog domain TypeScript interfaces
- `packages/shared/src/schemas/performance.schema.ts` - Zod schemas for CRUD and queries
- `packages/shared/src/constants/index.ts` - Catalog constants (page sizes, file limits)
- `packages/shared/src/index.ts` - Re-exports new types and schemas
- `apps/web/lib/api-client.ts` - Added PUT method
- `apps/web/lib/index.ts` - Barrel export for cn utility
- `apps/web/components/ui/*.tsx` - 11 shadcn components (card, select, dropdown-menu, table, alert-dialog, badge, textarea, skeleton, sheet, tooltip, switch)

## Decisions Made
- Installed `radix-ui` meta-package because shadcn v4 components use the new `import { X } from "radix-ui"` pattern instead of individual `@radix-ui/react-*` packages
- Created `apps/web/lib/index.ts` barrel export to satisfy shadcn's `import { cn } from "@/lib"` convention (previously cn was at `@/lib/cn`)
- Added search_vector as custom SQL in migration rather than in Drizzle schema since Drizzle ORM does not natively support tsvector generated columns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed radix-ui meta-package for shadcn v4 compatibility**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** shadcn v4 components import from `"radix-ui"` (meta-package) instead of individual `@radix-ui/react-*` packages, causing TypeScript errors
- **Fix:** Added `radix-ui` to web dependencies
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles without errors
- **Committed in:** c0386e1 (Task 1 commit)

**2. [Rule 3 - Blocking] Created lib/index.ts barrel export**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** New shadcn components use `import { cn } from "@/lib"` but project had cn at `@/lib/cn` with no barrel
- **Fix:** Created `apps/web/lib/index.ts` re-exporting cn
- **Files modified:** apps/web/lib/index.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** c0386e1 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to resolve TypeScript compilation failures from updated shadcn import patterns. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all tables are fully defined, all types are complete, all schemas have proper validation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 DB tables ready for CRUD operations in Plan 02 (API endpoints)
- Shared types/schemas ready for import in both frontend and backend
- 11 shadcn components ready for UI development in Plans 03-04
- apiClient PUT method ready for admin update operations

## Self-Check: PASSED

All 22 key files verified present. All 3 commit hashes verified in git log.

---
*Phase: 02-catalog-admin*
*Completed: 2026-03-31*
