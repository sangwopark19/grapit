---
status: partial
phase: 10-sms
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md, 10-06-SUMMARY.md, 10-07-SUMMARY.md, 10-08-SUMMARY.md, 10-09-SUMMARY.md]
started: 2026-04-17T02:42:08Z
updated: 2026-04-17T02:50:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 사용자가 나머지 테스트 스킵하고 /gsd-quick으로 국가코드 라이브러리 교체 작업 지시]

## Tests

### 1. Cold Start Smoke Test
expected: |
  API 서버 프로세스 종료 → 임시 상태 초기화 → 서버 재기동 시 부팅 에러 없이 완료. 헬스체크(또는 홈페이지/기본 API) 호출이 정상 응답.
  특히 `apps/api/src/app.module.ts`의 ThrottlerModule.forRootAsync, `sms.module.ts`의 BookingModule re-export, REDIS_CLIENT 주입이 깨지지 않고 부팅됨.
result: pass

### 2. 한국 번호로 Mock 모드 회원가입 완주
expected: |
  개발 모드(INFOBIP_* 미설정)에서 회원가입 3단계 진입 → 010-xxxx-xxxx 한국 번호 입력 → "인증번호 받기" 클릭 → 인증번호 입력 필드 활성 → 000000 입력 → 인증 성공 → 다음 단계로 진행(성공 상태 CheckCircle2 아이콘 표시 포함).
result: pass

### 3. 잘못된 인증코드 입력 시 에러 카피
expected: |
  Mock 모드에서 000000 대신 123456 등 잘못된 코드를 입력하면 "인증번호가 일치하지 않습니다" 한국어 에러 메시지가 role="alert"로 표시. 페이지는 다음 단계로 넘어가지 않음.
result: pass

### 4. 국제 번호(+1) 입력 시 국가 감지 안내
expected: |
  전화번호 입력란에 "+1 2025550123" 같은 미국 번호 입력 시 "미국 번호로 인식됨" 또는 유사한 국가 감지 안내 텍스트가 노출(libphonenumber-js/min 기반). raw passthrough이므로 마스킹 없이 입력 그대로 표시.
result: issue
reported: "잘안됨. 방법을 바꿔서 오늘날짜 최신 기준으로 가장 좋은 국가코드 선택 라이브러리를 추가해서 쉽게 선택할 수 있게 해줘"
severity: major

### 5. 중국 본토(+86) 번호 거부
expected: |
  "+86 138xxxxxxxx" 중국 본토 번호 입력 후 "인증번호 받기" 클릭 시 400 응답 기반의 한국어 에러 카피가 role="alert"로 노출. 홍콩(+852), 마카오(+853), 대만(+886)은 차단되지 않아야 함(추가 확인 가능).
result: skipped
reason: "국가코드 선택 UI 교체(Test 4 이슈) 이후 재테스트 예정 — 국가 선택 라이브러리 UX 위에서 재검증 필요"

### 6. 4-state 재발송 버튼 전환
expected: |
  버튼 상태가 4단계로 순차 전환: (a) initial="인증번호 받기" → (b) sending="전송 중..."(비활성) → (c) cooldown="재발송 (Ns)"(비활성, 카운트다운) → (d) resend-ready="재발송 (N회)"(활성). 각 상태 전환 시 버튼 라벨이 UI-SPEC과 동일.
result: pass

### 7. 30초 쿨다운 타이머 카운트다운
expected: |
  send-code 성공 후 재발송 버튼이 30초 동안 비활성 상태로 "재발송 (30s)" → "(29s)" → ... → "(1s)"까지 1초 간격으로 카운트다운. 동시에 인증번호 입력/만료 타이머(3분)는 독립 동작.
result: pass

### 8. 쿨다운 만료 후 재발송 버튼 활성화
expected: |
  30초 경과 후 버튼 라벨이 "재발송 (N회)"(N=시도 횟수)로 바뀌고 활성. 클릭하면 새 sendPin 호출로 쿨다운 다시 시작. 만료 타이머(3분)는 리셋되지 않고 그대로 진행.
result: skipped
reason: "사용자 요청으로 Test 8~10 일괄 스킵 — 국가코드 라이브러리 교체 후 재테스트"

### 9. 시도 횟수 UI 미노출 (D-19 준수)
expected: |
  화면 어디에도 "남은 시도 X회", "X attempts remaining" 등 남은 OTP 시도 횟수를 노출하는 텍스트가 없음. 에러 카피는 "인증번호가 일치하지 않습니다" 정도로만 표시되고 남은 횟수 숫자를 공개하지 않음(보안 원칙 D-19).
result: skipped
reason: "사용자 요청으로 Test 8~10 일괄 스킵 — 국가코드 라이브러리 교체 후 재테스트"

### 10. 접근성 속성 (one-time-code, role=alert, aria-label)
expected: |
  브라우저 DevTools로 확인: (a) 인증번호 입력 input에 `autoComplete="one-time-code"` 및 `inputMode="numeric"`, (b) 에러 메시지 엘리먼트에 `role="alert"`, (c) 성공 메시지에 `role="status"`, (d) 쿨다운 중 재발송 버튼에 `aria-label`로 남은 시간 설명 포함.
result: skipped
reason: "사용자 요청으로 Test 8~10 일괄 스킵 — 국가코드 라이브러리 교체 후 재테스트"

## Summary

total: 10
passed: 5
issues: 1
pending: 0
skipped: 4
blocked: 0

## Gaps

- truth: "국제 번호 입력 시 국가를 쉽게 선택/감지할 수 있어야 함"
  status: failed
  reason: "User reported: 잘안됨. 방법을 바꿔서 오늘날짜 최신 기준으로 가장 좋은 국가코드 선택 라이브러리를 추가해서 쉽게 선택할 수 있게 해줘"
  severity: major
  test: 4
  user_direction: "현재 libphonenumber-js 감지 텍스트 방식(detectPhoneLocale) 대신, 국가코드 선택 UI 라이브러리 도입 — 사용자가 국가를 드롭다운/플래그로 명시적으로 선택할 수 있는 UX. 2026-04 기준 최신 베스트 라이브러리 채택 요망."
  artifacts: []
  missing: []
