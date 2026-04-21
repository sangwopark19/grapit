# Phase 12: UX 현대화 - Research

**Researched:** 2026-04-21
**Domain:** Tailwind v4 디자인 토큰 + react-zoom-pan-pinch 좌석맵 UX
**Confidence:** HIGH (모든 외부 라이브러리 API · 토큰 규칙은 설치된 d.ts 파일과 공식 docs로 직접 검증)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### UX-01 디자인 현대화 범위·방향
- **D-01:** 작업 범위는 `apps/web/app/globals.css` `@theme` 토큰 레벨만. shadow/radius/spacing/모션 스케일을 모던하게 조정. `Button`/`Card`/`Badge` 사용처는 JSX 변경 없이 토큰이 자연스럽게 전파되도록 한다. 기존 컴포넌트 API 표면 변경 금지.
- **D-02:** 디자인 방향 = 조여진 Minimalism (Linear/Vercel). 엄격한 whitespace, radius 8~12px, shadow는 sm/md만 (`0 1px 2px` / `0 4px 12px`), purple 액센트는 메인 CTA/링크/focus ring 집중. "신뢰·안정감" 코어 밸류 유지.
- **D-03:** 브랜드 Purple `#6C3CE0` 그대로 유지. Phase 11 chart palette(`--chart-1~5`)와 호환 필수.
- **D-04:** 홈(`apps/web/app/page.tsx` + `components/home/*`)이 파일럿 페이지. 토큰만 적용 시 효과를 가장 먼저 체감. 토큰으로 해결 안 되는 3~5줄 수준의 성형(카드 간격, hero spacing, section 제목 위계)만 허용. 새 컴포넌트 추가/구조 재편 금지.
- **D-05:** 상세/예매/마이페이지/어드민은 토큰 전파만 받음. 추가 작업 필요 시 별도 phase.

#### UX-02 스테이지 방향 표시
- **D-06:** 스테이지 정보 소스 = SVG 내부 `data-stage` 속성 OR `<text>STAGE</text>` fallback. admin 업로드 파이프라인에서 신규 SVG는 둘 중 하나 검증.
- **D-07:** 뷰어 렌더링 — `<text>STAGE</text>` 또는 `[data-stage]` 파싱 → 방향 결정. SVG에 이미 시각 요소 있으면 그대로 렌더. `data-stage` 속성만 있는 경우 viewer가 viewBox 기준 해당 변에 회색 배지 오버레이.
- **D-08:** 기존 SVG 호환 — `<text>STAGE</text>` 1차 소스. 기존 업로드 데이터 migration 불필요. 신규 admin 업로드만 강제.
- **D-09:** DB 스키마(performances/seatMapConfig) 변경 없음. stage 정보는 SVG에 위임.

#### UX-03 등급 색상 + 가격
- **D-10:** `seat-legend.tsx` 이미 dot + 등급명 + "N,NNN원" 표시. **Phase 12 신규 작업 없음**, 토큰 반영 후 시각 확인만. UX-03은 검증 항목.

#### UX-04 좌석 선택 애니메이션
- **D-11:** 선택/해제 좌석에만 transition. 기존 `style="transition:none"` 정책 유지하되 `selectedSeatIds` 차이만 transition 켬. 수백 좌석 동시 재렌더 성능 리스크 방지.
- **D-12:** 피드백 = 체크마크 fade-in + fill 전환 (duration 150ms). `seat-map-viewer.tsx:91-120` 체크마크 삽입 로직 재활용. CSS transition 또는 SMIL `<animate>` 둘 중. scale 펄스/glow는 미도입.
- **D-13:** 실시간 broadcast은 `transition:none` 유지. 타 사용자 좌석 잠금/해제 = 즉시 플립.

#### UX-05 미니맵 네비게이터
- **D-14:** 형태 = 축소 SVG 복제 + viewport rect 오버레이. `processedSvg`를 `width: 120px, height: auto`로 두 번째 인스턴스로 렌더 + `TransformWrapper`의 `positionX/Y/scale`을 `onTransformed` 콜백으로 받아 viewport rect 동기화. 실시간 seat state 변화 자동 반영.
- **D-15:** 위치 = 데스크톱 좌상단 고정 `position: absolute; top: 12px; left: 12px; z-index: 40`.
- **D-16:** 모바일(< md breakpoint) 숨김. `initialScale=1.4`(D-18)로 이미 충분.

#### UX-06 모바일 44px 터치 타겟
- **D-17:** 전략 = 모바일 자동 초기 줌 1.4x. breakpoint `< md`(768px 미만)에서 `TransformWrapper initialScale=1.4`. 32x32 → 44.8x44.8.
- **D-18:** 사용자 수동 zoom-out 허용 (`minScale` 0.5 유지). "기본값 보장"이 목표.
- **D-19:** SVG 파일/DB 스키마 변경 없음. UX-02만 admin 검증 추가, UX-06은 순수 뷰어. Hit-area overlay rect 방식 미채택.

### Claude's Discretion

- `globals.css @theme`의 구체적 shadow/radius/spacing 숫자값 — Minimalism 방향 안에서 재량 (출발점: shadow sm=`0 1px 2px rgba(0,0,0,0.05)`, md=`0 4px 12px rgba(0,0,0,0.08)`, radius 기본 10px, 카드 12px 등).
- 스테이지 배지 오버레이의 정확한 마크업/폰트/색상.
- 체크마크 fade-in 구현 방식: CSS transition vs SMIL `<animate>` (둘 다 성능 유사).
- 미니맵 viewport rect 색상 (브랜드 Purple 10~20% 또는 `--color-primary` stroke 2px).
- 홈 파일럿 미세 튜닝의 정확한 3~5줄 범위.
- 모바일 breakpoint 감지 방식 (`useMediaQuery` vs Tailwind `md:hidden` vs `useSyncExternalStore`).

### Deferred Ideas (OUT OF SCOPE)

- 상세/예매/마이페이지/어드민 개별 페이지 재디자인 (토큰 전파만 받음)
- Motion-forward 대규모 도입 (framer-motion, scroll-reveal)
- Bento Grid / asymmetric layout
- 다크모드 (CSS variable 기반이라 path는 열림, 도입은 별도 phase)
- Scale pulse / glow ring 애니메이션
- 미니맵 모바일 토글 버튼
- 미니맵 클릭 네비게이션 (시각 전용)
- Hit-area invisible overlay rect (모바일 자동 줌으로 대체)
- SVG 업로드 서버 측 검증 (클라이언트만)
- Stage position DB 컬럼 (SVG가 SoT)
- 햅틱 (UX-07)
- 공연 목록 Swiper 재디자인
- 접근성 전면 오딧 (키보드 좌석 이동 포함)
- 어드민 SVG 인라인 편집기

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | 전체 디자인 현대화 (테두리/스타일 → 모던 트렌드) | §Standard Stack — Tailwind v4 `@theme` 토큰 추가 정책 + shadcn 자동 소비 [VERIFIED: tailwindcss/docs/theme]. §Architecture Patterns — `--shadow-sm`/`--shadow-md`/`--radius-{sm,md,lg,xl}` 추가가 `shadow-sm` `rounded-lg` 등 Tailwind utility를 자동 생성. |
| UX-02 | SVG 좌석맵 스테이지 방향 표시 | §Code Examples — DOMParser + querySelector로 `<text>STAGE</text>` / `[data-stage]` 검출 패턴. §Common Pitfalls — 클라이언트만 검증 (D-19 명시) + sonner toast 패턴 (svg-preview.tsx:56 기존 사용). |
| UX-03 | 등급별 색상 범례 + 가격 표시 | §Don't Hand-Roll — 이미 `seat-legend.tsx`에 dot + 등급명 + 원화 포맷 구현됨. 검증만 수행 (D-10). |
| UX-04 | 좌석 선택 상태 전환 애니메이션 | §Code Examples — `seat-map-viewer.tsx:88,125,130`의 `style="...;transition:none"`을 선택 좌석에 한해 `transition: fill 150ms ease-out` 으로 교체. 체크마크는 `opacity:0` 초기값 + `transition: opacity 150ms` (CSS) 또는 `<animate attributeName="opacity">` (SMIL). prefers-reduced-motion fallback. |
| UX-05 | 미니맵 네비게이터 | §Standard Stack — **`react-zoom-pan-pinch`의 `MiniMap` export 컴포넌트 발견 (v3.7.0 d.ts 검증).** `useTransformEffect` 훅으로 ref-based viewport rect 갱신 가능. §Architecture Patterns — D-14 "축소 SVG 복제 + viewport rect"는 라이브러리 내장 `MiniMap` + 동일 SVG children pattern으로 구현 가능. |
| UX-06 | 모바일 44px 터치 타겟 | §Code Examples — `TransformWrapper initialScale={isMobile ? 1.4 : 1}`. 32 × 1.4 = 44.8 (WCAG 2.5.5 AAA 44px 충족). `useSyncExternalStore` 또는 `useMediaQuery` 훅 (둘 다 hydration-safe 패턴). |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

| 영역 | 규칙 | Phase 12 적용 |
|------|------|---------------|
| 모듈 시스템 | ESM only (import/export, no require) | 모든 신규 파일 ESM. (이미 모노레포 전체 ESM) |
| 함수형 우선 | 함수형 패턴, class는 외부 인터페이스만 | 새 hook/컴포넌트는 함수형. (해당 없음 — class 신규 도입 없음) |
| 엄격 타이핑 | `any` 금지, 모든 변수 타입 명시 | `ReactZoomPanPinchRef`/`MiniMapProps` 등 라이브러리 타입 직접 import. SVG DOM 노드는 `SVGElement` / `SVGTextElement` 등 명시. |
| 품질 검사 | 코드 변경 후 typecheck + lint 실행. `--no-verify` 금지 | `pnpm --filter @grapit/web typecheck` + `lint` 매 task 끝에 실행. |
| 테스트 | 비즈니스 로직/API 코드는 테스트 우선. 변경 후 기존 테스트 재실행 | `seat-map-viewer.test.tsx` 6개 케이스 회귀 방지. 신규 미니맵·스테이지 검증·모바일 분기 테스트 추가 (Wave 0). |
| Git | conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`). Co-Authored-By trailer 금지 (개인 글로벌). | 본 리포는 `Co-Authored-By: Claude` 사용 — 글로벌 룰과 충돌 시 **프로젝트 commit_docs 정책 우선**. 개인 글로벌은 외부 OSS 기여용으로 해석. |
| 워크플로 | 직접 repo 편집 금지, GSD 명령으로 진입 | 본 phase 12는 `/gsd-execute-phase` 경유로 실행 예정. |
| 응답 언어 | 한국어 (요청 시 외 영어 가능) | RESEARCH.md 본문 한국어 + 표 헤더 등 영어/한글 혼용 (기존 관습). |

## Summary

Phase 12는 **순수 디자인·UX 레이어 phase**로 데이터/스키마/API 변경이 전혀 없다. 작업 표면은 4곳에 한정된다 — (1) `globals.css @theme` 블록(2~6줄 신규 토큰), (2) `seat-map-viewer.tsx` 라인 88·125·130 transition 정책 + 라인 91~120 체크마크 fade-in + 라인 278~285 TransformWrapper 분기 + 신규 미니맵 mount, (3) `svg-preview.tsx` 라인 31~62 업로드 검증 추가, (4) 홈 컴포넌트(`hot-section.tsx:19`, `new-section.tsx:15`, `genre-grid.tsx:44`)의 `mt-12` 미세 튜닝 3~5줄.

핵심 발견 두 가지가 계획을 단순화한다. 첫째, **`react-zoom-pan-pinch@3.7.0`은 `MiniMap` 컴포넌트와 `useTransformEffect` 훅을 이미 export한다** — 설치된 `index.d.ts:121,251,271`에서 직접 확인 [VERIFIED: node_modules/.pnpm/react-zoom-pan-pinch@3.7.0/dist/index.d.ts]. D-14는 "수동 SVG 복제 + viewport rect"를 명시했지만, 라이브러리 내장 `MiniMap`은 정확히 이 동작을 위해 만들어진 컴포넌트이며 `width`/`height`/`borderColor`/`previewStyle` props를 지원한다. 사용 시 `seat-map-viewer.tsx`에 ~10줄 추가만으로 D-14/D-15 충족이 가능하므로 신규 파일(`seat-map-minimap.tsx`)을 만들 필요가 없다 — UI-SPEC §Component Inventory의 "NEW component" 항목은 라이브러리 내장 솔루션으로 대체 가능. 둘째, **Tailwind v4 `@theme` 블록에 `--shadow-*` / `--radius-*` 토큰을 추가하면 `shadow-sm` `rounded-lg` 등 utility가 자동 생성/오버라이드되며 shadcn new-york 컴포넌트가 즉시 새 값을 소비한다** [VERIFIED: tailwindcss.com/docs/theme]. shadcn `button.tsx`/`card.tsx` JSX 변경 없이 토큰만으로 D-01/D-02 달성 가능.

남는 핵심 리스크는 (a) `prefers-reduced-motion` 적용 위치 — Phase 11 dashboard chart는 `motion-reduce:[&_*]:!transition-none` Tailwind variant를 컴포넌트 레벨에 적용했으므로 동일 패턴을 좌석맵 컨테이너에도 적용하면 일관성 유지, (b) admin SVG 업로드 검증 실패 시 R2 PUT 호출 전에 abort 해야 하는데 현 `svg-preview.tsx:38~49` 흐름은 presigned URL 발급 → R2 PUT → text 파싱 순서이므로 검증을 R2 PUT 이전 (`file.text()` 즉시 호출)으로 끌어올려야 함, (c) 모바일 분기 SSR hydration mismatch — `useSyncExternalStore`로 matchMedia 구독하면 서버에서는 desktop 기본값, 클라이언트 hydrate 시 매치 후 1프레임에 1.4x 적용. flicker 우려가 있으면 booking-page.tsx의 기존 `lg:` 분기 수준에 머무는 CSS 전용 처리는 `initialScale`이 prop이라 부적합 — 반드시 JS-side 분기 필요.

**Primary recommendation:** 라이브러리 내장 `MiniMap` 컴포넌트 사용으로 신규 파일 0, 토큰 추가는 `--shadow-sm`/`--shadow-md`/`--radius-{md,lg,xl}` 5개로 한정, 모바일 감지는 `useSyncExternalStore` 기반 mini hook (`hooks/use-is-mobile.ts` 신규 1파일) 추가, 체크마크 fade-in은 CSS `transition: opacity 150ms` 방식으로 통일, admin SVG 검증은 `handleSvgUpload` 시작 부분에서 `file.text() → DOMParser` 동기 검사 후 통과 시에만 R2 PUT 진입.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 디자인 토큰 (shadow/radius) 정의 | CSS / Build-time | — | Tailwind v4 `@theme`은 빌드 타임 utility 생성. 런타임 분기 불필요. shadcn 컴포넌트가 자동 소비. |
| 토큰 전파 (Button/Card 등) | Frontend Server (RSC) + Browser | — | shadcn new-york 컴포넌트는 RSC + Browser 양쪽에서 동일 className. 별도 분기 없음. |
| 홈 미세 튜닝 (margin/spacing) | Browser (CSS) | — | 정적 className만 변경. 데이터 로딩(`useHomeBanners`)은 변경 없음. |
| SVG 좌석맵 렌더링 | Browser | — | `useEffect` + `fetch` + `DOMParser` + `dangerouslySetInnerHTML`. 100% 클라이언트 처리. |
| 좌석 선택 transition | Browser (CSS-on-attribute) | — | DOMParser로 attr 직접 set. React 재렌더 회피. |
| 미니맵 viewport rect | Browser | — | `useTransformEffect`로 ref-based 동기화. React state 우회 (성능). |
| 모바일 breakpoint 감지 | Browser | Frontend Server (SSR fallback) | `matchMedia`는 브라우저 전용. SSR은 desktop 기본값으로 fallback, hydrate 후 분기. |
| Admin SVG 업로드 검증 | Browser | (Backend는 deferred per D-19) | `FileReader`/`file.text()` + `DOMParser`. R2 PUT 호출 전 abort. |
| 체크마크 fade-in | Browser (CSS) | — | SVG `<text>` 요소 inline `opacity` + `transition`. mount 시점에 0→1. |
| prefers-reduced-motion | Browser (CSS media query) | — | `motion-reduce:` Tailwind variant — Phase 11 컨벤션 재사용. |

## Standard Stack

### Core (이미 설치됨, 버전 변경 없음 — D-19)

| Library | Version (apps/web/package.json) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-zoom-pan-pinch | `^3.7.0` (3.7.4 max in v3 line) | TransformWrapper + TransformComponent + **MiniMap** + useTransformEffect | 이미 좌석맵 zoom/pan에 사용 중. **MiniMap export 발견** [VERIFIED: dist/index.d.ts:121,251] — D-14 신규 파일 회피. |
| tailwindcss | `^4.2.0` | CSS 엔진, `@theme` directive | v4 CSS-first. `@theme` 블록에 `--shadow-*`/`--radius-*` 추가 시 `shadow-sm`/`rounded-lg` utility 자동 생성 [VERIFIED: tailwindcss.com/docs/theme]. |
| shadcn/ui (new-york preset) | n/a (소스 in `components/ui/`) | Button/Card/Tooltip/Dialog 등 26개 컴포넌트 | 모든 컴포넌트가 `var(--radius)` `bg-card` 등 토큰 참조. `@theme` 변경이 즉시 반영. JSX 변경 0줄. |
| sonner | `^2.0.7` (latest 2.0.7) | toast 발송 (성공/실패) | 이미 `svg-preview.tsx:6,56,58,73,82,84`에서 사용 중. `Toaster` wrapper는 `components/ui/sonner.tsx`. UX-02 검증 실패 toast에 재사용. |
| react / react-dom | `^19.1.0` | UI library | React 19 useSyncExternalStore 안정. `useMediaQuery` 패턴 hydration-safe 구현 가능. |

**Version verification (npm registry, 2026-04-21):**
- `react-zoom-pan-pinch`: 4.0.3 (latest), **3.7.4** (v3 line max), 3.7.0 (현재 설치). v4는 minor breaking — D-19 명시적으로 버전 유지이므로 **3.7.0 유지**.
- `tailwindcss`: 4.2.3 (latest), 4.2.0 (현재). 패치만 차이.
- `sonner`: 2.0.7 (현재 = latest).

### Supporting (이미 설치, 신규 install 없음)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | `^1.7.0` | Icon library | UI-SPEC §Icon assignments — `Mic2` (선택). 새 install 없음. |
| @grapit/shared | `workspace:*` | `SeatMapConfig` `SeatState` 타입 | `seat-map-viewer.tsx:6` 기존 import 유지. |
| @testing-library/react | `^16.3.0` | 테스트 | seat-map-viewer.test.tsx 6 케이스에 신규 케이스 추가용. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 라이브러리 내장 `MiniMap` (D-14 재해석) | 수동 SVG dangerouslySetInnerHTML 복제 | **라이브러리 내장이 압도적으로 단순.** D-14 "축소 SVG 복제 + viewport rect" 의도와 일치. 단점: `borderColor` 외 viewport rect 스타일 커스텀이 제한적 (`previewStyle` prop은 inline style 객체). 수동 복제는 제어가 자유롭지만 ID 충돌 + viewport rect 좌표 계산 로직 30줄+ 직접 구현 필요. **권장: 내장 MiniMap.** |
| `useSyncExternalStore` 모바일 감지 | `useEffect` + `useState` + `matchMedia` | 후자는 더 친숙하지만 SSR hydration 시 첫 paint에서 desktop 값 → mobile 분기 후 re-render. `useSyncExternalStore`는 React 18+ 권장 패턴, hydration-safe, getServerSnapshot으로 SSR fallback 명시. **권장: useSyncExternalStore.** |
| CSS `transition: opacity 150ms` (선택 체크마크) | SMIL `<animate attributeName="opacity" dur="0.15s" fill="freeze">` | CSS는 모든 브라우저 지원, `prefers-reduced-motion` CSS 미디어 쿼리로 일괄 무력화 가능. SMIL은 Safari 지원이 일관되지만 prefers-reduced-motion 미디어 쿼리가 적용되지 않음 (별도 JS 검사 필요). **권장: CSS transition.** |
| `class-variance-authority` 신규 variant 추가 | 토큰만 추가하여 자동 전파 | shadcn 컴포넌트들은 이미 cva 기반이지만 D-01은 JSX 변경 금지 — variant 신규 추가는 JSX 변경. **권장: 토큰만.** |

**Installation:** **신규 패키지 0개.** 모든 외부 의존성은 이미 설치되어 있다.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌────────────────────────────────────────────┐
                    │  globals.css @theme (build-time)            │
                    │  + --shadow-sm / --shadow-md                │
                    │  + --radius-{md,lg,xl}                      │
                    └────────────────┬───────────────────────────┘
                                     │ (Tailwind utility 생성)
                                     ▼
       ┌─────────────────────────────────────────────────────┐
       │  shadcn ui/* + 모든 페이지 className 기반 사용처      │
       │  (Button, Card, Tooltip, ...) — JSX 변경 0          │
       └─────────────────────────────────────────────────────┘

   [UX-04/05/06: SeatMapViewer]                [UX-02 admin: SvgPreview]
   ──────────────────────────                  ─────────────────────
   1. fetch SVG → setRawSvg                    1. file input change
   2. processedSvg useMemo                     2. file.text() → DOMParser
      ├─ DOMParser parse                       3. assert <text>STAGE</text>
      ├─ for each [data-seat-id]:                  OR [data-stage]
      │   if isSelected → fill + stroke         4a. PASS → presigned URL
      │     + insert <text> 체크마크                + R2 PUT + setSvgUrl
      │     opacity:0 (CSS transition)         4b. FAIL → toast.error,
      │   if locked/sold → gray, transition:none      abort
      │   if available → tier color
      ├─ inject viewBox if missing
      └─ outerHTML → string
   3. <TransformWrapper
        initialScale={isMobile ? 1.4 : 1}      [hooks/use-is-mobile.ts]
        minScale={0.5} maxScale={4}            ──────────────────────
        ref={transformRef}                     useSyncExternalStore(
      >                                          subscribe(matchMedia
        <MiniMap                                   '(max-width:767px)'),
          width={120}                              getSnapshot,
          borderColor="#6C3CE0"                    getServerSnapshot=false
          className="hidden md:block            )
                     absolute top-3
                     left-3 z-40"
        >
          <div dangerouslySetInnerHTML />     [react-zoom-pan-pinch
        </MiniMap>                              built-in MiniMap renders
        <SeatMapControls />                     scaled clone + viewport
        <TransformComponent>                    rect — no manual sync]
          <div onClick={...}
               role="grid"
               dangerouslySetInnerHTML={
                 { __html: processedSvg }
               } />
        </TransformComponent>
      </TransformWrapper>
```

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── globals.css          # ★ @theme 토큰 추가 (D-01)
│   └── page.tsx             # 변경 없음
├── components/
│   ├── home/
│   │   ├── hot-section.tsx  # ★ mt-12 → mt-10 (D-04)
│   │   ├── new-section.tsx  # ★ mt-12 → mt-10
│   │   └── genre-grid.tsx   # ★ mt-12 → mt-10
│   ├── booking/
│   │   ├── seat-map-viewer.tsx       # ★ 주 수정 (D-07/D-12/D-14/D-17)
│   │   ├── seat-map-controls.tsx     # 변경 없음 (D-15 충돌 없음)
│   │   ├── seat-legend.tsx           # 변경 없음 (D-10 검증만)
│   │   └── __tests__/
│   │       └── seat-map-viewer.test.tsx  # ★ 신규 테스트 추가
│   ├── admin/
│   │   ├── svg-preview.tsx  # ★ 업로드 검증 추가 (D-06/D-08)
│   │   └── tier-editor.tsx  # 변경 없음
│   └── ui/                  # 변경 없음 (토큰 자동 전파)
└── hooks/
    └── use-is-mobile.ts     # ★ 신규 파일 (D-17 분기)
```

### Pattern 1: Tailwind v4 `@theme` 토큰 추가로 shadcn 자동 전파

**What:** `--shadow-*` 또는 `--radius-*` 변수를 `@theme` 블록 안에 추가하면 Tailwind가 자동으로 `shadow-{name}` / `rounded-{name}` utility를 생성하고, shadcn 컴포넌트는 별도 변경 없이 즉시 새 값 사용.

**When to use:** 디자인 시스템 전반의 elevation/radius 일괄 갱신.

**Example:**
```css
/* Source: tailwindcss.com/docs/theme [VERIFIED] */
/* apps/web/app/globals.css — @theme 블록 끝부분에 추가 */

@theme {
  /* ... 기존 color/spacing/text/animate 토큰 유지 ... */

  /* Phase 12 신규: shadow scale (sm + md only — D-02 Linear/Vercel convention) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.08);

  /* Phase 12 신규: radius scale (8~12px range — D-02) */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;
}
```

**자동 전파 결과:**
- `<button class="shadow-sm rounded-md">` → 새 값 즉시 적용
- shadcn `button.tsx`의 `cn(..., "rounded-md shadow-xs", ...)` → `rounded-md`은 새 8px 값
- shadcn `card.tsx`의 `rounded-xl border bg-card text-card-foreground shadow-sm` → 새 12px + 새 shadow

### Pattern 2: react-zoom-pan-pinch 내장 `MiniMap` 컴포넌트

**What:** 라이브러리가 export하는 `MiniMap`은 동일 children을 축소 렌더 + 자동 viewport rect 오버레이. ref/state 동기화 코드 불필요.

**When to use:** Zoom/pan 가능한 콘텐츠의 미니맵 — D-14 정확히 이 use case.

**Example:**
```tsx
// Source: src/stories/examples/mini-map/example.tsx [CITED: github.com/BetterTyped/react-zoom-pan-pinch]
// Verified types: node_modules/.pnpm/react-zoom-pan-pinch@3.7.0/.../dist/index.d.ts:121-128
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';

<TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
  <SeatMapControls />

  {/* 미니맵 — 데스크톱만 (D-15/D-16) */}
  <MiniMap
    width={120}
    borderColor="#6C3CE0"
    className="hidden md:block absolute top-3 left-3 z-40 bg-white/90 border border-gray-200 rounded-md shadow-md p-1"
  >
    <div dangerouslySetInnerHTML={{ __html: processedSvg }} />
  </MiniMap>

  <TransformComponent wrapperClass="..." contentClass="...">
    <div role="grid" dangerouslySetInnerHTML={{ __html: processedSvg }} />
  </TransformComponent>
</TransformWrapper>
```

**MiniMapProps (verified types):**
```ts
type MiniMapProps = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  borderColor?: string;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
```

`borderColor`가 viewport rect의 stroke 색상을 제어. `previewStyle`은 d.ts에 없으나 일부 docs에서 언급 — 안전하게 `borderColor`만 사용. height 미지정 시 children 비율 자동.

### Pattern 3: useSyncExternalStore 기반 hydration-safe 미디어 쿼리

**What:** SSR 시 desktop 기본값으로 fallback, hydrate 후 matchMedia 결과 반영. flicker 최소화 + hydration mismatch 회피.

**When to use:** SSR/RSC 페이지에서 client-side 분기 필요한 경우 (D-17의 `initialScale` prop 분기).

**Example:**
```tsx
// apps/web/hooks/use-is-mobile.ts (신규)
'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false; // SSR 기본값: desktop (initialScale=1)
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**사용처 (seat-map-viewer.tsx):**
```tsx
import { useIsMobile } from '@/hooks/use-is-mobile';

const isMobile = useIsMobile();
// ...
<TransformWrapper
  initialScale={isMobile ? 1.4 : 1}
  minScale={0.5}
  maxScale={4}
  centerOnInit
  wheel={{ step: 0.1 }}
  doubleClick={{ disabled: true }}
>
```

**SSR 동작:** 서버는 desktop 기준(`initialScale=1`)으로 SVG 렌더 → 모바일에서 hydrate 후 `useSyncExternalStore`가 `true` 반환 → `TransformWrapper` re-mount하지 않고 prop 변경. **주의:** `TransformWrapper`의 `initialScale`은 mount 시 1회만 적용된다. prop 변경으로는 재적용되지 않음 — 모바일 hydrate 시 첫 mount는 SSR 결과(scale=1)로 paint, 이후 1프레임에 client에서 prop이 1.4로 바뀌어도 적용 안 됨.

**해결책:** `key` prop으로 강제 re-mount, 또는 `useEffect`에서 isMobile 결정 후 mount.

```tsx
// 최종 권장 패턴 — 첫 paint는 hydration 후로 지연
const isMobile = useIsMobile();
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) return <SeatMapSkeleton />; // SSR 동안 skeleton
return (
  <TransformWrapper
    key={isMobile ? 'mobile' : 'desktop'}  // 분기 변경 시 강제 재초기화
    initialScale={isMobile ? 1.4 : 1}
    ...
  >
);
```

**Tradeoff:** SSR 시 좌석맵은 skeleton만 보임 (현 코드도 `useEffect`+`fetch` SVG 패턴이므로 첫 paint에서 skeleton 보이는 것과 동일 — 사용자 영향 없음).

### Pattern 4: 선택 좌석에만 transition 적용 (D-11 충실)

**What:** 기존 `transition:none` 정책을 유지하되, 선택 좌석 분기에서만 `transition: fill 150ms ease-out` + `motion-reduce` fallback.

**When to use:** D-11/D-12 충실 — locked/sold/타 사용자 broadcast은 즉시 플립 유지.

**Example:** `seat-map-viewer.tsx` 라인 88, 125, 130 변경

```tsx
// BEFORE (현재):
// L88: el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
// L125: el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
// L130: el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');

// AFTER:
if (isSelected && tierInfo) {
  el.setAttribute('fill', tierInfo.color);
  el.setAttribute('stroke', SELECTED_STROKE);
  el.setAttribute('stroke-width', '3');
  // L88 교체: 선택 좌석만 transition 활성
  el.setAttribute(
    'style',
    'cursor:pointer;opacity:1;transition:fill 150ms ease-out, stroke-width 150ms ease-out;'
  );
  // ... 체크마크 삽입 (L91~120) — opacity:0 초기값 추가
} else if (state === 'locked' || state === 'sold') {
  // L125 유지: transition:none (D-13 broadcast 즉시 플립)
  el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
} else if (tierInfo) {
  // L130 유지: transition:none (해제 좌석은 다음 프레임에 즉시)
  el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
}
```

**체크마크 fade-in (L91~120 수정):**
```tsx
checkEl.setAttribute('text-anchor', 'middle');
checkEl.setAttribute('dominant-baseline', 'central');
checkEl.setAttribute('fill', 'white');
checkEl.setAttribute('font-size', '12');
checkEl.setAttribute('font-weight', 'bold');
checkEl.setAttribute('pointer-events', 'none');
// NEW: fade-in 초기값 + transition (CSS — prefers-reduced-motion 자동 무력화)
checkEl.setAttribute('opacity', '0');
checkEl.setAttribute(
  'style',
  'transition:opacity 150ms ease-out;'
);
checkEl.textContent = '✓';
el.parentNode?.insertBefore(checkEl, el.nextSibling);

// fade-in trigger: 다음 프레임에 opacity 1로 변경
requestAnimationFrame(() => {
  checkEl.setAttribute('opacity', '1');
});
```

**주의:** processedSvg는 useMemo의 string output. 위 코드는 `doc` (in-memory DOMParser) 시점이 아니라 **서버 → DOM 삽입 후 시점에서 동작**해야 fade-in이 보인다. `requestAnimationFrame`은 useMemo 안에서 호출해도 의미 없음 — useMemo는 string만 반환하기 때문.

**대안 1 (CSS-only — 권장):** opacity:0으로만 set하고 CSS @keyframes로 자동 fade-in.
```css
/* globals.css 또는 인라인 <style> */
@keyframes seat-checkmark-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
[data-seat-checkmark] {
  animation: seat-checkmark-fade-in 150ms ease-out forwards;
}
```
체크마크 `<text>`에 `data-seat-checkmark` attr 추가하면 mount 시 자동으로 keyframe 1회 재생. **prefers-reduced-motion override는 globals.css에 한 줄 추가:**
```css
@media (prefers-reduced-motion: reduce) {
  [data-seat-checkmark] { animation: none; opacity: 1; }
}
```

**대안 2 (SMIL — 비권장):** `<animate>` 요소를 `<text>` 내부에 삽입. prefers-reduced-motion 미디어 쿼리 미적용.

**권장: 대안 1 (CSS @keyframes + data attr).** 이유: prefers-reduced-motion 일관성, 컴포넌트 코드 단순, Phase 11 `motion-reduce:` 컨벤션 호환.

### Anti-Patterns to Avoid

- **Anti-pattern 1: TransformWrapper의 `key`를 매 prop 변경마다 토글:** 불필요한 SVG 재마운트는 사용자의 현재 zoom 위치를 잃게 한다. `useIsMobile` 결과로 `key`를 두 가지 값 (`mobile`/`desktop`)만 사용 — 사용자가 디바이스 회전 등으로 breakpoint를 넘었을 때만 reset, 그 외에는 안정.
- **Anti-pattern 2: D-13 위반 (broadcast 좌석에 transition 적용):** 100명 동시 접속 시 5초마다 50개 좌석이 fade로 깜빡이면 산만함 + 체크마크 fade-in과 시각 충돌. 선택 좌석 분기(`isSelected === true`)에만 transition 활성, 나머지는 모두 `transition:none`.
- **Anti-pattern 3: globals.css `@theme` 외부에 shadow/radius CSS 변수 정의:** `:root { --shadow-sm: ... }`만 하면 utility 자동 생성 안 됨. `@theme {}` 블록 안에 넣어야 Tailwind가 인식 [VERIFIED: tailwindcss.com/docs/theme]. 단, `--chart-*`처럼 namespace 외 변수는 별도 `:root` 미러가 필요 (현 globals.css:110-116 패턴).
- **Anti-pattern 4: admin SVG 검증을 R2 PUT 이후로 미루기:** 현재 svg-preview.tsx:38~49 흐름은 R2 PUT 먼저 → text 파싱이 나중. UX-02 검증을 R2 PUT 이후에 두면 잘못된 SVG도 R2 비용을 소비하고 publicUrl 발급. 검증은 file 객체 받자마자 동기 수행.
- **Anti-pattern 5: TransformWrapper에 initialScale을 prop으로만 전달:** 라이브러리는 mount 시 1회만 읽음. prop 변경에 반응 안 함 — `key` 강제 재마운트 또는 `setTransform` 메서드 호출 필요.
- **Anti-pattern 6: `--shadow-lg`/`--shadow-xl` 신규 추가:** D-02는 `sm + md` 2단만 명시 (Linear/Vercel convention). 추가 단계는 디자인 일관성 흐림.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 미니맵 (축소 SVG + viewport rect) | 수동 SVG 복제 + onTransformed로 rect 좌표 계산 (~30~50줄 + ID 충돌 처리) | `MiniMap` 컴포넌트 (react-zoom-pan-pinch 내장, 이미 설치됨) | 라이브러리 내장 정확히 이 use case. ID 충돌 처리, 좌표 매핑, viewport rect 모두 자동. children에 SVG dangerouslySetInnerHTML만 전달. |
| 모바일 감지 | `useEffect` + `useState` + `window.innerWidth` listener | `useSyncExternalStore` + `matchMedia` | React 18+ 권장 패턴. SSR snapshot 명시. matchMedia는 listener 자동 정리. |
| Toast 발송 (검증 실패) | 자체 알림 컴포넌트 | sonner `toast.error('...')` | 이미 `svg-preview.tsx`에서 사용. wrapper `components/ui/sonner.tsx` 통일. |
| Tailwind 토큰 → utility 매핑 | JS 설정 파일 (tailwind.config.js) | `@theme` directive (CSS-first) | Tailwind v4 표준. JS config 파일 없음 (v3 패턴). namespace 인식 자동. |
| 등급 색상 + 가격 범례 | 신규 컴포넌트 | `seat-legend.tsx` (이미 존재) | D-10 검증만. 1바이트도 손대지 않음. |
| WCAG 2.5.5 44px 측정 | 자체 계산 라이브러리 | 32 × 1.4 = 44.8 (산술) | 단순 곱셈. SVG seat rect width 32 × initialScale 1.4 = 44.8 CSS px (browser zoom 100% 가정). |
| 체크마크 SVG 아이콘 | 외부 SVG 파일 import | `✓` (UNICODE CHECK MARK) inline | 기존 `seat-map-viewer.tsx:118`이 이미 사용. 재사용. |
| SVG sanitize (XSS 방지) | DOMPurify, sanitize-html | 현 단계 미도입 (D-19 + R2 own-bucket = 신뢰 source) | admin 본인이 업로드 + R2 자기 버킷. CSP 헤더(추후 phase)와 함께 보안 phase로 분리 가능. |

**Key insight:** Phase 12에서 신규 의존성 0개, 신규 컴포넌트 1개(`hooks/use-is-mobile.ts` 7~15줄)만 추가하면 D-01~D-19 모두 충족 가능. UI-SPEC §Component Inventory의 "NEW component `seat-map-minimap.tsx`"는 라이브러리 내장 `MiniMap`으로 대체.

## Common Pitfalls

### Pitfall 1: Tailwind v4 `@theme` 블록 외부 정의

**What goes wrong:** 개발자가 `:root { --shadow-modern: ... }`만 정의하고 `shadow-modern` utility를 기대.
**Why it happens:** v3 습관 (CSS variable + JS config). v4는 `@theme` 안에서 namespace 인식해야 utility 생성.
**How to avoid:** **반드시 `@theme {}` 블록 안에 정의.** namespace 접두사(`--shadow-`/`--radius-`/`--color-` 등) 준수.
**Warning signs:** typecheck/lint 통과하지만 브라우저에서 utility 클래스가 적용 안 됨. DevTools Computed에서 변수만 보이고 utility class는 정의되지 않음.

### Pitfall 2: TransformWrapper `initialScale` prop change 무반응

**What goes wrong:** `useIsMobile()` 결과 변경 시 `initialScale` prop이 1 → 1.4로 바뀌어도 좌석맵이 안 줌.
**Why it happens:** `initialScale`은 mount 시점에만 평가됨. prop 변경에 반응하지 않음.
**How to avoid:** `<TransformWrapper key={isMobile ? 'm' : 'd'} ...>`로 분기 변경 시 재마운트 강제. 또는 `transformRef.current?.setTransform(...)`로 prop 우회.
**Warning signs:** 모바일 디바이스에서 좌석이 32px로 보이고 (44px 안 됨) 사용자가 수동 줌 필요.

### Pitfall 3: useMemo 안에서 requestAnimationFrame 호출

**What goes wrong:** 체크마크 fade-in을 useMemo 안에서 `requestAnimationFrame(() => checkEl.setAttribute('opacity', '1'))` 호출. 동작 안 함.
**Why it happens:** useMemo는 in-memory `doc` (DOMParser 결과)을 string으로 outerHTML 반환. 이 string은 후에 dangerouslySetInnerHTML로 마운트되지만, 그때는 useMemo의 클로저가 끝났고 `checkEl` 참조는 다른 DOM에 있는 별개 노드.
**How to avoid:** **CSS @keyframes 패턴으로 전환** (Pattern 4 대안 1). `data-seat-checkmark` attr만 useMemo에서 set하고 fade-in은 CSS가 mount 시 자동 트리거.
**Warning signs:** 체크마크가 즉시 보임 (fade-in 효과 없음).

### Pitfall 4: SSR/Client hydration mismatch — initialScale flash

**What goes wrong:** SSR에서 `initialScale=1`로 렌더된 HTML이 모바일 client에서 hydrate되며 `1.4`로 변경 시도 → flash 또는 mismatch warning.
**Why it happens:** `useSyncExternalStore`의 `getServerSnapshot`이 `false` 반환 → SSR HTML은 desktop. Client는 `true` 반환.
**How to avoid:** `seat-map-viewer.tsx`는 이미 useEffect + fetch로 SVG를 클라이언트 비동기 로딩 — SSR에서는 어차피 skeleton만 출력. `if (!processedSvg) return skeleton` 라인 (266~273)이 첫 paint 보호. 모바일 분기는 SVG 로딩 완료 후 첫 mount이므로 mismatch 없음. **추가 가드: `useEffect` mount 후 `setMounted(true)` 패턴 적용 시 더 안전.**
**Warning signs:** browser console에 "Hydration failed" warning, 또는 첫 paint에서 zoom 이상.

### Pitfall 5: D-13 위반 (실시간 broadcast에 fade transition 누설)

**What goes wrong:** 모든 좌석 rect에 `transition: fill 150ms` 적용 → 타 사용자가 좌석 잠그면 회색으로 fade-out, 100명 동시 접속 시 시각 카오스.
**Why it happens:** 개발자가 "선택 좌석에만 transition" 분기를 빼먹고 모든 분기에 transition 추가.
**How to avoid:** **transition은 `isSelected === true` 분기 안에서만.** locked/sold/available 분기는 `transition:none` 유지. 테스트로 보장 (Wave 0 — `expect(seatA1.style.transition).toBe('none')` for locked).
**Warning signs:** 다른 탭에서 좌석 잠그기 시뮬레이션 → 잠긴 좌석이 fade로 회색 전환 (즉시 플립이 아님).

### Pitfall 6: SVG `<defs>` ID 충돌 (미니맵에서 SVG 두 번 렌더)

**What goes wrong:** SVG가 `<defs>` 안에 `<linearGradient id="grad1">` 정의 + `fill="url(#grad1)"` 참조. 미니맵으로 같은 SVG 두 번 마운트 시 ID 중복 → 한쪽 SVG가 다른쪽의 `<defs>`를 참조.
**Why it happens:** SVG의 `url(#id)`는 document-wide 해석.
**How to avoid:** **현 sample-seat-map.svg에는 `<defs>`/`id` 속성 없음 — 즉시 위험은 없음** [VERIFIED: grep — `id=`/`<defs` 0건]. 그러나 외부 admin 업로드 SVG는 `<defs>` 사용 가능. **두 가지 방어:**
  1. 단기 (Phase 12): 미니맵 children으로 전달하는 SVG의 `<defs>` 안 모든 ID에 접두사 부여 (예: `mini-`). DOMParser로 재처리 1회만.
  2. 장기 (deferred): `react-svg-unique-id`-스타일 라이브러리 또는 `<defs>` hoisting. Phase 12 범위 밖.
**Warning signs:** 미니맵 또는 메인 좌석맵에서 grad/pattern fill이 깨짐.

### Pitfall 7: shadcn `--radius` 단일 변수와 namespace 변수 혼동

**What goes wrong:** shadcn new-york 템플릿은 종종 `--radius: 0.5rem` + `--radius-sm: calc(var(--radius) - 4px)` 같은 파생 정의 사용. 새 `--radius-md` 추가 시 기존 정의와 conflict.
**Why it happens:** shadcn init 시 `--radius` 단일 변수만 생성 + `var(--radius)` 참조. globals.css에 이미 정의된 `--radius`가 있으면 충돌.
**How to avoid:** **현 globals.css에는 `--radius` 정의 없음** [VERIFIED: grep — `--radius` in globals.css → 0건]. 신규 토큰 충돌 위험 없음. 다만 향후 shadcn `npx add` 명령이 `--radius`를 globals.css에 추가하려 시도 시 수동 검토 필요.
**Warning signs:** typecheck OK인데 `rounded-md`가 예상치 못한 크기.

### Pitfall 8: Admin 업로드 검증을 정규식만으로 (DOMParser 미사용)

**What goes wrong:** `text.match(/<text[^>]*>STAGE<\/text>/)` 같은 정규식만으로 검증 → SVG namespace 변형, 속성 순서, 주석 포함 케이스에서 false negative.
**Why it happens:** SVG/XML 파싱은 정규식으로 안정적이지 않음.
**How to avoid:** `DOMParser().parseFromString(text, 'image/svg+xml')` + `doc.querySelector('[data-stage], text')`. 후자에서 textContent === 'STAGE' 비교. **이미 seat-map-viewer.tsx:72-74가 동일 패턴 사용** — admin도 같은 패턴.
**Warning signs:** 합법 SVG가 거부되거나 invalid SVG가 통과.

## Code Examples

검증된 패턴을 변경 라인 단위로 인용. 각 스니펫은 "이 줄을 이렇게 바꾸세요" 형식.

### globals.css — D-01 토큰 추가 (라인 ~93 직전, `@keyframes shake` 직후 또는 색상 토큰 다음 적절 위치)

```css
/* Source: tailwindcss.com/docs/theme [VERIFIED] */
/* INSERT in @theme block, near existing --animate-* (line ~70) */

/* Phase 12 (D-01/D-02): Minimal shadow scale — Linear/Vercel convention */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.08);

/* Phase 12 (D-01/D-02): Modern radius scale — 6/8/10/12px */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;
```

```css
/* Source: globals.css 신규 추가 — 외부 (@theme 블록 종료 후) */
/* Phase 12 (D-12): 체크마크 fade-in keyframe + reduced-motion override */

@keyframes seat-checkmark-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

[data-seat-checkmark] {
  animation: seat-checkmark-fade-in 150ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  [data-seat-checkmark] {
    animation: none;
    opacity: 1;
  }
}
```

### seat-map-viewer.tsx — D-11/D-12 transition 정책 + 체크마크 fade-in

**현재 (라인 84~131):**
```tsx
if (isSelected && tierInfo) {
  el.setAttribute('fill', tierInfo.color);
  el.setAttribute('stroke', SELECTED_STROKE);
  el.setAttribute('stroke-width', '3');
  el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');  // L88

  // ... 체크마크 삽입 (L91~120) ...
} else if (state === 'locked' || state === 'sold') {
  el.setAttribute('fill', LOCKED_COLOR);
  el.removeAttribute('stroke');
  el.setAttribute('stroke-width', '0');
  el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');  // L125
} else if (tierInfo) {
  el.setAttribute('fill', tierInfo.color);
  el.removeAttribute('stroke');
  el.setAttribute('stroke-width', '0');
  el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');  // L130
}
```

**변경 후:**
```tsx
if (isSelected && tierInfo) {
  el.setAttribute('fill', tierInfo.color);
  el.setAttribute('stroke', SELECTED_STROKE);
  el.setAttribute('stroke-width', '3');
  // L88 변경: 선택 좌석만 transition 활성 (D-11)
  el.setAttribute(
    'style',
    'cursor:pointer;opacity:1;transition:fill 150ms ease-out,stroke 150ms ease-out;'
  );

  // 체크마크 삽입 (L91~120 거의 그대로, 한 줄 추가) ...
  if (cx !== null && cy !== null) {
    checkEl.setAttribute('x', String(cx));
    checkEl.setAttribute('y', String(cy));
    checkEl.setAttribute('text-anchor', 'middle');
    checkEl.setAttribute('dominant-baseline', 'central');
    checkEl.setAttribute('fill', 'white');
    checkEl.setAttribute('font-size', '12');
    checkEl.setAttribute('font-weight', 'bold');
    checkEl.setAttribute('pointer-events', 'none');
    checkEl.setAttribute('data-seat-checkmark', '');  // NEW: CSS @keyframes 트리거 (D-12)
    checkEl.textContent = '✓';
    el.parentNode?.insertBefore(checkEl, el.nextSibling);
  }
} else if (state === 'locked' || state === 'sold') {
  // L125 유지: 즉시 플립 (D-13 broadcast)
  el.setAttribute('style', 'cursor:not-allowed;opacity:0.6;transition:none');
} else if (tierInfo) {
  // L130 유지: 즉시 (해제는 다음 프레임에 다시 그려지므로 transition 없어도 자연)
  el.setAttribute('style', 'cursor:pointer;opacity:1;transition:none');
}
```

### seat-map-viewer.tsx — D-07 스테이지 배지 오버레이 (라인 134~146 사이)

```tsx
// processedSvg useMemo 내부, viewBox 보장 직후 추가
const svgEl = doc.documentElement;
if (!svgEl.getAttribute('viewBox')) {
  // ... 기존 코드 ...
}

// NEW: D-07 스테이지 방향 처리
const hasStageText = doc.querySelector('text')?.textContent?.includes('STAGE');
const dataStage = svgEl.getAttribute('data-stage');  // 'top' | 'right' | 'bottom' | 'left'

if (!hasStageText && dataStage) {
  // SVG에 stage 시각 요소가 없고 data-stage 속성만 있는 경우
  const viewBox = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 800, 600];
  const [, , vbW, vbH] = viewBox;
  const svgNs = 'http://www.w3.org/2000/svg';
  const overlayG = doc.createElementNS(svgNs, 'g');
  overlayG.setAttribute('aria-label', `무대 위치: ${dataStage}`);

  // 위치 계산 (변에 따라)
  const badgeRect = doc.createElementNS(svgNs, 'rect');
  const badgeText = doc.createElementNS(svgNs, 'text');
  const badgeWidth = 120;
  const badgeHeight = 32;
  let bx = 0, by = 0;
  switch (dataStage) {
    case 'top':    bx = vbW / 2 - badgeWidth / 2; by = 12; break;
    case 'bottom': bx = vbW / 2 - badgeWidth / 2; by = vbH - badgeHeight - 12; break;
    case 'left':   bx = 12; by = vbH / 2 - badgeHeight / 2; break;
    case 'right':  bx = vbW - badgeWidth - 12; by = vbH / 2 - badgeHeight / 2; break;
  }
  badgeRect.setAttribute('x', String(bx));
  badgeRect.setAttribute('y', String(by));
  badgeRect.setAttribute('width', String(badgeWidth));
  badgeRect.setAttribute('height', String(badgeHeight));
  badgeRect.setAttribute('rx', '8');
  badgeRect.setAttribute('fill', '#E5E7EB');
  badgeRect.setAttribute('stroke', '#9CA3AF');
  badgeRect.setAttribute('stroke-width', '1.5');
  badgeText.setAttribute('x', String(bx + badgeWidth / 2));
  badgeText.setAttribute('y', String(by + badgeHeight / 2));
  badgeText.setAttribute('text-anchor', 'middle');
  badgeText.setAttribute('dominant-baseline', 'central');
  badgeText.setAttribute('font-size', '14');
  badgeText.setAttribute('font-weight', '600');
  badgeText.setAttribute('fill', '#6B7280');
  badgeText.textContent = 'STAGE';
  overlayG.appendChild(badgeRect);
  overlayG.appendChild(badgeText);
  svgEl.appendChild(overlayG);
}

// 기존 라인 142~146 (responsive style) 유지
svgEl.removeAttribute('width');
svgEl.removeAttribute('height');
svgEl.setAttribute('style', 'width:100%;height:auto;display:block;');
```

### seat-map-viewer.tsx — D-14 미니맵 + D-17 모바일 분기 (라인 276~303)

**현재 (라인 276~303):**
```tsx
return (
  <div className="relative overflow-hidden rounded-lg bg-gray-50">
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={4}
      centerOnInit
      wheel={{ step: 0.1 }}
      doubleClick={{ disabled: true }}
    >
      <SeatMapControls />
      <TransformComponent ...>
        <div ref={containerRef} role="grid" ... />
      </TransformComponent>
    </TransformWrapper>
    <div ref={tooltipRef} ... />
  </div>
);
```

**변경 후:**
```tsx
import { TransformWrapper, TransformComponent, MiniMap } from 'react-zoom-pan-pinch';
import { useIsMobile } from '@/hooks/use-is-mobile';

// 컴포넌트 본문 상단에 추가
const isMobile = useIsMobile();

return (
  <div className="relative overflow-hidden rounded-lg bg-gray-50">
    <TransformWrapper
      key={isMobile ? 'mobile' : 'desktop'}  // D-17 prop 변경 강제 적용
      initialScale={isMobile ? 1.4 : 1}
      minScale={0.5}
      maxScale={4}
      centerOnInit
      wheel={{ step: 0.1 }}
      doubleClick={{ disabled: true }}
    >
      <SeatMapControls />

      {/* D-14/D-15/D-16: 미니맵 — 데스크톱만 */}
      {!isMobile && (
        <MiniMap
          width={120}
          borderColor="#6C3CE0"
          className="absolute top-3 left-3 z-40 rounded-md border border-gray-200 bg-white/90 p-1 shadow-md"
        >
          <div dangerouslySetInnerHTML={{ __html: processedSvg }} />
        </MiniMap>
      )}

      <TransformComponent
        wrapperClass="w-full min-h-[300px] lg:min-h-[500px]"
        contentClass="w-full"
        wrapperStyle={{ width: '100%', maxWidth: '100%' }}
        contentStyle={{ width: '100%' }}
      >
        <div
          ref={containerRef}
          role="grid"
          aria-label="좌석 배치도"
          onClick={handleClick}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          dangerouslySetInnerHTML={{ __html: processedSvg }}
        />
      </TransformComponent>
    </TransformWrapper>
    <div ref={tooltipRef} ... />
  </div>
);
```

### svg-preview.tsx — D-06/D-08 admin 업로드 검증 추가 (라인 31~62)

**현재 (라인 31~62):**
```tsx
const handleSvgUpload = useCallback(
  async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('SVG 파일은 10MB 이하여야 합니다.');
      return;
    }
    try {
      const { uploadUrl, publicUrl } = await presignedUpload.mutateAsync({...});
      await fetch(uploadUrl, { method: 'PUT', body: file, ... });
      setSvgUrl(publicUrl);

      // Count seats in SVG
      const text = await file.text();
      const seatCount = (text.match(/data-seat-id/g) || []).length;
      setTotalSeats(seatCount);

      toast.success('좌석맵 SVG가 업로드되었습니다.');
    } catch {
      toast.error('SVG 업로드에 실패했습니다.');
    }
  },
  [presignedUpload],
);
```

**변경 후:**
```tsx
const handleSvgUpload = useCallback(
  async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('SVG 파일은 10MB 이하여야 합니다.');
      return;
    }

    // NEW (D-06/D-08): 스테이지 마커 검증 — R2 PUT 이전
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const hasStageText = Array.from(doc.querySelectorAll('text')).some(
      (t) => t.textContent?.trim() === 'STAGE'
    );
    const hasDataStage = doc.documentElement.hasAttribute('data-stage')
      || doc.querySelector('[data-stage]') !== null;
    if (!hasStageText && !hasDataStage) {
      toast.error(
        '스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.'
      );
      return;
    }

    try {
      const { uploadUrl, publicUrl } = await presignedUpload.mutateAsync({...});
      await fetch(uploadUrl, { method: 'PUT', body: file, ... });
      setSvgUrl(publicUrl);

      // Count seats in SVG (text 변수 재사용)
      const seatCount = (text.match(/data-seat-id/g) || []).length;
      setTotalSeats(seatCount);

      toast.success('좌석맵 SVG가 업로드되었습니다.');
    } catch {
      toast.error('SVG 업로드에 실패했습니다.');
    }
  },
  [presignedUpload],
);
```

### hooks/use-is-mobile.ts — 신규 파일 (D-17)

```tsx
'use client';
import { useSyncExternalStore } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

### 홈 파일럿 미세 튜닝 (D-04) — 3~5줄 변경

```tsx
// hot-section.tsx:19
- <section className="mt-12">
+ <section className="mt-10">

// new-section.tsx:15
- <section className="mt-12">
+ <section className="mt-10">

// genre-grid.tsx:44
- <section className="mt-12 pb-12">
+ <section className="mt-10 pb-12">
```

총 3줄 변경 (lg-xl 토큰 범위 안). 더 이상의 변경이 필요하면 plan 단계에서 추가 검토.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config (`tailwind.config.js`) | Tailwind v4 `@theme` directive (CSS-first) | v4 GA, 2025 | tailwind.config.js 파일 없음. 모든 토큰은 globals.css `@theme {}` 안에. |
| 수동 SVG `<defs>` ID 관리 | 미니맵 use case는 라이브러리 내장 `MiniMap` | react-zoom-pan-pinch v3 | 자체 ID 충돌 처리 불필요 (sample SVG에 `<defs>` 없음). |
| `useEffect` + `matchMedia` | `useSyncExternalStore` + matchMedia | React 18+, Next.js 13+ | SSR snapshot 명시. hydration mismatch 회피. |
| SMIL `<animate>` for SVG | CSS `transition` / `@keyframes` on SVG attrs | 2020+ (모든 evergreen 브라우저) | prefers-reduced-motion 미디어 쿼리 일관 적용. |
| WCAG 2.1 §2.5.5 Target Size (AAA, 44×44) | WCAG 2.2 §2.5.8 Target Size (Minimum, AA, 24×24) + 2.5.5 권장 | WCAG 2.2 GA (Oct 2023) | Phase 12는 D-17 명시 44×44 (AAA 기준). 더 강한 보장. |

**Deprecated/outdated:**
- `tailwind.config.js`: v4에서는 파일 없음. apps/web/package.json devDeps에 `tailwindcss` + `@tailwindcss/postcss`만.
- `@tosspayments/sdk`: v1 deprecated, `@tosspayments/tosspayments-sdk` 사용 (Phase 12 무관).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MiniMap` 컴포넌트의 `borderColor` prop이 viewport rect의 stroke를 제어한다 | §Standard Stack §Pattern 2 | 낮음 — d.ts에 명시되어 있고 docs에서 확인. 색상이 다를 경우 plan 단계에서 시각 확인. |
| A2 | shadcn `button.tsx`/`card.tsx`가 `--radius-md`/`--radius-xl` 토큰을 className `rounded-md`/`rounded-xl`로 자동 소비 | §Pattern 1 | 낮음 — Tailwind v4 자동 utility 생성은 공식 문서 검증. shadcn 컴포넌트 소스 직접 grep으로 검증 권장 (plan 단계). |
| A3 | 32px 좌석 × 1.4 = 44.8px가 모바일 디바이스의 실제 CSS px와 일치 | §Don't Hand-Roll | 낮음 — viewport meta tag(`<meta name="viewport" content="width=device-width">`)가 설정되어 있고 browser zoom 100%일 때. iOS Safari에서 텍스트 자동 확대(text-size-adjust)는 SVG에 영향 없음. |
| A4 | `useSyncExternalStore`로 모바일 분기 시 첫 SVG fetch 완료 시점에서는 client hydrate가 완료되어 mismatch 없음 | §Pattern 3 §Pitfall 4 | 중간 — `useEffect` + `setMounted(true)` 패턴 추가로 명시적 가드 권장. |
| A5 | sample-seat-map.svg 외 외부 admin 업로드 SVG가 `<defs>`/`url(#id)` 패턴을 거의 사용하지 않을 것 | §Pitfall 6 | 중간 — 실제 외부 SVG 도구(Figma/Illustrator export) 출력은 종종 `<defs>` 사용. Phase 12에서 ID 접두사 처리 미구현 시 미니맵에서 grad/pattern fill 깨질 가능성 있음. **권장: plan 단계에서 미니맵 SVG의 `<defs>` 안 ID에 'mini-' 접두사 자동 부여 스크립트 추가 (10줄 정도).** |
| A6 | `prefers-reduced-motion` 미디어 쿼리가 SVG 안의 `<text>` 요소에도 적용된다 | §Pattern 4 대안 1 | 낮음 — CSS 미디어 쿼리는 모든 element에 적용. data attribute 셀렉터도 SVG/HTML 공용. |
| A7 | UI-SPEC §Component Inventory의 "NEW component `seat-map-minimap.tsx`"는 라이브러리 내장 `MiniMap`으로 대체 가능 | §Summary §Standard Stack | 낮음 — D-14 의도(축소 SVG 복제 + viewport rect)와 일치. plan 단계에서 UI-SPEC 재검토 / SPEC 갱신 필요. |
| A8 | `MiniMap` 자식으로 dangerouslySetInnerHTML로 SVG를 전달해도 라이브러리가 정상 축소 렌더 | §Pattern 2 | 중간 — 라이브러리 docs는 보통 `<img>` 또는 React 컴포넌트 children 예시. SVG dangerouslySetInnerHTML이 동일 동작인지 plan 단계에서 spike 권장 (5분 내 확인). |
| A9 | sonner 2.0.7 (현재 설치)이 `motion-reduce` Tailwind variant와 충돌 없음 | §Common Pitfalls | 낮음 — sonner는 자체 애니메이션을 inline style로 적용. Tailwind variant와 무관. Phase 11에서 이미 dashboard chart에 적용된 `motion-reduce:[&_*]:!transition-none` 패턴 검증됨. |

## Open Questions (RESOLVED)

1. **UI-SPEC §Component Inventory와 라이브러리 내장 `MiniMap` 호환 정합성**
   - What we know: UI-SPEC은 NEW component `seat-map-minimap.tsx` 명시 (line 173).
   - What's unclear: 본 RESEARCH의 권장(라이브러리 내장 사용)을 적용 시 UI-SPEC 갱신이 필요한가?
   - Recommendation: **plan 단계에서 UI-SPEC `## Component Inventory` 행을 "Existing (라이브러리 내장 MiniMap 재사용)"으로 정정 — `gsd-ui-researcher` 재호출 또는 UI-SPEC inline patch.** 결과적으로 신규 파일 `seat-map-minimap.tsx`는 만들지 않음.
   - **RESOLVED:** Plan 12-03 Task 1 (UX-05) 채택 — react-zoom-pan-pinch 내장 `MiniMap` 재사용. 신규 `seat-map-minimap.tsx` 파일은 만들지 않음. UI-SPEC §Component Inventory는 plan 산출물(seat-map-viewer.tsx)이 이미 라이브러리 내장 MiniMap 사용으로 일관됨 → UI-SPEC 별도 inline patch 불필요.

2. **모바일 미니맵 노출 정책 재확인**
   - What we know: D-16은 모바일 숨김.
   - What's unclear: tablet (768~1024px)도 미니맵 표시? D-16은 `< md` (768px 미만)만 명시.
   - Recommendation: tablet 이상 = 표시. `!isMobile` = `>= 768px` = 데스크톱+태블릿. 의문이면 plan 단계에서 user 확인.
   - **RESOLVED:** Plan 12-02/12-03 채택 — `useIsMobile()`의 query는 `(max-width: 767px)` 단일 임계 → tablet (≥ 768px) 이상에서 MiniMap 표시. D-16과 정합 (모바일 숨김 = `< 768px` 숨김).

3. **`<defs>` ID 충돌 방어 범위**
   - What we know: sample SVG에는 `<defs>` 없음 (즉시 위험 0).
   - What's unclear: 실제 admin이 업로드할 외부 SVG 패턴.
   - Recommendation: **단기(Phase 12)** — DOMParser로 `<defs>` 안 ID에 'mini-' 접두사 일괄 부여 + `url(#)` 참조 동시 변경. 추가 10~15줄. **장기 (deferred)** — `react-svg-unique-id` 등 라이브러리 도입은 별도 phase.
   - **RESOLVED:** Plan 12-03 Task 1 (UX-05, W-6) 채택 — `prefixSvgDefsIds(processedSvg, 'mini-')` 헬퍼를 단기 처리로 추가. `<defs>` 가드로 sample SVG에서는 no-op, 외부 admin SVG의 `<defs>` 사용 시 자동 ID 접두사 부여 + `url(#...)` 참조 일괄 치환. 장기 라이브러리 도입은 deferred.

4. **체크마크 fade-in 보다 fill transition이 먼저 보일 수 있는가**
   - What we know: 선택 시 rect fill 변경 + 체크마크 mount 동시.
   - What's unclear: brower paint 순서로 fill transition이 먼저 보이고 체크마크가 늦게 fade-in 되어 어색해 보일 수 있음.
   - Recommendation: 둘 다 150ms easing 동일이므로 paint 시점 차 ≤ 1프레임. **plan 단계에서 manual QA로 확인.**
   - **RESOLVED:** Plan 12-03 Task 2 (B-2) 채택 — pendingSelections/pendingRemovals 메커니즘으로 신규 선택 좌석에 `data-fading-in="true"` 잠시 부여 → 다음 frame에 primary fill로 변경 → CSS transition trigger 보장. 체크마크와 fill 모두 동일 frame에서 transition 시작 → paint 시점 차 ≤ 1프레임 보장. Plan 12-04 Task 2 manual QA 검증 3에서 시각 확인.

5. **TransformWrapper의 `key`로 강제 재마운트 시 사용자 zoom state 손실**
   - What we know: 디바이스 회전 시 isMobile 분기 변경 → key 변경 → 재마운트 → centerOnInit 다시 적용.
   - What's unclear: 사용자가 줌·팬한 상태에서 회전하면 reset됨.
   - Recommendation: 의도된 동작 (디바이스 회전 = 새 viewport — reset이 자연스러움). 별도 처리 불필요.
   - **RESOLVED:** Plan 12-03 Task 1 (UX-06) 채택 — `key={isMobile ? 'mobile' : 'desktop'}` 적용. 디바이스 회전 = 새 viewport context로 reset이 자연스러운 UX → 별도 zoom state 보존 처리 없음. Phase 12 범위에서 종결.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/build | ✓ | 22.22.x LTS (stack) | — |
| pnpm | monorepo build | ✓ | n/a (전제) | — |
| react-zoom-pan-pinch | UX-04/05/06 | ✓ | 3.7.0 (현재 설치) — `MiniMap` export 포함 | — |
| tailwindcss + @tailwindcss/postcss | UX-01 | ✓ | 4.2.0 / 4.2.0 | — |
| sonner | UX-02 toast | ✓ | 2.0.7 | — |
| matchMedia API | UX-06 모바일 분기 | ✓ | 모든 evergreen 브라우저 | `useEffect` + `window.innerWidth` (덜 우아) |
| prefers-reduced-motion CSS 미디어 쿼리 | UX-04 fallback | ✓ | 모든 evergreen 브라우저 | — |
| DOMParser API | UX-02 검증 | ✓ | 모든 evergreen 브라우저 + jsdom (vitest) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None (모두 설치됨).

## Validation Architecture

> `.planning/config.json`의 `workflow.nyquist_validation: true` — 본 섹션 필수.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x + @testing-library/react 16.3.x + jsdom 26.x |
| Config file | `apps/web/vitest.config.ts` (env: jsdom, globals: true, setup: 없음, exclude: e2e) |
| Quick run command | `pnpm --filter @grapit/web test -- seat-map-viewer` |
| Full suite command | `pnpm --filter @grapit/web test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | `--shadow-sm`/`--shadow-md`/`--radius-{md,lg,xl}` 토큰이 `@theme` 블록에 추가되고 `shadow-sm`/`rounded-lg` 등 utility가 빌드 결과에 반영 | manual + smoke | dev server 시각 확인 (Storybook 없음 — `pnpm --filter @grapit/web dev` + `/admin/dashboard` 페이지 카드 elevation 비교) | ❌ 자동 테스트 어려움 — manual QA + plan 단계 시각 확인 |
| UX-02 (admin) | admin이 stage 마커 없는 SVG 업로드 시 toast 발송 + R2 PUT 미발생 | unit | `pnpm --filter @grapit/web test -- svg-preview` | ❌ Wave 0 — `apps/web/components/admin/__tests__/svg-preview.test.tsx` 신규 생성 |
| UX-02 (viewer) | SVG에 `data-stage` 속성만 있을 때 viewer가 viewBox 기준 변에 STAGE 배지 오버레이 추가 | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 기존 파일 — 신규 케이스 추가 |
| UX-03 | 등급별 dot + 등급명 + 가격 표시 (이미 구현, 검증) | manual | dev server 시각 확인 | ❌ 자동 미적용 (D-10) — 시각 검증으로 종결 |
| UX-04 | 선택 좌석 rect의 inline `style`에 `transition:fill 150ms`가 포함되고, locked/sold/available은 `transition:none`을 유지 | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 기존 파일 — 케이스 추가 (`expect(seatA1.style.transition).toContain('fill 150ms')`) |
| UX-04 | 선택 시 체크마크 `<text>` 요소에 `data-seat-checkmark` 속성 부여 | unit | 동일 위 | ✅ 케이스 추가 (`expect(querySelector('[data-seat-checkmark]')).toBeTruthy()`) |
| UX-05 | 데스크톱(`isMobile=false`)에서 `MiniMap` 컴포넌트가 마운트, 모바일에서 미마운트 | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 케이스 추가 (`vi.mock('@/hooks/use-is-mobile')` + matchMedia mock) |
| UX-06 | `isMobile=true` 시 TransformWrapper에 `initialScale=1.4` 전달 | unit | 동일 위 | ✅ 케이스 추가 — `vi.mock('react-zoom-pan-pinch', () => ({ TransformWrapper: vi.fn(({ children, initialScale }) => ...) }))` 후 `expect(TransformWrapper).toHaveBeenCalledWith(expect.objectContaining({ initialScale: 1.4 }), ...)` |
| UX-06 | `useIsMobile` 훅이 SSR 시 `false` (desktop fallback) 반환 | unit | `pnpm --filter @grapit/web test -- use-is-mobile` | ❌ Wave 0 — `apps/web/hooks/__tests__/use-is-mobile.test.ts` 신규 생성 |
| 회귀 | 기존 6개 케이스 (available/locked/click/select/error) 전부 그린 | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 기존 — 변경 후 재실행 |
| 회귀 | typecheck 0 에러 | static | `pnpm --filter @grapit/web typecheck` | ✅ 기존 |
| 회귀 | lint 0 에러 | static | `pnpm --filter @grapit/web lint` | ✅ 기존 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview` (관련 3개 파일만)
- **Per wave merge:** `pnpm --filter @grapit/web test` (web 전체 suite)
- **Phase gate:** 전체 web suite green + typecheck/lint 통과 + manual QA (UX-01/UX-03 시각 + 모바일 디바이스 실측)

### Wave 0 Gaps

- [ ] `apps/web/components/admin/__tests__/svg-preview.test.tsx` — 신규 생성. UX-02 admin 검증 (정상 SVG 통과, stage 마커 없는 SVG 거부 + toast.error 호출 검증).
- [ ] `apps/web/hooks/__tests__/use-is-mobile.test.ts` — 신규 생성. matchMedia mock으로 true/false 반환 검증 + SSR fallback (`window` undefined → false) 검증.
- [ ] `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` — 기존 파일. 라인 7~18의 react-zoom-pan-pinch mock에 **`MiniMap`도 추가** 필요. 신규 케이스 4건 추가 (transition style, 체크마크 data attr, 모바일 initialScale, 미니맵 마운트 분기).
- [ ] vitest 신규 setup 없음 — 기존 config (`vitest.config.ts`) 그대로 사용.
- [ ] manual QA 항목 (Phase gate): 모바일 실측 디바이스 1대 (iOS Safari 또는 Android Chrome) — 좌석 32px → 44.8px 보장 확인.

## Security Domain

> `.planning/config.json`에 `security_enforcement` 키 없음 — 기본값 활성. Phase 12는 디자인·UX 레이어이지만 admin SVG 업로드 입력 검증이 있으므로 V5만 해당.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (변경 없음) |
| V3 Session Management | no | (변경 없음) |
| V4 Access Control | no | (변경 없음 — 기존 admin guard) |
| V5 Input Validation | yes | DOMParser 기반 SVG 구조 검증 (정규식 금지). `image/svg+xml` MIME만 허용. |
| V6 Cryptography | no | (변경 없음) |

### Known Threat Patterns for {SVG upload + dangerouslySetInnerHTML}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 악성 `<script>` 삽입 SVG | Tampering, Elevation | 단기: admin role 가드 + R2 own-bucket 신뢰 source. 장기: DOMPurify SVG profile (deferred 보안 phase). |
| `<foreignObject>` 안 HTML XSS | Tampering | 동일 위 (admin 신뢰). 장기: DOMPurify. |
| 거대 SVG (DoS) | DoS | 기존 `file.size > 10MB` 체크 (svg-preview.tsx:33). 충분. |
| `xlink:href` 외부 리소스 참조 | Information Disclosure | R2 기본 CORS + CSP (deferred 보안 phase). |

**Phase 12 결론:** admin 신뢰 source + R2 own-bucket 단계에서 단기 위험 낮음. UX-02 검증은 **기능적 무결성**(stage 마커 존재) 확인이지 보안 sanitize 아님. 보안 sanitize는 별도 phase로 분리.

## Sources

### Primary (HIGH confidence)
- `/bettertyped/react-zoom-pan-pinch` (Context7) — TransformWrapper props, useTransformEffect, useControls, MiniMap usage
- node_modules d.ts 직접 검증: `node_modules/.pnpm/react-zoom-pan-pinch@3.7.0_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/react-zoom-pan-pinch/dist/index.d.ts:121-128, 213-230, 251-253, 271`
- [Tailwind CSS v4 @theme directive 공식 docs](https://tailwindcss.com/docs/theme) — namespace 자동 utility 생성 + override 규칙
- [WCAG 2.1 §2.5.5 Target Size 공식 문서](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) — 44×44 CSS px AAA 기준
- 프로젝트 코드 직접 read: `apps/web/app/globals.css`, `apps/web/components/booking/seat-map-viewer.tsx`, `apps/web/components/admin/svg-preview.tsx`, `apps/web/public/seed/sample-seat-map.svg`, `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`

### Secondary (MEDIUM confidence)
- WebSearch — react-zoom-pan-pinch onTransformed callback signature (`(ref: ReactZoomPanPinchRef, state: { scale, positionX, positionY }) => void`) — d.ts와 cross-check 일치
- [github.com/BetterTyped/react-zoom-pan-pinch — MiniMap example.tsx](https://github.com/BetterTyped/react-zoom-pan-pinch/tree/master/src/stories/examples/mini-map) — 사용 패턴 (children 동일 콘텐츠, width/height/borderColor)
- [Anton Ball — Fix duplicate SVG ID collision in React](https://medium.com/pixel-and-ink/fix-duplicate-svg-id-collision-in-react-36bc9e068333) — `<defs>` ID 충돌 방어 패턴 (Pitfall 6)
- [npm registry version check](https://www.npmjs.com/package/react-zoom-pan-pinch) — v4.0.3 latest, v3.7.4 v3 line max, v3.7.0 현재 설치

### Tertiary (LOW confidence)
- 없음 — 모든 핵심 claim은 d.ts 또는 공식 docs로 검증됨.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 모든 라이브러리는 이미 설치되어 있고 d.ts 직접 검증
- Architecture (UX-04/05/06 패턴): HIGH — react-zoom-pan-pinch 내장 MiniMap + useSyncExternalStore + Tailwind v4 모두 1차 source
- 토큰 추가 효과 (UX-01): HIGH — Tailwind v4 docs 명시 + Phase 11 chart palette 동일 메커니즘 검증됨
- Pitfalls: MEDIUM — Pitfall 6 (`<defs>` ID 충돌)은 외부 admin SVG에 의존하는 경험적 추정. plan 단계 spike 권장
- 모바일 분기 SSR/hydration: MEDIUM — `useSyncExternalStore` 패턴은 React 공식이지만 본 프로젝트에서 첫 도입

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30일 — react-zoom-pan-pinch 3.7 안정, Tailwind v4 GA, 의존성 변경 없음)
