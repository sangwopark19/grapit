---
phase: 14
slug: sms-otp-crossslot-fix-sms-valkey-cluster-hash-tag
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 근거는 `14-RESEARCH.md` §Validation Architecture + §9 통합 테스트 시나리오 + §10 프론트 테스트 범위.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (API)** | Vitest 3.2.0 (via `@grabit/api` `test` / `test:integration` scripts) |
| **Framework (Web)** | Vitest 3.2.0 + `@testing-library/react` 16.3.0 |
| **Config file (API unit)** | `apps/api/vitest.config.ts` |
| **Config file (API integration)** | `apps/api/vitest.integration.config.ts` (referenced by `pnpm --filter @grabit/api test:integration`) |
| **Config file (Web)** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grabit/api test && pnpm --filter @grabit/web test` |
| **Full suite command** | `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test` |
| **Estimated runtime** | ~90s unit + ~60s integration (cluster container `beforeAll` +2-3s over existing valkey standalone) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grabit/api test phone && pnpm --filter @grabit/web test phone-verification` (빠른 피드백, sub-10s).
- **After every plan wave:** Run `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test`.
- **Before `/gsd-verify-work`:** Full suite must be green **and** HUMAN-UAT SC-1 (실기기 회원가입 SMS 인증 성공) 완료.
- **Max feedback latency:** 120s (quick) / 300s (full) — Cloud Run cold-start 과 무관한 로컬 실행 기준.

---

## Per-Task Verification Map

> Task IDs 는 planner 가 확정 전. 현재는 **Requirement → Wave 배치 예상** 만 기록. planner 는 이 표를 PLAN.md tasks 의 `<acceptance_criteria>` 에 구체화해야 한다.

| Req ID | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|----------|-----------|-------------------|-------------|--------|
| SC-2a | 0 (test infra) | cluster-mode 에서 과거 key 스킴 EVAL → `CROSSSLOT` ReplyError | integration | `pnpm --filter @grabit/api test:integration sms-cluster-crossslot` | ❌ W0 | ⬜ pending |
| SC-2b | 0 (test infra) | cluster-mode 에서 신규 `{sms:${e164}}:role` EVAL → VERIFIED/WRONG/EXPIRED/NO_MORE_ATTEMPTS 4 분기 모두 pass | integration | 동상 | ❌ W0 | ⬜ pending |
| SC-2c | 0 (test infra) | 3개 키 `CLUSTER KEYSLOT` 가 동일 정수 | integration | 동상 | ❌ W0 | ⬜ pending |
| SC-3b | 1 (key migrate) | 기존 `sms-throttle.integration.spec.ts` 의 Lua smoke test 가 export 된 `smsOtpKey / smsAttemptsKey / smsVerifiedKey / VERIFY_AND_INCREMENT_LUA` 를 import 해서 동일하게 녹색 | integration | `pnpm --filter @grabit/api test:integration sms-throttle` | ✅ 기존 (수정 필요) | ⬜ pending |
| SC-3a | 1 (key migrate) | 기존 throttler smoke 그대로 녹색 (rate-limit 키 스킴 무변경 D-04) | integration | 동상 | ✅ 기존 | ⬜ pending |
| SC-4a | 2 (frontend) | `res.verified === false && res.message` 가 truthy 문자열이면 `setVerifyError(res.message)` | unit (web) | `pnpm --filter @grabit/web test phone-verification` | ❌ W0 | ⬜ pending |
| SC-4b | 2 (frontend) | `res.message` 가 undefined / 빈 문자열이면 `setVerifyError('인증번호가 일치하지 않습니다')` fallback | unit (web) | 동상 | ❌ W0 | ⬜ pending |
| SC-4c | 2 (frontend) | `res.verified === true` 면 `clearTimer()` + `onVerified(code)` 호출 (회귀 가드 — 기존 동작 불변) | unit (web) | 동상 | ❌ W0 | ⬜ pending |
| SC-3c | 3 (regression gate) | `@grabit/api` 전체 unit/integration + `@grabit/web` 전체 unit 녹색 | unit + integration | Full suite command | ✅ 기존 | ⬜ pending |
| SC-1 | 4 (manual) | 프로덕션 (`https://heygrabit.com/signup`) 실기기 회원가입 SMS 발송 → 수신 OTP 입력 → 3단계 진행 성공 | manual (HUMAN-UAT) | 수동 체크리스트 | ❌ (HUMAN-UAT) | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/test/sms-cluster-crossslot.integration.spec.ts` — SC-2a/2b/2c를 cluster-mode 에서 커버하는 통합 테스트 신규 (§14-RESEARCH.md Pattern 2 + §9 의 5 시나리오).
- [ ] `apps/web/components/auth/phone-verification.test.tsx` — SC-4a/4b/4c unit test.
- [ ] `apps/api/src/modules/sms/sms.service.ts` — `smsOtpKey`, `smsAttemptsKey`, `smsVerifiedKey` 키 빌더 함수 + `VERIFY_AND_INCREMENT_LUA` 상수 export (D-13 single-source-of-truth). **이 export 없이 테스트 리팩터가 drift 재발 가드가 되지 못함.**
- [ ] `apps/api/test/sms-throttle.integration.spec.ts` — L272-427 의 Lua/key 리터럴 복제를 위 export import 로 교체.
- [ ] (확인만) `apps/web/vitest.config.ts` 의 `environment: 'jsdom'` 설정 존재 확인. Vitest가 이미 있어 새 환경 추가 불필요 예상.

*Framework 설치 없음 — Vitest + testcontainers + `@testing-library/react` 는 이미 devDependency.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 프로덕션 실기기 SMS 인증 성공 | SC-1 | 실제 Memorystore for Valkey + 실 SMS 왕복. 자동화 하네스로는 Infobip 실발송·실수신이 비용/개인정보상 불가 | 1. `https://heygrabit.com/signup` 접속. 2. 3단계에서 실제 핸드폰 번호 입력 → "인증번호 발송". 3. SMS 수신 확인(`[Grabit] 인증번호 XXXXXX (3분 이내 입력)`). 4. 수신 코드 입력 → "확인" → **회원가입 4단계로 진행** (시스템 에러/오답 메시지 없음). |
| Cloud Run Sentry 72시간 관측 | D-17 | 프로덕션 error budget 은 시간축 데이터 | Sentry `grabit-api` 프로젝트에서 `sms.verify_failed` event 중 `err:` 에 "CROSSSLOT" 포함 이벤트 **0 건** 임을 배포 후 72시간 확인. 있으면 즉시 Sentry 알람 및 롤백 고려. |
| 배포 overlap 창 UX 확인 | D-19 | Cloud Run 다중 revision 전환 시점은 로그/메트릭으로만 확인 가능 | 배포 직후 5분간 Cloud Run 로그에서 `sms.sent` 와 `sms.verify_failed` 비율 관찰. 실패율이 배포 직전 대비 유의미하게 증가하지 않음을 확인. |

---

## Validation Sign-Off

- [ ] 모든 task 가 `<automated>` verify 또는 Wave 0 dependency 로 커버됨 (SC-1 제외 — manual 명시).
- [ ] Sampling continuity: 3개 연속 task 가 automated verify 없이 이어지지 않음.
- [ ] Wave 0 가 모든 MISSING 참조 (`sms-cluster-crossslot.integration.spec.ts`, `phone-verification.test.tsx`, export 4개) 를 커버.
- [ ] No `--watch` / `test -- --watch` 플래그.
- [ ] Quick feedback < 10s, full < 300s.
- [ ] `nyquist_compliant: true` 로 frontmatter 갱신 (planner 가 planner-checker 통과 후 수행).

**Approval:** pending — planner 가 planner-checker 통과 후 `nyquist_compliant: true` 로 전환.
