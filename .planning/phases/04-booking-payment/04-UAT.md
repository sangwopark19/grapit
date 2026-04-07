---
status: partial
phase: 04-booking-payment
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-04-03T01:15:00Z
updated: 2026-04-06T09:15:00Z
---

## Current Test

[testing paused — 7 items blocked by Test 6 failure]

## Tests

### 1. Cold Start Smoke Test
expected: 서버(api, web)를 완전히 종료한 뒤 새로 시작합니다. API 서버가 에러 없이 부팅되고, DB 마이그레이션/스키마가 정상 반영되며, 헬스체크 또는 기본 API 호출이 정상 응답합니다.
result: pass

### 2. 예매 확인 페이지 레이아웃
expected: /booking/[performanceId]/confirm 페이지에 접근하면 상단 고정 카운트다운 헤더, 주문 요약(공연 정보 + 좌석 목록 + 총 금액), 예매자 정보, 약관 동의 섹션, 토스 결제 위젯이 모두 표시됩니다.
result: pass

### 3. 예매자 정보 수정
expected: 예매자 정보 섹션에서 수정 버튼을 클릭하면 이름/전화번호 편집 모드로 전환됩니다. 수정 후 저장하면 변경된 정보가 반영됩니다.
result: issue
reported: "전화번호에서 무조건 -를 붙이라고함"
severity: minor
fix: 8c0f984 — 하이픈 optional 패턴으로 변경

### 4. 약관 전체 동의
expected: '전체 동의' 체크박스를 클릭하면 하위 약관이 모두 체크됩니다. 개별 약관을 클릭하면 다이얼로그로 약관 내용을 확인할 수 있습니다. 모든 약관 동의 전에는 결제 버튼이 비활성화됩니다.
result: pass

### 5. 토스 결제 위젯 렌더링
expected: 확인 페이지에서 토스 결제 위젯이 인라인으로 렌더링되며, 카드/카카오페이/네이버페이/계좌이체 등 결제 수단이 표시됩니다.
result: pass

### 6. 결제 완료 페이지
expected: 결제 성공 후 /booking/[performanceId]/complete로 리다이렉트됩니다. 예약 번호, 공연 정보, 좌석 정보, 결제 금액이 표시되며, 메인/마이페이지 이동 CTA 버튼이 있습니다.
result: issue
reported: "리다이렉트 되지않음. 마이페이지에도 예매내역이 뜨지 않으며 결제시에도 오류가 있는거 같은게 퀵 계좌이체로 결제시도 시 비밀번호 입력 후 결제 누르면 다시 비밀번호를 입력하라고 떠서 한번더 입력하면 http://localhost:3000/booking/496d62da-d98d-4cda-ab62-431bff3d686c/complete?paymentType=NORMAL&orderId=GRP-1775466246682-BJ9CC&paymentKey=tgen_20260406180423uehd3&amount=330000 이 주소로 리다이렉트 되며 다음으로 진행되지 않고 스켈레톤 화면만 보임."
severity: blocker

### 7. 완료 페이지 새로고침 복구
expected: 결제 완료 페이지에서 브라우저 새로고침(F5)해도 orderId 쿼리 파라미터를 통해 예약 정보가 정상 로드되어 동일한 화면을 유지합니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 결제 완료 페이지 접근 불가"

### 8. 카운트다운 타이머 만료 처리
expected: 확인 페이지의 카운트다운 타이머가 0이 되면 결제가 불가능해지고, 좌석 선택 페이지로 돌아가도록 안내합니다. 3분 이하일 때 경고 스타일(색상 변경)이 적용됩니다.
result: pass

### 9. 마이페이지 예매 탭
expected: 마이페이지(/mypage)에서 '예매내역' 탭을 클릭하면 URL이 ?tab=reservations으로 변경되고, 예매 목록이 카드 형태로 표시됩니다. 포스터 이미지, 공연명, 날짜, 좌석 요약, 상태 배지가 각 카드에 포함됩니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 예매 데이터 없음"

### 10. 예매 상태 필터
expected: 예매 목록 상단에 상태 필터 칩(전체/확정/취소)이 표시됩니다. 필터를 클릭하면 해당 상태의 예매만 필터링되며, 전환 시 레이아웃 시프트 없이 부드럽게 변경됩니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 예매 데이터 없음"

### 11. 예매 상세 페이지
expected: 예매 카드를 클릭하면 /mypage/reservations/[id] 상세 페이지로 이동합니다. 공연 정보, 좌석 정보, 결제 정보, 취소 가능 기한이 표시됩니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 예매 데이터 없음"

### 12. 예매 취소 플로우
expected: 상세 페이지에서 '예매 취소' 버튼 클릭 시 AlertDialog가 나타납니다. 취소 사유를 선택하고 환불 예상 금액을 확인한 후 확인 버튼으로 취소를 진행합니다. 취소 기한이 지나면 취소 버튼이 비활성화됩니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 예매 데이터 없음"

### 13. 관리자 예매 대시보드
expected: /admin/bookings 페이지에 총 예매 수, 총 매출, 취소율 3개의 통계 카드가 표시됩니다. 각 카드에 아이콘, 라벨, 포맷된 값이 포함됩니다.
result: pass

### 14. 관리자 예매 검색 테이블
expected: 관리자 예매 목록이 테이블로 표시되며, 검색창에 입력하면 디바운스 후 검색 결과가 필터링됩니다. 각 행에 상태 배지와 주요 예매 정보가 표시됩니다. 스켈레톤 로딩이 적용됩니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 테스트 데이터 없음"

### 15. 관리자 예매 상세 + 환불 모달
expected: 테이블에서 예매 행을 클릭하면 상세 모달이 열립니다. 모달 내에서 환불 버튼을 클릭하면 인라인 환불 폼으로 전환되어 환불 사유를 입력하고 처리할 수 있습니다.
result: blocked
blocked_by: prior-phase
reason: "Test 6 실패 — 테스트 데이터 없음"

### 16. 관리자 사이드바 네비게이션
expected: 관리자 사이드바에 '예매 관리' 메뉴 항목이 Ticket 아이콘과 함께 표시되며, 클릭 시 /admin/bookings 페이지로 이동합니다.
result: pass

## Summary

total: 16
passed: 7
issues: 2
pending: 0
skipped: 0
blocked: 7

## Gaps

- truth: "결제 성공 후 /booking/[performanceId]/complete로 리다이렉트되어 예약 번호, 공연 정보, 좌석 정보, 결제 금액이 표시된다"
  status: failed
  reason: "User reported: 퀵 계좌이체 결제 후 complete 페이지로 리다이렉트되나 스켈레톤만 표시. 마이페이지 예매내역 미반영. 비밀번호 이중 입력 문제."
  severity: blocker
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
