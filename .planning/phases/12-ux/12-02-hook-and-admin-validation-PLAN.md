---
phase: 12
plan: 02
plan_number: 2
type: execute
wave: 2
depends_on: ["12-00"]
files_modified:
  - apps/web/hooks/use-is-mobile.ts
  - apps/web/components/admin/svg-preview.tsx
autonomous: true
requirements: [UX-02, UX-06]
must_haves:
  truths:
    - "apps/web/hooks/use-is-mobile.ts 신규 파일이 useSyncExternalStore + matchMedia('(max-width: 767px)') 패턴으로 구현되어 SSR fallback false (desktop), 클라이언트 hydrate 후 viewport에 따라 true/false 반환"
    - "svg-preview.tsx의 handleSvgUpload가 R2 PUT 호출 이전에 DOMParser로 SVG를 파싱하여 <text>STAGE</text> 또는 [data-stage] 마커 부재 시 toast.error + early return — 잘못된 SVG는 R2 비용을 소비하지 않음"
    - "Plan 12-00에서 작성된 svg-preview.test.tsx의 4 케이스 + use-is-mobile.test.ts의 3 케이스 모두 GREEN"
    - "기존 admin 업로드의 size 검증(10MB) + presigned URL + R2 PUT + 좌석 카운트 + toast.success 흐름은 회귀 0"
  artifacts:
    - path: "apps/web/hooks/use-is-mobile.ts"
      provides: "useIsMobile hook — 모바일 viewport 감지 (UX-06 D-17)"
      contains: "useSyncExternalStore, matchMedia, '(max-width: 767px)', getServerSnapshot"
      min_lines: 15
    - path: "apps/web/components/admin/svg-preview.tsx"
      provides: "admin SVG 업로드 시 stage 마커 검증 (UX-02 D-06/D-08)"
      contains: "DOMParser, parseFromString, image/svg+xml, hasStageText, hasDataStage, '스테이지 마커가 없는 SVG'"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (Plan 12-03 변경 대상)"
      to: "apps/web/hooks/use-is-mobile.ts"
      via: "import { useIsMobile } from '@/hooks/use-is-mobile';"
      pattern: "import.*useIsMobile.*from.*hooks/use-is-mobile"
    - from: "apps/web/components/admin/svg-preview.tsx handleSvgUpload"
      to: "DOMParser API → 검증 실패 시 toast.error → early return → R2 PUT 미발생"
      via: "size 체크 직후, presignedUpload.mutateAsync 호출 직전에 prepend"
      pattern: "스테이지 마커가 없는 SVG"
---

<objective>
Wave 2 — Hook 신규 + Admin 검증.

두 변경은 file disjoint이므로 병렬 가능하나 단일 plan에 묶음(2 task ≈ 30% context):
1. `apps/web/hooks/use-is-mobile.ts` 신규 생성 — Plan 12-03 viewer가 모바일 분기에 사용
2. `apps/web/components/admin/svg-preview.tsx` 검증 추가 — UX-02 D-06/D-08 admin 보호 (R2 PUT 이전 abort)

Purpose:
- Plan 12-03 viewer 변경(initialScale 모바일 분기 + MiniMap 마운트 분기)이 작동하기 위해 useIsMobile hook이 선행되어야 함
- 잘못된 SVG가 R2에 업로드되어 비용 발생 + 잘못된 publicUrl 발급 + 후속 viewer가 stage 마커 부재로 graceful degrade되는 케이스를 admin 단계에서 차단

Output:
- 신규 `apps/web/hooks/use-is-mobile.ts` (~15줄)
- 수정 `apps/web/components/admin/svg-preview.tsx` (handleSvgUpload 콜백 안 ~12줄 prepend)
- Plan 12-00의 테스트 7건(svg-preview 4 + use-is-mobile 3) GREEN 전환
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
@.planning/phases/12-ux/12-VALIDATION.md
@apps/web/hooks/use-countdown.ts
@apps/web/components/admin/svg-preview.tsx
@apps/web/components/booking/seat-map-viewer.tsx
@apps/web/components/admin/__tests__/svg-preview.test.tsx
@apps/web/hooks/__tests__/use-is-mobile.test.ts

<interfaces>
<!-- 본 plan이 제공하는 contract — Plan 12-03이 의존 -->

NEW: apps/web/hooks/use-is-mobile.ts
```ts
'use client';
export function useIsMobile(): boolean;
```
- 의존: `react`의 `useSyncExternalStore`
- query: `'(max-width: 767px)'`
- SSR fallback: `false` (desktop = initialScale=1 적용)
- subscribe: `window.matchMedia(query).addEventListener('change', cb)` + cleanup `removeEventListener`
- getSnapshot: `window.matchMedia(query).matches` (typeof window === 'undefined' → false)
- getServerSnapshot: 항상 `false`

MODIFIED: apps/web/components/admin/svg-preview.tsx (handleSvgUpload 콜백)
- 현재 흐름: size 체크 → try { presignedUpload.mutateAsync → fetch PUT → setSvgUrl → 좌석 카운트 → toast.success } catch { toast.error }
- 변경 후 흐름: size 체크 → **(NEW) DOMParser stage 마커 검증** → try { presigned URL 발급 → R2 PUT → setSvgUrl → 좌석 카운트(text 변수 재사용) → toast.success } catch { toast.error }
- 검증 실패 카피 (UI-SPEC §Copywriting Contract 라인 144 기준): `'스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.'`
- 검증 통과 시 변수 `text`를 try 블록 안 좌석 카운트에 재사용 (file.text() 중복 호출 회피 — useCallback 클로저 안에서 동일 변수 참조)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useIsMobile hook 신규 생성</name>
  <files>apps/web/hooks/use-is-mobile.ts</files>
  <read_first>
    - apps/web/hooks/use-countdown.ts (file 상단 'use client' + 함수형 export 구조 — 동일 컨벤션 적용)
    - apps/web/hooks/__tests__/use-is-mobile.test.ts (Plan 12-00에서 작성된 테스트 — 본 task 완료 후 GREEN 전환)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/hooks/use-is-mobile.ts (hook, event-driven) — NEW" (line 388~452)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pattern 3: useSyncExternalStore" (line 313~385) — 특히 hook 본체 코드 (line 320~347)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 4 SSR/Client hydration mismatch" (line 516~520)
    - .planning/phases/12-ux/12-CONTEXT.md D-17 (모바일 자동 1.4x), D-18 (사용자 수동 zoom-out 허용)
  </read_first>
  <behavior>
    - useIsMobile()이 호출되면 useSyncExternalStore를 통해 matchMedia('(max-width: 767px)')의 현재 matches 값을 반환
    - matchMedia change 이벤트가 발생하면 hook이 새 값으로 자동 리렌더링
    - SSR (typeof window === 'undefined') 시 false 반환 — desktop 기본 (initialScale=1로 SSR HTML 생성, 모바일 hydrate 후 prop 변경 + key 토글로 재마운트는 12-03 viewer 책임)
    - cleanup: hook unmount 시 matchMedia change listener 제거
  </behavior>
  <action>
신규 파일 작성. 정확히 다음 내용:

```ts
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

/**
 * 모바일 viewport(< 768px) 여부를 반환하는 hook.
 *
 * - SSR: false (desktop fallback)
 * - 클라이언트: matchMedia 결과 + change 이벤트 구독
 *
 * 사용처: Plan 12-03 seat-map-viewer.tsx의 TransformWrapper initialScale
 * + MiniMap 마운트 분기 (D-16/D-17).
 *
 * @see .planning/phases/12-ux/12-CONTEXT.md D-17
 * @see .planning/phases/12-ux/12-RESEARCH.md §Pattern 3
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

주의:
- `'use client'` directive는 file 첫 줄 (공백 없음). React 19 + Next.js 16 App Router 표준 (PATTERNS.md §S1).
- Strict TypeScript: 명시적 return type (`: boolean`, `: () => void`). `any` 금지.
- React 직접 import — `react` from named import (배럴 사용 안 함, PATTERNS.md §use-countdown 분석체 컨벤션).
- 단일 export, 함수형 hook (CLAUDE.md: 함수형 우선).
- query는 module-level const — 재할당 회피.
- subscribe는 function declaration (hoisting) — useSyncExternalStore에 안정 reference로 전달.
- file 끝에 newline 1줄 (lint 컨벤션).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && test -f apps/web/hooks/use-is-mobile.ts && grep -q "^'use client';" apps/web/hooks/use-is-mobile.ts && grep -q "useSyncExternalStore" apps/web/hooks/use-is-mobile.ts && grep -q "(max-width: 767px)" apps/web/hooks/use-is-mobile.ts && grep -q "export function useIsMobile(): boolean" apps/web/hooks/use-is-mobile.ts && grep -q "function getServerSnapshot(): boolean" apps/web/hooks/use-is-mobile.ts && grep -q "return false;" apps/web/hooks/use-is-mobile.ts && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- use-is-mobile --run 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - 파일 생성: `test -f apps/web/hooks/use-is-mobile.ts`
    - 파일 첫 줄 `'use client';`:
      - `head -1 apps/web/hooks/use-is-mobile.ts` 출력이 `'use client';`
    - 핵심 식별자 존재:
      - `grep -q "useSyncExternalStore" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "(max-width: 767px)" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "export function useIsMobile(): boolean" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "function getServerSnapshot(): boolean" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "function subscribe" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "function getSnapshot" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "addEventListener" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "removeEventListener" apps/web/hooks/use-is-mobile.ts`
    - any 금지 (CLAUDE.md):
      - `! grep -q ": any\\|<any>" apps/web/hooks/use-is-mobile.ts`
    - 라인 수 ≥ 15:
      - `wc -l apps/web/hooks/use-is-mobile.ts` 출력의 첫 숫자 ≥ 15
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - Plan 12-00의 use-is-mobile.test.ts 모든 케이스 GREEN:
      - `pnpm --filter @grapit/web test -- use-is-mobile --run` exit 0 + 출력에 "3 passed" 또는 "Tests  3 passed" 포함
  </acceptance_criteria>
  <done>
useIsMobile hook이 React 19 useSyncExternalStore 패턴으로 신규 생성됨. SSR fallback false + client matchMedia 구독 + cleanup 모두 구현. Plan 12-00의 테스트 3 케이스 GREEN 전환. typecheck/lint GREEN. Plan 12-03이 import해서 사용 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: svg-preview.tsx에 stage 마커 검증 추가 (R2 PUT 이전)</name>
  <files>apps/web/components/admin/svg-preview.tsx</files>
  <read_first>
    - apps/web/components/admin/svg-preview.tsx (전체 — handleSvgUpload 콜백 line 31~62 흐름)
    - apps/web/components/admin/__tests__/svg-preview.test.tsx (Plan 12-00에서 작성된 테스트 — 본 task 완료 후 GREEN 전환)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/admin/svg-preview.tsx (component, request-response)" (line 256~338)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / svg-preview.tsx" (line 791~861)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 4: admin SVG 검증을 R2 PUT 이후로 미루기" (Anti-pattern 4 — line 473)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 8: 정규식만으로 검증" (line 545~549)
    - .planning/phases/12-ux/12-CONTEXT.md D-06, D-08 (스테이지 마커 검증 정책)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Copywriting Contract" line 144 (실패 카피)
  </read_first>
  <behavior>
    - file.size > 10MB 검증은 기존 그대로 첫 단계
    - size 검증 통과 시 파일을 텍스트로 읽어 DOMParser로 파싱
    - `<text>STAGE</text>` (textContent.trim() === 'STAGE') 또는 `data-stage` 속성(documentElement 또는 자손 어디에든) 둘 중 하나 부재 시:
      - `toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.')`
      - early return (presignedUpload.mutateAsync 호출 X, fetch X)
    - 검증 통과 시 기존 try 블록 진입 (presigned URL → R2 PUT → setSvgUrl → 좌석 카운트 → toast.success)
    - 좌석 카운트 단계에서 `file.text()` 재호출 대신 검증에서 읽은 `text` 변수 재사용 (성능 최적화 + 일관성)
  </behavior>
  <action>
정확히 다음 변경. handleSvgUpload 콜백(line 31~62) 전체를 다음으로 교체:

기존 (line 31~62):
```tsx
  const handleSvgUpload = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('SVG 파일은 10MB 이하여야 합니다.');
        return;
      }
      try {
        const { uploadUrl, publicUrl } =
          await presignedUpload.mutateAsync({
            folder: 'seat-maps',
            contentType: 'image/svg+xml',
            extension: 'svg',
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'image/svg+xml' },
        });
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

변경 후:
```tsx
  const handleSvgUpload = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('SVG 파일은 10MB 이하여야 합니다.');
        return;
      }

      // Phase 12 (D-06/D-08): stage 마커 검증 — R2 PUT 이전.
      // DOMParser 사용 (정규식 금지, RESEARCH §Pitfall 8).
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const hasStageText = Array.from(doc.querySelectorAll('text')).some(
        (t) => t.textContent?.trim() === 'STAGE',
      );
      const hasDataStage =
        doc.documentElement.hasAttribute('data-stage') ||
        doc.querySelector('[data-stage]') !== null;
      if (!hasStageText && !hasDataStage) {
        toast.error(
          '스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.',
        );
        return;
      }

      try {
        const { uploadUrl, publicUrl } =
          await presignedUpload.mutateAsync({
            folder: 'seat-maps',
            contentType: 'image/svg+xml',
            extension: 'svg',
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'image/svg+xml' },
        });
        setSvgUrl(publicUrl);

        // Count seats in SVG (text 변수는 위 검증에서 이미 읽음)
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

주의:
- `text` 변수가 검증 + 좌석 카운트에 모두 사용 — `await file.text()`를 try 블록 안에서 다시 호출하지 않음.
- 검증 실패 시 `toast.error` + `return` — try/catch 진입하지 않음. 따라서 presignedUpload.mutateAsync, fetch, setSvgUrl 모두 호출 X. (Anti-pattern 4 회피)
- 카피는 UI-SPEC §Copywriting Contract 라인 144와 정확히 일치: `'스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.'`
- DOMParser는 jsdom (test) + 모든 evergreen 브라우저에서 기본 제공 — polyfill 불필요.
- useCallback deps `[presignedUpload]` 유지 — 검증은 file 인자만 의존, 외부 state 의존 신규 추가 없음.
- 정규식 (`/data-seat-id/g`)은 좌석 카운트 단계에서 그대로 유지 — RESEARCH.md §Pitfall 8은 stage 마커 검증에 정규식을 쓰지 말라는 것이지, 단순 카운트는 정규식 OK.
- DOMParser 결과 `doc.querySelectorAll('text')`는 NodeList — `Array.from(...).some(...)` 패턴으로 some 사용. 직접 `nodeList.some`은 TypeScript 에러.
- `doc.documentElement.hasAttribute('data-stage')`는 root `<svg>` 자체의 속성 검증 (CONTEXT.md D-06: "data-stage 속성을 가진 요소"). `doc.querySelector('[data-stage]')`는 자손 요소까지 cover.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "DOMParser" apps/web/components/admin/svg-preview.tsx && grep -q "hasStageText" apps/web/components/admin/svg-preview.tsx && grep -q "hasDataStage" apps/web/components/admin/svg-preview.tsx && grep -q "스테이지 마커가 없는 SVG" apps/web/components/admin/svg-preview.tsx && grep -q "image/svg+xml" apps/web/components/admin/svg-preview.tsx && grep -q "data-stage" apps/web/components/admin/svg-preview.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- svg-preview --run 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - 파일 변경 검증 (모든 grep 명령 exit 0):
      - `grep -q "DOMParser" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "parseFromString" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "hasStageText" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "hasDataStage" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "스테이지 마커가 없는 SVG입니다" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "data-stage" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "image/svg+xml" apps/web/components/admin/svg-preview.tsx` (parseFromString 두 번째 인자)
    - 검증 위치 검증 (R2 PUT 이전):
      - svg-preview.tsx에서 `DOMParser` 라인 번호 < `presignedUpload.mutateAsync` 라인 번호 (수동 또는 awk 비교):
        `awk '/DOMParser/{p=NR} /presignedUpload.mutateAsync/{m=NR} END{exit (p<m)?0:1}' apps/web/components/admin/svg-preview.tsx` exit 0
    - useCallback deps 회귀 없음:
      - `grep -q "\\[presignedUpload\\]" apps/web/components/admin/svg-preview.tsx`
    - 기존 흐름 회귀 없음:
      - `grep -q "10 \\* 1024 \\* 1024" apps/web/components/admin/svg-preview.tsx` (size 체크 유지)
      - `grep -q "좌석맵 SVG가 업로드되었습니다" apps/web/components/admin/svg-preview.tsx` (success toast 유지)
      - `grep -q "data-seat-id" apps/web/components/admin/svg-preview.tsx` (좌석 카운트 정규식 유지)
    - any/regex stage 검증 금지 (RESEARCH §Pitfall 8):
      - `! grep -q "text.match(/<text" apps/web/components/admin/svg-preview.tsx` (stage 검증을 정규식으로 하지 않음)
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - Plan 12-00의 svg-preview.test.tsx 모든 케이스 GREEN:
      - `pnpm --filter @grapit/web test -- svg-preview --run` exit 0 + 출력에 "4 passed" 또는 "Tests  4 passed" 포함
  </acceptance_criteria>
  <done>
svg-preview.tsx의 handleSvgUpload가 size 체크 직후, R2 PUT 직전에 DOMParser 기반 stage 마커 검증을 수행. 검증 실패 시 toast.error + early return으로 R2 PUT/presigned URL 발급 모두 미발생. 기존 size/success/카운트 흐름 회귀 0. Plan 12-00의 svg-preview.test.tsx 4 케이스 GREEN. typecheck/lint GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin browser → svg-preview client validation → R2 (presigned PUT) | admin이 업로드한 SVG 파일이 클라이언트 검증을 거쳐 R2로 PUT됨. 본 plan이 이 경계에서 stage 마커 검증을 mitigate. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-01 | Tampering / Input Validation | apps/web/components/admin/svg-preview.tsx handleSvgUpload | mitigate | DOMParser로 SVG 구조 파싱 후 `<text>STAGE</text>` 또는 `[data-stage]` 부재 시 toast.error + early return. 정규식 매칭 금지(false negative 회피, RESEARCH §Pitfall 8). 검증은 R2 PUT 이전에 수행하여 잘못된 SVG가 R2 비용을 소비하지 않게 한다. |
| (관련) 악성 `<script>` 삽입 SVG | Tampering / Elevation | (동일 파일) | accept (단기) / defer (장기) | 단기 결론(RESEARCH §Security Domain): admin 신뢰 source + R2 own-bucket으로 위험 낮음. DOMPurify SVG profile 도입은 별도 보안 phase로 분리. |
| 거대 SVG (DoS) | DoS | (동일 파일) | mitigate (기존) | 기존 `file.size > 10MB` 체크가 size 검증 단계에서 차단. 본 plan은 검증 추가만, 기존 size 체크 회귀 없음. |
</threat_model>

<verification>
- [ ] `apps/web/hooks/use-is-mobile.ts` 신규 생성 + 핵심 식별자(useSyncExternalStore, matchMedia, getServerSnapshot, '(max-width: 767px)') 모두 존재
- [ ] `apps/web/components/admin/svg-preview.tsx` 검증 코드(DOMParser, hasStageText, hasDataStage, '스테이지 마커가 없는 SVG입니다') 추가
- [ ] svg-preview의 DOMParser 검증 위치가 R2 PUT 이전 (라인 번호 비교)
- [ ] use-is-mobile.test.ts 3 케이스 GREEN
- [ ] svg-preview.test.tsx 4 케이스 GREEN (stage 마커 거부 + 통과 + size 회귀)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] 기존 svg-preview의 size/success/seatCount 흐름 회귀 없음
</verification>

<success_criteria>
- 자동: 위 verification 8개 항목 모두 충족
- T-12-01 mitigate 증거: svg-preview.test.tsx의 "stage 마커 없는 SVG 거부" 케이스가 GREEN — toast.error 호출 + presignedUpload.mutateAsync 미호출 + fetch 미호출이 자동 검증
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-02-SUMMARY.md`:
- 신규 use-is-mobile.ts 라인 인용
- svg-preview.tsx handleSvgUpload 변경 diff (size 체크 이후 → DOMParser 검증 prepend → R2 PUT)
- 7 케이스(svg-preview 4 + use-is-mobile 3) GREEN 증거
- T-12-01 disposition: mitigate (DOMParser 검증 + R2 PUT 이전 abort)
- typecheck/lint 결과
</output>
