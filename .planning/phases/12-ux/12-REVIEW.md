---
phase: 12-ux
reviewed: 2026-04-22T00:00:00Z
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
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 12 UX 개선 범위(좌석맵 viewer/admin, useIsMobile hook, 홈 섹션, 테스트 harness) 전반을 standard depth로 점검했다. 전반적으로 코드 품질은 높고 Plan 12-03의 B-2 RESIDUAL-V2 / MED #4 D-13 BROADCAST PRIORITY / HIGH #1 race guard 등 리뷰 재귀 루프에서 논의된 엣지 케이스가 잘 반영되어 있다. 테스트 커버리지도 충실하다.

다만 `seat-map-viewer.tsx`에서 (1) `useEffect`가 자기 자신이 변경하는 상태(`pendingRemovals`)를 의존성으로 갖고 있어 불필요한 재실행이 일어나고, (2) 일부 `useCallback`에 실제로 사용되지 않는 의존성이 포함되어 있으며, (3) `maxSelect` prop이 interface에는 있으나 구조분해에서 누락되어 완전히 미사용 상태로 남아 있다. 또 viewer의 `DOMParser` 결과를 admin과 달리 `parsererror` 가드 없이 바로 사용하는 불일치가 있어 통일성이 떨어진다. 이 외에는 info 레벨의 미세 개선 제안만 남는다.

Critical/security 이슈는 발견되지 않았다. `dangerouslySetInnerHTML` 사용은 있으나 admin이 업로드하고 R2에서 fetch한 신뢰된 SVG에 한정되며, 서버 측 검증(D-06/D-07 unified contract + enum)이 선행되어 있어 현재 위협 모델에서 수용 가능하다.

## Warnings

### WR-01: useEffect self-triggering dependency (pendingRemovals)

**File:** `apps/web/components/booking/seat-map-viewer.tsx:47-95`
**Issue:** `useEffect`의 의존성 배열에 `pendingRemovals`가 포함되어 있는데, effect 내부에서 `setPendingRemovals(...)`를 호출한다. 이 effect는 `selectedSeatIds` 변경 시 실행되는 것이 의도이지만, 자기 자신이 변경하는 상태도 의존성에 들어있어 재렌더 1회 추가 + `prevSelectedRef.current = new Set(curr)` 재할당이 매번 발생한다. 실행 2회차에는 `prev === curr`가 되어 no-op이지만 비용과 추론 혼란이 남는다. 실제 의도는 "`selectedSeatIds` 변경 시에만 diff 계산"이다.
**Fix:**
```tsx
// pendingRemovals.has(id) 체크를 위해 값은 필요하되 effect 재실행 트리거로는 원하지 않음.
// 해결: pendingRemovalsRef를 두고 set 시 ref도 동기화하거나, 이 effect 안에서
// pendingRemovals 읽기 분기를 제거(재선택 로직은 setPendingRemovals 함수형 업데이트만으로 충분).
useEffect(() => {
  const prev = prevSelectedRef.current;
  const curr = selectedSeatIds;

  curr.forEach((id) => {
    if (!prev.has(id)) {
      const existing = timeoutsRef.current.get(id);
      if (existing !== undefined) {
        clearTimeout(existing);
        timeoutsRef.current.delete(id);
      }
      // 함수형 업데이트로 현재 값 확인 → pendingRemovals deps 제거 가능
      setPendingRemovals((prevSet) => {
        if (!prevSet.has(id)) return prevSet;
        const next = new Set(prevSet);
        next.delete(id);
        return next;
      });
    }
  });

  prev.forEach((id) => {
    if (!curr.has(id)) {
      if (timeoutsRef.current.has(id)) return;
      setPendingRemovals((prevSet) => {
        const next = new Set(prevSet);
        next.add(id);
        return next;
      });
      const tid = window.setTimeout(() => {
        setPendingRemovals((prevSet) => {
          const next = new Set(prevSet);
          next.delete(id);
          return next;
        });
        timeoutsRef.current.delete(id);
      }, 150);
      timeoutsRef.current.set(id, tid);
    }
  });

  prevSelectedRef.current = new Set(curr);
}, [selectedSeatIds]); // pendingRemovals 제거
```
함수형 업데이터 안에서 현재 값을 확인하면 의존성에서 `pendingRemovals`를 제거할 수 있다. eslint-plugin-react-hooks의 exhaustive-deps 규칙이 경고를 띄울 수 있는데, 이 경우 함수형 업데이트 패턴이 의도된 것임을 주석으로 남기는 것을 권장한다.

### WR-02: `maxSelect` prop이 선언만 되고 완전히 미사용

**File:** `apps/web/components/booking/seat-map-viewer.tsx:13-31`
**Issue:** `SeatMapViewerProps` interface에 `maxSelect: number`가 정의되어 있고 테스트와 호출부에서 전달되지만, 함수 시그니처(line 25-31) 구조분해에서 제외되어 컴포넌트 내부에서 사용되지 않는다. Dead prop으로 남아 계약 의도가 모호하다 — 실제로 `onSeatClick` 전에 선택 개수 제한을 걸어야 하는지 아니면 상위에서 처리하는지 읽는 사람이 혼란스럽다.
**Fix:** 정책을 먼저 확정한 뒤 둘 중 하나로 처리:
```tsx
// 옵션 A — 상위에서만 검사하고 viewer는 관심 없음: prop 제거
interface SeatMapViewerProps {
  svgUrl: string;
  seatConfig: SeatMapConfig;
  seatStates: Map<string, SeatState>;
  selectedSeatIds: Set<string>;
  onSeatClick: (seatId: string) => void;
  // maxSelect 제거
}

// 옵션 B — viewer가 직접 가드: handleClick에서 early return
const handleClick = useCallback(
  (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<SVGElement>('[data-seat-id]');
    if (!target) return;
    const seatId = target.getAttribute('data-seat-id');
    if (!seatId) return;
    const state = seatStates.get(seatId) ?? 'available';
    if (state === 'sold') return;
    // maxSelect 체크: 이미 선택되지 않은 좌석을 새로 누를 때만 한도 검사
    if (!selectedSeatIds.has(seatId) && selectedSeatIds.size >= maxSelect) return;
    onSeatClick(seatId);
  },
  [seatStates, selectedSeatIds, onSeatClick, maxSelect],
);
```

### WR-03: viewer의 DOMParser 결과에 parsererror 가드 누락

**File:** `apps/web/components/booking/seat-map-viewer.tsx:142-145`
**Issue:** `DOMParser.parseFromString()` 호출 직후 admin(`svg-preview.tsx:51-57`)과 `prefix-svg-defs-ids.ts:35`는 `doc.documentElement.tagName === 'parsererror'`를 체크하는데, viewer의 `processedSvg` useMemo는 체크 없이 바로 `querySelectorAll('[data-seat-id]')`를 수행한다. R2 fetch로 받은 SVG가 손상되었거나 CDN이 HTML 에러 페이지를 반환하는 엣지 케이스에서 viewer가 parsererror tagName의 문서를 그대로 rendering하여 빈 SVG + 깨진 STAGE 배지가 화면에 나올 수 있다.
**Fix:**
```tsx
const processedSvg = useMemo(() => {
  if (!rawSvg) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  // admin/prefix-svg-defs-ids와 통일된 parsererror 가드
  if (
    doc.documentElement.tagName === 'parsererror' ||
    doc.querySelector('parsererror')
  ) {
    return null; // 아래 render에서 "좌석 배치도가 준비되지 않았습니다" 분기로 fallback
  }
  const seats = doc.querySelectorAll('[data-seat-id]');
  // ...
}, [rawSvg, seatStates, selectedSeatIds, tierColorMap, pendingRemovals]);
```
또는 `useEffect`의 fetch 성공 분기에서 parse 결과를 검증하여 `setError`로 명확한 에러 상태를 표출하는 것도 동등한 선택지이다.

## Info

### IN-01: `handleClick` useCallback에 사용되지 않는 `selectedSeatIds` 의존성

**File:** `apps/web/components/booking/seat-map-viewer.tsx:356-371`
**Issue:** `handleClick` 내부에서 `selectedSeatIds`를 직접 참조하지 않는데도 deps 배열에 포함되어 있다. `selectedSeatIds`가 바뀔 때마다 새 함수 레퍼런스가 만들어져 불필요한 자식 리렌더 유발 가능성이 있다.
**Fix:**
```tsx
const handleClick = useCallback(
  (e: React.MouseEvent) => {
    // ... 내부에서 selectedSeatIds 사용 없음 ...
  },
  [seatStates, onSeatClick], // selectedSeatIds 제거
);
```
WR-02 옵션 B처럼 `maxSelect` 정책을 내부에 두기로 결정하면 `selectedSeatIds.size`와 `selectedSeatIds.has(...)`가 실제 사용되므로 deps에 유지해야 한다. 어느 쪽이든 "실제 사용 여부"와 "deps"를 일치시켜야 한다.

### IN-02: `handleMouseOut` useCallback에 사용되지 않는 `tierColorMap` 의존성

**File:** `apps/web/components/booking/seat-map-viewer.tsx:421-444`
**Issue:** `handleMouseOut` 내부에서 `tierColorMap`을 참조하지 않는데 deps 배열에 포함되어 있다. `tierColorMap`은 `seatConfig`에 따라 재생성되므로 seatConfig 변경 시 불필요하게 새 함수가 생긴다.
**Fix:**
```tsx
const handleMouseOut = useCallback(
  (e: React.MouseEvent) => {
    // ... tierColorMap 미사용 ...
  },
  [seatStates, selectedSeatIds], // tierColorMap 제거
);
```

### IN-03: `svg-preview.tsx`의 좌석 수 카운팅이 문자열 정규식 기반

**File:** `apps/web/components/admin/svg-preview.tsx:103`
**Issue:** `(text.match(/data-seat-id/g) || []).length`는 SVG 원문에 `data-seat-id`라는 문자열이 등장하는 횟수를 센다. 주석 내 문자열, 중복 속성, 다른 tag의 속성 이름에 우연히 포함된 substring까지 카운트될 수 있다. 이미 위에서 `DOMParser`로 파싱한 `doc`이 있으므로 동일한 파서로 카운트하는 편이 정확하고 의도도 명확하다.
**Fix:**
```tsx
// 위에서 이미 parse한 doc 재사용 (line 46-49의 doc을 useCallback scope에 보관)
const seatCount = doc.querySelectorAll('[data-seat-id]').length;
setTotalSeats(seatCount);
```

### IN-04: `prefixSvgDefsIds` serialize 후 문자열 regex 치환이 예상 외 위치를 건드릴 수 있음

**File:** `apps/web/components/booking/__utils__/prefix-svg-defs-ids.ts:47-55`
**Issue:** `XMLSerializer`로 전체 SVG를 string으로 만든 뒤 `url(#oldId)`를 regex로 전역 치환한다. 문서 내 주석, text node(예: `<text>url(#grad1)</text>`), CDATA 안에 동일 패턴이 리터럴로 들어 있으면 의도와 무관하게 치환된다. 현재 좌석맵 SVG에서는 거의 발생하지 않는 케이스지만, 향후 admin이 다양한 SVG를 업로드하기 시작하면 surprise가 될 수 있다. 더 안전한 대안은 DOM 기반으로 `fill`/`stroke` 속성과 `style` 속성의 `url(...)` 값만 덮어쓰는 것이다. 문서 주석에서 이미 `<use href="#id">` 미커버를 인지하고 있으므로 같은 섹션에 이 한계를 명시하는 것도 좋다.
**Fix:** 당장은 문서 주석에 한계 추가 + 향후 케이스 발견 시 DOM 기반 치환으로 전환하는 것을 권장. 간단한 DOM 기반 예시:
```ts
// fill/stroke 속성만 치환 — style 안의 url()은 별도 처리 필요
idMap.forEach((newId, oldId) => {
  const old = `url(#${oldId})`;
  const neu = `url(#${newId})`;
  doc.querySelectorAll(`[fill="${old}"]`).forEach((n) =>
    n.setAttribute('fill', neu),
  );
  doc.querySelectorAll(`[stroke="${old}"]`).forEach((n) =>
    n.setAttribute('stroke', neu),
  );
});
```

### IN-05: `handleSvgUpload` useCallback deps에 state setter 누락 (명시 권장)

**File:** `apps/web/components/admin/svg-preview.tsx:111`
**Issue:** `useCallback(..., [presignedUpload])`가 `setSvgUrl`, `setTotalSeats`를 참조하는데 deps에 없다. React의 setter는 stable identity라 동작상 문제는 없지만 exhaustive-deps rule에 따라 일부 ESLint 설정에서는 경고가 나올 수 있다. 또한 `presignedUpload` 객체 자체가 deps이면 hook이 내부적으로 새 객체 반환 시 매 렌더마다 함수가 재생성된다(`mutateAsync`는 stable일 확률이 높지만 `isPending` 변화로 객체 identity가 바뀔 수 있다).
**Fix:** setter 명시는 취향 영역이지만, 다음과 같이 좁히면 불필요한 재생성을 막을 수 있다:
```tsx
const presignedUploadMutate = presignedUpload.mutateAsync;
const handleSvgUpload = useCallback(
  async (file: File) => {
    // ... presignedUpload.mutateAsync → presignedUploadMutate 로 치환
  },
  [presignedUploadMutate],
);
```

### IN-06: `hot-section.tsx` / `new-section.tsx` "더보기" 링크 하드코딩

**File:** `apps/web/components/home/hot-section.tsx:22-27`, `apps/web/components/home/new-section.tsx:18-23`
**Issue:** HOT/신규 오픈 섹션의 "더보기" 링크가 `/genre/musical?sort=popular` / `/genre/musical?sort=latest`로 musical 장르에 고정되어 있다. HOT과 신규 오픈은 모든 장르를 아우르는 섹션이므로 사용자가 "더보기"를 눌렀을 때 musical 장르로만 필터링되는 것은 의도와 어긋난다. Info 레벨로 남기는 이유는 제품 의도 여부가 코드만 봐서는 확정되지 않아서이다.
**Fix:** 제품 의도가 "전체 장르의 HOT/신규"라면 `/search?sort=popular` 같은 전용 목록 페이지가 필요하다. Phase 외 이슈로 트래킹하거나 현재 링크가 의도된 것이라면 주석으로 명시하는 것을 권장.
```tsx
// 예: 전체 장르 목록이 존재할 때
<Link href="/performances?sort=popular" className="text-sm text-gray-600 hover:text-gray-900">
  더보기
</Link>
```

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
