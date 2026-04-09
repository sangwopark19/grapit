---
phase: 02-catalog-admin
plan: 04
subsystem: ui
tags: [react-hook-form, zod, shadcn, admin-panel, r2-upload, svg-seat-map, banner-management]

requires:
  - phase: 02-catalog-admin/02
    provides: Admin API endpoints (CRUD, upload, RBAC)
  - phase: 02-catalog-admin/03
    provides: Shared types, schemas, StatusBadge, PaginationNav
  - phase: 01-foundation-auth
    provides: Auth store, API client, GNB, Footer, shadcn base setup
provides:
  - Admin layout with sidebar navigation and role-based access control
  - Performance CRUD pages (list with filters, create form, edit form)
  - Banner management page with create/edit/delete/reorder
  - SVG seat map upload and tier assignment interface
  - Admin route protection via middleware
  - Reusable admin hooks for all CRUD operations
affects: [03-booking-flow, 05-polish]

tech-stack:
  added: [@tanstack/react-query]
  patterns: [admin-sidebar-layout, presigned-upload-flow, zod-form-validation, field-array-pattern]

key-files:
  created:
    - apps/web/middleware.ts
    - apps/web/app/layout-shell.tsx
    - apps/web/app/admin/layout.tsx
    - apps/web/app/admin/performances/page.tsx
    - apps/web/app/admin/performances/new/page.tsx
    - apps/web/app/admin/performances/[id]/edit/page.tsx
    - apps/web/app/admin/banners/page.tsx
    - apps/web/components/admin/admin-sidebar.tsx
    - apps/web/components/admin/status-filter.tsx
    - apps/web/components/admin/performance-form.tsx
    - apps/web/components/admin/showtime-manager.tsx
    - apps/web/components/admin/casting-manager.tsx
    - apps/web/components/admin/svg-preview.tsx
    - apps/web/components/admin/tier-editor.tsx
    - apps/web/components/admin/banner-manager.tsx
    - apps/web/hooks/use-admin.ts
  modified:
    - apps/web/app/layout.tsx
    - apps/web/lib/api-client.ts
    - packages/shared/src/index.ts
    - packages/shared/src/schemas/performance.schema.ts

key-decisions:
  - "Used LayoutShell client component to conditionally hide GNB/Footer on /admin routes"
  - "Used z.input<> type for react-hook-form compatibility with zod .default() fields"
  - "Middleware checks refreshToken cookie only; full admin role check is client-side in layout"
  - "Banner reorder uses up/down arrow buttons instead of drag-and-drop for simplicity"

patterns-established:
  - "Admin layout pattern: sidebar (240px) + header + content area with role guard"
  - "Presigned upload pattern: POST /admin/upload/presigned -> PUT to R2 directly"
  - "useFieldArray pattern for dynamic form sections (priceTiers, showtimes, castings)"
  - "AlertDialog confirmation for all destructive actions with UI-SPEC copy"

requirements-completed: [ADMN-01, ADMN-02, ADMN-03]

duration: 12min
completed: 2026-03-31
---

# Phase 02 Plan 04: Admin Panel Frontend Summary

**Admin panel with performance CRUD (6-section form with file uploads), banner management with reorder, and SVG seat map tier assignment using react-hook-form + zod validation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-31T01:15:08Z
- **Completed:** 2026-03-31T01:27:08Z
- **Tasks:** 2
- **Files modified:** 29 (Task 1) + 10 (Task 2) = 39

## Accomplishments
- Complete admin panel with sidebar layout, route protection, and role-based access
- Performance list page with status filter chips, debounced search, table with proper semantics, and delete confirmation
- Performance create/edit form with 6 sections (basic info, media/poster upload, price tiers, showtimes, castings with photos, seat map)
- Banner management with create/edit (inline form)/delete/reorder functionality
- SVG seat map upload with tier color assignment and seat count detection
- All forms use react-hook-form + zod with blur validation

## Task Commits

1. **Task 1: Admin layout, middleware, hooks, performance list** - `e47e6d0` (feat)
2. **Task 2: Performance form, banner management, SVG seat map** - `a65eb59` (feat)

## Files Created/Modified
- `apps/web/middleware.ts` - Route protection for /admin/* (checks refreshToken cookie)
- `apps/web/app/layout-shell.tsx` - Client wrapper that hides GNB/Footer on admin routes
- `apps/web/app/layout.tsx` - Updated to use LayoutShell
- `apps/web/app/admin/layout.tsx` - Admin layout with sidebar, header, role check, mobile Sheet
- `apps/web/app/admin/performances/page.tsx` - Performance list table with filters/search/pagination
- `apps/web/app/admin/performances/new/page.tsx` - Create page wrapping PerformanceForm
- `apps/web/app/admin/performances/[id]/edit/page.tsx` - Edit page with data prefill
- `apps/web/app/admin/banners/page.tsx` - Banner CRUD with reorder
- `apps/web/components/admin/admin-sidebar.tsx` - 240px sidebar with active link detection
- `apps/web/components/admin/status-filter.tsx` - Filter chips (전체/판매중/판매예정/판매종료)
- `apps/web/components/admin/performance-form.tsx` - 6-section form with react-hook-form + zod
- `apps/web/components/admin/showtime-manager.tsx` - Date/time table with field array
- `apps/web/components/admin/casting-manager.tsx` - Photo upload grid with presigned URLs
- `apps/web/components/admin/svg-preview.tsx` - SVG upload, preview, seat count
- `apps/web/components/admin/tier-editor.tsx` - Color picker + seat ID assignment
- `apps/web/components/admin/banner-manager.tsx` - Banner form component for create/edit
- `apps/web/hooks/use-admin.ts` - All admin CRUD hooks (13 total)
- `apps/web/lib/api-client.ts` - Added put method
- `packages/shared/src/schemas/performance.schema.ts` - Added CreatePerformanceFormInput type

## Decisions Made
- **LayoutShell for GNB/Footer hiding**: Used a client component wrapper in root layout that conditionally renders GNB/Footer based on pathname instead of route groups, keeping the layout hierarchy flat
- **z.input<> for form types**: Zod v3 `.default()` makes fields optional in input type but required in output type. react-hook-form + zodResolver needs the input type. Exported `CreatePerformanceFormInput` using `z.input<>` for form compatibility
- **Middleware refresh check only**: Since access tokens are stored in Zustand memory (not cookies), middleware can only check refreshToken cookie presence. Full admin role validation happens client-side in the admin layout component
- **Arrow buttons for banner reorder**: Chose up/down arrow buttons over drag-and-drop for Phase 2 simplicity. Drag-and-drop can be added in Phase 5 polish

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created shared performance types/schemas (parallel dependency)**
- **Found during:** Task 1
- **Issue:** Plans 02-01/02-02/02-03 run in parallel and their outputs (performance types, schemas, StatusBadge, PaginationNav, shadcn components) don't exist in this worktree
- **Fix:** Created the dependency files directly matching the specs from the other agents' worktrees
- **Files modified:** packages/shared/src/types/performance.types.ts, packages/shared/src/schemas/performance.schema.ts, packages/shared/src/index.ts, apps/web/components/performance/status-badge.tsx, apps/web/components/performance/pagination-nav.tsx
- **Committed in:** e47e6d0

**2. [Rule 3 - Blocking] Added apiClient.put method**
- **Found during:** Task 1
- **Issue:** apiClient only had get/post/patch/delete, but admin API requires PUT for updates
- **Fix:** Added `put` method to apiClient
- **Files modified:** apps/web/lib/api-client.ts
- **Committed in:** e47e6d0

**3. [Rule 3 - Blocking] Installed @tanstack/react-query**
- **Found during:** Task 1
- **Issue:** Package not in web app dependencies, needed for admin hooks
- **Fix:** Ran pnpm add @tanstack/react-query
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Committed in:** e47e6d0

**4. [Rule 3 - Blocking] Created lib/index.ts barrel export**
- **Found during:** Task 1
- **Issue:** Newly installed shadcn components import from `@/lib` but the project only had `@/lib/cn.ts`
- **Fix:** Created apps/web/lib/index.ts re-exporting cn
- **Files modified:** apps/web/lib/index.ts
- **Committed in:** e47e6d0

**5. [Rule 1 - Bug] Fixed zod input/output type mismatch**
- **Found during:** Task 2
- **Issue:** `CreatePerformanceInput` (z.infer output type) had required `sortOrder: number` but react-hook-form expects the input type where `.default()` makes it optional
- **Fix:** Added `CreatePerformanceFormInput = z.input<typeof createPerformanceSchema>` and used it for form and sub-component typing
- **Files modified:** packages/shared/src/schemas/performance.schema.ts, apps/web/components/admin/performance-form.tsx, showtime-manager.tsx, casting-manager.tsx
- **Committed in:** a65eb59

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary due to parallel execution context. No scope creep.

## Issues Encountered
- Parallel agent worktrees don't share dependencies -- had to recreate shared types/schemas and UI components from the other agents' work. These will be deduplicated when the orchestrator merges all worktrees.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are wired to real API hooks via apiClient.

## Next Phase Readiness
- Admin panel is complete and ready for integration testing
- All hooks point to the correct API endpoints from Plan 02-02
- SVG seat map interface is ready for Phase 3 seat selection integration
- Banner management hooks are ready for homepage carousel (Plan 02-03)

---
## Self-Check: PASSED

All 16 key files verified present. Both task commits (e47e6d0, a65eb59) verified in git log.

---
*Phase: 02-catalog-admin*
*Completed: 2026-03-31*
