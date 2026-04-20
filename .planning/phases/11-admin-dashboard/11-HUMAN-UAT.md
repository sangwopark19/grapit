---
status: partial
phase: 11-admin-dashboard
source: [11-04-PLAN.md Task 04-02]
started: 2026-04-20
updated: 2026-04-20
---

## Current Test

[awaiting human testing — 유예 결정 2026-04-20]

## Prerequisites

1. API 기동: `cd apps/api && pnpm start:dev` (포트 8080)
2. Web 기동: `cd apps/web && pnpm dev` (포트 3000)
3. admin 계정 seed 확인: `admin@grapit.test` / `TestAdmin2026!` (STATE.md 260413-jw1 참조, 없으면 `pnpm --filter @grapit/api db:seed`)

## Tests

### 1. 라우팅 & 사이드바 (D-01/D-02/D-03)
expected: `/admin`이 404가 아닌 대시보드 렌더 / 사이드바 최상단 "대시보드" NAV + LayoutDashboard 아이콘 / 로고 href `/admin` / `/admin/performances` 이동 시 exact-match 하이라이트 해제
result: [pending]

### 2. KPI 카드 (ADM-01)
expected: 4장 렌더 (오늘 예매수 / 오늘 매출 / 오늘 취소 / 활성 공연) + lucide 아이콘 (Ticket/Banknote/RotateCcw/Theater) + skeleton → 실제 값 전환 + 매출 ₩ 심볼 + 천단위 구분 또는 M 축약
result: [pending]

### 3. 차트 렌더 (Pitfall 1 + sr-only)
expected: 매출 추이 area chart 보라 그라디언트 / 장르 donut innerRadius 60 outerRadius 100 / 결제수단 bar 보라 막대 / DevTools Elements 탭에서 각 `<svg>` 자식 노드 > 0 / 각 차트 근처 `sr-only` 요약 텍스트 존재 (review LOW 13)
result: [pending]

### 4. UI-SPEC 색상 (Chart palette)
expected: Area stroke/fill `#6C3CE0` 보라 primary 근접 / donut 5단계 보라 그라디언트 / shadcn 기본 oklch 무지개 색상 미노출
result: [pending]

### 5. 기간 필터 (D-09, D-11)
expected: 7일/30일/90일 토글 + 초기 30일 / 7일 클릭 시 revenue/genre/payment 3개 요청 `period=7d` + 3개 차트 동시 skeleton / Top 10은 30d 고정 (D-10) / 90일 area chart x축 `YYYY-WNN` 주별 포맷 / 빈 주/날짜 0값 채움 (review MEDIUM 6)
result: [pending]

### 6. Top 10 (ADM-04)
expected: 컬럼 순위/포스터/공연명/장르/예매수 + desc 정렬 / empty 카피 "아직 인기 공연이 없습니다" + 서브카피 "최근 30일 예매 건수 기준"
result: [pending]

### 7. 캐시 관찰 (ADM-06)
expected: 첫 로드 시 5개 GET response time 기록 → 새로고침 시 **현저히 짧아짐** / 60초 대기 후 캐시 expire → DB 쿼리 latency 복귀 / API 로그 `CacheService` get/set에 key만 노출 (T-07-11 inherit)
result: [pending]

### 8. 비관리자 접근 차단 (T-11-03)
expected: 비로그인 `curl` → 401 또는 403 / 일반 유저 `/admin` → `/`로 redirect (기존 layout guard) / controller access-control 자동 테스트 3/3 GREEN (자동화 이미 통과 — review HIGH 3)
result: [automated pass — 수동 추가 확인 필요]

### 9. UI-SPEC Typography + Error/Empty (review MEDIUM 7/8)
expected: `<h1>대시보드</h1>` `text-xl font-semibold` / 섹션 `<h2>` `text-sm font-semibold` / Typography 스캔 0 위반 (자동화 이미 통과) / offline 시 "대시보드를 불러오지 못했습니다" (error) + "표시할 데이터가 없습니다" (empty) **별도 렌더** / "다시 시도" 버튼 클릭 시 refetch
result: [pending]

### 10. a11y (review LOW 13)
expected: macOS VoiceOver로 각 차트 sr-only 요약 읽힘 / OS "Reduce Motion" 활성화 후 차트 진입 애니메이션 스킵 (isAnimationActive=false + motion-reduce CSS)
result: [pending]

### 11. Success Criteria 5개 (ROADMAP)
expected: (1) 오늘의 예매/매출/취소/활성 공연 확인 (2) 일별/주별 매출 추이 area chart 시각화 + 빈 bucket 0 채움 (3) 장르 donut + 결제수단 bar (4) 인기 공연 Top 10 (5) Valkey 캐싱으로 대시보드 로딩이 빠름
result: [pending]

### 12. E2E 4개 실행 (Task 04-01 이월)
expected: `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` → 4 passed (landing-smoke / period-filter / sidebar-nav / chart-blank-guard)
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0
partial (자동화로 부분 커버): 1

## Gaps

_(이슈 발견 시 `/gsd-verify-work 11` 실행 결과로 기록)_
