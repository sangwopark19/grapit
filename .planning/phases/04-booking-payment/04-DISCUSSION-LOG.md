# Phase 4: Booking + Payment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-booking-payment
**Areas discussed:** 결제 확인 단계, 결제 결과 처리, 예매 내역 관리, Admin 예매 관리

---

## 결제 확인 단계

### 화면 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 주문서 페이지 | 별도 페이지(/booking/[id]/confirm)로 이동. 예매자 정보 확인 + 좌석/금액 요약 + 결제 수단 선택 + 약관 동의. NOL 티켓 방식 | ✓ |
| 인라인 확인 섹션 | 좌석 선택 페이지 내에서 사이드 패널이 확장되어 확인+결제 단계로 전환. 페이지 이동 없이 한 화면에서 완료 | |

**User's choice:** 주문서 페이지
**Notes:** -

### 예매자 정보

| Option | Description | Selected |
|--------|-------------|----------|
| 자동 채우기 | 회원 정보(이름/전화번호)를 자동 표시하고 [수정] 버튼으로 변경 가능 | ✓ |
| 별도 입력 | 매번 예매자 이름/전화번호를 직접 입력. 대리 예매 등 다른 사람 정보 입력 가능 | |

**User's choice:** 자동 채우기
**Notes:** -

### Toss Payments 위젯 배치

| Option | Description | Selected |
|--------|-------------|----------|
| 페이지 내 인라인 | 주문서 페이지 하단에 토스 결제 위젯을 인라인으로 렌더링. 페이지 이탈 없이 결제 수단 선택 → 결제 진행 | ✓ |
| 별도 팝업/리다이렉트 | 결제하기 클릭 시 토스 결제 팝업이 뜨거나 토스 페이지로 이동 | |

**User's choice:** 페이지 내 인라인
**Notes:** -

### 타이머 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 고정 표시 | Phase 3의 카운트다운 타이머가 주문서 페이지에서도 상단에 계속 표시 | ✓ |
| 숨김 | 주문서 페이지에서는 비표시. 결제 압박감 줄임 | |

**User's choice:** 상단 고정 표시
**Notes:** -

---

## 결제 결과 처리

### 성공 화면

| Option | Description | Selected |
|--------|-------------|----------|
| 전용 완료 페이지 | /booking/[id]/complete 페이지. 예매번호 + 공연정보 + 좌석 + 결제금액/수단 + 취소마감시간 + 예매내역/홈 버튼 | ✓ |
| 모달 오버레이 | 예매 페이지 위에 성공 모달 표시. 페이지 이동 없이 간결하지만 정보량 제한 | |

**User's choice:** 전용 완료 페이지
**Notes:** -

### 실패/취소 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 좌석 선택으로 복귀 | 에러 메시지 표시 + 좌석 선택 화면으로 복귀(좌석 점유 유지). 재시도 안내 | ✓ |
| 전용 실패 페이지 | 별도 실패 페이지로 이동. 실패 사유 + 다시 시도/홈으로 버튼. 좌석 점유 해제 후 새로 선택 | |

**User's choice:** 좌석 선택으로 복귀
**Notes:** -

---

## 예매 내역 관리

### 목록 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 카드형 목록 | 포스터 썸네일 + 공연명 + 날짜/시간 + 좌석 요약 + 상태 배지. 상태 필터(전체/예매완료/취소완료) | ✓ |
| 테이블형 목록 | 날짜/공연명/좌석/금액/상태 컬럼의 테이블. 정보 밀도 높지만 모바일에서 불편 | |

**User's choice:** 카드형 목록
**Notes:** -

### 상세 페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 별도 상세 페이지 | /mypage/reservations/[id] 페이지. 예매번호, 공연정보, 좌석, 결제정보, 취소마감시간, 취소 버튼 | ✓ |
| 목록 내 확장 | 카드 클릭 시 아코디언 방식으로 펼쳐서 상세 정보 표시 | |

**User's choice:** 별도 상세 페이지
**Notes:** -

### 취소/환불

| Option | Description | Selected |
|--------|-------------|----------|
| 전체 취소만 | 예매 단위 전체 취소만 가능. 부분 취소 없음. 확인 모달 + 취소 사유 + 환불 예정액 안내 | ✓ |
| 부분 취소 허용 | 좌석 단위 부분 취소 가능. 유연하지만 구현 복잡도 높음 | |

**User's choice:** 전체 취소만
**Notes:** -

### 취소 마감

| Option | Description | Selected |
|--------|-------------|----------|
| 공연일 1일 전 | 공연 시작시간 24시간 전까지 취소 가능. 일반적인 티켓 플랫폼 기준 | ✓ |
| 공연일 3일 전 | 공연 시작시간 72시간 전까지. 더 보수적인 정책 | |
| Admin에서 공연별 설정 | 공연 등록 시 취소마감일수를 Admin에서 지정 | |

**User's choice:** 공연일 1일 전
**Notes:** -

---

## Admin 예매 관리

### 목록 화면

| Option | Description | Selected |
|--------|-------------|----------|
| 테이블 + 필터 | Phase 2 Admin 패턴. 테이블 + 상태 필터 + 검색 | ✓ (결합) |
| 대시보드형 | 상단 통계 카드(총 예매수, 매출액, 취소율) + 하단 테이블 | ✓ (결합) |

**User's choice:** 둘 다 결합 — 대시보드 통계 카드 + 테이블
**Notes:** 사용자가 "1,2 둘다 전부다 포함"이라고 명시. 상단 통계 + 하단 테이블 결합 방식

### 환불 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 예매 상세에서 환불 | 테이블 행 클릭 → 예매 상세 모달. 환불 버튼 + 환불 사유 입력 + 확인 | ✓ |
| 목록에서 일괄 환불 | 체크박스로 여러 예매 선택 → 일괄 환불. 대량 취소 시 편리하지만 MVP 과도 | |

**User's choice:** 예매 상세에서 환불
**Notes:** -

---

## Claude's Discretion

- 예매번호 포맷, 결제 승인/취소 API 호출 구조, 예매/결제 DB 스키마, 상태 머신, Admin 통계 집계

## Deferred Ideas

None — discussion stayed within phase scope
