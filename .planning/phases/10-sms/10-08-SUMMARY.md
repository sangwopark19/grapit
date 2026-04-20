---
phase: 10
plan: 08
subsystem: frontend/auth
tags: [phone-verification, sms, cooldown, error-mapping, international-number, accessibility]
dependency_graph:
  requires: [10-05, 10-06]
  provides: [phone-verification-4state, detectPhoneLocale, SMS_RESEND_COOLDOWN_SECONDS]
  affects: [signup-step3, callback-page]
tech_stack:
  added: [libphonenumber-js, "@testing-library/jest-dom"]
  patterns: [4-state-button, independent-cooldown-timer, http-error-copy-mapping]
key_files:
  created:
    - apps/web/lib/phone.ts
  modified:
    - apps/web/components/auth/phone-verification.tsx
    - apps/web/components/auth/__tests__/phone-verification.test.tsx
    - packages/shared/src/constants/index.ts
    - apps/web/package.json
decisions:
  - "detectPhoneLocale를 lib/phone.ts 유틸로 분리 (UI-SPEC 권장 패턴)"
  - "jest-dom/vitest matchers 도입으로 toBeInTheDocument 등 DOM assertion 활성화"
  - "shouldAdvanceTime: true로 fake timer + async mock 호환성 확보"
metrics:
  duration: 712s
  completed: "2026-04-16T03:18:51Z"
  tasks: 2
  files: 6
---

# Phase 10 Plan 08: PhoneVerification 컴포넌트 재작성 Summary

phone-verification.tsx를 UI-SPEC 계약대로 완전 재작성: 4-state 재발송 버튼(initial/sending/cooldown/resend-ready), 30s 독립 쿨다운 타이머, HTTP 상태별 에러 카피 5종, 국제 번호 raw passthrough + 국가 감지 안내, a11y 속성 보강

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 10-08-T1 | 공유 상수 + detectPhoneLocale 유틸 | a543fa8 | packages/shared/src/constants/index.ts, apps/web/lib/phone.ts, apps/web/package.json |
| 10-08-T2 (RED) | phone-verification 테스트 작성 | ddc1120 | apps/web/components/auth/__tests__/phone-verification.test.tsx |
| 10-08-T2 (GREEN) | phone-verification 재작성 | 0ec9bc4 | apps/web/components/auth/phone-verification.tsx, phone-verification.test.tsx |

## Implementation Details

### Task 1: 공유 상수 + detectPhoneLocale 유틸
- `SMS_RESEND_COOLDOWN_SECONDS = 30` 상수를 shared constants에 추가 (서버 Valkey PX 30000과 동기화)
- `apps/web/lib/phone.ts` 신규 생성: `detectPhoneLocale()` 함수로 한국/국제 번호 자동 감지
- libphonenumber-js/min 사용하여 경량 파싱

### Task 2: phone-verification.tsx 재작성 (TDD)
- **4-state 버튼:** initial -> sending -> cooldown(30s) -> resend-ready 정확 전환
- **독립 쿨다운 타이머:** `resendCooldown` state + 별도 `useEffect`로 만료 타이머(3분)와 독립 동작
- **에러 카피 매핑:** `mapErrorToCopy()` 헬퍼로 HTTP 상태별 한국어 에러 메시지 분기
  - 429: "잠시 후 다시 시도해주세요"
  - 410/422: "인증번호가 만료되었습니다. 재발송해주세요"
  - 400 (중국 본토): 서버 메시지 전달
  - 400 (일반): "인증번호가 일치하지 않습니다"
  - 5xx: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
- **국제 번호:** raw passthrough (마스킹 없음) + 국가 감지 안내 텍스트
- **UI-SPEC 교정:** space-y-3 -> space-y-4, text-sm -> text-caption, size="lg" 버튼
- **접근성:** autoComplete="one-time-code"/"tel", role="alert"/"status", aria-label(쿨다운)
- **D-19 준수:** 시도 횟수 UI 미노출
- **props 인터페이스 불변:** 호출부(signup-step3, callback) 무영향

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] libphonenumber-js 설치 누락**
- **Found during:** Task 1
- **Issue:** Plan에서 "libphonenumber-js is installed in apps/web/package.json"이라 했으나 실제로 미설치
- **Fix:** `pnpm --filter @grapit/web add libphonenumber-js` 실행
- **Files modified:** apps/web/package.json, pnpm-lock.yaml

**2. [Rule 3 - Blocking] @testing-library/jest-dom 미설치**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Plan 01 테스트가 `toBeInTheDocument` 등 jest-dom matcher를 사용하지만 jest-dom이 프로젝트에 설치되지 않음
- **Fix:** `pnpm --filter @grapit/web add -D @testing-library/jest-dom` + test 파일에 import 추가
- **Files modified:** apps/web/package.json, phone-verification.test.tsx

**3. [Rule 3 - Blocking] fake timer + async mock 충돌**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** `vi.useFakeTimers()` 기본 모드에서 async API mock이 resolve되지 않아 5초 timeout
- **Fix:** `vi.useFakeTimers({ shouldAdvanceTime: true })` + `afterEach(vi.useRealTimers)` + phone.ts mock 추가
- **Files modified:** phone-verification.test.tsx

**4. [Rule 2 - Critical] ApiClientError mock 정렬**
- **Found during:** Task 2 (TDD RED)
- **Issue:** Plan 01의 원본 테스트가 `Error` + `status` 속성으로 에러를 생성했으나, 컴포넌트의 `mapErrorToCopy`는 `ApiClientError` instanceof 검사 사용
- **Fix:** 테스트 mock에서 `ApiClientError` 클래스를 정확히 재현하여 statusCode 기반 분기 테스트
- **Files modified:** phone-verification.test.tsx

## Verification

- phone-verification.test.tsx: 13/13 tests PASSED (main repo에서 검증)
- Acceptance criteria: 9/9 grep checks PASSED
- props 인터페이스 불변 확인 (PhoneVerificationProps 동일)

## Self-Check: PASSED

- All 5 created/modified files exist on disk
- All 3 commits (a543fa8, ddc1120, 0ec9bc4) found in git log
- 13/13 tests PASSED in main repo environment
- 9/9 acceptance criteria grep checks PASSED
