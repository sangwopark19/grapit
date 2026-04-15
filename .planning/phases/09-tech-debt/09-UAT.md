---
status: complete
phase: 09-tech-debt
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: apps/api 및 apps/web dev 서버를 완전히 종료한 뒤 `pnpm dev`로 재기동하면 — API: "Nest application successfully started" 로그 + GET http://localhost:8080/health 200 응답, Web: Next.js ready + GET http://localhost:3000/ 200 응답, .env에 RESEND_API_KEY가 없어도 NODE_ENV=development 에서는 EmailService가 dev mock으로 정상 기동 (throw 없음).
result: pass

### 2. 회원가입 — 이용약관 Dialog 실제 텍스트 표시
expected: /auth/signup에서 2단계로 진입 → "이용약관 (필수)" 체크박스 옆 "[보기]" 링크 클릭 → Dialog 열리고 실제 약관 본문(총 15개 조항, "제1조 (목적)" 등 한국어 표준 약관 텍스트) 표시. 기존 placeholder "이용약관 내용이 여기에 표시됩니다" 같은 문구가 아니라 마크다운 렌더링된 실 텍스트여야 함.
result: pass

### 3. 개인정보처리방침 Dialog — 제6조 국외이전 섹션 표시
expected: "개인정보처리방침 (필수)" [보기] 클릭 → Dialog 열림 → 스크롤하여 "제6조 (개인정보의 국외이전)" 섹션 확인. 표 형태로 수탁자(Resend, Twilio), 이전 국가(미국), 이전 항목, 이전 목적, 보유 기간이 기재되어 있고, 하단에 정보주체의 이전 거부권 안내 + privacy@grapit.com 연락처 포함.
result: pass

### 4. 모든 법률 Dialog 상단에 초안 안내 배너 표시
expected: 이용약관 / 개인정보처리방침 / 마케팅 수신 동의 Dialog 3개 모두 상단에 경고 아이콘(⚠) + "본 약관은 런칭 전 법률 검토를 거쳐 교체될 초안입니다." 문구의 warning 색상 배너가 표시됨.
result: pass

### 5. 마케팅 수신 동의 Dialog 실제 텍스트
expected: "마케팅 정보 수신 (선택)" [보기] 클릭 → Dialog 열리고 마케팅 수신 동의 관련 실 텍스트(수신 항목, 수신 방법, 철회 방법 등)가 표시됨. placeholder 텍스트 아님.
result: pass

### 6. 좌석 선택 — 잠긴 좌석 클릭 시 info toast
expected: 예매 중인 공연 회차 진입 → 다른 사용자가 이미 선택한 좌석(잠긴 좌석) 클릭 → 화면 우하단에 "이미 다른 사용자가 선택한 좌석입니다" info 스타일 toast 표시 (파란색 계열 배경의 sonner info variant, 기존 인라인 style이 아닌 일관된 디자인 시스템 적용).
result: pass

### 7. 어드민 예매 상세 — paidAt null 처리
expected: /admin/bookings 접속 → 아직 결제 완료되지 않은 예약(status=pending) 또는 paidAt이 null인 예약의 상세 모달 열기 → "결제일시" 필드에 em dash(—, U+2014)만 표시되고 `Invalid Date` 또는 빈 문자열로 표시되지 않음. 결제 완료된 예약은 정상 날짜 포맷으로 표시.
result: pass

### 8. 비밀번호 재설정 요청 (dev mock) — 서버 로그 확인
expected: POST http://localhost:8080/api/v1/auth/password-reset/request 를 존재하는 이메일로 호출 → apps/api dev 서버 콘솔에 "[DEV EMAIL]" 로그 출력 + reset link URL(FRONTEND_URL 기반) 출력. HTTP 응답은 200 OK (이메일 열거 방지 정책상 success 응답).
result: pass

### 9. 비밀번호 재설정 Rate limiting
expected: 같은 IP에서 POST /api/v1/auth/password-reset/request를 15분 이내 4회 연속 호출 → 4번째 요청이 HTTP 429 Too Many Requests 응답으로 거절됨 (1~3번째는 200). confirm 엔드포인트도 동일하게 limit=3 / ttl=900000ms 적용.
result: pass

### 10. 회원가입 약관 동의 체크박스 플로우
expected: 회원가입 2단계에서 "전체 동의" 체크 시 3개 항목(이용약관/개인정보처리방침/마케팅) 모두 체크됨. 개별 체크 해제 시 "전체 동의"도 자동 해제. 필수 2개(이용약관+개인정보처리방침)에 체크되어야 "다음" 버튼 활성화. Dialog 닫은 후에도 체크 상태 유지.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
