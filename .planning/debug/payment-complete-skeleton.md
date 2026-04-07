---
status: diagnosed
trigger: "Phase 4 UAT에서 blocker 버그: 토스 결제 후 complete 페이지에서 스켈레톤만 표시, 마이페이지 예매내역 미반영"
created: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - useBookingStore에 persist 없음 → 토스 리다이렉트 시 selectedSeats 초기화 → storeEmpty=true → confirmPayment 호출 차단
test: complete 페이지 storeEmpty 분기 + 스토어 persist 설정 확인
expecting: recovery path도 결제 승인 전 예매 레코드가 없으면 null 반환하므로 스켈레톤 고착
next_action: 진단 완료

## Symptoms

expected: 결제 완료 후 complete 페이지에서 예매 정보가 표시되어야 함
actual: 스켈레톤만 표시됨, 마이페이지 예매내역에도 미반영
errors: (없음 - 시각적 증상)
reproduction: 토스 결제(퀵 계좌이체) 완료 후 /booking/[performanceId]/complete?paymentType=NORMAL&orderId=GRP-1775466246682-BJ9CC&paymentKey=tgen_20260406180423uehd3&amount=330000 으로 리다이렉트
started: Phase 4 UAT

## Eliminated

- hypothesis: 백엔드 결제 승인 로직 버그
  evidence: reservation.service.ts confirmAndCreateReservation은 정상적으로 구현되어 있음. 토스 승인 → DB 트랜잭션(reservation + seats + payment) 모두 올바름
  timestamp: 2026-04-06

- hypothesis: 토스 successUrl 설정 오류
  evidence: successUrl이 올바르게 /booking/${performanceId}/complete 로 설정됨
  timestamp: 2026-04-06

## Evidence

- timestamp: 2026-04-06
  checked: use-booking-store.ts
  found: zustand store에 persist 미들웨어 없음 - create()만 사용, in-memory 상태만 유지
  implication: 토스 SDK의 requestPayment()가 브라우저를 successUrl로 full-page redirect하면, 새 페이지 로드 시 JS 힙이 초기화되어 selectedSeats=[], selectedShowtimeId=null 이 됨

- timestamp: 2026-04-06
  checked: complete/page.tsx L46-67
  found: storeEmpty = selectedSeats.length === 0. confirmPayment 콜백 L67에서 storeEmpty이면 즉시 return. useEffect L107에서도 !storeEmpty 조건이어야 confirmPayment() 호출
  implication: 리다이렉트 후 항상 storeEmpty=true이므로 confirmPayment()는 절대 호출되지 않음. /api/v1/payments/confirm 요청 자체가 발생하지 않음

- timestamp: 2026-04-06
  checked: complete/page.tsx L45-63 (recovery path)
  found: shouldRecover = storeEmpty && !!paymentKey && !!orderId → true. useReservationByOrderId(orderId) 호출 → GET /api/v1/reservations?orderId=GRP-xxx
  implication: recovery path는 DB에 payment 레코드가 이미 있어야 예매 조회 성공. 하지만 confirmPayment()가 한 번도 호출되지 않았으므로 DB에 예매/결제 레코드가 없음 → null 반환

- timestamp: 2026-04-06
  checked: complete/page.tsx L140
  found: isConfirming=false, bookingData=null, confirmMutation.isError=false (mutation이 호출된 적 없음) → 스켈레톤 렌더 조건 !bookingData && !confirmMutation.isError = true
  implication: confirmPayment가 호출도 안 되었고, error도 없으므로 스켈레톤 상태에서 영구적으로 벗어나지 못함. 스켈레톤이 무한 표시됨

## Resolution

root_cause: useBookingStore가 in-memory zustand 스토어(persist 없음)이므로 토스 SDK의 full-page redirect 시 selectedSeats가 초기화된다. complete 페이지는 storeEmpty=true일 때 confirmPayment() 호출을 차단하고, recovery path로 전환하지만 DB에 아직 결제 확인 레코드가 없으므로 null을 반환한다. 결과적으로 isConfirming=false / bookingData=null / isError=false 상태가 되어 스켈레톤이 영구 표시되고, /api/v1/payments/confirm은 한 번도 호출되지 않아 예매 레코드도 생성되지 않는다.

fix:
verification:
files_changed: []
