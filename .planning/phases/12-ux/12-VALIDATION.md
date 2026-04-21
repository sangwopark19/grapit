---
phase: 12
slug: ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. RESEARCH.md §"Validation Architecture"에서 도출된 테스트 매핑을 PLAN.md task `<automated>` 필드와 동기화하기 위한 단일 SoT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x + @testing-library/react 16.3.x + jsdom 26.x |
| **Config file** | `apps/web/vitest.config.ts` (env: jsdom, globals: true, exclude: e2e) |
| **Quick run command** | `pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview` |
| **Full suite command** | `pnpm --filter @grapit/web test` |
| **Estimated runtime** | ~12 seconds (quick), ~45 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/web test -- seat-map-viewer use-is-mobile svg-preview` (관련 3개 파일만)
- **After every plan wave:** Run `pnpm --filter @grapit/web test` (web 전체 suite) + `pnpm --filter @grapit/web typecheck` + `pnpm --filter @grapit/web lint`
- **Before `/gsd-verify-work`:** Full suite green + manual QA (UX-01 시각, UX-03 시각, UX-06 모바일 실측 디바이스 1대) 완료
- **Max feedback latency:** 12초 (quick run)

---

## Per-Task Verification Map

> Task ID는 PLAN.md 작성 후 채움. 현재는 RESEARCH §"Phase Requirements → Test Map"에서 도출한 검증 단위.

| Verification Unit | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| `--shadow-sm`/`--shadow-md`/`--radius-md/lg/xl` 토큰 `@theme` 추가 → utility 자동 매핑 | TBD | 1 | UX-01 | — | N/A | manual + smoke | dev server 시각 비교 (`/admin/dashboard` 카드 elevation) | ❌ 자동 어려움 — manual QA | ⬜ pending |
| `prefers-reduced-motion` global `transition-duration: 0.01ms` override CSS 존재 | TBD | 1 | UX-04 (보조) | — | N/A | unit (CSS regex) | `grep -q "prefers-reduced-motion" apps/web/app/globals.css` | ✅ 검증 1줄 추가 | ⬜ pending |
| 홈 섹션 `mt-12` → `mt-10` 미세 튜닝 (HotSection/NewSection/GenreGrid) | TBD | 1 | UX-01 | — | N/A | manual + smoke | dev server 홈 시각 확인 | ❌ 자동 미적용 — manual QA | ⬜ pending |
| admin 업로드: stage 마커 없는 SVG 거부 + toast.error 호출 + R2 PUT 미발생 | TBD | 2 | UX-02 (admin) | T-12-01 입력 검증 | DOMParser 결과 기반 검증 (정규식 금지) | unit | `pnpm --filter @grapit/web test -- svg-preview` | ❌ Wave 0 — `apps/web/components/admin/__tests__/svg-preview.test.tsx` 신규 | ⬜ pending |
| admin 업로드: `<text>STAGE</text>` 또는 `[data-stage]` 포함 SVG 통과 | TBD | 2 | UX-02 (admin) | T-12-01 | 동일 위 | unit | 동일 위 | ❌ Wave 0 | ⬜ pending |
| viewer: SVG에 `[data-stage]`만 존재 시 viewBox 변에 STAGE 배지 `<g>` 오버레이 추가 | TBD | 3 | UX-02 (viewer) | — | N/A | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 기존 — 케이스 추가 | ⬜ pending |
| viewer: SVG에 `<text>STAGE</text>` 이미 존재 시 viewer no-op (idempotent) | TBD | 3 | UX-02 (viewer) | — | N/A | unit | 동일 위 | ✅ 기존 | ⬜ pending |
| 등급별 dot + 등급명 + 가격 표시 (D-10 검증만) | TBD | — | UX-03 | — | N/A | manual | dev server 시각 확인 | ❌ 자동 미적용 (D-10) | ⬜ pending |
| 선택 좌석 rect의 inline `style`에 `transition:fill 150ms` 포함 | TBD | 3 | UX-04 | — | N/A | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 케이스 추가 | ⬜ pending |
| locked/sold/available 좌석은 `transition:none` 유지 (D-13 회귀 방지) | TBD | 3 | UX-04 (회귀) | — | N/A | unit | 동일 위 | ✅ 케이스 추가 | ⬜ pending |
| 선택 시 체크마크 `<text>` 요소에 `data-seat-checkmark` 속성 부여 | TBD | 3 | UX-04 | — | N/A | unit | 동일 위 | ✅ 케이스 추가 | ⬜ pending |
| `globals.css` `@keyframes seat-checkmark-fade-in` 정의 + `data-seat-checkmark` selector 매핑 | TBD | 1 | UX-04 | — | N/A | unit (CSS regex) | `grep -q "seat-checkmark-fade-in" apps/web/app/globals.css` | ✅ 검증 1줄 추가 | ⬜ pending |
| 데스크톱(`isMobile=false`) viewer에서 `MiniMap` 컴포넌트 마운트 | TBD | 4 | UX-05 | — | N/A | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 케이스 추가 (`vi.mock('@/hooks/use-is-mobile')`) | ⬜ pending |
| 모바일(`isMobile=true`) viewer에서 `MiniMap` 미마운트 | TBD | 4 | UX-05 | — | N/A | unit | 동일 위 | ✅ 케이스 추가 | ⬜ pending |
| `useIsMobile` 훅: matchMedia(`(max-width: 767px)`) true → 반환 true | TBD | 2 | UX-06 | — | N/A | unit | `pnpm --filter @grapit/web test -- use-is-mobile` | ❌ Wave 0 — `apps/web/hooks/__tests__/use-is-mobile.test.ts` 신규 | ⬜ pending |
| `useIsMobile` 훅: SSR (`window` undefined) → false fallback | TBD | 2 | UX-06 | — | N/A | unit | 동일 위 | ❌ Wave 0 | ⬜ pending |
| `isMobile=true` 시 TransformWrapper에 `initialScale=1.4` 전달 + `key` 변경 시 재마운트 | TBD | 4 | UX-06 | — | N/A | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` (TransformWrapper mock) | ✅ 케이스 추가 | ⬜ pending |
| 모바일 실측: 32px 좌석 × 1.4 = 44.8px ≥ 44px (WCAG §2.5.5) | TBD | — | UX-06 | — | N/A | manual | iOS Safari 또는 Android Chrome 1대에서 좌석 터치 폭 측정 | ❌ 수동 측정 | ⬜ pending |
| 회귀: 기존 seat-map-viewer 6개 케이스 (available/locked/click/select/error) 전부 그린 | TBD | 3 | 회귀 | — | N/A | unit | `pnpm --filter @grapit/web test -- seat-map-viewer` | ✅ 기존 | ⬜ pending |
| 회귀: typecheck 0 에러 | TBD | wave-끝 | 회귀 | — | N/A | static | `pnpm --filter @grapit/web typecheck` | ✅ 기존 | ⬜ pending |
| 회귀: lint 0 에러 | TBD | wave-끝 | 회귀 | — | N/A | static | `pnpm --filter @grapit/web lint` | ✅ 기존 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

신규 테스트 파일 2개 + 기존 테스트 파일 mock 갱신 1개:

- [ ] `apps/web/components/admin/__tests__/svg-preview.test.tsx` — **신규 생성**. UX-02 admin 검증 (정상 SVG 통과, stage 마커 없는 SVG 거부 + `toast.error` 호출 검증, R2 PUT mock fetch 미호출 검증).
- [ ] `apps/web/hooks/__tests__/use-is-mobile.test.ts` — **신규 생성**. matchMedia mock으로 true/false 반환 검증 + SSR fallback (`window` undefined → false) 검증. `useSyncExternalStore` 마운트 동작.
- [ ] `apps/web/components/booking/__tests__/seat-map-viewer.test.tsx` — **기존 파일 갱신**. 라인 7~18의 `react-zoom-pan-pinch` mock에 **`MiniMap` export 추가** 필요. 신규 케이스 5건 추가 (transition style, 체크마크 data attr, 모바일 initialScale, 미니맵 마운트 분기, prefers-reduced-motion CSS regex).
- [ ] vitest 신규 setup/config 불필요 — 기존 `apps/web/vitest.config.ts` 그대로 재사용.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `globals.css` 토큰 추가 후 `/admin/dashboard` 카드 elevation/radius가 시각적으로 modernize | UX-01 | 시각적 톤앤매너 변화는 자동 측정 어려움. screenshot diff는 brittleness 높아 phase 12 범위 밖 | `pnpm --filter @grapit/web dev` → `/admin/dashboard` 진입 → 카드 shadow가 부드럽고 radius가 일관(8~12px) → before/after 스크린샷 1장 첨부 |
| 홈(`/`) 섹션 간 수직 리듬이 toned (mt-10) | UX-01 | 동일 위 | dev server `/` 진입 → HotSection/NewSection/GenreGrid 사이 spacing 시각 확인 |
| seat-legend dot + 등급명 + 가격 표시 (이미 구현, D-10) | UX-03 | D-10 결정 — 검증만 | dev server `/booking/{performanceId}` 진입 → legend 표시 확인 |
| 모바일 실측 디바이스에서 좌석 터치 폭 ≥ 44px (WCAG §2.5.5) | UX-06 | 실디바이스 터치 측정은 jsdom 불가 | iOS Safari 또는 Android Chrome 1대에서 booking 페이지 좌석 탭 → 인접 좌석 오탭 0회 |
| 좌석 선택 시 체크마크 fade-in 애니메이션 (150ms) 부드럽게 보임 | UX-04 | 애니메이션 timing은 시각 검증이 신뢰성 높음 | dev server에서 좌석 클릭 → 체크마크 opacity 0→1 부드러운 전환 + 다른 좌석 transition:none 유지 |
| 데스크톱에서 미니맵 viewport rect가 zoom/pan에 따라 실시간 추적 | UX-05 | UI 인터랙션 + canvas-like 렌더 | dev server에서 줌 인/아웃 + 드래그 → 미니맵 rect 동기 갱신 |
| `prefers-reduced-motion: reduce` OS 설정 시 체크마크 fade 즉시 (transition 비활성) | UX-04 (a11y) | OS 시스템 설정 의존 | macOS System Settings → Accessibility → Display → Reduce Motion ON → 좌석 클릭 시 체크마크 즉시 표시 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (svg-preview.test.tsx, use-is-mobile.test.ts, seat-map-viewer mock 갱신)
- [ ] No watch-mode flags
- [ ] Feedback latency < 12s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter (PLAN.md task ID 매핑 후)

**Approval:** pending
