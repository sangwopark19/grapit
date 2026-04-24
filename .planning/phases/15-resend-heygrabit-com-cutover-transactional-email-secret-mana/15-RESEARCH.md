# Phase 15: Resend heygrabit.com cutover — Research

**Researched:** 2026-04-24
**Domain:** Operational cutover (DNS + Resend + Secret Manager + Cloud Run redeploy + observability)
**Confidence:** HIGH (reusable assets), MEDIUM (external DNS propagation + 3사 deliverability)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope**
- **D-01:** Resend only — Infobip / legal mailbox 는 별도 운영 항목.

**Old domain handling**
- **D-02:** `heygrabit.com` Verified 확인 후 Resend 대시보드에서 구 `grapit.com` 도메인 제거. UAT 수신 확인 이후.

**DNS (후이즈)**
- **D-03:** SPF TXT = `v=spf1 include:_spf.resend.com ~all` (soft-fail). **⚠ 실제 값은 Resend 대시보드가 발급 — 이 값과 상이할 수 있음. 리스크 섹션 R-01 참조.**
- **D-04:** DMARC TXT = `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com` (관찰 모드). 1~2주 후 `p=quarantine` 승격은 별도 phase.
- **D-05:** DKIM = Resend 기본 selector CNAME `resend._domainkey.heygrabit.com` (값은 Resend가 발급). **⚠ 현재 Resend는 DKIM을 TXT 레코드로 발급 — 리스크 섹션 R-01 참조.**
- **D-06:** DNS propagation 확인 = `dig +short`. Resend 콘솔 Verified 가 primary signal.

**Secret Manager**
- **D-07:** `gcloud secrets versions add resend-from-email --data-file=<(printf 'no-reply@heygrabit.com')` 로 신규 version 추가. 구 version **유지**.
- **D-08:** Secret 교체는 Resend Verified 확인 **이후에만**.

**Redeploy**
- **D-09:** `gcloud run services update grabit-api --region=asia-northeast3 --update-secrets RESEND_FROM_EMAIL=resend-from-email:latest`. deploy.yml CI 재실행 없음.
- **D-10:** 재배포 후 ≥1분 wait → `gcloud run services describe` 로 신규 revision 100% traffic 확인.

**Observability**
- **D-11:** `email.service.ts` L77-82에 `Sentry.captureException(...)` 추가. logger.error 유지. 5~10 line. Plan 1개.
- **D-12:** `auth.service.ts:250` fire-and-forget **수정 금지** — enumeration 방어 세맨틱 유지.

**Verification**
- **D-13:** `gcloud logging read '... "Resend send failed" ...' --freshness=24h` empty **AND** Resend 대시보드 Sent/Delivered stat 기록 — 두 조건 모두 만족.
- **D-14:** UAT = Gmail + Naver + Daum(또는 Kakao) 3사 inbox 수신 (spam 폴더 아님).

**Rollback**
- **D-15:** Secret Manager version pinning 만. `gcloud run services update ... --update-secrets RESEND_FROM_EMAIL=resend-from-email:<prev_version>` 30초 내 복귀. DNS revert 비포함.

**Audit trail**
- **D-16:** `15-HUMAN-UAT.md` 축적. Phase 13/14 HUMAN-UAT 패턴 계승.

### Claude's Discretion

- Plan 구성 wave 수, plan 별 task 분해 기준
- `Sentry.captureException` 의 정확한 tags/contexts 스키마 (본 리서치의 §2.2에 권장안 제시)
- `dig` / `gcloud` 명령어 정확한 flag 세트 (본 리서치의 §3 참조)
- HUMAN-UAT 양식 세부 (Phase 14 SC-번호 기반 템플릿 승계 권장 — §2.3)

### Deferred Ideas (OUT OF SCOPE)

- **Infobip SMS sender ID `Grabit` KISA 등록** — KISA 심사 블로커로 별도 운영 항목
- **`legal@heygrabit.com` mailbox 개설** — MX 설계 + provider 선택 필요, Phase 16 전후 재검토
- **DMARC `p=quarantine` 승격** — aggregate report 1~2주 관찰 후 별도 quick/phase
- **`grapit.com` DNS / 이메일 도메인 처리** — 소유권 불확실, 본 phase 범위 밖 (Resend 대시보드 제거만 수행)
- **auth.service.ts return-value aware error surfacing** — enumeration 방어 유지 이유로 금지, 향후 admin dashboard 에서 별도 구조로
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 15는 ROADMAP.md에 매핑된 REQ-ID 가 없는 **운영 cutover phase** 로, Phase 13 HANDOFF §4 🔵 (L231-236) 의 이관 항목과 `.planning/debug/password-reset-email-not-delivered-prod.md` 의 Resolution (L88-93) 에서 도출된 작업을 실행한다.

| Pseudo-Req | Behavior | Research Support |
|------------|----------|------------------|
| **CUTOVER-01** | `heygrabit.com` 이 Resend 대시보드에서 Verified 상태 | §1.1 Resend DNS 요구사항 |
| **CUTOVER-02** | Secret Manager `resend-from-email` 값이 `no-reply@heygrabit.com` 로 교체됨 | §3.1 gcloud secrets versions add |
| **CUTOVER-03** | Cloud Run `grabit-api` 신규 revision 이 100% traffic, 신규 Secret version 주입됨 | §3.2 :latest revision semantics |
| **CUTOVER-04** | `email.service.ts` Resend 실패 시 Sentry event 발생 (silent failure 관측성) | §2.2 Sentry NestJS captureException 패턴 |
| **CUTOVER-05** | 3사 (Gmail/Naver/Daum) inbox 수신 확인 (spam 폴더 아님) | §1.3 deliverability 고려사항 |
| **CUTOVER-06** | Observability 코드 회귀 없음 (기존 email.service.spec 전부 green + Sentry 호출 어설션 추가) | §2.1 기존 spec 구조 + §2.2 mock 패턴 |
</phase_requirements>

## Summary

Phase 15는 **운영 cutover phase** 로, 코드 변경은 `email.service.ts` 단일 파일 5~10 라인 (Sentry.captureException 삽입) 에 국한된다. 나머지는 (1) Resend 콘솔에서 heygrabit.com 추가 → 발급된 DNS 값을 후이즈에 등록 → Verified 전환, (2) GCP Secret Manager 신규 version 추가 + Cloud Run `grabit-api` `--update-secrets` 로 새 revision 기동, (3) 3사 실기기 UAT 수신 확인 순으로 진행된다.

**핵심 발견 3 가지** (Planner가 주의할 지점):

1. **DNS 레코드 값은 Resend 대시보드가 발급하는 것이 진실의 원천** — CONTEXT D-03 의 `include:_spf.resend.com` 과 D-05 의 CNAME 가정은 구 Resend 설정 기반일 수 있다. 현재 Resend는 내부적으로 AWS SES 를 사용하며, 대시보드는 SPF 용 MX + TXT (`include:amazonses.com`), DKIM TXT (CNAME 아님) 를 `send` 서브도메인에 발급한다 [VERIFIED: Context7 /websites/resend]. Plan 은 **D-03/D-05 의 리터럴 값을 하드코딩하지 말고 "Resend 대시보드가 발급하는 값을 후이즈에 그대로 등록" 지시** 로 쓸 것.

2. **Sentry는 이미 완전히 초기화됨** — `apps/api/src/instrument.ts`, `app.module.ts`의 `SentryModule.forRoot()`, `sms.service.ts` 의 `Sentry.withScope + captureException` 호출 선례 모두 존재 [VERIFIED: grep apps/api]. **D-11 의 Sentry 통합에 사전 준비 phase 불필요** — 바로 호출 추가 가능. 연구 블로커 없음.

3. **DMARC `rua=mailto:sangwopark19icons@gmail.com` 은 RFC 7489 §7.1 external destination verification 대상** — 이론적으로 Gmail 측에서 `heygrabit.com._report._dmarc.gmail.com` TXT 레코드를 요구하지만, **Gmail 은 유명 ESP 로서 이 verification 을 면제하는 구현 패턴이 일반적** [CITED: dmarcian, powerdmarc 공개 가이드]. 실측에서 문제가 없을 가능성이 높으나, 1~2 주 동안 aggregate report 가 실제 도착하지 않으면 D-04 의 `rua` 전략 자체가 무의미해질 수 있다 — 이는 별도 관측 phase 로 deferred.

**Primary recommendation:** 본 phase 를 2 wave 로 분해한다. **Wave 1 (코드) = Sentry.captureException 추가 + spec 업데이트 (자동화 가능)**, **Wave 2 (운영 cutover) = Resend 도메인 추가 → 후이즈 DNS 등록 → Verified 대기 → Secret Manager version 추가 → Cloud Run redeploy → UAT (수동/관측 기반)**. Wave 1 이 main 에 머지되면 deploy.yml 이 자동 재배포하며 Sentry 통합 revision 이 배포된다 — 이것이 Wave 2 의 Secret rotation 과 **서로 독립적 revision** 으로 진행되는지, 한 revision 에 합쳐지는지는 Plan 세분화에서 결정 (§3.3 권장).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transactional email 발송 | Backend (NestJS EmailService) | External (Resend API) | API 경계의 service-level call. 발송 자체는 Resend 가 처리하지만, from 주소/발송 경로/실패 관측은 EmailService 가 책임. |
| DNS 소유권/검증 | External (후이즈 DNS + Resend 콘솔) | — | 클라우드/코드 계층 밖. 운영자 수동 액션. |
| Secret rotation | Infrastructure (GCP Secret Manager) | Backend (Cloud Run env injection) | Secret 값 자체는 IaC 영역. Cloud Run 은 runtime 에 injection 만 수행. |
| Container revision mgmt | Infrastructure (Cloud Run) | CI/CD (deploy.yml 영향 없음, 본 phase 는 `gcloud run services update` 직접 호출) | revision immutable — 새 revision 은 전체 env snapshot 을 고정 (§3.2). |
| Silent failure 관측성 | Backend (EmailService + @sentry/nestjs) | External (Sentry dashboard) | `return {success:false}` 를 Sentry event 로 surface 하는 것은 코드 레이어 책임. Sentry dashboard 는 surface 된 event 를 수집만. |
| 3사 deliverability | External (수신자 ESP: Gmail/Naver/Daum) | — | Code/infra 가 제어할 수 없는 외부 변수. SPF/DKIM alignment 만이 간접적 영향 수단. |

## Standard Stack

모든 기술 선택은 `CLAUDE.md` Tech Stack에 이미 locked — 본 phase 에서 신규 기술 도입 없음.

### Used (기존 설치 + 본 phase 에서 호출만 추가)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/nestjs` | ^10 | Error tracking + captureException | 이미 instrument.ts / app.module.ts / sms.service.ts 등에서 사용 중 [VERIFIED: apps/api/package.json L32] |
| `resend` | ^6.11.0 | Email SDK | email.service.ts 기본 의존성 [VERIFIED: apps/api/package.json L50] |
| `vitest` | ^3.2.0 | Test runner | email.service.spec.ts 기본 test framework [VERIFIED: apps/api/package.json L78] |

### New — 없음

본 phase는 신규 라이브러리를 도입하지 않는다.

### Alternatives Considered — N/A

기술 스택은 모두 CLAUDE.md lock 상태. Discretion 없음.

## Architecture Patterns

### System Flow Diagram

```
[User /auth/forgot-password]
         |
         v
  grabit-web (Next.js)
         |
         v (POST /api/v1/auth/password-reset-request)
  api.heygrabit.com (Global HTTPS LB → grabit-api-neg)
         |
         v
  Cloud Run grabit-api (new revision with RESEND_FROM_EMAIL=no-reply@heygrabit.com)
         |
         v (ConfigService.get('RESEND_FROM_EMAIL') → this.from)
  EmailService.sendPasswordResetEmail()
         |
         +-- [DEV] logger.log → return {success:true}
         |
         +-- [PROD] resend.emails.send({from, to, subject, react})
                 |
                 +-- {data, error:null} → return {success:true, id}
                 |          |
                 |          v
                 |    Resend API (verified heygrabit.com)
                 |          |
                 |          v (SPF/DKIM signed)
                 |    Recipient ESP (Gmail/Naver/Daum)
                 |          |
                 |          v
                 |    Inbox (not spam)
                 |
                 +-- {data:null, error} → logger.error + **Sentry.captureException(err)** [D-11 new]
                            |                            \
                            |                             \-- Sentry grabit-api project Issues
                            v
                   return {success:false, error}
                            |
                            v
                   auth.service.ts:250 await (결과 무시, enumeration 방어)
```

### Pattern 1: Silent failure remediation via Sentry.captureException

**What:** Resend 가 `{data: null, error: {message}}` 를 반환할 때 코드는 `{success:false}` 로 silent return 하고 auth.service.ts 는 return 값을 무시한다. 유저 UX 는 성공/실패 구분 없음 (enumeration 방어). 운영자 관측 수단이 logger.error 뿐이면 Cloud Logging 쿼리 없이는 실패를 알 수 없다 — Sentry 가 alert/dashboard layer 를 제공한다.

**When to use:** Fire-and-forget server-side 작업 중 유저 UX 상 에러 surface 가 금지된 경우.

**Example (권장 구현):**
```typescript
// apps/api/src/modules/auth/email/email.service.ts
import * as Sentry from '@sentry/nestjs';
// ... existing code ...

if (error) {
  this.logger.error(`Resend send failed for ${to}: ${error.message}`);
  // [Phase 15 D-11] Surface to Sentry for observability — silent failure 방어
  Sentry.withScope((scope) => {
    scope.setTag('component', 'email-service');
    scope.setTag('provider', 'resend');
    scope.setLevel('error');
    scope.setContext('email', {
      from: this.from,
      // to 는 PII — 전체 주소 대신 도메인만 (또는 hash) 권장.
      // sms.service.ts 의 country-tag 관행 참고.
      toDomain: to.split('@')[1] ?? 'unknown',
    });
    Sentry.captureException(new Error(`Resend send failed: ${error.message}`));
  });
  return { success: false, error: error.message };
}
```

**Why `withScope` over `Sentry.captureException(err, {tags, contexts})`**: `@sentry/nestjs` v10 공식 문서가 `withScope` 패턴을 권장한다 [CITED: docs.sentry.io/platforms/javascript/guides/nestjs/enriching-events/scopes/]. 두 번째 인자 options-object 방식은 SDK 런타임에서 지원되지만 문서화된 권장 경로가 아니며, 기존 `sms.service.ts:321-329`, `sms.service.ts:455-459` 도 이미 `withScope` 패턴을 사용한다 [VERIFIED: apps/api/src/modules/sms/sms.service.ts].

### Pattern 2: Cloud Run `--update-secrets` revision semantics

**What:** `gcloud run services update --update-secrets` 는 Cloud Run 에 "신규 revision 을 만들어라, env `RESEND_FROM_EMAIL` 을 Secret Manager `resend-from-email:latest` 에 바인딩하라" 는 명령이다.

**Semantics (critical):**
- `:latest` 는 **새 revision 이 시작될 때 해석** 되어 version 번호로 resolve 된다.
- Resolve 된 version 은 해당 revision 의 **lifetime 동안 변하지 않는다** — Secret Manager 에서 또 다른 new version 이 추가되어도 기존 revision 은 영향받지 않는다 [CITED: docs.cloud.google.com/run/docs/configuring/services/secrets, Medium guillaume blaquiere "Cloud Run hot reload"].
- 즉 rollback 은 "이전 version 을 명시적으로 pin 해서 다시 `--update-secrets`" 로만 가능 (D-15 playbook). 기존 revision 을 재시작한다고 이전 값으로 돌아가지 않는다.

**When to use:** 본 phase Wave 2 의 secret rotation 절차.

**Command reference (verified syntax):**
```bash
# (1) 신규 version 추가 — process substitution 은 bash 전용, 대안 stdin 권장
printf 'no-reply@heygrabit.com' | gcloud secrets versions add resend-from-email \
    --data-file=- --project=grapit-491806

# (2) 신규 revision 기동 + secret 바인딩
gcloud run services update grabit-api \
    --region=asia-northeast3 \
    --project=grapit-491806 \
    --update-secrets RESEND_FROM_EMAIL=resend-from-email:latest

# (3) 새 revision 이 100% traffic 받는지 확인
gcloud run services describe grabit-api \
    --region=asia-northeast3 \
    --project=grapit-491806 \
    --format='value(status.traffic[0].revisionName,status.traffic[0].percent)'
```

**⚠ Process substitution 주의:** CONTEXT D-07 은 `--data-file=<(printf '...')` 를 제안하는데, 이는 bash 전용 문법이고 zsh 에서도 동작하지만 **`sh` 또는 일부 CI 환경 (GitHub Actions shell: sh)** 에서는 실패한다. 위 stdin (`printf ... | ... --data-file=-`) 패턴이 shell-portable 이다. Planner 결정사항.

### Pattern 3: HUMAN-UAT 파일 구조 계승 (Phase 14 템플릿)

Phase 14 `14-HUMAN-UAT.md` [VERIFIED: .planning/phases/14-.../14-HUMAN-UAT.md] 구조가 본 phase 에 잘 맞는다:
- Title + Created + Goal 헤더
- Pre-conditions 체크박스 (본 phase 는 "Plan 01 merged", "DNS 5분 이내 propagated" 등)
- SC-01, SC-02 ... 시나리오 번호 (본 phase 는 각 3사 inbox 수신 시나리오 × Sentry 검증 × Rollback drill 등)
- 각 SC 마다 Steps + Expected + 체크리스트 + 실패 대응 서술
- 운영 관측 창 (D-17 72h window 처럼) — 본 phase 는 "Verified 전환 시각", "Secret version 번호", "revision ID", "UAT 수신 시각" 기록
- Sign-off 섹션

### Anti-Patterns to Avoid

- **AP-01: `email.service.ts` 에 try/catch 래퍼 추가 후 Sentry 호출** — email.service.ts L68-69 주석 (`Resend returns { data, error } — it does NOT throw`) 이 명시적으로 금지한다. `error` 브랜치만 검사하라.
- **AP-02: `auth.service.ts:250` 를 `const result = await ...; if (!result.success) throw`** — D-12 에 의해 금지. enumeration 방어 세맨틱 파괴.
- **AP-03: Secret Manager 구 version 즉시 삭제** — D-07, D-15 에 의해 금지. Rollback 창 유지 목적으로 version 보존.
- **AP-04: DNS 레코드를 Resend 콘솔이 표시하는 값과 다르게 등록 (예: CONTEXT D-05 의 CNAME 가정 고수)** — Resend 는 DKIM 을 TXT 로 발급하므로, 대시보드가 실제 발급하는 record type 을 그대로 사용.
- **AP-05: UAT 수신 확인 전에 Resend 구 `grapit.com` 도메인 제거** — D-02 에 의해 금지. UAT 통과 **이후** 에 제거.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resend retry / idempotency | 커스텀 retry loop | Resend SDK 기본 동작 + Sentry alert 기반 수동 재실행 | password-reset 은 1 회성 발송, 사용자가 "재전송" 버튼을 누르는 게 자연스러운 retry. Code retry 는 enumeration 오라클 위험 증가. |
| Sentry PII masking | 수동 regex replace | `scope.setContext({ toDomain: to.split('@')[1] })` 로 도메인만 기록 | 이미 `sms.service.ts` 가 동일 전략 (country tag 만 기록, 전화번호 full 비기록) 사용. |
| Cloud Run revision rollback 자동화 | `gcloud run services update-traffic --to-revisions` 래퍼 script | `gcloud run services update --update-secrets RESEND_FROM_EMAIL=resend-from-email:<prev_version>` 직접 실행 (D-15) | Phase 15 는 traffic 분산 rollback 이 아니라 secret version rollback — "secret 값만 되돌리고 새 revision 을 만든다" 가 정확한 semantics. |
| DNS propagation 폴링 자동화 | 셸 script 로 `dig` 루프 | Resend 대시보드 Verified 상태를 primary signal 로 사용 + 필요 시 `dig +short` 수동 확인 | Verified 는 Resend 가 내부 SPF/DKIM/DMARC 검증을 통과했음을 의미한다 (단순 DNS 존재 여부보다 강한 조건). |

**Key insight:** 본 phase 는 **외부 상태 전환 (DNS, Resend Verified, Secret Manager)** 이 code-controlled 가 아니므로 "자동화 부족" 을 "결함" 으로 오인하지 말 것. 수동 run-through + 로그 기록이 올바른 모델.

## Runtime State Inventory

Phase 15 는 rename/refactor 가 아니지만 **Secret 값 교체** + **외부 서비스 상태 전환** 을 수반하므로 각 category 를 명시적으로 답변한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 없음 — user 의 password reset token 은 JWT (stateless), DB 저장 없음 [VERIFIED: auth.service.ts L241-244] | 없음 |
| Live service config | (1) Resend 대시보드 도메인 목록 (`grapit.com` 등록 상태, `heygrabit.com` 미등록 상태) [VERIFIED: HANDOFF L172]. (2) Cloud Run `grabit-api` revision 의 env RESEND_FROM_EMAIL = `no-reply@grapit.com` [VERIFIED: HANDOFF + debug doc L45, 59-60] | (1) Resend 콘솔에서 heygrabit.com 추가 → 구 grapit.com 제거. (2) 신규 revision 기동으로 env 값 전환. |
| OS-registered state | 없음 — `gcloud`/`dig` 는 CLI 실행, OS 등록 상태 없음 | 없음 |
| Secrets/env vars | (1) Secret Manager `resend-from-email` 값 = `no-reply@grapit.com` (현 :latest). (2) `resend-api-key` 값 = 그대로 유지 [VERIFIED: deploy.yml L120-121] | (1) 신규 version 추가 + Cloud Run update. (2) 유지. |
| Build artifacts | 없음 — 본 phase 의 code change 는 `email.service.ts` + `email.service.spec.ts` 만. 빌드 artifact 는 deploy.yml 이 자동 재빌드. | CI 가 main push 트리거로 자동 처리. |
| External DNS state | (1) `heygrabit.com` 후이즈 존 = 이미 A (apex → 34.117.215.31), A (www → 34.117.215.31), A (api → 34.117.215.31), TXT (google-site-verification=...) 등 Phase 13 에 등록됨 [VERIFIED: HANDOFF §2, 3.1]. (2) SPF/DKIM/DMARC 레코드 = **없음** (Phase 13 에서 미등록, 본 phase 에서 최초 추가) | 후이즈 콘솔에서 SPF TXT + DKIM TXT (또는 CNAME, Resend 발급값 기준) + DMARC TXT 추가 — Resend 대시보드가 열거하는 레코드를 정확히 그대로 등록. |

**Canonical question 적용:** *Secret Manager `resend-from-email` 값이 `no-reply@heygrabit.com` 으로 교체된 후에도, Resend 가 heygrabit.com 도메인을 Verified 로 인식하지 못하면 Resend 는 422 `domain not verified` 를 반환하고 Cloud Run 의 env 교체는 무의미해진다.* → 순서 강제 (D-08): Resend Verified 확인 **먼저**, Secret 교체 **나중**.

## Common Pitfalls

### Pitfall 1: DNS 레코드를 잘못된 값으로 등록

**What goes wrong:** CONTEXT D-03 의 `include:_spf.resend.com` 과 D-05 의 CNAME 가정을 리터럴로 등록하면 Resend 대시보드가 Verified 로 전환되지 않는다 (값 불일치로 Resend 의 내부 DNS 쿼리 실패).

**Why it happens:** Resend 는 시간이 지나며 내부 발송 인프라 (AWS SES 사용) 를 변경해왔다. 구 문서/가이드에서는 `_spf.resend.com` 또는 CNAME DKIM 이 언급되나, 2026년 현재 Resend 대시보드가 발급하는 값은 [VERIFIED: Context7 /websites/resend GET /domains/{domain_id}]:
- **SPF MX**: `send.heygrabit.com` MX → `feedback-smtp.us-east-1.amazonses.com` (priority 10)
- **SPF TXT**: `send.heygrabit.com` TXT → `v=spf1 include:amazonses.com ~all`
- **DKIM TXT** (CNAME 아님): `resend._domainkey.heygrabit.com` TXT → `p=<base64 public key>`

**How to avoid:** Plan 에서 DNS 레코드 값을 하드코딩하지 말고, "Resend 대시보드에서 `Add Domain` 클릭 후 표시되는 레코드 표를 후이즈에 그대로 등록" 이라는 지시로 작성. D-03/D-05 의 가정값을 리서치 리스크로 upstream 공유 (본 § §§ Risks R-01).

**Warning signs:** `dig +short TXT send.heygrabit.com` 결과가 비어있거나 기대값과 다름. Resend 대시보드가 5 분 이상 `pending_verification` 상태 유지.

### Pitfall 2: Secret rotation 후 revision 재시작 없음

**What goes wrong:** Secret Manager 에 새 version 을 추가했는데 `gcloud run services update` 를 돌리지 않으면 기존 revision 은 영원히 old version 을 본다 (§3.2 `:latest` semantics).

**Why it happens:** "Secret Manager 에 latest 를 추가했으니 자동 반영될 것" 이라는 오해.

**How to avoid:** D-09 의 `gcloud run services update ... --update-secrets` 가 Secret 값 변경 없이 동일 바인딩 표현만 전달해도 새 revision 을 강제 생성한다는 사실을 명시. Plan 의 verify step 에서 `gcloud run revisions list --service=grabit-api --limit=3` 로 새 revision 이름이 생겼는지 확인.

**Warning signs:** 새 revision 없이 "반영됐다" 고 판단. D-13 검증 시 `Resend send failed for ... domain not verified` 로그가 계속 누적.

### Pitfall 3: 구 `grapit.com` 도메인을 너무 일찍 제거

**What goes wrong:** heygrabit.com Verified 가 되기 전에 Resend 대시보드에서 grapit.com 을 제거하면 그 사이 in-flight 요청이 `domain not verified` 로 실패한다 (cutover 윈도 내 password-reset 요청 유실).

**Why it happens:** "새 도메인 추가 완료했으니 구 도메인도 바로 정리" 하려는 운영 충동.

**How to avoid:** D-02 의 순서 엄격 준수 (heygrabit.com Verified + UAT 3사 수신 통과 **이후** 에만 grapit.com 제거). HUMAN-UAT 의 Sign-off 에 "구 grapit.com 제거 이전 UAT 3사 PASS 확인" 체크박스 포함.

**Warning signs:** Sentry `Resend send failed` event 가 급증하고 error.message 에 `domain not verified` 가 포함됨.

### Pitfall 4: DMARC `rua` 외부 리포트 수신 실패

**What goes wrong:** `rua=mailto:sangwopark19icons@gmail.com` 에 대한 aggregate report 가 1~2주 후에도 도착하지 않는다.

**Why it happens:** RFC 7489 §7.1 external destination verification 은 발송측 ESP (Google/Microsoft/Yahoo) 가 `heygrabit.com._report._dmarc.gmail.com` TXT 레코드 존재 여부를 확인하도록 요구한다 [CITED: datatracker.ietf.org/doc/html/rfc7489]. Gmail 은 자사 도메인이므로 이 레코드를 자동 허용하는 구현 패턴이 일반적이나, 모든 발송측이 일관된 처리를 하는 것은 아니다.

**How to avoid:** D-04 의 DMARC 값 자체는 유지 (risk-free). 다만 1~2주 뒤에도 Gmail 에 report 미수신 시 "external destination verification 이슈" 로 분류하고 `rua` 를 `legal@heygrabit.com` (mailbox 개설 후) 으로 이관.

**Warning signs:** DMARC report aggregator (예: dmarcian 무료 tier) 에 가입하지 않은 상태에서 개인 Gmail 에 XML report 가 주간 단위로 도착하지 않음 → 본 phase 범위 밖 관측 항목 (deferred).

### Pitfall 5: 3사 수신 결과를 spam 폴더 포함으로 혼동

**What goes wrong:** Gmail inbox 에 수신 안 됐지만 spam 폴더에는 들어와 있는 경우 UAT 를 PASS 로 처리.

**Why it happens:** UAT 체크리스트가 "수신 확인" 이라고만 기술하면 운영자가 spam 을 inbox 로 오판할 수 있음.

**How to avoid:** HUMAN-UAT 에 **"spam 폴더가 아닌 Inbox/받은편지함에 수신"** 문구를 각 3사 SC 별로 명시. D-14 에 이미 "spam 폴더 아님" 조건 locked — Plan 에 그대로 전사.

**Warning signs:** "수신 확인" 만 표기 + spam 여부 체크 누락.

## Code Examples

### Example 1: Sentry captureException 추가 지점 (D-11 구현)

**Before** (current email.service.ts L77-82):
```typescript
if (error) {
  this.logger.error(`Resend send failed for ${to}: ${error.message}`);
  return { success: false, error: error.message };
}
```

**After** (권장):
```typescript
// apps/api/src/modules/auth/email/email.service.ts
// Line 1 area: add import
import * as Sentry from '@sentry/nestjs';

// L77-82 replacement
if (error) {
  this.logger.error(`Resend send failed for ${to}: ${error.message}`);
  Sentry.withScope((scope) => {
    scope.setTag('component', 'email-service');
    scope.setTag('provider', 'resend');
    scope.setLevel('error');
    scope.setContext('email', {
      from: this.from,
      toDomain: to.split('@')[1] ?? 'unknown',
    });
    Sentry.captureException(new Error(`Resend send failed: ${error.message}`));
  });
  return { success: false, error: error.message };
}
```

**Source:** Pattern matches `apps/api/src/modules/sms/sms.service.ts:321-329` [VERIFIED: grep @sentry/nestjs]. Scope-based 패턴은 공식 문서 권장 [CITED: docs.sentry.io/platforms/javascript/guides/nestjs/enriching-events/scopes/].

**Why `new Error(...)` wrapping:** Resend SDK 가 반환하는 `error` 는 `{message: string, name: string}` 형태의 plain object 로, `Error` 인스턴스가 아니다. Sentry `captureException` 에 Error 가 아닌 값을 넘기면 stack trace 가 비어 이슈 그룹핑이 저하된다. 새 Error 로 랩핑하면 현재 call site 의 stack 이 붙는다.

### Example 2: email.service.spec.ts 업데이트 추가 어설션

**기존 테스트 추가 수정 (L86-99 "PROD SDK error" 테스트):**
```typescript
it('PROD SDK error: Resend returns { error } → returns { success: false, error } AND calls Sentry.captureException', async () => {
  // 기존 config/send mock 세팅 유지 ...

  // 추가: Sentry mock
  const captureSpy = vi.spyOn(Sentry, 'captureException');

  const svc = new EmailService(config);
  const result = await svc.sendPasswordResetEmail('user@example.com', 'https://app.test/reset?t=abc');

  expect(result).toEqual({ success: false, error: 'rate limit exceeded' });
  expect(captureSpy).toHaveBeenCalledTimes(1);
  // scope.setTag / setContext 호출은 withScope 콜백 내부 Sentry 내부 구현이므로 최소 captureException 호출만 검증
});
```

**상단 import 추가:**
```typescript
import * as Sentry from '@sentry/nestjs';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: { setTag: () => void; setContext: () => void; setLevel: () => void }) => void) => {
    cb({ setTag: () => {}, setContext: () => {}, setLevel: () => {} });
  }),
  captureException: vi.fn(),
}));
```

**Source:** vitest mock 구조 [VERIFIED: apps/api/src/modules/auth/email/email.service.spec.ts L5-14 의 resend mock 패턴 복제].

### Example 3: Sentry 검증 쿼리 (D-13 검증 시)

```bash
# Resend send failed 로그가 empty 인지 확인
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="grabit-api" AND (textPayload:"Resend send failed" OR jsonPayload.message:"Resend send failed")' \
  --project=grapit-491806 --freshness=24h --limit=10

# 새 revision 이름 및 traffic % 확인 (D-10)
gcloud run services describe grabit-api \
  --region=asia-northeast3 --project=grapit-491806 \
  --format='value(status.traffic[0].revisionName,status.traffic[0].percent,status.latestReadyRevisionName)'

# Sentry 통해 확인: Sentry UI → grabit-api project → Issues → filter component:email-service
# 또는 sms.service.ts 가 이미 사용하는 Sentry 프로젝트와 같은 설정이므로 동일 URL (https://sentry.io/organizations/icons-vw/)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resend DKIM = CNAME `resend._domainkey` → `<resend-hosted>` | Resend DKIM = TXT `resend._domainkey` → `p=<base64 pubkey>` | Resend platform migration (AWS SES 기반 전환, 시기 불명) | CONTEXT D-05 의 CNAME 가정 위험 [VERIFIED: Context7 /websites/resend]. Plan 은 "대시보드 표시값 그대로" 지시. |
| Resend SPF = `include:_spf.resend.com` | Resend SPF = `include:amazonses.com` (+ `send.` 서브도메인 MX) | AWS SES 기반 전환 동일 | CONTEXT D-03 의 `_spf.resend.com` 가정 위험. |
| `Sentry.captureException(err, {tags, contexts})` | `Sentry.withScope(scope => { scope.setTag/setContext; captureException(err) })` | @sentry/javascript v8+ 권장 전환 | @sentry/nestjs v10 공식 문서 권장 [CITED: docs.sentry.io/platforms/javascript/guides/nestjs/enriching-events/scopes/]. sms.service.ts 는 이미 withScope 사용. |
| Cloud Run `:latest` 가 running instance 에 hot-reload 됨 | Cloud Run `:latest` 는 revision start 시 1회 resolve 됨, lifetime 동안 고정 | 문서화된 고정 동작 (v1 부터) | D-15 rollback 이 "Secret Manager version revert" 만으로는 부족, 반드시 `gcloud run services update` 재실행 필요. |

**Deprecated/outdated in this context:**
- `onboarding@resend.dev` 를 prod 에서 fallback 사용 (email.service.ts L41-47 에서 이미 hard-fail 로 차단) — phishing / deliverability risk.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resend 대시보드가 발급하는 현재 DNS 레코드 값이 CONTEXT D-03/D-05 의 리터럴과 다를 수 있다 (SPF `include:amazonses.com`, DKIM TXT) | Pitfall 1, State of the Art | 후이즈에 하드코딩 값 등록 시 Verified 실패 → cutover 블로킹. Plan 이 "대시보드 값을 그대로" 로 지시하면 위험 무효화됨. [VERIFIED: Context7 /websites/resend] |
| A2 | Gmail 은 RFC 7489 external destination verification 을 자동 허용하는 구현 패턴을 가진다 | Pitfall 4 | 1~2주 후 aggregate report 미도착 시 D-04 가 실질 관측 가치 없음. 단, phase 15 통과 기준에는 무관 (deferred). [CITED: dmarcian, powerdmarc guides — ASSUMED 수준] |
| A3 | `email.service.spec.ts` 의 기존 5 테스트를 깨지 않고 Sentry mock 만 추가 가능 | Example 2 | 기존 vitest resend mock 구조가 충분히 모듈러 — 추가 mock `@sentry/nestjs` 가 간섭하지 않음. 단, `vi.mock` hoisting 순서 문제 가능성 있음 (mock 은 파일 상단 배치 권장). [VERIFIED: apps/api/src/modules/auth/email/email.service.spec.ts 구조] |
| A4 | Cloud Run `--update-secrets` 는 동일한 mapping 표현을 전달해도 새 revision 을 강제 생성한다 | Pattern 2 | 거짓일 경우 secret 교체가 반영되지 않고 Sentry 이벤트 빈발. 문서 명시 [CITED: docs.cloud.google.com/run/docs/configuring/services/secrets]. |
| A5 | 후이즈 DNS 콘솔이 긴 DKIM TXT 값 (base64 ~170자) 을 split 없이 저장한다 | Environment Availability | 일부 DNS 콘솔 UI 는 255자 초과시 자동 split 없이 잘림. 현재 후이즈에 대한 사용자 기록/공개 정보 없음. 운영자가 등록 후 `dig +short TXT resend._domainkey.heygrabit.com` 로 값 길이 확인 필요. [ASSUMED] |

**If this table is non-empty:** A1/A5 는 planner 가 "Resend 대시보드 표시값을 그대로 사용" + "등록 후 `dig` 로 검증" 지시로 무효화해야 한다. A2/A3/A4 는 실행 시 발견/대응 가능 범주.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gcloud` CLI | D-07, D-09, D-10, D-13, D-15 | 운영자 로컬 머신에서 사용 가정 (Phase 13 에서 사용 이력 있음 [VERIFIED: HANDOFF L50-53]) | (사용자 환경) | GCP Console UI |
| `dig` (BIND utility) | D-06 | macOS 기본 포함, Linux 대부분 포함 | — | `nslookup`, `host`, 또는 https://mxtoolbox.com |
| `printf` (POSIX) | D-07 secret stdin 패턴 | 기본 shell 내장 | — | `echo -n` (BSD 에선 `-n` 해석 상이 → `printf` 권장) |
| bash 또는 zsh | D-07 process substitution `<(...)` | 사용자 zsh 기본 [VERIFIED: env] | 5.9 | stdin pipe (shell-portable 대안) |
| Resend 대시보드 접근 | Wave 2 모든 외부 단계 | 사용자 계정으로 접근 가능 (Phase 13 에서 기동 중 [VERIFIED: HANDOFF L167-172]) | — | Resend API (create domain endpoint) — 다만 verification 검증은 UI 가 명확 |
| 후이즈 DNS 콘솔 접근 | Wave 2 DNS 등록 | 사용자 계정으로 접근 가능 (Phase 13 에서 apex/api DNS 등록 수행 [VERIFIED: HANDOFF L41-46]) | — | 없음 (DNS provider 이전 필요, 본 phase 범위 밖) |
| Gmail/Naver/Daum 실제 메일 계정 | D-14 UAT | 사용자 본인 소유 가정 | — | 없음 — 3사 inbox 수신 자체가 UAT 조건 |
| Sentry 대시보드 접근 | D-11 verification, Pitfall 1 경고 관측 | 사용자 계정으로 접근 가능 (Phase 13 에서 slug rename 수행 [VERIFIED: HANDOFF L49-50]) | — | gcloud logging (동일 정보 집합 subset) |

**Missing dependencies with no fallback:** 없음.

**Missing dependencies with fallback:** `printf` process substitution → shell-portable stdin pipe (권장 교체, Plan 에서 결정).

## Validation Architecture

`workflow.nyquist_validation` = true (default, config.json 에서 explicitly false 아님). 섹션 포함.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x [VERIFIED: apps/api/package.json L78] |
| Config file | `apps/api/vitest.config.ts` (기본), `apps/api/vitest.integration.config.ts` (integration) |
| Quick run command | `pnpm --filter @grabit/api test -- email.service.spec` |
| Full suite command | `pnpm --filter @grabit/api test` |
| Phase gate | `pnpm --filter @grabit/api test && pnpm --filter @grabit/api test:integration` green |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CUTOVER-01 | heygrabit.com Verified in Resend dashboard | **manual-only** (외부 UI 상태) | n/a — Resend UI 확인 | n/a |
| CUTOVER-02 | Secret Manager 값 = no-reply@heygrabit.com | smoke (shell) | `gcloud secrets versions access latest --secret=resend-from-email --project=grapit-491806` 출력이 `no-reply@heygrabit.com` | n/a (운영 커맨드) |
| CUTOVER-03 | Cloud Run 신규 revision 100% traffic | smoke (shell) | `gcloud run services describe grabit-api --region=asia-northeast3 --format='value(status.traffic[0].percent)'` = 100 | n/a |
| CUTOVER-04 | Silent failure Sentry 이벤트 발생 | unit (spy 기반) | `pnpm --filter @grabit/api test -- email.service.spec` → Sentry.captureException 1회 호출 어설션 green | ❌ Wave 0 — spec 수정 필요 |
| CUTOVER-05 | 3사 inbox 수신 (spam 제외) | **manual-only** (외부 ESP) | n/a — 실기기 UAT | n/a |
| CUTOVER-06 | 기존 email.service.spec 회귀 없음 | unit | `pnpm --filter @grabit/api test -- email.service.spec` 전체 green (6 테스트) | ✅ (5 기존 + 1 추가) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grabit/api test -- email.service.spec` (초 단위 실행)
- **Per wave merge:** `pnpm --filter @grabit/api test && pnpm --filter @grabit/api typecheck && pnpm --filter @grabit/api lint`
- **Phase gate:** 위 + D-13 `gcloud logging read` empty + Resend dashboard Sent/Delivered stat 기록 + HUMAN-UAT Sign-off

### Observability-based Validation (Nyquist Dim-8)

자동화 가능한 관측 신호로 end-to-end delivery 의 간접 검증:

1. **Resend API GET /domains/{id}** 응답의 `status` 가 `"verified"` → CUTOVER-01 자동 확정 [VERIFIED: Context7 /websites/resend GET /domains/{domain_id}]. (사용 유무는 planner 결정 — 대시보드 UI 로도 동등)
2. **gcloud logging `Resend send failed` count = 0 for 24h** → delivery 경로 실패 없음 간접 확증.
3. **Resend Dashboard Sent/Delivered counter 증가** → UAT 3건 발송이 실제로 송신 이벤트를 남김 (수신은 ESP 측이므로 여기까지가 한계).
4. **Sentry grabit-api 프로젝트 new Issues `component:email-service` = 0** → D-11 통합이 false positive 이벤트를 만들지 않고, 실제 실패가 없는 한 silent.

여기서 **'inbox 실제 수신 (not spam)'** 은 원리적으로 자동화 불가능 — 수신자 측 ESP 의 내부 필터 결정은 외부 관측 포인트가 없다. 본 phase 의 D-14 manual 3사 UAT 는 **Nyquist frequency 측면에서 대체 불가 sampler** 로 설계됐다.

### Wave 0 Gaps

- [x] `apps/api/src/modules/auth/email/email.service.spec.ts` — 이미 존재. Wave 1 의 spec 업데이트 task 에서 1 테스트 추가 어설션.
- [x] framework install: vitest 3.2 이미 설치.
- [x] `@sentry/nestjs` mock — 신규 필요 (spec 수정 시 추가).

*(Framework/infra gap 없음 — 순수 single-file spec 수정)*

## Security Domain

`security_enforcement` 는 config.json 에 명시되지 않음 = enabled (default). 관련 카테고리만 서술.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | password-reset email 은 계정 복구 primitive. 본 phase 는 발송 인프라만 변경, 토큰/검증 로직 무변경. |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | 본 phase 는 신규 입력 경로 없음 |
| V6 Cryptography | yes (DKIM) | DKIM private key 는 Resend 가 관리. 본 phase 는 DKIM public key 를 DNS 에 게시만 — 자체 crypto 구현 없음. |
| V7 Error Handling | yes | silent failure 가 계정 복구 실패로 이어질 수 있음 → D-11 Sentry 통합이 완화. |
| V14.2.1 (패키지 버전) | yes | `@sentry/nestjs` ^10 기존 사용, `resend` ^6.11.0 기존 사용. 본 phase 에서 신규 버전 도입 없음. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Account enumeration via email response | Information disclosure | fire-and-forget + silent return (auth.service.ts:250, D-12 로 locked) |
| Phishing via unverified sender domain | Spoofing | SPF (`~all` soft-fail) + DKIM 서명 + DMARC `p=none` (1~2주 후 `p=quarantine`, deferred) |
| Email interception in transit | Tampering | Resend → 수신 ESP 간 STARTTLS (Resend 가 관리, 본 phase 변경 없음) |
| Secret leak via logs | Information disclosure | `RESEND_API_KEY` 는 Secret Manager binding only — process env 에 노출되지만 logger 가 기록하지 않음. `RESEND_FROM_EMAIL` 은 non-secret (공개 발송자 주소) 이나 관례상 Secret Manager 관리 유지 (rotation 일관성). |
| Sentry 이벤트에 PII 포함 | Information disclosure | `toDomain` 만 context 에 기록 (로컬 파트 제외). 기존 `sms.service.ts` country-tag 관행 계승. |
| DMARC external destination verification 우회 공격 | Information disclosure (report path) | `rua` 가 외부 도메인이므로 이론적으로 spoofed report 가능하나, `p=none` 단계에서는 영향 낮음. `p=quarantine` 승격 시 재평가. |

## Implementation Approach

### Wave Breakdown (권장)

본 phase 를 2 wave 로 분해한다. 각 wave 는 독립적 PR 로 진행 가능하고 blast radius 가 분리된다.

**Wave 1 — Observability code (자동화 가능)**
- Plan 15-01: email.service.ts Sentry.captureException 추가 + email.service.spec.ts 어설션 추가
- Deliverable: PR merged to main → deploy.yml 자동 트리거 → `grabit-api` 새 revision (Sentry 통합된 코드 + 기존 `no-reply@grapit.com` secret value) 배포
- Test: `pnpm --filter @grabit/api test` green, typecheck/lint green
- Blast radius: 단일 파일 code change, 기존 테스트 회귀 없음

**Wave 2 — Operational cutover (수동/관측 기반)**
- Plan 15-02: Resend 도메인 추가 + DNS 후이즈 등록 + Verified 확인 + Secret Manager version 추가 + Cloud Run update
- Plan 15-03 (optional separation): 3사 UAT + 구 grapit.com 제거 + HUMAN-UAT 기록
- Deliverable: 신규 Cloud Run revision 활성화 (RESEND_FROM_EMAIL=no-reply@heygrabit.com), 3사 inbox 수신 확인
- Test: D-13 gcloud logging empty + Resend dashboard stat + Sentry `component:email-service` 0-count
- Blast radius: Secret rotation + DNS — **D-15 rollback playbook 30초 복귀**

**Why 2-wave separation:**
- Wave 1 merge 시점에 Sentry 통합 revision 이 배포되는데, 이 때 RESEND_FROM_EMAIL 은 아직 구 값. Sentry 가 `domain not verified` 이벤트를 포착하기 시작 → **이것이 Wave 2 를 즉시 실행해야 한다는 관측 신호로 작동** (유용한 safety signal).
- Wave 2 의 각 외부 단계는 독립적으로 rollback 가능 — Resend 도메인 추가 실패, DNS propagation 지연, Verified 전환 실패, Secret rotation 실패, UAT 실패 각 단계마다 명확한 checkpoint 가 있다.

### Key Dependencies & Sequencing

```
[Wave 1] 15-01 code merge
     |
     v  (deploy.yml auto-triggers)
new grabit-api revision (Sentry 통합, RESEND_FROM_EMAIL=@grapit.com 유지)
     |
     v
[Wave 2] 15-02 operational cutover:
  Step 1: Resend 콘솔에서 heygrabit.com 도메인 Add → DNS 레코드 발급 (값 기록)
     |
     v
  Step 2: 후이즈 콘솔에 SPF/DKIM/DMARC 레코드 등록 (Resend 발급값 그대로)
     |
     v (dig propagation check + Resend 콘솔 Verified 대기 — 5분~수시간)
  Step 3: Resend 대시보드에서 heygrabit.com = "Verified" 확인  ← 🚨 HARD GATE
     |
     v
  Step 4: gcloud secrets versions add resend-from-email → new_version
     |
     v
  Step 5: gcloud run services update grabit-api --update-secrets RESEND_FROM_EMAIL=resend-from-email:latest
     |
     v (1분 wait)
  Step 6: gcloud run services describe — 새 revision 100% traffic 확인  ← 🚨 HARD GATE
     |
     v
[Wave 2 or 15-03] UAT + cleanup:
  Step 7: Gmail/Naver/Daum 3사 실기기 password-reset 발송 → inbox 수신 확인 (not spam)  ← 🚨 HARD GATE (D-14)
     |
     v
  Step 8: D-13 gcloud logging read "Resend send failed" → empty 확인
     |
     v
  Step 9: Resend 대시보드 Sent/Delivered counter 증가 확인
     |
     v
  Step 10: Resend 대시보드에서 grapit.com 도메인 Remove (D-02 post-UAT)
     |
     v
  Step 11: 15-HUMAN-UAT.md Sign-off
```

**Sequence invariants (절대 순서 바꾸지 말 것):**
- Step 1 → 2 → 3 → 4 (D-08: Resend Verified 먼저, Secret 교체 나중). 거꾸로 하면 Resend 422 폭주.
- Step 6 → 7 (새 revision 100% 아니면 UAT 결과가 old revision 의 발송 결과일 수 있음).
- Step 7 PASS → Step 10 (D-02: UAT 전에 grapit.com 제거 금지).

### Rollback Playbook (D-15)

Wave 2 Step 4 이후 어느 지점이든 실패 시:

```bash
# previous_version 은 Step 4 직전의 :latest (수동 기록)
gcloud run services update grabit-api \
  --region=asia-northeast3 --project=grapit-491806 \
  --update-secrets RESEND_FROM_EMAIL=resend-from-email:<previous_version>

# 예: Step 4 에서 version 5 를 추가했고, previous_version 은 version 4
```

Revision rollover 에 30~60초 소요. 이후 구 `no-reply@grapit.com` 으로 다시 발송됨 (Phase 13 직후 상태로 복귀).

**DNS 레코드는 revert 하지 않는다** — propagation 시간 (3~24 시간) 때문에 fast rollback 수단이 될 수 없고, 레코드가 남아있어도 이후 재시도에 방해되지 않는다.

## Risks & Mitigations

### R-01: Resend DNS 레코드 값이 CONTEXT 가정값과 다름 (HIGH probability)
**Risk:** D-03 `include:_spf.resend.com`, D-05 CNAME 가정이 Resend 의 현 발급 형식 (SPF TXT + MX `include:amazonses.com`, DKIM TXT) 과 일치하지 않음. Plan 이 리터럴 값을 하드코딩하면 Verified 실패로 cutover 블로킹.
**Mitigation:** Plan 에서 "CONTEXT D-03/D-05 의 리터럴 값은 참고용이며, 실제 등록값은 Resend 대시보드의 Add Domain 화면에서 표시되는 값을 그대로 후이즈에 등록한다" 로 명시. RESEARCH.md 본 섹션을 discuss-phase 로 돌려 D-03/D-05 를 "Resend 발급값 그대로" 로 재화 (CLAUDE discretion 영역이므로 planner 판단 가능).
**Confidence:** HIGH (Context7 Resend docs 에서 확정). [VERIFIED: Context7 /websites/resend domain.get response example]

### R-02: 3사 중 하나가 spam 분류 (MEDIUM probability)
**Risk:** 신규 도메인 (heygrabit.com) 은 "reputation 없음" 으로 일부 ESP (특히 Naver) 가 초기 발송을 spam 분류 가능.
**Mitigation:** (a) SPF/DKIM 모두 정확히 등록되면 기술적 차단 원인은 제거됨. (b) 초기 발송량이 매우 적으므로 "volume 기반 의심" 은 발생하지 않음. (c) spam 분류 시 (i) `dig` 로 레코드 확인, (ii) Resend 대시보드 의 "DMARC alignment" 표기 확인, (iii) https://mail-tester.com 으로 score 확인 — 각 단계로 분기. D-14 는 "spam 분류 시 DKIM/SPF alignment 검토로 diversion" 이 locked — planner 는 이 diversion path 를 HUMAN-UAT 실패 시 대응 섹션에 포함.
**Confidence:** MEDIUM. [CITED: Resend blog email-authentication-a-developers-guide]

### R-03: Sentry init 미완료 (저 probability, 확인됨)
**Risk:** `apps/api/src/instrument.ts` 가 존재하지 않거나 `SentryModule.forRoot()` 가 import 안 되어 Wave 1 의 `Sentry.captureException` 호출이 no-op.
**Mitigation:** **없음 — 이미 완전 초기화됨.** [VERIFIED]:
- `apps/api/src/instrument.ts` L1-7 (`Sentry.init({dsn, tracesSampleRate, environment})`)
- `apps/api/src/app.module.ts` L7, L26 (`SentryModule.forRoot()`)
- `apps/api/src/modules/sms/sms.service.ts` L321-329, L455-459 (선례 호출)
- `apps/api/src/modules/admin/admin-diagnostics.controller.ts` L25 (test endpoint 이벤트 수신 확인)
- `apps/api/src/common/filters/http-exception.filter.ts` L19 (전역 catch)
**Confidence:** HIGH. 별도 사전 준비 phase 불필요.

### R-04: DMARC external destination verification 실패로 rua 미도착 (LOW probability, post-phase)
**Risk:** Gmail 이 `heygrabit.com._report._dmarc.gmail.com` TXT 없다는 이유로 aggregate report 를 발송자에게 dispatch 하지 않음 → `rua=mailto:sangwopark19icons@gmail.com` 이 무용.
**Mitigation:** 본 phase 의 통과 기준에 영향 없음 (D-04 는 관찰용, UAT 에서 검증 대상 아님). 1~2주 뒤 deferred 관측 phase 에서 report 실제 도착 여부 확인 후 분기. 만약 미도착이면 (a) `rua` 를 dmarcian/Postmark 등 전용 수신 서비스로 변경, (b) `legal@heygrabit.com` mailbox 개설 phase 완료 후 `rua=mailto:legal@heygrabit.com` 으로 이관.
**Confidence:** LOW. [ASSUMED: Gmail 의 자사 도메인 자동 허용 행동]

### R-05: Cloud Run `:latest` 가 cold-start 시 resolve 안 됨 (저 probability, 확인됨)
**Risk:** `:latest` 가 revision 시작 시 resolve 되지 않고 runtime 동적 fetch 를 시도 → 구 값이 남음.
**Mitigation:** **없음 — 문서 명시로 오해.** `:latest` 는 revision start 시 1회 resolve 되고 lifetime 동안 고정 [CITED: docs.cloud.google.com/run/docs/configuring/services/secrets]. D-09 의 `gcloud run services update` 는 새 revision 을 강제 생성하므로 이 revision 이 resolve 시점에 현재의 :latest version 을 읽는다.
**Confidence:** HIGH.

### R-06: 후이즈 DNS 콘솔이 긴 TXT 값 입력 실패 (LOW probability)
**Risk:** DKIM public key (base64, ~170-200자) 가 단일 TXT record entry 로 입력 불가 → 자동 split 없이 잘림.
**Mitigation:** 등록 후 즉시 `dig +short TXT resend._domainkey.heygrabit.com` 으로 값 복원 확인. 잘릴 경우 "여러 quoted string 으로 split 입력" (DNS TXT 표준 spec 은 255 octets 청크를 여러 개 허용). Plan 의 verify step 에 dig 결과 확인 포함.
**Confidence:** LOW (후이즈에 대한 직접 데이터 없음). [ASSUMED]

### R-07: Sentry event 필터링으로 D-13 false positive
**Risk:** Sentry project 의 inbound filter 설정 (예: NODE_ENV=production 만 수용, 또는 rate limit) 때문에 `email-service` 이벤트가 drop 됨. D-13 이 "Sentry empty" 를 "실패 없음" 으로 오해.
**Mitigation:** D-13 은 gcloud logging + Resend dashboard 두 신호의 AND 조건이므로 Sentry 단독 empty 에 의존하지 않음. 추가로 HUMAN-UAT 시작 전 `/api/v1/admin/sentry-test` 로 event flow 를 확인 [VERIFIED: apps/api/src/modules/admin/admin-diagnostics.controller.ts].
**Confidence:** HIGH (중복 신호 설계로 완화).

## Open Questions

1. **Q1: D-03 SPF include 값을 `include:_spf.resend.com` 으로 고수할지, Resend 대시보드 발급값 (현재는 `include:amazonses.com`) 으로 교체할지?**
   - What we know: Context7 Resend docs 의 GET /domains 응답 예시는 `include:amazonses.com` [VERIFIED]. CONTEXT D-03 의 값은 CLAUDE.md 또는 구 문서 근거.
   - What's unclear: CONTEXT D-03 가 locked 이지만, "실제 발급값과 일치하지 않으면 Verified 가 안 된다" 는 사실과 충돌.
   - Recommendation: Planner 가 Plan 에서 "Resend 대시보드 발급값을 그대로 등록" 으로 작성 + RESEARCH R-01 을 근거로 이 결정이 CONTEXT D-03 의 "Discretion 범위 밖" 가정에 대한 탈출구임을 명시. Discuss-phase 복귀 불필요 (D-03 의 의도 = "Resend 를 통해 발송", 정확한 SPF include 값은 Resend 가 결정하는 사항).

2. **Q2: Wave 1 과 Wave 2 를 동일 PR 에 묶을지, 분리할지?**
   - What we know: Wave 1 은 code change only, Wave 2 는 외부 운영 단계. 분리 시 PR 1 merge 로 Sentry 통합 revision 이 먼저 배포되어 관측 포인트가 준비된다.
   - What's unclear: 사용자가 1-PR 통합 (단일 commit) 을 선호할 수도 있다.
   - Recommendation: **2-PR 분리** 를 기본으로 Plan 하되, Planner 가 사용자 승인을 받아 조정 가능하다고 명시. 2-PR 분리의 관측 이점 (Sentry 통합 revision → 구 값 상태에서 `domain not verified` 이벤트 포착 → Wave 2 실행 trigger) 을 plan 에 기록.

3. **Q3: HUMAN-UAT 의 SC 번호 부여 체계와 Sign-off 필드 세부?**
   - What we know: Phase 14 HUMAN-UAT 가 SC-1, SC-2 ... 을 쓰고, Sign-off 는 체크박스 + 서명/날짜. Phase 13 HUMAN-UAT 는 § User-Facing Verification 로 카테고리화.
   - What's unclear: Phase 15 에 SC 를 몇 개로 분해할지 (3사 각각 SC 별? 전체 1 SC + 3 subcheck?), rollback drill 을 SC 로 포함할지.
   - Recommendation: Planner discretion (D-16 + CONTEXT "Claude's Discretion"). 본 RESEARCH 는 "Phase 14 SC-번호 체계 계승, 3사 각각 SC 별도" 를 권장하되 강제하지 않는다.

## Sources

### Primary (HIGH confidence)
- **Context7 `/websites/resend`** — domain GET /domains/{id} response example (SPF MX + SPF TXT + DKIM TXT 정확한 발급 형식)
- **Context7 `/websites/resend_dashboard_receiving`** — receiving 관련 (본 phase 에서는 sending 만 사용)
- **apps/api/src/instrument.ts** — Sentry init 확인
- **apps/api/src/app.module.ts** — SentryModule.forRoot() 확인
- **apps/api/src/modules/sms/sms.service.ts L321-329, L455-459** — Sentry withScope + captureException 선례 패턴
- **apps/api/src/modules/auth/email/email.service.ts** — 수정 대상 코드 L77-82
- **apps/api/src/modules/auth/email/email.service.spec.ts** — 기존 테스트 구조
- **apps/api/package.json** — 버전 확인 (@sentry/nestjs ^10, resend ^6.11.0, vitest ^3.2.0)
- **.github/workflows/deploy.yml L118-124** — 변경 없음 확인
- **.planning/phases/13-grapit-grabit-rename/HANDOFF.md** — 운영 상태 + deferred 항목 원천
- **.planning/phases/14-*/14-HUMAN-UAT.md** — HUMAN-UAT 템플릿 참조
- **.planning/debug/password-reset-email-not-delivered-prod.md** — root cause + Resolution 원천

### Secondary (MEDIUM confidence)
- **docs.sentry.io/platforms/javascript/guides/nestjs/enriching-events/scopes/** — withScope 패턴 권장
- **docs.cloud.google.com/run/docs/configuring/services/secrets** — `:latest` revision-start-time resolution
- **docs.cloud.google.com/sdk/gcloud/reference/secrets/versions/add** — --data-file=- stdin 지원
- **datatracker.ietf.org/doc/html/rfc7489 §7.1** — DMARC external destination verification

### Tertiary (LOW confidence, validation-needed)
- **dmarcian, powerdmarc 블로그** — Gmail 의 external destination verification 자동 허용 행동 [ASSUMED]
- **후이즈 DNS 콘솔 긴 TXT 처리** — 공개 문서 없음, 사용자 실측 필요 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Reusable assets (Sentry state, email.service 구조, HUMAN-UAT 템플릿): HIGH — 코드 베이스에서 직접 VERIFIED
- Implementation approach (2-wave 분해 + 순서 invariants): HIGH — CONTEXT decisions + debug doc Resolution 에서 도출
- Sequencing dependencies: HIGH — D-02/D-08/D-15 이 이미 lock
- DNS/Resend 레코드 정확한 값: HIGH (Context7 확인), 단 CONTEXT D-03/D-05 리터럴과 불일치 가능성 (R-01)
- DMARC external destination (rua) 동작: LOW — post-phase 관측 필요
- 후이즈 긴 TXT 처리: LOW — 실측 기반 대응

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Resend DNS 발급 형식은 30일 주기 확인 권장; 본 phase 는 cutover 직후 완료 예정이므로 stale 위험 낮음)
