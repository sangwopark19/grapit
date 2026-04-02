---
status: investigating
trigger: "Phase 03 UAT: 모바일 뷰포트의 UI가 개판이라 테스트 불가 (severity: major)"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Focus

hypothesis: booking-page.tsx의 레이아웃이 모바일 반응형 처리 없이 데스크톱 전용 구조(flex row + gap-8 + 360px 사이드패널)로 되어 있고, 바텀시트가 main 콘텐츠의 하단 패딩 없이 겹치며, DatePicker 캘린더가 모바일 폭을 오버플로우함
test: 코드 정적 분석 완료
expecting: 복합적 모바일 레이아웃 문제 확인
next_action: 근본 원인 정리 및 보고

## Symptoms

expected: 모바일 뷰포트에서 좌석 선택 시 하단 바텀시트 자동 펼침, 드래그 확장/축소, 선택 좌석 목록과 합계 표시
actual: 모바일 뷰포트의 UI가 개판이라 테스트 불가. 데스크톱은 정상.
errors: UI 레이아웃 깨짐 (구체적 에러 메시지 없음)
reproduction: 데스크톱에서 정상 동작하는 상태에서 모바일 뷰포트로 전환
started: Phase 03 UAT 시점

## Eliminated

## Evidence

- timestamp: 2026-04-02T00:01:00Z
  checked: booking-page.tsx 메인 레이아웃 구조
  found: |
    L357: <div className="flex gap-8"> -- 모바일에서도 flex-row + gap-8(32px) 적용.
    데스크톱 사이드패널(SeatSelectionPanel)은 hidden lg:block이라 모바일에서 숨겨지지만,
    gap-8은 여전히 적용됨. 더 중요한 것은 flex-row 방향이 모바일에서도 유지되어
    좌석맵 등 자식 요소가 수평으로 배치 시도.
  implication: 모바일에서 레이아웃 방향이 세로가 아닌 가로로 유지되어 콘텐츠가 넘침

- timestamp: 2026-04-02T00:02:00Z
  checked: booking-page.tsx 바텀시트와 main 콘텐츠 관계
  found: |
    SeatSelectionSheet는 fixed bottom-0으로 화면 하단에 고정(L107-110).
    collapsed 높이 72px, expanded 높이 60vh.
    그런데 main 콘텐츠(L356)에 하단 패딩이 없음(py-4만 있음).
    바텀시트가 펼쳐지면 main 콘텐츠의 하단 영역을 완전히 덮어버림.
  implication: 좌석맵 하단이 바텀시트에 가려져 상호작용 불가

- timestamp: 2026-04-02T00:03:00Z
  checked: date-picker.tsx 캘린더 모바일 대응
  found: |
    DayPicker의 day 셀: size-10(40px) 고정. 7열 = 280px + gap/padding.
    day_button도 size-10 고정. week/weekdays는 flex만 있고 반응형 조정 없음.
    nav는 absolute inset-x-0으로 위치하는데, 좁은 화면에서 캘린더 좌우 화살표가
    날짜 셀과 겹칠 수 있음.
  implication: 캘린더가 작은 화면에서 오버플로우하거나 터치 영역이 겹칠 수 있음

- timestamp: 2026-04-02T00:04:00Z
  checked: seat-map-viewer.tsx 모바일 대응
  found: |
    TransformComponent의 wrapperClass="w-full min-h-[300px] lg:min-h-[500px]"
    min-h-[300px]은 모바일에서도 적용되지만, SVG가 매우 넓을 경우
    가로 스크롤이 발생할 수 있음. 단, zoom-pan-pinch가 이를 처리해줌.
    SeatMapControls가 absolute bottom-4 right-4로 위치하는데,
    바텀시트(z-40)와 z-index 충돌 가능(컨트롤은 z-10).
  implication: 좌석맵 컨트롤이 바텀시트 아래에 가려질 수 있음

- timestamp: 2026-04-02T00:05:00Z
  checked: seat-selection-sheet.tsx 바텀시트 높이 계산
  found: |
    COLLAPSED_HEIGHT = 72px(고정).
    EXPANDED_RATIO = 0.6 (60vh).
    getCurrentHeight()는 isExpanded ? 60vh : 72px 반환.
    sheetHeight를 style.height로 직접 적용.
    문제: 바텀시트가 차지하는 만큼 main 콘텐츠에 padding-bottom이 필요하나 없음.
  implication: 모바일에서 바텀시트가 콘텐츠를 가림

- timestamp: 2026-04-02T00:06:00Z
  checked: 전체 레이아웃 스택 (root layout -> booking layout -> booking page)
  found: |
    root layout: body에 flex min-h-screen flex-col.
    booking layout: div에 flex min-h-dvh flex-col bg-white.
    layout-shell: booking 경로에서 GNB/Footer 숨김 (올바름).
    booking-page: flex flex-1 flex-col (올바름).
    하지만 main 내부의 flex gap-8 div가 모바일에서 flex-col로 전환되지 않음.
  implication: 레이아웃 스택 자체는 올바르나, booking-page 내부 2-column 레이아웃이 모바일에서 깨짐

## Resolution

root_cause: booking-page.tsx의 2-column 레이아웃(L357 `flex gap-8`)이 모바일에서 `flex-col`로 전환되지 않아 콘텐츠가 가로로 배치되고, 바텀시트(fixed, 72px~60vh)가 올라올 때 main 콘텐츠에 하단 패딩이 없어 콘텐츠를 가리며, DatePicker 캘린더 셀이 고정 크기(size-10)로 작은 화면에서 오버플로우하는 복합적 반응형 CSS 부재 문제
fix:
verification:
files_changed: []
