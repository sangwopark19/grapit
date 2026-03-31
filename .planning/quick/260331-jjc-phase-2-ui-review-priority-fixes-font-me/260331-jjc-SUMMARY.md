---
phase: quick
plan: 260331-jjc
subsystem: frontend-web
tags: [ui, design-system, font-weight, accessibility, admin]
dependency_graph:
  requires: []
  provides: [font-medium-removal, home-h1, admin-error-refresh]
  affects: [apps/web/components, apps/web/app]
tech_stack:
  added: []
  patterns: [tailwind-token-over-hardcoded-hex, sr-only-h1-pattern, window.location.reload-error-recovery]
key_files:
  created: []
  modified:
    - apps/web/components/performance/pagination-nav.tsx
    - apps/web/components/performance/genre-chip.tsx
    - apps/web/components/performance/sort-toggle.tsx
    - apps/web/components/layout/gnb.tsx
    - apps/web/components/layout/mobile-menu.tsx
    - apps/web/components/admin/admin-sidebar.tsx
    - apps/web/components/admin/performance-form.tsx
    - apps/web/components/admin/banner-manager.tsx
    - apps/web/components/admin/tier-editor.tsx
    - apps/web/components/admin/status-filter.tsx
    - apps/web/app/admin/performances/page.tsx
    - apps/web/app/admin/banners/page.tsx
    - apps/web/app/admin/performances/[id]/edit/page.tsx
    - apps/web/app/page.tsx
    - apps/web/components/home/genre-grid.tsx
decisions:
  - "font-medium 대체 기준: 선택/강조/레이블 UI → font-semibold, 본문/캡션/이니셜 → font-normal"
  - "sr-only h1을 홈 페이지에 추가하여 시각적 변화 없이 SEO/접근성 heading hierarchy 충족"
  - "admin 에러 복구는 window.location.reload()로 단순화 (현재 refresh query hook 없음)"
metrics:
  duration_seconds: 282
  completed_date: "2026-03-31"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 15
---

# Phase quick Plan 260331-jjc: Phase 2 UI Review Priority Fixes Summary

**One-liner:** font-weight 400/600 계약 준수(font-medium 전면 제거), 홈 h1.sr-only 추가, 어드민 에러 새로고침 버튼 3곳 구현으로 UI-SPEC 점수 개선

## What Was Built

Phase 2 UI Review에서 식별된 디자인 시스템 위반 3개 항목을 수정했다.

1. **font-medium 전면 제거** — 프로젝트 소유 컴포넌트 15개 파일에서 font-medium(500) 클래스를 제거하고 UI-SPEC 계약(400/600만 허용)에 맞게 교체했다.
2. **홈 페이지 h1 + 빈 상태 fallback** — `<h1 className="sr-only">Grapit</h1>` 추가로 페이지당 h1 하나 기준 충족. 배너가 없고 로딩 완료 시 안내 문구 표시.
3. **어드민 에러 새로고침 버튼** — performances 목록, banners 목록, performance 편집 페이지 3곳의 isError 블록에 클릭 가능한 새로고침 버튼 추가.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | font-medium 제거 | 51af8e0 | 15 files |
| 2 | 홈 h1 + 빈 상태 fallback | df6b093 | 1 file |
| 3 | 어드민 에러 새로고침 버튼 + genre-grid 주석 | 415f7bb | 4 files |

## Decisions Made

1. **font-semibold vs font-normal 기준** — 선택 UI(칩, 탭, 토글), 레이블(form label), 내비게이션 링크, 테이블 제목 셀, 섹션 소제목은 강조 의미가 있으므로 font-semibold. 아바타 이니셜, 사용자 이름 텍스트, 카테고리 캡션처럼 정보 전달이 주목적인 텍스트는 font-normal.

2. **sr-only h1 패턴** — 홈 페이지는 시각적 헤딩 없이 배너와 섹션으로 구성되어 있어 visible h1을 추가하면 디자인이 깨진다. sr-only로 접근성과 SEO를 충족하되 시각적 레이아웃을 유지.

3. **window.location.reload() 에러 복구** — 현재 admin 훅에는 별도 refetch 트리거가 없고, 에러 복구는 단순 페이지 새로고침이 가장 명확한 UX다. TanStack Query refetch 버튼으로 개선은 Phase 3 이후로 defer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] status-filter.tsx font-medium 누락**
- **Found during:** Task 1 검증 (`grep -rn "font-medium"` 실행 후 발견)
- **Issue:** 플랜에 명시되지 않았으나 `components/admin/status-filter.tsx`의 상태 필터 버튼에도 `font-medium`이 존재했음
- **Fix:** `font-semibold`로 교체 (선택 UI 요소 강조)
- **Files modified:** `apps/web/components/admin/status-filter.tsx`
- **Commit:** 51af8e0 (Task 1 커밋에 포함)

## Known Stubs

없음 — 이번 플랜은 기존 컴포넌트의 클래스 수정과 UI 요소 추가만 포함하며, 데이터 흐름은 변경하지 않았다.

## Self-Check: PASSED

- 15개 수정 파일 모두 존재
- 커밋 51af8e0, df6b093, 415f7bb 모두 git log에 존재
- `grep font-medium` 출력 비어있음 (0건)
- `tsc --noEmit` 에러 없음
