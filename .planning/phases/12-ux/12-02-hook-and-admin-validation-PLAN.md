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
    - "use-is-mobile.ts가 getServerSnapshot 함수를 named export로도 노출하여(B-4) 12-00 Task 2가 SSR fallback 정합성을 unit test로 자동 검증 가능"
    - "svg-preview.tsx의 handleSvgUpload가 R2 PUT 호출 이전에 try/catch로 감싼 DOMParser 파싱 + stage 마커 존재 검증 + data-stage enum 검증을 수행하여 잘못된 SVG를 R2 업로드 전에 차단 (reviews revision HIGH #2 + LOW #7)"
    - "UNIFIED PARSING CONTRACT (reviews revision 2026-04-21 D-06/D-07): svg-preview 검증 단계에서 `doc.querySelector('[data-stage]')`로 root + descendant 모두 탐색, 발견 시 값이 `top|right|bottom|left` 중 하나인지 enum 검증"
    - "Plan 12-00에서 작성된 svg-preview.test.tsx의 7 케이스(기본 4 + descendant 통과 + invalid enum 거부 + parse 실패 toast) + use-is-mobile.test.ts의 4 케이스(3 기존 + 1 getServerSnapshot named export 검증) 모두 GREEN"
    - "기존 admin 업로드의 size 검증(10MB) + presigned URL + R2 PUT + 좌석 카운트 + toast.success 흐름은 회귀 0"
  artifacts:
    - path: "apps/web/hooks/use-is-mobile.ts"
      provides: "useIsMobile hook + getServerSnapshot named export — 모바일 viewport 감지 (UX-06 D-17) + SSR 안전성"
      contains: "useSyncExternalStore, matchMedia, '(max-width: 767px)', export function getServerSnapshot, useIsMobile"
      min_lines: 15
    - path: "apps/web/components/admin/svg-preview.tsx"
      provides: "admin SVG 업로드 시 try/catch 기반 안전 파싱 + stage 마커 검증 + data-stage enum 검증 (UX-02 D-06/D-07 unified contract)"
      contains: "DOMParser, parseFromString, image/svg+xml, parsererror, VALID_STAGES, stageEl, hasStageText, '스테이지 마커가 없는 SVG', 'top, right, bottom, left', 'SVG 형식이 올바르지 않습니다'"
  key_links:
    - from: "apps/web/components/booking/seat-map-viewer.tsx (Plan 12-03 변경 대상)"
      to: "apps/web/hooks/use-is-mobile.ts"
      via: "import { useIsMobile } from '@/hooks/use-is-mobile';"
      pattern: "import.*useIsMobile.*from.*hooks/use-is-mobile"
    - from: "apps/web/hooks/__tests__/use-is-mobile.test.ts (Plan 12-00 신규)"
      to: "apps/web/hooks/use-is-mobile.ts (getServerSnapshot named export)"
      via: "import { getServerSnapshot } from '@/hooks/use-is-mobile' → expect(getServerSnapshot()).toBe(false)"
      pattern: "export function getServerSnapshot"
    - from: "apps/web/components/admin/svg-preview.tsx handleSvgUpload (reviews revision)"
      to: "DOMParser API (try/catch) → descendant [data-stage] 검색 → enum 검증 → 실패 시 toast.error → early return → R2 PUT 미발생"
      via: "size 체크 직후, presignedUpload.mutateAsync 호출 직전에 prepend"
      pattern: "VALID_STAGES|querySelector\\('\\[data-stage\\]'\\)"
---

<objective>
Wave 2 — Hook 신규 + Admin 검증.

두 변경은 file disjoint이므로 병렬 가능하나 단일 plan에 묶음(2 task ≈ 30% context):
1. `apps/web/hooks/use-is-mobile.ts` 신규 생성 — Plan 12-03 viewer가 모바일 분기에 사용. **getServerSnapshot을 named export로도 노출하여 SSR fallback 자동 검증을 가능하게 함 (B-4)**
2. `apps/web/components/admin/svg-preview.tsx` 검증 추가 — UX-02 D-06/D-07 unified parsing contract 적용 (reviews revision: descendant [data-stage] + enum 검증 + try/catch)

Purpose:
- Plan 12-03 viewer 변경(initialScale 모바일 분기 + MiniMap 마운트 분기)이 작동하기 위해 useIsMobile hook이 선행되어야 함
- getServerSnapshot named export로 SSR fallback (`false`)이 unit test에서 자동 검증 가능 — Wave 4 manual QA의 hydration warning 검증과 이중 가드
- **reviews revision HIGH #2 (unified parsing contract):** admin과 viewer가 동일한 `doc.querySelector('[data-stage]')` + enum 검증 로직으로 stage marker를 해석하여, `<g data-stage="top">` descendant SVG가 admin 통과 후 viewer에서 무시되는 UX-02 silent fail을 방지.
- **reviews revision LOW #7 (try/catch):** malformed SVG에서도 crash/silent 업로드 없이 명확한 toast 피드백 제공.

Output:
- 신규 `apps/web/hooks/use-is-mobile.ts` (~17줄, getServerSnapshot named export 포함)
- 수정 `apps/web/components/admin/svg-preview.tsx` (handleSvgUpload 콜백 안 ~25줄 prepend — try/catch + parsererror guard + enum 검증)
- Plan 12-00의 테스트 11건(svg-preview 7 + use-is-mobile 4) GREEN 전환
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
@.planning/phases/12-ux/12-REVIEWS.md
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
export function getServerSnapshot(): boolean;  // B-4: named export로도 노출 (SSR fallback 자동 검증용)
```
- 의존: `react`의 `useSyncExternalStore`
- query: `'(max-width: 767px)'`
- SSR fallback: `false` (desktop = initialScale=1 적용)
- subscribe: `window.matchMedia(query).addEventListener('change', cb)` + cleanup `removeEventListener`
- getSnapshot: `window.matchMedia(query).matches` (typeof window === 'undefined' → false)
- getServerSnapshot: 항상 `false` (named export — `useSyncExternalStore` 3번째 인자 + 단위 테스트 양쪽에서 사용 가능)

MODIFIED: apps/web/components/admin/svg-preview.tsx (handleSvgUpload 콜백, reviews revision 적용)
- 현재 흐름: size 체크 → try { presignedUpload.mutateAsync → fetch PUT → setSvgUrl → 좌석 카운트 → toast.success } catch { toast.error }
- 변경 후 흐름: size 체크 → **(NEW) try/catch로 감싼 DOMParser parse + parsererror guard + stage 마커 검증 + data-stage enum 검증** → try { presigned URL 발급 → R2 PUT → setSvgUrl → 좌석 카운트(text 변수 재사용) → toast.success } catch { toast.error }
- 파싱 실패 카피: `'SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.'`
- stage 마커 부재 카피: `'스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.'`
- enum 위반 카피: `'data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.'`
- **unified parsing contract (reviews revision D-06/D-07):** `doc.querySelector('[data-stage]')`로 root + descendant 모두 검색
- 검증 통과 시 변수 `text`를 try 블록 안 좌석 카운트에 재사용 (file.text() 중복 호출 회피)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useIsMobile hook 신규 생성 + getServerSnapshot named export</name>
  <files>apps/web/hooks/use-is-mobile.ts</files>
  <read_first>
    - apps/web/hooks/use-countdown.ts (file 상단 'use client' + 함수형 단일 export hook 구조 — 동일 컨벤션 적용)
    - apps/web/hooks/__tests__/use-is-mobile.test.ts (Plan 12-00에서 작성된 테스트 — 본 task 완료 후 GREEN 전환. getServerSnapshot named export 검증 케이스 포함)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/hooks/use-is-mobile.ts (hook, event-driven) — NEW" (line 388~452)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pattern 3: useSyncExternalStore" (line 313~385) — 특히 hook 본체 코드 (line 320~347)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 4 SSR/Client hydration mismatch" (line 516~520)
    - .planning/phases/12-ux/12-CONTEXT.md D-17 (모바일 자동 1.4x), D-18 (사용자 수동 zoom-out 허용)
  </read_first>
  <behavior>
    - useIsMobile()이 호출되면 useSyncExternalStore를 통해 matchMedia('(max-width: 767px)')의 현재 matches 값을 반환
    - matchMedia change 이벤트가 발생하면 hook이 새 값으로 자동 리렌더링
    - SSR (typeof window === 'undefined') 시 false 반환 — desktop 기본
    - cleanup: hook unmount 시 matchMedia change listener 제거
    - **B-4: `getServerSnapshot`을 named export로도 노출** — Wave 0 unit test가 `import { getServerSnapshot } from '@/hooks/use-is-mobile'` 후 `expect(getServerSnapshot()).toBe(false)`로 SSR fallback 정합성을 자동 검증 가능
  </behavior>
  <action>
신규 파일 작성. 정확히 다음 내용 (B-4: getServerSnapshot이 named export로 노출됨):

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

/**
 * SSR snapshot — 항상 false (desktop fallback).
 *
 * `useSyncExternalStore`의 3번째 인자로 사용되며, named export로도 노출하여
 * Wave 0 unit test가 SSR fallback 정합성을 직접 검증할 수 있도록 한다 (B-4).
 *
 * @returns false (Next.js SSR HTML 생성 시 desktop initialScale=1 적용 보장)
 */
export function getServerSnapshot(): boolean {
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
- `'use client'` directive는 file 첫 줄 (공백 없음). React 19 + Next.js 16 App Router 표준.
- Strict TypeScript: 명시적 return type. `any` 금지.
- React 직접 import — `react` from named import.
- **B-4 변경: `getServerSnapshot`을 `export function`으로 변경**. useSyncExternalStore가 3번째 인자로 `getServerSnapshot` 참조를 그대로 사용.
- 함수형 hook (CLAUDE.md: 함수형 우선).
- query는 module-level const — 재할당 회피.
- subscribe / getSnapshot은 function declaration — useSyncExternalStore에 안정 reference로 전달.
- file 끝에 newline 1줄 (lint 컨벤션).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && test -f apps/web/hooks/use-is-mobile.ts && grep -q "^'use client';" apps/web/hooks/use-is-mobile.ts && grep -q "useSyncExternalStore" apps/web/hooks/use-is-mobile.ts && grep -q "(max-width: 767px)" apps/web/hooks/use-is-mobile.ts && grep -q "export function useIsMobile(): boolean" apps/web/hooks/use-is-mobile.ts && grep -q "export function getServerSnapshot(): boolean" apps/web/hooks/use-is-mobile.ts && grep -q "return false;" apps/web/hooks/use-is-mobile.ts && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- use-is-mobile --run 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - 파일 생성: `test -f apps/web/hooks/use-is-mobile.ts`
    - 파일 첫 줄 `'use client';`:
      - `head -1 apps/web/hooks/use-is-mobile.ts` 출력이 `'use client';`
    - 핵심 식별자 존재:
      - `grep -q "useSyncExternalStore" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "(max-width: 767px)" apps/web/hooks/use-is-mobile.ts`
      - `grep -q "export function useIsMobile(): boolean" apps/web/hooks/use-is-mobile.ts`
      - **B-4: `grep -q "export function getServerSnapshot(): boolean" apps/web/hooks/use-is-mobile.ts` (named export)**
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
    - Plan 12-00의 use-is-mobile.test.ts 모든 케이스 GREEN (3 기존 + 1 getServerSnapshot named export 검증):
      - `pnpm --filter @grapit/web test -- use-is-mobile --run` exit 0 + 출력에 "4 passed" 또는 "Tests  4 passed" 포함
  </acceptance_criteria>
  <done>
useIsMobile hook + getServerSnapshot named export(B-4)가 React 19 useSyncExternalStore 패턴으로 신규 생성됨. SSR fallback false + client matchMedia 구독 + cleanup 모두 구현. Plan 12-00의 테스트 4 케이스 GREEN 전환. typecheck/lint GREEN. Plan 12-03이 import해서 사용 가능.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: svg-preview.tsx에 try/catch 기반 파싱 + stage 마커 검증 + enum 검증 추가 (reviews revision HIGH #2 + LOW #7)</name>
  <files>apps/web/components/admin/svg-preview.tsx</files>
  <read_first>
    - apps/web/components/admin/svg-preview.tsx (전체 — handleSvgUpload 콜백 line 31~62 흐름)
    - apps/web/components/admin/__tests__/svg-preview.test.tsx (Plan 12-00에서 작성된 7 케이스 테스트 — 본 task 완료 후 GREEN 전환. descendant data-stage + invalid enum + parse 실패 케이스 포함)
    - .planning/phases/12-ux/12-PATTERNS.md §"apps/web/components/admin/svg-preview.tsx (component, request-response)" (line 256~338)
    - .planning/phases/12-ux/12-RESEARCH.md §"Code Examples / svg-preview.tsx" (line 791~861)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 4: admin SVG 검증을 R2 PUT 이후로 미루기" (Anti-pattern 4 — line 473)
    - .planning/phases/12-ux/12-RESEARCH.md §"Pitfall 8: 정규식만으로 검증" (line 545~549)
    - .planning/phases/12-ux/12-CONTEXT.md D-06, D-06/D-07 UNIFIED PARSING CONTRACT (reviews revision), D-08 (스테이지 마커 검증 정책)
    - .planning/phases/12-ux/12-UI-SPEC.md §"Copywriting Contract" line 144 (실패 카피)
    - **.planning/phases/12-ux/12-REVIEWS.md §"Action Items" HIGH #2 (descendant data-stage + enum 검증) + LOW #7 (try/catch + parse 실패 toast)**
  </read_first>
  <behavior>
    - file.size > 10MB 검증은 기존 그대로 첫 단계
    - size 검증 통과 시 try/catch 블록 안에서 파일을 텍스트로 읽어 DOMParser로 파싱 + parsererror 가드
    - parse 실패(try/catch 또는 parsererror tagName) 시:
      - `toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.')`
      - early return (presignedUpload.mutateAsync 호출 X)
    - parse 성공 시 `doc.querySelector('[data-stage]')` (root + descendant 모두 검색) 결과와 `<text>STAGE</text>` (textContent.trim() === 'STAGE') 존재 여부 확인
    - 둘 다 부재 시:
      - `toast.error('스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.')`
      - early return
    - `[data-stage]` 발견 시 **enum 검증** — 값이 `top|right|bottom|left` 중 하나인지:
      - 아니면 `toast.error('data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.')`
      - early return
    - 모든 검증 통과 시 기존 try 블록 진입 (presigned URL → R2 PUT → setSvgUrl → 좌석 카운트 → toast.success)
    - 좌석 카운트 단계에서 `file.text()` 재호출 대신 검증에서 읽은 `text` 변수 재사용
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

변경 후 (reviews revision HIGH #2 + LOW #7 적용):
```tsx
  const handleSvgUpload = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('SVG 파일은 10MB 이하여야 합니다.');
        return;
      }

      // Phase 12 reviews revision (D-06/D-07 unified contract + HIGH #2 + LOW #7):
      // 1) try/catch로 file.text() + DOMParser를 감싸 parse 실패를 graceful 처리
      // 2) doc.querySelector('[data-stage]')로 root + descendant 모두 탐색 (viewer와 동일 계약)
      // 3) data-stage 값 enum 검증 (top|right|bottom|left)
      // DOMParser 사용 (정규식 금지, RESEARCH §Pitfall 8).
      const VALID_STAGES = ['top', 'right', 'bottom', 'left'] as const;
      let text: string;
      let doc: Document;
      try {
        text = await file.text();
        const parser = new DOMParser();
        doc = parser.parseFromString(text, 'image/svg+xml');
        // parsererror tagName 가드: invalid XML은 documentElement.tagName === 'parsererror'
        if (doc.documentElement.tagName === 'parsererror' || doc.querySelector('parsererror')) {
          toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.');
          return;
        }
      } catch {
        toast.error('SVG 형식이 올바르지 않습니다. 다시 확인 후 업로드하세요.');
        return;
      }

      const hasStageText = Array.from(doc.querySelectorAll('text')).some(
        (t) => t.textContent?.trim() === 'STAGE',
      );
      // UNIFIED CONTRACT (reviews revision D-06/D-07): root + descendant 모두 탐색
      const stageEl = doc.querySelector('[data-stage]');
      const hasDataStage = stageEl !== null;

      if (!hasStageText && !hasDataStage) {
        toast.error(
          '스테이지 마커가 없는 SVG입니다. <text>STAGE</text> 또는 data-stage 속성을 포함해주세요.',
        );
        return;
      }

      // reviews revision HIGH #2: data-stage 발견 시 enum 검증
      if (hasDataStage) {
        const value = stageEl!.getAttribute('data-stage') ?? '';
        if (!VALID_STAGES.includes(value as typeof VALID_STAGES[number])) {
          toast.error('data-stage 속성 값은 top, right, bottom, left 중 하나여야 합니다.');
          return;
        }
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
- `text` 변수가 검증 + 좌석 카운트에 모두 사용.
- 검증 실패 시 `toast.error` + `return` — try/catch (R2 PUT) 진입하지 않음.
- 카피는 12-REVIEWS.md Action Items + UI-SPEC §Copywriting Contract와 정확히 일치.
- DOMParser는 jsdom (test) + 모든 evergreen 브라우저에서 기본 제공.
- useCallback deps `[presignedUpload]` 유지.
- **UNIFIED PARSING CONTRACT (reviews revision):** `doc.documentElement.hasAttribute('data-stage')` 체크 제거 — `doc.querySelector('[data-stage]')`가 root 포함하여 모든 descendant를 검색하므로 root check는 redundant.
- `VALID_STAGES as const` + `includes(value as typeof VALID_STAGES[number])` 패턴은 strict TS에서 readonly tuple + includes 호환 처리 — CLAUDE.md "no any" 준수하며 타입 안전.
- `stageEl!`는 non-null assertion — `hasDataStage === true` 분기 안에서만 사용, 타입 좁히기 확보.
- `parsererror`는 다음 두 경로 모두 체크: `doc.documentElement.tagName === 'parsererror'` (document root가 parsererror인 경우) + `doc.querySelector('parsererror')` (내부에 삽입된 경우) — jsdom/브라우저 구현 차이 cover.
- 정규식 (`/data-seat-id/g`)은 좌석 카운트 단계에서 그대로 유지 — stage 마커 검증에는 정규식 사용 안 함.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && grep -q "DOMParser" apps/web/components/admin/svg-preview.tsx && grep -q "VALID_STAGES" apps/web/components/admin/svg-preview.tsx && grep -q "querySelector..\\[data-stage\\]" apps/web/components/admin/svg-preview.tsx && grep -q "parsererror" apps/web/components/admin/svg-preview.tsx && grep -q "스테이지 마커가 없는 SVG" apps/web/components/admin/svg-preview.tsx && grep -q "top, right, bottom, left" apps/web/components/admin/svg-preview.tsx && grep -q "SVG 형식이 올바르지 않습니다" apps/web/components/admin/svg-preview.tsx && grep -q "image/svg+xml" apps/web/components/admin/svg-preview.tsx && pnpm --filter @grapit/web typecheck 2>&1 | tail -5 && pnpm --filter @grapit/web lint 2>&1 | tail -5 && pnpm --filter @grapit/web test -- svg-preview --run 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - 파일 변경 검증 (모든 grep 명령 exit 0):
      - `grep -q "DOMParser" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "parseFromString" apps/web/components/admin/svg-preview.tsx`
      - **reviews revision LOW #7 (try/catch + parse 실패 toast):**
        - `grep -q "parsererror" apps/web/components/admin/svg-preview.tsx`
        - `grep -q "SVG 형식이 올바르지 않습니다" apps/web/components/admin/svg-preview.tsx`
      - **reviews revision HIGH #2 (unified parsing contract + enum 검증):**
        - `grep -q "VALID_STAGES" apps/web/components/admin/svg-preview.tsx`
        - `grep -q "querySelector..\\[data-stage\\]" apps/web/components/admin/svg-preview.tsx` (root + descendant 모두 탐색)
        - `grep -q "top, right, bottom, left" apps/web/components/admin/svg-preview.tsx` (enum 위반 카피)
      - 기존 stage 마커 검증 유지:
        - `grep -q "스테이지 마커가 없는 SVG입니다" apps/web/components/admin/svg-preview.tsx`
        - `grep -q "hasStageText" apps/web/components/admin/svg-preview.tsx`
        - `grep -q "image/svg+xml" apps/web/components/admin/svg-preview.tsx`
    - 검증 위치 검증 (R2 PUT 이전):
      - svg-preview.tsx에서 `DOMParser` 라인 번호 < `presignedUpload.mutateAsync` 라인 번호:
        `awk '/DOMParser/{p=NR} /presignedUpload.mutateAsync/{m=NR} END{exit (p<m)?0:1}' apps/web/components/admin/svg-preview.tsx` exit 0
    - useCallback deps 회귀 없음:
      - `grep -q "\\[presignedUpload\\]" apps/web/components/admin/svg-preview.tsx`
    - 기존 흐름 회귀 없음:
      - `grep -q "10 \\* 1024 \\* 1024" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "좌석맵 SVG가 업로드되었습니다" apps/web/components/admin/svg-preview.tsx`
      - `grep -q "data-seat-id" apps/web/components/admin/svg-preview.tsx`
    - 정규식 stage 검증 금지 (RESEARCH §Pitfall 8):
      - `! grep -q "text.match(/<text" apps/web/components/admin/svg-preview.tsx`
    - 정적 검사:
      - `pnpm --filter @grapit/web typecheck` exit 0
      - `pnpm --filter @grapit/web lint` exit 0
    - Plan 12-00의 svg-preview.test.tsx 모든 케이스 GREEN (7 케이스):
      - `pnpm --filter @grapit/web test -- svg-preview --run` exit 0 + 출력에 "7 passed" 또는 "Tests  7 passed" 포함
      - Test 5 (`<g data-stage>` descendant 통과) PASS
      - Test 6 (`data-stage="invalid-value"` 거부) PASS
      - Test 7 (malformed SVG parse 실패 toast) PASS
  </acceptance_criteria>
  <done>
svg-preview.tsx의 handleSvgUpload가 size 체크 직후, R2 PUT 직전에 try/catch 기반 DOMParser 파싱 + parsererror guard + descendant `[data-stage]` 검색 + enum 검증을 수행. 검증 실패 시 명확한 toast + early return으로 R2 PUT/presigned URL 발급 모두 미발생. **reviews revision HIGH #2 (unified parsing contract + enum 검증) + LOW #7 (try/catch)** 적용. 기존 size/success/카운트 흐름 회귀 0. Plan 12-00의 svg-preview.test.tsx 7 케이스 GREEN. typecheck/lint GREEN.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin browser → svg-preview client validation → R2 (presigned PUT) | admin이 업로드한 SVG 파일이 클라이언트 검증을 거쳐 R2로 PUT됨. 본 plan이 이 경계에서 try/catch + stage 마커 검증 + enum 검증 mitigate. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-01 | Tampering / Input Validation | apps/web/components/admin/svg-preview.tsx handleSvgUpload | mitigate | DOMParser로 SVG 구조 파싱(try/catch + parsererror guard) 후 `<text>STAGE</text>` 또는 `[data-stage]` 부재 시 + `[data-stage]` enum 위반 시 toast.error + early return. 정규식 매칭 금지(false negative 회피). 검증은 R2 PUT 이전에 수행. reviews revision에서 descendant [data-stage] 지원 + enum 검증 + parse 실패 toast 강화. |
| (관련) 악성 `<script>` 삽입 SVG / dangerouslySetInnerHTML XSS | Tampering / Elevation | apps/web/components/booking/seat-map-viewer.tsx (R2 → dangerouslySetInnerHTML) | **accept (단기 MVP)** / **defer (중장기 security phase)** | **D-19 tech-debt 명시 (reviews revision LOW #9):** 현재 admin SVG 검증은 클라이언트 전용. admin 계정 탈취 또는 API 우회 시 악성 SVG/XSS 위험 잔존. 서버측 re-validation + DOMPurify SVG profile 도입은 별도 security phase로 deferred. Plan 12-04 SUMMARY에 footnote로 기록. |
| 거대 SVG (DoS) | DoS | (동일 파일) | mitigate (기존) | 기존 `file.size > 10MB` 체크가 size 검증 단계에서 차단. |
</threat_model>

<verification>
- [ ] `apps/web/hooks/use-is-mobile.ts` 신규 생성 + 핵심 식별자(useSyncExternalStore, matchMedia, **export function getServerSnapshot**, '(max-width: 767px)') 모두 존재
- [ ] `apps/web/components/admin/svg-preview.tsx` 변경: DOMParser + try/catch + parsererror guard + VALID_STAGES enum + `[data-stage]` descendant querySelector + 3종 toast 카피 모두 추가
- [ ] svg-preview의 DOMParser 검증 위치가 R2 PUT 이전 (라인 번호 비교)
- [ ] use-is-mobile.test.ts 4 케이스 GREEN (3 기존 + 1 getServerSnapshot named export)
- [ ] svg-preview.test.tsx 7 케이스 GREEN (기본 4 + descendant 통과 + invalid enum + parse 실패)
- [ ] `pnpm --filter @grapit/web typecheck` GREEN
- [ ] `pnpm --filter @grapit/web lint` GREEN
- [ ] 기존 svg-preview의 size/success/seatCount 흐름 회귀 없음
</verification>

<success_criteria>
- 자동: 위 verification 8개 항목 모두 충족
- T-12-01 mitigate 증거: svg-preview.test.tsx의 7 케이스 모두 GREEN
- **reviews revision HIGH #2 증거**: descendant data-stage 통과 + invalid enum 거부 케이스 GREEN
- **reviews revision LOW #7 증거**: malformed SVG parse 실패 toast 케이스 GREEN
- B-4 SSR 정합성 가드 1단: use-is-mobile.test.ts의 `getServerSnapshot()` 케이스가 GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/12-ux/12-02-SUMMARY.md`:
- 신규 use-is-mobile.ts 라인 인용 (getServerSnapshot named export 포함)
- svg-preview.tsx handleSvgUpload 변경 diff (size 체크 → try/catch DOMParser → descendant [data-stage] + enum 검증 → R2 PUT)
- 11 케이스(svg-preview 7 + use-is-mobile 4) GREEN 증거
- T-12-01 disposition: mitigate (DOMParser + try/catch + enum 검증 + R2 PUT 이전 abort)
- **reviews revision 적용 증거**: HIGH #2 (unified parsing contract + enum) + LOW #7 (try/catch parse 실패 toast)
- D-19 security debt 언급 (Plan 12-04에서 공식 기록)
- typecheck/lint 결과
</output>
