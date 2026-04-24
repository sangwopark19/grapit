---
status: diagnosed
phase: 13-grapit-grabit-rename
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md]
started: 2026-04-24T00:33:21Z
updated: 2026-04-24T01:30:00Z
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
  phase_regression: false
  root_cause: "InMemoryRedis mock 클래스에 ping() 메서드가 없어 redis.health.indicator.ts:32 의 this.redis.ping() 호출이 TypeError 를 던짐. try/catch 가 이를 down 으로 변환 → Terminus HealthCheckError → HTTP 503. 프로덕션은 real ioredis 로 정상. Phase 7-05 이후 존재하던 pre-existing 버그."
  artifacts:
    - path: "apps/api/src/modules/booking/providers/redis.provider.ts"
      issue: "InMemoryRedis class (L14-339) 에 ping() 메서드 부재. 타입 캐스팅 `as unknown as IORedis` 가 API 불일치 은폐"
    - path: "apps/api/src/health/redis.health.indicator.ts"
      issue: "L32 this.redis.ping() 호출 전 capability probe 없음 (cf. redis-io.adapter.ts:74-79 의 duplicate() probe 패턴)"
    - path: "apps/api/src/health/__tests__/redis.health.indicator.spec.ts"
      issue: "mock 에 ping 항상 정의돼 있어 fallback 불일치 미커버"
  missing:
    - "InMemoryRedis 에 `async ping(): Promise<'PONG'> { return 'PONG' }` 추가"
    - "RedisHealthIndicator 에 capability probe 추가 (`if (typeof this.redis.ping !== 'function') return up({mock:true})`)"
    - "회귀 테스트: REDIS_URL unset 시 /health 가 200 반환 확인"
  debug_session: ".planning/debug/local-api-health-503-no-redis.md"

- truth: "프로덕션에서 비밀번호 재설정 이메일이 실제 메일박스로 수신됨"
  status: failed
  reason: "User reported: 프로덕션환경에서오지 않음."
  severity: major
  test: 9
  phase_regression: false
  root_cause: "Phase 13 운영(ops) cutover 미완결. (1) GCP Secret Manager `resend-from-email` 값이 여전히 `no-reply@grapit.com` (Plan 03/04 가 명시적으로 deferred 처리). (2) Resend 콘솔에 `heygrabit.com` 도메인 verification 미수행 (HANDOFF.md §4 ops 이관 대상). auth.service.ts 는 fire-and-forget (enumeration 방지) 이고 email.service.ts 는 Resend 에러를 silent `{success:false}` 로 삼킴 → 유저 관점에서 'email missing'. 코드 결함 아님."
  artifacts:
    - path: "apps/api/src/modules/auth/email/email.service.ts"
      issue: "L70-82: Resend 에러를 silent {success:false} 로 반환 (의도된 enumeration 방지), 관측성 부족"
    - path: ".github/workflows/deploy.yml"
      issue: "L121: `RESEND_FROM_EMAIL=resend-from-email:latest` (secret name 유지, 값 교체 필요)"
    - path: "(external) GCP Secret Manager `resend-from-email`"
      issue: "값 = `no-reply@grapit.com` (추정). heygrabit.com 으로 교체 필요"
    - path: "(external) Resend 콘솔 domains"
      issue: "heygrabit.com 미등록 — SPF/DKIM/DMARC 레코드 3종 후이즈 DNS 등록 + Resend verification 필요"
  missing:
    - "Resend 콘솔에서 heygrabit.com 도메인 추가 → SPF TXT + DKIM CNAME + DMARC TXT 후이즈 NS 등록 → Verified 확보"
    - "Secret Manager 값 교체: `printf 'no-reply@heygrabit.com' | gcloud secrets versions add resend-from-email --data-file=- --project=grapit-491806`"
    - "grabit-api 재배포 (신규 secret version 주입)"
    - "(관측성 강화) email.service.ts success:false 시 Sentry captureException 추가"
  debug_session: ".planning/debug/password-reset-email-not-delivered-prod.md"

- truth: "회원가입 SMS OTP 가 발송되고, 수신된 인증번호를 입력하면 검증에 성공한다"
  status: failed
  reason: "User reported: 실제 sms 까지는 옴. 그런데 맞는 인증번호를 입력해도 틀렸다고 나옴."
  severity: major
  test: 10
  phase_regression: false
  root_cause: "Valkey Cluster mode CROSSSLOT 에러. SmsService.verifyCode 의 Lua EVAL 이 3개 key (`sms:otp:{e164}`, `sms:attempts:{e164}`, `sms:verified:{e164}`) 를 사용하는데 공통 hash tag 가 없어 서로 다른 cluster slot 에 매핑 → Memorystore for Valkey 가 `CROSSSLOT` ReplyError 반환. sms.service.ts:390-415 의 generic catch 가 이를 `{verified:false, message:'인증번호 확인에 실패했습니다'}` 로 HTTP 200 반환. phone-verification.tsx:142-144 는 server message 를 무시하고 '인증번호가 일치하지 않습니다' 하드코드 → 시스템 에러가 틀린 OTP UX 로 masking. Commit b382e39 (booking.service.ts) 가 동일 패턴으로 수정했으나 4일 뒤 Phase 10.1 SMS 재작성(96ad565)이 패턴 미적용. Phase 13 regression 아님."
  artifacts:
    - path: "apps/api/src/modules/sms/sms.service.ts"
      issue: "L39-79 VERIFY_AND_INCREMENT_LUA: 3개 key 공통 hash tag 없음. L220-222 send pipeline 및 L362-369 verify eval 모두 수정 필요. L390-415 catch 가 시스템 에러와 실제 오답을 구분하지 않음"
    - path: "apps/web/components/auth/phone-verification.tsx"
      issue: "L139-144: res.message 무시하고 wrong-code 텍스트 하드코드 → 시스템 에러가 UX 에서 마스킹됨"
    - path: "apps/api/test/sms-throttle.integration.spec.ts"
      issue: "L318-326: standalone Valkey 컨테이너 사용 (cluster 모드 아님) → CROSSSLOT 회귀 미탐지. Cluster-mode 테스트 추가 필요"
  missing:
    - "SMS 키 3개에 공통 hash tag 적용: `{sms:${e164}}:otp`, `{sms:${e164}}:attempts`, `{sms:${e164}}:verified` (send + verify + 테스트 모두 동기화)"
    - "phone-verification.tsx 에서 res.message 를 hard-code 보다 우선 사용 (시스템 에러 구분 표시)"
    - "Integration test 를 cluster-mode Valkey 로 확장해 CROSSSLOT 회귀 가드"
  debug_session: ".planning/debug/signup-sms-otp-verify-wrong.md"

- truth: "법적 문서(약관/개인정보/마케팅)가 heygrabit.com 상의 공개 URL 에서 렌더링되고 연락처 이메일이 @heygrabit.com 로 표기됨"
  status: failed
  reason: "User reported: https://heygrabit.com/terms 같은 주소 접속 시 페이지를 찾을 수 없다고 뜸."
  severity: major
  test: 11
  phase_regression: false
  recommendation: "Defer to separate phase — feature scope beyond Phase 13 rename"
  root_cause: "Pre-existing feature gap. apps/web/app/ 하위에 `/terms`, `/privacy`, `/marketing`, `/legal/*` page.tsx 가 존재한 적 없음 (git 전 히스토리 신규 파일 추가 0건). Phase 09 DEBT-02 가 MD+TermsMarkdown/LegalDraftBanner 컴포넌트를 만들었으나 signup-step2 와 booking/confirm 의 terms-agreement 에만 연결. Footer legal 링크 3건은 `href=\"#\"` 플레이스홀더. 한국 개인정보보호법·정통망법상 공개 URL 이 런칭 필수이나 Phase 13 scope(브랜드 rename)에는 포함 안 됨."
  artifacts:
    - path: "apps/web/app/"
      issue: "/terms, /privacy, /marketing, /legal/* 라우트 파일 전무"
    - path: "apps/web/components/layout/footer.tsx"
      issue: "L9/L13/L17: 이용약관/개인정보처리방침/고객센터 링크가 href=\"#\" 플레이스홀더"
    - path: "apps/web/content/legal/{terms-of-service,privacy-policy,marketing-consent}.md"
      issue: "콘텐츠는 brand rename 완료된 상태로 준비됨 — 공개 페이지에 연결만 하면 됨"
    - path: "apps/web/components/legal/terms-markdown.tsx"
      issue: "렌더링 컴포넌트 기존재 — 재사용 가능"
    - path: ".planning/phases/13-grapit-grabit-rename/13-VALIDATION.md"
      issue: "L66 의 rg 검증식이 존재하지 않는 디렉토리를 전제 → 우연히 green 이었던 false-pass"
  missing:
    - "apps/web/app/legal/{terms,privacy,marketing}/page.tsx 신규 생성 (TermsMarkdown 로 MD 렌더링, SSG)"
    - "footer.tsx 3건의 href=\"#\" 를 실제 경로로 교체"
    - "(선택) next.config.ts redirects 로 /terms → /legal/terms alias"
    - "LegalDraftBanner 런칭 시 유지/제거 결정 (법무 검토)"
    - "metadata + a11y (title/description, heading 구조) 추가"
    - "별도 phase 로 트래킹 (브랜드 rename 과 feature 추가의 관심사 분리)"
  debug_session: ".planning/debug/legal-pages-404-heygrabit.md"
