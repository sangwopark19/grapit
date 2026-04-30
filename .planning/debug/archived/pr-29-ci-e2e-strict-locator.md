---
status: resolved
trigger: "PR #29 CI 실패: E2E tests (Toss Payments) strict mode violation"
created: 2026-04-30T12:00:00+09:00
updated: 2026-04-30T12:02:00+09:00
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED - lock failure message가 본문 alert와 Sonner toast에 중복 렌더링되어 Playwright getByText strict locator가 3개 element를 매칭한다.
test: apiClient toast 억제 옵션과 payment mutation option propagation unit tests
expecting: lock failure는 inline alert로만 렌더링되고 payment E2E의 message locator가 단일 본문 element를 매칭한다.
next_action: CI 재실행으로 PR check green 확인

## Symptoms

expected: PR #29 CI `E2E tests (Toss Payments)`가 23개 테스트를 모두 통과해야 한다.
actual: `e2e/toss-payment.spec.ts`의 lock ownership 테스트 2개가 실패했다.
errors: `strict mode violation: getByText(...) resolved to 3 elements`
reproduction: GitHub Actions run `25144265879`, job `73700573886`, step `E2E tests (Toss Payments)`
started: Phase 19 PR #29

## Evidence

- timestamp: 2026-04-30
  checked: `gh run view 25144265879 --job 73700573886 --log-failed`
  found: `getByText('좌석 점유 시간이 만료되었습니다. 좌석을 다시 선택해주세요.')`와 `getByText('이미 다른 사용자가 선택한 좌석입니다.')`가 각각 3개 element를 매칭했다.
  implication: backend 409 처리 실패가 아니라 DOM duplicate text로 인한 Playwright strict locator 실패다.

- timestamp: 2026-04-30
  checked: `apps/web/lib/api-client.ts`
  found: non-401 API error마다 전역 `toast.error(errorMessage)`를 호출한다.
  implication: 페이지가 같은 에러를 inline alert로 표시하면 같은 text가 toast와 본문에 동시에 나타난다.

- timestamp: 2026-04-30
  checked: `apps/web/app/booking/[performanceId]/confirm/page.tsx` and `apps/web/app/booking/[performanceId]/complete/page.tsx`
  found: lock failure branch에서 inline alert를 렌더링하면서 페이지 catch block도 `toast.error(errorMessage)`를 호출했다.
  implication: lock failure UX가 alert와 toast로 중복 표시되고 E2E locator가 불안정해진다.

## Eliminated

- hypothesis: Toss test secrets 누락
  evidence: CI step `Verify Toss test secrets present` succeeded.
  timestamp: 2026-04-30

- hypothesis: API startup or DB seed failure
  evidence: migrations, seed, login smoke, API startup steps all succeeded before E2E.
  timestamp: 2026-04-30

- hypothesis: backend reservation/payment unit regression
  evidence: CI `pnpm test` and Valkey integration step succeeded.
  timestamp: 2026-04-30

## Resolution

root_cause: lock ownership 409 error가 global API toast와 booking page inline alert에서 중복 표시되었다. Sonner가 같은 title text를 추가 DOM으로 렌더링하면서 Playwright strict `getByText` assertion이 단일 element를 선택하지 못했다.

fix: `apiClient`에 `{ showErrorToast: false }` 옵션을 추가하고 reservation prepare/payment confirm mutation에서 사용했다. lock failure branch는 inline alert만 표시하고 page-level toast 호출을 건너뛰도록 했다.

verification:
- `pnpm --dir apps/web exec vitest run lib/__tests__/api-client.test.ts hooks/__tests__/use-booking.test.tsx` - pass, 13 tests
- `pnpm --filter @grabit/web typecheck` - pass
- `pnpm --filter @grabit/web lint` - pass, existing warnings only
- `pnpm --filter @grabit/web test` - pass, 27 files, 191 tests

files_changed:
- `apps/web/lib/api-client.ts`
- `apps/web/hooks/use-booking.ts`
- `apps/web/app/booking/[performanceId]/confirm/page.tsx`
- `apps/web/app/booking/[performanceId]/complete/page.tsx`
- `apps/web/lib/__tests__/api-client.test.ts`
- `apps/web/hooks/__tests__/use-booking.test.tsx`
