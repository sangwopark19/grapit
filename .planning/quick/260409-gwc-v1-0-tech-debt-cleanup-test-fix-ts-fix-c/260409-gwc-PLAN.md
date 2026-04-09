---
phase: quick-260409-gwc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - apps/web/components/skeletons/index.ts
  - apps/web/components/skeletons/detail-header-skeleton.tsx
  - apps/web/components/skeletons/detail-tabs-skeleton.tsx
  - apps/web/components/skeletons/genre-grid-skeleton.tsx
  - apps/web/components/skeletons/mypage-profile-skeleton.tsx
  - apps/web/components/skeletons/seat-map-skeleton.tsx
  - apps/web/components/__tests__/skeleton-variants.test.tsx
autonomous: true
must_haves:
  truths:
    - "REQUIREMENTS.md에서 PERF-01,03,04,05 / SRCH-03 / SEAT-01~06 / BOOK-01~04 / INFR-01~03 이 [x]로 체크됨"
    - "Traceability 테이블에서 해당 요구사항들의 Status가 Complete"
    - "orphaned skeleton 5개 파일이 삭제되고 index.ts와 테스트에서 참조 제거됨"
    - "vitest 테스트가 통과함"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "17건 체크박스 갱신 + traceability Complete"
    - path: "apps/web/components/skeletons/index.ts"
      provides: "orphaned export 5건 제거"
  key_links: []
---

<objective>
v1.0 기술부채 정리: REQUIREMENTS.md 체크박스 17건 갱신 및 미사용 skeleton 컴포넌트 5개 삭제.

NOTE: 원래 4건이었으나, seat-map-viewer 테스트 분리(commit 74e1b24)와 paidAt null 체크는 이미 반영되어 있어 이 플랜에서 제외함.

Purpose: 프로젝트 추적 문서를 실제 구현 상태와 동기화하고, 사용되지 않는 파일을 제거하여 코드베이스를 정리한다.
Output: 갱신된 REQUIREMENTS.md, 삭제된 skeleton 파일 5개, 수정된 index.ts 및 테스트 파일
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@apps/web/components/skeletons/index.ts
@apps/web/components/__tests__/skeleton-variants.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: REQUIREMENTS.md 체크박스 17건 갱신 + traceability 테이블 업데이트</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
REQUIREMENTS.md에서 아래 18건의 체크박스를 `[ ]`에서 `[x]`로 변경:
- 22행: PERF-01
- 24행: PERF-03
- 25행: PERF-04
- 26행: PERF-05
- 32행: SRCH-03
- 36행: SEAT-01
- 37행: SEAT-02
- 38행: SEAT-03
- 39행: SEAT-04
- 40행: SEAT-05
- 41행: SEAT-06
- 42행: BOOK-01
- 43행: BOOK-02
- 44행: BOOK-03
- 45행: BOOK-04
- 72행: INFR-01
- 73행: INFR-02
- 74행: INFR-03

Traceability 테이블에서 동일 요구사항의 Status를 "Pending"에서 "Complete"로 변경:
- 131행: PERF-01
- 133행: PERF-03
- 134행: PERF-04
- 135행: PERF-05
- 138행: SRCH-03
- 142행: SEAT-01
- 143행: SEAT-02
- 144행: SEAT-03
- 145행: SEAT-04
- 146행: SEAT-05
- 147행: SEAT-06
- 148행: BOOK-01
- 149행: BOOK-02
- 150행: BOOK-03
- 151행: BOOK-04
- 164행: INFR-01
- 165행: INFR-02
- 166행: INFR-03
  </action>
  <verify>grep -c '\- \[ \]' .planning/REQUIREMENTS.md 로 0 반환 (v1 섹션에 미체크 항목 없음)</verify>
  <done>v1 Requirements 섹션의 모든 체크박스가 [x]이고, Traceability 테이블에서 v1 요구사항 전부 Complete</done>
</task>

<task type="auto">
  <name>Task 2: orphaned skeleton 5개 삭제 + index.ts/테스트 정리</name>
  <files>
apps/web/components/skeletons/detail-header-skeleton.tsx
apps/web/components/skeletons/detail-tabs-skeleton.tsx
apps/web/components/skeletons/genre-grid-skeleton.tsx
apps/web/components/skeletons/mypage-profile-skeleton.tsx
apps/web/components/skeletons/seat-map-skeleton.tsx
apps/web/components/skeletons/index.ts
apps/web/components/__tests__/skeleton-variants.test.tsx
  </files>
  <action>
1. 아래 5개 파일을 삭제 (rm):
   - apps/web/components/skeletons/detail-header-skeleton.tsx
   - apps/web/components/skeletons/detail-tabs-skeleton.tsx
   - apps/web/components/skeletons/genre-grid-skeleton.tsx
   - apps/web/components/skeletons/mypage-profile-skeleton.tsx
   - apps/web/components/skeletons/seat-map-skeleton.tsx

2. apps/web/components/skeletons/index.ts 에서 삭제된 파일의 export 5줄을 제거:
   - export { GenreGridSkeleton } from './genre-grid-skeleton';
   - export { DetailHeaderSkeleton } from './detail-header-skeleton';
   - export { DetailTabsSkeleton } from './detail-tabs-skeleton';
   - export { SeatMapSkeleton } from './seat-map-skeleton';
   - export { MyPageProfileSkeleton } from './mypage-profile-skeleton';

   남아야 할 export:
   - PerformanceCardSkeleton
   - BannerSkeleton
   - SectionSkeleton
   - SearchResultsSkeleton
   - ReservationListSkeleton
   - ReservationDetailSkeleton

3. apps/web/components/__tests__/skeleton-variants.test.tsx 에서:
   - 삭제된 5개 skeleton의 import 제거 (GenreGridSkeleton, DetailHeaderSkeleton, DetailTabsSkeleton, SeatMapSkeleton, MyPageProfileSkeleton)
   - GenreGridSkeleton describe 블록 (39-46행) 삭제
   - DetailHeaderSkeleton describe 블록 (58-66행) 삭제
   - allSkeletons 배열에서 삭제된 5개 항목 제거 (GenreGridSkeleton, DetailHeaderSkeleton, DetailTabsSkeleton, SeatMapSkeleton, MyPageProfileSkeleton)
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web exec vitest run --reporter=verbose components/__tests__/skeleton-variants.test.tsx</automated>
  </verify>
  <done>orphaned skeleton 5개 파일 삭제됨, index.ts에서 export 제거됨, 테스트 파일에서 참조 제거되고 테스트 통과</done>
</task>

</tasks>

<verification>
1. `grep -c '\- \[ \]' .planning/REQUIREMENTS.md` 가 0 반환 (v1 섹션)
2. `ls apps/web/components/skeletons/` 에 삭제 대상 5개 파일 없음
3. `pnpm --filter @grapit/web exec vitest run components/__tests__/skeleton-variants.test.tsx` 통과
</verification>

<success_criteria>
- REQUIREMENTS.md v1 체크박스 18건 모두 [x] 상태
- Traceability 테이블 18건 모두 Complete
- orphaned skeleton 5개 파일 삭제
- skeleton index.ts, skeleton-variants.test.tsx 정리 완료
- vitest 통과
</success_criteria>

<output>
After completion, create `.planning/quick/260409-gwc-v1-0-tech-debt-cleanup-test-fix-ts-fix-c/260409-gwc-SUMMARY.md`
</output>
