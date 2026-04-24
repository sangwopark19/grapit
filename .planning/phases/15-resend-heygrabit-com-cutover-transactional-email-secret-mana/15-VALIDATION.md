---
phase: 15
slug: resend-heygrabit-com-cutover-transactional-email-secret-mana
status: approved
nyquist_compliant: true
wave_0_complete: true
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
| 15-01-01 | 01 | 1 | CUTOVER-04 | T-15-01 | Resend 발송 실패 시 Sentry 에 err 1회 보고, PII masking (domain only) | unit + typecheck + lint | `pnpm --filter @grabit/api test -- email.service.spec && pnpm --filter @grabit/api typecheck && pnpm --filter @grabit/api lint --no-fix apps/api/src/modules/auth/email/email.service.ts` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | CUTOVER-06 | T-15-02 | 기존 6 spec 회귀 없음 + Sentry mock 검증 2 신규 spec pass | unit | `pnpm --filter @grabit/api test -- email.service.spec` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | CUTOVER-01 | T-15-06 | Resend 콘솔 heygrabit.com 등록 (운영자 수동) | manual (checkpoint:human-action) | — 외부 SaaS 콘솔, API 자동 검증 불가. Pre-condition of Task 3 dig | n/a | ⬜ pending |
| 15-02-02 | 02 | 2 | CUTOVER-01 | T-15-07/08 | 후이즈 DNS SPF/DKIM/DMARC 레코드 저장 (Resend 발급값 그대로) | manual (checkpoint:human-action) | — 외부 DNS 콘솔. Pre-condition of Task 3 dig | n/a | ⬜ pending |
| 15-02-03 | 02 | 2 | CUTOVER-01 | T-15-09 | dig 으로 DNS 전파 확인 + Resend Verified 상태 | mixed (automated dig + manual Resend) | `dig +short TXT send.heygrabit.com ; dig +short CNAME resend._domainkey.heygrabit.com ; dig +short TXT _dmarc.heygrabit.com ; dig +short MX send.heygrabit.com` (모두 non-empty) | ✅ | ⬜ pending |
| 15-02-04 | 02 | 2 | CUTOVER-01 | T-15-10 | 15-HUMAN-UAT.md 생성 (6개 섹션) | automated | `test -f .planning/phases/15-*/15-HUMAN-UAT.md && grep -c '^## ' .planning/phases/15-*/15-HUMAN-UAT.md` (≥6) | ⬜ | ⬜ pending |
| 15-03-01 | 03 | 3 | CUTOVER-02 | T-15-12 | Secret Manager 신규 version payload = `no-reply@heygrabit.com`, 구 version 유지 | automated | `gcloud secrets versions access latest --secret=resend-from-email --project=grapit-491806` → `no-reply@heygrabit.com` exact match | ✅ | ⬜ pending |
| 15-03-02 | 03 | 3 | CUTOVER-03 | T-15-13/14 | Cloud Run 신규 revision traffic 100%, 구 version 참조 없음 | automated | `gcloud run services describe grabit-api --region=asia-northeast3 --project=grapit-491806 --format='value(status.traffic[0].percent)'` → `100` | ✅ | ⬜ pending |
| 15-03-03 | 03 | 3 | CUTOVER-05 | T-15-15/16 | 3사 (Gmail/Naver/Daum) inbox 수신, spam 미분류, from `no-reply@heygrabit.com` | manual (checkpoint:human-verify, gate=blocking) | — 실기기 UAT, 자동화 불가. Cross-validate with Task 4 logging empty | n/a | ⬜ pending |
| 15-03-04 | 03 | 3 | CUTOVER-05 | T-15-17 | Cloud Logging 에서 "Resend send failed" 최근 24h empty | automated | `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="grabit-api" AND (textPayload:"Resend send failed" OR jsonPayload.message:"Resend send failed")' --project=grapit-491806 --freshness=24h --limit=10` (empty) | ✅ | ⬜ pending |
| 15-03-05 | 03 | 3 | CUTOVER-01 | T-15-18 | Resend 대시보드에서 grapit.com 제거 (Task 3/4 PASS 이후만) | manual (checkpoint:human-action) | — 외부 SaaS, API 자동 검증 불가. Pre-gated by Task 3 + Task 4 PASS | n/a | ⬜ pending |
| 15-03-06 | 03 | 3 | CUTOVER-01..06 | T-15-19 | 15-HUMAN-UAT.md Wave 3 섹션 fill-in, placeholder 0 개 | automated | `remaining=$(grep -c '__________' .planning/phases/15-*/15-HUMAN-UAT.md 2>/dev/null || echo 0); test "$remaining" -eq 0` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*외부 SaaS/DNS/ESP 대상 task 4건 (15-02-01/02, 15-03-03/05) 은 자동화가 구조적으로 불가능 — `checkpoint:human-action` 또는 `checkpoint:human-verify` 로 분류되어 HUMAN-UAT.md 기록으로 검증.*

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

- [x] 모든 코드 변경 task 에 `<automated>` verify (email.service.spec.ts) 연결 — 15-01-01/02
- [x] 운영 task (DNS/Secret/Redeploy/UAT) 는 HUMAN-UAT.md 에 실행 로그 축적으로 검증 — 15-02-04 (create) + 15-03-06 (fill-in)
- [x] Wave 0 생략 이유 명시 (기존 test infra 재사용)
- [ ] 15-HUMAN-UAT.md 에 manual verification 결과 전부 기록 (실행 중 execute-phase 가 채움)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` 설정 (per-task verify map 완료)

**Approval:** approved 2026-04-24 (gsd-plan-checker VERIFICATION PASSED + orchestrator post-check 보완)
