---
status: diagnosed
phase: 02-catalog-admin
source: [02-00-SUMMARY.md, 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-03-31T10:42:00Z
updated: 2026-03-31T12:30:00Z
---

## Current Test

[testing complete]

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
result: pass

### 6. Admin RBAC enforcement
expected: Middleware redirects non-admin user from /admin/* to / or /auth
result: pass

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Performance detail page renders with proper spacing and layout"
  status: failed
  reason: "User reported: 전부 다 보이는데, 패딩, 마진 등이 이상해서 수정해야됨"
  severity: cosmetic
  test: 3
  root_cause: "5개 복합 spacing 이슈: (1) TabsContent mt-4 + page py-8 이중 여백, (2) 고정 CTA바 가림 방지 하단 패딩 없음, (3) 모바일 poster 너비 무제한, (4) prose max-w-none으로 1200px 줄 길이, (5) info panel 불규칙 vertical rhythm"
  artifacts:
    - path: "apps/web/app/performance/[id]/page.tsx"
      issue: "TabsContent py-8 이중 여백, 모바일 하단 패딩 미비, poster 무제한 너비, prose max-w-none"
    - path: "apps/web/components/ui/tabs.tsx"
      issue: "Line 47 mt-4 base class가 page-level py-8과 중복"
  missing:
    - "TabsContent에서 py-8 제거, 단일 mt-6으로 통일"
    - "main에 pb-20 lg:pb-8 추가 (고정 CTA바 공간 확보)"
    - "모바일 poster max-w-[280px] mx-auto 추가"
    - "prose max-w-none → max-w-prose로 변경"
    - "info panel vertical spacing 16px/24px 단위로 정규화"
  debug_session: ".planning/debug/detail-page-spacing.md"

- truth: "Search page layout remains stable when toggling genre chips"
  status: failed
  reason: "User reported: 잘 보이는데 장르 칩 누를때마다 패딩 마진이 바뀌어서 수정해야됨"
  severity: cosmetic
  test: 4
  root_cause: "useSearch hook에 placeholderData: keepPreviousData 미사용 → 칩 토글 시 data→undefined로 리셋되어 total count 조건부 렌더링에서 layout shift 발생. 추가로 검색 페이지 내 중복 empty-state 처리가 PerformanceGrid와 충돌"
  artifacts:
    - path: "apps/web/app/search/page.tsx"
      issue: "Lines 64-66 조건부 total count가 data undefined 시 사라짐, Lines 95-127 중복 empty-state"
    - path: "apps/web/hooks/use-search.ts"
      issue: "useQuery에 placeholderData: keepPreviousData 누락"
  missing:
    - "use-search.ts useQuery에 placeholderData: keepPreviousData 추가"
    - "search/page.tsx 인라인 empty-state 제거, PerformanceGrid에 위임 (genre 페이지 패턴과 통일)"
    - "total count 컨테이너를 항상 렌더링 (skeleton/placeholder로 공간 확보)"
  debug_session: ".planning/debug/search-chip-layout.md"
