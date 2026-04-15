---
status: diagnosed
trigger: "resend로 비밀번호 재설정 안내 메일이 왔는데 재설정 버튼을 눌러 링크를 타고 들어가도 재설정이 아니라 다시 재설정 이메일 보내기로 가버려"
created: 2026-04-15T01:00:00Z
updated: 2026-04-15T01:10:00Z
---

## Current Focus

hypothesis: 비밀번호 재설정 이메일 링크의 path는 /auth/reset-password?token=... 이지만, 동일한 path의 frontend 페이지는 "재설정 요청(이메일 입력)" 페이지로만 구현되어 있고 token query param을 처리/분기하는 로직이 존재하지 않는다. 결과적으로 사용자는 토큰을 지참한 채 이메일 요청 페이지를 다시 보게 된다.
test: API의 resetLink 생성 path와 web 앱의 실제 라우트 + 페이지 컴포넌트 동작을 비교
expecting: API path와 frontend route가 같은 URL을 가리키지만, 페이지가 token 분기를 하지 않으면 hypothesis 확정
next_action: return diagnosis to /gsd-plan-phase --gaps

## Symptoms

expected: Resend로 수신한 "[Grapit] 비밀번호 재설정" 메일의 "비밀번호 재설정" 버튼 클릭 → /auth/password-reset/confirm?token=... (또는 token을 처리하는 동등 경로)로 이동하여 새 비밀번호 입력 UI가 표시되어야 함
actual: 메일 링크를 클릭하면 새 비밀번호 입력 UI가 아니라, 비밀번호 재설정 메일을 다시 보내달라고 이메일을 입력받는 페이지(=요청 페이지)가 표시됨
errors: 없음 (404도 아님; 정상 200으로 같은 path의 요청 페이지가 렌더됨)
reproduction: Test 11 (Phase 09 UAT) — 실제 Resend 메일을 받은 뒤 "비밀번호 재설정" 버튼 클릭
started: Phase 09-tech-debt 초기 구현 시점부터 (요청 페이지만 만들어졌고 confirm 페이지는 한 번도 만들어진 적 없음)

## Eliminated

- hypothesis: FRONTEND_URL 미설정으로 URL이 잘못 만들어졌다
  evidence: auth.service.ts:247-248에서 FRONTEND_URL이 없더라도 path 자체는 항상 /auth/reset-password?token=... 으로 고정되며, dev/UAT는 .env에서 FRONTEND_URL이 설정된 상태로 Test 8에서 link 출력이 정상이었음 (UAT pass)
  timestamp: 2026-04-15T01:08:00Z

- hypothesis: 토큰 query param 이름 불일치 (?token vs ?t 등)
  evidence: API는 ?token= 으로 발송하고, 어차피 reset-password page 자체가 query param을 전혀 읽지 않으므로 param 이름과 무관함
  timestamp: 2026-04-15T01:08:00Z

- hypothesis: 미들웨어가 토큰이 없을 때 redirect함
  evidence: apps/web 루트에 middleware.ts 파일 없음. 페이지가 정상적으로 200으로 떴고 사용자도 "리다이렉트"가 아닌 "같은 페이지(이메일 입력)가 표시"라고 보고함
  timestamp: 2026-04-15T01:08:00Z

- hypothesis: 이메일 템플릿 button href가 상대경로로 빠졌다
  evidence: password-reset.tsx:24-25 에서 `href={resetLink}` 절대 URL을 그대로 받음. resetLink는 auth.service.ts:248에서 `${frontendUrl}/auth/reset-password?token=${resetToken}` 절대 URL로 생성됨
  timestamp: 2026-04-15T01:08:00Z

- hypothesis: confirm 페이지가 토큰 검증 실패 시 router.replace 로 reset request 페이지로 redirect
  evidence: confirm 페이지 자체가 존재하지 않음. apps/web/app/auth/ 하위에 confirm 디렉토리가 없고 auth/reset-password/ 디렉토리에는 page.tsx 단일 파일뿐 (subdirectory 없음). useEffect나 router.replace 코드 자체가 존재하지 않음
  timestamp: 2026-04-15T01:09:00Z

## Evidence

- timestamp: 2026-04-15T01:05:00Z
  checked: API auth.service.ts requestPasswordReset 의 resetLink 생성 로직
  found: auth.service.ts:247-248 — `const frontendUrl = this.configService.get<string>('FRONTEND_URL'); const resetLink = ${frontendUrl}/auth/reset-password?token=${resetToken};`
  implication: 메일에 들어가는 path는 정확히 `/auth/reset-password?token=...`. (gap truth가 가정한 `/auth/password-reset/confirm` 이 아님)

- timestamp: 2026-04-15T01:05:30Z
  checked: API auth.controller.ts password-reset 엔드포인트
  found: 두 개 엔드포인트 존재 — POST /auth/password-reset/request (123-129행) + POST /auth/password-reset/confirm (135-142행). resetPassword(token, newPassword) 호출용
  implication: backend는 `password-reset/confirm` 엔드포인트가 준비되어 있어서 frontend가 token + newPassword를 POST만 해주면 동작함. 단지 그 POST를 트리거하는 frontend 페이지가 없는 것이 문제

- timestamp: 2026-04-15T01:06:00Z
  checked: apps/web/app/auth/ 디렉토리 구조
  found: `callback/`, `error.tsx`, `page.tsx`, `reset-password/` 만 존재. `password-reset/` 디렉토리도 없고 `reset-password/confirm/` 같은 하위 라우트도 없음. confirm 페이지 자체가 미구현.
  implication: 메일 링크가 가리키는 URL과 frontend 라우트는 path 자체는 일치하지만(/auth/reset-password) — 그 페이지가 token을 받는 confirm UI를 갖추고 있지 않음

- timestamp: 2026-04-15T01:06:30Z
  checked: apps/web/app/auth/reset-password/page.tsx 의 컴포넌트 구현
  found: 컴포넌트는 `ResetPasswordPage`라는 client component인데, 내용 전체가 "이메일을 입력받아 POST /api/v1/auth/password-reset/request"를 호출하는 요청 폼임 (line 36-47). useSearchParams / useRouter / token 변수 / confirm 호출이 전혀 없음. token query 가 있어도 무시됨.
  implication: 메일 링크에 token이 붙어 있어도, 페이지는 항상 "이메일 입력 → 메일 발송 요청" UI만 보여줌. 사용자 보고와 정확히 일치하는 동작 ("재설정 이메일 보내기 페이지로 가버려").

- timestamp: 2026-04-15T01:07:00Z
  checked: apps/web 루트 middleware.ts 존재 여부
  found: middleware.ts 파일 없음 (루트 디렉토리에 middleware 관련 파일 부재)
  implication: 미들웨어 redirect 가설 제거. 리다이렉트가 아니라 "토큰을 무시한 채 같은 path의 요청 페이지가 그대로 렌더되는" 현상

## Resolution

root_cause: |
  비밀번호 재설정 이메일 링크는 `${FRONTEND_URL}/auth/reset-password?token=<JWT>` 로 정상 발송되지만, frontend의 `apps/web/app/auth/reset-password/page.tsx` 는 "재설정 요청(이메일 입력) 페이지" 단일 용도로만 구현되어 있고 `?token=` query를 읽거나 분기하는 로직이 존재하지 않는다. 또한 별도의 confirm 페이지 라우트(`/auth/reset-password/confirm` 또는 `/auth/password-reset/confirm`)도 만들어진 적이 없다. 결과적으로 메일에서 링크를 클릭하면 토큰이 무시된 채 동일 path의 "이메일 다시 발송 요청" UI가 표시된다. Backend `POST /api/v1/auth/password-reset/confirm` 엔드포인트(`auth.controller.ts:135-142`)와 `AuthService.resetPassword`(`auth.service.ts:253-318`)는 모두 정상 구현되어 있어, 누락된 것은 오직 frontend의 토큰 입력/제출 UI다.
fix: |
  (제안 — 적용은 /gsd-plan-phase --gaps 가 수행)
  옵션 A (작은 변경): `apps/web/app/auth/reset-password/page.tsx` 가 `useSearchParams()` 로 `token` 을 읽어, 존재하면 "새 비밀번호 입력 + 확인" 폼을 렌더하고 `POST /api/v1/auth/password-reset/confirm` 으로 `{ token, newPassword }` 를 전송하도록 분기. 동시에 `auth.service.ts:248` 의 path도 그대로 두면 됨.
  옵션 B (라우트 분리): `apps/web/app/auth/reset-password/confirm/page.tsx` 를 새 파일로 추가하고 `auth.service.ts:248` 의 resetLink path를 `/auth/reset-password/confirm?token=...` 로 변경. confirm 페이지는 token 검증 실패 시 명시적 에러 UI를 표시.
  두 방법 모두 backend는 변경 불필요. 옵션 B가 라우트 책임이 분리되어 더 유지보수성이 좋음.
verification: pending — no fix applied (diagnose-only)
files_changed: []
