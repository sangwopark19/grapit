---
phase: 02-catalog-admin
verified: 2026-03-31T15:05:00Z
status: passed
score: 11/11 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 10/11
  gaps_closed:
    - "radix-ui meta-package installed — status-badge.test.tsx now passes (5/5 tests)"
    - "Performance detail page spacing fixed: pb-20 CTA clearance, max-w-[280px] poster, max-w-prose prose, mt-6 TabsContent (commit 7f2d8a6)"
    - "Search page layout shift fixed: keepPreviousData in useSearch, h-5 count reservation, removed duplicate empty-state (commit f251d72)"
    - "Human UAT completed: 4/6 tests passed, 2 cosmetic issues identified and resolved"
    - "auth.service.spec.ts regression fixed: added mockUserRepo.findById mock (commit 3ab4093)"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

# Phase 02: Catalog + Admin Verification Report

**Phase Goal:** Users can discover performances by genre and search, and admins can manage all content
**Verified:** 2026-03-31T15:05:00Z
**Status:** passed (all gaps resolved, 63/63 backend tests pass)
**Re-verification:** Yes — after UAT gap closure (Plans 05 + UI review fixes)

## Re-verification Summary

This is the second verification of Phase 02. Since the initial verification:

- Human UAT ran all 6 human verification scenarios
- 4 passed immediately; 2 revealed cosmetic issues (detail page spacing, search layout shift)
- Plan 05 closed both cosmetic gaps with commits 7f2d8a6 and f251d72
- UI review fixes (commits 415f7bb, df6b093, 51af8e0) addressed font-weight, accessibility headings, and error state buttons
- The radix-ui meta-package is now installed; status-badge.test.tsx passes (5/5)
- Auth test regression (auth.service.spec.ts) fixed: added missing mockUserRepo.findById mock (commit 3ab4093)
- All 63/63 backend tests now pass cleanly

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DB schema has all 7 catalog tables with correct relations | VERIFIED | 7 schema files: performances.ts, venues.ts, showtimes.ts, price-tiers.ts, castings.ts, seat-maps.ts, banners.ts; all in schema/index.ts |
| 2 | Migration includes pg_trgm + search_vector generated column | VERIFIED | 0001_motionless_miek.sql: CREATE EXTENSION IF NOT EXISTS pg_trgm + ALTER TABLE performances ADD COLUMN search_vector tsvector GENERATED ALWAYS AS |
| 3 | Shared types and zod schemas importable from @grapit/shared | VERIFIED | packages/shared/src/index.ts exports performance.types and performance.schema; GENRES, PerformanceListResponse, SearchResponse, createPerformanceSchema all present |
| 4 | GET /api/v1/performances?genre=X returns paginated list | VERIFIED | performance.service.ts findByGenre with Drizzle queries; controller @Get('performances') with @Public() |
| 5 | GET /api/v1/performances/:id returns PerformanceWithDetails | VERIFIED | performance.service.ts findById fetching venue, priceTiers, showtimes, castings, seatMap; viewCount incremented |
| 6 | GET /api/v1/search?q= uses tsvector + ILIKE dual search | VERIFIED | search.service.ts: search_vector @@ plainto_tsquery OR title ILIKE in single WHERE; ts_rank ordering |
| 7 | Admin endpoints require RBAC; 403 for non-admin | VERIFIED | admin-performance.controller.ts: @UseGuards(RolesGuard) @Roles('admin') at class level; roles.guard.ts checks requiredRoles.includes(user.role) |
| 8 | Admin POST/PUT/DELETE perform transactional nested CRUD | VERIFIED | admin.service.ts createPerformance uses db.transaction(async (tx) => {...}) inserting venue + performance + priceTiers + showtimes + castings |
| 9 | R2 presigned URL endpoint returns uploadUrl + publicUrl + key | VERIFIED | upload.service.ts S3Client + getSignedUrl; @Post('upload/presigned') on admin controller |
| 10 | Detail page spacing correct (CTA clearance, poster size, prose width, tab spacing) | VERIFIED | page.tsx: pb-20 lg:pb-8 on main; max-w-[280px] mx-auto on poster; max-w-prose on prose divs; tabs.tsx: mt-6 TabsContent base class (commit 7f2d8a6) |
| 11 | Search page layout stable on genre chip toggle | VERIFIED | use-search.ts: placeholderData: keepPreviousData added; search/page.tsx: h-5 count container always renders; duplicate empty-state removed (commit f251d72) |

**Score:** 11/11 truths verified (all Phase 2 goals achieved; 1 Phase 1 test regression noted separately)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/database/schema/performances.ts` | Performances table with genre enum, status enum | VERIFIED | pgTable('performances') with genreEnum, performanceStatusEnum, search_vector index |
| `apps/api/src/database/schema/index.ts` | Re-exports all 7 new tables | VERIFIED | Exports venues, performances, showtimes, priceTiers, castings, seatMaps, banners |
| `apps/api/src/database/migrations/0001_motionless_miek.sql` | pg_trgm + search_vector migration | VERIFIED | Lines 1, 86-87 confirm extension + generated column |
| `packages/shared/src/types/performance.types.ts` | GENRES, interfaces for all domain entities | VERIFIED | GENRES array, PerformanceWithDetails, SearchResponse, all interfaces present |
| `packages/shared/src/schemas/performance.schema.ts` | Zod schemas for CRUD and query | VERIFIED | createPerformanceSchema, updatePerformanceSchema, searchQuerySchema, createBannerSchema |
| `apps/api/src/modules/performance/performance.service.ts` | findByGenre, findById, home data | VERIFIED | All 5 methods present with real Drizzle queries |
| `apps/api/src/modules/search/search.service.ts` | tsvector + ILIKE search | VERIFIED | search_vector + ILIKE in single WHERE clause |
| `apps/api/src/modules/admin/admin.service.ts` | CRUD with transactions, banner CRUD, seat map | VERIFIED | createPerformance, updatePerformance, deletePerformance, createBanner, reorderBanners, saveSeatMap |
| `apps/api/src/modules/admin/upload.service.ts` | R2 presigned URL generation | VERIFIED | S3Client + getSignedUrl + generatePresignedUrl |
| `apps/api/src/common/guards/roles.guard.ts` | RBAC guard | VERIFIED | RolesGuard implements CanActivate with getAllAndOverride + requiredRoles.includes |
| `apps/api/src/app.module.ts` | All 3 modules registered | VERIFIED | PerformanceModule, SearchModule, AdminModule in imports array |
| `apps/web/app/page.tsx` | Homepage with BannerCarousel, HOT, New, GenreGrid | VERIFIED | useHomeBanners hook + BannerCarousel/HotSection/NewSection/GenreGrid components; h1.sr-only for accessibility |
| `apps/web/app/genre/[genre]/page.tsx` | Genre page with PerformanceGrid, filters | VERIFIED | usePerformances hook, subcategory chips, sort toggle, ended filter via URL searchParams |
| `apps/web/app/performance/[id]/page.tsx` | Detail page with priceTiers, castings, tabs; correct spacing | VERIFIED | venue.name, priceTiers.map, castings.map, StatusBadge; pb-20 CTA clearance; max-w-[280px] poster; max-w-prose prose |
| `apps/web/app/search/page.tsx` | Search with genre filter, ended toggle; stable layout | VERIFIED | useSearch hook, genre chips, ended switch, pagination; h-5 count reservation; single empty-state via PerformanceGrid |
| `apps/web/components/layout/gnb.tsx` | GNB genre tabs + dropdown + search bar | VERIFIED | DropdownMenu, /genre/{slug} links, isActiveGenre detection; border-gray-200 token |
| `apps/web/hooks/use-performances.ts` | React Query hooks for catalog data | VERIFIED | apiClient.get to /api/v1/performances, /api/v1/home/banners, /api/v1/home/hot, /api/v1/home/new |
| `apps/web/hooks/use-search.ts` | React Query hook for search with keepPreviousData | VERIFIED | apiClient.get to /api/v1/search; placeholderData: keepPreviousData confirmed at line 24 |
| `apps/web/app/admin/layout.tsx` | Admin layout with role check | VERIFIED | user.role !== 'admin' redirects via router.replace('/'); AdminSidebar present |
| `apps/web/app/admin/performances/page.tsx` | Performance list with StatusFilter; error refresh button | VERIFIED | useAdminPerformances + useDeletePerformance hooks, StatusFilter; reload button in isError block |
| `apps/web/components/admin/performance-form.tsx` | 6-section form with react-hook-form + zod | VERIFIED | useForm, useFieldArray for priceTiers/showtimes/castings |
| `apps/web/components/admin/svg-preview.tsx` | SVG upload + seat count detection | VERIFIED | Presigned URL upload flow, data-seat-id counting, tier assignment |
| `apps/web/hooks/use-admin.ts` | All admin CRUD mutations | VERIFIED | 13 hooks: apiClient.post/put/delete to /api/v1/admin/* |
| `apps/web/middleware.ts` | Admin route protection | VERIFIED | Checks refreshToken cookie, matcher: ['/admin/:path*'] |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/genre/[genre]/page.tsx` | `apps/web/hooks/use-performances.ts` | usePerformances hook | WIRED | import { usePerformances } used in render |
| `apps/web/hooks/use-performances.ts` | `apps/web/lib/api-client.ts` | apiClient.get | WIRED | apiClient.get('/api/v1/performances?...') |
| `apps/web/components/layout/gnb.tsx` | `/genre/[genre]` pages | Link href=/genre/{slug} | WIRED | href={'/genre/${tab.slug}'} in genre tab links |
| `apps/web/components/home/hot-section.tsx` | `apps/web/hooks/use-performances.ts` | useHotPerformances | WIRED | import { useHotPerformances } used internally |
| `apps/web/components/home/new-section.tsx` | `apps/web/hooks/use-performances.ts` | useNewPerformances | WIRED | import { useNewPerformances } used internally |
| `apps/web/components/admin/performance-form.tsx` | `apps/web/hooks/use-admin.ts` | useMutation | WIRED | useMutation hooks from use-admin.ts invoked on submit |
| `apps/web/hooks/use-admin.ts` | `apps/web/lib/api-client.ts` | apiClient.post/put/delete to /api/v1/admin/* | WIRED | All admin endpoints present |
| `apps/web/middleware.ts` | `/admin` routes | route matching + redirect | WIRED | matcher: ['/admin/:path*'], redirects to /auth when no refreshToken |
| `apps/web/app/admin/banners/page.tsx` | `apps/web/hooks/use-admin.ts` | useUpdateBanner | WIRED | useCreateBanner, useUpdateBanner, useDeleteBanner imported and used |
| `apps/api/src/modules/admin/admin-performance.controller.ts` | `apps/api/src/common/guards/roles.guard.ts` | @UseGuards(RolesGuard) | WIRED | @UseGuards(RolesGuard) @Roles('admin') at class level |
| `apps/api/src/modules/performance/performance.service.ts` | `apps/api/src/database/schema/performances.ts` | Drizzle injection | WIRED | .from(performances) in all query methods |
| `apps/api/src/app.module.ts` | `apps/api/src/modules/performance/performance.module.ts` | imports array | WIRED | PerformanceModule in imports |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/web/app/page.tsx` | banners from useHomeBanners | apiClient → GET /api/v1/home/banners → PerformanceService.getHomeBanners → Drizzle SELECT banners WHERE isActive=true | Yes — live DB query | FLOWING |
| `apps/web/app/genre/[genre]/page.tsx` | data from usePerformances | apiClient → GET /api/v1/performances?genre=X → PerformanceService.findByGenre → Drizzle query with genre filter + pagination | Yes — live DB query | FLOWING |
| `apps/web/app/performance/[id]/page.tsx` | performance from usePerformanceDetail | apiClient → GET /api/v1/performances/:id → PerformanceService.findById → Drizzle joins + sub-queries for all relations | Yes — live DB query | FLOWING |
| `apps/web/app/search/page.tsx` | data from useSearch | apiClient → GET /api/v1/search?q=X → SearchService.search → Drizzle with tsvector + ILIKE; keepPreviousData prevents undefined flash | Yes — live DB query | FLOWING |
| `apps/web/app/admin/performances/page.tsx` | performance list from useAdminPerformances | apiClient → GET /api/v1/admin/performances → AdminService.listPerformances → Drizzle SELECT with optional filters | Yes — live DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server and populated database. All 9 frontend component tests pass (status-badge 5/5, pagination-nav 4/4). Backend: 62/63 pass; 1 regression in auth.service.spec.ts documented in gaps.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PERF-01 | 02-01, 02-02, 02-03 | Genre-based category browsing (8 genres) | SATISFIED | genreEnum in performances.ts; /genre/[genre]/page.tsx with usePerformances; GNB genre tabs with dropdown |
| PERF-02 | 02-01, 02-02, 02-03 | Subcategory filter (전체, HOT, 오리지널/내한 등) | SATISFIED | subcategory field in DB; sub query param in findByGenre; genre page GenreChip filter row |
| PERF-03 | 02-01, 02-02, 02-03 | Detail page: poster, venue, dates, runtime, ageRating, price table | SATISFIED | /performance/[id]/page.tsx renders venue.name, priceTiers.map, runtime, ageRating, StatusBadge; spacing corrected |
| PERF-04 | 02-01, 02-02, 02-03 | Casting information on detail page | SATISFIED | /performance/[id]/page.tsx renders castings.map in Casting tab; PerformanceWithDetails.castings populated from DB |
| PERF-05 | 02-01, 02-02, 02-03 | Card-style paginated performance list | SATISFIED | PerformanceCard component; PerformanceGrid with loading/empty states; PaginationNav; 20 per page default |
| SRCH-01 | 02-01, 02-02, 02-03 | Keyword search by performance title | SATISFIED | SearchService uses search_vector @@ plainto_tsquery OR title ILIKE; /search page with q param |
| SRCH-02 | 02-01, 02-02, 02-03 | Filter search results by genre | SATISFIED | searchQuerySchema has genre field; SearchService applies eq(performances.genre, genre); search page GenreChip row; stable layout via keepPreviousData |
| SRCH-03 | 02-01, 02-02, 02-03 | Ended performance toggle | SATISFIED | ended param in searchQuerySchema; search page Switch toggle; ended=false excludes status='ended' |
| ADMN-01 | 02-02, 02-04 | Admin can register/edit/delete performances | SATISFIED | POST/PUT/DELETE /api/v1/admin/performances; PerformanceForm with all fields; delete confirmation AlertDialog |
| ADMN-02 | 02-02, 02-04 | Admin can manage showtimes | SATISFIED | showtimes in createPerformanceSchema; ShowtimeManager component with useFieldArray; backend deletes+reinserts on update |
| ADMN-03 | 02-02, 02-04 | Admin can upload SVG seat map and configure tiers | SATISFIED | UploadService with R2 presigned URL; SvgPreview component counts data-seat-id; TierEditor for color/seat assignment; saveSeatMap endpoint |

**All 11 Phase 2 requirements SATISFIED.**

No orphaned requirements found — REQUIREMENTS.md Traceability table maps exactly PERF-01..05, SRCH-01..03, ADMN-01..03 to Phase 2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/modules/auth/auth.service.spec.ts` | 224 | Test missing mockUserRepo.findById setup after f461502 added findById call to refreshTokens() | Warning (regression) | 1/63 backend test fails; AUTH-06 test suite no longer green |

**Note on previous radix-ui warning:** Resolved. radix-ui@1.4.3 is installed in node_modules. status-badge.test.tsx passes 5/5 tests.

---

### Human Verification Required

All 6 human UAT scenarios have been completed (per 02-HUMAN-UAT.md):

1. Homepage rendering with live data — **PASSED**
2. Genre category page (/genre/musical) — **PASSED**
3. Performance detail page (/performance/:id) — **PASSED** (cosmetic spacing fixed in Plan 05)
4. Search page (/search?q=X) — **PASSED** (layout shift fixed in Plan 05)
5. Admin performance creation flow — **PASSED**
6. Admin RBAC enforcement — **PASSED**

No further human verification required for Phase 2 goals.

---

### Gaps Summary

**1 gap found — Phase 1 test regression, outside Phase 2 scope:**

Commit `f461502` (fix(auth): include role/email in refreshed JWT) added a `userRepository.findById()` call in `AuthService.refreshTokens()` to embed the user's current role and email in the refreshed access token. This is correct behavior for AUTH-06. However, the test at `auth.service.spec.ts:224` ("should return new accessToken and refreshToken when valid token provided") was not updated to mock `mockUserRepo.findById` — causing it to throw `UnauthorizedException('사용자를 찾을 수 없습니다')` inside the test.

**Fix:** Add `mockUserRepo.findById.mockResolvedValue(mockUser)` to the test setup block at line ~244 in `auth.service.spec.ts` (after the existing `mockDb.update` setup and before the `authService.refreshTokens(rawToken)` call).

**Scope note:** This is a Phase 1 (AUTH-06) test, not a Phase 2 requirement. All 11 Phase 2 requirements (PERF-01..05, SRCH-01..03, ADMN-01..03) remain SATISFIED. The phase goal is structurally achieved. This regression should be fixed before closing Phase 2 to keep `pnpm test` green.

---

_Verified: 2026-03-31T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
