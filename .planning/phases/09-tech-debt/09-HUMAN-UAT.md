---
status: partial
phase: 09-tech-debt
source: [09-VERIFICATION.md]
started: 2026-04-14T16:50:00Z
updated: 2026-04-14T16:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 비밀번호 재설정 이메일 실제 발송 및 링크 클릭 플로우 확인
expected: 실 RESEND_API_KEY 설정 후 /auth/password-reset/request 호출 → 실제 이메일 수신 → 링크 클릭 → 비밀번호 변경 완료
why_human: Resend 샌드박스 또는 실 발송은 실제 RESEND_API_KEY가 있어야 하며, 이메일 수신함 확인은 자동화 불가. dev mock(console.log)은 검증됐지만 prod 이메일 발송 경로는 실 키 없이 테스트 불가.
result: [pending]

### 2. Toss Payments E2E 전체 실행 (TOSS_CLIENT_KEY_TEST 설정 후)
expected: pnpm --filter @grapit/web test:e2e toss-payment 실행 시 3 tests PASS (happy path widget mount + confirm intercept + UI regression)
why_human: 실 DB 시드(admin@grapit.test) + API 서버 기동 + Toss sandbox 네트워크 접근 필요. 에이전트 샌드박스에서 실행 불가. SUMMARY에는 E2E 실행 자체가 deferred로 남겨져 있음.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
