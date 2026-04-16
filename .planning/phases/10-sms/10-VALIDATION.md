---
phase: 10
slug: sms
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| _TBD_ | _planner fills_ | _planner fills_ | SMS-01~04 | _T-10-XX_ | _planner fills_ | _planner fills_ | _planner fills_ | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/sms/sms.service.spec.ts` — Twilio mock 제거, Infobip fetch mock + Valkey mock 도입. Cover: dev mock `000000`, CN(+86) reject, production hard-fail, resend cooldown 429, expired 410, attempts-exhausted 410, verified true/false
- [ ] `apps/api/src/modules/sms/infobip-client.spec.ts` — 신규. `global.fetch` mock으로 sendPin/verifyPin URL, `Authorization: App ...` header, body shape 검증
- [ ] `apps/api/src/modules/sms/phone.util.spec.ts` — 신규. `parseE164`(한국/태국/CN), `isChinaMainland` 정확성
- [ ] `apps/api/test/sms-throttle.integration.spec.ts` — 신규. testcontainers Valkey + 실제 `@nest-lab/throttler-storage-redis` + Infobip nock. phone 5/h + IP 20/h send, verify 10/15min
- [ ] `apps/web/components/auth/__tests__/phone-verification.test.tsx` — 신규. 버튼 4-state transition, 30s 쿨다운 타이머, 에러 카피 분기 3종
- [ ] `apps/web/e2e/signup-sms.spec.ts` — 신규 또는 `social-login.spec.ts` 확장. CI mock 모드에서 `000000` 경로로 회원가입 플로우 완주
- [ ] `apps/api/src/modules/sms/__fixtures__/infobip-send-response.json`, `infobip-verify-response.json` — Wave 0 실 staging 1회 호출 후 응답 캡쳐(zod schema lock 근거)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실 SMS 발송 staging smoke | SMS-02 | CI 실발송 금지(비용) — D-25 | Staging 환경에 `INFOBIP_*` 4종 주입 → `/sms/send-code`에 개발자 본인 번호 POST → 수신 확인 → `/sms/verify-code`로 검증 success 확인 |
| KISA 한국 발신번호 사전등록 상태 | SMS-02 | Infobip 콘솔 운영자 작업(D-04) | Infobip portal → Number Management → 등록된 발신번호(sender) 상태가 "Approved" 확인 후 배포 |
| Infobip Application/Message Template 존재 | SMS-02 | 운영 사전작업 | Infobip portal에서 `pinLength=6/pinType=NUMERIC/pinAttempts=5/pinTimeToLive=3m` Application + Message Template 생성, `INFOBIP_APPLICATION_ID` / `INFOBIP_MESSAGE_ID` env와 일치 확인 |
| Cloud Run cold-start 이후 첫 실 SMS 지연 | SMS-02 | 프로덕션 min-instances=0 환경 실측 필요 | 5분 이상 idle 후 첫 요청 latency를 Cloud Run log로 확인, `AbortSignal.timeout(5000)` 초과 발생 여부 관찰 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7개 파일 생성/재작성)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (unit) / 30s (wave)
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills Per-Task table

**Approval:** pending
