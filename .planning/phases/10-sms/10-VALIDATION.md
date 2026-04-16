---
phase: 10
slug: sms
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-16
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x (apps/api) + @testing-library/react (apps/web unit) + Playwright 1.59.x (apps/web e2e) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/api/vitest.integration.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @grapit/api test sms -- --run` |
| **Full suite command** | `pnpm --filter @grapit/api test --run && pnpm --filter @grapit/web test --run && pnpm --filter @grapit/web test:e2e` |
| **Estimated runtime** | ~90s (unit ~5s, integration ~20s, e2e ~60s) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grapit/api test sms -- --run` (~5s)
- **After every plan wave:** Run `pnpm --filter @grapit/api test --run && pnpm --filter @grapit/web test --run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual staging SMS smoke (D-25)
- **Max feedback latency:** ~5s per task, ~30s per wave

---

## Per-Task Verification Map

> Populated by planner during PLAN.md creation. Each task gets its own row with `<automated>` command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 01 | 0 | SMS-01~04 | T-10-01 | fixture shape lock + RED test | unit+integ scaffold | `test -f apps/api/src/modules/sms/sms.service.spec.ts` | W0 | pending |
| 10-01-T2 | 01 | 0 | SMS-01~04 | T-10-02 | frontend RED + VALIDATION map | unit+e2e scaffold | `test -f apps/web/components/auth/__tests__/phone-verification.test.tsx` | W0 | pending |
| 10-02-T1 | 02 | 0 | SMS-02,03 | -- | dependency install + env declaration | setup | `grep -q "@nest-lab/throttler-storage-redis" apps/api/package.json` | W0 | pending |
| 10-02-T2 | 02 | 0 | SMS-02,03 | -- | DEPLOY-CHECKLIST creation | doc | `test -f .planning/phases/10-sms/DEPLOY-CHECKLIST.md` | W0 | pending |
| 10-03-T1 | 03 | 1 | SMS-02 | T-10-03 | parseE164 + isChinaMainland | unit | `pnpm --filter @grapit/api test phone.util -- --run` | W0 | pending |
| 10-04-T1 | 04 | 1 | SMS-02 | T-10-04 | InfobipClient fetch + error | unit | `pnpm --filter @grapit/api test infobip-client -- --run` | W0 | pending |
| 10-05-T1 | 05 | 2 | SMS-01~04 | -- | SmsModule BookingModule import (circular dependency check) | grep | `grep -q "BookingModule" apps/api/src/modules/sms/sms.module.ts` | W0 | pending |
| 10-05-T2 | 05 | 2 | SMS-01~04 | T-10-18~22 | SmsService Infobip rewrite | unit | `pnpm --filter @grapit/api test sms.service -- --run` | W0 | pending |
| 10-06-T1 | 06 | 3 | SMS-01,02,04 | T-10-06-01~04 | @Throttle IP axis + zod intl + sms.service 429 unify | unit | `pnpm --filter @grapit/api test sms -- --run` | W0 | pending |
| 10-07-T1 | 07 | 3 | SMS-01 | T-10-07-01~03 | ThrottlerModule Valkey storage | typecheck+test | `pnpm --filter @grapit/api typecheck` | W0 | pending |
| 10-08-T1 | 08 | 4 | SMS-01,02,04 | -- | phone-verification 30s cooldown | unit | `pnpm --filter @grapit/web test phone-verification -- --run` | W0 | pending |
| 10-09-T1 | 09 | 5 | SMS-01~04 | T-10-09-01 | E2E mock signup flow | e2e | `pnpm --filter @grapit/web test:e2e -- signup-sms.spec.ts` | W0 | pending |
| 10-09-T2 | 09 | 5 | SMS-01 | -- | testcontainers Valkey throttle | integ | `pnpm --filter @grapit/api test:integration sms-throttle -- --run` | W0 | pending |
| 10-09-T3 | 09 | 5 | SMS-02 | T-10-09-02 | staging SMS smoke (pre-deploy mandatory) | manual | `grep -q "smoke" .planning/phases/10-sms/DEPLOY-CHECKLIST.md` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `apps/api/src/modules/sms/sms.service.spec.ts` -- Twilio mock 제거, Infobip fetch mock + Valkey mock 도입. Cover: dev mock `000000`, CN(+86) reject, production hard-fail, resend cooldown 429, expired 410, attempts-exhausted 410, verified true/false
- [x] `apps/api/src/modules/sms/infobip-client.spec.ts` -- 신규. `global.fetch` mock으로 sendPin/verifyPin URL, `Authorization: App ...` header, body shape 검증
- [x] `apps/api/src/modules/sms/phone.util.spec.ts` -- 신규. `parseE164`(한국/태국/CN), `isChinaMainland` 정확성
- [x] `apps/api/test/sms-throttle.integration.spec.ts` -- 신규. testcontainers Valkey + 실제 `@nest-lab/throttler-storage-redis` + Infobip nock. phone 5/h + IP 20/h send, verify 10/15min
- [x] `apps/web/components/auth/__tests__/phone-verification.test.tsx` -- 신규. 버튼 4-state transition, 30s 쿨다운 타이머, 에러 카피 분기 3종
- [x] `apps/web/e2e/signup-sms.spec.ts` -- 신규. CI mock 모드에서 `000000` 경로로 회원가입 플로우 완주
- [x] `apps/api/src/modules/sms/__fixtures__/infobip-send-response.json`, `infobip-verify-response.json` -- Wave 0 fixture (zod schema lock 근거)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실 SMS 발송 staging smoke | SMS-02 | CI 실발송 금지(비용) -- D-25 | Staging 환경에 `INFOBIP_*` 4종 주입 -> `/sms/send-code`에 개발자 본인 번호 POST -> 수신 확인 -> `/sms/verify-code`로 검증 success 확인 |
| KISA 한국 발신번호 사전등록 상태 | SMS-02 | Infobip 콘솔 운영자 작업(D-04) | Infobip portal -> Number Management -> 등록된 발신번호(sender) 상태가 "Approved" 확인 후 배포 |
| Infobip Application/Message Template 존재 | SMS-02 | 운영 사전작업 | Infobip portal에서 `pinLength=6/pinType=NUMERIC/pinAttempts=5/pinTimeToLive=3m` Application + Message Template 생성, `INFOBIP_APPLICATION_ID` / `INFOBIP_MESSAGE_ID` env와 일치 확인 |
| Cloud Run cold-start 이후 첫 실 SMS 지연 | SMS-02 | 프로덕션 min-instances=0 환경 실측 필요 | 5분 이상 idle 후 첫 요청 latency를 Cloud Run log로 확인, `AbortSignal.timeout(5000)` 초과 발생 여부 관찰 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (7개 파일 생성/재작성)
- [x] No watch-mode flags
- [x] Feedback latency < 5s (unit) / 30s (wave)
- [x] `nyquist_compliant: true` set in frontmatter after planner fills Per-Task table

**Approval:** approved (Wave 0 complete)
