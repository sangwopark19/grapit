# Phase 11: 어드민 대시보드 - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

관리자가 `/admin` 대시보드 랜딩에서 오늘의 예매/매출/취소 KPI, 기간별 매출 추이, 장르·결제수단 분포, 인기 공연 Top 10을 한눈에 파악하고, Valkey 캐싱으로 빠르게 응답받는다.

**In scope:** 읽기 전용 대시보드 레이어 (KPI 4종 + area/donut/bar 3종 차트 + Top 10 랭킹 + 캐시 레이어). `/admin` 랜딩을 대시보드로 전환하고 sidebar 최상단에 대시보드 진입점 추가. ADM-01~ADM-06.

**Out of scope (deferred):** RBAC 세분화, Excel/CSV 내보내기, 실시간 WebSocket 대시보드, 퍼널/코호트 분석(v2 — ADM-07~ADM-09). 공연/배너/예매 CRUD는 v1.0에서 완료.

</domain>

<decisions>
## Implementation Decisions

### 라우팅 & IA
- **D-01:** `/admin` 랜딩 = **대시보드**. `apps/web/app/admin/page.tsx` 신규 생성하여 index에 대시보드 배치. `/admin` URL 타이핑 또는 사이드바 로고 클릭 시 대시보드 표시.
- **D-02:** `admin-sidebar.tsx:32` 로고 링크 `/admin/performances` → **`/admin`** 으로 교체.
- **D-03:** sidebar NAV_ITEMS 최상단에 `{ label: '대시보드', href: '/admin', icon: LayoutDashboard }` 항목 추가. 기존 3개(공연/배너/예매) 위에 배치.
- **D-04:** `/admin/performances` 경로 자체는 변경 없음. `performance-form.tsx:201,539`의 `router.push('/admin/performances')` 불변.

### 차트 라이브러리
- **D-05:** **shadcn/ui Chart** 채택 (recharts wrapper). `npx shadcn@latest add chart` 실행하여 `components/ui/chart.tsx` 복사. CSS variable 기반 `--chart-1~5` 색상 토큰 + `ChartContainer`/`ChartTooltip`/`ChartLegend` 표준 사용. React 19 / Next.js 16 / Tailwind v4 호환 확인은 researcher 단계에서 최신 recharts 3.x 버전 pinning과 함께 점검.

### 통계 의미론 · 집계 범위
- **D-06:** "오늘" 기준 = **Asia/Seoul 자정 ~ 다음 자정**. `reservations.createdAt` 기준 필터. 자정 부근에 KPI가 0으로 리셋되는 UX는 수락(상식적 정의 우선).
- **D-07:** 매출 = `reservations.status = 'CONFIRMED'`의 `totalAmount` 누적합. 환불/취소는 매출에서 차감하지 않음. 기존 `admin-booking.service.ts:55-59` 패턴과 일관.
- **D-08:** 취소율 = `CANCELLED 건수 / (CONFIRMED + CANCELLED + FAILED 모두 포함한 전체 건수)`. 기존 `admin-booking.service.ts:61-72` 방식과 동일 공식. 분모는 `reservations` 전체.
- **D-09:** 매출 추이 차트 기간 필터 = **7/30/90일 세그먼트 3단 버튼** (기본 30일). x축 집계는 범위에 자동 스위치: 7일·30일 = 일별, 90일 = 주별.
- **D-10:** 인기 공연 Top 10 = **최근 30일 CONFIRMED 예매 건수** 누적 기준. `GROUP BY performanceId ORDER BY count DESC LIMIT 10`. 기간은 롤링 30일 고정 (사용자 조절 없음).
- **D-11:** 장르별 donut (ADM-03) + 결제수단별 bar (ADM-05) 기간 = **상단 매출 추이 기간 필터와 공유**. 사용자가 7/30/90일을 고르면 3개 차트 모두 같이 바뀜. "이 기간 동안" 일관성.

### 캐싱 전략 (ADM-06)
- **D-12:** 캐시 TTL = **60초 일괄** 적용. Phase 7 `CacheService`의 `DEFAULT_TTL=300` override. 운영자가 "1분 전 수치 보면 충분" 맥락.
- **D-13:** 무효화 전략 = **TTL-only**. 예매 생성/취소/환불, 공연 CRUD 어떤 이벤트도 수동 invalidate 호출하지 않음. 60초 내 자연 신선화. Phase 7 "invalidate best-effort" 철학과 일관 (빠른 TTL이 complexity 대체).
- **D-14:** 키 네임스페이스 = `cache:admin:dashboard:{kind}:{params}`. 예: `cache:admin:dashboard:summary` (오늘 KPI), `cache:admin:dashboard:revenue:30d`, `cache:admin:dashboard:genre:30d`, `cache:admin:dashboard:payment:30d`, `cache:admin:dashboard:top10`. `cache:performances:*` / `cache:home:*` 와 분리되어 flush 시 카탈로그 영향 없음.
- **D-15:** 기존 `CacheService` (`apps/api/src/modules/performance/cache.service.ts`) 그대로 재사용. `get<T>` / `set(key, value, 60)` / `invalidatePattern` API 사용. 새 서비스 만들지 않음.

### Claude's Discretion
- 대시보드 레이아웃 정확한 그리드 구성 (2x2, 3x1 등) — UI-SPEC/UI-phase에서 확정. 하지만 기본 구조: 상단 KPI 4카드 → 기간 필터 → area chart (매출 추이) → donut(장르) + bar(결제수단) 2열 → Top 10 테이블 순서.
- area/donut/bar 컴포넌트 정확한 prop 시그니처, color mapping
- 로딩 스켈레톤 / 에러 상태 UI 정확한 마크업
- NestJS에서 대시보드 API를 신규 `DashboardModule/Controller/Service`로 분리할지 기존 `AdminModule` 확장할지 — planner 재량 (권장: 신규 `admin-dashboard.controller.ts` + `admin-dashboard.service.ts` 분리, `AdminModule`에 provider 등록)
- 날짜 경계 처리(KST 자정): DB 레벨 `AT TIME ZONE 'Asia/Seoul'` 사용할지 앱 레벨 `new Date()` 변환할지
- 7/30/90일 버튼의 정확한 shadcn 컴포넌트 (ToggleGroup vs 3개 Button)
- Top 10 테이블 행당 표시 필드 (제목/장르/예매수 기본, 썸네일·기간 포함 여부)
- shadcn Chart 컴포넌트 설치 후 CSS variable 기본값(--chart-1~5)을 Grapit 브랜드 색상으로 커스텀할지 — UI-phase 재량

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항 · 프로젝트 계약
- `.planning/ROADMAP.md` §"Phase 11" — Goal/Depends/Requirements/Success Criteria 5개 + UI hint=yes
- `.planning/REQUIREMENTS.md` §"어드민 대시보드" — ADM-01~ADM-06 원문 + Traceability 표
- `.planning/REQUIREMENTS.md` §"v2 Requirements" §"어드민 추가" — ADM-07(Excel export)/ADM-08(퍼널)/ADM-09(실시간 WS) 제외 확정
- `.planning/PROJECT.md` §"Out of Scope" — 대기열/랭킹 시스템 제외(=Top 10은 단순 예매 건수 기반 확정 근거), §"Key Decisions" — Admin을 /admin 라우트로(분리 앱 아님), Drizzle ORM SQL-first

### 직전 페이즈 결정 (계승)
- `.planning/phases/07-valkey/07-CONTEXT.md` — ioredis 단일 클라이언트, CacheService 패턴, invalidate best-effort 철학(= TTL-only 근거)
- `.planning/STATE.md` §"Blockers/Concerns" — "ADM-06 통계 쿼리 캐싱 — 전제조건(Phase 7 Valkey 전환) 완료. Phase 11 어드민 대시보드에서 캐시 레이어 활용 대상으로 이관" 명시

### 설계 참조 (역추론 문서)
- `docs/05-ADMIN-PREDICTION.md` §1 "대시보드" — NOL 역추론 필요 API 4개(summary/realtime/traffic/queue-status) 중 **summary만 범위**, realtime/queue는 v2 (WebSocket 대시보드 = ADM-09)
- `docs/05-ADMIN-PREDICTION.md` §"관리자 API 통합 전략" — 관리자 API 라우팅 `/api/v1/admin/...` prefix 원칙, 모듈러 모놀리스 유지

### 기존 코드 (재사용·교체 지점)
- `apps/web/app/admin/layout.tsx` — admin role guard 이미 존재, 대시보드는 이 layout 하위에서 렌더. 수정 불필요
- `apps/web/app/admin/page.tsx` — **신규 생성** (현재 없음). 대시보드 랜딩.
- `apps/web/components/admin/admin-sidebar.tsx:8-24` — **NAV_ITEMS 수정 대상** (최상단 '대시보드' 추가), line 32 로고 `href` `/admin`으로 교체
- `apps/web/components/admin/admin-stat-card.tsx` — **그대로 재사용**. count/currency/percent 포맷 지원 (오늘 예매수 = count, 매출 = currency, 취소율 = percent)
- `apps/web/proxy.ts:12` — `/admin/:path*` matcher 이미 `/admin` index 포함 (변경 불필요)
- `apps/web/app/layout-shell.tsx:10` — `pathname.startsWith('/admin')` 조건부 shell (변경 불필요)
- `apps/api/src/modules/admin/admin-booking.service.ts:41-72` — **통계 쿼리 패턴 참조**. totalBookings/revenue/cancelRate 집계식 복제해 `AdminDashboardService`에 확장
- `apps/api/src/modules/admin/admin.module.ts` — 신규 `AdminDashboardService`/`AdminDashboardController` 등록 지점
- `apps/api/src/modules/performance/cache.service.ts` — **재사용** (`get`/`set`/`invalidatePattern`). 60s TTL은 set 호출 시 ttlSeconds 인자로 주입, DEFAULT_TTL override 불필요
- `apps/api/src/database/schema/reservations.ts` — reservations.status enum, totalAmount, createdAt, showtimeId, userId 참조
- `apps/api/src/database/schema/payments.ts` — payments.method (카드/카카오페이/네이버페이/계좌이체) 집계 대상
- `apps/api/src/database/schema/performances.ts` — performances.title, genre 조인 대상

### 외부 문서 (researcher 단계에서 정밀)
- shadcn/ui Chart 공식 문서 — https://ui.shadcn.com/docs/components/chart (recharts 버전, CSS variable 규약)
- recharts 3.x — https://recharts.org/en-US/api (Area/Pie/Bar 컴포넌트 props)
- Drizzle `date_trunc` / `AT TIME ZONE` 가이드 — https://orm.drizzle.team/docs/sql (KST 자정 경계 쿼리용)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AdminStatCard`** (`apps/web/components/admin/admin-stat-card.tsx`): 아이콘+라벨+값 카드. `format: 'count' | 'currency' | 'percent'` 지원. KPI 4장 모두 이 컴포넌트로 해결
- **`CacheService`** (`apps/api/src/modules/performance/cache.service.ts`): graceful degradation, 로그 기반 장애 관측. 대시보드 쿼리 read-through 구현에 그대로 투입
- **shadcn UI 컴포넌트**: radix-ui, lucide-react, sonner, @tanstack/react-query 이미 설치 → 신규 dep은 `recharts` + shadcn `chart` 컴포넌트만
- **admin role guard**: `layout.tsx`의 `useAuthStore`/`user.role !== 'admin'` 리디렉션 이미 동작 — 대시보드도 자동 보호
- **admin-booking.service.ts 집계 쿼리**: `count(*)::int`, `coalesce(sum(...), 0)::int` Drizzle SQL 패턴 확립 → 동일 스타일로 dashboard 쿼리 작성

### Established Patterns
- **관리자 API = `/api/v1/admin/...` prefix**: 신규 dashboard API도 `/api/v1/admin/dashboard/summary`, `/revenue`, `/genre`, `/payment`, `/top-performances`
- **`apiClient.get<T>()` + TanStack Query**: `apps/web/hooks/use-reservations.ts`, `use-admin.ts` 패턴 그대로 답습 → 신규 `use-admin-dashboard.ts` 훅 파일 1개에 모든 쿼리 모음
- **zod schema + ZodValidationPipe**: API 쿼리 파라미터(기간 필터 등) 검증에 기존 패턴 적용
- **CacheService 에러 swallow + warn 로그**: Redis 장애가 admin API를 500으로 떨어뜨리지 않도록 유지

### Integration Points
- **`AdminModule`** (`apps/api/src/modules/admin/admin.module.ts`): 신규 `AdminDashboardService`/`AdminDashboardController` provider 등록. `CacheService`/`DRIZZLE` 주입
- **`AdminSidebar`**: NAV_ITEMS 4개로 확장 + 로고 href 교체 (2줄 diff)
- **Next.js App Router**: `/admin/page.tsx` 추가만으로 자동 라우팅 (Next.js 16 convention)
- **Zustand `useAuthStore`**: 기존 admin role guard 재사용. 추가 store 불필요
- **layout-shell.tsx**: `/admin` 포함되므로 admin layout이 이미 활성화됨, shell 조정 불필요

</code_context>

<specifics>
## Specific Ideas

- "`/admin` 타이핑하면 404가 뜨는 현재 상황 자체가 v1.0 때부터의 관행 버그 — 이 phase에서 자연스럽게 해소"
- "어드민 관점에서 '오늘 예매 몇 건' 수치가 1분 전 것이어도 의사결정엔 영향 없음 → 60초 TTL로 Valkey 비용과 신선도 최적점"
- "Top 10은 '최근 30일 기준'이면 충분, 90일 창이면 현재 인기 감지 둔해짐, 7일이면 노이즈 큼"
- "shadcn Chart는 recharts wrapper지만 색상 토큰과 legend 마크업을 일관되게 잡아주기 때문에 프로젝트의 디자인 언어 유지에 유리"
- "기존 `admin-booking.service.ts`가 이미 `count(*)::int` + `sum::int` Drizzle 스타일로 집계하고 있어서, dashboard 쿼리도 같은 서명·같은 raw SQL 조각으로 확장하면 스타일 가디언 걱정 없음"
- "TTL-only 철학은 Phase 7에서 이미 확정된 'cache invalidate는 best-effort, DB가 SoT'와 100% 일관"

</specifics>

<deferred>
## Deferred Ideas

- **실시간 WebSocket 대시보드 (ADM-09)** — v2. 현재는 페이지 폴링·수동 새로고침으로 충분 (어드민 동시 사용자 수 낮음)
- **Excel/CSV 내보내기 (ADM-07)** — v2. 예매자 명단은 이미 `/admin/bookings`에서 테이블로 확인 가능
- **퍼널/코호트 분석 (ADM-08)** — v2. 가입→예매 전환율, 재구매율 등은 데이터 축적 이후
- **RBAC 세분화 (슈퍼관리자/장르 담당자/CS 등)** — PROJECT.md Out of Scope 명시. 1인 관리자 단일 롤
- **동시 접속자 / 대기열 현황 카드** — 대기열 시스템 자체가 Out of Scope
- **오늘 vs 어제 비교 증감률 표시** — KPI 카드에 부가 정보. UX 현대화 phase 또는 v2에서 추가 여지
- **날짜 범위 데이트피커 (react-day-picker range)** — 7/30/90일 세그먼트로 충분, 자유 범위는 ADM-07 Excel export와 묶어 v2
- **자정 롤오버 시 WebSocket push로 대시보드 자동 갱신** — 60s TTL + react-query refetchInterval로 체감 해소됨
- **Sentry 대시보드 쿼리 성능 메트릭** — CacheService 로그로 충분. 볼륨 증가 후 재검토
- **공연 CRUD 변경 시 dashboard 캐시 즉시 무효화** — TTL-only 결정으로 자연 해소

</deferred>

---

*Phase: 11-admin-dashboard*
*Context gathered: 2026-04-20*
