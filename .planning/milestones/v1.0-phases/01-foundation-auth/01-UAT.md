---
status: complete
phase: 01-foundation-auth
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-03-30T09:00:00.000Z
updated: 2026-03-30T01:35:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 서버/DB를 모두 종료한 상태에서 docker compose up -d → pnpm --filter @grapit/api drizzle-kit migrate → pnpm dev 실행. API 서버(8080)와 웹 서버(3000)가 에러 없이 부팅되고, GET /api/v1/health가 정상 응답 반환.
result: issue
reported: "Cold start에서 8개 설정/빌드 이슈: (1) db:migrate 스크립트 없음, (2) .env 미생성 + DOTENV_CONFIG_PATH 필요, (3) SWC baseUrl 미설정 panic, (4) type:module과 SWC CJS 출력 충돌, (5) shared 패키지 exports 서브패스 미정의 + .ts를 CJS 런타임이 로드 불가, (6) ConfigModule envFilePath 미설정, (7) health endpoint @Public() 누락 401, (8) SMS 컨트롤러 경로 중복 prefix"
severity: blocker

### 2. 홈페이지 렌더링 (GNB + 메인 + Footer)
expected: localhost:3000 접속 시 상단에 Grapit 로고와 장르 탭(비활성), 검색바(비활성), 로그인 버튼이 있는 GNB 표시. 중앙에 브랜드 헤딩과 /auth로 이동하는 CTA 버튼. 하단 Footer에 법적 링크와 "개인정보처리방침"이 굵은 글씨로 표시.
result: pass

### 3. 이메일 회원가입 3단계 플로우
expected: /auth 페이지에서 회원가입 탭 선택 → Step 1: 이메일/비밀번호/비밀번호 확인 입력 (유효성 검사 작동) → Step 2: 약관 동의 (전체선택 체크박스, 개별 약관 보기 다이얼로그) → Step 3: 이름/성별/생년월일/전화번호 입력 + SMS 인증 (개발 모드: 000000 코드) → 가입 완료. StepIndicator가 각 단계 진행 상태 표시.
result: pass

### 4. 이메일 로그인
expected: /auth 페이지 로그인 탭에서 가입한 이메일/비밀번호 입력 → 로그인 성공 시 홈페이지로 이동. 잘못된 비밀번호 입력 시 인라인 에러 메시지 표시. 소셜 로그인 버튼(카카오/네이버/구글) 3개가 하단에 브랜드 색상으로 표시.
result: pass

### 5. GNB 인증 상태 반영
expected: 로그인 후 GNB의 "로그인" 링크가 사라지고 사용자 아바타/프로필 드롭다운으로 변경. 드롭다운에 마이페이지, 로그아웃 등 메뉴 표시.
result: pass

### 6. 세션 유지 (브라우저 새로고침)
expected: 로그인 상태에서 브라우저 새로고침(F5) → 잠깐 로딩 후 로그인 상태 유지. httpOnly 쿠키 기반 자동 토큰 갱신으로 재로그인 불필요.
result: pass

### 7. 마이페이지 프로필
expected: /mypage 접속 시 프로필 정보 표시. 이메일은 읽기전용, 이름/전화번호는 수정 가능. 전화번호 변경 시 SMS 재인증 필요. 수정 후 저장 성공 토스트 표시.
result: pass

### 8. 로그아웃
expected: 로그아웃 클릭 → GNB가 "로그인" 링크로 복원. /mypage 직접 접속 시 /auth로 리다이렉트. 이전 세션 토큰 무효화.
result: pass

### 9. 비밀번호 재설정 요청
expected: /auth/reset-password 페이지에서 이메일 입력 후 제출 → 항상 성공 메시지 표시 (이메일 존재 여부와 무관, 이메일 열거 방지). 서버 콘솔에 리셋 링크 출력 (이메일 stub 상태).
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "서버/DB를 모두 종료한 상태에서 Cold Start 시 에러 없이 부팅되고 health check 정상 응답"
  status: failed
  reason: "Cold start에서 8개 설정/빌드 이슈 발견. 대부분 UAT 중 즉시 수정 완료. 잔여: (1) TS 타입 에러 4개 (JWT expiresIn, OAuth strategy 타입), (2) FRONTEND_URL 환경변수 미설정"
  severity: blocker
  test: 1
  root_cause: "Phase 01 실행 시 worktree 환경에서 빌드되어 실제 로컬 환경의 .env, shared 패키지 빌드, ESM/CJS 호환성 검증이 누락됨"
  artifacts:
    - path: "apps/api/tsconfig.json"
      issue: "baseUrl 누락으로 SWC panic"
    - path: "apps/api/package.json"
      issue: "type:module과 SWC CJS 출력 충돌"
    - path: "packages/shared/package.json"
      issue: "exports에 서브패스 미정의, .ts 소스만 export"
    - path: "packages/shared/tsconfig.json"
      issue: "noEmit:true로 빌드 출력 없음"
    - path: "apps/api/src/app.module.ts"
      issue: "ConfigModule envFilePath 미설정"
    - path: "apps/api/src/health/health.controller.ts"
      issue: "@Public() 데코레이터 누락"
    - path: "apps/api/src/modules/sms/sms.controller.ts"
      issue: "Controller prefix 중복 (api/v1/api/v1/sms)"
    - path: "turbo.json"
      issue: "dev task에 ^build 의존성 누락"
  missing:
    - ".env 파일 생성 문서화"
    - "FRONTEND_URL 환경변수 추가"
    - "TS 타입 에러 4개 수정 (JWT expiresIn as StringValue, OAuth strategy 타입 단언)"
  debug_session: ""
