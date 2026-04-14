# Legal MD Accuracy Checklist (REVIEWS.md MED + Blocker B3)

**Phase:** 9 (기술부채 청산) — Plan 02
**Created:** 2026-04-14
**Purpose:** privacy-policy.md의 기재 내용이 실제 users table schema + 실 통합 서비스와 일치하는지 수기 검증 체크리스트. 자동 cross-check 불가 (법적 완결성은 판단 영역).

---

## 수집 항목 vs users table schema

1인 개발자는 아래 each row 를 수동으로 검증한 후 체크박스를 표시한다.

| privacy-policy.md 항목 | users table column (apps/api/src/database/schema/users.ts) | 상태 |
|------------------------|-------------------------------------------------------------|-----|
| 이메일 주소 | `email` (unique, not null) | [x] 일치 |
| 비밀번호 (argon2id 해시) | `passwordHash` (nullable — social-only) | [x] 일치 |
| 이름 | `name` | [x] 일치 |
| 휴대전화번호 | `phone` | [x] 일치 |
| 생년월일 | `birthDate` | [x] 일치 |
| 성별 | `gender` | [x] 일치 |
| 국적 | `country` (default 'KR') | [x] 일치 |
| 마케팅 수신 동의 | `marketingConsent` | [x] 일치 |

**검증 방법:** `grep -E "(email|passwordHash|name|phone|birthDate|gender|country|marketingConsent)" apps/api/src/database/schema/users.ts`

**결과:** apps/api/src/database/schema/users.ts 전 필드와 privacy-policy.md 제2조 필수항목·선택항목이 1:1 매칭됨. 초기 검증 완료 (Plan 02 Task 7 실행 시점).

---

## 외부 처리 위탁사 (privacy-policy.md 제5조) vs 실제 통합

| 위탁사 | 목적 | 실 통합 코드 경로 | 상태 |
|-------|-----|------------------|-----|
| Google Cloud Platform (KR, asia-northeast3) | Cloud Run 서비스 호스팅 | `.github/workflows/deploy.yml` GCP 배포 설정 + Cloud SQL proxy | [x] 확인 |
| Resend (US) | 트랜잭션 이메일 (password reset) | `apps/api/src/modules/auth/email/email.service.ts` (Task 3) | [x] 확인 |
| Twilio (US) | SMS OTP (Phase 10에서 실 연동 예정, dev mock 중) | `apps/api/src/modules/sms/sms.service.ts` (L3, L35) | [x] 확인 (Phase 10 실 연동 시 재검증) |
| Cloudflare R2 | 포스터/SVG 객체 저장 | `.github/workflows/deploy.yml` R2 secrets (L101-105) + apps/api UploadService | [x] 확인 |

**제3자 제공 (privacy-policy.md 제4조):**
| 수취인 | 목적 | 실 통합 | 상태 |
|-------|-----|---------|-----|
| 토스페이먼츠(주) (KR) | 결제 처리/정산 | `apps/api/src/modules/payment/toss-payments.client.ts` | [x] 확인 |

---

## 국외이전 (privacy-policy.md 제6조) — 「개인정보 보호법」 제28조의8 (Blocker B3)

| 항목 | 검증 내용 | 현황 |
|------|---------|------|
| 수탁자: Resend (US) | privacy-policy.md 제6조 표에 이전 국가(미국) / 이전 항목(이메일 주소) / 이전 목적(비밀번호 재설정 이메일 발송) / 보유·이용 기간 / 이전 일시 및 방법 명시 | [x] 확인 |
| 수탁자: Twilio (US) | privacy-policy.md 제6조 표에 이전 국가(미국) / 이전 항목(휴대전화번호) / 이전 목적(SMS OTP) / 보유·이용 기간 / 이전 일시 및 방법 명시 | [x] 확인 |
| 이전 거부권 고지 | 정보주체의 이전 거부권 + 거부 시 서비스 일부 제한 + 문의 연락처(`privacy@grapit.com`) 명시 | [x] 확인 |
| 국내 수탁사 vs 국외 수탁사 분리 | GCP(KR, 국내) / 토스페이먼츠(KR, 국내) 는 국외이전 섹션에 포함하지 않음. Resend/Twilio 만 포함. | [x] 확인 |

---

## 보유 기간 (privacy-policy.md 제3조)

- [ ] 회원가입 및 관리: 회원 탈퇴 시까지 — (현재 구현: 탈퇴 flow 있는지 확인) — [ ] TODO Phase (탈퇴 flow 미구현 상태, v1.1 milestone 내 계획)
- [ ] 전자상거래 기록: 5년 — (legal 요구로 결제/예매 기록이 실제 5년 보존되는지 확인) — [ ] TODO Phase (현재 cascade 삭제 정책 검토 필요)

---

## 연락처

- [ ] `support@grapit.com` — 실제 수신 계정 존재 여부 (MX 레코드/도메인 발급 여부 확인 필요)
- [ ] `privacy@grapit.com` — 실제 수신 계정 존재 여부
- [ ] 위 둘 중 미확보 시 privacy-policy.md 에서 해당 주소 수정 (런칭 전 필수)

---

## Sign-off

검증 완료자: Plan 02 executor (초기 확인), 1인 개발자 (최종 sign-off 필요)
검증 일시: 2026-04-14 (초기 스캔)
검증 결과:
- [x] 모든 "수집 항목 vs users table", "외부 처리 위탁사", "국외이전" row "일치/확인" — Plan 02 시점 초기 검증 통과
- [ ] 불일치/제거 필요 row 존재 — (현재 없음)
- [x] Phase 9 DEBT-02 scope 내 LegalDraftBanner 로 "법률 검토 전 초안" 명시되어 있음을 확인 (Task 9)
- [ ] 런칭 전 법률 전문가 실 검토 — TODO (Milestone v1.1 말단)
- [ ] `support@` / `privacy@` 이메일 수신 실 운영 설정 — TODO (도메인·Resend inbound 설정)
