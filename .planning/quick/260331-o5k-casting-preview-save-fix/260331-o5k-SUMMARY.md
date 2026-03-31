---
phase: quick
plan: 260331-o5k
subsystem: admin-ui, database
tags: [bugfix, casting-preview, venues-schema, drizzle-migration]
dependency-graph:
  requires: []
  provides: [casting-photo-preview, venues-unique-constraint]
  affects: [admin-performance-form, venues-table]
tech-stack:
  added: []
  patterns: [useWatch-for-live-form-value, blob-url-instant-preview, CastingCard-extraction]
key-files:
  created:
    - apps/api/src/database/migrations/0002_huge_vengeance.sql
  modified:
    - apps/web/components/admin/casting-manager.tsx
    - apps/web/components/admin/performance-form.tsx
    - apps/api/src/database/schema/venues.ts
decisions:
  - Extracted CastingCard as internal component for per-card useWatch subscription
  - Blob URL preview takes priority over server URL for instant UX
metrics:
  duration: 2min
  completed: 2026-03-31
---

# Quick Task 260331-o5k: Casting Photo Preview + Performance Save Fix Summary

Casting photo blob URL instant preview via useWatch + CastingCard extraction; venues.name UNIQUE constraint to fix onConflictDoUpdate 500 error

## What Was Done

### Task 1: Casting photo preview (b10b3db)

**Root cause:** `useFieldArray`'s `fields` array is a snapshot at append/remove time. When `setValue('castings.N.photoUrl', publicUrl)` is called after upload, `field.photoUrl` remains null because the snapshot doesn't update -- the image preview never appears.

**Fix:**
- Extracted `CastingCard` component with `useWatch({ control, name: \`castings.${index}.photoUrl\` })` to subscribe to live form value changes
- Added blob URL instant preview: `URL.createObjectURL(file)` is set to local state on file select, providing immediate visual feedback before upload completes
- Display priority: `preview` (blob URL) > `watchedPhotoUrl` (server URL from form state)
- Existing photos are now clickable to trigger file replacement
- Added `control` prop to `CastingManagerProps` interface and passed from `PerformanceForm`

### Task 2: venues.name UNIQUE constraint (7ba8d27)

**Root cause:** `admin.service.ts` uses `onConflictDoUpdate({ target: venues.name })` but the `venues` table had no UNIQUE constraint on the `name` column. PostgreSQL requires a unique index for `ON CONFLICT (name)` to work, causing a 500 error on every performance save.

**Fix:**
- Added `.unique()` to `venues.name` column in Drizzle schema
- Generated migration `0002_huge_vengeance.sql`: `ALTER TABLE "venues" ADD CONSTRAINT "venues_name_unique" UNIQUE("name")`
- Applied migration successfully

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | b10b3db | fix(quick-260331-o5k): casting photo preview with useWatch + blob URL | casting-manager.tsx, performance-form.tsx |
| 2 | 7ba8d27 | fix(quick-260331-o5k): add UNIQUE constraint to venues.name column | venues.ts, 0002_huge_vengeance.sql, meta files |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Verification

- TypeScript compilation (web): PASSED
- TypeScript compilation (api): PASSED
- Migration generated and applied: PASSED
- Manual verification pending: casting photo preview display, performance save without 500 error

## Self-Check: PASSED

- All 4 key files FOUND
- Commit b10b3db FOUND
- Commit 7ba8d27 FOUND
