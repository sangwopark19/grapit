---
quick_id: 260420-oxe
slug: code-review-fix
date: 2026-04-20
status: complete
commits:
  - 84a1594
---

# Quick Task 260420-oxe: Code Review Fix — SUMMARY

## 해결한 문제

PR #17 (Phase 11 어드민 대시보드) 코드 리뷰에서 confidence 100 으로 flagged 된 critical 버그:

`kstTodayBoundaryUtc()` 가 `kstBoundaryToUtc(0)` 를 호출하여 `startUtc === endUtc` 가 됨. 결과적으로 `AdminDashboardService.getSummary()` 의 오늘 KPI 3종 (`todayBookings`, `todayRevenue`, `todayCancelled`) 이 실데이터와 무관하게 항상 0 반환.

참조: https://github.com/sangwopark19/grapit/pull/17#issuecomment-4279195904

## 심층 분석 결과

1. **버그의 본질:** `kstBoundaryToUtc(days)` 의 `days` 파라미터 의미는 **윈도우 길이 (일 단위)**. "오늘만" 의미는 `days=1` (24h 윈도우), `days=0` 은 0-length 윈도우. JSDoc `@param days 0 = 오늘만` 이 잘못된 계약을 제시.
2. **격리성 확인:** `kstBoundaryToUtc` 의 다른 호출부는 모두 양수 (`daysForPeriod('7d'/'30d'/'90d')` → 7/30/90, `TOP_PERFORMANCES_WINDOW_DAYS` = 30). 버그는 `kstTodayBoundaryUtc()` 래퍼에만 국한.
3. **회귀 포착 실패 원인:**
   - Service unit test (`admin-dashboard.service.spec.ts:57-72`) 는 Drizzle 체인을 Proxy 로 mock 하여 `[{count: 10}]` 고정값 반환 → WHERE 절이 empty여도 green.
   - Integration test (`admin-dashboard.integration.spec.ts`) 는 `getSummary()` 를 호출하지 않음 (`getRevenueTrend`, `getTopPerformances` 만 커버).
   - → 두 레이어 모두 오늘 윈도우 경계 검증 공백.

## 변경 사항

### `apps/api/src/modules/admin/kst-boundary.ts`

- `kstTodayBoundaryUtc()` 를 `kstBoundaryToUtc(1)` 로 수정 (주요 수정).
- `kstBoundaryToUtc` 진입점에 `days < 1 || !Number.isInteger(days)` 가드 추가 → 동일 회귀 즉시 throw.
- JSDoc 업데이트: `@param days` 의미를 "윈도우 길이" 로 명시, `1 = 오늘만` 예시 포함.
- `kstTodayBoundaryUtc` JSDoc 에 버그 히스토리 NOTE 추가.

### `apps/api/src/modules/admin/__tests__/kst-boundary.spec.ts` (신규)

10건 unit test. `vi.setSystemTime(2026-04-20T12:00:00Z)` 로 고정:

| # | 검증 |
|---|------|
| 1 | `kstTodayBoundaryUtc()` 가 24h 윈도우 반환 — **회귀 테스트** |
| 2 | boundary 가 KST 자정에 정렬 (UTC 15:00) |
| 3-5 | `kstBoundaryToUtc(7/30/90)` 각각 7/30/90 일 윈도우 |
| 6-8 | `kstBoundaryToUtc(0)` / 음수 / non-integer 는 `RangeError` throw |
| 9 | `kstTodayBoundaryUtc()` == `kstBoundaryToUtc(1)` parity |
| 10 | `buildDailyBucketSkeleton` 과 `kstBoundaryToUtc` 정렬 (첫 bucket = startUtc KST 날짜) |

## 검증

```
pnpm --filter @grapit/api test
→ Test Files  29 passed (29), Tests 283 passed (283)

pnpm --filter @grapit/api lint
→ 0 errors, 36 warnings (모두 pre-existing, 이번 변경 파일에는 없음)

pnpm --filter @grapit/api typecheck
→ clean
```

## 커밋

- `84a1594` — fix(11): restore today KPI window in kstTodayBoundaryUtc

## Follow-up (out of scope)

- 통합 테스트에서 `getSummary()` 를 실제 DB 대상으로 호출하는 커버리지 추가 (이번 task 에선 pure-function 회귀 테스트로 충분하다고 판단 — 서비스 통합 테스트는 별도 phase로).
