---
phase: quick
plan: 260407-lid-svg
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/booking/seat-map-viewer.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "모바일 뷰포트(328px)에서 SVG 좌석맵 전체가 보인다"
    - "우측 좌석이 잘리지 않고 완전히 표시된다"
    - "데스크톱에서도 기존처럼 정상 동작한다"
    - "줌/팬 기능이 정상 동작한다"
  artifacts:
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      provides: "반응형 SVG 좌석맵 렌더링"
      contains: "width.*100%"
  key_links:
    - from: "processedSvg useMemo"
      to: "SVG root element"
      via: "DOMParser width/height 속성 제거 + viewBox 보존"
      pattern: "removeAttribute.*width"
---

<objective>
모바일 뷰포트에서 SVG 좌석맵이 잘리는 문제를 수정한다.

Purpose: SVG의 고정 width="800" height="600" 속성이 react-zoom-pan-pinch의 TransformComponent 래퍼를 800px로 확장시켜, 모바일(328px)에서 우측 좌석이 overflow: hidden으로 잘림.
Output: 모든 뷰포트에서 SVG가 컨테이너에 맞춰 축소/표시되는 반응형 좌석맵.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/components/booking/seat-map-viewer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: SVG viewBox 보존 + 고정 크기 제거 + 컨테이너 제약</name>
  <files>apps/web/components/booking/seat-map-viewer.tsx</files>
  <action>
세 곳을 수정한다.

**1) processedSvg useMemo (line 69-135 영역):**
`doc.documentElement.outerHTML` 반환 직전에 SVG 루트 엘리먼트의 고정 크기를 반응형으로 교체:

```typescript
const svgEl = doc.documentElement;
// viewBox가 없으면 기존 width/height로 생성 (필수 — viewBox 없으면 SVG가 사라짐)
if (!svgEl.getAttribute('viewBox')) {
  const w = svgEl.getAttribute('width') || '800';
  const h = svgEl.getAttribute('height') || '600';
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
}
// 고정 크기 제거하고 반응형으로 교체
svgEl.removeAttribute('width');
svgEl.removeAttribute('height');
svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

이 코드를 `return doc.documentElement.outerHTML;` 바로 위에 삽입한다.

**2) TransformComponent (line 275-278 영역):**
`wrapperStyle`과 `contentStyle`을 추가하여 라이브러리의 인라인 사이징을 오버라이드:

```tsx
<TransformComponent
  wrapperClass="w-full min-h-[300px] lg:min-h-[500px]"
  contentClass="w-full"
  wrapperStyle={{ width: '100%', maxWidth: '100%' }}
  contentStyle={{ width: '100%' }}
>
```

**3) 외부 컨테이너 div (line 265):**
`overflow-hidden`을 추가하여 잔여 오버플로우 방지:

```tsx
<div className="relative overflow-hidden rounded-lg bg-gray-50">
```

주의: processedSvg에서 개별 좌석에 설정하는 `el.setAttribute('style', ...)` (line 88, 125, 130)은 건드리지 않는다. SVG 루트 엘리먼트만 수정한다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - processedSvg에서 SVG 루트의 width/height 고정값이 제거되고 viewBox가 보존됨
    - SVG에 width:100%; height:auto 스타일이 적용됨
    - TransformComponent에 wrapperStyle/contentStyle로 100% 너비 제약이 걸림
    - 외부 컨테이너에 overflow-hidden 적용됨
    - TypeScript 컴파일 에러 없음
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>모바일 뷰포트에서 SVG 좌석맵이 잘리지 않고 전체 표시되도록 수정</what-built>
  <how-to-verify>
    1. dev 서버 실행: `pnpm dev`
    2. 브라우저에서 예매 페이지로 이동 (좌석 선택 화면)
    3. Chrome DevTools > 모바일 뷰포트 (375px, iPhone SE 등)로 전환
    4. 확인사항:
       - 좌석맵 전체가 화면 안에 보이는지 (우측 좌석 잘림 없음)
       - 핀치 줌 / 휠 줌이 정상 동작하는지
       - 좌석 클릭이 정상 동작하는지
    5. 데스크톱 뷰포트로 돌아가서도 정상인지 확인
  </how-to-verify>
  <resume-signal>"approved" 또는 발견된 문제 설명</resume-signal>
</task>

</tasks>

<verification>
- TypeScript 컴파일 에러 없음
- 모바일 375px에서 SVG 좌석맵 전체 표시
- 데스크톱에서 기존 동작 유지
- 줌/팬 기능 정상
</verification>

<success_criteria>
모바일 뷰포트에서 SVG 좌석맵의 우측이 잘리지 않고 전체 좌석이 표시된다. 데스크톱에서도 기존과 동일하게 동작한다.
</success_criteria>

<output>
완료 후 `.planning/quick/260407-lid-svg/260407-lid-SUMMARY.md` 생성
</output>
