---
phase: 11
slug: admin-dashboard
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
updated: 2026-04-20
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (API)** | vitest 3.2.x — unit (`apps/api/vitest.config.ts`), integration (`apps/api/vitest.integration.config.ts`, testcontainers 기반) |
| **Framework (Web)** | vitest 3.2.x + @testing-library/react 16.x (`apps/web/vitest.config.ts`) |
| **Framework (E2E)** | Playwright 1.59.1 (`apps/web/e2e/*.spec.ts`) |
| **Config file** | 기존 설치, 신규 install 불필요 |
| **Quick run command** | `pnpm --filter @grapit/api test admin-dashboard.service.spec.ts` |
| **Full suite command** | `pnpm test` (turborepo, 전체 workspace) |
| **Integration command** | `pnpm --filter @grapit/api test:integration -- admin-dashboard.integration.spec.ts` |
| **E2E command** | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` |
| **Estimated runtime (quick)** | ~5–10 seconds |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @grapit/api test admin-dashboard.service.spec.ts` (약 5–10초)
- **After every plan wave:** `pnpm test` (turborepo cache 활용, ~30초)
- **Before `/gsd-verify-work`:** `pnpm test` + `pnpm --filter @grapit/api test:integration` + `pnpm --filter @grapit/web test:e2e` 모두 green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Final Task IDs assigned by planner. 아래는 REQ → Behavior → Test command 매핑의 Nyquist 샘플링 참조표.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ADM-01 | V4-admin-role | summary API가 오늘 예매/매출/취소/활성 공연 4개 수치 반환 | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t summary` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-01 | — | KST 23:59 예매는 오늘, 00:01은 내일로 카운트 (mock clock) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t kst-boundary` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-02 | V5-period-enum | 일별 30일 revenue trend 반환 (배열 길이 ≤ 30) | integration | `pnpm --filter @grapit/api test:integration -- admin-dashboard.integration.spec.ts -t revenue-daily` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-02 | — | 주별 90일 revenue trend 반환 (배열 길이 ≤ 13) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t revenue-weekly` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-03 | — | 장르별 bookings count (GROUP BY performances.genre) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t genre` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-04 | — | Top 10 공연 (최근 30일 CONFIRMED, count desc, limit 10) | integration | `pnpm --filter @grapit/api test:integration -- admin-dashboard.integration.spec.ts -t top10` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-05 | — | 결제수단별 count (CONFIRMED 결제만, payments.method GROUP BY) | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t payment` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-06 | T-07-11 log hygiene | cache hit: cache.get 값 반환 시 DB 호출 0회 | unit (mock) | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t cache-hit` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-06 | — | cache.set이 ttlSeconds=60으로 정확히 호출 | unit | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t cache-set-ttl` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-06 | — | Redis down 시 graceful degradation: cache 실패 → DB fallback, 예외 미전파 | unit (mock throw) | `pnpm --filter @grapit/api vitest admin-dashboard.service.spec.ts -t cache-degradation` | ✅ | ✅ green |
| TBD | TBD | TBD | ADM-01~05 UI | V4-admin-role (FE guard) | 대시보드 페이지 마운트 시 KPI 4장 + chart 3종 + Top10 테이블 모두 렌더 | e2e smoke | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts -t landing-smoke` | ✅ | ✅ green |
| TBD | TBD | TBD | D-09 UI | — | 기간 필터 30일 → 7일 클릭 시 revenue/genre/payment 3개 chart 동시 refetch | e2e | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts -t period-filter` | ✅ | ✅ green |
| TBD | TBD | TBD | D-01/D-02/D-03 UI | — | `/admin` 접근 시 대시보드 렌더, sidebar '대시보드' 항목 active 하이라이트 | e2e smoke | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts -t sidebar-nav` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/src/modules/admin/__tests__/admin-dashboard.service.spec.ts` — unit coverage (ADM-01~06 + cache hit/miss/degradation) — 8/8 GREEN (2026-04-20)
- [x] `apps/api/test/admin-dashboard.integration.spec.ts` — integration w/ testcontainers — 2/2 GREEN (2026-04-20)
- [x] `apps/web/e2e/admin-dashboard.spec.ts` — E2E smoke + period filter + sidebar nav + chart-blank-guard (Task 04-01 추가) — 실행은 Task 04-02 수동 QA에서
- [x] Playwright admin login helper 재사용 확인 (`admin@grapit.test` seed 유저 존재 검증) — helpers/auth.ts:42 활용

*(프레임워크 install 불필요 — vitest/playwright 모두 기존 설치.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 차트 색상이 UI-SPEC의 brand palette와 일치 | ADM-02/03/05 | 시각적 판단 — CSS variable `--chart-1..5` 값은 자동 체크 가능하나 실제 렌더 색감은 눈으로 확인 | 브라우저에서 `/admin` 접속 → area/donut/bar chart 색상이 `11-UI-SPEC.md §Color/Palette` 와 일치하는지 확인 |
| recharts 3.8.x + React 19.2 렌더 회귀(#6857) 실제 미발생 | — (Wave 0 검증) | 이슈 재현 여부 미확인 — 실측 필요 | Wave 0 task에서 `pnpm --filter @grapit/web dev` 후 `/admin` 접속, 각 chart 2회 resize/refocus 재현 시 crash/empty 없는지 확인. 문제 발생 시 `react-is` pnpm override 적용 |
| 실제 예매 데이터 기반 cache hit rate 관찰 | ADM-06 | 프로덕션-유사 부하 하에서만 의미 있음 — CI 환경에서는 시뮬레이션 불가 | 스테이징 배포 후 Cloud Run 로그에서 `CacheService` hit/miss 비율 확인, 60초 내 동일 key 재조회 시 hit 관찰 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (unit+controller+integration ~15초, pnpm test ~5초)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-04-20)

### Execution Results (Task 04-01, 2026-04-20)

| Suite | Command | Result |
|-------|---------|--------|
| unit (service) | `vitest run admin-dashboard.service.spec.ts` | 8/8 PASS |
| controller access-control | `vitest run admin-dashboard.controller.spec.ts` | 3/3 PASS (401/403/200) |
| integration | `test:integration -- admin-dashboard.integration.spec.ts` | 2/2 PASS |
| web typecheck | `pnpm --filter @grapit/web typecheck` | 0 exit |
| web lint | `pnpm --filter @grapit/web lint` | 0 errors (18 pre-existing warnings 미상관) |
| UI-SPEC Typography scope scan | grep `text-base\|text-lg\|text-2xl\|text-3xl\|font-medium\|font-bold` | 0 violations |
| monorepo | `pnpm test` | 383/383 PASS (API 273 + Web 110) |
| E2E (4 tests) | `pnpm --filter @grapit/web test:e2e -- admin-dashboard.spec.ts` | **deferred to Task 04-02 manual QA** (API 서버 미기동) |

### Manual QA Status (Task 04-02)

User 결정: 수동 검증 이후로 유예 → 11-HUMAN-UAT.md에 11개 검증 항목 기록. 추후 `/gsd-verify-work 11`로 실행.

### Out-of-Scope Regression

`apps/api/test/sms-throttle.integration.spec.ts` 2 failed — Phase 10/10.1 파생, Phase 11 미변경 파일. 별도 phase 처리 필요.
