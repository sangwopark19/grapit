---
status: complete
phase: 13-grapit-grabit-rename
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md]
started: 2026-04-24T00:33:21Z
updated: 2026-04-24T01:18:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Fresh 시작 시 API(`/api/v1/health` 200) + Web(포트 3000) + `grabit-postgres` 컨테이너 + seed(`admin@grabit.test`) 모두 에러 없이 기동
result: issue
reported: "http://localhost:8080/api/v1/health 접속 시 503 Service Unavailable Exception. 이외에 다른것들은 정상 작동 됨."
severity: major

### 2. Production Apex — https://heygrabit.com/
expected: 브라우저에서 `https://heygrabit.com/` 접속 시 메인 랜딩 페이지가 HTTP 200 으로 정상 로드. SSL 경고 없음. SNI cert CN=heygrabit.com.
result: pass

### 3. Production www — https://www.heygrabit.com/
expected: `https://www.heygrabit.com/` 접속 시 apex 와 동일한 랜딩 페이지가 정상 로드되거나 apex 로 리다이렉트. SSL 경고 없음.
result: pass

### 4. Production API Health — https://api.heygrabit.com/api/v1/health
expected: `https://api.heygrabit.com/api/v1/health` 응답이 200 `{"status":"ok", ...}`. SSL cert CN=api.heygrabit.com.
result: pass

### 5. UI Brand Display — "Grabit" Across Layout
expected: `https://heygrabit.com/` GNB/푸터/타이틀/파비콘 alt 등에 "Grabit" 으로 표기. 어디에도 "Grapit" 문자열 노출 없음 (로고 SVG, 메타 설명, OpenGraph 포함).
result: pass

### 6. 카카오 소셜 로그인 E2E
expected: `https://heygrabit.com/login` (또는 로그인 경로) → 카카오 로그인 → Kakao consent 화면 → 콜백 후 heygrabit.com 로 복귀하며 로그인 완료 상태 (마이페이지/닉네임 표시). 콜백 URL 은 `api.heygrabit.com/api/v1/auth/social/kakao/callback` 사용됨.
result: pass

### 7. 네이버 소셜 로그인 E2E
expected: 네이버 로그인 버튼 클릭 → 네이버 consent → 콜백 후 로그인 완료. 콜백 URL 은 `api.heygrabit.com/api/v1/auth/social/naver/callback`.
result: pass

### 8. 구글 소셜 로그인 E2E
expected: 구글 로그인 버튼 클릭 → 구글 consent → 콜백 후 로그인 완료. 콜백 URL 은 `api.heygrabit.com/api/v1/auth/social/google/callback`.
result: pass

### 9. 비밀번호 재설정 이메일 수신
expected: 비밀번호 재설정 요청 → 실제 메일박스 수신 → subject 에 `[Grabit]` 포함 (예: `[Grabit] 비밀번호 재설정`), 발신자 표기가 `no-reply@heygrabit.com`, 본문 링크가 `heygrabit.com` 도메인.
result: issue
reported: "프로덕션환경에서오지 않음."
severity: major

### 10. 회원가입 SMS OTP 수신
expected: 회원가입 SMS OTP 요청 → 실제 단말에 SMS 도착 → body 에 `[Grabit]` 발신자 표기 + 인증번호 6자리 + "3분 이내 입력" 안내 포함.
result: issue
reported: "실제 sms 까지는 옴. 그런데 맞는 인증번호를 입력해도 틀렸다고 나옴."
severity: major

### 11. 법적 문서 — @heygrabit.com 이메일 참조
expected: `https://heygrabit.com/terms` / `/privacy` / `/marketing` 접속 시 연락처/담당자 이메일이 `@heygrabit.com` 도메인으로 표기 (예: `privacy@heygrabit.com`, `support@heygrabit.com`). "grapit" 문자열 노출 없음.
result: issue
reported: "https://heygrabit.com/terms 같은 주소 접속 시 페이지를 찾을 수 없다고 뜸."
severity: major

### 12. Sentry 이벤트 프로젝트 격리
expected: Sentry 대시보드에서 `grabit-api` 프로젝트와 `grabit-web` 프로젝트 양쪽에 최근 24h 내 이벤트(또는 Wave 3 의 D-12 test event `86c6c59...` / `44e8230...`) 가 각 프로젝트로 올바르게 분리되어 도착. API 에러가 web 프로젝트에 섞이거나 그 반대로 가지 않음.
result: pass

## Summary

total: 12
passed: 8
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Fresh 시작 시 로컬 API `/api/v1/health` 가 200 반환"
  status: failed
  reason: "User reported: http://localhost:8080/api/v1/health 접속 시 503 Service Unavailable Exception. 이외에 다른것들은 정상 작동 됨."
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "프로덕션에서 비밀번호 재설정 이메일이 실제 메일박스로 수신됨"
  status: failed
  reason: "User reported: 프로덕션환경에서오지 않음."
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "회원가입 SMS OTP 가 발송되고, 수신된 인증번호를 입력하면 검증에 성공한다"
  status: failed
  reason: "User reported: 실제 sms 까지는 옴. 그런데 맞는 인증번호를 입력해도 틀렸다고 나옴."
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "법적 문서(약관/개인정보/마케팅)가 heygrabit.com 상의 공개 URL 에서 렌더링되고 연락처 이메일이 @heygrabit.com 로 표기됨"
  status: failed
  reason: "User reported: https://heygrabit.com/terms 같은 주소 접속 시 페이지를 찾을 수 없다고 뜸."
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
