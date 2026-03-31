---
phase: quick
plan: 260331-ldw
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/performance/[id]/page.tsx
  - apps/web/components/ui/tabs.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "데스크탑에서 탭 섹션이 포스터 아래(왼쪽 컬럼)에 위치하고, 정보 패널은 오른쪽에 sticky로 유지된다"
    - "탭 콘텐츠가 짧아도 최소 높이가 보장되어 미완성처럼 보이지 않는다"
    - "탭 콘텐츠 영역에 시각적 컨테이너(배경+패딩)가 있어 내용이 구분된다"
    - "모바일 레이아웃은 기존과 동일하게 세로 스택으로 유지된다"
  artifacts:
    - path: "apps/web/app/performance/[id]/page.tsx"
      provides: "2-column layout with tabs in left column"
    - path: "apps/web/components/ui/tabs.tsx"
      provides: "TabsContent with min-height and visual container styling"
  key_links:
    - from: "apps/web/app/performance/[id]/page.tsx"
      to: "apps/web/components/ui/tabs.tsx"
      via: "TabsContent import"
      pattern: "TabsContent"
---

<objective>
상세 페이지 탭 UI/UX 개선: 데스크탑 2컬럼 레이아웃에서 탭을 왼쪽 컬럼(포스터 아래)으로 이동하고, 탭 콘텐츠에 최소 높이 + 시각적 컨테이너를 추가한다.

Purpose: 포스터와 탭 콘텐츠의 시각적 연결성 확보, 짧은 콘텐츠에서도 완성된 페이지 느낌 제공
Output: 수정된 상세 페이지 레이아웃 + 개선된 TabsContent 컴포넌트
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/app/performance/[id]/page.tsx
@apps/web/components/ui/tabs.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: TabsContent 컴포넌트에 min-height + 시각적 컨테이너 기본 스타일 추가</name>
  <files>apps/web/components/ui/tabs.tsx</files>
  <action>
TabsContent 컴포넌트의 기본 className에 다음을 추가한다:

1. 최소 높이: `min-h-[300px]` — 짧은 콘텐츠에서도 충분한 높이 확보
2. 시각적 컨테이너: `rounded-lg bg-gray-50 p-6` — 콘텐츠 영역을 시각적으로 구분
3. 기존 `mt-6`은 유지

변경 전: `'mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'`
변경 후: `'mt-6 min-h-[300px] rounded-lg bg-gray-50 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'`

주의: cn() 유틸리티를 사용하므로 외부에서 className prop으로 오버라이드 가능하다. 기존 동작을 깨뜨리지 않는다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "min-h-\[300px\]" apps/web/components/ui/tabs.tsx && grep -q "bg-gray-50" apps/web/components/ui/tabs.tsx && grep -q "p-6" apps/web/components/ui/tabs.tsx && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>TabsContent에 min-h-[300px], rounded-lg, bg-gray-50, p-6이 기본 스타일로 적용됨</done>
</task>

<task type="auto">
  <name>Task 2: 데스크탑 레이아웃을 2컬럼 구조로 변경 (탭을 왼쪽 컬럼으로 이동)</name>
  <files>apps/web/app/performance/[id]/page.tsx</files>
  <action>
현재 구조를 변경한다. 현재는 포스터+정보가 flex-row이고 탭이 그 아래 full-width로 있다.

현재 구조 (line 75-248):
```
div.flex-col.lg:flex-row  (포스터 + 정보패널)
div.mt-8                   (탭 섹션, full-width)
```

변경할 구조:
```
div.flex.flex-col.lg:flex-row.gap-8
  div.w-full.lg:max-w-[380px].shrink-0    (왼쪽 컬럼)
    div.poster                              (포스터 이미지)
    div.mt-8                                (탭 섹션 — 데스크탑에서 포스터 아래)
  div.flex-1.lg:sticky.lg:top-20.lg:self-start  (오른쪽 컬럼 — 정보 패널, sticky)
```

구체적 변경:
1. 최상위 flex 컨테이너를 하나만 두고 `flex flex-col lg:flex-row gap-8` 적용
2. 왼쪽 컬럼 wrapper div 생성: `w-full lg:max-w-[380px] shrink-0`
   - 포스터 div를 이 안에 넣는다. 포스터에서 `max-w-[280px] mx-auto lg:mx-0 lg:max-w-[380px]`는 유지하되, 부모가 max-w를 제한하므로 `lg:max-w-[380px]`는 그대로 유지
   - 탭 섹션(Tabs 전체)을 이 왼쪽 컬럼 안에 `mt-8`로 넣는다
3. 오른쪽 컬럼(정보 패널)은 기존 div 그대로 유지: `flex-1 lg:sticky lg:top-20 lg:self-start`
4. 기존 탭 섹션을 감싸던 별도 `div.mt-8`은 제거하고 왼쪽 컬럼 내부로 이동

모바일에서는 flex-col이므로 왼쪽 컬럼(포스터+탭)이 위, 정보 패널이 아래로 자연스럽게 쌓인다.
모바일에서 탭이 정보 패널보다 먼저 나오는 것이 문제라면 모바일에서만 순서를 바꿀 수 있으나, NOL 티켓 참조 시 모바일에서도 탭이 아래에 위치하는 것이 자연스럽다.

모바일 순서 조정: 정보 패널에 `lg:order-none order-first`를 추가하여 모바일에서 정보 패널이 먼저 나오고 탭이 아래로 가도록 한다.

DetailSkeleton도 동일한 레이아웃 구조로 업데이트한다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && npx --filter @grapit/web tsc --noEmit --project apps/web/tsconfig.json 2>&1 | tail -5</automated>
  </verify>
  <done>데스크탑에서 탭이 포스터 아래 왼쪽 컬럼에 위치하고, 정보 패널이 오른쪽에 sticky로 유지됨. 모바일에서는 정보 패널 → 탭 순서로 세로 스택 유지.</done>
</task>

</tasks>

<verification>
1. 타입 체크 통과: `npx tsc --noEmit --project apps/web/tsconfig.json`
2. 데스크탑 브라우저에서 상세 페이지 접속 시 탭이 포스터 아래(왼쪽)에 위치
3. 정보 패널이 스크롤 시 sticky로 유지
4. 탭 콘텐츠가 짧아도 최소 300px 높이 보장
5. 탭 콘텐츠 영역에 회색 배경 + 라운드 컨테이너 표시
6. 모바일에서 세로 스택 레이아웃 유지 (정보 패널 → 탭 순서)
</verification>

<success_criteria>
- 데스크탑: 2컬럼 레이아웃 (왼쪽=포스터+탭, 오른쪽=정보패널 sticky)
- TabsContent: min-h-[300px] + bg-gray-50 + p-6 + rounded-lg
- 모바일: 기존 세로 스택 유지, 정보 패널이 탭보다 위에 위치
- TypeScript 컴파일 에러 없음
</success_criteria>

<output>
After completion, create `.planning/quick/260331-ldw-ui-ux/260331-ldw-SUMMARY.md`
</output>
