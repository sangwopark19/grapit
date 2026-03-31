---
phase: quick
plan: 260331-jjc
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/performance/pagination-nav.tsx
  - apps/web/components/performance/genre-chip.tsx
  - apps/web/components/performance/sort-toggle.tsx
  - apps/web/components/layout/gnb.tsx
  - apps/web/components/layout/mobile-menu.tsx
  - apps/web/components/admin/admin-sidebar.tsx
  - apps/web/components/admin/performance-form.tsx
  - apps/web/components/admin/banner-manager.tsx
  - apps/web/components/admin/tier-editor.tsx
  - apps/web/app/admin/performances/page.tsx
  - apps/web/app/admin/banners/page.tsx
  - apps/web/app/admin/performances/[id]/edit/page.tsx
  - apps/web/app/page.tsx
  - apps/web/components/home/genre-grid.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "font-medium 클래스가 프로젝트 소유 컴포넌트에 남아있지 않음 (shadcn ui/* 제외)"
    - "홈 페이지에 h1이 정확히 하나 존재하고, 모든 섹션이 비어도 공백이 아닌 안내 텍스트가 보임"
    - "어드민 에러 상태에서 클릭 가능한 새로고침 버튼이 표시됨"
  artifacts:
    - path: "apps/web/app/page.tsx"
      provides: "h1 + 전체 빈 상태 fallback"
    - path: "apps/web/app/admin/performances/page.tsx"
      provides: "에러 상태 새로고침 버튼"
    - path: "apps/web/app/admin/banners/page.tsx"
      provides: "에러 상태 새로고침 버튼"
    - path: "apps/web/app/admin/performances/[id]/edit/page.tsx"
      provides: "에러 상태 새로고침 버튼"
  key_links:
    - from: "apps/web/app/page.tsx"
      to: "HotSection/NewSection/GenreGrid"
      via: "전체 섹션 빈 상태 감지 후 fallback 렌더"
      pattern: "allEmpty.*fallback"
---

<objective>
Phase 2 UI Review에서 식별된 디자인 시스템 위반 항목 수정.

Purpose: UI-SPEC 계약(font 400/600만 허용, 페이지당 h1 하나, 어드민 에러 버튼)을 이행하여 17/24 점수를 개선한다.
Output: font-medium 제거, 홈 h1 + 빈 상태 fallback, 어드민 에러 새로고침 버튼, GenreGrid 빈 상태 아이콘 교체, GNB border 토큰화
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02-catalog-admin/02-UI-REVIEW.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: font-medium 제거 — 프로젝트 소유 컴포넌트 전체</name>
  <files>
    apps/web/components/performance/pagination-nav.tsx,
    apps/web/components/performance/genre-chip.tsx,
    apps/web/components/performance/sort-toggle.tsx,
    apps/web/components/layout/gnb.tsx,
    apps/web/components/layout/mobile-menu.tsx,
    apps/web/components/admin/admin-sidebar.tsx,
    apps/web/components/admin/performance-form.tsx,
    apps/web/components/admin/banner-manager.tsx,
    apps/web/components/admin/tier-editor.tsx,
    apps/web/app/admin/performances/page.tsx,
    apps/web/app/genre/[genre]/page.tsx,
    apps/web/app/search/page.tsx,
    apps/web/app/performance/[id]/page.tsx
  </files>
  <action>
UI-SPEC 계약: font weight는 400(font-normal)과 600(font-semibold)만 허용. font-medium(500) 전면 금지.

**제외 대상 (수정 불필요):**
- `apps/web/components/ui/` 디렉토리 전체 — shadcn 라이브러리 기본값이므로 예외
- `apps/web/components/auth/` 디렉토리 — Phase 1 컴포넌트, Phase 2 계약 범위 외

**교체 규칙:**
- 레이블, 헤딩, 강조 텍스트 (section label, table cell 제목, 사이드바 링크, 탭/칩/토글 텍스트) → `font-semibold`
- 일반 본문/캡션 텍스트 (아바타 이니셜, 메뉴 링크 텍스트, 에러 버튼) → `font-normal`

**파일별 교체 위치:**
- `pagination-nav.tsx:86`: `font-medium` → `font-normal` (페이지 번호는 일반 텍스트)
- `genre-chip.tsx:18`: `font-medium` → `font-semibold` (선택 UI 요소, 강조)
- `sort-toggle.tsx:32`: `font-medium` → `font-semibold` (정렬 옵션 탭)
- `gnb.tsx:210`: `font-medium` → `font-normal` (아바타 이니셜)
- `mobile-menu.tsx:105`: `font-medium` → `font-normal` (아바타 이니셜)
- `mobile-menu.tsx:113`: `font-medium` → `font-normal` (사용자 이름 텍스트)
- `mobile-menu.tsx:139`: `font-medium` → `font-semibold` (주요 CTA 버튼 텍스트)
- `mobile-menu.tsx:148`: `font-medium` → `font-normal` (카테고리 캡션)
- `admin-sidebar.tsx:40`: `font-medium` → `font-semibold` (사이드바 내비게이션 링크)
- `performance-form.tsx` 모든 label (207, 224, 256, 290, 305, 318, 333, 348, 500, 511번째 줄 등): `font-medium` → `font-semibold` (폼 레이블은 강조)
- `banner-manager.tsx:124`, `banner-manager.tsx:138`: `font-medium` → `font-semibold` (폼 레이블)
- `tier-editor.tsx:42`: `font-medium` → `font-semibold` (섹션 소제목)
- `admin/performances/page.tsx:172`: TableCell `font-medium` → `font-semibold` (테이블 제목 셀)
- `genre/page.tsx:108`, `search/page.tsx:104`, `performance/[id]/page.tsx:62`: 에러/CTA 버튼 `font-medium` → `font-semibold` (버튼 내 텍스트는 강조)
- `performance/[id]/page.tsx:140`: `font-medium` → `font-semibold` (정보 레이블)

추가로 `gnb.tsx:104`의 `border-[#E5E5E5]` → `border-gray-200` 로 교체 (Tailwind 토큰 사용, gray-200은 #E5E5E5와 동일값).
  </action>
  <verify>
    <automated>grep -rn "font-medium" /Users/sangwopark19/icons/grapit/apps/web --include="*.tsx" | grep -v "components/ui/" | grep -v "components/auth/" | grep -v "node_modules" | grep -v ".next"</automated>
  </verify>
  <done>위 명령 출력이 비어있음 — 프로젝트 소유 컴포넌트에 font-medium 없음</done>
</task>

<task type="auto">
  <name>Task 2: 홈 페이지 h1 + 빈 상태 fallback 추가</name>
  <files>apps/web/app/page.tsx</files>
  <action>
현재 `app/page.tsx`에 h1이 없고, HotSection/NewSection/GenreGrid가 모두 빈 데이터를 받으면 섹션 헤딩만 남거나 GNB 아래 완전 공백이 노출된다.

**수정 내용:**

1. `<main>` 안 최상단에 visually-hidden h1 추가:
   ```tsx
   <h1 className="sr-only">Grapit</h1>
   ```
   SEO와 접근성 heading hierarchy를 충족하되 시각적으로는 숨김 처리.

2. 홈 페이지 전체 빈 상태 fallback: HotSection과 NewSection은 내부에서 데이터를 fetch하므로 page.tsx에서 직접 감지할 수 없다. 대신 BannerCarousel이 비어있고 배너 로딩이 완료된 경우를 기준으로 최소 안내 문구를 추가한다.

   `banners` 배열이 비어있고 `bannersLoading`이 false인 경우, 콘텐츠 영역 상단에 다음 추가:
   ```tsx
   {!bannersLoading && (!banners || banners.length === 0) && (
     <div className="mx-auto max-w-[1200px] px-6 pt-12 text-center">
       <p className="text-gray-500">
         공연을 검색하거나 장르별로 탐색해보세요.
       </p>
     </div>
   )}
   ```

최종 구조:
```tsx
<main>
  <h1 className="sr-only">Grapit</h1>
  {/* Banner Carousel */}
  ...
  {/* 빈 상태 안내 */}
  {!bannersLoading && (!banners || banners.length === 0) && (
    <div className="mx-auto max-w-[1200px] px-6 pt-12 text-center">
      <p className="text-gray-500">공연을 검색하거나 장르별로 탐색해보세요.</p>
    </div>
  )}
  {/* Content sections */}
  <div className="mx-auto max-w-[1200px] px-6">
    <HotSection />
    <NewSection />
    <GenreGrid />
  </div>
</main>
```
  </action>
  <verify>
    <automated>grep -n "h1\|sr-only\|탐색해보세요" /Users/sangwopark19/icons/grapit/apps/web/app/page.tsx</automated>
  </verify>
  <done>h1.sr-only "Grapit"이 존재하고, 배너 빈 상태 fallback 텍스트가 존재함</done>
</task>

<task type="auto">
  <name>Task 3: 어드민 에러 상태 새로고침 버튼 + GenreGrid 빈 상태 아이콘 교체</name>
  <files>
    apps/web/app/admin/performances/page.tsx,
    apps/web/app/admin/banners/page.tsx,
    apps/web/app/admin/performances/[id]/edit/page.tsx,
    apps/web/components/home/genre-grid.tsx
  </files>
  <action>
**[A] 어드민 에러 상태 새로고침 버튼 — 3개 파일**

UI-SPEC 요구사항: 에러 상태에 `<button>새로고침</button>` 액션 버튼 필요.

`admin/performances/page.tsx` — isError 블록 (현재 139번째 줄):
```tsx
{isError && (
  <TableRow>
    <TableCell colSpan={6} className="py-12 text-center text-gray-500">
      <p>데이터를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        새로고침
      </button>
    </TableCell>
  </TableRow>
)}
```

`admin/banners/page.tsx` — isError 블록 (현재 100-104번째 줄):
```tsx
{isError && (
  <div className="py-12 text-center text-gray-500">
    <p>데이터를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.</p>
    <button
      onClick={() => window.location.reload()}
      className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
    >
      새로고침
    </button>
  </div>
)}
```

`admin/performances/[id]/edit/page.tsx` — isError 블록 (현재 27-33번째 줄):
```tsx
if (isError || !data) {
  return (
    <div className="py-12 text-center text-gray-500">
      <p>데이터를 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해주세요.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        새로고침
      </button>
    </div>
  );
}
```

**[B] GenreGrid 빈 상태 아이콘 — genre-grid.tsx**

현재 `genre-grid.tsx`는 고정 장르 목록을 렌더링하는 정적 컴포넌트라 실제 빈 상태가 발생하지 않는다. UI-REVIEW의 지적은 PerformanceGrid에서 SearchIcon을 사용하는 패턴이 장르 페이지 빈 상태에도 전파될 수 있다는 점이다.

`genre-grid.tsx`에서 사용하는 GENRE_ICONS는 이미 각 장르에 맞는 아이콘(Music, Mic, Drama 등)을 사용 중이므로 별도 수정 불필요. 만약 빈 상태 렌더링이 추가될 경우를 대비해 파일 상단 주석에 명시:
```tsx
// 빈 상태 발생 시: SearchIcon 대신 Telescope 또는 LayoutGrid 아이콘 사용
// 장르 바로가기는 정적 컴포넌트로 현재 빈 상태 없음
```
  </action>
  <verify>
    <automated>grep -n "새로고침\|window.location.reload" /Users/sangwopark19/icons/grapit/apps/web/app/admin/performances/page.tsx /Users/sangwopark19/icons/grapit/apps/web/app/admin/banners/page.tsx /Users/sangwopark19/icons/grapit/apps/web/app/admin/performances/id/edit/page.tsx 2>/dev/null || grep -rn "window.location.reload" /Users/sangwopark19/icons/grapit/apps/web/app/admin/ --include="*.tsx"</automated>
  </verify>
  <done>3개 어드민 파일 모두 window.location.reload() 버튼 포함, 버튼 클래스에 font-semibold 사용</done>
</task>

</tasks>

<verification>
모든 태스크 완료 후 최종 확인:

1. font-medium 잔존 확인:
   ```bash
   grep -rn "font-medium" /Users/sangwopark19/icons/grapit/apps/web --include="*.tsx" | grep -v "components/ui/" | grep -v "components/auth/" | grep -v "node_modules"
   ```
   출력이 비어있어야 함.

2. 홈 h1 확인:
   ```bash
   grep -n "h1\|sr-only" /Users/sangwopark19/icons/grapit/apps/web/app/page.tsx
   ```
   `<h1 className="sr-only">Grapit</h1>` 포함.

3. 어드민 새로고침 버튼 확인:
   ```bash
   grep -rn "window.location.reload" /Users/sangwopark19/icons/grapit/apps/web/app/admin/ --include="*.tsx"
   ```
   3개 파일에서 검색됨.

4. 타입 체크:
   ```bash
   cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/web exec tsc --noEmit
   ```
</verification>

<success_criteria>
- font-medium이 프로젝트 소유 컴포넌트에서 0건 (shadcn ui/*, auth/* 제외)
- app/page.tsx에 h1.sr-only 존재, 빈 상태 안내 텍스트 존재
- 3개 어드민 에러 UI에 클릭 가능한 새로고침 버튼 존재
- gnb.tsx border-[#E5E5E5] → border-gray-200 교체
- tsc --noEmit 에러 없음
</success_criteria>

<output>
완료 후 `.planning/quick/260331-jjc-phase-2-ui-review-priority-fixes-font-me/260331-jjc-SUMMARY.md` 생성.
</output>
