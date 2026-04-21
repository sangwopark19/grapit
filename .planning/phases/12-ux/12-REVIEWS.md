---
phase: 12
reviewers: [codex]
reviewed_at: 2026-04-21T05:06:33Z
plans_reviewed:
  - 12-00-test-scaffolding-PLAN.md
  - 12-01-foundation-tokens-PLAN.md
  - 12-02-hook-and-admin-validation-PLAN.md
  - 12-03-viewer-core-changes-PLAN.md
  - 12-04-regression-and-manual-qa-PLAN.md
skipped_reviewers:
  - claude (self — running inside Claude Code)
  - cursor (authentication required — `cursor agent login` or CURSOR_API_KEY not configured)
  - gemini (CLI not installed)
  - opencode (CLI not installed)
  - qwen (CLI not installed)
  - coderabbit (CLI not installed)
---

# Cross-AI Plan Review — Phase 12 (UX 현대화)

> Note: 이번 리뷰는 Codex 단독 실행. Cursor는 CLI 인증이 필요해 실패했으며, Gemini 등 다른 CLI는 미설치.
> 따라서 "Consensus" 섹션은 단일 리뷰어 분석으로, 재실행 시 Cursor 로그인 후 보강 가능.

---

## Codex Review

### 1. Summary (요약)

전체적으로 Phase 12 계획은 요구사항 UX-01~UX-06과 Success Criteria 5개를 잘 추적하고 있습니다. Wave 0에서 테스트를 먼저 깔고, Wave 1 토큰, Wave 2 hook/admin 검증, Wave 3 viewer 핵심 UX, Wave 4 회귀/manual QA로 나눈 전략도 합리적입니다. 특히 Tailwind v4 token 전파, `react-zoom-pan-pinch` 네이티브 `MiniMap` 활용, 모바일 `initialScale=1.4`, 클라이언트 admin SVG 검증 등은 범위를 작게 유지하려는 1인 개발 제약과 잘 맞습니다. 다만 `seat-map-viewer.tsx`의 `pendingRemovals`/`useEffect` 기반 transition 설계는 race condition 가능성이 있고, `data-stage` 검증과 viewer 처리 간 불일치가 있어 실행 전 보완이 필요합니다.

### 2. Strengths (강점)

- Wave 분할이 명확합니다. 테스트 scaffold → foundation → hook/admin → viewer → QA 순서가 이해하기 쉽습니다.
- TDD 흐름이 좋습니다. Wave 0에서 `svg-preview`, `use-is-mobile`, `seat-map-viewer`, `prefixSvgDefsIds` 테스트를 선행하는 방식은 회귀 방지에 효과적입니다.
- UX-01 범위를 `globals.css @theme` token 중심으로 제한한 점이 좋습니다. 대규모 JSX 재작성 없이 shadcn/ui 전체 톤을 개선할 수 있습니다.
- `MiniMap`을 직접 구현하지 않고 라이브러리 export를 활용하려는 선택은 유지보수 부담을 줄입니다.
- `useSyncExternalStore` 기반 `useIsMobile` 설계는 SSR fallback을 명시해 hydration 위험을 인식하고 있습니다.
- Wave 4 manual QA가 reduced-motion, mobile 실기기, hydration warning, broadcast 즉시 전환까지 포함해 자동 테스트의 한계를 잘 보완합니다.

### 3. Concerns (우려 사항)

- **[HIGH] `pendingRemovals` race condition** — Plan 12-03 Task 2의 `prevSelectedRef`/`pendingRemovals`/`setTimeout(160)` 설계는 빠른 재선택에서 깨질 수 있습니다. 예를 들어 A 좌석 해제 후 160ms 안에 다시 선택하면 cleanup이 timeout을 취소하고 `pendingRemovals`에서 A를 제거하지 않아, 선택된 좌석 체크마크가 `data-fading-out="true"` 상태로 남을 수 있습니다. 여러 좌석을 짧은 간격으로 해제해도 기존 pending removal이 새 Set으로 덮일 가능성이 있습니다.

- **[HIGH] admin 검증과 viewer stage 파싱 불일치** — Plan 12-02는 `doc.querySelector('[data-stage]')`로 root 또는 자손의 `data-stage`를 모두 허용합니다. 하지만 Plan 12-03 Task 2 viewer는 `svgEl.getAttribute('data-stage')`만 읽습니다. 즉 `<g data-stage="top">` 같은 SVG는 admin에서 통과하지만 viewer에서는 STAGE overlay가 생성되지 않습니다. UX-02 실패 가능성이 있습니다.

- **[MED] `data-stage` 값 검증 부재** — admin 검증은 `[data-stage]` 존재만 확인하고 `top|right|bottom|left` 값인지 확인하지 않습니다. viewer는 invalid value를 default top으로 처리합니다. 잘못된 SVG가 조용히 통과하면 stage 방향이 틀리게 표시됩니다.

- **[MED] `MiniMap` 실제 동작 검증이 부족함** — Plan 12-03은 내장 `MiniMap`에 `processedSvg` children을 넘기지만, 실제 viewport rect 동기화가 D-14의 "축소 SVG 복제 + viewport rect"와 완전히 일치하는지는 unit test mock으로 검증되지 않습니다. Wave 4 manual QA가 있긴 하지만, 구현 전 라이브러리 실제 렌더 contract를 한 번 더 확인하는 게 안전합니다.

- **[MED] `useEffect` fill transition이 locked/sold 상태를 덮을 수 있음** — Plan 12-03 Task 3의 fill transition effect는 `selectedSeatIds`만 보고 `#6C3CE0`으로 변경합니다. 만약 stale selected seat가 `locked`/`sold`로 바뀐 경우, D-13의 "broadcast 즉시 회색 전환"을 침해할 수 있습니다. 현재 테스트도 "locked + selected" 조합은 커버하지 않습니다.

- **[MED] Wave 0 RED 테스트가 typecheck를 깨뜨릴 가능성** — `prefix-svg-defs-ids.test.ts`는 아직 없는 `../prefix-svg-defs-ids`를 top-level import합니다. TypeScript/Vitest 설정에 따라 suite registration 전에 import failure가 나거나 typecheck가 실패할 수 있습니다. Plan은 Wave 0에서도 typecheck 0을 요구하므로 모순 가능성이 있습니다.

- **[MED] client-only admin SVG 검증은 UX 검증으로는 충분하지만 보안 검증은 아님** — D-19로 서버 검증을 deferred한 판단은 MVP 관점에서 이해됩니다. 다만 이 앱은 SVG를 `dangerouslySetInnerHTML`로 렌더하므로, admin 계정 탈취나 API 우회 시 악성 SVG/XSS 위험이 남습니다. 최소한 별도 security debt로 명시해야 합니다.

- **[LOW] `prefixSvgDefsIds` regex escape 자체는 안전하지만 coverage가 제한적** — `oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`는 regex meta escape로 적절합니다. 다만 `url("#id")`, `url('#id')`, `href="#id"`, `xlink:href="#id"`는 치환하지 않습니다. 일반 gradient/pattern fill은 커버하지만 SVG defs 참조 전체를 커버하지는 않습니다.

- **[LOW] 큰 SVG parse가 main thread를 잠시 막을 수 있음** — `file.text()`는 async지만 `DOMParser.parseFromString`은 동기입니다. 10MB SVG까지 허용하므로 admin 화면에서 짧은 freeze가 생길 수 있습니다. admin-only라 severity는 낮지만 로딩 상태와 try/catch는 필요합니다.

- **[LOW] viewBox parsing이 제한적임** — Plan 12-03 STAGE overlay는 `viewBox`를 whitespace split만 하고 minX/minY를 무시합니다. comma-separated viewBox나 `viewBox="-100 -50 800 600"`에서 배지 위치가 어긋날 수 있습니다.

### 4. Suggestions (개선 제안)

- `pendingRemovals`는 Set 하나와 단일 timeout 대신 per-seat timeout/ref map으로 바꾸세요. 해제 좌석은 merge하고, 재선택된 좌석은 즉시 pending에서 제거해야 합니다. `prevSelectedRef.current`는 diff 계산 직후 항상 현재 Set으로 갱신하는 편이 안전합니다.

- admin과 viewer의 stage 파싱 contract를 맞추세요. viewer도 `const stageEl = doc.querySelector('[data-stage]')`를 사용하고, `stageEl?.getAttribute('data-stage')` 값을 읽어야 합니다. admin에서는 값이 `top|right|bottom|left` 중 하나인지 검증하세요.

- `selectedSeatIds` transition effect에서 `seatStates.get(seatId)`가 `locked` 또는 `sold`이면 skip하거나 회색 상태를 우선하도록 하세요. 추가 테스트로 "selected + locked 상태는 transition 없이 locked color 유지" 케이스를 넣는 것이 좋습니다.

- Wave 0의 missing module import 문제를 정리하세요. `prefixSvgDefsIds` 테스트는 dynamic import로 바꾸거나, Wave 0에서 production stub 파일을 만들고 구현은 Wave 3에서 채우는 방식이 typecheck와 RED 전이를 더 안정적으로 만듭니다.

- `MiniMap`은 실제 browser smoke test를 Wave 3 직후에 한 번 넣는 것이 좋습니다. 최소한 `react-zoom-pan-pinch` 실제 `MiniMap`이 children SVG를 렌더하고 viewport rect를 갱신하는지 dev server에서 확인한 뒤 Wave 4로 넘기세요.

- `prefixSvgDefsIds`는 `url(["']?#id["']?)`와 `href="#id"`/`xlink:href="#id"`까지 커버하면 더 견고합니다. 현재 MVP 범위에서는 low risk지만 helper 이름이 일반 목적처럼 보이므로 coverage를 명확히 하세요.

- `handleSvgUpload`의 `file.text()`/`DOMParser` 검증도 try/catch 안에 넣어 parse/read 실패 시 기존 업로드 실패 toast 또는 별도 SVG 형식 오류 toast를 보여주세요.

### 5. Risk Assessment (전체 리스크 등급)

**MEDIUM**

계획 구조와 테스트 전략은 탄탄하지만, 핵심 UX인 좌석 선택 animation 쪽에 race condition이 있고, stage marker contract 불일치가 실제 UX-02 실패로 이어질 수 있습니다. 이 두 가지를 고치면 전체 리스크는 LOW에 가까워집니다.

### 6. Go/No-Go Verdict

**GO with fixes**

실행 전 최소 수정 권장 항목은 다음입니다.

- `pendingRemovals` race condition 보완
- admin/viewer `data-stage` 파싱 일치 및 값 검증
- `selected + locked/sold` 조합 회귀 테스트 추가
- Wave 0 missing import/typecheck 전이 방식 정리
- `MiniMap` 실제 렌더 contract 확인 절차 추가

---

## Consensus Summary

단일 리뷰어(Codex) 결과이므로 공식적인 "consensus"는 아니지만, Codex가 짚은 HIGH/MED 우려 중 **독립적으로 재현 가능한 객관적 갭**을 우선 순위로 정리합니다.

### Agreed Strengths

- Wave 0 → 4 분할 구조 + TDD 흐름이 명확하고, 회귀 가드가 탄탄함.
- UX-01을 `@theme` 토큰 레벨로 제한한 scope control 결정.
- 라이브러리 네이티브 `MiniMap` 활용으로 신규 컴포넌트 파일 0개 달성.
- `useSyncExternalStore` + `getServerSnapshot` named export로 SSR fallback을 명시한 설계.
- Wave 4 manual QA가 reduced-motion/실기기/hydration 커버.

### Agreed Concerns (실행 전 해결 권장)

순위는 plan 실행 리스크 + 실제 사용자 경험 타격도 기준.

1. **[HIGH] `pendingRemovals` race condition (12-03)** — 빠른 해제 → 재선택 시 체크마크 `data-fading-out` stuck / 다중 좌석 해제 시 pendingSet overwrite 가능성.
2. **[HIGH] admin/viewer `data-stage` 파싱 contract 불일치 (12-02 vs 12-03)** — admin은 descendant `[data-stage]` 허용, viewer는 root `svgEl.getAttribute` 전용. `<g data-stage>` 형태 SVG가 admin 통과 후 viewer에서 오버레이 생성 안 됨 → UX-02 기본 실패 경로.
3. **[MED] `data-stage` 값 검증 부재 (12-02)** — `top|right|bottom|left` enum 체크 없이 통과.
4. **[MED] selected + locked/sold 조합 미테스트 (12-03)** — `useEffect` fill transition이 broadcast 즉시 회색 전환(D-13)을 덮을 가능성.
5. **[MED] Wave 0 missing-module import의 typecheck 전이 (12-00)** — `prefix-svg-defs-ids.ts` 파일 부재 상태에서 top-level import 사용 시 CI typecheck가 Wave 0 단계에서 실패할 수 있음.

### Divergent Views

단일 리뷰어이므로 divergence 없음. 향후 Cursor 인증 후 재실행 시 비교 기준으로 이 섹션을 활용.

---

## Action Items Before Execution

Planner/executor가 실행 전 점검할 구체 수정 사항:

- [ ] **12-03 Task 2 — `pendingRemovals` 재설계:** `Map<string, number>` (seatId → timeoutId) 또는 per-seat ref로 변경. 재선택 시 기존 timeout `clearTimeout` + pending에서 즉시 제거. `prevSelectedRef` 업데이트 타이밍을 diff 직후로 이동.
- [ ] **12-02 Task 2 + 12-03 Task 2 — stage 파싱 contract 통일:**
  - admin: `doc.querySelector('[data-stage]')` + 값이 `top|right|bottom|left` 중 하나인지 enum 검증.
  - viewer: 동일하게 `doc.querySelector('[data-stage]')` 사용 (root svgEl 한정 제거).
  - 12-CONTEXT.md D-06/D-07에 "파싱 소스는 `[data-stage]` 전역 descendant 검색 + enum 검증" 한 줄 추가.
- [ ] **12-00 Task 3 + 12-03 — selected+locked 회귀 케이스 추가:** 선택 좌석이 broadcast로 locked 전환될 때 fill이 locked color로 유지되고 transition이 적용되지 않는 테스트 1개.
- [ ] **12-00 Task 4 — `prefix-svg-defs-ids.test.ts` RED 전이 전략 결정:** (a) dynamic import로 변경 or (b) Wave 0에서 production stub 파일 생성(빈 export) 후 Wave 3에서 채움. 현재 top-level static import는 CI typecheck 정책과 모순될 수 있음.
- [ ] **12-04 또는 신규 태스크 — `MiniMap` smoke test:** Wave 3 직후 dev server에서 실제 `react-zoom-pan-pinch` `MiniMap` rendering + viewport rect 동작을 수동 확인 후 Wave 4 진입.
- [ ] **12-02 Task 2 — `handleSvgUpload` try/catch + loading state:** `file.text()` + `DOMParser` 블록을 try/catch로 감싸고, parse 실패 시 별도 toast. 10MB 큰 SVG 처리 중 잠시 버튼 disabled.
- [ ] **12-03 Task 2 — STAGE overlay viewBox min-x/min-y 반영:** `viewBox="-100 -50 800 600"` 케이스에서도 배지가 올바른 변에 오도록 `split(/[\s,]+/)` 후 `[minX, minY, width, height]` 모두 사용.
- [ ] **PROJECT.md 또는 docs/ — admin 계정 탈취 시 SVG XSS debt 명시:** D-19 deferred server validation은 유지하되, 별도 security debt 항목으로 추적.
- [ ] **12-03 — `prefixSvgDefsIds` coverage 확장 여부 결정:** 현재 `fill/stroke`의 `url(#id)`만 커버. `href`/`xlink:href` 미커버는 "현재 sample-seat-map.svg에서 사용 안 함"을 근거로 MVP 수용 or coverage 확장.

---

## Next Steps

- 이 REVIEWS.md를 참고해 plan 2차 revision (아래 중 택1):
  - `/gsd-plan-phase 12 --reviews` — planner agent가 위 action items를 반영해 plan 재작성.
  - 수동으로 12-02/12-03 Task 2·3·4만 편집.
- Cursor 리뷰를 보강하려면 `cursor agent login` 후 `/gsd-review --phase 12 --cursor` 재실행.
