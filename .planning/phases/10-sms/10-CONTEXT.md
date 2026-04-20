# Phase 10: SMS 인증 실연동 - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

회원가입 시 입력한 전화번호로 실제 SMS OTP를 발송하고 인증번호 검증을 통해 본인 확인을 완료한다. 현재 Twilio 스켈레톤 + `000000` 유니버설 코드 dev mock을 **Infobip 2FA PIN API 기반 다국적 SMS 실연동**으로 전환하고, rate limiting · OTP 만료 · 프로덕션 크리덴셜 누락 hard-fail을 함께 도입한다.

**In scope:** 한국(주력) · 태국 · 기타 국제 번호. 회원가입 플로우에서의 SMS OTP 1회.

**Out of scope (deferred):** 중국 본토(+86) 발송 경로, email/voice fallback, 로그인 시 SMS 재인증, 다중 프로바이더 fallback.

</domain>

<decisions>
## Implementation Decisions

### SMS 프로바이더
- **D-01:** 프로바이더 = **Infobip 2FA API** (PIN API로 OTP 생성·검증·만료·재시도 서버 위임). 결정 근거: 한국 도달률 최강(Kakao 사례 KISA 직결 KT/SKT/LGU+, 4h→10min), 태국·SEA 190+ 직결 커버, 건당 ~35원으로 Twilio($0.05) 대비 절반 이하.
- **D-02:** 기존 Twilio 관련 자산 전면 교체: `apps/api/src/modules/sms/sms.service.ts` 재작성(~100LOC), `twilio` npm 의존성 제거, `TWILIO_*` env 삭제.
- **D-03:** 중국 본토(+86) 번호는 프로바이더 한계상 회피 불가 → 감지 시 `400 Bad Request`에 **"현재 중국 본토 SMS 인증은 지원되지 않습니다. 다른 국가 번호로 가입해 주세요"** 메시지 반환. 실 fallback은 Deferred Ideas 참고.
- **D-04:** 한국 발신번호 사전등록(KISA)은 Infobip 콘솔에서 사전 절차 진행(운영자 수동 작업) — planner는 코드 범위만 다룸, 운영 체크리스트로만 기록.

### Rate Limiting (SMS-01)
- **D-05:** 축 = **IP + phone 조합** (OR 평가 — 둘 중 먼저 임계치 도달하는 축이 차단).
- **D-06:** `/sms/send-code`: **phone당 5/시간 ⊕ IP당 20/시간**. 비용 방어 + enumeration 방어 양축.
- **D-07:** `/sms/verify-code`: **phone당 10회/15분** (Infobip 자체 5회 verification attempt lock의 defense-in-depth 상위 레이어).
- **D-08:** Throttler storage = **Valkey 공유** (`@nest-lab/throttler-storage-redis` 어댑터 + Phase 7에서 도입한 ioredis 클라이언트 재사용). Cloud Run 멀티 인스턴스에서 정확한 분산 카운팅.
- **D-09:** 기존 `auth.controller.ts`의 password-reset throttler(`@Throttle({ limit: 3, ttl: 900000 })`)도 함께 Valkey storage로 이전해 in-memory/Valkey 혼재 방지.

### OTP 정책 (SMS-04)
- **D-10:** PIN lifetime = **180초** (3분). Infobip Application `pinTimeToLive=3m`로 설정. 기존 `SMS_CODE_EXPIRY_SECONDS=180` 상수 그대로 유지 → 프론트 타이머/UX 변경 없음.
- **D-11:** 재발송 쿨다운 = **30초** (단기 스팸 방지). Valkey 키 `sms:resend:{phone}` TTL 30s, SET NX 시도해 실패하면 `429 Too Many Requests` + `retryAfter` 반환.
- **D-12:** 검증 실패 최대 시도 = **5회** (Infobip Application `pinAttempts=5`). 초과 시 PIN 즉시 무효화, 재발송 필요.
- **D-13:** PIN 코드 길이 = 6자리 숫자 (`SMS_CODE_LENGTH=6` 그대로). Infobip Application `pinLength=6`, `pinType=NUMERIC`.

### 크리덴셜 & 환경 (SMS-03)
- **D-14:** **Production hard-fail** — `NODE_ENV==='production'`이면서 `INFOBIP_API_KEY`가 없으면 `SmsService` 생성자에서 throw → Cloud Run 부팅 실패. Phase 7 REDIS_URL 패턴 복제. silent outage 방지가 핵심 근거.
- **D-15:** Dev/test 전용 mock — `NODE_ENV !== 'production' && !INFOBIP_API_KEY`일 때만 mock 모드 활성. `000000` 유니버설 검증 코드도 non-production에서만 수락.
- **D-16:** 필수 env 집합 (4개): `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`(계정별 포털 도메인), `INFOBIP_APPLICATION_ID`(2FA 프로파일), `INFOBIP_MESSAGE_ID`(템플릿). 넷 중 하나라도 비어 있으면 production에서 hard-fail.
- **D-17:** GCP Secret Manager + GitHub Actions secrets 업데이트: `TWILIO_*` 4건 제거, `INFOBIP_*` 4건 추가.

### 프론트 UX
- **D-18:** 재발송 버튼 = **disabled + 카운트다운 라벨**(`재발송 (28s)`) 스타일. 0이 되면 재활성화. 기존 만료 타이머(3분)와는 **독립된 2번째 타이머**(30초).
- **D-19:** 시도 횟수 남은 회수는 UI에 노출하지 않음(공격자 어포던스 방지). 만료/잠금/쿨다운 세 상태만 구분되게 에러 메시지 분기.
- **D-20:** 에러 분기:
  - `429 resend cooldown` → "잠시 후 다시 시도해주세요"
  - `410/422 expired or max attempts` → "인증번호가 만료되었습니다. 재발송해주세요"
  - `400 invalid code` → "인증번호가 일치하지 않습니다"

### 관측·모니터링
- **D-21:** Sentry 이벤트 태깅 — `sms.send_failed`, `sms.verify_failed` 이벤트에 `country`, `provider`, `http_status`, `infobip_code` tag. captureException level=error.
- **D-22:** Cloud Run 구조화 로그 — `sms.sent`, `sms.verified`, `sms.rate_limited`, `sms.credential_missing` 이벤트 JSON 로깅 (Phase 7 NestJS v11 JSON logger 준수).
- **D-23:** 단가·볼륨 관측은 **Infobip 대시보드 의존** — 자체 Prometheus 메트릭 수집 스택은 구축하지 않음(1인 개발 과잉 명시).

### E2E · QA
- **D-24:** CI Playwright — `NODE_ENV=test` + `INFOBIP_API_KEY` 미주입 → mock 모드 자동 진입. 기존 `000000` 유니버설 코드 활용.
- **D-25:** 실 발송 스모크 테스트는 **staging 환경 수동** — 개발자 본인 번호로 주기적 확인. CI에 실발송 비용 발생 절대 금지.

### Claude's Discretion
- Infobip Node 클라이언트 선택: 공식 `@infobip-api/sdk` vs 순수 `fetch`/`ky` — 리서치 단계에서 번들/DX 기준으로 결정
- `@nest-lab/throttler-storage-redis` 버전 · NestJS 11 호환성 검증 — 미호환 시 대체 패키지(`nestjs-throttler-storage-redis`) 평가
- password-reset throttler Valkey 이전을 별도 commit으로 쪼갤지 SMS throttler와 묶을지 — planner 재량
- 에러 메시지 정확 문구 (한국어/영어 키 분리 여부)
- 재발송 쿨다운 Valkey 키 스키마(TTL vs 만료 시각 명시) — 일관 패턴만 지키면 자유
- 국가 코드 감지 로직(+86) — libphonenumber-js 사용 vs 단순 prefix 매칭

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항 · 프로젝트 계약
- `.planning/ROADMAP.md` — Phase 10 Goal/Depends/Requirements/Success Criteria 4개
- `.planning/REQUIREMENTS.md` §"SMS 인증" — SMS-01~SMS-04 원문 + Traceability 표
- `.planning/PROJECT.md` §"Out of Scope" — "SMS fallback 프로바이더", "SMS 로그인 시 매번 인증" 제외 확정, §"Key Decisions" — Production REDIS_URL hard-fail 철학

### 직전 페이즈 결정 (계승)
- `.planning/phases/07-valkey/07-CONTEXT.md` — ioredis 단일 클라이언트 + Memorystore Valkey, Production hard-fail 패턴(silent fallback 금지 근거)
- `.planning/phases/09-tech-debt/09-CONTEXT.md` — env 기반 dev mock 패턴 (SMS가 이 패턴의 원조)

### 기존 코드 (교체·참조 대상)
- `apps/api/src/modules/sms/sms.service.ts` — **교체 대상** Twilio Verify 스켈레톤. Infobip SDK로 재작성
- `apps/api/src/modules/sms/sms.controller.ts` — Zod schema + `@Public` + `ZodValidationPipe` 구조 유지, `@Throttle` 추가
- `apps/api/src/modules/sms/sms.module.ts` — DI 구성 유지
- `apps/api/src/modules/sms/sms.service.spec.ts` — Infobip mock으로 재작성 대상
- `apps/api/src/modules/auth/auth.controller.ts:118-135` — **참조** `@Throttle({ limit: 3, ttl: 900000 })` 패턴, Valkey storage 적용 함께 이전
- `apps/api/src/app.module.ts:29` — `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])` — storage 옵션 추가로 Valkey 연결
- `apps/api/src/modules/auth/auth.service.ts:71` — register에서 SMS verify 호출 (응답 shape 불변)
- `apps/api/src/modules/auth/auth.service.ts:393` — social-register에서 SMS verify 호출 (응답 shape 불변)
- `apps/api/src/modules/booking/providers/redis.provider.ts` — ioredis 공용 클라이언트 재사용 지점

### 프론트엔드
- `apps/web/components/auth/phone-verification.tsx` — 재발송 버튼 cooldown UI 수정 대상 (30초 타이머 추가)
- `apps/web/app/auth/callback/page.tsx`, `components/auth/signup-form.tsx` — 영향 없음 확인 필요
- `packages/shared/src/constants/index.ts:5` — `SMS_CODE_EXPIRY_SECONDS=180`, `SMS_CODE_LENGTH=6` (불변)

### 외부 문서 (리서치에서 정밀 확정)
- Infobip 2FA API 공식 문서 — https://www.infobip.com/docs/2fa-service
- Infobip Node SDK (`@infobip-api/sdk`) — GitHub/npm (최신 버전/예제는 phase-researcher가 Context7로 조회)
- Infobip Korea delivery 사례(Kakao) — https://www.infobip.com/customer/kakao
- Infobip China 제약 — https://www.infobip.com/docs/essentials/asia-registration/china-sms-registration-and-template-guidelines (2025-12-05 100% 차단 전환)
- NestJS `@Throttle` + custom storage 문서 — https://docs.nestjs.com/security/rate-limiting
- `@nest-lab/throttler-storage-redis` 또는 `nestjs-throttler-storage-redis` — 호환성/버전은 research에서 결정

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`@nestjs/throttler` + `@Throttle` 데코레이터**: password-reset(`auth.controller.ts:120, 133`)에서 이미 사용. SMS controller에도 동일 패턴으로 적용
- **Zod validation pipe**(`sms.controller.ts`): send/verify DTO 구조 그대로 유지, 전화번호 정규식 `^01[016789]\d{7,8}$`은 한국 특화 → 다국적 대응 위해 국제 번호 스키마로 확장 필요
- **ioredis 공용 클라이언트**(Phase 7 `redis.provider.ts`): ThrottlerStorage, 재발송 쿨다운 키 모두 동일 클라이언트 재사용
- **`SMS_CODE_EXPIRY_SECONDS`/`SMS_CODE_LENGTH`**(`packages/shared`): 프론트·백 공유 상수 → 값 불변으로 UX 변경 최소화
- **프론트 `phone-verification.tsx`**: 만료 타이머 로직 이미 존재 → 쿨다운 타이머를 **독립 second timer**로 추가
- **Sentry NestJS setup**(`app.module.ts`): captureException 호출부만 추가

### Established Patterns
- **env 기반 dev/prod mock 전환**: Phase 7, 8, 9 전부 동일. 이번에도 유지하되 production hard-fail 강제
- **Production credential hard-fail**: Phase 7 REDIS_URL에서 정립. 같은 철학 적용
- **Atomic commit per plan**: `feat(10-sms-XX): ...` / `refactor(10-sms-XX): ...` 단위로 독립 커밋
- **구조화 로그 + Sentry 이원화**: 정상 흐름은 로그, 예외는 Sentry

### Integration Points
- **회원가입 플로우**: `POST /auth/register`(일반), `POST /auth/social-register`(카카오·네이버·구글) — 둘 다 `phoneVerificationCode` 검증 경유. 응답 shape 불변 유지로 프론트 영향 최소화
- **`/sms/send-code` 응답**: 현재 `{ success, message }` — Infobip pinId를 반환할지 결정 필요. 클라이언트 세션에 pinId 저장 모델로 갈 경우 응답에 추가, 서버 세션 저장 모델로 갈 경우 그대로 유지 (planner가 Infobip Verify 모델에 맞춰 결정)
- **GCP Secret Manager + GitHub Actions workflow**: `TWILIO_*` 제거, `INFOBIP_*` 추가. CI 시크릿 로테이션 절차 포함
- **Cloud Run 배포**: env 교체 후 min-instances=0 상태에서 hard-fail이 첫 요청 시 drop되는지 `/health` 체크로 선감지 (Phase 7 HealthController Valkey ping 패턴 참고)

</code_context>

<specifics>
## Specific Ideas

- "한국 도달률 = Kakao Infobip 사례(OTP 4h→10min)가 결정적 근거"
- "다국적 요구: 중국, 태국 등 해외 사용자도 가입 — 프로바이더 선택이 글로벌 SMS 전제"
- "중국 본토는 어떤 글로벌 CPaaS도 중국 법인/ICP 없이는 못 뚫음(2025-04 이후 70% 차단, 2025-12-05 Infobip 미등록 100% 차단) → 현실 인정하고 defer"
- "Twilio 대비 건당 1/5 비용 + 한국 로컬 피어링 품질 → 단기 비용, 장기 UX 모두 우위"
- "재발송 버튼은 rate limit과 별도로 단기 spam 방지용 30초 cooldown을 UX 레이어에 한 번 더 — 사용자 실수/오조작 방어"
- "`000000` universal dev code는 유지 — Playwright CI에 이미 박혀 있고 편의성 큼. production에서만 차단되면 충분"

</specifics>

<deferred>
## Deferred Ideas

- **중국 본토(+86) SMS fallback** — 중국 법인 설립 · ICP 등록 · 템플릿 사전 심사가 전제. 또는 email/voice OTP 채널 도입. 별도 페이즈로 설계
- **email OTP fallback (국제 사용자 일반)** — Phase 9에서 Resend 기반 이메일 인프라 구축됨 → 향후 SMS 발송 실패 시 email로 자동 전환하는 다채널 verify 플로우 설계 가능. 중국 fallback과 묶어 같은 페이즈
- **Silent Authentication / flashcall** — Infobip이 지원, OTP-less 경험. 현재 필요성 낮고 회원가입 전환율 지표 쌓인 뒤 재검토
- **SMS 발송 볼륨/단가 자체 Prometheus 메트릭** — 트래픽 증가 후 Infobip 대시보드만으로 부족할 때
- **푸시 알림 fallback** — 모바일 앱(Expo) 출시 이후
- **다중 SMS 프로바이더 fallback** — PROJECT.md out-of-scope 명시(단일 프로바이더 원칙 유지)
- **로그인 시 SMS 재인증** — PROJECT.md out-of-scope 명시(전환율 저하)
- **PASS 본인인증 연동** — PROJECT.md out-of-scope 명시(통신사 연동 복잡도)

</deferred>

---

*Phase: 10-sms*
*Context gathered: 2026-04-15*
