---
phase: 15
slug: resend-heygrabit-com-cutover-transactional-email-secret-mana
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (apps/api 기존 test runner) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grabit/api test email.service` |
| **Full suite command** | `pnpm --filter @grabit/api test` |
| **Estimated runtime** | ~15 seconds (quick) / ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grabit/api test email.service`
- **After every plan wave:** Run `pnpm --filter @grabit/api test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {populated by planner} | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Phase 15 는 기존 test infrastructure (vitest 3.x, apps/api/src/modules/auth/email/email.service.spec.ts) 를 재사용한다. Wave 0 불필요 — 기존 spec 을 Sentry 통합에 맞춰 확장.*

- [ ] `apps/api/src/modules/auth/email/email.service.spec.ts` — 기존 spec 에 Sentry.captureException 호출 검증 test case 추가
  - Resend error path 에서 `Sentry.captureException(error, {...})` 이 호출되는지 mock 검증
  - `tags.component === 'email-service'`, `contexts.email.from` 포함 검증

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resend 콘솔 `heygrabit.com` Verified 상태 전환 | D-08 | 외부 SaaS 대시보드 상태 전환 — API 노출 제한적 | Resend 대시보드 → Domains → heygrabit.com → Status: Verified 스크린샷 |
| 후이즈 DNS SPF/DKIM/DMARC 레코드 등록 | D-03/D-04/D-05 | 외부 DNS 제공자 웹 콘솔, 공개 API 없음 | 후이즈 DNS 관리 콘솔 → heygrabit.com → TXT/CNAME 추가 후 저장 |
| `dig` propagation 확인 | D-06 | 실행 환경 외부 DNS 쿼리 — 시간 의존 | `dig +short TXT heygrabit.com`, `dig +short CNAME resend._domainkey.heygrabit.com` 수동 실행 결과 캡쳐 |
| 3사 UAT inbox 수신 확인 | D-14 | 실제 이메일 deliverability — Gmail/Naver/Daum 각 계정 spam 폴더 확인 필요 | `/auth/forgot-password` POST 3회 → 각 inbox `[Grabit] 비밀번호 재설정` 수신 + from `no-reply@heygrabit.com` + spam 미분류 |
| Secret Manager 신규 version 추가 및 Cloud Run revision traffic 100% 전환 | D-09/D-10 | `gcloud` CLI 실행 (로컬 인증된 운영자 세션 필요) | `gcloud secrets versions add` + `gcloud run services describe` 출력 로그 |
| 구 `grapit.com` Resend 도메인 제거 | D-02 | Resend 대시보드 수동 작업 | UAT 통과 후 Resend → grapit.com → Remove |
| Cloud Logging silent failure empty 확인 | D-13 | gcloud logging 쿼리 실시간 로그 기반 | `gcloud logging read '...' --freshness=24h --limit=10` 실행 결과가 empty 여야 PASS |

---

## Validation Sign-Off

- [ ] 모든 코드 변경 task 에 `<automated>` verify (email.service.spec.ts) 연결
- [ ] 운영 task (DNS/Secret/Redeploy/UAT) 는 HUMAN-UAT.md 에 실행 로그 축적으로 검증
- [ ] Wave 0 생략 이유 명시 (기존 test infra 재사용)
- [ ] 15-HUMAN-UAT.md 에 manual verification 결과 전부 기록
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` 설정 (planner 가 per-task verify map 완료 후)

**Approval:** pending
