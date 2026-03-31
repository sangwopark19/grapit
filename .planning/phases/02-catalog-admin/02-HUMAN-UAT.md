---
status: partial
phase: 02-catalog-admin
source: [02-VERIFICATION.md]
started: 2026-03-31T10:42:00Z
updated: 2026-03-31T10:42:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Homepage rendering with real data
expected: Banner carousel plays, HOT and New cards show actual performance titles/posters from DB
result: [pending]

### 2. Genre category page (/genre/musical)
expected: Performance cards render; sort and ended filter update URL params; pagination works
result: [pending]

### 3. Performance detail page (/performance/:id)
expected: All tab panels render real content from PerformanceWithDetails response
result: [pending]

### 4. Search page (/search?q=hamlet)
expected: Results update; ended toggle and genre chips re-fetch with updated params
result: [pending]

### 5. Admin performance creation
expected: Performance created; redirects to list; new entry visible
result: [pending]

### 6. Admin RBAC enforcement
expected: Middleware redirects non-admin user from /admin/* to / or /auth
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
