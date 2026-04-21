---
phase: 11
reviewers: [codex]
reviewers_skipped: [gemini, claude, coderabbit, opencode, qwen, cursor]
reviewed_at: 2026-04-20T05:57:21Z
plans_reviewed:
  - 11-01-PLAN.md
  - 11-02-PLAN.md
  - 11-03-PLAN.md
  - 11-04-PLAN.md
---

# Cross-AI Plan Review — Phase 11 (어드민 대시보드)

> **Environment note:** This review was invoked from Claude Code, so `claude` was skipped to preserve independence. `gemini`, `coderabbit`, `opencode`, `qwen` are not installed on this machine. `cursor-agent` is installed but requires authentication (`cursor agent login` or `CURSOR_API_KEY`) and returned an auth error. Effective reviewer count: **1 (codex)**.

## Codex Review

**Summary**
전체적으로 Phase 11 계획은 목표 범위가 명확하고, Wave 1 계약/테스트 → Wave 2 API/Web 병렬 구현 → Wave 3 검증 구조도 합리적입니다. 기존 `CacheService`, `AdminStatCard`, `AdminModule`, TanStack Query 패턴을 재사용하려는 방향도 1인 개발 프로젝트에 맞습니다. 다만 그대로 실행하면 일부 테스트가 "의미 있는 RED"가 아니라 module-not-found나 infra 오류로 실패할 가능성이 크고, Wave 2 병렬성 때문에 Plan 03의 E2E GREEN 조건이 Plan 02 완료에 암묵적으로 의존합니다. 또한 SQL 성능, admin auth 검증, frontend error state, UI-SPEC 준수 쪽에 몇 가지 수정이 필요합니다.

**Strengths**

- Phase boundary가 좋습니다. Dashboard는 read-only aggregation + cache + UI composition으로 제한되어 있고, RBAC 세분화, realtime dashboard, export, funnel 분석을 명확히 제외했습니다.
- 기존 architecture와 잘 맞습니다. 새 Nest module을 만들지 않고 `AdminModule` 확장, 기존 `CacheService` 재사용, 기존 admin layout guard 재사용은 복잡도를 낮춥니다.
- ADM-01~06 요구사항이 API endpoint, UI section, validation 항목으로 잘 추적됩니다.
- Cache key namespace와 60초 TTL 결정이 명확합니다. `cache:admin:dashboard:*`로 catalog cache와 분리한 점도 좋습니다.
- KST 기준을 계획에 명시한 점은 중요합니다. Cloud Run UTC 환경에서 날짜 집계가 흔히 깨지는 부분을 사전에 다루고 있습니다.
- Frontend는 `/admin` IA 변경, sidebar exact active 처리, period filter 공유, Top 10 고정 30일 등 사용자 결정과 대체로 일치합니다.
- Security threat model이 과하지 않고 필요한 경계, 즉 admin-only API와 period validation에 집중되어 있습니다.

**Concerns**

- **HIGH — Plan 01의 RED 테스트가 의미 있는 RED가 아닐 수 있습니다.**
  `admin-dashboard.service.ts`가 없어서 vitest가 module-not-found로 실패하면 8개 behavior test가 실제로 수집되거나 실패하지 않습니다. 계획은 "8개 테스트가 RED로 존재"한다고 말하지만 acceptance는 module-not-found를 정상으로 봅니다. 이는 TDD feedback로 약합니다.

- **HIGH — Plan 03의 E2E GREEN 조건은 Wave 2 병렬 실행과 충돌합니다.**
  Plan 03은 `depends_on: [11-01]`만 가지지만 E2E는 Plan 02 API가 완료되어야 통과합니다. Web 작업은 병렬 가능하지만, "Plan 01 E2E 3개 GREEN 전환"은 Plan 04 gate 또는 Plan 03이 Plan 02에 의존하는 단계로 옮겨야 합니다.

- **HIGH — Admin API access control 검증이 부족합니다.**
  Plan 02 must-have에는 "비관리자 403"이 있지만 자동 테스트가 없습니다. 기존 `RolesGuard`가 global auth guard에 의존한다면 괜찮지만, 그렇지 않으면 unauthenticated request에서 `request.user` 접근으로 500이 날 위험도 있습니다. Controller/unit 또는 e2e/API test로 401/403을 고정해야 합니다.

- **MEDIUM — 통계 쿼리의 날짜 필터가 index를 못 탈 가능성이 큽니다.**
  `${reservations.createdAt} AT TIME ZONE 'Asia/Seoul' >= ...`처럼 column에 함수를 씌우면 `createdAt` index가 있어도 활용이 어렵습니다. ADM-06이 "집계 쿼리 최적화"까지 포함한다면 60초 cache만으로는 약합니다.

- **MEDIUM — 결제수단 분포가 `payments.status = 'DONE'`을 필터하지 않습니다.**
  Plan 02는 `reservations.status = 'CONFIRMED'`만 봅니다. 실패/취소 payment row가 같은 reservation에 남을 수 있는 모델이라면 ADM-05가 실제 결제수단 분포를 왜곡할 수 있습니다.

- **MEDIUM — Revenue trend가 빈 날짜/주를 채우지 않습니다.**
  현재 쿼리는 데이터가 있는 bucket만 반환합니다. Area chart에서 "추이"를 보려면 7/30일은 날짜별 0값, 90일은 주별 0값을 채우는 것이 더 안정적입니다. 그렇지 않으면 x축 간격이 실제 시간 흐름을 반영하지 못할 수 있습니다.

- **MEDIUM — frontend error state가 일부 section에서 empty state로 숨겨집니다.**
  `genre.isError || empty`, `payment.isError || empty`를 같은 empty copy로 처리하고, Top 10은 error를 별도 처리하지 않습니다. UI-SPEC의 "per-section error boundary"와 맞지 않고, 장애를 "데이터 없음"으로 오해하게 만듭니다.

- **MEDIUM — UI-SPEC Typography와 계획 코드가 충돌합니다.**
  UI-SPEC은 dashboard views에서 `text-base`, `text-lg`, `font-medium`, `font-bold` 금지인데, Plan 03 예시에는 empty/error copy에 `text-base`가 들어갑니다. acceptance grep도 page만 검사해서 dashboard component 위반을 놓칠 수 있습니다.

- **MEDIUM — dependency install 산출물 목록이 불완전합니다.**
  shadcn/recharts 설치는 보통 root `pnpm-lock.yaml`을 변경합니다. Plan 03 `files_modified`에 lockfile이 빠져 있어 실행 후 diff와 계획이 어긋날 가능성이 있습니다.

- **MEDIUM — Plan 04 frontmatter와 task가 모순됩니다.**
  Plan 04는 `files_modified: []`인데 Task 04-03은 `ROADMAP.md`, `REQUIREMENTS.md`, `11-VALIDATION.md`를 수정합니다. 검증 계획이라도 문서 수정 산출물은 명시해야 합니다.

- **LOW — `AdminDashboardService`의 `logger`는 계획 코드상 미사용입니다.**
  tsconfig/lint 설정에 따라 unused private member로 실패할 수 있습니다. 사용하지 않을 거면 제거하는 편이 안전합니다.

- **LOW — chart blank regression 검증이 수동 위주입니다.**
  recharts/React 이슈를 이미 risk로 식별했으므로 Playwright에서 SVG child count 또는 screenshot/pixel assertion을 최소 smoke로 추가하면 좋습니다.

- **LOW — accessibility contract 일부가 구현 계획에 빠져 있습니다.**
  UI-SPEC은 chart별 `sr-only` summary와 `prefers-reduced-motion` 대응을 요구하지만 Plan 03 코드에는 없습니다.

**Suggestions**

- Plan 01에서 최소 `AdminDashboardService` skeleton을 만들고 각 method가 `throw new Error('Not implemented')` 하게 하거나, Plan 01의 RED 기준을 "module-not-found"가 아닌 "테스트별 assertion failure"로 바꾸세요. 이후 Plan 02가 skeleton을 실제 구현으로 채우면 TDD feedback이 훨씬 명확해집니다.
- Plan 03의 E2E GREEN acceptance를 Plan 04로 옮기세요. Plan 03은 `typecheck`, `lint`, 가능하면 mocked API 기반 component test까지만 책임지고, 실제 backend 연동 E2E는 Plan 02+03 이후 Wave 3 gate에서 실행하는 편이 dependency model과 맞습니다.
- Admin access control 자동 테스트를 추가하세요. 최소 케이스는 unauthenticated request, 일반 user role, admin role 3개입니다. 기대값은 프로젝트 auth 정책에 맞춰 401 또는 403으로 고정하고, 500은 명시적으로 실패시켜야 합니다.
- Date filter는 KST boundary를 DB에서 계산하되 column에는 함수를 씌우지 않는 형태를 고려하세요. 예: KST 자정 boundary를 UTC timestamp로 계산한 뒤 `reservations.createdAt >= boundaryStartUtc AND reservations.createdAt < boundaryEndUtc`로 비교하면 index 사용 가능성이 좋아집니다.
- ADM-06을 더 강하게 만들려면 index 상태를 확인하고 필요 시 별도 migration을 계획에 포함하세요. 최소 후보는 `(status, created_at)`, `created_at`, payment 쪽 `(reservation_id, status)`, showtime join 쪽 existing FK index 확인입니다.
- Payment distribution에는 `payments.status = 'DONE'` 조건을 추가하는 것을 권장합니다. `reservations.status = 'CONFIRMED'`와 함께 두 조건을 걸면 결제 완료 기준이 더 명확합니다.
- Revenue trend는 API에서 `generate_series`로 bucket을 채우거나, service에서 period별 bucket skeleton을 만든 뒤 DB 결과를 merge하세요. 0 revenue day/week가 chart에 보여야 운영자가 추이를 정확히 읽습니다.
- Error/empty/loading UI를 공통 작은 component로 분리하세요. 특히 `ChartPanelState`나 `SectionError`를 두면 genre/payment/top10에서 error를 empty로 숨기는 문제를 줄일 수 있습니다.
- UI-SPEC grep 검증 범위를 `apps/web/app/admin/page.tsx`뿐 아니라 `apps/web/components/admin/dashboard/**/*.tsx` 전체로 확장하세요. 그리고 `text-base` 사용 여부를 계획 코드에서 제거하거나 UI-SPEC을 현실적으로 완화해야 합니다.
- Plan 03 `files_modified`에 root `pnpm-lock.yaml`을 추가하세요. shadcn CLI가 CSS나 package metadata를 더 만질 수 있으므로 실행 후 diff review를 acceptance에 넣는 것도 좋습니다.
- Plan 04 `files_modified`에 실제 문서 3개를 명시하고, 완료 날짜는 예시 날짜가 아니라 실행일 기준으로 작성하도록 바꾸세요.

**Risk Assessment: MEDIUM**

기능 구조와 범위는 탄탄해서 ADM-01~06을 달성할 가능성은 높습니다. 다만 현재 계획 그대로 실행하면 RED 테스트의 신뢰도, Wave 2 병렬 의존성, admin auth 자동 검증 부재, SQL index 사용 문제, frontend error state 누락 때문에 검증 단계에서 흔들릴 가능성이 있습니다. 위 수정들을 반영하면 risk는 LOW-MEDIUM 수준으로 내려갈 수 있습니다.

---

## Cursor Review

_Cursor review skipped: `cursor-agent` requires authentication (`cursor agent login` or `CURSOR_API_KEY`). Run the login command and re-invoke `/gsd-review --phase 11 --cursor` to include a Cursor review._

---

## Consensus Summary

Only one reviewer produced output (codex), so "consensus" here reflects a single perspective. The sections below preserve the review structure so that future reruns (with `gemini`, `claude`, or `cursor` authenticated) can be merged on top.

### Agreed Strengths
- Phase boundary가 read-only aggregation + cache + UI composition으로 잘 좁혀져 있음 (RBAC, realtime, export 등 제외).
- 기존 `AdminModule` + `CacheService` + `AdminStatCard` 재사용으로 1인 개발 복잡도를 낮추는 방향.
- ADM-01~06 요구사항이 API / UI / validation 축에 각각 추적됨.
- Cloud Run UTC ↔ KST 경계 문제를 계획에 명시적으로 식별.

### Agreed Concerns (priority order)
1. **[HIGH] RED 테스트가 module-not-found로 무력화될 수 있음.** Plan 01이 service skeleton 없이 테스트만 작성하면 vitest collection 단계에서 실패해 assertion 피드백이 약해짐.
2. **[HIGH] Plan 03 acceptance(E2E GREEN)가 Plan 02에 암묵적으로 의존.** `depends_on: [11-01]`만 선언하면 Wave 2 병렬 가정이 깨짐 — Plan 04 gate로 이동하거나 Plan 02 의존성을 명시해야 함.
3. **[HIGH] Admin API 접근 제어(401/403)가 자동 테스트로 고정되지 않음.** unauthenticated / 일반 user / admin 3-케이스를 controller 또는 e2e 테스트로 박아야 500 누수 방지.
4. **[MEDIUM] 통계 쿼리의 `AT TIME ZONE` 컬럼 래핑으로 `created_at` index 사용 불가 가능성.** ADM-06 "집계 최적화"가 실질적으로 cache-only로 약화됨. KST boundary를 UTC timestamp로 미리 계산하고 raw column과 비교하는 형태로 변경 권장.
5. **[MEDIUM] ADM-05(결제수단 분포)에 `payments.status = 'DONE'` 필터 누락.** reservation 성공/실패 상태와 payment status를 모두 조건으로 걸어야 정확한 분포.
6. **[MEDIUM] Revenue trend에 빈 날짜/주 채움이 없음.** `generate_series` 또는 service-side bucket skeleton 필요.
7. **[MEDIUM] Frontend `isError || empty` 병합과 Top 10 error 누락 → UI-SPEC의 per-section error boundary 위반.** 공통 `ChartPanelState` / `SectionError` 컴포넌트로 분리.
8. **[MEDIUM] UI-SPEC Typography 규칙(`text-base`/`text-lg`/`font-medium`/`font-bold` 금지)과 Plan 03 예시 코드 충돌.** acceptance grep 범위를 `apps/web/components/admin/dashboard/**` 전체로 확장.
9. **[MEDIUM] Plan 03 `files_modified`에 root `pnpm-lock.yaml` 누락, Plan 04 `files_modified: []`인데 task는 문서 3개 수정.** frontmatter 정합성 보정 필요.
10. **[LOW] 미사용 logger, chart blank regression smoke test 부재, `sr-only` / `prefers-reduced-motion` 구현 누락.**

### Divergent Views
- N/A (single reviewer). 재리뷰 시 gemini/claude/cursor를 포함하면 이 섹션에서 의견 충돌 지점을 확인할 수 있습니다.

### Recommended Next Steps
- `/gsd-plan-phase 11 --reviews` 로 위 HIGH/MEDIUM 항목을 PLAN에 반영.
- 특히 Plan 01의 RED 정의, Plan 03 E2E gate 이동, admin auth 테스트 추가는 실행 전에 해결 권장.
- 추가 리뷰어가 필요하면 `cursor agent login` 또는 `gemini` 설치 후 `/gsd-review --phase 11 --gemini --cursor` 재실행.
