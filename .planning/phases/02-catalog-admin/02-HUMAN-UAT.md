---
status: testing
phase: 02-catalog-admin
source: [02-00-SUMMARY.md, 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-03-31T10:42:00Z
updated: 2026-03-31T11:00:00Z
---

## Current Test

number: 5
name: Admin performance creation
expected: |
  Performance created; redirects to list; new entry visible
awaiting: user response

## Tests

### 1. Homepage rendering with real data
expected: Banner carousel plays, HOT and New cards show actual performance titles/posters from DB
result: pass

### 2. Genre category page (/genre/musical)
expected: Performance cards render; sort and ended filter update URL params; pagination works
result: pass

### 3. Performance detail page (/performance/:id)
expected: All tab panels render real content from PerformanceWithDetails response
result: issue
reported: "전부 다 보이는데, 패딩, 마진 등이 이상해서 수정해야됨"
severity: cosmetic

### 4. Search page (/search?q=hamlet)
expected: Results update; ended toggle and genre chips re-fetch with updated params
result: issue
reported: "잘 보이는데 장르 칩 누를때마다 패딩 마진이 바뀌어서 수정해야됨"
severity: cosmetic

### 5. Admin performance creation
expected: Performance created; redirects to list; new entry visible
result: [pending]

### 6. Admin RBAC enforcement
expected: Middleware redirects non-admin user from /admin/* to / or /auth
result: [pending]

## Summary

total: 6
passed: 2
issues: 2
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Performance detail page renders with proper spacing and layout"
  status: failed
  reason: "User reported: 전부 다 보이는데, 패딩, 마진 등이 이상해서 수정해야됨"
  severity: cosmetic
  test: 3
  artifacts: []
  missing: []

- truth: "Search page layout remains stable when toggling genre chips"
  status: failed
  reason: "User reported: 잘 보이는데 장르 칩 누를때마다 패딩 마진이 바뀌어서 수정해야됨"
  severity: cosmetic
  test: 4
  artifacts: []
  missing: []
