---
phase: 12-ux
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - apps/web/app/globals.css
  - apps/web/components/admin/__tests__/svg-preview.test.tsx
  - apps/web/components/admin/svg-preview.tsx
  - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
  - apps/web/components/booking/__utils__/__tests__/prefix-svg-defs-ids.test.ts
  - apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts
  - apps/web/components/booking/seat-map-viewer.tsx
  - apps/web/components/home/genre-grid.tsx
  - apps/web/components/home/hot-section.tsx
  - apps/web/components/home/new-section.tsx
  - apps/web/hooks/__tests__/use-is-mobile.test.ts
  - apps/web/hooks/use-is-mobile.ts
  - apps/web/test-setup.ts
  - apps/web/vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-21
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 12 (UX 현대화)의 9개 action item이 모두 정상 반영된 상태로, reviews revision에서 이미 다룬 HIGH/MED/LOW 항목들은 재지적하지 않았다. 전반적으로 코드 품질은 양호하며, 특히 HIGH #1 per-seat timeout race guard, HIGH #2 unified `[data-stage]` parsing contract, LOW #6 prefixSvgDefsIds coverage, LOW #7 DOMParser try/catch 등은 적절히 구현·테스트되어 있다.

새로 발견된 findings는 모두 LOW-severity 영역으로, 기능적 결함이 아닌 코드 품질·견고성 개선 포인트다:

- **W-1 (tracked)**: `dangerouslySetInnerHTML` 사용 — **PROJECT.md §Security Debt의 D-19에 이미 공식 기록된 tracked debt**이므로 CRITICAL이 아닌 tracked WARNING으로 분류. 이번 phase에서 추가 조치 불필요, 향후 security phase에서 DOMPurify + CSP로 해결 예정.
- **W-2**: `text.match(/data-seat-id/g)` 정규식 기반 좌석 카운팅이 주석/CDATA까지 집계하여 부정확할 수 있음. 이미 파싱된 `doc.querySelectorAll('[data-seat-id]').length`로 대체 권장.
- **Info 항목들**: useCallback 불필요 의존성, viewBox width/height 단위 suffix 미고려, early-return 대소문자, 핫 경로 재파싱 등. 모두 기존 테스트 통과·실행 경로에는 영향 없음.

## Warnings

### WR-01: `dangerouslySetInnerHTML`로 R2 SVG 주입 — 서버측 재검증 없음 (tracked D-19)

**File:** `apps/web/components/booking/seat-map-viewer.tsx:501, 519`
**Issue:**
viewer가 R2에서 받은 SVG 문자열을 `dangerouslySetInnerHTML`로 두 곳에 주입한다 (메인 + MiniMap). admin 업로드 시 client-side DOMParser 검증만 수행하므로 API 우회·admin 계정 탈취·R2 버킷 직접 조작 시 `<script>`/이벤트 핸들러/외부 이미지 href 등 악성 페이로드가 뷰어에서 실행될 수 있다.
**Tracked:** PROJECT.md §Security Debt → "Phase 12 admin SVG client-side validation only (2026-04-21, reviews revision D-19)" 항목에 이미 정식 기록됨. Phase 12 범위 외.
**Fix (향후 security phase):**
```ts
// 1) 서버측 재검증 (NestJS admin seat-map DTO)
// 2) DOMPurify SVG profile로 upload path + viewer render path 모두 sanitize
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } });
// 3) CSP strict-dynamic + script-src 'self' (next.config headers)
```
**이번 phase 조치:** 없음 — tracked로 유지.

### WR-02: `text.match(/data-seat-id/g)` 좌석 카운팅이 주석·CDATA·문자열 리터럴까지 집계

**File:** `apps/web/components/admin/svg-preview.tsx:103`
**Issue:**
검증 블록에서 이미 `doc`을 DOMParser로 파싱했음에도 좌석 수 집계는 원본 텍스트에 대해 정규식을 돌린다 (`(text.match(/data-seat-id/g) || []).length`). 이 방식은:
1. `<!-- TODO: data-seat-id=... -->` 같은 주석 안 출현도 카운트
2. `<text>data-seat-id 설명</text>` 같은 텍스트 노드 내용도 카운트
3. CDATA 섹션 `<![CDATA[data-seat-id]]>` 내부도 카운트

결과적으로 UI에 표시되는 "감지된 좌석 수" (line 164)가 실제 `querySelectorAll('[data-seat-id]').length`보다 커질 수 있어 admin에게 오도된 피드백을 준다. 검증은 통과했으나 집계 숫자만 틀린 상황.

**Fix:**
```ts
// before (line 103):
const seatCount = (text.match(/data-seat-id/g) || []).length;

// after: 이미 파싱된 doc 재사용 (정확 + 중복 파싱 회피)
const seatCount = doc.querySelectorAll('[data-seat-id]').length;
```

## Info

### IN-01: `handleClick` / `handleMouseOut` useCallback 의존성에 미사용 변수 포함

**File:** `apps/web/components/booking/seat-map-viewer.tsx:370, 443`
**Issue:**
- `handleClick` 콜백 내부는 `seatStates`, `onSeatClick`만 참조하지만 deps에 `selectedSeatIds`도 포함 (line 370).
- `handleMouseOut` 콜백 내부는 `seatStates`, `selectedSeatIds`만 참조하지만 deps에 `tierColorMap`도 포함 (line 443).

불필요한 deps로 인해 해당 변수가 바뀔 때마다 useCallback 캐시가 깨지고 자식 DOM에 새 리스너가 전달된다. 기능적 버그는 아니지만 이벤트 위임 최적화 의도(ref/memo 기반 constant handler)와 상충한다.

**Fix:**
```ts
// handleClick:
}, [seatStates, onSeatClick]);

// handleMouseOut:
}, [seatStates, selectedSeatIds]);
```

### IN-02: `processedSvg` useMemo 내 viewBox 폴백이 단위 suffix 미처리

**File:** `apps/web/components/booking/seat-map-viewer.tsx:220-223`
**Issue:**
viewBox 부재 시 `width`/`height` 속성을 그대로 사용해 `0 0 ${w} ${h}` 를 조립한다. 그런데 SVG width/height는 `"100"`, `"100px"`, `"50%"`, `"10cm"` 등 단위가 붙을 수 있다. 예컨대 `width="800px"` → viewBox `"0 0 800px 600"` → invalid SVG attribute → 브라우저가 viewBox를 무시하고 SVG가 사라지는 회귀 가능. 이후 LOW #8에서 이미 viewBox 파싱 시 split 로직을 정비한 것과 결이 다르다.

현재 admin이 업로드하는 SVG는 대부분 viewBox를 이미 가지고 있어 이 코드 경로는 거의 타지 않지만, 방어적 처리가 빠져 있다.

**Fix:**
```ts
if (!svgEl.getAttribute('viewBox')) {
  const wRaw = svgEl.getAttribute('width') ?? '800';
  const hRaw = svgEl.getAttribute('height') ?? '600';
  // 숫자 prefix만 추출 ("800px" → "800", "50%" → "50")
  const w = parseFloat(wRaw) || 800;
  const h = parseFloat(hRaw) || 600;
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
}
```

### IN-03: `prefixSvgDefsIds` early-return이 대소문자·공백 변형에 취약

**File:** `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts:31`
**Issue:**
`if (!svgString.includes('<defs')) return svgString;` 최적화 가드는 대문자 `<Defs ` 또는 self-closing 변형 `<defs/>`는 통과하지만, 속성이 붙은 `<defs xmlns:...>` 나 비정규 인코딩 (예: `<DEFS>`) 을 만나면 false-negative. SVG 스펙상 엘리먼트명은 case-sensitive이므로 소문자 `<defs`가 표준이지만, 실제 디자이너 툴 내보내기(XD, Illustrator 일부 버전)는 드물게 대문자를 섞는다.

현재는 DOMParser가 실제 파싱을 하므로 fallback이 동작하지만 `<Defs>`가 들어오면 아예 파싱 단계로 가지 않고 원본을 반환한다 → MiniMap ID 충돌 발생 가능.

영향 범위가 극히 작아 Info로 분류. 실제 admin 업로드 SVG가 이런 형태로 들어오는지 확인 후 선택적으로 수정.

**Fix:**
```ts
// 대소문자 무관 + 여백 허용
if (!/<defs[\s>]/i.test(svgString)) return svgString;
```

### IN-04: `processedSvg` + `useEffect` 2-패스 렌더가 seatStates 변경마다 전체 SVG 재파싱

**File:** `apps/web/components/booking/seat-map-viewer.tsx:139-308, 320-353`
**Issue:**
현재 구조는 `useMemo(processedSvg, [rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals])` → 매번 DOMParser + XMLSerializer (암묵적 via outerHTML) 경로를 탄다. 좌석 하나 클릭마다 전체 SVG가 재파싱·재렌더·재마운트되는 구조.

기능 정합성은 맞지만 (MED #4 D-13 broadcast priority도 이 기반 위에서 동작) 대형 좌석맵 (1,000석 이상) 에서는 UX 지연이 우려된다. 성능은 v1 리뷰 scope 밖이므로 info로만 기록.

**관찰만, fix 없음:** Phase 12는 MVP 범위라 skip. 향후 좌석맵 규모가 커지면 `useMemo` 입력에서 `seatStates`/`selectedSeatIds`/`pendingRemovals`를 빼고 useEffect 기반 mutation만으로 업데이트하는 refactor 후보.

### IN-05: `test-setup.ts` Blob.prototype 폴리필이 타 테스트에 전역 오염 가능

**File:** `apps/web/test-setup.ts:10-36`
**Issue:**
`Blob.prototype.text`/`arrayBuffer`를 전역 프로토타입에 직접 주입한다. jsdom 환경에서 setupFiles로 한 번 실행되는 구조라 테스트 간 leak은 아니지만, 향후 `Blob.prototype.text`가 실제로 존재하는 Node 런타임 (Node 20+) 으로 옮기면 이 시임이 실행되지 않아 다행이다. 반면 `FileReader`를 prototype 안에서 `new FileReader()`로 사용하는데, jsdom의 FileReader는 동기 파일 없이 `readAsText`가 비동기 마이크로태스크에 걸리므로 동작. 문제 없음.

다만 이 폴리필 자체의 필요성이 Plan 12-02의 `await file.text()` 테스트 경로 때문임이 주석에만 설명되어 있어, 나중에 해당 코드가 사라졌을 때 이 시임이 dead code가 될 위험이 있다. TODO 주석으로 sunset 조건을 명시하는 편이 이후 유지보수에 이롭다.

**Fix (optional):**
```ts
/**
 * TODO (sunset): Node 20+ 또는 jsdom 24+에서 native Blob.prototype.text 제공 시 제거.
 * 유지 조건: apps/web/components/admin/svg-preview.tsx의 `await file.text()` 경로가 남아 있는 동안.
 */
```

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
