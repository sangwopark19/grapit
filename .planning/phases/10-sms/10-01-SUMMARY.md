---
phase: 10
plan: 01
subsystem: sms
tags: [test-scaffolding, wave-0, red-tests, infobip, fixtures]
dependency_graph:
  requires: []
  provides: [sms-service-spec, infobip-client-spec, phone-util-spec, throttle-integration-spec, phone-verification-test, e2e-signup-sms, infobip-fixtures, validation-map]
  affects: [10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09]
tech_stack:
  added: []
  patterns: [vitest-red-tests, infobip-fixture-lock, testcontainers-scaffold, playwright-e2e-scaffold]
key_files:
  created:
    - apps/api/src/modules/sms/__fixtures__/infobip-send-response.json
    - apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json
    - apps/api/src/modules/sms/phone.util.spec.ts
    - apps/api/src/modules/sms/infobip-client.spec.ts
    - apps/api/test/sms-throttle.integration.spec.ts
    - apps/web/components/auth/__tests__/phone-verification.test.tsx
    - apps/web/e2e/signup-sms.spec.ts
  modified:
    - apps/api/src/modules/sms/sms.service.spec.ts
    - .planning/phases/10-sms/10-VALIDATION.md
decisions:
  - "Twilio mock 완전 제거, Infobip 기반 테스트로 전면 재작성"
  - "Infobip fixture 2종으로 응답 shape lock (zod schema 근거)"
  - "Review #1~3, #8 concern 반영 테스트 케이스 명시적 포함"
metrics:
  duration: 374s
  completed: "2026-04-16T02:48:24Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 10 Plan 01: Wave 0 Test Scaffolding Summary

Wave 0 RED 테스트 스캐폴딩 완료 -- Infobip 2FA PIN API 기반 테스트 7개 파일 + fixture 2종 + VALIDATION.md Per-Task Map 14 rows

## What Was Done

### Task 1: Backend Test Scaffolding (6 files + 2 fixtures)
- **sms.service.spec.ts**: Twilio mock 완전 제거, Infobip + Valkey mock 기반 16개 테스트 케이스 (constructor hard-fail, dev mock, CN reject, cooldown, sendPin, verifyPin, phone axis counter, verify counter)
- **infobip-client.spec.ts**: global.fetch mock으로 sendPin/verifyPin URL, Authorization header, body shape, error handling 검증
- **phone.util.spec.ts**: parseE164 (한국 로컬, E.164 passthrough, 에러) + isChinaMainland (CN/HK/MO/TW + Review #8 edge cases)
- **sms-throttle.integration.spec.ts**: testcontainers Valkey + NestJS ThrottlerModule 통합 테스트 scaffold (6 RED cases)
- **Fixtures**: infobip-send-response.json, infobip-verify-response.json (4 scenarios: success, wrongPin, expired, noMoreAttempts)

### Task 2: Frontend Test Scaffolding (2 files) + VALIDATION.md
- **phone-verification.test.tsx**: @testing-library/react 기반 -- 초기 상태, 발송 후 상태, 쿨다운 종료, 에러 카피 3종, 국가 감지, 시도 횟수 미노출, 접근성 (one-time-code, aria-label, role=alert)
- **signup-sms.spec.ts**: Playwright E2E -- mock 모드 회원가입 flow, 잘못된 코드, 쿨다운 라벨
- **VALIDATION.md**: Per-Task Map 14 rows 완성, nyquist_compliant: true, wave_0_complete: true

## Review Concerns Addressed

| Concern | Status | How |
|---------|--------|-----|
| #1 Cooldown rollback (HIGH) | Addressed | sms.service.spec.ts: 5xx시 DEL 호출, 4xx시 DEL 미호출 테스트 |
| #2 OTP max attempts (HIGH) | Addressed | sms.service.spec.ts: 주석으로 Infobip Application pinAttempts=5 위임 명시 |
| #3 Valkey atomicity (MEDIUM) | Addressed | sms.service.spec.ts: Lua script INCR + conditional EXPIRE 원자성 테스트 |
| #8 CN edge cases (MEDIUM) | Addressed | phone.util.spec.ts: 0086, full-width +86, 불완전 +86, 공백 포함 |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| T1 | 61822e2 | Backend RED test scaffolding + Infobip fixtures |
| T2 | 681284e | Frontend RED test scaffolding + VALIDATION.md Per-Task Map |

## Self-Check: PASSED

All 9 files verified present. Both commits (61822e2, 681284e) found in git log.
