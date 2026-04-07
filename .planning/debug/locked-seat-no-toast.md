---
status: resolved
trigger: "잠근 좌석이 회색으로 변경되고 아예 선택이 되지 않아 토스트 알림이 뜨지 않음"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - seat-map-viewer.tsx의 handleClick이 locked 좌석 클릭을 완전히 무시하고, 어디에도 locked 좌석 클릭 시 토스트를 표시하는 코드가 없음
test: handleClick의 조건문 분석 완료
expecting: locked 상태일 때 onSeatClick이 호출되지 않는 것 확인
next_action: 진단 결과 보고

## Symptoms

expected: 다른 사용자가 이미 잠근 좌석을 선택하려 하면 토스트 알림이 표시되고 해당 좌석의 낙관적 선택이 되돌려진다
actual: 잠근 좌석의 클릭이 회색으로 변경되고 아예 선택이 되지 않아 토스트 알림이 뜨지 않음
errors: 없음 (에러가 아닌 동작 누락)
reproduction: WebSocket으로 실시간 좌석 업데이트를 받아 좌석이 locked 상태로 바뀐 뒤, 해당 좌석 클릭
started: Phase 03 구현 이후

## Eliminated

## Evidence

- timestamp: 2026-04-02T00:01:00Z
  checked: seat-map-viewer.tsx handleClick (106-124행)
  found: 119행 조건문 `if (state === 'available' || isSelected)` — locked 좌석은 state가 'locked'이고 isSelected도 false이므로 onSeatClick이 호출되지 않음. 클릭 이벤트가 완전히 삼켜진다(swallowed).
  implication: locked 좌석 클릭 시 booking-page.tsx의 handleSeatClick에 도달 불가

- timestamp: 2026-04-02T00:02:00Z
  checked: booking-page.tsx handleSeatClick (183-262행)
  found: locked 좌석에 대한 토스트 로직이 없음. 토스트는 (1) MAX_SEATS 초과 시와 (2) lockSeat API 409 응답 시에만 발생. locked 좌석은 handleClick 게이트에서 이미 차단되므로 409 경로에도 도달 불가.
  implication: handleSeatClick이 호출되더라도 locked 상태를 체크하고 토스트를 보여주는 분기가 존재하지 않음

- timestamp: 2026-04-02T00:03:00Z
  checked: use-socket.ts seat-update 이벤트 (48-76행)
  found: 다른 사용자가 내가 이미 선택한 좌석을 잠갔을 때만 토스트 + removeSeat 실행. 이것은 "이미 선택 중인 좌석이 뺏기는" 시나리오이지, "이미 locked인 좌석을 새로 클릭하는" 시나리오와는 다름.
  implication: use-socket.ts의 토스트는 다른 유즈케이스를 커버하는 것이며, locked 좌석 클릭에 대한 피드백은 시스템 어디에서도 제공하지 않음

## Resolution

root_cause: seat-map-viewer.tsx의 handleClick (119행)이 `state === 'available' || isSelected` 조건으로 locked/sold 좌석 클릭을 완전히 무시(silent drop)하며, 코드베이스 전체에 locked 좌석 클릭 시 사용자 피드백(토스트)을 제공하는 로직이 존재하지 않음
fix:
verification:
files_changed: []
