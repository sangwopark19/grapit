---
phase: 14-sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
verified: 2026-04-24T16:00:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "SC-1 프로덕션 실기기 회원가입 SMS 인증 성공 확인"
    expected: "https://heygrabit.com/signup 3단계에서 실기기(휴대폰)로 SMS OTP 수신 후 입력 → 4단계(비밀번호 설정) 진행 성공. 에러 alert 미표시."
    why_human: "실제 Cloud Run 배포 후 실기기(휴대폰)로만 확인 가능. 실 SMS 왕복 + 프로덕션 Valkey Cluster 환경 필요 — 자동화 불가 (14-PLAN.md Task 4 checkpoint:human-verify)."

  - test: "ci.yml test:integration step PR green 확인 (MEDIUM#5)"
    expected: "Phase 14 PR 에서 GitHub Actions check job 의 'Integration tests (testcontainers — SC-2 Valkey Cluster CROSSSLOT guard)' step 이 success 로 finalize."
    why_human: "ci.yml 수정은 코드에 반영됐으나, sms-throttle.integration.spec.ts TTL 테스트 2건(pre-existing failure, deferred-items.md 참조)이 현재 fail 상태여서 전체 integration suite 가 PR 에서 red-gate 될 가능성이 있음. PR 실행 후 CI 로그로만 최종 확인 가능."

  - test: "pre-existing sms-throttle TTL 테스트 실패 해소 여부 확인 (deferred-items.md)"
    expected: "sms-throttle.integration.spec.ts 의 '2건 TTL 단위 검증' 테스트가 green 으로 전환되어 ci.yml test:integration step 전체가 통과."
    why_human: "이 실패는 Phase 13 @grapit → @grabit namespace rename 여파로 @nestjs/throttler key prefix 가 테스트 scan 패턴과 어긋난 pre-existing 버그. Phase 14 범위 밖이므로 별도 quick task 로 수정 필요. 수정 전까지 ci.yml integration step 이 red-gate 됨."
---

# Phase 14: SMS OTP CROSSSLOT fix Verification Report

**Phase Goal:** 프로덕션 heygrabit.com 회원가입 3단계 SMS OTP 인증이 Valkey Cluster 에서 CROSSSLOT 없이 성공하고, cluster-mode 회귀 테스트가 CI 에 편입되며, 프론트가 서버 message 를 우선 표시해 시스템 에러와 오타 실패를 UX 상 구분한다.
**Verified:** 2026-04-24T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sms.service.ts 가 smsOtpKey / smsAttemptsKey / smsVerifiedKey / VERIFY_AND_INCREMENT_LUA 4종을 module-level export 함 (SC-2/SC-3 물리적 전제, D-13 SoT) | VERIFIED | L57: `export const VERIFY_AND_INCREMENT_LUA`, L89-91: 3 key builders — grep 1회씩 매칭 확인 |
| 2 | sendVerificationCode pipeline 과 verifyCode EVAL 의 OTP 키 3개가 모두 `{sms:${e164}}:<role>` hash-tag 형태로 전환됨 (CROSSSLOT 근원 제거) | VERIFIED | L233-234: `pipeline.set(smsOtpKey(e164), …) pipeline.del(smsAttemptsKey(e164))` / L375-377: `smsOtpKey/smsAttemptsKey/smsVerifiedKey` 빌더 호출 — 구 리터럴 0건 |
| 3 | apps/api/src 전역에서 구 OTP 키 리터럴 (`sms:otp:`, `sms:attempts:`, `sms:verified:`) 이 0 건 (MEDIUM#3 옵션 B, spec 파일 포함) | VERIFIED | `rg "sms:otp:\|sms:attempts:\|sms:verified:" apps/api/src` → 0 matches (sms.service.spec.ts, redis.provider.spec.ts 포함) |
| 4 | sms-throttle.integration.spec.ts 가 Plan 01 export 4종을 import 하고 복제 Lua 본체 및 OTP 키 리터럴이 제거됨 (D-13 drift 구조 제거) | VERIFIED | L16: `from '../src/modules/sms/sms.service.js'` — `^const VERIFY_AND_INCREMENT_LUA` 0건, OTP 키 리터럴 0건, builder 사용 횟수 20건 |
| 5 | apps/api/test/sms-cluster-crossslot.integration.spec.ts 가 5 시나리오(negative CROSSSLOT guard + 4분기 EVAL + KEYSLOT 동일성 + pipeline + e164 변형)를 포함한 311줄 파일로 존재함 (SC-2) | VERIFIED | 파일 존재 311줄, CROSSSLOT negative guard (L174), ADDSLOTSRANGE, buildNatMap, 4분기 VERIFIED/WRONG/EXPIRED/NO_MORE_ATTEMPTS 모두 확인 |
| 6 | .github/workflows/ci.yml 에 `pnpm --filter @grabit/api test:integration` step 이 추가되어 SC-2 CI 편입이 물리적으로 존재함 (REVIEWS.md HIGH#1) | VERIFIED | ci.yml L58: `run: pnpm --filter @grabit/api test:integration` / L57: `name: Integration tests (testcontainers — SC-2 Valkey Cluster CROSSSLOT guard)` |
| 7 | phone-verification.tsx 의 handleVerifyCode 가 `res.verified === false && res.message` truthy 시 서버 메시지를 우선 setVerifyError 에 사용하며, undefined/빈 문자열은 fallback 처리됨 (D-07/D-08/SC-4) | VERIFIED | L135: `message?: string` optional generic / L151: `typeof res.message === 'string' && res.message.length > 0` guard / L154: `setVerifyError(serverMessage ?? fallback)` |
| 8 | phone-verification.test.tsx 에 SC-4a/4b-1/4b-2/4c 4개 시나리오를 포함한 `describe('서버 message 우선 (D-07)')` 블록이 추가됨 | VERIFIED | L269: describe 블록 확인, SC-4a/4b-1/4b-2/4c 모두 it 블록으로 존재 |
| 9 | SC-1 프로덕션 실기기 회원가입 SMS 인증 성공 (14-HUMAN-UAT.md 체크리스트 기준) | HUMAN_NEEDED | 14-HUMAN-UAT.md 작성 완료 (90줄, SC-1/D-17/D-19/MEDIUM#5 포함) — 실기기 실행 미완료 (checkpoint:human-verify, 배포 후 수동 확인 필요) |

**Score:** 8/9 truths verified (SC-1 인간 검증 필요)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/sms/sms.service.ts` | hash-tag 키 빌더 3종 + VERIFY_AND_INCREMENT_LUA export + 호출부 전환 | VERIFIED | 4 export 존재, pipeline/EVAL 모두 builder 사용, 구 리터럴 0건, rate-limit 5건 불변 |
| `apps/api/src/modules/sms/sms.service.spec.ts` | 구 OTP 리터럴 0건, builder import 사용, hash-tag 형태 유입 | VERIFIED | 구 리터럴 0건, `{sms:` 12건, builder 9회 사용 |
| `apps/api/src/modules/booking/providers/__tests__/redis.provider.spec.ts` | 구 OTP 리터럴 0건, hash-tag 리터럴 유입 | VERIFIED | 구 리터럴 0건, `{sms:+821012345678}:otp` 등 3건 |
| `apps/api/test/sms-throttle.integration.spec.ts` | Plan 01 export import, 복제 Lua 제거, OTP 키 리터럴 0건 | VERIFIED | import 존재 (L16), 복제 const 0건, OTP 리터럴 0건, builder 20회 사용 |
| `apps/api/test/sms-cluster-crossslot.integration.spec.ts` | 신규 파일, min 140줄, 5 시나리오, CROSSSLOT negative guard, 동적 natMap | VERIFIED | 311줄 존재, 모든 acceptance criteria 통과 (SUMMARY 검증 완료) |
| `.github/workflows/ci.yml` | test:integration step 존재, YAML 유효 | VERIFIED | L57-58 step 존재, python3 yaml.safe_load exit 0 |
| `apps/web/components/auth/phone-verification.tsx` | message?: string optional generic, typeof guard, fallback const | VERIFIED | L135 optional generic, L151 typeof guard, L149 fallback const, L154 setVerifyError |
| `apps/web/components/auth/__tests__/phone-verification.test.tsx` | D-07 describe 블록 + SC-4a/4b-1/4b-2/4c 4 it | VERIFIED | L269 describe 확인, 4 it 모두 존재 |
| `.planning/phases/14-.../14-HUMAN-UAT.md` | SC-1 + D-17 + MEDIUM#5 포함, min 40줄 | VERIFIED | 90줄, SC-1/D-17/D-19/MEDIUM#5/ci.yml/Rollback 모두 포함 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SmsService.sendVerificationCode (pipeline) | smsOtpKey(e164), smsAttemptsKey(e164) | ioredis pipeline.set/del | WIRED | L233-234 builder 호출 확인 |
| SmsService.verifyCode (EVAL) | smsOtpKey/smsAttemptsKey/smsVerifiedKey | redis.eval(VERIFY_AND_INCREMENT_LUA, 3, …) | WIRED | L372-377 3 builder 호출 확인 |
| sms-cluster-crossslot.integration.spec.ts | sms.service.ts (4 exports) | import from '../src/modules/sms/sms.service.js' | WIRED | L4-9 import 블록 |
| sms-throttle.integration.spec.ts | sms.service.ts (4 exports) | import from '../src/modules/sms/sms.service.js' | WIRED | L10-16 import 블록 |
| sms-cluster-crossslot CROSSSLOT guard (scenario 1) | rejects.toThrow(/CROSSSLOT/) | cluster.eval with legacy keys | WIRED | L162-175 negative guard 존재 |
| ci.yml Integration tests step | pnpm --filter @grabit/api test:integration | GitHub Actions run step | WIRED | ci.yml L57-58, pnpm test 직후 삽입 |
| handleVerifyCode (res.verified === false) | setVerifyError(serverMessage ?? fallback) | typeof-string length-check guard (D-08) | WIRED | L151-154 typeof guard + setVerifyError |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| phone-verification.tsx handleVerifyCode | res.message (optional) | apiClient.post → /api/v1/sms/verify-code → SmsService.verifyCode | 실 Valkey EVAL 결과 반환 — sms.service.ts L390-415 catch/result 경로 | FLOWING |
| sms-cluster-crossslot.integration.spec.ts | cluster.eval 결과 | testcontainers valkey/valkey:8 cluster 실 EVAL | 10 it-block 모두 실 Redis Cluster EVAL | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (integration test 는 Docker daemon 필요 — CI 환경 의존, 로컬 빠른 실행 불가. SUMMARY.md 에서 10/10 it-block pass 기록 확인으로 대체).

SUMMARY.md 기록:
- Plan 01: `pnpm --filter @grabit/api test` 283/283 green (5e32222, 6beb2c3 commit)
- Plan 02: `VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)` describe 6/6 green (575ea5b commit)
- Plan 03: sms-cluster-crossslot.integration.spec.ts 10/10 it-block pass (900ca05 commit)
- Plan 04: `pnpm --filter @grabit/web test phone-verification -- --run` 19/19 pass (177f7c1 commit)

### Requirements Coverage

Phase 14 의 Success Criteria(SC-1~SC-4)는 REQUIREMENTS.md 에 독립 항목이 없고 14-CONTEXT.md D-20 에 정의됨. Plans 의 requirements 필드는 SC-ID proxy 를 사용.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SC-1 | 14-04 | 프로덕션 실기기 SMS OTP 인증 성공 | HUMAN_NEEDED | 14-HUMAN-UAT.md 체크리스트 작성 완료, 실기기 미실행 |
| SC-2 | 14-03 | cluster-mode 회귀 테스트: 과거 스킴 CROSSSLOT fail, 신규 스킴 pass + CI 편입 | SATISFIED | sms-cluster-crossslot.integration.spec.ts 311줄 (10 it), ci.yml step 삽입 |
| SC-3 | 14-01, 14-02 | API test suite 녹색 (unit + integration) | SATISFIED (unit) / HUMAN_NEEDED (integration CI gate) | unit 283/283 green; integration 10/10 green — ci.yml gate 는 pre-existing TTL 실패 2건으로 PR red-gate 가능 |
| SC-4 | 14-04 | phone-verification.tsx 서버 message 우선 + 4 단위 테스트 green | SATISFIED | typeof guard + optional generic + 19/19 test green |

### Anti-Patterns Found

아래 항목 스캔 완료:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (없음) | — | — | — | 변경된 모든 파일에서 TODO/FIXME/placeholder/empty return 0건 확인 |

추가 확인:
- `sms.service.ts`: D-04 rate-limit 키 (`sms:phone:send:`, `sms:phone:verify:`, `sms:resend:`) 정확히 5건 불변 (pre-edit = post-edit = 5)
- `phone-verification.tsx`: `setVerifyError('인증번호가 일치하지 않습니다')` 하드코드 직접 호출 0건 — `const fallback` 패턴으로 이동 (D-08 준수)
- `ATOMIC_INCR_LUA`: 변경 없음 (D-06 준수)
- catch 블록 (L156-166): D-09 준수, 변경 없음

### Human Verification Required

#### 1. SC-1 프로덕션 실기기 SMS 인증 성공 (blocking checkpoint)

**Test:** 실기기(iOS/Android 휴대폰)로 https://heygrabit.com/signup 접속 → 3단계 전화번호 인증 → "인증번호 발송" 클릭 → SMS 수신 → 수신한 6자리 코드 입력 → "확인" 클릭
**Expected:** 4단계(비밀번호 설정)로 정상 진행. 에러 메시지 미표시. SMS 수신 30초 이내, 응답 2초 이내.
**Why human:** 실 Infobip SMS 발송 + 프로덕션 Valkey Cluster + Cloud Run 배포 환경 필요. 배포 전 자동 검증 불가.
**Resume signals:** 14-04-PLAN.md Task 4 참조 (`approved` / `fail: <reason>` / `deferred-d17`)

#### 2. ci.yml test:integration PR green 확인 (MEDIUM#5, blocking)

**Test:** Phase 14 PR (main 대상) 에서 GitHub Actions `check` job 의 'Integration tests (testcontainers — SC-2 Valkey Cluster CROSSSLOT guard)' step 확인
**Expected:** step 이 success 로 finalize. 단, sms-throttle.integration.spec.ts TTL 테스트 2건 pre-existing failure 로 인해 전체 integration suite 가 red 일 가능성 있음.
**Why human:** GitHub Actions 실행 결과는 PR 머지 후 확인 가능. deferred-items.md 의 TTL 테스트 수정 완료 여부에 따라 gate 통과 여부 결정.

#### 3. pre-existing TTL 테스트 실패 해소 (non-blocking Phase 14 goal, CI gate 에 영향)

**Test:** `pnpm --filter @grabit/api test:integration sms-throttle -- --run` 전체 통과 확인
**Expected:** 현재 fail 2건 ('TTL 단위 검증 > send-code/verify-code Throttler TTL') 이 green 전환됨
**Why human:** Phase 14 범위 밖 pre-existing 버그 (Phase 13 @grapit → @grabit rename 여파). deferred-items.md 참조, 별도 `/gsd:quick` task 필요. 이 수정 없이는 ci.yml integration step 이 PR 에서 red.

### Gaps Summary

Phase 14 의 코드 변경 목표(SC-2/SC-3 코드 측/SC-4)는 모두 달성되었습니다. 코드베이스에서 4 심볼 export, hash-tag 키 전환, 테스트 drift 제거, cluster-mode 회귀 가드, CI step 삽입, 프론트 UX 분기가 모두 실제 파일에서 확인됩니다.

**인간 검증이 필요한 항목 2가지:**

1. **SC-1 실기기 인증 성공** — 배포 후 체크포인트. 14-HUMAN-UAT.md 가 이미 작성되었고 14-04-PLAN.md Task 4 checkpoint:human-verify 로 구조화됨.

2. **ci.yml integration step PR green (MEDIUM#5)** — Phase 14 PR 에서 GitHub Actions 실행 결과로만 확인 가능. 단, sms-throttle.integration.spec.ts TTL 실패 2건(deferred-items.md)이 red-gate 요인임. 이 2건은 Phase 14 범위 밖 pre-existing 버그이며 `/gsd:quick` task 로 별도 해소 권장.

---

_Verified: 2026-04-24T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
