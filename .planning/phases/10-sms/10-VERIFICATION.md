---
phase: 10-sms
verified: 2026-04-16T05:00:00Z
status: human_needed
score: 3/4
overrides_applied: 0
human_verification:
  - test: "실제 SMS OTP 수신 확인"
    expected: "Infobip API를 통해 입력한 전화번호로 6자리 OTP SMS가 수신되고, verify-code 엔드포인트로 검증 성공"
    why_human: "staging smoke test가 미가용 상태로 기록됨. CI는 mock 모드(000000)로만 검증. 실 SMS 발송은 Infobip 계정/Application/Message Template 설정 후 staging 환경에서 수동 확인 필요. DEPLOY-CHECKLIST.md §10 Pre-Deploy Mandatory Checks 참조."
---

# Phase 10: SMS 인증 실연동 검증 보고서

**Phase 목표:** Twilio에서 Infobip으로 SMS provider를 완전 교체하고, 국제 번호 지원 + rate limiting + 4-state UI FSM을 구축한다.
**검증 시각:** 2026-04-16T05:00:00Z
**상태:** human_needed
**재검증 여부:** 아니오 (초기 검증)

## 목표 달성 여부

### 관측 가능한 진실(Observable Truths)

| # | 진실 | 상태 | 근거 |
|---|------|------|------|
| 1 | 회원가입 시 입력한 전화번호로 실제 SMS OTP가 수신 | ? 인간 검증 필요 | sms.service.ts의 `client!.sendPin(e164)` 실 Infobip 호출 경로 구현됨. 단 staging smoke가 미수행(DEPLOY-CHECKLIST §9: "staging 미가용 — 배포 전 수행 예정"). 코드 경로는 완전하나 실제 SMS 수신은 수동 확인 필요 |
| 2 | 동일 번호/IP에서 과도한 SMS 요청 시 rate limiting 적용 | VERIFIED | IP axis: sms.controller.ts에 `@Throttle` 2곳(send-code 20/h, verify-code 10/15min). phone axis: sms.service.ts에 Lua atomic counter(SEND_PHONE_LIMIT=5, VERIFY_PHONE_LIMIT=10). 30s resend cooldown SET NX. ThrottlerModule.forRootAsync Valkey storage 연결 확인 |
| 3 | OTP 입력 실패 횟수 초과 또는 만료 시 재발송 필요 | VERIFIED | sms.service.ts verifyCode: attemptsRemaining===0, NO_MORE_PIN_ATTEMPTS, PIN_EXPIRED 모두 GoneException("인증번호가 만료되었습니다. 재발송해주세요") 처리. pinId 없음(만료)도 GoneException |
| 4 | 개발 환경에서는 SMS mock 모드가 자동 적용되어 실제 발송 없이 테스트 가능 | VERIFIED | sms.service.ts: `isDevMock = !isProduction && missing.length > 0`. mock 모드에서 sendVerificationCode → 즉시 성공, verifyCode → 000000만 통과. E2E signup-sms.spec.ts가 mock 000000으로 3-step 회원가입 완주 |

**점수:** 3/4 진실 검증됨 (나머지 1건 인간 검증 필요)

### 필수 아티팩트

| 아티팩트 | 설명 | 상태 | 세부사항 |
|----------|------|------|---------|
| `apps/api/src/modules/sms/sms.service.ts` | Infobip 기반 SMS 서비스 | VERIFIED | 223줄. InfobipClient/parseE164/isChinaMainland/REDIS_CLIENT 모두 연결. Twilio 참조 0건 |
| `apps/api/src/modules/sms/infobip-client.ts` | Infobip fetch wrapper | VERIFIED | 88줄. /2fa/2/pin, encodeURIComponent, AbortSignal.timeout(5000), Authorization: App {apiKey} |
| `apps/api/src/modules/sms/phone.util.ts` | parseE164 + isChinaMainland | VERIFIED | 64줄. normalizeFullWidth(U+FF0B), 0086 prefix, libphonenumber-js/min, CN/HK/MO/TW 구분 |
| `apps/api/src/modules/sms/sms.controller.ts` | @Throttle IP axis + 국제 번호 | VERIFIED | @Throttle 2곳, zod regex `/^(01[016789]\d{7,8}\|\+[1-9]\d{6,14})$/`, TTL ms 주석 |
| `apps/api/src/modules/sms/sms.module.ts` | BookingModule import | VERIFIED | imports: [BookingModule] — REDIS_CLIENT 주입 경로 확보 |
| `apps/api/src/app.module.ts` | ThrottlerModule forRootAsync | VERIFIED | ThrottlerStorageRedisService, incr-based InMemoryRedis detection, TTL ms 주석 |
| `apps/web/components/auth/phone-verification.tsx` | 4-state 버튼 + 30s 쿨다운 | VERIFIED | resendCooldown state, cooldownTimerRef, mapErrorToCopy, role="alert", aria-label, one-time-code, space-y-4, text-caption |
| `apps/web/lib/phone.ts` | detectPhoneLocale 유틸 | VERIFIED | parsePhoneNumberFromString, COUNTRY_NAME_KO 10개국, PhoneLocale 타입 |
| `packages/shared/src/constants/index.ts` | SMS_RESEND_COOLDOWN_SECONDS=30 | VERIFIED | 서버 sms:resend:{e164} PX 30000과 동기화 |
| `apps/api/src/modules/sms/__fixtures__/infobip-send-response.json` | sendPin 성공 응답 fixture | VERIFIED | pinId, to, ncStatus, smsStatus |
| `apps/api/src/modules/sms/__fixtures__/infobip-verify-response.json` | verifyPin 성공·실패 응답 fixture | VERIFIED | success/wrongPin/expired/noMoreAttempts 4종 |
| `apps/web/e2e/signup-sms.spec.ts` | Playwright E2E mock 회원가입 | VERIFIED | navigateToStep3 헬퍼, 000000 검증, 에러 분기, 30s 쿨다운 라벨 |
| `apps/api/test/sms-throttle.integration.spec.ts` | testcontainers Valkey 통합 테스트 | VERIFIED | GenericContainer('valkey/valkey:8'), ThrottlerStorageRedisService, IP/phone 양축 429 |
| `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` | 운영 체크리스트 | VERIFIED | 11개 섹션, §10 Pre-Deploy Mandatory Checks, 실 SMS smoke 필수 |

### 핵심 링크(Key Links) 검증

| From | To | Via | 상태 | 세부사항 |
|------|----|----|------|---------|
| `sms.service.ts` | `infobip-client.ts` | `new InfobipClient(baseUrl, apiKey, appId, msgId)` | WIRED | 131번 라인 `client!.sendPin(e164)` 및 192번 라인 `client!.verifyPin(pinId, code)` |
| `sms.service.ts` | `phone.util.ts` | `parseE164(phone)`, `isChinaMainland(e164)` | WIRED | 88, 91번 라인 |
| `sms.service.ts` | `REDIS_CLIENT` | `@Inject(REDIS_CLIENT) private readonly redis: IORedis` | WIRED | 44번 라인, BookingModule을 통해 주입 |
| `sms.controller.ts` | `@nestjs/throttler` | `@Throttle({ default: { limit, ttl } })` v6 ms 단위 | WIRED | 35, 47번 라인. 2곳 모두 적용 |
| `app.module.ts` | `@nest-lab/throttler-storage-redis` | `new ThrottlerStorageRedisService(redis)` | WIRED | incr 기반 InMemoryRedis 감지 후 조건부 적용 |
| `phone-verification.tsx` | `sms.service.ts` | `apiClient.post('/api/v1/sms/send-code', { phone })` | WIRED | 147번 라인. mapErrorToCopy로 HTTP status 분기 |
| `phone-verification.tsx` | `detectPhoneLocale` (phone.ts) | `import { detectPhoneLocale } from '@/lib/phone'` | WIRED | 10번 라인 import, 103번 라인 사용 |

### 데이터 흐름 추적 (Level 4)

| 아티팩트 | 데이터 변수 | 소스 | 실 데이터 생성 | 상태 |
|----------|------------|------|-------------|------|
| `phone-verification.tsx` | `codeSent`, `code`, `resendCooldown`, `verifyError` | `apiClient.post('/api/v1/sms/send-code')`, `apiClient.post('/api/v1/sms/verify-code')` | API 응답으로 실제 설정 (mock 모드 포함) | FLOWING |
| `sms.service.ts` | `pinId`, `sendCount`, `verifyCount` | Valkey (redis.get, atomicIncr) | Lua eval 결과 실제 Valkey 카운터 | FLOWING |

### 행동 Spot-checks

| 동작 | 확인 방법 | 결과 | 상태 |
|------|----------|------|------|
| sms.service.ts Twilio 참조 0건 | `grep -rn "Twilio|twilio" apps/api/src/modules/sms/` | 0건 | PASS |
| @Throttle 2곳 | `grep -c "@Throttle" sms.controller.ts` | 2 | PASS |
| ThrottlerStorageRedisService 연결 | `grep -n "ThrottlerStorageRedisService" app.module.ts` | import + useFactory에서 사용 | PASS |
| 국제 번호 regex | `grep -n "+\[1-9\]" sms.controller.ts` | `/^(01[016789]\d{7,8}\|\+[1-9]\d{6,14})$/` | PASS |
| Lua atomic INCR | `grep -n "ATOMIC_INCR_LUA" sms.service.ts` | 선언 + eval() 사용 확인 | PASS |
| cooldown rollback | `grep -n "shouldRollbackCooldown" sms.service.ts` | 5xx/timeout → DEL 로직 확인 | PASS |
| 429 HTTP status 통일 | `grep -n "HttpStatus.TOO_MANY_REQUESTS" sms.service.ts` | 3곳 확인 | PASS |
| 4-state 버튼 | `grep -n "resendCooldown" phone-verification.tsx` | resendCooldown state + 4분기 렌더링 | PASS |
| staging smoke | DEPLOY-CHECKLIST.md §9 | "staging 미가용 — 배포 전 수행 예정" | HUMAN NEEDED |

### 요구사항 커버리지

| 요구사항 | 소스 플랜 | 설명 | 상태 | 근거 |
|----------|----------|------|------|------|
| SMS-01 | 10-05, 10-06, 10-07 | SMS 발송 rate limiting 구현 (phone/IP 기준) | SATISFIED | @Throttle IP 2축, Lua phone counter 2축, 30s cooldown SET NX, ThrottlerStorageRedisService Valkey 연결 |
| SMS-02 | 10-02, 10-03, 10-04, 10-05 | SMS 프로바이더 실 연동 (OTP 발송/검증) | SATISFIED (코드), 인간 검증 필요 (실 발송) | Twilio 완전 제거 확인. InfobipClient 구현, SmsService 재작성, 국제 번호 지원. staging smoke 미수행으로 실 SMS 수신은 인간 확인 필요 |
| SMS-03 | 10-02, 10-05 | 프로덕션/개발 환경 자동 전환 유지 | SATISFIED | isDevMock=!isProduction && missing.length>0. production: hard-fail(throw). dev: 000000 mock |
| SMS-04 | 10-05, 10-08 | OTP 재시도 제한 및 만료 처리 | SATISFIED | GoneException(만료/NO_MORE_PIN_ATTEMPTS/PIN_EXPIRED/attemptsRemaining===0). 프론트: 410/422→만료 메시지, setTimeLeft(0) |

### 발견된 안티패턴

| 파일 | 라인 | 패턴 | 심각도 | 영향 |
|------|------|------|--------|------|
| `phone-verification.tsx` | 215, 266 | `placeholder="..."` HTML 속성 | INFO | Input 컴포넌트의 정상 placeholder 속성. stub 패턴 아님 |

안티패턴 없음 — 모든 구현이 실질적 로직을 포함함.

### 인간 검증 필요 항목

#### 1. 실제 SMS OTP 수신 확인

**테스트:** staging 환경에서 INFOBIP_* 4종 환경변수 설정 후, 개발자 본인 번호로 `POST /api/v1/sms/send-code` 호출하여 SMS 수신 확인. 받은 인증번호로 `POST /api/v1/sms/verify-code` 호출하여 `verified: true` 확인.

**예상 결과:** 30초 이내 6자리 숫자 SMS 수신, verify-code 호출 시 `{ verified: true }` 응답

**왜 인간 검증인가:** Infobip API는 실 계정/Application/Message Template이 필요. CI는 INFOBIP 시크릿 미주입으로 mock 모드로만 동작. 실 SMS 발송은 DEPLOY-CHECKLIST.md §10 Pre-Deploy Mandatory Checks에 명시된 배포 전 필수 항목임. DEPLOY-CHECKLIST.md §9에 "staging 미가용 — 배포 전 수행 예정"으로 기록됨.

**참조:** `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` §9, §10

### 갭 요약

자동화 검증 가능한 4개 Success Criteria 중 3개(SC#2, SC#3, SC#4)는 코드베이스에서 완전히 검증됨.

SC#1(실제 SMS OTP 수신)은 코드 경로는 완벽히 구현되어 있으나 — Infobip sendPin 호출, E.164 정규화, REDIS pinId 저장 — 실제 SMS 수신을 자동화로 검증할 수 없음. staging smoke test가 미수행 상태(DEPLOY-CHECKLIST §9 참조). DEPLOY-CHECKLIST §10에 pre-deploy 필수 항목으로 명시되어 있어 배포 전 수행 예정.

**ROADMAP 상태 불일치 주의:** ROADMAP.md에 10-08, 10-09 플랜이 `[ ]`(미완료)로 표시되어 있으나, 두 플랜의 SUMMARY.md가 존재하고 실제 구현 코드가 코드베이스에 확인됨. ROADMAP.md를 `[x]`로 업데이트 필요.

---

_검증 시각: 2026-04-16T05:00:00Z_
_검증자: Claude (gsd-verifier)_
