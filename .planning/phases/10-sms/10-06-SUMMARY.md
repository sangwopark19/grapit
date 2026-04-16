---
phase: 10-sms
plan: 06
subsystem: api
tags: [nestjs-throttler, rate-limiting, zod, sms, e164, http-exception]

requires:
  - phase: 10-05
    provides: SmsService with Infobip + Lua atomic counters + phone axis rate limiting
provides:
  - "@Throttle IP axis rate limiting on sendCode (20/h) and verifyCode (10/15min)"
  - "E.164 international phone number support in sendCodeSchema"
  - "Unified HTTP 429 responses across ThrottlerException and SmsService phone axis"
affects: [10-07, 10-08, 10-09]

tech-stack:
  added: []
  patterns:
    - "@Throttle v6 object signature with ms TTL and defense-in-depth comments"
    - "HttpException(body, HttpStatus.TOO_MANY_REQUESTS) for application-level 429"

key-files:
  created: [apps/api/src/modules/sms/sms.controller.spec.ts]
  modified: [apps/api/src/modules/sms/sms.controller.ts, apps/api/src/modules/sms/sms.service.ts]

key-decisions:
  - "HttpException(429) over BadRequestException for phone axis limits -- ensures HTTP status matches body statusCode for frontend D-20 branching"
  - "sendCodeSchema exported for test import -- enables unit testing of regex validation"

patterns-established:
  - "@Throttle v6 pattern: always add ms unit comment (e.g., '3_600_000ms = 1h, NOT 3600s')"
  - "defense-in-depth comments: document why IP axis is added beyond spec when extending D-06/D-07"

requirements-completed: [SMS-01, SMS-02, SMS-04]

duration: 3min
completed: 2026-04-16
---

# Phase 10 Plan 06: @Throttle IP Axis + International Phone + 429 Unification Summary

**@Throttle IP axis decorators on send/verify-code, E.164 international phone regex, and HttpException 429 unification replacing BadRequestException(400) for consistent frontend error handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-16T02:59:45Z
- **Completed:** 2026-04-16T03:02:53Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- @Throttle IP axis rate limiting: sendCode 20/h, verifyCode 10/15min with defense-in-depth rationale
- sendCodeSchema regex extended to accept both Korean local (010xxxx) and E.164 international (+1xxx) numbers
- 3 BadRequestException(400) calls in sms.service.ts replaced with HttpException(429) for consistent HTTP status
- v6 ms unit comments on all TTL values per Review #6
- 12 unit tests covering decorator metadata, phone validation, and 429 HTTP status

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `2de9df2` (test)
2. **Task 1 GREEN: Implementation** - `f9f569c` (feat)

## Files Created/Modified
- `apps/api/src/modules/sms/sms.controller.ts` - Added @Throttle decorators, Throttle import, exported sendCodeSchema with E.164 regex
- `apps/api/src/modules/sms/sms.service.ts` - BadRequestException -> HttpException(429) for 3 phone axis rate limit throws
- `apps/api/src/modules/sms/sms.controller.spec.ts` - 12 unit tests: decorator metadata, phone regex, 429 status

## Decisions Made
- Used HttpException(body, HttpStatus.TOO_MANY_REQUESTS) instead of keeping BadRequestException with statusCode:429 in body -- ensures HTTP transport status (429) matches body for frontend ApiClientError.statusCode check (D-20)
- Exported sendCodeSchema (was private const) for direct unit test validation without HTTP layer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IP axis + phone axis rate limiting complete for both endpoints
- International phone numbers now accepted for non-Korean users
- Ready for Plan 07 (HttpExceptionFilter 429 Korean message mapping) and Plan 08/09

## Self-Check: PASSED

- All 3 source files exist
- Both commits (2de9df2, f9f569c) verified in git log
- 12/12 tests pass
- All acceptance criteria grep checks pass

---
*Phase: 10-sms*
*Completed: 2026-04-16*
