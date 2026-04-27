# Phase 15: Resend heygrabit.com cutover — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 15-resend-heygrabit-com-cutover-transactional-email-secret-mana
**Areas discussed:** Phase 범위 경계, DNS/DMARC 정책, 검증 기준 + silent failure 대응, Rollback + 실행 순서

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 범위 경계 | Resend만 vs D-15 3건(Resend+Infobip+legal mailbox) | ✓ |
| DNS/DMARC 정책 | SPF/DKIM/DMARC 등록 방식, DMARC policy, rua 수신처 | ✓ |
| 검증 기준 + silent failure 대응 | UAT 수신 검증 범위, auth.service.ts silent failure 처리 | ✓ |
| Rollback + 실행 순서 | 실행 순서, 재배포 방식, Rollback 범위, Audit trail | ✓ |

모든 gray area 선택됨 (4/4).

---

## Phase 범위 경계

### Scope 결정

| Option | Description | Selected |
|--------|-------------|----------|
| Resend only (권장) | Resend 도메인 verification + DNS + Secret + 재배포 + UAT. Infobip/legal mailbox는 별도 phase/운영 항목 | ✓ |
| Resend + legal mailbox | 두 개 모두 email 인프라라 legal@heygrabit.com MX/mailbox를 같이 처리 | |
| D-15 3건 전부 | Resend + Infobip `Grabit` KISA + legal mailbox 한꺼번에 | |

**User's choice:** Resend only
**Notes:** Phase 명칭과 가장 일치, 영향 반경이 한 곳에 집중, UAT 시간/복잡도 최소

### grapit.com Resend verification 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 건드리지 않음 | grapit.com 그대로 두고 heygrabit.com만 추가 | |
| grapit.com Resend에서 제거 | heygrabit.com verified 후 구 도메인 명시 제거 | ✓ |
| 우선 둘 다 verified (이중 상태) | Transition 기간 동안 둘 다 유지 | |

**User's choice:** grapit.com Resend에서 제거
**Notes:** 보안 + 실수 방지. Verified 후 수행 → 실질적으로 UAT 성공 이후 제거 순서

---

## DNS/DMARC 정책

### SPF 레코드

| Option | Description | Selected |
|--------|-------------|----------|
| Resend만 include, ~all (권장) | `v=spf1 include:_spf.resend.com ~all` | ✓ |
| Resend + Google include, ~all | legal mailbox Google Workspace 대비해서 미리 include 추가 | |
| Resend include, -all (엄격) | hard-fail — spoofing 방어 최대 | |

**User's choice:** Resend만 include, ~all

### DMARC policy

| Option | Description | Selected |
|--------|-------------|----------|
| p=none + rua 수집 (권장) | `v=DMARC1; p=none; rua=mailto:...` — 관찰 모드로 시작 | ✓ |
| p=none + rua 없이 | 정책 선언만, report 수집 생략 | |
| p=quarantine 부터 | 처음부터 실패 메일을 spam으로 | |

**User's choice:** p=none + rua 수집

### DKIM selector

| Option | Description | Selected |
|--------|-------------|----------|
| Resend 기본 selector (권장) | `resend._domainkey.heygrabit.com` CNAME | ✓ |
| Resend 개별 selector + 백업 1개 | 미래 rotation 대비 예비 selector | |

**User's choice:** Resend 기본 selector

### DMARC rua 수신처

| Option | Description | Selected |
|--------|-------------|----------|
| 개인 Gmail (권장) | `rua=mailto:sangwopark19icons@gmail.com` | ✓ |
| rua 없이 policy만 | report 수집 생략 | |
| 3번째 서비스 (postmark/dmarcdigests 등) | 전용 DMARC report 도구 | |

**User's choice:** 개인 Gmail
**Notes:** 향후 legal@heygrabit.com 개설 시 재할당

---

## 검증 기준 + silent failure 대응

### UAT 수신 검증 범위

| Option | Description | Selected |
|--------|-------------|----------|
| Gmail + Naver + Daum 한국 3사 (권장) | 국제 + 국내 양대 provider 확인 | ✓ |
| Gmail만 확인 | 빠르고 최소 | |
| Gmail + Naver 2사 | 중간 검증 | |

**User's choice:** Gmail + Naver + Daum 한국 3사

### Silent Resend failure 대응

| Option | Description | Selected |
|--------|-------------|----------|
| Sentry captureException 추가 (권장) | email.service.ts L78에 captureException 5~10줄 추가 | ✓ |
| auth.service.ts 도 return 값 체크 | 4xx/5xx 클라이언트 노출 | |
| 이번 phase 범위 제외 | 별도 phase/quick으로 이관 | |

**User's choice:** Sentry captureException 추가
**Notes:** auth.service.ts fire-and-forget 은 enumeration 방어 세맨틱 유지

### 운영 검증 기준

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud Run log 24h empty + Resend dashboard (권장) | gcloud logging read "Resend send failed" 24h empty + Resend Sent/Delivered | ✓ |
| Cloud Run log 1h empty 만 | 1시간 관찰로 완료 | |
| DMARC aggregate report 수집 포함 | 1주 후 pass 95%+ 확인 | |

**User's choice:** Cloud Run log 24h empty + Resend dashboard

---

## Rollback + 실행 순서

### 실행 순서

| Option | Description | Selected |
|--------|-------------|----------|
| DNS 먼저 → verified 확인 → Secret 교체 → 재배포 (권장) | 안전한 순차 실행 | ✓ |
| 병행: DNS 추가하면서 Secret 준비 | propagation 시간 동안 Secret 신규 version 준비 | |
| Secret부터 교체 후 DNS | 거의 권장하지 않음 — 422 폭주 보장 | |

**User's choice:** DNS 먼저 → verified 확인 → Secret 교체 → 재배포

### 재배포 방식

| Option | Description | Selected |
|--------|-------------|----------|
| `gcloud run services update` 즉시 (권장) | `--update-secrets RESEND_FROM_EMAIL=resend-from-email:latest` | ✓ |
| empty commit + `gh workflow run deploy.yml` | CI 전체 pipeline 경유 | |

**User's choice:** `gcloud run services update` 즉시

### Rollback 범위

| Option | Description | Selected |
|--------|-------------|----------|
| Secret version pin만 (권장) | 이전 version 유지 + pin으로 즉시 복귀 | ✓ |
| Secret version + DNS revert 권장 문서 | 완전 cutover 취소 playbook | |
| Rollback playbook 없이 forward-only | debug 세션으로만 대응 | |

**User's choice:** Secret version pin만

### Audit trail

| Option | Description | Selected |
|--------|-------------|----------|
| 15-HUMAN-UAT.md에 축적 (권장) | Resend status, DNS 등록 시간, Secret version, Cloud Run revision, UAT 수신 시각 전부 기록 | ✓ |
| Commit message만 | empty commit 요약만 | |

**User's choice:** 15-HUMAN-UAT.md에 축적

---

## Claude's Discretion

- Plan 구성 wave 수 및 task 분해
- Sentry captureException 의 정확한 tags/contexts 스키마
- `dig` / `gcloud` 명령어 정확한 flag 세트
- HUMAN-UAT 양식 세부 (screenshot 링크 vs 텍스트 로그)

## Deferred Ideas

- Infobip SMS sender ID `Grabit` KISA 등록 — 별도 운영 항목
- `legal@heygrabit.com` mailbox 개설 — Phase 16 (Legal pages) 전후 재검토
- DMARC `p=quarantine` 승격 — 1~2주 후 별도 quick
- `grapit.com` DNS 처리 — 도메인 소유권 확인 후 결정 (본 phase 범위 외)
- auth.service.ts return-value aware error surfacing — 향후 observability phase
