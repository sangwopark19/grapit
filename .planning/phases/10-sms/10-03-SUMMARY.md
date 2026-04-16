---
phase: 10-sms
plan: 03
subsystem: api
tags: [libphonenumber-js, e164, phone-validation, china-detection]

# Dependency graph
requires:
  - phase: 10-sms-01
    provides: "phone.util.spec.ts RED 테스트 (이 plan에서 동일 테스트 재작성)"
  - phase: 10-sms-02
    provides: "libphonenumber-js 의존성 설치 (이 plan에서 직접 설치)"
provides:
  - "parseE164() - E.164 전화번호 정규화 유틸리티"
  - "isChinaMainland() - 중국 본토 번호 감지 유틸리티"
affects: [10-sms-05, 10-sms-06]

# Tech tracking
tech-stack:
  added: [libphonenumber-js/min]
  patterns: [full-width-normalization, 0086-prefix-conversion, korean-local-fast-path]

key-files:
  created:
    - apps/api/src/modules/sms/phone.util.ts
    - apps/api/src/modules/sms/phone.util.spec.ts
  modified:
    - apps/api/package.json
    - pnpm-lock.yaml

key-decisions:
  - "libphonenumber-js/min sub-entry 사용으로 metadata 80KB 최소화"
  - "한국 로컬 포맷(010-xxxx-xxxx) fast path로 libphonenumber 호출 우회"

patterns-established:
  - "Pattern: full-width 문자 전처리 후 E.164 정규화"
  - "Pattern: 00 prefix -> + 변환으로 국제 다이얼 포맷 지원"

requirements-completed: [SMS-02]

# Metrics
duration: 2min
completed: 2026-04-16
---

# Phase 10 Plan 03: phone.util.ts Summary

**libphonenumber-js/min 기반 E.164 정규화(parseE164)와 중국 본토 감지(isChinaMainland) 유틸리티 구현 -- Review #8 CN edge cases(0086, full-width, 공백, 홍콩/마카오/대만) 전부 통과**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T02:41:18Z
- **Completed:** 2026-04-16T02:43:16Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- parseE164(): 한국 로컬 포맷, E.164 passthrough, 0086 prefix, full-width digit, 공백 포함 번호 모두 정규화
- isChinaMainland(): +86 true, +852(홍콩)/+853(마카오)/+886(대만) false 정확 판정
- 14개 테스트 전부 GREEN (TDD RED -> GREEN 전환 완료)

## Task Commits

Each task was committed atomically:

1. **Task 1: phone.util.ts 작성 (parseE164 + isChinaMainland)**
   - `7a03b06` (test: RED - 14 failing tests)
   - `bd57ff8` (feat: GREEN - implementation passing all 14 tests)

## Files Created/Modified
- `apps/api/src/modules/sms/phone.util.ts` - E.164 정규화 + 중국 본토 감지 유틸리티 (63 lines)
- `apps/api/src/modules/sms/phone.util.spec.ts` - parseE164 + isChinaMainland 14개 테스트
- `apps/api/package.json` - libphonenumber-js 의존성 추가
- `pnpm-lock.yaml` - lockfile 업데이트

## Decisions Made
- libphonenumber-js/min sub-entry 사용으로 metadata ~80KB 최소화 (full 대비 약 60% 절약)
- 한국 로컬 포맷 regex fast path: libphonenumber 파싱 건너뛰어 빈번한 한국 번호 처리 속도 향상
- normalizeFullWidth() 함수를 모듈 프라이빗으로 유지 (export 불필요)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] libphonenumber-js 의존성 직접 설치**
- **Found during:** Task 1
- **Issue:** Plan 02에서 설치되어야 하나 worktree에 아직 미반영 (병렬 실행)
- **Fix:** `pnpm --filter @grapit/api add libphonenumber-js@^1.12.41` 직접 실행
- **Files modified:** apps/api/package.json, pnpm-lock.yaml
- **Verification:** import 정상 동작, 14개 테스트 통과
- **Committed in:** bd57ff8 (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] phone.util.spec.ts 직접 작성**
- **Found during:** Task 1
- **Issue:** Plan 01의 RED 테스트 파일이 worktree에 미반영 (병렬 실행)
- **Fix:** Plan 01의 spec 정의에 따라 14개 테스트를 직접 작성
- **Files modified:** apps/api/src/modules/sms/phone.util.spec.ts
- **Verification:** RED 상태 확인 후 GREEN 전환
- **Committed in:** 7a03b06 (Task 1 RED commit)

---

**Total deviations:** 2 auto-fixed (2 blocking -- 병렬 worktree 의존성 미반영)
**Impact on plan:** 병렬 실행 환경에서 불가피한 의존성 자체 해결. 기능 범위 변경 없음.

## Issues Encountered
- 기존 typecheck 에러(@grapit/shared 모듈 관련) 존재하나 phone.util.ts와 무관한 기존 문제. Scope Boundary 규칙에 따라 무시.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- parseE164(), isChinaMainland()이 Plan 05(SmsService 재작성)에서 바로 사용 가능
- Plan 06(controller 국제 번호 지원)에서 E.164 정규화 활용 준비 완료

---
*Phase: 10-sms*
*Completed: 2026-04-16*
