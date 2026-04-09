---
status: partial
phase: 01-foundation-auth
source: [01-VERIFICATION.md]
started: 2026-03-27T08:00:00.000Z
updated: 2026-03-27T08:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Email signup + login end-to-end
expected: Docker PostgreSQL 실행 + 마이그레이션 적용 후 /auth 페이지에서 이메일/비밀번호 회원가입 완료 → 즉시 로그인 가능
result: [pending]

### 2. Session persistence across browser refresh
expected: 로그인 후 브라우저 새로고침 시 httpOnly 쿠키 기반 자동 토큰 갱신으로 로그인 상태 유지
result: [pending]

### 3. Social OAuth login flow
expected: 카카오/네이버/구글 OAuth 자격증명 설정 후 소셜 로그인 → 신규 유저는 needs_registration → 기존 유저는 바로 JWT 발급
result: [pending]

### 4. Logout token revocation
expected: 로그아웃 후 이전 refresh token으로 재요청 시 거부 (DB revokedAt 설정 확인)
result: [pending]

### 5. Password reset link
expected: 비밀번호 재설정 요청 시 서버 로그에 리셋 링크 출력 (이메일 stub 상태) → 링크로 비밀번호 변경 완료
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
