---
phase: 12-ux
plan: 01

subsystem: ui
tags: [tailwindcss-v4, css-tokens, seat-map, keyframes, reduced-motion, minimalism]

# Dependency graph
requires:
  - phase: 11-admin-dashboard
    provides: "브랜드 Purple #6C3CE0 + chart palette --chart-1~5 + shadcn new-york preset + Tailwind v4 @theme 토큰 시스템 (= D-03 유지 근거)"
provides:
  - "Tailwind v4 @theme 블록 내 신규 token: --shadow-sm, --shadow-md (Linear/Vercel convention 2단 스케일)"
  - "Tailwind v4 @theme 블록 내 신규 token: --radius-sm=6px, --radius-md=8px, --radius-lg=10px, --radius-xl=12px (Minimalism 6~12px 범위)"
  - "globals.css 내 @keyframes seat-checkmark-fade-in (opacity 0→1) + @keyframes seat-checkmark-fade-out (opacity 1→0) 인프라"
  - "[data-seat-checkmark] selector (fade-in 자동 트리거, 150ms ease-out forwards)"
  - "[data-seat-checkmark][data-fading-out=\"true\"] selector (fade-out 자동 트리거, 150ms ease-out forwards)"
  - "@media (prefers-reduced-motion: reduce) override: fade-in·fade-out 둘 다 animation-duration 0.01ms"
  - "홈 파일럿 수직 리듬 toned: mt-12 → mt-10 (HotSection/NewSection/GenreGrid)"
affects: [12-02-svg-upload, 12-03-seat-map-viewer, 12-04-mobile-touch-minimap, 향후 shadcn Button/Card/Tooltip 사용처]

# Tech tracking
tech-stack:
  added: []  # 신규 dependency 없음 — 순수 토큰·CSS 추가
  patterns:
    - "Tailwind v4 @theme namespace-based token (--shadow-*/--radius-*) — JS config file 없이 CSS-first utility 자동 생성"
    - "data-attribute selector + CSS @keyframes 인프라 선행 구축 — 후속 plan은 JSX에 attribute 1줄만 추가하면 애니메이션 자동 작동 (JSX-touch 최소화)"
    - "prefers-reduced-motion override는 animation: none 대신 animation-duration: 0.01ms 사용 — fade-out 시 setTimeout(150ms) 타이밍 보존, forwards fill-mode로 종료 상태 유지"
    - "@theme 블록 안 keyframe 정의 + @theme 밖 일반 selector 정의 — Tailwind v4 Pitfall 1 회피 (namespace 외 정의는 @theme 안에 두면 무효)"

key-files:
  created: []
  modified:
    - "apps/web/app/globals.css (+46줄: @theme 블록에 6 토큰 + 2 keyframe, 외부에 2 selector + reduced-motion override)"
    - "apps/web/components/home/hot-section.tsx (1줄: mt-12 → mt-10)"
    - "apps/web/components/home/new-section.tsx (1줄: mt-12 → mt-10)"
    - "apps/web/components/home/genre-grid.tsx (1줄: mt-12 pb-12 → mt-10 pb-12)"

key-decisions:
  - "shadow 스케일은 sm+md 2단만 (D-01/D-02) — Linear/Vercel convention. shadow-lg/xl/2xl은 이후에도 미도입."
  - "radius 스케일 6/8/10/12px — 최소 6px(Badge/tooltip), 최대 12px(Dialog). 기존 --radius 단일 변수 없었음 → 충돌 0."
  - "@keyframes seat-checkmark-fade-in/fade-out을 @theme 블록 안에 배치 — 기존 @keyframes enter/exit/shake와 일관성. Tailwind v4 인식."
  - "[data-seat-checkmark] + [data-fading-out=\"true\"] selector는 @theme 블록 밖 배치 — namespace 밖 일반 CSS (Pitfall 1 회피)."
  - "reduced-motion override는 animation-duration: 0.01ms — animation: none 대신 선택·해제 둘 다 즉시 작동 + forwards fill-mode 보존."
  - "홈 미세 튜닝은 정확히 3줄 (D-04 허용 범위) — mt-12(48px) → mt-10(40px) 한 단계 toned. pb-12는 페이지 하단 여백이라 유지."
  - "기존 브랜드 컬러(--color-primary #6C3CE0), chart palette(--chart-1~5), spacing (--spacing-*), typography (--text-*) 토큰 회귀 0."

patterns-established:
  - "data-attribute + CSS keyframe 인프라 선행 구축 패턴: Plan N이 CSS 인프라를 먼저 배치하면 후속 plan은 JSX setAttribute 1줄만 추가하면 자동 작동 — 체크마크 fade-in/out이 첫 사례."
  - "forwards fill-mode + setTimeout(150ms) DOM 제거 조합 패턴: fade-out 종료 시점(opacity 0)을 CSS가 보존하고 JS가 DOM 제거 — flicker 방지."
  - "reduced-motion override는 animation-duration 0.01ms 전략 — animation: none은 forwards 상태 유실 위험, 0.01ms는 사실상 즉시 + fill-mode 보존."

requirements-completed: [UX-01, UX-04]

# Metrics
duration: ~12min
started: 2026-04-21T05:40:00Z
completed: 2026-04-21T05:52:41Z
tasks: 2
files-modified: 4
---

# Phase 12 Plan 01: Foundation Tokens Summary

**Tailwind v4 @theme에 shadow/radius 토큰 6개와 seat-checkmark fade-in/out @keyframes 인프라를 추가하고, 홈 3개 섹션의 수직 리듬을 mt-10으로 toned.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-21T05:40:00Z
- **Completed:** 2026-04-21T05:52:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `globals.css @theme` 블록에 Linear/Vercel convention의 shadow 2단 스케일(`--shadow-sm: 0 1px 2px 0 rgba(0,0,0,0.05)`, `--shadow-md: 0 4px 12px -2px rgba(0,0,0,0.08)`) + radius 4단 스케일(`--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 10px`, `--radius-xl: 12px`) 추가. Tailwind v4가 `shadow-sm`/`rounded-md` utility를 즉시 자동 생성 → shadcn 컴포넌트가 JSX 변경 0줄로 새 elevation/radius 톤을 자동 흡수.
- `globals.css @theme` 블록 안에 `@keyframes seat-checkmark-fade-in` (opacity 0→1) + `@keyframes seat-checkmark-fade-out` (opacity 1→0) 2개 keyframe 추가. UI-SPEC §Interaction 라인 240~241 요구(선택·해제 둘 다 150ms fade) 충족.
- `@theme` 블록 밖에 `[data-seat-checkmark]` selector(fade-in 트리거) + `[data-seat-checkmark][data-fading-out="true"]` selector(fade-out 트리거) + `@media (prefers-reduced-motion: reduce)` override(두 selector 모두 `animation-duration: 0.01ms`) 추가. Plan 12-03 viewer가 체크마크 `<text>` element에 `setAttribute('data-seat-checkmark', '')` (선택 시) 또는 `setAttribute('data-fading-out', 'true')` (해제 시) 한 줄만 추가하면 애니메이션 자동 작동 + reduced-motion 환경에서는 즉시 표시/즉시 제거.
- 홈 3개 섹션(HotSection/NewSection/GenreGrid) 래퍼 `<section>`의 `mt-12` → `mt-10` 변경(총 3줄). 섹션 간 수직 리듬 48px → 40px로 한 단계 toned — D-04 허용 범위(3~5줄 미세 튜닝) 내. GenreGrid는 `pb-12`(페이지 하단 여백) 유지.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode, pre-commit hook 회피):

1. **Task 1: globals.css 토큰 + seat-checkmark fade-in/out 인프라** — `a57c546` (feat)
2. **Task 2: 홈 3개 섹션 mt-12 → mt-10 미세 튜닝** — `39ec035` (style)

## Files Created/Modified

### Modified

- `apps/web/app/globals.css` (+46줄)
  - `@theme` 블록 안 line 73~81: `--shadow-sm`/`--shadow-md` + `--radius-sm`/`md`/`lg`/`xl` 총 6개 토큰.
  - `@theme` 블록 안 line 112~122: `@keyframes seat-checkmark-fade-in` + `@keyframes seat-checkmark-fade-out`.
  - `@theme` 블록 밖 line 140~163: `[data-seat-checkmark]` (animation: seat-checkmark-fade-in 150ms ease-out forwards) + `[data-seat-checkmark][data-fading-out="true"]` (animation: seat-checkmark-fade-out 150ms ease-out forwards) + `@media (prefers-reduced-motion: reduce)` 안에서 두 selector 모두 `animation-duration: 0.01ms`.

- `apps/web/components/home/hot-section.tsx` (line 19, 1줄)
  - `<section className="mt-12">` → `<section className="mt-10">`

- `apps/web/components/home/new-section.tsx` (line 15, 1줄)
  - `<section className="mt-12">` → `<section className="mt-10">`

- `apps/web/components/home/genre-grid.tsx` (line 44, 1줄)
  - `<section className="mt-12 pb-12">` → `<section className="mt-10 pb-12">`

## Decisions Made

None — 플랜에 명시된 구조/값을 그대로 따랐음. 모든 구체적 숫자값(shadow/radius/keyframe/mt-10)은 PLAN.md + UI-SPEC.md + CONTEXT.md D-01~D-12에서 이미 확정된 값.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- 워크트리 생성 직후 `node_modules`가 비어 있어서 typecheck 실행 시 `tsc: command not found` 발생. `pnpm install --frozen-lockfile`로 의존성 설치 후 재실행하여 해결. (parallel executor 환경의 정상 동작 — worktree는 새 filesystem)

## Verification Results

### globals.css 토큰/keyframe/selector 검증
- [x] `--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)` — line 74 hit
- [x] `--shadow-md: 0 4px 12px -2px rgba(0, 0, 0, 0.08)` — line 75 hit
- [x] `--radius-sm: 6px` / `--radius-md: 8px` / `--radius-lg: 10px` / `--radius-xl: 12px` — line 78~81 hit
- [x] `@keyframes seat-checkmark-fade-in` — line 113 hit (`@theme` 안)
- [x] `@keyframes seat-checkmark-fade-out` — line 119 hit (`@theme` 안)
- [x] `[data-seat-checkmark]` selector — line 147 hit (`@theme` 밖)
- [x] `[data-seat-checkmark][data-fading-out="true"]` selector — line 151 hit (`@theme` 밖)
- [x] `@media (prefers-reduced-motion: reduce)` — line 155 hit
- [x] `animation-duration: 0.01ms` — 2회 발생 (fade-in + fade-out 둘 다 reduced-motion override)

### 회귀(sentinel) 검증
- [x] `--color-primary: #6C3CE0` — 유지 (line 5) — 브랜드 Purple D-03
- [x] `--chart-1: #6C3CE0` — 유지 (line 49, 133 mirror)
- [x] `--spacing-xs: 4px` — 유지 (line 56)
- [x] `--text-display: 28px` — 유지 (line 65)
- [x] `@keyframes enter/exit/shake` — 유지

### 홈 섹션 검증
- [x] hot-section.tsx line 19: `<section className="mt-10">` (mt-12 잔존 0)
- [x] new-section.tsx line 15: `<section className="mt-10">` (mt-12 잔존 0)
- [x] genre-grid.tsx line 44: `<section className="mt-10 pb-12">` (pb-12 유지, mt-12 잔존 0)
- [x] line count 회귀 0 (47/32/69 — 변경 전 동일)

### 빌드 검증
- [x] `pnpm --filter @grapit/web typecheck` — exit 0, errors 0
- [x] `pnpm --filter @grapit/web lint` — exit 0, **0 errors / 18 warnings (모두 pre-existing, 이번 task가 수정하지 않은 파일: admin/*, auth/*, booking/*, hooks/*, eslint.config.mjs)**. 수정된 홈 섹션 3개 파일에는 warning 0. scope boundary 원칙에 따라 pre-existing warning은 수정 대상 아님.

## Self-Check

- [x] a57c546 commit 존재 — `git log --oneline` 확인
- [x] 39ec035 commit 존재 — `git log --oneline` 확인
- [x] apps/web/app/globals.css 수정됨 — grep 9개 sentinel 모두 hit
- [x] apps/web/components/home/{hot,new,genre}-*.tsx 수정됨 — mt-10 hit, mt-12 0 hit
- [x] typecheck GREEN, lint 0 errors

## Self-Check: PASSED

## Manual QA Items (Wave 4)

후속 Wave 4 manual QA gate에서 시각 검증할 항목:

1. **dev server `/` 진입:** 홈 섹션 간 수직 리듬이 toned (40px). HotSection ↔ NewSection ↔ GenreGrid 간 여백이 기존보다 8px 좁아진 것을 시각적으로 확인.
2. **dev server `/admin/dashboard` 진입:** shadcn `Card` 컴포넌트의 elevation/radius가 modernize된 톤(`--shadow-sm` + `--radius-lg`)으로 자동 반영됐는지 확인. JSX 변경 0이므로 순수하게 토큰 전파 결과.
3. **Plan 12-03 배포 후 좌석 선택 시:** 체크마크가 opacity 0→1로 150ms fade-in 됐는지 확인 (UX-04 + UI-SPEC §Interaction 240).
4. **Plan 12-03 배포 후 좌석 해제 시:** 체크마크가 opacity 1→0으로 150ms fade-out 되고 150ms 후 DOM에서 제거되는지 확인 (UI-SPEC §Interaction 241, 선택·해제 둘 다 fade 계약).
5. **OS 설정에서 reduced motion 활성화 후 좌석 선택/해제:** 애니메이션이 사실상 즉시 표시/즉시 제거되는지 확인 (UI-SPEC §Interaction 248, `animation-duration: 0.01ms`).
6. **Chrome DevTools → Rendering → Emulate CSS media → prefers-reduced-motion: reduce:** 동일하게 즉시 작동 확인.

## User Setup Required

None — no external service configuration required. 순수 CSS/Tailwind 토큰 변경 + 3줄 className 변경.

## Next Phase Readiness

- **Plan 12-02 (Admin SVG 검증):** dependency 없음 (독립 실행 가능). Wave 1 내 병렬 실행 중.
- **Plan 12-03 (seat-map-viewer 애니메이션):** 본 plan의 `[data-seat-checkmark]` + `[data-fading-out="true"]` CSS 인프라를 소비. viewer가 체크마크 `<text>`에 속성 추가만 하면 fade-in/out 자동 작동.
- **Plan 12-04 (미니맵 + 모바일):** 본 plan의 `--shadow-md` + `--radius-lg` 토큰을 미니맵 컨테이너 elevation에 사용 예정.

## Threat Flags

None — Wave 1 변경은 순수 디자인 토큰 + 정적 className 변경. 외부 입력/네트워크/auth/persistence 변경 0. plan `<threat_model>`에 명시된 대로 신규 보안 표면 없음.

---
*Phase: 12-ux*
*Plan: 01-foundation-tokens*
*Completed: 2026-04-21*
