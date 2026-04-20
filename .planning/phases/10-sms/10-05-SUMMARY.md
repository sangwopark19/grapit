---
phase: 10-sms
plan: 05
subsystem: api
tags: [infobip, sms, otp, valkey, lua, redis, rate-limiting, nestjs]

requires:
  - phase: 10-sms/03
    provides: phone.util.ts (parseE164, isChinaMainland)
  - phase: 10-sms/04
    provides: infobip-client.ts (InfobipClient, InfobipApiError)
  - phase: 07
    provides: REDIS_CLIENT provider via BookingModule

provides:
  - SmsService with Infobip 2FA integration (sendVerificationCode, verifyCode)
  - Lua atomic counter for phone-axis rate limiting
  - Cooldown key rollback policy on Infobip failure
  - Dev mock mode with hard-fail production guard

affects: [10-sms/06, 10-sms/07, auth]

tech-stack:
  added: []
  patterns:
    - "Lua script atomic INCR+EXPIRE for rate-limit counters"
    - "Cooldown key rollback on provider 5xx/timeout, retain on 4xx"
    - "Infobip pinAttempts=5 delegation (no app-level attempt counter)"
    - "REDIS_CLIENT cross-module injection via BookingModule re-export"

key-files:
  created: []
  modified:
    - apps/api/src/modules/sms/sms.service.ts
    - apps/api/src/modules/sms/sms.module.ts

key-decisions:
  - "Lua script for atomic INCR+EXPIRE prevents zombie keys on process crash"
  - "Cooldown rollback: 5xx/timeout DEL vs 4xx retain protects user from SMS non-delivery lockout"
  - "OTP max 5 attempts delegated to Infobip Application config, no app-level counter"
  - "BookingModule re-export pattern for REDIS_CLIENT (shared module extraction deferred to Phase 11+)"

patterns-established:
  - "Lua atomic counter: INCR key, if count==1 then EXPIRE, return count"
  - "Provider failure rollback: distinguish 4xx (user error) vs 5xx (provider error)"
  - "Hard-fail production guard: throw if env vars missing in production, dev mock otherwise"

requirements-completed: [SMS-01, SMS-02, SMS-03, SMS-04]

duration: 2min
completed: 2026-04-16
---

# Phase 10 Plan 05: SmsService Infobip Rewrite Summary

**SmsService Twilio->Infobip 전면 재작성: Lua atomic counter, cooldown rollback, 4-layer rate limiting, hard-fail production guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T02:53:31Z
- **Completed:** 2026-04-16T02:56:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- SmsService를 Twilio에서 Infobip 2FA API로 전면 재작성 (222 LOC)
- Cross-AI review 피드백 4건(HIGH) 전부 반영: Lua atomicity, cooldown rollback, pinAttempts 위임, TTL race
- SmsModule에 BookingModule import 추가로 REDIS_CLIENT 주입 경로 확보 (순환 의존 사전 검증 완료)
- 52 SMS 관련 테스트 전부 GREEN (sms.service 18 + phone.util + infobip-client)

## Task Commits

Each task was committed atomically:

1. **Task 1: SmsModule BookingModule import** - `f4d216a` (feat)
2. **Task 2: SmsService Infobip rewrite** - `5fecbc7` (feat)

## Files Created/Modified
- `apps/api/src/modules/sms/sms.module.ts` - BookingModule import 추가로 REDIS_CLIENT 주입 가능
- `apps/api/src/modules/sms/sms.service.ts` - Infobip 기반 SMS 서비스 전면 재작성 (222 LOC)

## Decisions Made
- Lua script로 atomic INCR+EXPIRE 구현: 첫 INCR(count=1) 시에만 EXPIRE 설정, 프로세스 crash 시 좀비 key 방지
- Cooldown key rollback 정책: Infobip 5xx/timeout/network -> DEL (사용자가 SMS 미수신인데 30s 차단 방지), 4xx -> 유지 (사용자 입력 오류/abuse)
- OTP max 5 attempts는 Infobip Application pinAttempts=5에 위임, 앱 레벨 counter 의도적 미구현
- REDIS_CLIENT는 BookingModule re-export 패턴 유지 (shared RedisModule 분리는 Phase 11+ 스코프)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SmsService가 REDIS_CLIENT를 통해 Valkey와 통합 완료, Plan 06 (SmsController + Throttler) 구현 준비 완료
- auth.service.ts 호출부 무영향 (응답 shape SendResult/VerifyResult 불변)
- Infobip 4종 환경변수 설정은 DEPLOY-CHECKLIST.md 참조

## Self-Check: PASSED

- [x] sms.service.ts exists (222 LOC)
- [x] sms.module.ts exists (BookingModule import present)
- [x] 10-05-SUMMARY.md created
- [x] Commit f4d216a verified (Task 1)
- [x] Commit 5fecbc7 verified (Task 2)
- [x] 52 SMS tests GREEN
- [x] No Twilio references in sms.service.ts
- [x] All 4 review items reflected

---
*Phase: 10-sms*
*Completed: 2026-04-16*
