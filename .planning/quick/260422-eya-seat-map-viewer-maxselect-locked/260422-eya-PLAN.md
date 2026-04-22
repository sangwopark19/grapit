---
phase: quick-260422-eya
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/booking/seat-map-viewer.tsx
  - apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
autonomous: true
requirements:
  - PR18-CR-MAXSELECT-LOCKED
must_haves:
  truths:
    - "사용자가 maxSelect(4석) 모두 선택한 상태에서 locked 좌석을 클릭하면 parent toast '이미 다른 사용자가 선택한 좌석입니다'가 표시된다"
    - "sold 좌석은 maxSelect 도달 여부와 무관하게 viewer에서 계속 차단된다 (onSeatClick 미호출)"
    - "available 좌석은 maxSelect 도달 시 viewer에서 차단된다 (기존 WR-02 fix 동작 유지)"
    - "기존 vitest 136 케이스 + 신규 케이스 모두 GREEN"
  artifacts:
    - path: apps/web/components/booking/seat-map-viewer.tsx
      provides: "handleClick의 가드 순서 — sold 차단 > locked 위임(maxSelect 우회) > maxSelect 가드 > onSeatClick"
      contains: "state === 'locked'"
    - path: apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
      provides: "maxSelect=N 도달 + locked 좌석 클릭 시 onSeatClick 호출 검증"
      contains: "maxSelect"
  key_links:
    - from: "seat-map-viewer.tsx::handleClick"
      to: "booking-page.tsx::handleSeatClick"
      via: "onSeatClick(seatId) 콜백"
      pattern: "onSeatClick\\(seatId\\)"
    - from: "booking-page.tsx::handleSeatClick"
      to: "toast.info('이미 다른 사용자가 선택한 좌석입니다')"
      via: "seatState === 'locked' 분기 (라인 190)"
      pattern: "이미 다른 사용자가 선택한 좌석입니다"
---

<objective>
PR #18 코드리뷰 regression 수정: `seat-map-viewer.tsx::handleClick`의 maxSelect 가드(WR-02 fix, commit c7036e5)가 locked 좌석 클릭까지 차단해서 parent의 "이미 다른 사용자가 선택한 좌석입니다" toast가 표시되지 않는 문제를 해결한다.

Purpose: commit `45b884e`에서 확립된 invariant — "locked 좌석은 sold와 분리하여 viewer에서 막지 않고 parent에 위임" — 을 복원한다. parent `booking-page.tsx::handleSeatClick`(라인 184-208)은 이미 locked → toast → return 분기를 가지므로 viewer가 onSeatClick 호출만 보장하면 정상 복구된다.

Output: handleClick 가드 한 줄 수정 + 회귀 방지 테스트 1건 추가. vitest 136/136 + 신규 1 = 137 GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@apps/web/components/booking/seat-map-viewer.tsx
@apps/web/components/booking/__tests__/seat-map-viewer.test.tsx
@apps/web/components/booking/booking-page.tsx

<interfaces>
<!-- 핵심 컨트랙트 — 코드베이스 탐색 없이 바로 사용 -->

From apps/web/components/booking/seat-map-viewer.tsx (현재 버그 라인 382-388):
```typescript
const state = seatStates.get(seatId) ?? 'available';
if (state === 'sold') return;
// 새로 선택하는 좌석이고 한도 초과면 무시 (해제는 항상 허용)
if (!selectedSeatIds.has(seatId) && selectedSeatIds.size >= maxSelect) {
  return;  // ← 버그: locked 좌석도 여기서 차단됨
}
onSeatClick(seatId);
```

From apps/web/components/booking/booking-page.tsx::handleSeatClick (라인 184-208 — 정상 동작 중, 건드리지 말 것):
```typescript
const handleSeatClick = useCallback(
  (seatId: string) => {
    if (!selectedShowtimeId) return;

    // Locked seat: show toast and return  ← viewer가 onSeatClick만 호출하면 여기로 도달
    const seatState = seatStatesMap.get(seatId);
    if (seatState === 'locked' && !selectedSeatIds.has(seatId)) {
      toast.info('이미 다른 사용자가 선택한 좌석입니다');
      return;
    }

    // If already selected -> deselect
    if (selectedSeatIds.has(seatId)) { ... }

    // Max seats check (parent의 1차 방어선)
    if (selectedSeats.length >= MAX_SEATS) { ... }
    ...
  }
);
```

From apps/web/components/booking/__tests__/seat-map-viewer.test.tsx (라인 165-189, 기존 케이스 — maxSelect 도달 케이스 미커버):
```typescript
it('calls onSeatClick when clicking a locked seat (parent handles toast)', async () => {
  // selectedSeatIds=Set() (빈 상태) — maxSelect 도달 케이스 X
  ...
});
```

`SeatState` 타입 (from @grapit/shared): `'available' | 'locked' | 'sold'`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: handleClick 가드 순서 수정 + 회귀 테스트 추가</name>
  <files>apps/web/components/booking/__tests__/seat-map-viewer.test.tsx, apps/web/components/booking/seat-map-viewer.tsx</files>
  <behavior>
    신규 테스트 케이스 (RED → GREEN):
    - 시나리오: maxSelect=2, selectedSeatIds={A-1, A-2} (한도 도달), seatStates={B-1: 'locked'} 상태에서 B-1 클릭
    - 기대: onSeatClick('B-1') 호출됨 (parent로 위임 → parent가 toast 표시)
    - 회귀 방지: 동일 시나리오에서 seatStates={B-1: 'sold'}이면 onSeatClick 호출되지 않아야 함 (sold는 viewer 차단 유지)
    - 추가 회귀 방지: maxSelect=2, selectedSeatIds={A-1, A-2}, seatStates={B-1: 'available'}이면 onSeatClick 호출되지 않아야 함 (WR-02 fix 동작 유지)
  </behavior>
  <action>
**Step 1 — RED: 회귀 테스트 추가**

`apps/web/components/booking/__tests__/seat-map-viewer.test.tsx`의 라인 165 "calls onSeatClick when clicking a locked seat" 케이스 바로 아래에 다음 신규 it 블록 추가 (PR18-CR-MAXSELECT-LOCKED 라벨 포함):

```typescript
it('PR18-CR-MAXSELECT-LOCKED: maxSelect 도달 후에도 locked 좌석 클릭은 parent로 위임된다', async () => {
  const onSeatClick = vi.fn();
  const seatStates = new Map<string, SeatState>([
    ['A-1', 'available'],
    ['A-2', 'available'],
    ['B-1', 'locked'],
  ]);

  const { container } = render(
    <SeatMapViewer
      svgUrl="https://example.com/seats.svg"
      seatConfig={mockSeatConfig}
      seatStates={seatStates}
      selectedSeatIds={new Set(['A-1', 'A-2'])}
      onSeatClick={onSeatClick}
      maxSelect={2}
    />,
  );

  await waitFor(() => {
    expect(container.querySelector('[data-seat-id="B-1"]')).toBeTruthy();
  });

  const seatB1 = container.querySelector('[data-seat-id="B-1"]')!;
  fireEvent.click(seatB1);
  expect(onSeatClick).toHaveBeenCalledWith('B-1');
});

it('PR18-CR-MAXSELECT-LOCKED 회귀 방지: maxSelect 도달 시 sold 좌석은 여전히 viewer에서 차단', async () => {
  const onSeatClick = vi.fn();
  const seatStates = new Map<string, SeatState>([
    ['A-1', 'available'],
    ['A-2', 'available'],
    ['B-1', 'sold'],
  ]);

  const { container } = render(
    <SeatMapViewer
      svgUrl="https://example.com/seats.svg"
      seatConfig={mockSeatConfig}
      seatStates={seatStates}
      selectedSeatIds={new Set(['A-1', 'A-2'])}
      onSeatClick={onSeatClick}
      maxSelect={2}
    />,
  );

  await waitFor(() => {
    expect(container.querySelector('[data-seat-id="B-1"]')).toBeTruthy();
  });

  const seatB1 = container.querySelector('[data-seat-id="B-1"]')!;
  fireEvent.click(seatB1);
  expect(onSeatClick).not.toHaveBeenCalled();
});

it('PR18-CR-MAXSELECT-LOCKED 회귀 방지: maxSelect 도달 시 available 좌석은 viewer에서 차단 (WR-02 유지)', async () => {
  const onSeatClick = vi.fn();
  const seatStates = new Map<string, SeatState>([
    ['A-1', 'available'],
    ['A-2', 'available'],
    ['B-1', 'available'],
  ]);

  const { container } = render(
    <SeatMapViewer
      svgUrl="https://example.com/seats.svg"
      seatConfig={mockSeatConfig}
      seatStates={seatStates}
      selectedSeatIds={new Set(['A-1', 'A-2'])}
      onSeatClick={onSeatClick}
      maxSelect={2}
    />,
  );

  await waitFor(() => {
    expect(container.querySelector('[data-seat-id="B-1"]')).toBeTruthy();
  });

  const seatB1 = container.querySelector('[data-seat-id="B-1"]')!;
  fireEvent.click(seatB1);
  expect(onSeatClick).not.toHaveBeenCalled();
});
```

테스트 실행으로 RED 확인:
```bash
pnpm --filter @grapit/web exec vitest run components/booking/__tests__/seat-map-viewer.test.tsx -t "PR18-CR-MAXSELECT-LOCKED"
```

→ "maxSelect 도달 후에도 locked 좌석 클릭은 parent로 위임된다" 케이스가 FAIL해야 함 (`onSeatClick` 미호출). 나머지 2건은 PASS.

**Step 2 — GREEN: handleClick 가드 순서 수정**

`apps/web/components/booking/seat-map-viewer.tsx` 라인 382-388의 가드를 다음과 같이 수정:

```typescript
const state = seatStates.get(seatId) ?? 'available';
if (state === 'sold') return;
// 새로 선택하는 좌석이고 한도 초과면 무시 (해제는 항상 허용).
// locked는 parent로 위임하여 toast 표시 (D-13 invariant).
if (
  state !== 'locked' &&
  !selectedSeatIds.has(seatId) &&
  selectedSeatIds.size >= maxSelect
) {
  return;
}
onSeatClick(seatId);
```

**가드 의미 (코멘트 1줄로만 표기 — CLAUDE.md 코멘트 최소화 준수):**
- `sold` → viewer 차단 (기존)
- `locked` (미선택) → maxSelect 우회하여 parent로 위임 → parent가 toast (commit 45b884e invariant)
- `available` (미선택, 한도 도달) → viewer 차단 (WR-02 유지)
- 이미 선택된 좌석 → 항상 onSeatClick 호출 (해제 허용)

기존의 review WR-02 + IN-01 코멘트 블록(라인 368-371)은 유지하되, 인라인 코멘트는 위 패치의 1줄로 압축.

**Step 3 — 전체 테스트 GREEN 확인:**
```bash
pnpm --filter @grapit/web exec vitest run components/booking/__tests__/seat-map-viewer.test.tsx
```

→ 기존 11 케이스 + 신규 3 케이스 모두 GREEN.

**Step 4 — 전체 web 패키지 회귀 검사:**
```bash
pnpm --filter @grapit/web exec vitest run
```

→ 136 + 3 = 139 GREEN (기존 136 무회귀).

**Step 5 — typecheck + lint:**
```bash
pnpm --filter @grapit/web typecheck
pnpm --filter @grapit/web lint
```
  </action>
  <verify>
    <automated>pnpm --filter @grapit/web exec vitest run components/booking/__tests__/seat-map-viewer.test.tsx && pnpm --filter @grapit/web exec vitest run && pnpm --filter @grapit/web typecheck && pnpm --filter @grapit/web lint</automated>
  </verify>
  <done>
    - seat-map-viewer.tsx::handleClick에 `state !== 'locked' && ...` 가드 적용됨
    - PR18-CR-MAXSELECT-LOCKED 라벨 테스트 3건 모두 GREEN
    - 기존 vitest 136 케이스 무회귀 (총 139 GREEN)
    - typecheck/lint 통과
    - booking-page.tsx 미수정 (parent는 이미 정상)
  </done>
</task>

</tasks>

<verification>
1. **단위 테스트**: `pnpm --filter @grapit/web exec vitest run components/booking/__tests__/seat-map-viewer.test.tsx` → 14 GREEN (11 기존 + 3 신규)
2. **전체 회귀**: `pnpm --filter @grapit/web exec vitest run` → 139 GREEN (136 + 3)
3. **타입/린트**: `pnpm --filter @grapit/web typecheck && pnpm --filter @grapit/web lint` → 0 error
4. **수동 회귀 (선택)**: dev server에서 4석 선택 후 다른 사용자가 lock한 좌석 클릭 시 toast "이미 다른 사용자가 선택한 좌석입니다" 표시 확인
</verification>

<success_criteria>
- [ ] handleClick 가드에 `state !== 'locked'` 조건 추가됨 (라인 ~385)
- [ ] PR18-CR-MAXSELECT-LOCKED 라벨 신규 테스트 3건 GREEN
- [ ] 기존 vitest 136 케이스 무회귀
- [ ] typecheck + lint 0 error
- [ ] booking-page.tsx, prefix-svg-defs-ids.ts, 기타 파일 변경 없음
- [ ] 수정 코멘트는 1줄로 최소화 (CLAUDE.md 준수)
</success_criteria>

<output>
After completion, create `.planning/quick/260422-eya-seat-map-viewer-maxselect-locked/260422-eya-SUMMARY.md`
</output>
