# Phase 11: 어드민 대시보드 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 11-admin-dashboard
**Areas discussed:** 라우팅 & IA, 차트 라이브러리, 통계 범위·집계 의미론, 캐싱 전략 (ADM-06)

---

## 영역 선택

| Option | Description | Selected |
|--------|-------------|----------|
| 라우팅 & IA | /admin 랜딩 · sidebar 순서 · 기본 진입점 | ✓ |
| 차트 라이브러리 선택 | recharts vs shadcn chart vs visx | ✓ |
| 통계 범위·집계 의미론 | 오늘 기준, 매출 정의, 기간 필터, Top 10 기준 | ✓ |
| 캐싱 전략 (ADM-06) | TTL, 무효화, 키 네임스페이스 | ✓ |

**User's choice:** 4개 영역 전부

---

## 라우팅 & IA

### 현재 상태 파악 (사용자 요청)

사용자 질문: "현재 어드민 경로가 /admin/performances 로 되어있는데 갑자기 바뀐거야?"

파악 결과:
- `apps/web/app/admin/page.tsx` 없음 → `/admin` 직접 진입 시 404
- `admin-sidebar.tsx:32` 로고 링크는 `/admin/performances` 하드코딩
- `components/admin/performance-form.tsx:201,539` 폼 제출/취소 시 `/admin/performances` 복귀
- v1.0 Phase 2 때부터의 관행. "바뀐" 것 아님

### 질문 1: 대시보드 경로

| Option | Description | Selected |
|--------|-------------|----------|
| /admin 를 대시보드로 (Recommended) | page.tsx 신규. sidebar 로고도 /admin. /admin/performances 불변 | ✓ |
| /admin/dashboard 별도 | /admin 은 여전히 404, 대시보드만 하위 경로 | |
| /admin → /admin/dashboard 307 | URL bar 명시적 바뀜 | |

**User's choice:** /admin 를 대시보드로

### 질문 2: sidebar '대시보드' 항목 위치

| Option | Description | Selected |
|--------|-------------|----------|
| 최상단 (Recommended) | 대시보드 → 공연 → 배너 → 예매. LayoutDashboard 아이콘 | ✓ |
| 추가하지 않음 | 로고 클릭이 대시보드라서 sidebar 불필요 | |
| 최하단 구분선 아래 | '통계' 섹션 분리 | |

**User's choice:** 최상단

---

## 차트 라이브러리

### 사전 확인
`apps/web/package.json` 내 차트 라이브러리 없음. 신규 도입 필요. 프로젝트는 radix-ui + Tailwind v4 + shadcn 스타일.

### 질문

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui Chart (recharts 몬) (Recommended) | CSS variable 색상 토큰, ChartContainer/Tooltip/Legend 표준, shadcn 생태계 일관성 | ✓ |
| recharts 단독 도입 | wrapper 없이 3.x 직접 설치, 토큰 수동 관리 | |
| visx (Airbnb) | 저수준 d3, boilerplate 많아 1인 개발 과잉 | |

**User's choice:** shadcn/ui Chart (recharts 몬)

---

## 통계 범위·집계 의미론

### 질문 1: "오늘" 시간 기준

| Option | Description | Selected |
|--------|-------------|----------|
| KST 자정 ~ 다음 자정 (Recommended) | createdAt 기준, 상식적 '오늘' | ✓ |
| 최근 24시간 (rolling) | 자정 리셋 없음, 어휘 오인 여지 | |
| KST 자정 + 어제 비교 | 증감률 함께 표시, 계산 복잡 | |

**User's choice:** KST 자정 ~ 다음 자정

### 질문 2: 매출 정의

| Option | Description | Selected |
|--------|-------------|----------|
| CONFIRMED 기준 누적 합 (Recommended) | 기존 admin-booking.service.ts 패턴 일관 | ✓ |
| 순매출 (CONFIRMED − CANCELLED) | Toss 환불 등에 금액 차감, 복잡 | |
| 확정 + 취소 두 줄 각각 | 병렬 표시, 해석 명확 | |

**User's choice:** CONFIRMED 기준 누적 합

### 질문 3: 매출 추이 기간 필터

| Option | Description | Selected |
|--------|-------------|----------|
| 7/30/90일 고정 선택 (Recommended) | 세그먼트 3버튼, 기본 30일, x축 집계 자동 스위치 | ✓ |
| 일별/주별 토글 + 기간 별도 | 조합 폭발 | |
| 날짜 범위 데이트피커 | 자유도 높으나 MVP 과잉 | |

**User's choice:** 7/30/90일 고정 선택

### 질문 4: Top 10 순위 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 누적 예매 건수 (Recommended) | CONFIRMED count, GROUP BY performanceId | ✓ |
| 누적 매출 금액 | 고가 웅에어 편향 | |
| 좌석 점유율 % | seatInventories join 필요, 쿼리 복잡 | |

**User's choice:** 누적 예매 건수

### 질문 5: 취소율 공식

| Option | Description | Selected |
|--------|-------------|----------|
| CANCELLED ÷ 전체 예약 건수 (Recommended) | 기존 admin-booking.service.ts 방식과 동일 | ✓ |
| CANCELLED ÷ CONFIRMED 만 | 분모/분자 관계 모호 | |
| CANCELLED ÷ 상태 모두 (FAILED 포함) | 해석 복잡 | |

**User's choice:** CANCELLED ÷ 전체 예약 건수

### 질문 6: Top 10 기간창

| Option | Description | Selected |
|--------|-------------|----------|
| 최근 30일 (Recommended) | 롤링 윈도우, 현재 인기 적절히 감지 | ✓ |
| 전체 기간 누적 | 오래된 공연 편향 | |
| 판매 기간 공연만 | endDate >= now | |

**User's choice:** 최근 30일

### 질문 7: 장르/결제수단 분포 기간

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 기간 필터와 공유 (Recommended) | 대시보드 일관성, 7/30/90 필터 공유 | ✓ |
| 고정 '최근 30일' | 독립 집계 | |
| 전체 기간 누적 | 추세 반영 불가 | |

**User's choice:** 상단 기간 필터와 공유

---

## 캐싱 전략 (ADM-06)

### 질문 1: TTL

| Option | Description | Selected |
|--------|-------------|----------|
| 60초 (Recommended) | 한 분 전 수치는 의사결정 영향 미미 | ✓ |
| 300초 (Phase 7 기본) | 카탈로그와 동일 정책 | |
| 쿼리별 차등 TTL | 파일 세트 복잡도 | |

**User's choice:** 60초

### 질문 2: 무효화 전략

| Option | Description | Selected |
|--------|-------------|----------|
| TTL-only (수동 invalidate 없음) (Recommended) | 60s TTL로 자연 신선화, Phase 7 best-effort 철학 일관 | ✓ |
| 환불/취소만 invalidate | 중간 타협 | |
| 모든 변경 이벤트에 invalidate | 훅 포인트 많음 | |

**User's choice:** TTL-only

### 질문 3: 키 네임스페이스

| Option | Description | Selected |
|--------|-------------|----------|
| cache:admin:dashboard:{kind}:{params} (Recommended) | cache:performances:* 와 분리 | ✓ |
| cache:stats:{kind} | admin 전용 명시 부족 | |
| cache:home:{kind} | 이미 cache:home:banners 와 충돌 가능 | |

**User's choice:** cache:admin:dashboard:{kind}:{params}

---

## Claude's Discretion

- 대시보드 레이아웃(그리드 구성), 로딩 스켈레톤 · 에러 상태 마크업
- 차트 컴포넌트 정확한 prop 시그니처, 색상 토큰 매핑
- AdminDashboardModule/Controller/Service 분리 여부 (planner 재량)
- KST 자정 경계 처리(DB AT TIME ZONE vs 앱 레벨 변환)
- Top 10 테이블 행 표시 필드 정확한 조합
- shadcn Chart CSS variable 기본값을 Grapit 브랜드로 커스텀할지 (UI-phase)

## Deferred Ideas

- 실시간 WebSocket 대시보드 (ADM-09)
- Excel/CSV 내보내기 (ADM-07)
- 퍼널/코호트 분석 (ADM-08)
- RBAC 세분화
- 동시 접속자 / 대기열 현황 카드
- 오늘 vs 어제 비교 증감률
- 날짜 범위 데이트피커 (자유 범위)
- 자정 롤오버 자동 갱신 WebSocket push
- Sentry 대시보드 쿼리 성능 메트릭
- 공연 CRUD → dashboard 캐시 즉시 무효화
