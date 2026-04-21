# Phase 12: UX 현대화 - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Revised:** 2026-04-21 (reviews revision — D-06/D-07 unified parsing contract added per 12-REVIEWS.md HIGH concern #2)

<domain>
## Phase Boundary

전체 UI의 시각적 톤앤매너를 모던 트렌드(조여진 Minimalism)로 끌어올리고, SVG 좌석맵의 5대 사용성 결점(스테이지 방향 · 선택 애니메이션 · 미니맵 · 모바일 터치 타겟)을 해소한다. 기능/데이터 스키마/API 변경 없음 — 순수 디자인·UX 레이어 Phase.

**In scope:** UX-01~UX-06 (REQUIREMENTS.md 참조). `globals.css @theme` 토큰 조정 + 홈 파일럿 미세 튜닝 + `seat-map-viewer.tsx` 중심의 좌석맵 5개 UX 개선.

**Out of scope (deferred):** 대대적 컴포넌트 재작성, 브랜드 컬러 교체, Motion-forward 전체 도입, 다크모드, 햅틱(UX-07), 인라인 SVG 편집기.

</domain>

<decisions>
## Implementation Decisions

### UX-01 디자인 현대화 범위+방향
- **D-01:** **작업 범위는 `apps/web/app/globals.css` `@theme` 토큰 레벨만.** shadow/radius/spacing/모션 스케일을 모던하게 조정. `Button`/`Card`/`Badge` 사용처는 JSX 변경 없이 토큰이 자연스럽게 전파되도록 한다. 기존 컴포넌트 API 표면 변경 금지.
- **D-02:** **디자인 방향 = 조여진 Minimalism.** Linear/Vercel 계열. 엄격한 whitespace, radius 8~12px 범위, shadow는 sm/md만(`0 1px 2px` / `0 4px 12px` 강도), purple 액센트는 메인 CTA/링크/focus ring에만 집중적 사용. Grapit "신뢰·안정감" 코어 밸류(`docs/04-UIUX-GUIDE.md` §1.3) 유지.
- **D-03:** **브랜드 Purple `#6C3CE0` 그대로 유지.** Phase 11에서 확립된 chart palette(`--chart-1~5`)와 admin 대시보드 monochromatic 확장이 호환되어야 함. 변경 시 Phase 11 산출물 전체 재작업 필요 → 유지가 안전.
- **D-04:** **홈(`apps/web/app/page.tsx` + `components/home/*`)이 파일럿 페이지.** 토큰만 적용 시 효과를 가장 먼저 체감하는 곳. 여기에 한해 **토큰으로 해결 안 되는 3~5줄 수준의 성형**(카드 간격, hero spacing, section 제목 위계 등) 허용. 새 컴포넌트 추가나 구조 재편은 금지 — `HotSection`/`NewSection`/`GenreGrid` 유지.
- **D-05:** 상세/예매/마이페이지/어드민은 **토큰 전파만** 받음. 파일럿 결과로 추가 작업이 필요하면 별도 phase로 분리.

### UX-02 스테이지 방향 표시
- **D-06:** **스테이지 정보 소스 = SVG 내부 `data-stage` 속성 + `<text>STAGE</text>` fallback.** admin 업로드 파이프라인에서 신규 SVG는 `data-stage="top|right|bottom|left"` 속성을 가진 요소 또는 stage 영역 marker 존재를 검증. 기존 sample-seat-map.svg처럼 `<text>STAGE</text>`가 있는 SVG는 자동 통과.
- **D-07:** **뷰어 렌더링 전략:** viewer는 먼저 SVG 내 `<text>STAGE</text>` / `[data-stage]`를 파싱해 방향을 결정. SVG에 이미 스테이지 시각 요소가 있으면 그대로 렌더. 없고 `data-stage` 속성만 있는 경우 viewer가 viewBox 기준 해당 변(top/right/bottom/left)에 회색 배지("🎤 STAGE" 또는 간결한 무대 마커)를 오버레이.
- **D-06/D-07 UNIFIED PARSING CONTRACT (reviews revision 2026-04-21):**
  - **파싱 소스:** admin 검증 + viewer 렌더링 모두 `doc.querySelector('[data-stage]')`를 사용하여 root `<svg>` *또는 그 어떤 descendant* 중 첫 번째로 발견되는 `data-stage` 속성 요소의 값을 읽는다. 즉 `<svg><g data-stage="top">`처럼 자손에 위치해도 동일하게 인식된다.
  - **Enum 검증:** 읽힌 값은 반드시 `top | right | bottom | left` 중 하나여야 한다. admin은 enum 위반 시 구체 toast로 거부, viewer는 invalid value를 default top으로 fallback하되 admin 단계에서 이미 걸러진다는 전제.
  - **Why:** 12-REVIEWS.md Codex HIGH concern #2 — admin이 descendant `[data-stage]`를 통과시켰는데 viewer가 root-only로 읽으면 UX-02 silently fails. unified contract로 해결.
- **D-08:** **기존 SVG 호환:** `<text>STAGE</text>` 파싱이 1차 소스. 기존 업로드 데이터 migration 불필요. 신규 admin 업로드만 `data-stage` OR `<text>STAGE</text>` 둘 중 하나 필수 검증.
- **D-09:** DB 스키마(performances/seatMapConfig) 변경 없음. stage 정보는 SVG 파일에 완전히 위임.

### UX-03 등급 색상 + 가격 (이미 구현됨 — 검증만)
- **D-10:** `apps/web/components/booking/seat-legend.tsx`가 이미 dot(색상) + 등급명 + "N,NNN원" 표시. **Phase 12에서 신규 작업 없음**, 토큰 반영 후 시각 확인만 수행. UX-03은 검증 항목.

### UX-04 좌석 선택 애니메이션
- **D-11:** **테크닉 = 선택/해제 좌석에만 transition.** `seat-map-viewer.tsx`의 `style="transition:none"` 정책은 유지하되, `selectedSeatIds` 차이만큼에 한해 transition을 켠다. 수백 좌석 동시 재렌더 성능 리스크 방지.
- **D-12:** **피드백 = 체크마크 fade-in + fill 전환 (duration 150ms).** 현재 `seat-map-viewer.tsx:91-120`의 체크마크 삽입 로직 재활용. 체크마크 `<text>`의 `opacity` 0→1 (CSS transition 또는 SMIL `<animate>`), 선택 좌석 rect의 `fill` transition도 150ms. scale 펄스/glow는 미도입 (transform-origin 복잡도, 좌석 오버랩 위험).
- **D-13:** **실시간 broadcast는 애니메이션 없음.** 타 사용자의 좌석 잠금/해제로 생성되는 `seatStates` 변화는 `transition:none` 유지 — flick 방지 + 다량 동시 플립 방지. 로컬 사용자의 명시적 선택/해제만 애니메이션 대상.
- **D-13 CLARIFICATION (reviews revision 2026-04-21):** 선택한 좌석이 broadcast로 `locked`/`sold`로 전환되는 경우, D-13이 UX-04 선택 transition보다 우선한다. viewer의 fill transition useEffect는 `seatStates.get(seatId)`가 `locked` 또는 `sold`이면 primary 색으로 전환하지 않고 LOCKED 색 유지 + transition 스킵. 12-REVIEWS.md Codex MED concern #4.

### UX-05 미니맵 네비게이터
- **D-14:** **형태 = 축소 SVG 복제 + viewport rect 오버레이.** `processedSvg`를 그대로 `width: 120px, height: auto`로 2번째 인스턴스로 렌더 + `TransformWrapper`의 `positionX/Y/scale`을 `onTransformed` 콜백으로 받아 현재 보이는 영역을 빨간 stroke rect로 그린다. 실시간 seat state 변화도 자동 반영.
- **D-14 IMPLEMENTATION NOTE (reviews revision 2026-04-21):** 실제 구현은 `react-zoom-pan-pinch@3.7.0`의 내장 `MiniMap` export를 사용하여 D-14의 "축소 SVG 복제 + viewport rect"를 라이브러리가 제공하도록 위임한다. 단, 라이브러리 MiniMap의 실제 렌더링 + viewport rect 동기화가 D-14 의도대로 작동하는지를 **Wave 3 ↔ Wave 4 사이의 dev-server smoke test gate**로 한 번 수동 확인한다 (12-REVIEWS.md Codex MED concern #5). 실패 시 D-14 원안(수동 SVG 복제)으로 fallback.
- **D-15:** **위치 = 데스크톱 좌상단 고정(absolute).** 우측 하단/상단은 zoom 컨트롤과 tooltip이 이미 사용 중. 좌상단이 충돌 없음. `position: absolute; top: 12px; left: 12px; z-index: 40`.
- **D-16:** **모바일(< md breakpoint)에서는 숨김.** 화면 좌우 폭 부족, 모바일은 `initialScale=1.4`(D-18)로 이미 충분한 터치 가용성 확보. 추후 필요 시 상단 토글 버튼 도입 검토(deferred).

### UX-06 모바일 44px 터치 타겟
- **D-17:** **전략 = 모바일 자동 초기 줌 1.4x.** breakpoint `< md`(768px 미만)에서 `TransformWrapper initialScale`을 1.4로 적용. 32x32 좌석 → 44.8x44.8 렌더. 데스크톱은 기존대로 `initialScale=1`.
- **D-18:** 사용자의 수동 zoom-out은 허용 (`minScale` 0.5 유지). 최소 터치 타겟 "기본값 보장"이 목표.
- **D-19:** **SVG 파일/DB 스키마 변경 없음, admin 업로드 검증 변경 없음.** UX-02만 admin 검증을 추가하고 UX-06은 순수 뷰어 레벨 대응. Hit-area overlay rect 방식은 SVG 복잡도 증가 + 기존 tooltip 로직 간섭으로 불채택.
- **D-19 SECURITY DEBT NOTE (reviews revision 2026-04-21):** Admin SVG upload 검증은 현재 **클라이언트 전용**이다. Admin 계정 탈취 또는 API 우회 시 악성 SVG가 R2 + `dangerouslySetInnerHTML`로 렌더될 잠재 위험이 있음. MVP에서는 accept하되 별도 security phase에서 서버측 re-validation + DOMPurify SVG profile 도입을 예정. 12-REVIEWS.md Codex LOW concern #9. 본 tech-debt는 Plan 12-04 SUMMARY에 footnote로 기록한다.

### Claude's Discretion
- `globals.css @theme`의 구체적 shadow/radius/spacing 숫자값 — Minimalism 방향 안에서 researcher/planner 재량 (참고: shadow sm=`0 1px 2px rgba(0,0,0,0.05)`, md=`0 4px 12px rgba(0,0,0,0.08)`, radius 기본 10px, 카드 12px 등이 출발점).
- 스테이지 배지 오버레이(D-07)의 정확한 마크업/폰트/색상 — UI-SPEC/UI-phase에서 확정.
- 체크마크 fade-in 구현 방식: CSS `transition: opacity 150ms` vs SMIL `<animate attributeName="opacity">` — 둘 다 성능 프로파일 유사, planner가 기존 DOM 삽입 패턴과 맞춰 선택.
- 미니맵 viewport rect 색상 — 브랜드 Purple 10~20% 또는 `--color-primary` stroke 2px가 자연스러움.
- 홈 파일럿 미세 튜닝의 정확한 3~5줄 범위 — planner가 토큰 반영 결과 검토 후 결정.
- 모바일 breakpoint 감지 방식 (Tailwind `md` 미만 미디어 쿼리 vs `window.matchMedia` 훅) — 기존 코드 관습에 맞춰 planner 재량.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항 · 프로젝트 계약
- `.planning/ROADMAP.md` §"Phase 12: UX 현대화" — Goal + Success Criteria 5개 + UI hint=yes
- `.planning/REQUIREMENTS.md` §"UX 현대화" — UX-01~UX-06 원문 + Traceability
- `.planning/REQUIREMENTS.md` §"v2 Requirements" §"UX 추가" — UX-07(햅틱) 제외 확정
- `.planning/PROJECT.md` §"Key Decisions" — SVG 좌석맵 MVP 포함/react-zoom-pan-pinch 결정, Admin /admin 라우트, 1인 개발 원칙

### 직전 페이즈 결정 (계승)
- `.planning/phases/11-admin-dashboard/11-CONTEXT.md` — Brand Purple #6C3CE0, shadcn Chart CSS variables, monochromatic palette 확립 근거(= D-03 브랜드 유지 근거)
- `.planning/phases/11-admin-dashboard/11-UI-SPEC.md` (있다면) — Phase 11에서 확정된 shadow/radius 샘플 (Minimalism 방향의 출발점)

### 설계 참조
- `docs/04-UIUX-GUIDE.md` §1 "디자인 원칙" — 콘텐츠 우선/원스톱/신뢰와 안정감/발견의 즐거움 4대 철학 (= Minimalism 방향 정당화)
- `docs/04-UIUX-GUIDE.md` §2 "디자인 토큰" — 기존 스페이싱 4px base/타이포 스케일 (토큰 조정 시 기반)
- `docs/04-UIUX-GUIDE.md` §3.5 "SeatMap" — 기존 기대 동작(등급 색상, 선택/점유/잠금 상태, 핀치 줌/드래그, 사이드 패널)
- `docs/04-UIUX-GUIDE.md` §5.1 "좌석 선택 UX" — 5단계 플로우 기준 (애니메이션 도입 시 참조)
- `docs/04-UIUX-GUIDE.md` §6 "접근성" — WCAG 2.1 AA 기준 (좌석 배치도 `role="grid"` / `aria-label` 패턴 유지)

### 기존 코드 (수정·재사용 지점)
- `apps/web/app/globals.css` — **D-01 주요 수정 대상**. `@theme` 블록의 shadow/radius/spacing/motion 토큰 업데이트
- `apps/web/app/page.tsx` + `apps/web/components/home/{banner-carousel,hot-section,new-section,genre-grid}.tsx` — **홈 파일럿 대상 (D-04)**. 미세 튜닝만 허용
- `apps/web/components/booking/seat-map-viewer.tsx` — **UX-02/04/05/06 주요 수정 대상**. 스테이지 오버레이, 체크마크 fade-in, 미니맵 복제, 모바일 initialScale 분기. 특히 line 68-147 processedSvg useMemo, line 276-303 TransformWrapper 블록
- `apps/web/components/booking/seat-map-controls.tsx` — 변경 없음 (좌하단 배치 그대로)
- `apps/web/components/booking/seat-legend.tsx` — **UX-03 이미 구현 완료**. 토큰 반영 시각 확인만
- `apps/web/public/seed/sample-seat-map.svg` — 스테이지 마커 참조 형식(`<text>STAGE</text>`), 좌석 rect 32x32 표본 (모바일 1.4x 당위성 근거)
- `apps/web/components/admin/tier-editor.tsx` / `apps/web/components/admin/svg-preview.tsx` — **UX-02 SVG 업로드 검증 추가 지점**. `data-stage` 또는 `<text>STAGE</text>` 존재 확인
- `apps/api/src/modules/performance/*` (SVG 업로드 API 영역) — 서버 측 SVG 검증 추가 여부는 planner 재량 (클라이언트 검증만으로 충분할 수도 있음)

### 외부 문서 (researcher 단계)
- react-zoom-pan-pinch docs — https://prc5.github.io/react-zoom-pan-pinch/ (TransformWrapper onTransformed/positionX/Y/scale 구독, `initialScale`/`minScale`/`maxScale`)
- Tailwind CSS v4 `@theme` — https://tailwindcss.com/docs/functions-and-directives#theme (CSS-first token 재정의)
- WCAG 2.1 §2.5.5 Target Size — 44x44 CSS px 최소 터치 타겟 근거
- SMIL `<animate>` vs CSS transition (SVG element) — MDN SVG 애니메이션 가이드 (D-12 구현 선택)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`globals.css @theme` 토큰 시스템**: 이미 `--color-*`, `--spacing-*`, `--text-*`, `--animate-*` 분류 확립. 추가 토큰은 같은 블록에 삽입만 하면 shadcn/ui가 자동 소비.
- **`seat-map-viewer.tsx` processedSvg useMemo**: 선택/해제 시점에 체크마크 삽입/제거 로직 이미 있음 (line 91-120). D-12 fade-in은 여기 `opacity: 0` + `transition: opacity 150ms` 추가로 완결.
- **`seat-map-viewer.tsx` tooltipRef hover 피드백**: 이미 refs 기반(state 미사용) 성능 안전 패턴 확립. 미니맵도 같은 패턴(ref + onTransformed) 적용 가능.
- **`seat-legend.tsx`**: UX-03 완료. Phase 12에서 재작업 없음.
- **`sample-seat-map.svg`**: `<text>STAGE</text>` 표준 포맷 참조 샘플.

### Established Patterns
- **Tailwind v4 CSS-first 토큰**: JS config 없이 `@theme` 블록만 조정하면 전역 전파 (Phase 11에서 확립).
- **Brand Purple #6C3CE0 monochromatic**: Phase 11 chart palette(`#6C3CE0`/`#8B6DE8`/`#B8A3EF`) + 어드민 대시보드 확장. Phase 12도 이 체계 존중.
- **성능 민감 영역은 refs + 수동 DOM 조작**: `seat-map-viewer.tsx`가 확립한 패턴 (dangerouslySetInnerHTML + 이벤트 위임 + ref-based tooltip). 애니메이션/미니맵도 React re-render 최소화 원칙 유지.
- **aria-label 한글 명명 규약**: "좌석 배치도", "확대/축소/전체 보기" 등. 미니맵도 "좌석 미니맵" 등 한글 aria-label.

### Integration Points
- **`TransformWrapper`**: initialScale 모바일 분기 진입점(D-17). `onTransformed` 콜백으로 미니맵 state 공급(D-14).
- **Admin SVG 업로드 flow**: `tier-editor.tsx`/`svg-preview.tsx`에 검증 훅 추가(D-06/D-08). 기존 SVG는 통과, 신규만 강제.
- **Tailwind `md` breakpoint**: D-17 모바일 분기 기준. `useMediaQuery` 훅 또는 CSS media query 중 하나 선택.
- **`@theme` scale 업데이트**: D-01 주 작업. 기존 `--color-*` 토큰은 유지 + shadow/radius 신규/갱신.

</code_context>

<specifics>
## Specific Ideas

- "브랜드 Purple을 유지하면서 Linear/Vercel 느낌을 내려면 whitespace 증가 + 카드 subtle border만 있으면 거의 나옴. 과한 shadow/gradient는 오히려 구식 느낌."
- "sample SVG처럼 `<text>STAGE</text>`가 이미 있으면 viewer는 건드릴 게 없고, 없는 SVG를 admin이 올릴 때만 거부하면 된다."
- "실시간으로 다른 관객이 좌석 점유해서 회색으로 바뀌는 걸 fade로 보여주면 '내가 뺏긴 건가?' 혼란 유발 — 즉시 전환이 심리적으로도 옳다."
- "미니맵은 공연장이 커질수록 필요. 지금 sample은 10x10 좌석이라 미니맵 없이도 다 보이지만, 올림픽공원 체조경기장 같은 대형 공연장이 들어오면 필수."
- "모바일 `initialScale=1.4`가 가장 우아한 44px 보장 방식 — SVG는 건드리지 않고 뷰어가 알아서 처리."
- "UX-01 전면 개편은 Phase 12 범위 넘김. 토큰만 당기고 홈에서 효과 검증 → 필요하면 v1.2에서 페이지별 확장."

</specifics>

<deferred>
## Deferred Ideas

- **상세/예매/마이페이지 개별 페이지 재디자인** — 토큰 전파 결과 보고 v1.2에서 phase 분할
- **Motion-forward 대규모 도입 (framer-motion 전환/스크롤 릴링)** — 성능/배터리/구현 복잡도 근거로 Phase 12 out
- **Bento Grid/Asymmetric 레이아웃** — 브랜드 일관성 흐림 우려로 Phase 12 out, 정체성 확립 후 재검토
- **다크모드** — PROJECT.md Out of Scope 명시, 토큰은 CSS variable 기반이라 도입 path는 열려 있음
- **Scale 펄스 / Glow ring 애니메이션** — transform-origin/overlap 복잡도, Phase 12는 fade-in만
- **미니맵 모바일 토글 버튼** — 일단 숨김, 공연장 규모 커지면 재검토
- **Hit-area invisible overlay rect (UX-06 대안)** — SVG 복잡도 증가로 미채택, 모바일 자동 줌으로 해결
- **SVG 업로드 서버 측 검증** — 클라이언트 검증만으로 MVP 충분, 악성 SVG 대응은 보안 phase로 분리 가능 (D-19 tech-debt 연동)
- **관리자가 stage 위치를 별도 지정 (DB 컬럼 stagePosition)** — SVG 자체가 SoT, 스키마 단순화 우선
- **햅틱 피드백 (UX-07)** — v2 이전 완료
- **공연 목록 Swiper 변경 / 캐러셀 재설계** — Phase 12 out, 필요 시 별도 phase
- **접근성 전면 오딧 (스크린리더 테스트, 키보드 좌석 이동 방향키 도입)** — v2 또는 보안/QA phase에서 별도 처리
- **어드민 SVG 업로드 에디터 / 인라인 편집기** — PROJECT.md Out of Scope

</deferred>

---

*Phase: 12-ux*
*Context gathered: 2026-04-21*
*Reviews revision: 2026-04-21 — D-06/D-07 unified parsing contract, D-13 broadcast priority clarification, D-14 MiniMap smoke test gate, D-19 security debt note*
