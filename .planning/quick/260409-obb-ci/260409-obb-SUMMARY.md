---
phase: quick
plan: 260409-obb
subsystem: web/testing
tags: [ci, vitest, config]
dependency_graph:
  requires: []
  provides: [vitest-e2e-exclusion]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [vitest-exclude-config]
key_files:
  created: []
  modified:
    - apps/web/vitest.config.ts
decisions:
  - Preserve node_modules in exclude array since custom exclude overrides Vitest defaults
metrics:
  duration: 39s
  completed: "2026-04-09T08:33:14Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Quick Plan 260409-obb: Exclude e2e from Vitest Summary

Added `exclude: ['e2e/**', 'node_modules/**']` to Vitest config to prevent Playwright e2e tests from conflicting with Vitest runner in CI.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add e2e exclusion to Vitest config | c937274 | Done |

### Task 1: Add e2e exclusion to Vitest config

Added `exclude` array to the `test` section in `apps/web/vitest.config.ts`. Two entries:
- `e2e/**` -- prevents Vitest from scanning the Playwright test directory
- `node_modules/**` -- preserves the Vitest default exclusion that gets overridden when a custom `exclude` is provided

**Verification:** `vitest run` passes with 14 test files (87 tests), zero e2e files in the collection.

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
