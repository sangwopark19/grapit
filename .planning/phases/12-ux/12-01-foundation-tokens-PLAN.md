---
phase: 12
plan: 01
plan_number: 1
type: execute
wave: 1
depends_on: ["12-00"]
files_modified:
  - apps/web/app/globals.css
  - apps/web/components/home/hot-section.tsx
  - apps/web/components/home/new-section.tsx
  - apps/web/components/home/genre-grid.tsx
autonomous: true
requirements: [UX-01, UX-04]
must_haves:
  truths:
    - "globals.css의 @theme 블록 안에 --shadow-sm/--shadow-md + --radius-sm/md/lg/xl + @keyframes seat-checkmark-fade-in + @keyframes seat-checkmark-fade-out 정의가 추가되어 Tailwind v4가 shadow-sm/rounded-lg 등 utility를 자동 생성한다"
    - "globals.css 외부 (@theme 블록 종료 후)에 [data-seat-checkmark] selector(fade-in) + [data-seat-checkmark][data-fading-out=\"true\"] selector(fade-out) + prefers-reduced-motion override가 추가되어 Plan 12-03의 viewer 변경 시 체크마크 fade-in·fade-out이 자동 작동 + reduced-motion 시 즉시 표시·즉시 제거"
    - "홈 3개 섹션 (HotSection/NewSection/GenreGrid)의 wrapper className이 mt-12 → mt-10으로 변경되어 섹션 간 수직 리듬이 toned"
    - "기존 어떤 컴포넌트의 JSX/TSX도 변경되지 않으며 (D-01), 토큰만 추가되어 shadcn 컴포넌트가 자동 소비"
  artifacts:
    - path: "apps/web/app/globals.css"
      provides: "신규 shadow/radius 토큰 + seat-checkmark-fade-in·fade-out keyframe + reduced-motion override (선택·해제 둘 다 fade)"
      contains: "--shadow-sm, --shadow-md, --radius-sm, --radius-md, --radius-lg, --radius-xl, @keyframes seat-checkmark-fade-in, @keyframes seat-checkmark-fade-out, [data-seat-checkmark], [data-fading-out=\"true\"], prefers-reduced-motion"
    - path: "apps/web/components/home/hot-section.tsx"
      provides: "mt-12 → mt-10 미세 튜닝"
      contains: "<section className=\"mt-10\">"
    - path: "apps/web/components/home/new-section.tsx"
      provides: "mt-12 → mt-10 미세 튜닝"
      contains: "<section className=\"mt-10\">"
    - path: "apps/web/components/home/genre-grid.tsx"
      provides: "mt-12 → mt-10 미세 튜닝 (pb-12 유지)"
      contains: "<section className=\"mt-10 pb-12\">"
  key_links:
    - from: "apps/web/app/globals.css"
      to: "shadcn/ui 모든 컴포넌트 (button.tsx, card.tsx 등)"
      via: "Tailwind v4 @theme 자동 utility 생성"
      pattern: "@theme[^}]*--shadow-sm[^}]*--radius-md"
    - from: "apps/web/app/globals.css [data-seat-checkmark] selector"
      to: "Plan 12-03 seat-map-viewer.tsx 체크마크 <text> (fade-in mount)"
      via: "data-seat-checkmark attribute selector → CSS @keyframes 자동 트리거"
      pattern: "\\[data-seat-checkmark\\][^}]*animation:\\s*seat-checkmark-fade-in"
    - from: "apps/web/app/globals.css [data-seat-checkmark][data-fading-out=\"true\"] selector"
      to: "Plan 12-03 seat-map-viewer.tsx 체크마크 <text> (해제 fade-out)"
      via: "data-fading-out=\"true\" attribute → CSS @keyframes seat-checkmark-fade-out 자동 트리거"
      pattern: "\\[data-fading-out=\"true\"\\][^}]*animation:\\s*seat-checkmark-fade-out"
    - from: "apps/web/components/home/{hot,new,genre}-section.tsx"
      to: "Tailwind 기본 spacing utility (mt-10 = 40px)"
      via: "className 1줄 교체"
      pattern: "className=\"mt-10"
---

<objective>
Wave 1 — Foundation: 디자인 토큰 추가 + 홈 미세 튜닝.

D-01/D-02 (Minimalism, shadow sm+md만, radius 6~12px 범위) + D-04 (홈 파일럿, 3~5줄) + D-12 (체크마크 fade-in·fade-out을 위한 CSS @keyframes 인프라, UI-SPEC §Interaction 선택·해제 둘 다 fade)를 단일 plan으로 묶는다. 두 변경 모두 후속 wave의 seat-map-viewer / svg-preview / use-is-mobile에 dependency 없음 — Wave 1 단독 진행 가능.

Purpose:
- shadcn 컴포넌트(Button/Card/Tooltip 등)가 JSX 변경 0줄로 새 elevation/radius 톤을 자동 흡수 (UX-01)
- Plan 12-03이 viewer 체크마크에 `data-seat-checkmark` 속성(mount fade-in) + `data-fading-out="true"` 속성(해제 fade-out)을 추가하면 애니메이션이 자동 작동하도록 CSS 인프라 선행 구축 (UX-04 + UI-SPEC §Interaction 선택·해제 둘 다 fade)
- 홈 페이지(`/`)에서 새 디자인 톤을 시각적으로 확인할 수 있도록 섹션 간격 1줄씩 조정 (UX-01 파일럿)

Output:
- `apps/web/app/globals.css` — 신규 토큰 6개 + keyframe 2개(fade-in + fade-out) + 외부 selector 3개(in/out + reduced-motion 둘 다 cover)
- `apps/web/components/home/hot-section.tsx` — 1줄 변경
- `apps/web/components/home/new-section.tsx` — 1줄 변경
- `apps/web/components/home/genre-grid.tsx` — 1줄 변경
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/12-ux/12-CONTEXT.md
@.planning/phases/12-ux/12-RESEARCH.md
@.planning/phases/12-ux/12-PATTERNS.md
@.planning/phases/12-ux/12-UI-SPEC.md
@apps/web/app/globals.css
@apps/web/components/home/hot-section.tsx
@apps/web/components/home/new-section.tsx
@apps/web/components/home/genre-grid.tsx

<interfaces>
<!-- 본 plan이 제공하는 contract — 후속 plan(12-03 viewer)이 의존 -->

CSS contract (globals.css → seat-map-viewer.tsx):
- 12-03 viewer가 선택 좌석 체크마크 `<text>`에 `setAttribute('data-seat-checkmark', '')` 한 줄을 추가하면, 본 plan의 CSS가 mount 시점에 150ms fade-in을 자동 트리거.
- 12-03 viewer가 해제(이전 선택 → 비선택) 좌석의 체크마크 `<text>`에 `setAttribute('data-fading-out', 'true')`를 잠시 부여(150ms 후 DOM 제거)하면, 본 plan의 CSS가 150ms fade-out을 자동 트리거 (UI-SPEC §Interaction 선택·해제 둘 다 fade).
- `@media (prefers-reduced-motion: reduce)` 안에서 `[data-seat-checkmark]`는 fade-in `animation-duration: 0.01ms` (즉시 표시), `[data-seat-checkmark][data-fading-out="true"]`도 fade-out `animation-duration: 0.01ms` (즉시 제거).

Tailwind utility contract (globals.css → 모든 shadcn 컴포넌트):
- `--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05)` → `shadow-sm` utility 자동 생성 (Tailwind v4 @theme namespace 인식).
- `--shadow-md: 0 4px 12px -2px rgba(0,0,0,0.08)` → `shadow-md` utility.
- `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 10px`, `--radius-xl: 12px` → `rounded-sm/md/lg/xl` utility 자동 생성.
- shadcn `button.tsx`/`card.tsx` 등은 이미 `rounded-md` `shadow-sm` className을 사용 중 — 토큰 변경만으로 즉시 새 값 적용.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: globals.css에 shadow/radius 토큰 + seat-checkmark fade-in/fade-out 인프라 추가</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (전체 142줄 — @theme 블록 위치, @keyframes 위치, :root 미러 패턴)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/app/globals.css (config, build-time)" (line 24~101)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / globals.css" (line 556~592)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 1" (Tailwind v4 @theme 외부 정의 무효 — line 494~499)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 7" (--radius 단일 변수 충돌 — 현재 globals.css에 --radius 없음 검증됨)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Color / Shadow/Radius 토큰 추가" (line 110~127)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Interaction & State Contract" 라인 240~241 (선택 시 opacity 0→1 + fill 150ms / 해제 시 opacity 1→0 + fill 150ms + setTimeout 150ms)
  </read_first>
  <action>
다음 변경 2건을 적용한다 (globals.css의 정확한 위치):

**변경 1 — @theme 블록 안 (line 71 `--animate-out: exit ...` 직후, @keyframes enter 시작 line 73 직전)**:

기존 라인 69~72:
```css
  /* Animation */
  --animate-in: enter 0.2s ease-out;
  --animate-out: exit 0.15s ease-in;

```

변경 후 (위 4줄 그대로 유지하고 그 직후, 즉 line 72 빈 줄과 line 73 `@keyframes enter` 사이에 다음 9줄을 INSERT):

```css

  /* Phase 12 (D-01/D-02): Modern shadow scale — Linear/Vercel convention (sm + md only) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.08);

  /* Phase 12 (D-01/D-02): Modern radius scale — 6/8/10/12px range */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
```

추가로, @theme 블록 안 기존 `@keyframes shake` (line 95~100) 직후, @theme 블록 닫는 `}` (line 101) 직전에 다음 keyframe **2개**를 INSERT (UI-SPEC §Interaction 선택·해제 둘 다 fade — fade-in + fade-out 둘 다 정의):

```css

  /* Phase 12 (D-12 + UI-SPEC §Interaction): Seat selection checkmark fade-in (선택 시 mount) */
  @keyframes seat-checkmark-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Phase 12 (D-12 + UI-SPEC §Interaction): Seat selection checkmark fade-out (해제 시 unmount 직전 150ms) */
  @keyframes seat-checkmark-fade-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
```

**변경 2 — @theme 블록 외부 (line 116 `:root { ... }` 닫는 `}` 직후, 즉 현재 line 117 빈 줄에 INSERT)**:

기존 라인 110~117:
```css
:root {
  --chart-1: #6C3CE0;
  --chart-2: #8B6DE8;
  --chart-3: #B8A3EF;
  --chart-4: #D1D1DB;
  --chart-5: #A1A1AA;
}

html {
```

변경 후 (`:root` 블록 닫는 `}` 직후, `html {` 직전에 다음 블록을 INSERT — 선택·해제 둘 다 fade + reduced-motion override 둘 다 cover):

```css

/* Phase 12 (D-12 + UI-SPEC §Interaction): Seat checkmark animation — 선택·해제 둘 다 fade.
 * Plan 12-03 viewer가:
 *   - 선택 시 체크마크 <text>에 `data-seat-checkmark` attr 부여 → fade-in 150ms 자동 트리거
 *   - 해제 시 같은 element에 `data-fading-out="true"` attr 부여 → fade-out 150ms 자동 트리거
 *     → setTimeout(150ms) 후 DOM 제거 (12-03 pendingRemovals 메커니즘이 처리)
 * prefers-reduced-motion 시 fade-in·fade-out 모두 0.01ms로 override (즉시 표시·즉시 제거).
 */
[data-seat-checkmark] {
  animation: seat-checkmark-fade-in 150ms ease-out forwards;
}

[data-seat-checkmark][data-fading-out="true"] {
  animation: seat-checkmark-fade-out 150ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  [data-seat-checkmark] {
    animation-duration: 0.01ms;
  }
  [data-seat-checkmark][data-fading-out="true"] {
    animation-duration: 0.01ms;
  }
}
```

주의:
- `--shadow-*` 와 `--radius-*` 는 Tailwind v4 namespace 표준 — `@theme` 블록 **안에** 정의해야 utility 자동 생성. (RESEARCH.md §Pitfall 1)
- `@keyframes seat-checkmark-fade-in` 과 `@keyframes seat-checkmark-fade-out` 둘 다 @theme 블록 안에 두는 것이 기존 패턴(`@keyframes enter/exit/shake` 모두 @theme 안). Tailwind v4가 인식.
- `[data-seat-checkmark]` selector + `[data-seat-checkmark][data-fading-out="true"]` selector + `prefers-reduced-motion` 미디어 쿼리는 namespace 외 일반 CSS — `@theme` **밖** 정의. (PATTERNS.md §"reduced-motion override 패턴")
- reduced-motion override 변경 — 기존 `animation: none; opacity: 1;` 대신 `animation-duration: 0.01ms`로 통일. fade-out 케이스에서도 자연스럽게 작동(0.01ms 안에 사라짐). UI-SPEC §"prefers-reduced-motion" 라인 248 충족.
- `forwards` (animation-fill-mode) 유지 — fade-out 종료 시 opacity 0 상태 유지하다가 12-03의 setTimeout이 DOM에서 제거.
- 기존 `--chart-*` `:root` 미러 패턴은 변경 없음. shadow/radius는 namespace 안 토큰이므로 `:root` 미러 불필요. (PATTERNS.md §"`:root` 미러 패턴")
- 기존 `--radius` 단일 변수가 globals.css에 없음 — `--radius-md` 신규 추가 시 충돌 0. (RESEARCH.md §Pitfall 7)
- 색상 토큰, 스페이싱 토큰, 타이포 토큰은 변경 없음 — D-03 (브랜드 Purple 유지) 보장.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -E "^\s*--shadow-sm: 0 1px 2px 0 rgba\(0, 0, 0, 0.05\)" apps/web/app/globals.css && grep -E "^\s*--shadow-md: 0 4px 12px -2px rgba\(0, 0, 0, 0.08\)" apps/web/app/globals.css && grep -E "^\s*--radius-sm: 6px" apps/web/app/globals.css && grep -E "^\s*--radius-md: 8px" apps/web/app/globals.css && grep -E "^\s*--radius-lg: 10px" apps/web/app/globals.css && grep -E "^\s*--radius-xl: 12px" apps/web/app/globals.css && grep -E "@keyframes seat-checkmark-fade-in" apps/web/app/globals.css && grep -E "@keyframes seat-checkmark-fade-out" apps/web/app/globals.css && grep -E "\\[data-seat-checkmark\\]" apps/web/app/globals.css && grep -E "data-fading-out=\"true\"" apps/web/app/globals.css && grep -E "prefers-reduced-motion: reduce" apps/web/app/globals.css && pnpm --filter @grapit/web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - 모든 신규 토큰이 `@theme` 블록 안에 존재 (위 verify 명령 모두 exit 0):
      - `grep -q "^\s*--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)" apps/web/app/globals.css`
      - `grep -q "^\s*--shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.08)" apps/web/app/globals.css`
      - `grep -q "^\s*--radius-sm: 6px" apps/web/app/globals.css`
      - `grep -q "^\s*--radius-md: 8px" apps/web/app/globals.css`
      - `grep -q "^\s*--radius-lg: 10px" apps/web/app/globals.css`
      - `grep -q "^\s*--radius-xl: 12px" apps/web/app/globals.css`
      - `grep -q "@keyframes seat-checkmark-fade-in" apps/web/app/globals.css`
      - `grep -q "@keyframes seat-checkmark-fade-out" apps/web/app/globals.css`
    - keyframe이 `@theme` 블록 안에 있는지 위치 검증 (라인 번호 비교):
      - keyframe seat-checkmark-fade-in/fade-out의 line ≤ closing `@theme` brace의 line. 정확히는 `awk` 또는 `grep -n` 결과 비교 — 실패 시 `[data-seat-checkmark]`가 @theme 밖에 있는지도 함께 확인. 시각 검증으로 충분.
    - 외부 selector + 미디어 쿼리 존재 (선택·해제 둘 다 fade — selector 2개 + reduced-motion 안 selector 2개):
      - `grep -q "^\[data-seat-checkmark\] {" apps/web/app/globals.css` (fade-in selector)
      - `grep -q "\\[data-seat-checkmark\\]\\[data-fading-out=\"true\"\\]" apps/web/app/globals.css` (fade-out selector)
      - `grep -q "@media (prefers-reduced-motion: reduce)" apps/web/app/globals.css`
      - `grep -c "animation-duration: 0.01ms" apps/web/app/globals.css` ≥ 2 (fade-in + fade-out 모두 reduced-motion 안에서 0.01ms)
    - 기존 토큰/구조 회귀 없음 (sentinel grep):
      - `grep -q "^\s*--color-primary: #6C3CE0;" apps/web/app/globals.css` (브랜드 Purple 유지)
      - `grep -q "^\s*--chart-1: #6C3CE0;" apps/web/app/globals.css` (chart palette 유지)
      - `grep -q "^\s*--spacing-xs: 4px;" apps/web/app/globals.css` (spacing 토큰 유지)
      - `grep -q "^\s*--text-display: 28px;" apps/web/app/globals.css` (typography 토큰 유지)
      - `grep -q "^@keyframes shake" apps/web/app/globals.css` 또는 `grep -q "  @keyframes shake" apps/web/app/globals.css` (기존 keyframe 유지)
    - 빌드 무결성: `pnpm --filter @grapit/web typecheck` exit 0 (CSS 변경은 typecheck 무관하지만 회귀 가드로 실행)
    - dev build 즉시 검증 (선택, 단 Wave 4 manual QA로 위임 가능): `pnpm --filter @grapit/web build` 가 성공 (Tailwind PostCSS 컴파일이 새 토큰 인식)
  </acceptance_criteria>
  <done>
globals.css에 shadow/radius 6 토큰 + seat-checkmark-fade-in keyframe + seat-checkmark-fade-out keyframe + [data-seat-checkmark] selector + [data-seat-checkmark][data-fading-out="true"] selector + prefers-reduced-motion override(둘 다 0.01ms) 정의됨. 기존 컬러/스페이싱/타이포/chart 토큰 회귀 0. Tailwind v4가 새 utility 자동 생성. Plan 12-03이 viewer 체크마크에 `data-seat-checkmark` (선택 시) + `data-fading-out="true"` (해제 시) attr만 추가하면 선택·해제 둘 다 fade 자동 작동 가능 (UI-SPEC §Interaction 충족).
  </done>
</task>

<task type="auto">
  <name>Task 2: 홈 3개 섹션 mt-12 → mt-10 미세 튜닝</name>
  <files>apps/web/components/home/hot-section.tsx, apps/web/components/home/new-section.tsx, apps/web/components/home/genre-grid.tsx</files>
  <read_first>
    - apps/web/components/home/hot-section.tsx (line 19 — `<section className="mt-12">`)
    - apps/web/components/home/new-section.tsx (line 15 — `<section className="mt-12">`)
    - apps/web/components/home/genre-grid.tsx (line 44 — `<section className="mt-12 pb-12">`)
    - .planning/phases/12-ux/12-PATTERNS.md §"홈 파일럿 미세 튜닝" (line 341~384)
    - .planning/phases/12-ux/12-RESEARCH.md §"홈 파일럿 미세 튜닝 (D-04) — 3~5줄 변경" (line 892~908)
    - .planning/phases/12-ux/12-CONTEXT.md D-04 (홈 파일럿 범위)
    - .planning/phases/12-ux/12-UI-SPEC.md §"홈 파일럿 미세 튜닝 (D-04) 허용 범위" (line 54~59)
  </read_first>
  <action>
정확히 3개 파일 각 1줄씩 변경. JSX 구조/className 그 외 부분 변경 0.

**파일 1 — apps/web/components/home/hot-section.tsx**:
- 현재 line 19: `<section className="mt-12">`
- 변경 후: `<section className="mt-10">`

**파일 2 — apps/web/components/home/new-section.tsx**:
- 현재 line 15: `<section className="mt-12">`
- 변경 후: `<section className="mt-10">`

**파일 3 — apps/web/components/home/genre-grid.tsx**:
- 현재 line 44: `<section className="mt-12 pb-12">`
- 변경 후: `<section className="mt-10 pb-12">` (pb-12는 페이지 하단 여백 — 유지)

주의:
- D-04는 "토큰으로 해결 안 되는 3~5줄 수준 성형"을 허용. 본 변경은 정확히 3줄 — 범위 내.
- D-04는 "새 컴포넌트 추가/구조 재편 금지" — JSX 구조, 자식, 다른 className(`mb-6`, `flex items-center justify-between`, `text-display font-semibold leading-[1.2]` 등)은 변경 금지.
- mt-12 = 48px (Tailwind 기본), mt-10 = 40px. 8px 감소 = 한 단계 toned, lg/xl 토큰 범위 내 (UI-SPEC §Spacing Scale).
- 다른 home 컴포넌트(banner-carousel.tsx 등)는 변경 금지 — D-04 본 plan 범위는 정확히 위 3개 파일.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -E '<section className="mt-10">' apps/web/components/home/hot-section.tsx && grep -E '<section className="mt-10">' apps/web/components/home/new-section.tsx && grep -E '<section className="mt-10 pb-12">' apps/web/components/home/genre-grid.tsx && (! grep -E '<section className="mt-12' apps/web/components/home/hot-section.tsx) && (! grep -E '<section className="mt-12' apps/web/components/home/new-section.tsx) && (! grep -E '<section className="mt-12' apps/web/components/home/genre-grid.tsx) && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - hot-section.tsx 변경 검증:
      - `grep -q '<section className="mt-10">' apps/web/components/home/hot-section.tsx`
      - `! grep -q "mt-12" apps/web/components/home/hot-section.tsx` (mt-12 잔존 없음)
    - new-section.tsx 변경 검증:
      - `grep -q '<section className="mt-10">' apps/web/components/home/new-section.tsx`
      - `! grep -q "mt-12" apps/web/components/home/new-section.tsx`
    - genre-grid.tsx 변경 검증:
      - `grep -q '<section className="mt-10 pb-12">' apps/web/components/home/genre-grid.tsx`
      - `grep -q "pb-12" apps/web/components/home/genre-grid.tsx` (pb-12 유지)
      - `! grep -q "mt-12" apps/web/components/home/genre-grid.tsx`
    - JSX 구조 회귀 없음 (3개 파일 모두 본문 라인 카운트 변화 0):
      - `wc -l apps/web/components/home/hot-section.tsx` 결과가 변경 전과 동일
      - 동일 검증 new-section, genre-grid
    - 타입/린트 회귀 없음:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
  </acceptance_criteria>
  <done>
3개 홈 섹션 컴포넌트가 정확히 1줄씩 (총 3줄) 변경되어 mt-12 → mt-10. JSX 구조, 자식 컴포넌트, 다른 className 회귀 0. typecheck/lint GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (없음) | Wave 1 변경은 CSS 토큰 추가 + Tailwind className 1줄 교체 × 3 — 외부 입력/네트워크/auth/persistence 변경 0. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (해당 없음) | — | — | — | Wave 1는 디자인 토큰 + 정적 className 변경만. 새 보안 표면 0. T-12-01 (admin SVG 입력 검증)은 Plan 12-02에서 mitigate. |
</threat_model>

<verification>
- [ ] globals.css `@theme` 블록 안 6개 토큰(--shadow-sm/md, --radius-sm/md/lg/xl) + 2개 keyframe(seat-checkmark-fade-in, seat-checkmark-fade-out) 정의 확인
- [ ] globals.css `@theme` 블록 밖 [data-seat-checkmark] selector + [data-seat-checkmark][data-fading-out="true"] selector + prefers-reduced-motion override(2개 selector 모두 0.01ms) 정의 확인
- [ ] 기존 globals.css 토큰(--color-*, --spacing-*, --text-*, --animate-*, --chart-*) 회귀 0
- [ ] 홈 3개 섹션 mt-12 → mt-10 (genre-grid는 pb-12 유지) 변경 확인
- [ ] 본 wave 변경 후 `pnpm --filter @grapit/web typecheck` GREEN
- [ ] 본 wave 변경 후 `pnpm --filter @grapit/web lint` GREEN
- [ ] (선택) `pnpm --filter @grapit/web build` 성공 — Tailwind PostCSS 컴파일 무결성
</verification>

<success_criteria>
- 자동: 위 verification 6개 항목 모두 충족
- 수동(Wave 4 manual QA gate에서 검증): dev server `/` 진입 시 홈 섹션 간 수직 리듬이 toned (mt-10) 시각 확인. dev server `/admin/dashboard` 카드 elevation/radius가 modernize 시각 확인 (UX-01). 좌석 선택 시 fade-in, 해제 시 fade-out 둘 다 자연스럽게 보임 (UI-SPEC §Interaction).
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-01-SUMMARY.md`:
- globals.css 추가된 토큰/keyframe 2개(fade-in + fade-out)/selector 2개(in + out) 라인 인용
- 홈 3개 파일 변경 라인 인용 (1줄 × 3)
- typecheck/lint 결과
- Wave 4 manual QA에서 검증할 시각 항목 리스트 (선택·해제 둘 다 fade 포함)
</output>
</content>
</invoke>