# Infobip SMS v3 배포 운영 체크리스트

Phase 10 SMS 인증 실연동에 필요한 Infobip 콘솔 사전 작업 및 프로덕션 배포 절차.
코드 배포 이전에 1~4단계를 완료해야 한다.

> **2026-04-16 Phase 10.1 업데이트:** Infobip /sms/3/messages v3 전환으로 2FA Application/Message Template 관리 제거. 환경변수 4종 -> 3종 축소 (INFOBIP_API_KEY / INFOBIP_BASE_URL / INFOBIP_SENDER).

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

## 3. 발신자(Sender ID) 확정

> `/sms/3/messages` v3 API는 Application/Message Template 개념이 없다.
> 요청 body의 `from` 필드에 sender를 직접 넣으므로, 포털에서 sender를 한 번 확정해두면 끝이다.

- **Free Trial:** Infobip이 공유 sender(`ServiceSMS` 등)를 강제 사용. `from`에 무엇을 넣든 치환됨. `INFOBIP_SENDER`는 공백 또는 임의값 가능.
- **프로덕션(한국):** KISA 사전등록(2)에서 승인된 숫자형 번호를 그대로 사용. 영문 sender ID는 한국 통신사에서 치환/차단된다.
- **`INFOBIP_SENDER` 환경변수에 이 값 저장.** Infobip Portal에서 해당 Sender가 `Active` 상태여야 발송 가능.

- [ ] Sender ID 값 확정 (Free Trial: 비워두기 또는 `ServiceSMS` / 프로덕션: KISA 등록 번호)
- [ ] `INFOBIP_SENDER` 환경변수에 저장
- [ ] Infobip Portal에서 Sender 상태가 `Active`인지 확인

## 4. API Key 발급

> Infobip Portal > Developers > API Keys > Create API Key

- [ ] API Key 생성 (권한: `sms:send` 필수. `numbers:manage`는 KISA 등록 시에만)
- [ ] API Key 값 복사 -> `INFOBIP_API_KEY` 환경변수에 설정
- [ ] API Key를 안전한 곳에 백업 (재표시 불가)

## 5. GCP Secret Manager 업데이트

> TWILIO_* 제거 + 기존 2FA 전용 시크릿 제거 + INFOBIP_* 3종 추가

```bash
# TWILIO 시크릿 삭제 (더 이상 사용하지 않음)
gcloud secrets delete TWILIO_ACCOUNT_SID --project=grapit-prod --quiet 2>/dev/null || true
gcloud secrets delete TWILIO_AUTH_TOKEN --project=grapit-prod --quiet 2>/dev/null || true
gcloud secrets delete TWILIO_VERIFY_SERVICE_SID --project=grapit-prod --quiet 2>/dev/null || true

# 기존 2FA 전용 시크릿 제거 (v3 전환으로 불필요)
gcloud secrets delete INFOBIP_APPLICATION_ID --project=grapit-prod --quiet 2>/dev/null || true
gcloud secrets delete INFOBIP_MESSAGE_ID --project=grapit-prod --quiet 2>/dev/null || true

# 신 3종
echo -n "<YOUR_INFOBIP_API_KEY>"  | gcloud secrets create INFOBIP_API_KEY  --project=grapit-prod --data-file=-
echo -n "<YOUR_INFOBIP_BASE_URL>" | gcloud secrets create INFOBIP_BASE_URL --project=grapit-prod --data-file=-
echo -n "<YOUR_INFOBIP_SENDER>"   | gcloud secrets create INFOBIP_SENDER   --project=grapit-prod --data-file=-
```

- [ ] 3개 시크릿 모두 생성 완료 확인: `gcloud secrets list --project=grapit-prod | grep INFOBIP`

## 6. GitHub Actions Secrets

> Repository Settings > Secrets and variables > Actions

- [ ] **삭제:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- [ ] **삭제:** `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID` (v3 전환으로 불필요)
- [ ] **추가/갱신:**
  - `INFOBIP_API_KEY` -- 4단계에서 발급한 API Key
  - `INFOBIP_BASE_URL` -- 1단계에서 확인한 Base URL
  - `INFOBIP_SENDER` -- 3단계에서 확정한 Sender ID
- [ ] CI workflow에서 TWILIO 참조가 없는지 확인: `grep -r "TWILIO" .github/workflows/`

## 7. Cloud Run 환경변수 바인딩

> GCP Console > Cloud Run > grapit-api > Edit & Deploy New Revision > Variables & Secrets

- [ ] TWILIO 관련 환경변수/시크릿 바인딩 제거
- [ ] INFOBIP 3종 시크릿 바인딩 추가:

```bash
# Cloud Run 서비스 업데이트 (시크릿을 환경변수로 노출)
gcloud run services update grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --update-secrets=INFOBIP_API_KEY=INFOBIP_API_KEY:latest \
  --update-secrets=INFOBIP_BASE_URL=INFOBIP_BASE_URL:latest \
  --update-secrets=INFOBIP_SENDER=INFOBIP_SENDER:latest \
  --remove-env-vars=INFOBIP_APPLICATION_ID,INFOBIP_MESSAGE_ID
```

- [ ] 새 리비전 배포 후 `/health` 엔드포인트 정상 응답 확인

## 8. Staging Smoke Test

> 실 발송 스모크 테스트는 staging 환경에서 개발자 본인 번호로 수동 수행.
> CI 자동 테스트가 mock 모드로 기능 검증을 완료하므로, 실 SMS smoke는 배포 전 체크리스트 항목.

staging 환경이 가용해지면 아래 항목을 수행:

- [ ] Staging 환경에 INFOBIP_* 3종 환경변수 설정 완료
- [ ] 본인 번호로 `POST /api/v1/sms/send-code` 호출
- [ ] SMS 수신 확인 (도달 시간 기록)
- [ ] 받은 인증번호로 `POST /api/v1/sms/verify-code` 호출
- [ ] 검증 성공 응답 확인
- [ ] 잘못된 인증번호로 재시도 -> 적절한 에러 응답 확인
- [ ] 5회 실패 후 OTP 무효화 확인 (Valkey attempts counter 동작 검증)

  cURL 예시 (`/sms/3/messages` v3 기반):

  ```bash
  curl -X POST "https://{baseUrl}/sms/3/messages" \
    -H "Authorization: App {apiKey}" \
    -H "Content-Type: application/json" \
    -d '{
      "messages": [
        {
          "from": "<INFOBIP_SENDER>",
          "destinations": [{ "to": "821012345678" }],
          "text": "[Grapit] 인증번호 123456 (3분 이내 입력)"
        }
      ]
    }'
  ```

- [ ] 재발송 쿨다운(30초) 동작 확인
- [ ] Sentry에 에러 이벤트가 없는지 확인

## 9. Pre-Deploy Mandatory Checks (배포 전)

> 배포 전 아래 항목이 모두 완료되지 않으면 production deploy를 진행하지 않는다.
> 실 SMS 수신 확인이 반드시 포함되어야 한다.

- [ ] Infobip portal에서 Sender ID 상태 "Active" 확인 (KISA 등록 완료)
- [ ] KISA 한국 발신번호 사전등록 상태 "Approved" 확인 (Infobip portal > Number Management)
- [ ] 실 SMS 발송 smoke: 개발자 본인 번호로 send-code > 수신 확인 > verify-code > verified: true
- [ ] Cloud Run INFOBIP_* **3종** Secret Manager 바인딩 확인
- [ ] INFOBIP_APPLICATION_ID, INFOBIP_MESSAGE_ID가 Secret Manager/Cloud Run 양쪽에서 제거되었는지 확인
- [ ] TWILIO_* Secret Manager에서 제거 확인

## 10. Production 배포

- [ ] 9번 Pre-Deploy Mandatory Checks 전체 완료 확인
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
**최종 수정:** 2026-04-17 (Phase 10.1 -- SMS API v3 전환, 2FA Application/Message Template 섹션 제거, 환경변수 3종 체계)
**관련 Phase:** 10-sms (SMS 인증 실연동), 10.1-sms-api-v3-rewrite (SMS API v3 전환)
**참조 Decisions:** D-04, D-06, D-14, D-16, D-17, Phase 10.1 CONTEXT.md Decisions (환경변수 축소, SMS API 선택)
