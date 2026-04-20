---
quick_id: 260420-oxe
slug: code-review-fix
date: 2026-04-20
status: planning
---

# Quick Task 260420-oxe: 코드 리뷰 수정 (오늘 KPI empty-range 버그)

## 배경

PR #17 코드 리뷰 (https://github.com/sangwopark19/grapit/pull/17#issuecomment-4279195904) 에서 critical 버그 1건 발견:

- `kstTodayBoundaryUtc()` 가 `kstBoundaryToUtc(0)` 을 호출 → `startUtc === endUtc` → `WHERE createdAt >= startUtc AND createdAt < endUtc` 가 항상 empty.
- `AdminDashboardService.getSummary()` 의 `todayBookings`, `todayRevenue`, `todayCancelled` 3종이 실데이터와 무관하게 항상 `0` 반환.
- 기존 unit test는 DB mock 고정값(`[{count: 10}]`)을 반환하므로 WHERE 절 empty여도 green. 기존 integration test는 `getSummary()` 를 호출하지 않음 — 둘 다 회귀 포착 불가.

## 심층 분석

`kstBoundaryToUtc(days)` 의 실제 의미는 "내일 KST 00:00에서 끝나는 N일짜리 윈도우":

| days | startUtc | endUtc | window |
|------|----------|--------|--------|
| 0    | tomorrow 00:00 KST | tomorrow 00:00 KST | 0h (BUG) |
| 1    | today 00:00 KST | tomorrow 00:00 KST | 24h (오늘만) |
| 7    | 6 days ago 00:00 KST | tomorrow 00:00 KST | 7 days (오늘 포함 최근 7일) |
| 30   | 29 days ago 00:00 KST | tomorrow 00:00 KST | 30 days |

→ "오늘만" 의미는 `days=1` 이지 `days=0` 이 아님. JSDoc `@param days 0 = 오늘만` 은 오기. 다른 호출부(`7d`/`30d`/`90d` 모두 양수)는 영향 없음 — 버그는 `kstTodayBoundaryUtc()` 에 격리됨.

## 변경

### Task 1: 버그 수정 + JSDoc 명확화

**File:** `apps/api/src/modules/admin/kst-boundary.ts`

- Line 49: `return kstBoundaryToUtc(0);` → `return kstBoundaryToUtc(1);`
- Line 27 JSDoc: `@param days 0 = 오늘만. 30 = ...` → `@param days 1 = 오늘만. 30 = 오늘 포함 최근 30일. days < 1 은 정의되지 않음.`
- (방어) `kstBoundaryToUtc` 진입점에 `days < 1` 가드 추가하여 향후 동일 회귀 차단.

### Task 2: 회귀 테스트 추가

**File (신규):** `apps/api/src/modules/admin/__tests__/kst-boundary.spec.ts`

순수함수이므로 DB/mock 불필요. 다음 검증:

1. `kstTodayBoundaryUtc()` 는 24시간 윈도우 반환 (`endUtc - startUtc === 86400000`) — 이 PR의 회귀 테스트.
2. `kstTodayBoundaryUtc()` 의 boundary가 KST 자정에 정렬 (UTC 15:00 시각).
3. `kstBoundaryToUtc(7)` 는 7일 윈도우.
4. `kstBoundaryToUtc(30)` 는 30일 윈도우.
5. `kstBoundaryToUtc(0)` 는 에러 throw (가드).
6. `buildDailyBucketSkeleton(N)` 과 `kstBoundaryToUtc(N)` 윈도우가 정렬 — skeleton 첫 날짜가 `startUtc` 의 KST 날짜와 일치.

## Must-haves

- [ ] `kstTodayBoundaryUtc()` 가 24h 윈도우 반환 (startUtc ≠ endUtc).
- [ ] `getSummary()` 가 오늘 데이터 존재 시 non-zero 반환 (간접 — 위 수정으로 해결).
- [ ] Unit test `kst-boundary.spec.ts` 추가, `pnpm --filter @grapit/api test` 전체 green.
- [ ] `pnpm --filter @grapit/api lint` green.

## Verify

```bash
pnpm --filter @grapit/api test -- kst-boundary
pnpm --filter @grapit/api test -- admin-dashboard.service
pnpm --filter @grapit/api lint
```

## Done

- 위 모든 테스트 green.
- Atomic commit: 수정 + 테스트 한 커밋. conventional commit `fix(11):` prefix.
