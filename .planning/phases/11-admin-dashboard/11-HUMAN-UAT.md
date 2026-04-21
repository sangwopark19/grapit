---
status: complete
phase: 11-admin-dashboard
source: [11-04-PLAN.md Task 04-02]
started: 2026-04-20
updated: 2026-04-20
---

## Current Test

[testing complete — 9 pass / 3 issues, fix in progress]

## Prerequisites

1. API 기동: `cd apps/api && pnpm start:dev` (포트 8080)
2. Web 기동: `cd apps/web && pnpm dev` (포트 3000)
3. admin 계정 seed 확인: `admin@grapit.test` / `TestAdmin2026!` (STATE.md 260413-jw1 참조, 없으면 `pnpm --filter @grapit/api db:seed`)

## Tests

### 1. 라우팅 & 사이드바 (D-01/D-02/D-03)
expected: `/admin`이 404가 아닌 대시보드 렌더 / 사이드바 최상단 "대시보드" NAV + LayoutDashboard 아이콘 / 로고 href `/admin` / `/admin/performances` 이동 시 exact-match 하이라이트 해제
result: pass

### 2. KPI 카드 (ADM-01)
expected: 4장 렌더 (오늘 예매수 / 오늘 매출 / 오늘 취소 / 활성 공연) + lucide 아이콘 (Ticket/Banknote/RotateCcw/Theater) + skeleton → 실제 값 전환 + 매출 ₩ 심볼 + 천단위 구분 또는 M 축약
result: pass

### 3. 차트 렌더 (Pitfall 1 + sr-only)
expected: 매출 추이 area chart 보라 그라디언트 / 장르 donut innerRadius 60 outerRadius 100 / 결제수단 bar 보라 막대 / DevTools Elements 탭에서 각 `<svg>` 자식 노드 > 0 / 각 차트 근처 `sr-only` 요약 텍스트 존재 (review LOW 13)
result: issue
reported: "area chart 보라색이 아니라 회색 그라디언트 / bar chart도 검은색으로 채워짐 (donut도 동일 확인)"
severity: major
diagnosis_note: |
  Playwright evaluate 결과:
  - document.documentElement의 `--chart-1`~`--chart-6`, `--primary` CSS 변수 모두 빈 문자열
  - Area gradient stop.stopColor computed = rgb(0,0,0) + opacity 0.1~0.8 → 회색 그라디언트
  - Bar/Pie path.fill computed = rgb(0,0,0) → 검은색
  - `<svg>` 자식 노드 각 15~16개 (Pitfall 1 OK)
  - sr-only 텍스트 4개 정상 ("매출 추이", "장르별", "결제수단", "오늘의 요약") (LOW 13 OK)
  - htmlClass: `pretendard_981248bf-module__z758yq__variable` 만 있음 — 테마 토큰 클래스/스코프가 붙어 있지 않음
  
  추정 원인:
  - shadcn/Tailwind v4 CSS 변수(`--chart-1` 등)가 `:root` 또는 관련 스코프에 **정의되지 않음**
  - 차트 컴포넌트는 `var(--chart-1)`을 사용하나 fallback 토큰 없음 → black으로 degrade
  - apps/web의 globals.css 또는 admin 전용 스타일 import 누락 의심

### 4. UI-SPEC 색상 (Chart palette)
expected: Area stroke/fill `#6C3CE0` 보라 primary 근접 / donut 5단계 보라 그라디언트 / shadcn 기본 oklch 무지개 색상 미노출
result: issue
reported: "Test 3과 동일 근본 원인 — 차트 팔레트 토큰 자체가 미정의"
severity: major
diagnosis_note: "Test 3의 diagnosis 참조. `--chart-1`~`--chart-6` 미정의로 `#6C3CE0` 보라가 적용되지 않음. 반대로 oklch 무지개도 안 나옴 (검은색). 결국 UI-SPEC palette 미준수."

### 5. 기간 필터 (D-09, D-11)
expected: 7일/30일/90일 토글 + 초기 30일 / 7일 클릭 시 revenue/genre/payment 3개 요청 `period=7d` + 3개 차트 동시 skeleton / Top 10은 30d 고정 (D-10) / 90일 area chart x축 `YYYY-WNN` 주별 포맷 / 빈 주/날짜 0값 채움 (review MEDIUM 6)
result: pass
env_note: |
  - 토글/초기/3요청/Top 10 고정/`YYYY-WNN` 포맷 모두 자동 검증 통과.
  - 장르 donut과 결제 bar가 period 변경 시 시각적으로 동일하게 보이는 현상은 시드 데이터가 CONFIRMED 1건 (2026-W16, concert, 계좌이체) 뿐이어서 발생 — 서비스 로직은 period를 올바르게 적용 (controller/service 코드 확인 완료, WHERE절 createdAt 비교 OK).
  - 운영 데이터 누적 시 자연 해결. 풍부한 시드 필요 시 backlog로 분리.

### 6. Top 10 (ADM-04)
expected: 컬럼 순위/포스터/공연명/장르/예매수 + desc 정렬 / empty 카피 "아직 인기 공연이 없습니다" + 서브카피 "최근 30일 예매 건수 기준"
result: pass
env_note: |
  - 헤더 [순위/포스터/공연명/장르/예매수] 렌더 확인 (playwright DOM 조회).
  - 현재 시드 1건 (concert, 1건) → row 1개 노출. desc 정렬은 service.ts의 ORDER BY count(*) desc로 구현 확인.
  - "최근 30일 예매 건수 기준" 서브카피 body text 노출 확인. "아직 인기 공연이 없습니다" 문자열은 top-performances-table.tsx emptyTitle prop에 존재 (코드 확인).

### 7. 캐시 관찰 (ADM-06)
expected: 첫 로드 시 5개 GET response time 기록 → 새로고침 시 **현저히 짧아짐** / 60초 대기 후 캐시 expire → DB 쿼리 latency 복귀 / API 로그 `CacheService` get/set에 key만 노출 (T-07-11 inherit)
result: pass
env_note: |
  - 코드 구현 확인: 5개 endpoint 모두 readThrough 패턴, DASHBOARD_CACHE_TTL=60s 명시, CacheService log는 {err.message, key, op}만 노출 (value 미노출 — T-07-11).
  - 사용자 런타임 관찰 (API 서버 stdout)에서도 첫 로드 vs 재로드 latency 감소 + key-only 로그 확인됨.

### 8. 비관리자 접근 차단 (T-11-03)
expected: 비로그인 `curl` → 401 또는 403 / 일반 유저 `/admin` → `/`로 redirect (기존 layout guard) / controller access-control 자동 테스트 3/3 GREEN (자동화 이미 통과 — review HIGH 3)
result: pass
env_note: |
  - curl :8080 + curl :3000(proxy) 둘 다 비로그인 → HTTP 401 (RolesGuard + @Roles('admin')).
  - pnpm vitest run admin-dashboard.controller.spec.ts → 3 passed.
  - 프론트 layout guard: apps/web/app/admin/layout.tsx:27-30 `if (!user || user.role !== 'admin') router.replace('/')` 구현 확인.
  - 실제 일반 유저 로그인 redirect 관찰은 테스트 비번을 모르는 기존 seed 계정 한계로 코드 수준에서 확인.

### 9. UI-SPEC Typography + Error/Empty (review MEDIUM 7/8)
expected: `<h1>대시보드</h1>` `text-xl font-semibold` / 섹션 `<h2>` `text-sm font-semibold` / Typography 스캔 0 위반 (자동화 이미 통과) / offline 시 "대시보드를 불러오지 못했습니다" (error) + "표시할 데이터가 없습니다" (empty) **별도 렌더** / "다시 시도" 버튼 클릭 시 refetch
result: pass
env_note: |
  - DOM 실측: h1 text-xl/font-semibold (20px/600), 섹션 h2 × 4 모두 text-sm/font-semibold (14px/600).
  - _state.tsx: mode prop으로 loading/empty/error 3-way 분기 → error copy "대시보드를 불러오지 못했습니다" + onRetry refetch, empty copy "표시할 데이터가 없습니다" (top 10은 "아직 인기 공연이 없습니다" override). review MEDIUM 7 error-not-collapsed-into-empty 준수.
  - 런타임 offline 리페치는 network panel throttle 없이 확인 어려워 코드 수준 검증.

### 10. a11y (review LOW 13)
expected: macOS VoiceOver로 각 차트 sr-only 요약 읽힘 / OS "Reduce Motion" 활성화 후 차트 진입 애니메이션 스킵 (isAnimationActive=false + motion-reduce CSS)
result: pass
env_note: |
  - revenue-area / genre-donut / payment-bar 3 차트 모두 `isAnimationActive={false}` + `motion-reduce:[&_*]:!transition-none` 확인.
  - sr-only 요약 4개 DOM에 렌더됨 (Test 3에서 검증).
  - VoiceOver 실제 발화 + OS "Reduce Motion" 플래그 적용 → 사용자가 pass로 확인.

### 11. Success Criteria 5개 (ROADMAP)
expected: (1) 오늘의 예매/매출/취소/활성 공연 확인 (2) 일별/주별 매출 추이 area chart 시각화 + 빈 bucket 0 채움 (3) 장르 donut + 결제수단 bar (4) 인기 공연 Top 10 (5) Valkey 캐싱으로 대시보드 로딩이 빠름
result: pass
env_note: |
  기능 criteria 5/5 만족:
  - (1) Test 2 pass — KPI 4장
  - (2) Test 5 pass — YYYY-WNN 주별 + skeleton merge
  - (3) 도넛/바 렌더 OK (기능). 단 팔레트 색상은 Test 3/4 issue(Gaps)에서 수정 예정 — 기능 차원 pass / 시각 차원은 fix plan으로 분리.
  - (4) Test 6 pass — Top 10
  - (5) Test 7 pass — 60s TTL + readThrough + 런타임 감소 관찰.

### 12. E2E 4개 실행 (Task 04-01 이월)
expected: `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` → 4 passed (landing-smoke / period-filter / sidebar-nav / chart-blank-guard)
result: issue
reported: "3 passed / 1 failed — period-filter 테스트가 Test timeout 30000ms exceeded (waitForResponse + locator.click) 로 fail"
severity: major
diagnosis_note: |
  실제 렌더된 ToggleGroup accessibility tree (Playwright error-context snapshot):
    - group "기간 선택":
        radio "7일"  (NOT button)
        radio "30일" [checked]
        radio "90일"
  즉 shadcn/ui Radix ToggleGroup이 `type="single"`로 렌더되어 자식이 role="radio" 패턴.
  E2E spec(e2e/admin-dashboard.spec.ts:64)은 `.getByRole('button', { name: '7일' })` 사용 → locator resolve 실패 → 30s timeout.
  
  수정 대상 확정:
  - apps/web/e2e/admin-dashboard.spec.ts:64 (또는 53~65 블록)에서 button → radio 로 변경.
  - 또는 toggle-group 컴포넌트 use site에서 type="single" 대신 버튼 토글 패턴으로 변경 (UI-SPEC 재확인 필요).
  - 정통적 a11y 관점에선 radio 패턴이 맞음 → spec 쪽 selector 수정이 최소 영향.

## Summary

total: 12
passed: 9
issues: 3
pending: 0
skipped: 0
blocked: 0
partial (자동화로 부분 커버): 0

_issue 내역: Test 3 (차트 팔레트 회색/검은색), Test 4 (UI-SPEC 색상 미준수 — Test 3과 동일 root cause), Test 12 (E2E period-filter selector button→radio)_

## Gaps

- truth: "차트 팔레트 — Area/Donut/Bar가 UI-SPEC `#6C3CE0` 보라 계열 토큰으로 렌더됨 (review MEDIUM 5 Chart palette 준수)"
  status: resolved
  reason: |
    [원인] Tailwind v4 `@theme` 블록은 `--color-*`, `--spacing-*` 등 알려진 namespace만
    자동 `:root`에 주입. `--chart-*`는 namespace 외부라 @theme 내 선언에도 불구하고
    `getComputedStyle(documentElement).getPropertyValue('--chart-1')`가 빈 문자열을 반환.
    결과적으로 recharts의 `var(--chart-1)` 참조가 black으로 fallback되어 area는
    회색 그라디언트, bar/pie는 검은색으로 렌더됨.
  severity: major
  test: [3, 4]
  fix:
    commit: (pending commit)
    files:
      - apps/web/app/globals.css — 기존 `@theme` 선언 외에 `:root { --chart-1..5: #6C3CE0..#A1A1AA }` 5토큰 추가 정의
    verification: |
      /admin 재로드 후 playwright evaluate:
      --chart-1..5 모두 정의 확인 (#6c3ce0, #8b6de8, #b8a3ef, #d1d1db, #a1a1aa).
      bar/pie path.fill = rgb(108, 60, 224) = #6C3CE0 보라.
      area gradient stop.stopColor = rgb(108, 60, 224) 확인.

- truth: "E2E `admin-dashboard.spec.ts` 4개 모두 green (period-filter 포함)"
  status: resolved
  reason: |
    [원인] shadcn/ui Radix ToggleGroup이 `type="single"`로 렌더될 때 radiogroup 패턴을
    따라 자식이 `role="radio"`로 노출됨. Spec이 `.getByRole('button', { name: '7일' })`을
    사용하여 locator가 resolve되지 않고 30s timeout.
  severity: major
  test: [12]
  fix:
    commit: (pending commit)
    files:
      - apps/web/e2e/admin-dashboard.spec.ts:64 — `getByRole('button')` → `getByRole('radio')`
    verification: |
      `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` → 4 passed (1.8s).
