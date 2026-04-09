---
status: diagnosed
phase: 03-seat-map-real-time
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 서버(api + web)를 완전히 종료 후 재시작. 에러 없이 부팅되고, 기본 API 호출(/api/v1/health 등)이 정상 응답한다.
result: pass

### 2. 예매 페이지 접근
expected: /booking/[performanceId] 경로로 이동하면 GNB/Footer 없는 독립 레이아웃으로 예매 페이지가 렌더링된다. 공연 제목이 헤더에 표시되고, 뒤로가기 버튼이 있다.
result: pass

### 3. 날짜 선택 (DatePicker)
expected: 캘린더가 표시되고, 회차가 없는 날짜는 비활성화(disabled)된다. 날짜를 선택하면 해당 날짜의 회차 목록이 로드된다.
result: pass

### 4. 회차 선택 (ShowtimeChips)
expected: 선택한 날짜의 회차들이 칩(chip) 형태로 표시된다. 칩을 선택하면 활성 상태로 변하고, 좌석맵이 로드된다. 회차가 없으면 빈 상태 메시지가 표시된다.
result: pass

### 5. SVG 좌석맵 렌더링 + 줌/팬
expected: 회차 선택 후 SVG 좌석맵이 렌더링된다. 마우스 휠로 줌, 드래그로 팬이 가능하다. 줌 인/아웃/리셋 버튼이 플로팅으로 표시된다. 좌석 등급별 색상이 범례(legend)에 표시된다.
result: pass

### 6. 좌석 선택/해제
expected: 빈 좌석을 클릭하면 선택 상태(색상 변경)로 바뀌고, 우측 패널(데스크톱) 또는 하단 시트(모바일)에 선택한 좌석 정보와 합계 금액이 표시된다. 선택된 좌석을 다시 클릭하면 해제된다.
result: pass

### 7. 4석 제한
expected: 이미 4석을 선택한 상태에서 5번째 좌석을 클릭하면 선택이 거부되고 에러 메시지/토스트가 표시된다.
result: pass

### 8. 카운트다운 타이머
expected: 첫 좌석 선택 시 헤더에 카운트다운 타이머가 시작된다 (10분). MM:SS 형식으로 표시되며, 잔여 3분 이하가 되면 빨간색으로 변한다.
result: pass

### 9. 타이머 만료 모달
expected: 타이머가 0에 도달하면 닫을 수 없는 모달이 나타나고, 선택한 좌석이 해제된다. "처음으로" 버튼을 누르면 초기 상태로 돌아간다.
result: issue
reported: "모달창 ui가 깨져있음 수정해야됨"
severity: cosmetic

### 10. 실시간 좌석 업데이트 (WebSocket)
expected: 두 개의 브라우저 탭에서 같은 회차를 열고, 한 쪽에서 좌석을 선택하면 다른 쪽의 좌석맵에서 해당 좌석이 실시간으로 잠금(locked) 상태로 변한다.
result: pass

### 11. 레이스 컨디션 처리
expected: 다른 사용자가 이미 잠근 좌석을 선택하려 하면, 토스트 알림이 표시되고 해당 좌석의 낙관적 선택이 되돌려진다.
result: issue
reported: "잠근 좌석의 클릭이 회색으로 변경되고 아예 선택이 되지않아 토스트 알림이 뜨지않음"
severity: major

### 12. 모바일 바텀시트
expected: 모바일 뷰포트에서 좌석을 선택하면 하단 바텀시트가 자동으로 펼쳐진다. 드래그로 확장/축소가 가능하고, 선택한 좌석 목록과 합계가 표시된다.
result: issue
reported: "모바일 뷰포트의 ui가 개판이라 테스트 불가"
severity: major

## Summary

total: 12
passed: 10
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "타이머가 0에 도달하면 닫을 수 없는 모달이 나타나고, 선택한 좌석이 해제된다. 처음으로 버튼을 누르면 초기 상태로 돌아간다."
  status: failed
  reason: "User reported: 모달창 ui가 깨져있음 수정해야됨"
  severity: cosmetic
  test: 9
  root_cause: "AlertDialogFooter의 size=sm 2열 그리드가 버튼 1개에 적용되어 레이아웃 깨짐 + Button variant h-9와 className h-12 충돌 + Header grid와 flex 충돌"
  artifacts:
    - path: "apps/web/components/booking/timer-expired-modal.tsx"
      issue: "size=sm으로 Footer 2열 그리드 트리거, h-12와 Button h-9 충돌, Header flex/grid 충돌"
    - path: "apps/web/components/ui/alert-dialog.tsx"
      issue: "size=sm일 때 Footer가 무조건 grid-cols-2, AlertDialogAction의 Button size와 className 충돌"
  missing:
    - "size=sm 제거하거나 Footer 그리드 오버라이드"
    - "AlertDialogAction의 h-12를 Button size prop으로 대체"
    - "Header의 flex/grid 충돌 해결"
  debug_session: ""
- truth: "다른 사용자가 이미 잠근 좌석을 선택하려 하면, 토스트 알림이 표시되고 해당 좌석의 낙관적 선택이 되돌려진다."
  status: failed
  reason: "User reported: 잠근 좌석의 클릭이 회색으로 변경되고 아예 선택이 되지않아 토스트 알림이 뜨지않음"
  severity: major
  test: 11
  root_cause: "seat-map-viewer.tsx handleClick(119행)이 state===available||isSelected 조건으로 locked 좌석 클릭을 완전히 무시하여 onSeatClick에 도달하지 못하고, booking-page.tsx handleSeatClick에도 locked 상태 토스트 분기가 없음"
  artifacts:
    - path: "apps/web/components/booking/seat-map-viewer.tsx"
      issue: "119행: locked 좌석 클릭 시 onSeatClick을 호출하지 않고 silent return"
    - path: "apps/web/components/booking/booking-page.tsx"
      issue: "handleSeatClick에 locked 상태 체크 및 토스트 로직 부재"
  missing:
    - "locked 좌석 클릭 시에도 onSeatClick 호출하도록 조건 변경"
    - "handleSeatClick에 locked 상태 토스트 분기 추가"
  debug_session: ".planning/debug/locked-seat-no-toast.md"
- truth: "모바일 뷰포트에서 좌석을 선택하면 하단 바텀시트가 자동으로 펼쳐진다. 드래그로 확장/축소가 가능하고, 선택한 좌석 목록과 합계가 표시된다."
  status: failed
  reason: "User reported: 모바일 뷰포트의 ui가 개판이라 테스트 불가"
  severity: major
  test: 12
  root_cause: "booking-page.tsx의 flex gap-8이 모바일에서 flex-col로 전환되지 않아 콘텐츠가 가로 배치되고, 바텀시트가 main 콘텐츠를 가리며, DatePicker 캘린더가 고정 크기로 오버플로우하는 복합적 반응형 CSS 부재"
  artifacts:
    - path: "apps/web/components/booking/booking-page.tsx"
      issue: "L357 flex gap-8이 모바일에서 flex-col 미전환, main에 바텀시트 대비 하단 패딩 없음"
    - path: "apps/web/components/booking/seat-selection-sheet.tsx"
      issue: "바텀시트 fixed z-40이 main 콘텐츠를 가림, 동적 패딩 연동 없음"
    - path: "apps/web/components/booking/date-picker.tsx"
      issue: "day 셀 size-10 고정으로 320px 뷰포트에서 오버플로우"
    - path: "apps/web/components/booking/seat-map-controls.tsx"
      issue: "z-10이 바텀시트 z-40보다 낮아 컨트롤 버튼이 가려짐"
  missing:
    - "flex gap-8 -> flex flex-col lg:flex-row lg:gap-8"
    - "main에 pb-24 lg:pb-4 하단 패딩 추가"
    - "DatePicker day 셀 size-8 sm:size-10 반응형 변경"
    - "seat-map-controls z-index를 z-50으로 상향 또는 bottom-20 lg:bottom-4로 위치 조정"
  debug_session: ".planning/debug/mobile-ui-broken.md"
