# Phase 4: Booking + Payment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-booking-payment
**Areas discussed:** 결제 진입 화면, 결제 완료 & 확인, 마이페이지 예매 관리, 취소/환불 정책 & UX

---

## 결제 진입 화면

### Q1: "다음" 버튼 후 결제 페이지 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 별도 페이지 (추천) | /booking/[performanceId]/checkout 별도 URL로 주문확인+결제. NOL 티켓처럼 단계 분리 | ✓ |
| 같은 페이지 스텝 | 현재 예매 페이지 내에서 좌석선택→결제 스텝 전환. URL 변경 없이 UI 전환만 | |

**User's choice:** 별도 페이지 (추천)
**Notes:** None

### Q2: 주문확인 화면에 약관 동의

| Option | Description | Selected |
|--------|-------------|----------|
| 결제 약관 포함 (추천) | "구매조건 확인 및 결제 동의" 체크박스 1개. 전자상거래법 준수 | ✓ |
| 약관 없이 | 결제 버튼 클릭만으로 바로 결제. 법적 이슈 가능성 | |

**User's choice:** 결제 약관 포함 (추천)
**Notes:** None

### Q3: Toss Payments 결제창 호출 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 리다이렉트 (추천) | Toss Payments 공식 권장. 결제 페이지로 이동 → 완료 후 콜백 | ✓ |
| 팝업/모달 | 같은 페이지에서 팝업으로 결제. 모바일 팝업 차단 이슈 | |
| Claude 판단 | SDK 문서 확인 후 최적 방식 선택 | |

**User's choice:** 리다이렉트 (추천)
**Notes:** None

### Q4: 주문확인 페이지 정보 구성

| Option | Description | Selected |
|--------|-------------|----------|
| NOL 티켓 참조 (추천) | 공연명/날짜/회차 + 좌석리스트 + 총 결제금액 + 예매자정보 + 취소규정 + 약관동의 + 결제버튼 | ✓ |
| 최소 구성 | 좌석리스트 + 총액 + 약관동의 + 결제버튼만 | |

**User's choice:** NOL 티켓 참조 (추천)
**Notes:** None

### Q5: 결제 중 좌석 점유 유지

| Option | Description | Selected |
|--------|-------------|----------|
| 기존 TTL 유지 (추천) | 10분 TTL 그대로. checkout에도 카운트다운 타이머 표시 | ✓ |
| checkout에서 TTL 연장 | checkout 진입 시 +5분 연장 | |

**User's choice:** 기존 TTL 유지 (추천)
**Notes:** None

---

## 결제 완료 & 확인

### Q1: 결제 성공 후 확인 페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 완료 전용 페이지 (추천) | /booking/complete?orderId=xxx. 예매번호+공연/좌석/결제 요약 + CTA | ✓ |
| 모달 후 리다이렉트 | 간단한 성공 모달 후 마이페이지 예매 상세로 자동 이동 | |

**User's choice:** 완료 전용 페이지 (추천)
**Notes:** None

### Q2: 결제 실패/취소 시 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 실패 전용 페이지 (추천) | /booking/fail?code=xxx. 에러 메시지 + 좌석 해제 안내 + CTA | ✓ |
| 토스트 + 리다이렉트 | 좌석선택 페이지로 돌아가며 토스트로 실패 안내 | |

**User's choice:** 실패 전용 페이지 (추천)
**Notes:** None

---

## 마이페이지 예매 관리

### Q1: 마이페이지 예매 내역 레이아웃

| Option | Description | Selected |
|--------|-------------|----------|
| 탭 분리 (추천) | [예매내역] / [프로필] 탭. 예매내역이 기본 탭 | ✓ |
| 단일 페이지 | 프로필 아래 예매 내역 섹션 추가 | |

**User's choice:** 탭 분리 (추천)
**Notes:** None

### Q2: 예매 상세 페이지 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 별도 페이지 (추천) | /mypage/bookings/[bookingId]. 예매번호, 상태, 공연정보, 결제정보, 취소마감, 취소 버튼 | ✓ |
| 모달/시트 | 목록에서 바로 모달/시트로 상세 확인. 별도 URL 없음 | |

**User's choice:** 별도 페이지 (추천)
**Notes:** None

---

## 취소/환불 정책 & UX

### Q1: 취소 마감 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 공연 전날 18:00 (추천) | NOL 티켓/예스24 일반적 기준 | ✓ |
| 공연 24시간 전 | 시작 24시간 전까지 | |
| Admin 설정 | 공연별로 Admin에서 설정 | |

**User's choice:** 공연 전날 18:00 (추천)
**Notes:** None

### Q2: 환불 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 전액 환불만 (추천) | 예매 전체 취소 + 전액 환불. 부분 취소 없음. MVP 단순함 | ✓* |
| 부분 취소 지원 | 일부 좌석만 취소 가능. 결제 부분환불 연동 필요 | (initially selected, then reverted) |

**User's choice:** 전액 환불만 — 처음에 부분 취소를 선택했으나 이후 전체 취소 방식으로 변경
**Notes:** 부분 취소는 복잡도 대비 MVP 가치가 낮다고 판단

### Q3: 취소 확인 UI

| Option | Description | Selected |
|--------|-------------|----------|
| 확인 모달 (추천) | "정말 취소하시겠습니까?" Dialog. 환불 금액/날짜 표시 | ✓ |
| 즉각 취소 | 버튼 클릭 시 바로 처리 | |

**User's choice:** 확인 모달 (추천)
**Notes:** None

### Q4: Admin 환불 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 예매 목록 + 환불 버튼 (추천) | Admin 예매 목록 테이블 + 행별 환불 버튼. ADMN-04 충족 | ✓ |
| Claude 판단 | Admin 환불 UI 상세는 Claude가 결정 | |

**User's choice:** 예매 목록 + 환불 버튼 (추천)
**Notes:** None

---

## Claude's Discretion

- 예매번호 생성 형식
- Toss Payments webhook 처리 상세
- 결제 관련 DB 테이블 설계
- 주문확인 페이지 예매자정보 표시 방식
- 결제 버튼 금액 포맷팅
- Admin 예매 목록 페이지네이션/검색

## Deferred Ideas

None — discussion stayed within phase scope
