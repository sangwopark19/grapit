# Infobip SMS 2FA 배포 운영 체크리스트

Phase 10 SMS 인증 실연동에 필요한 Infobip 콘솔 사전 작업 및 프로덕션 배포 절차.
코드 배포 이전에 1~5단계를 완료해야 한다.

---

## 1. Infobip Portal 계정 확보

- [ ] [Infobip Portal](https://portal.infobip.com) 계정 생성 또는 기존 계정 로그인
- [ ] 계정별 Base URL 확인: 포털 대시보드 좌측 하단 또는 API Keys 페이지에서 확인
  - 형식: `xxxxx.api.infobip.com` (계정마다 고유)
  - 이 값이 `.env`의 `INFOBIP_BASE_URL`에 들어감
- [ ] 요금제 확인: 한국 SMS 발송 가능한 플랜인지 확인 (Free Trial은 테스트 번호만 가능)

## 2. 한국 발신번호 사전등록 (KISA)

> D-04: 한국 법규상 발신번호 사전등록 없이는 SMS 발송 차단됨

- [ ] Infobip Portal > Numbers > Buy Number 또는 Sender Registration 메뉴 진입
- [ ] 한국 발신번호(Sender ID) 등록 신청
  - KISA(한국인터넷진흥원) 발신번호 사전등록제에 따라 심사 필요
  - 등록 소요: 1~3 영업일
  - 필요 서류: 사업자등록증, 통신서비스 이용증명원
- [ ] 등록 완료 후 발신번호가 Infobip 콘솔에서 "Active" 상태인지 확인

## 3. 2FA Application 생성

> Infobip Portal > Use cases > 2FA > Applications > Create Application

- [ ] Application Name: `grapit-sms-2fa` (또는 서비스에 맞는 이름)
- [ ] Configuration 설정:
  - `pinAttempts=5` -- OTP max attempts 5회는 이 Application 설정이 서버 사이드에서 강제. 앱 레벨 attempt counter는 의도적으로 미구현 -- Infobip이 5회 초과 시 PIN 즉시 무효화.
  - `allowMultiplePinVerifications=true` -- 동일 PIN을 검증 성공 후에도 재검증 허용 (idempotent verify 지원)
  - `pinTimeToLive=3m` -- PIN 유효기간 3분 (D-10). 프론트엔드 타이머와 동기화
  - `sendPinPerPhoneNumberLimit=5/1h` -- 동일 번호에 시간당 최대 5회 발송 (D-06). 비용 방어 + 스팸 방지
- [ ] Application ID 복사 -> `INFOBIP_APPLICATION_ID` 환경변수에 설정

## 4. Message Template 생성

> Infobip Portal > Use cases > 2FA > Messages (해당 Application 하위) > Create Message

- [ ] Message Template 설정:
  - `pinType=NUMERIC` -- 숫자만 사용 (D-13)
  - `pinLength=6` -- 6자리 (D-13). `SMS_CODE_LENGTH=6` 상수와 일치
  - `messageText`: `[Grapit] 인증번호 {{pin}} (3분 이내 입력)`
  - `senderId`: 2단계에서 등록한 한국 발신번호
  - `language`: `ko` (한국어)
- [ ] Message ID 복사 -> `INFOBIP_MESSAGE_ID` 환경변수에 설정

## 5. API Key 발급

> Infobip Portal > Developers > API Keys > Create API Key

- [ ] API Key 생성 (권한: 2FA Send PIN, 2FA Verify PIN, 2FA Resend PIN)
- [ ] API Key 값 복사 -> `INFOBIP_API_KEY` 환경변수에 설정
- [ ] API Key를 안전한 곳에 백업 (재표시 불가)

## 6. GCP Secret Manager 업데이트 (D-17)

> TWILIO_* 제거 + INFOBIP_* 추가

```bash
# TWILIO 시크릿 삭제 (더 이상 사용하지 않음)
gcloud secrets delete TWILIO_ACCOUNT_SID --project=grapit-prod --quiet 2>/dev/null || true
gcloud secrets delete TWILIO_AUTH_TOKEN --project=grapit-prod --quiet 2>/dev/null || true
gcloud secrets delete TWILIO_VERIFY_SERVICE_SID --project=grapit-prod --quiet 2>/dev/null || true

# INFOBIP 시크릿 생성
echo -n "<YOUR_INFOBIP_API_KEY>" | gcloud secrets create INFOBIP_API_KEY \
  --project=grapit-prod --data-file=-
echo -n "<YOUR_INFOBIP_BASE_URL>" | gcloud secrets create INFOBIP_BASE_URL \
  --project=grapit-prod --data-file=-
echo -n "<YOUR_INFOBIP_APPLICATION_ID>" | gcloud secrets create INFOBIP_APPLICATION_ID \
  --project=grapit-prod --data-file=-
echo -n "<YOUR_INFOBIP_MESSAGE_ID>" | gcloud secrets create INFOBIP_MESSAGE_ID \
  --project=grapit-prod --data-file=-
```

- [ ] 4개 시크릿 모두 생성 완료 확인: `gcloud secrets list --project=grapit-prod | grep INFOBIP`

## 7. GitHub Actions Secrets (D-17)

> Repository Settings > Secrets and variables > Actions

- [ ] **삭제:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- [ ] **추가:**
  - `INFOBIP_API_KEY` -- 5단계에서 발급한 API Key
  - `INFOBIP_BASE_URL` -- 1단계에서 확인한 Base URL
  - `INFOBIP_APPLICATION_ID` -- 3단계에서 생성한 Application ID
  - `INFOBIP_MESSAGE_ID` -- 4단계에서 생성한 Message ID
- [ ] CI workflow에서 TWILIO 참조가 없는지 확인: `grep -r "TWILIO" .github/workflows/`

## 8. Cloud Run 환경변수 바인딩

> GCP Console > Cloud Run > grapit-api > Edit & Deploy New Revision > Variables & Secrets

- [ ] TWILIO 관련 환경변수/시크릿 바인딩 제거
- [ ] INFOBIP 4종 시크릿 바인딩 추가:

```bash
# Cloud Run 서비스 업데이트 (시크릿을 환경변수로 노출)
gcloud run services update grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --update-secrets=INFOBIP_API_KEY=INFOBIP_API_KEY:latest \
  --update-secrets=INFOBIP_BASE_URL=INFOBIP_BASE_URL:latest \
  --update-secrets=INFOBIP_APPLICATION_ID=INFOBIP_APPLICATION_ID:latest \
  --update-secrets=INFOBIP_MESSAGE_ID=INFOBIP_MESSAGE_ID:latest \
  --remove-env-vars=TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN,TWILIO_VERIFY_SERVICE_SID
```

- [ ] 새 리비전 배포 후 `/health` 엔드포인트 정상 응답 확인

## 9. Staging Smoke Test (D-25)

> 실 발송 스모크 테스트는 staging 환경에서 개발자 본인 번호로 수동 수행

- [ ] Staging 환경에 INFOBIP_* 4종 환경변수 설정 완료
- [ ] 본인 번호로 `POST /api/v1/sms/send-code` 호출
- [ ] SMS 수신 확인 (도달 시간 기록)
- [ ] 받은 인증번호로 `POST /api/v1/sms/verify-code` 호출
- [ ] 검증 성공 응답 확인
- [ ] 잘못된 인증번호로 재시도 -> 적절한 에러 응답 확인
- [ ] 5회 실패 후 PIN 무효화 확인 (Infobip `pinAttempts=5` 동작 검증)
- [ ] 재발송 쿨다운(30초) 동작 확인
- [ ] Sentry에 에러 이벤트가 없는지 확인

## 10. Production 배포

- [ ] Staging smoke test 전체 통과 확인
- [ ] GitHub Actions를 통해 production 배포 트리거
- [ ] 배포 완료 후 Cloud Run 새 리비전이 `serving` 상태인지 확인
- [ ] Cold-start 후 `/health` 엔드포인트 정상 응답 확인
  - INFOBIP_* 누락 시 SmsService 생성자에서 throw -> 부팅 실패로 즉시 감지
- [ ] Sentry alert 5분 모니터링 -- 새로운 에러 이벤트 없는지 확인
- [ ] 본인 번호로 스모크 테스트 1회 수행 (~35원 비용)
  - `POST /api/v1/sms/send-code` -> SMS 수신 -> `POST /api/v1/sms/verify-code` -> 성공
- [ ] Cloud Run 로그에서 `sms.sent`, `sms.verified` 구조화 로그 확인
- [ ] 모든 체크 통과 시 배포 완료 선언

---

**작성일:** 2026-04-16
**관련 Phase:** 10-sms (SMS 인증 실연동)
**참조 Decisions:** D-04, D-06, D-10, D-12, D-13, D-14, D-16, D-17, D-25
