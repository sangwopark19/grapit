---
quick_task: 260420-et3-pr-16-3-sms-attempts-phone-axis-send-5xx
plan: 01
type: execute
status: completed
completed_at: 2026-04-20
requirements: [PR16-REVIEW-ET3-1, PR16-REVIEW-ET3-2, PR16-REVIEW-ET3-3]
key-files:
  modified:
    - apps/api/src/modules/sms/infobip-client.ts
    - apps/api/src/modules/sms/infobip-client.spec.ts
    - apps/api/src/modules/sms/sms.service.ts
    - apps/api/src/modules/sms/sms.service.spec.ts
commits:
  - hash: a9d4083
    type: fix
    scope: sms-260420-et3-01
    issue: Issue 3 — Infobip groupId=5 (REJECTED) detection
  - hash: 79073b6
    type: fix
    scope: sms-260420-et3-02
    issue: Issue 2 — phone-axis send counter rollback on 5xx
  - hash: 8ad4a15
    type: fix
    scope: sms-260420-et3-03
    issue: Issue 1 — sms:attempts reset on new OTP
metrics:
  task_count: 3
  files_modified: 4
  tests_added: 9
  tests_total_after: 28
  full_suite_passing: 242
---

# Quick Task 260420-et3: PR #16 Code Review HIGH Severity Fixes Summary

PR #16 (Phase 10.1 SMS API v3 rewrite)에서 코드리뷰로 발견된 HIGH severity 이슈 3건을 TDD(RED→GREEN)로 모두 수정하고 회귀 방지 단위 테스트를 추가했다.

## Issues Fixed

### Issue 3 (Task 1) — Infobip `groupId=5` (REJECTED) silently treated as success

**File:** `apps/api/src/modules/sms/infobip-client.ts`
**Commit:** `a9d4083`

Infobip `/sms/3/messages`는 invalid destination, blocked sender, content rejected 등의 사유로 메시지를 동기 거부할 때도 HTTP 200 + `messageId`를 반환한다. 거부 신호는 `messages[0].status.groupId === 5`로 전달된다. 이전 구현은 `messageId`만 보고 성공으로 간주했기 때문에:

- OTP가 Valkey에 저장됨
- 사용자에게는 SMS가 전달되지 않음
- 사용자는 영원히 인증을 완료할 수 없음 (영구 lockout)

**수정:** `messages[0].status?.groupId === 5`인 경우 `InfobipApiError(400, ...)` throw. 4xx로 변환하면 caller(sms.service)는 영구 거부로 처리해 cooldown과 phone-axis send 카운터를 모두 유지한다 (T-et3-04: 악용 방지).

**Tests added (3):**
- `groupId === 5 (REJECTED) 응답 시 InfobipApiError(400) throw`
- `groupId === 5 (REJECTED) 시 status=400, body에 REJECTED 포함`
- `groupId 누락(undefined) 응답은 통과 (overreach 방지)` — 기존 동작 보존 확인

### Issue 2 (Task 2) — `sms:phone:send:` counter not rolled back on 5xx

**File:** `apps/api/src/modules/sms/sms.service.ts`
**Commit:** `79073b6`

`sms:phone:send:{e164}` (5/3600s 한도)는 Infobip 호출 직전 INCR되었지만, Infobip이 실패해도 DECR되지 않았다. 결과적으로:

- Infobip 5xx 또는 네트워크 장애가 5번 연속 발생하면
- 사용자는 SMS를 단 한 통도 받지 못한 채
- 시간당 5회 발송 한도가 모두 소진됨

**수정:** 기존 `shouldRollbackCooldown` 분기(5xx 또는 비-`InfobipApiError`)에서 `redis.del(cooldownKey)`와 함께 `redis.decr('sms:phone:send:{e164}')`도 호출한다. `Promise.all`로 동시 실행. 변수명을 `shouldRollback`으로 변경(양쪽 키 커버).

**4xx (groupId=5 REJECTED 포함)에서는 카운터를 유지한다** — 악용자가 일부러 거부 응답을 유도해 정상 사용자의 quota를 소진시키는 시나리오 방지.

**Tests added (3):**
- `Infobip sendSms 5xx 시 sms:phone:send:{e164} 카운터도 DECR rollback`
- `Infobip sendSms 4xx 시 sms:phone:send: 카운터 유지 (DECR 미호출, 악용 방지)`
- `non-InfobipApiError (network down 등) 시 sms:phone:send: 카운터 DECR rollback`

### Issue 1 (Task 3) — `sms:attempts:` not reset when storing new OTP

**File:** `apps/api/src/modules/sms/sms.service.ts`
**Commit:** `8ad4a15`

`sms:attempts:{e164}`는 TTL 900s, `sms:otp:{e164}`는 TTL 180s. 사용자가 OTP#1에서 N번 실패한 후 OTP를 재발송하면, OTP#2 시점에 `attempts=N`이 그대로 살아있어 첫 검증부터 `NO_MORE_ATTEMPTS`가 발생할 수 있다.

**수정:** ioredis `pipeline()`으로 `SET sms:otp:` + `DEL sms:attempts:` 두 op을 단일 round trip 내에서 인접 실행. verify Lua 스크립트가 OTP를 먼저 GET하기 때문에 `SET-then-DEL` 순서는 consumer 입장에서 atomic하게 보인다 — 추가 Lua 스크립트 불필요.

**추가 안전장치:** `pipeline.exec()`가 op-level 에러를 반환하면 throw해서 catch 블록으로 진입. Valkey가 다운된 순간에 검증 불가능한 OTP를 SMS로 보내는 일을 방지.

**Tests added (3, 1 modified):**
- (modified) `Infobip sendSms 성공 시 Valkey에 OTP 6자리 저장` — assertion target을 `mockRedis.set` → `mockPipeline.set`으로 변경
- (new) `신규 OTP 저장 시 sms:attempts:{e164}를 함께 DEL (재발송 후 5회 시도 보장)`
- (new) `OTP pipeline exec 에러 시 Infobip sendSms 미호출 (보안: 미저장 OTP로 SMS 보내지 않음)`

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/modules/sms/infobip-client.ts` | `sendSms`에 `groupId === 5` 검증 추가 (16라인 추가, `description?: string` 타입 보강) |
| `apps/api/src/modules/sms/infobip-client.spec.ts` | groupId=5 / undefined 회귀 방지 테스트 3건 추가 |
| `apps/api/src/modules/sms/sms.service.ts` | OTP 저장을 pipeline으로 변경, catch 블록에 `redis.decr(sms:phone:send:)` 추가 |
| `apps/api/src/modules/sms/sms.service.spec.ts` | mockPipeline 추가, 3종 신규 테스트 + 기존 OTP 테스트 1건 mockPipeline.set으로 마이그레이션 |

## Verification

```
pnpm --filter @grapit/api test -- --run    # 26 files / 242 tests passing
pnpm --filter @grapit/api typecheck         # clean (0 errors)
pnpm --filter @grapit/api lint              # 0 errors, 34 pre-existing warnings (none in modified files)
```

## Deviations from Plan

**None significant.**

다만 Task 2 작성 중, 신규 테스트의 `mockRedis.del`/`mockRedis.decr`이 `vi.fn()` 기본값(=`undefined`)을 반환할 때 `.catch()` 호출이 synchronous TypeError를 일으켜 `Promise.all` 내부에서 `decr`이 호출되기 전에 throw되는 현상을 발견했다. 기존 테스트가 통과한 이유는 동일한 패턴이지만 검증이 후순위로 통과한 우연이며, 신규 검증("decr이 호출되어야 한다")에서는 명시적 mock이 필요했다. 해당 테스트들에 `mockRedis.del.mockResolvedValueOnce(1)`, `mockRedis.decr.mockResolvedValueOnce(0)`를 추가했다 — 이는 plan에 적시된 패턴 범위 내의 정상적인 mock 보강이다.

## Threat Model Status (from plan `<threat_model>`)

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-et3-01 | mitigate | ✅ Task 2 — phone-axis send counter rollback 적용 |
| T-et3-02 | mitigate | ✅ Task 3 — sms:attempts pipeline DEL 적용 |
| T-et3-03 | mitigate | ✅ Task 1 — groupId=5 → InfobipApiError(400) 적용 |
| T-et3-04 | accept | ✅ 기존 4xx-keeps-cooldown/counter 유지, REJECTED도 동일 분기 진입 |
| T-et3-05 | accept | ✅ 에러 body에 Infobip status name + description 포함, BadRequestException으로 사용자에게는 일반 메시지 |

## Self-Check: PASSED

**Files:**
- ✅ `apps/api/src/modules/sms/infobip-client.ts` — exists
- ✅ `apps/api/src/modules/sms/infobip-client.spec.ts` — exists
- ✅ `apps/api/src/modules/sms/sms.service.ts` — exists
- ✅ `apps/api/src/modules/sms/sms.service.spec.ts` — exists

**Commits:**
- ✅ `a9d4083` — present in `git log`
- ✅ `79073b6` — present in `git log`
- ✅ `8ad4a15` — present in `git log`
