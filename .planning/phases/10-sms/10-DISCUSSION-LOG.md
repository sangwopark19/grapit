# Phase 10: SMS 인증 실연동 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 10-sms
**Areas discussed:** SMS 프로바이더 선택, Rate limiting 정책, OTP 만료·재시도 서버 정책, 프로덕션 크리덴셜 누락 처리, 프론트 UX, 관측·모니터링, E2E·QA

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| SMS 프로바이더 선택 | 한국 통신사 직발송 여부, 발신번호 등록(KISA) 제약 포함 | ✓ |
| Rate limiting 정책 (SMS-01) | IP/phone 축, 허용량, 저장소 | ✓ |
| OTP 만료·재시도 서버 정책 (SMS-04) | TTL 정합성, 재발송 쿨다운, 실패 잠금 | ✓ |
| 프로덕션 크리덴셜 누락 처리 (SMS-03) | silent fallback vs hard-fail | ✓ |

**User's choice:** 4개 영역 전체 논의.

---

## SMS 프로바이더 선택

### 1차 선택 (국내 프로바이더 기준)

| Option | Description | Selected |
|--------|-------------|----------|
| SOLAPI (구 쿨SMS) | 국내 표준, 건당 10~15원, Verify 없음 → OTP 로직 직접 구현 | |
| Twilio Verify 유지 | 현재 코드 그대로, $0.05+/건, 국제 경유 | |
| NHN Cloud Notification | SOLAPI 유사 비용, REST API 직접 | |
| 알리고 | 저예산, 문서 품질 낮음 | |

**User's choice:** 4개 전부 기각. 이유: "중국, 태국 등 해외 사용자도 가입하기 때문에 다국적 SMS 인증 필수."

**Action taken:** 다국적 SMS OTP 프로바이더 심층 리서치 agent 실행 → 결과를 2차 선택에 반영.

### 2차 선택 (다국적 프로바이더)

| Option | Description | Selected |
|--------|-------------|----------|
| Infobip 2FA API | 한국 도달률 최강(Kakao 사례 4h→10min), PIN API 위임, 건당 ~35원, 태국·SEA 190+ 직결 | ✓ |
| Twilio Verify 유지 | 재작성 0, DX 최고, 평탄 $0.05/검증, 한국 도달률 중간 | |
| Sinch Verification | 600+ 티어1 직결, 엔터프라이즈 성향 | |
| Vonage Verify | 한국에서 sender ID 랜덤 숫자로 덮어쓰기 → 브랜드 일관성 애매 | |

**User's choice:** **Infobip 2FA API**.

**Notes:** 중국 본토는 어떤 프로바이더도 중국 법인/ICP 없이는 해결 불가 — email/voice fallback은 별도 페이즈로 defer.

### China fallback 여부

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — 추후 페이즈로 | Phase 10은 Infobip 기반까지, +86 감지 시 명확한 에러 반환 | ✓ |
| Phase 10에서 email OTP 대체 제공 | Resend 재사용, 회원가입 경로 이원화 | |

**User's choice:** Defer.

---

## Rate limiting 정책

### 축 선택

| Option | Description | Selected |
|--------|-------------|----------|
| IP + phone 조합 | send-code: phone 5/hr + IP 20/hr, verify-code: phone 10/15min. 비용+enumeration 둘 다 방어 | ✓ |
| phone 전용 | 비용 방어에 집중, enumeration 공격 약함 | |
| IP 전용 | password-reset과 동일 패턴, 공격자 IP 변경 시 phone 하나에 대한 무한 요청 허용 → 비용 리스크 | |

**User's choice:** **IP + phone 조합**.

### Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Valkey 공유 | `@nest-lab/throttler-storage-redis` + ioredis. Cloud Run scale-out 시 정확한 분산 카운팅 | ✓ |
| 기본 in-memory 유지 | 인스턴스별 독립 카운트, min-instances=0 환경에선 실질 영향 적음, 의존성 0 | |

**User's choice:** **Valkey 공유**.

---

## OTP 만료·재시도 서버 정책

### TTL

| Option | Description | Selected |
|--------|-------------|----------|
| 180초(3분) 유지 | 기존 `SMS_CODE_EXPIRY_SECONDS=180` 그대로. 프론트 타이머 불변 | ✓ |
| 300초(5분)로 증가 | SMS 수신 지연 대응 여유, 상수+타이머 변경 필요 | |

**User's choice:** **180초 유지**.

### 재발송 쿨다운

| Option | Description | Selected |
|--------|-------------|----------|
| 30초 쿨다운 | Valkey `sms:resend:{phone}` TTL 30s, 버튼 스팸 방지 단기 레이어 | ✓ |
| 없음 | Rate limit(phone 5/시간)으로 충분, 구현 간결 | |

**User's choice:** **30초 쿨다운**.

### Max retry

| Option | Description | Selected |
|--------|-------------|----------|
| 3회 (엄격) | brute-force 차단 가장 안전, UX 불편 | |
| 5회 (완화) | Infobip/Twilio 기본값, verify-code rate limit과 이중 방어 | ✓ |

**User's choice:** **5회**.

---

## 프로덕션 크리덴셜 누락 처리

### Fail behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail on production | NODE_ENV=production && !INFOBIP_API_KEY → throw. Phase 7 REDIS_URL 패턴 | ✓ |
| Silent fallback 유지 | 현재 동작 그대로, 디버깅 어려워질 수 있음 | |

**User's choice:** **Hard-fail on production**.

### Env var 집합

| Option | Description | Selected |
|--------|-------------|----------|
| API_KEY + BASE_URL + APPLICATION_ID + MESSAGE_ID | 4개 env, 템플릿/프로파일 콘솔 관리 가능 | ✓ |
| API_KEY + BASE_URL만 | 2개 env, Application/Message 코드 상수, 유연성 감소 | |

**User's choice:** **4개 env 집합**.

---

## 프론트 UX 세부

### 재발송 버튼 cooldown UI

| Option | Description | Selected |
|--------|-------------|----------|
| 버튼 disabled + 카운트다운 | `재발송 (28s)` 스타일, 0이 되면 재활성화. 시도 횟수 미노출 | ✓ |
| 버튼 활성 + 429 에러 토스트 | 구현 간단, UX 거침 | |
| disabled + 카운트다운 + 남은 시도 횟수 | 친화적이지만 보안 트레이드오프 | |

**User's choice:** **버튼 disabled + 카운트다운** (시도 횟수 미노출).

---

## 관측·모니터링

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry 이벤트 태깅 + Infobip 대시보드 | 예외만 Sentry 분류, 볼륨·단가는 Infobip 콘솔 의존 | ✓ |
| Sentry + 자체 Prometheus 메트릭 | 정교하지만 1인 개발에 인프라 과잉 | |

**User's choice:** **Sentry + Infobip 대시보드 의존**.

---

## E2E · QA

| Option | Description | Selected |
|--------|-------------|----------|
| env 분리: CI는 mock, staging 수동 스모크 | CI에서 `000000` 유니버설 코드로 진행, 실발송은 staging에서 개발자 수동 | ✓ |
| CI에서도 staging Infobip로 실발송 | 신뢰도 높지만 CI 비용 + Infobip staging 계정 필요, magic test number 제한 | |

**User's choice:** **env 분리(CI mock, staging 수동 스모크)**.

---

## Claude's Discretion

- Infobip Node 클라이언트 선택 (`@infobip-api/sdk` vs 순수 fetch)
- `@nest-lab/throttler-storage-redis` 버전 및 NestJS 11 호환성
- password-reset throttler Valkey 이전 커밋 단위
- 에러 메시지 문구 세부
- 재발송 쿨다운 Valkey 키 스키마
- 국가 코드 감지 로직(+86) 구현 방식

---

## Deferred Ideas

- 중국 본토(+86) SMS fallback (email/voice 경로)
- email OTP 다채널 fallback (Resend 재사용)
- Silent Authentication / flashcall (Infobip 지원)
- 자체 Prometheus SMS 메트릭
- 푸시 알림 fallback (앱 출시 이후)
- 다중 SMS 프로바이더 fallback (PROJECT.md out-of-scope)
- 로그인 시 SMS 재인증 (PROJECT.md out-of-scope)
- PASS 본인인증 연동 (PROJECT.md out-of-scope)
