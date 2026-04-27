---
phase: 15
plan: 03
status: complete
completed: 2026-04-27
requirements: [CUTOVER-02, CUTOVER-03, CUTOVER-05]
plan_assumptions_invalidated: true
---

# Plan 15-03 Summary — Production cutover (실제 시나리오: assumption-corrected execution)

## Plan 가정 vs 현실

이 plan 은 작성 시점에 production state 에 대한 잘못된 가정을 갖고 있었음. 실제 prod 상태를 검증한 결과 다음과 같은 사실관계 정정이 필요했음:

| 항목 | Plan 가정 | 검증 후 사실 |
|---|---|---|
| `resend-from-email` secret 값 | `no-reply@grapit.com` (구) | **이미 `no-reply@heygrabit.com` (v1, 2026-04-15 created)** |
| Cloud Run env binding | grapit 발송 중 | **이미 heygrabit 발송 시도 중 (2026-04-24~)** |
| Phase 13 UAT gap 9 root cause | secret 미교체 | **Resend 도메인 unverified + `resend-api-key` placeholder 누적** |
| Cutover 진짜 trigger | Plan 03 Task 1+2 (Secret rotation + redeploy) | **Plan 02 Task 3 Resend Verified (2026-04-27 11:41 KST) + resend-api-key real key 교체 (15:19 KST)** |
| Resend 계정에 `grapit.com` 도메인 | 등록되어 Verified 상태 (rollback path) | **존재하지 않음** (Resend domains API 검증) |

## What was actually done

**Task 0 — Plan 01 deploy pre-gate (PASS):**
- PR #20 머지 (commit `6c1388d`, 2026-04-27 02:53 UTC = 11:53 KST)
- `.github/workflows/deploy.yml` 자동 트리거 → CI run 24974274230 success → Deploy run 24974345191 success
- Cloud Run 신규 revision `grabit-api-00011-5c8` 생성 (2026-04-27 02:58:38 UTC = 11:58:38 KST)
- Image: `asia-northeast3-docker.pkg.dev/grapit-491806/grabit/grabit-api@sha256:c26a4d32294e0df36cfa37defcee665b4164eb40b0b985b93017d7679fd9de4e`
- Traffic 100% 즉시 도달 (deploy.yml 의 `--no-traffic=false` 기본값)
- → Plan 01 의 Sentry 통합 코드 + heygrabit.com 발송 동시 활성화

**Task 1 (Add Secret v2 = no-reply@heygrabit.com) — SKIP:**
- 검증 결과 v1 이 이미 `no-reply@heygrabit.com` (2026-04-15 created). 추가 version 은 functionally NO-OP.
- Audit 기록을 위해 본 SUMMARY + 15-HUMAN-UAT.md 에 SKIP 사유 보존.

**Task 2 (Cloud Run --update-secrets) — SKIP (1차) → 후속 발견 후 EXECUTE (2차):**
- 1차: `resend-from-email` 갱신 의도였으나 NO-OP (secret 값 변경 없음)
- 2차 (15:19 KST): UAT 미수신 디버깅 중 발견된 `resend-api-key` placeholder 교체 후 Cloud Run revision 강제 롤:
  ```bash
  gcloud run services update grabit-api --region=asia-northeast3 --project=grapit-491806 \
    --update-secrets RESEND_API_KEY=resend-api-key:latest
  ```
- 신규 revision `grabit-api-00013-lkx` 생성 (2026-04-27 06:19:33 UTC = 15:19:33 KST), 100% traffic

**🚨 추가 critical fix — `resend-api-key` placeholder 교체 (Plan 외 발견):**
- 발견: secret v1 (created 2026-04-15) 의 값이 placeholder `re_PLACEHOLDER_SET_AGAIN_VERIFY` (38 chars). production EmailService 는 invalid key 로 매번 401 거부 받아왔음.
- Hidden by enumeration defense (auth.service.ts L233-235): social-only / 미가입 계정 silent return 으로 EmailService 호출 자체가 차단되어 Sentry/log 에 안 잡힘 (silent silent failure).
- Phase 13 UAT gap 9 (`password-reset-email-not-delivered-prod.md`) 의 진짜 layered root cause:
  1. Resend 도메인 unverified (Plan 02 에서 해결, 11:41 KST)
  2. **resend-api-key placeholder (Plan 03 외 발견, 15:19 KST 해결)**
  3. (해당 없음) social-only 계정으로 password-reset 시도 시 silent return — by design
- 조치 (15:19 KST):
  - 사용자가 Resend dashboard 에서 신규 API key 발급
  - `printf '%s' '<key>' | gcloud secrets versions add resend-api-key --data-file=-` (stdin 으로 shell history 에 흔적 남기지 않음)
  - v1 (placeholder) `gcloud secrets versions disable 1` 처리 (보안 hygiene)
  - Cloud Run --update-secrets 로 신규 revision 강제 롤 → `grabit-api-00013-lkx`

**Task 3 (3사 UAT) — partial PASS:**
- Resend API direct smoke test (curl POST /emails, from=no-reply@heygrabit.com, to=sangwopark19icons@gmail.com): email id `4e53d589-8ea6-43b6-9ba0-66ff64a2a062`, last_event=`delivered` ✅
- 사용자 Gmail inbox 수신 확인 (spam 아님) ✅ (2026-04-27 15:25 KST)
- → Resend 발송 경로 + DKIM/SPF/DMARC alignment 정상 검증
- Naver/Daum 직접 UAT 는 deferred — auth flow (email.service.ts) 까지 검증하려면 password 기반 계정 필요. 운영 트래픽 누적 (48h window) 으로 자연 검증.

**Task 4 (revision-scoped logging empty + Sentry 0건):**
- `gcloud logging read --revision_name=grabit-api-00013-lkx severity>=ERROR` → empty ✅
- `"Resend send failed"` 검색 → empty ✅
- Sentry `tags:component:email-service` 확인은 사용자 dashboard 직접 검증 필요 (CLI 미구성)

**Task 5 (구 grapit.com Resend 제거) — N/A:**
- Resend domains API (`GET /domains`) 검증 결과: heygrabit.com 단일, grapit.com 미등록.
- 즉 제거할 도메인이 없음. SKIP 처리.
- Rollback playbook 의 [B] 시나리오 ("grapit.com 제거 후") 도 N/A (이미 제거되어 있음 / 처음부터 없었음).

**Task 6 (HUMAN-UAT.md fill-in) — DONE:**
- Wave 3 Secret Manager / Cloud Run / UAT / cleanup 섹션 모두 업데이트
- Sign-off 체크박스 9/9 처리

**Task 7 (STATE.md / ROADMAP.md 업데이트) — DONE.**

## key-files.modified

- `.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-HUMAN-UAT.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

## key-files.created

- `.planning/phases/15-resend-heygrabit-com-cutover-transactional-email-secret-mana/15-03-SUMMARY.md`

## Production state — final

| 항목 | 값 |
|---|---|
| Cloud Run service | `grabit-api` (asia-northeast3, project grapit-491806) |
| Serving revision | `grabit-api-00013-lkx` (2026-04-27 15:19:33 KST, traffic 100%) |
| `RESEND_API_KEY` secret | v2 enabled (real key, real value never committed to git/conversation persistence beyond Secret Manager) |
| `RESEND_FROM_EMAIL` secret | v1 enabled = `no-reply@heygrabit.com` |
| Resend domain | heygrabit.com verified (ap-northeast-1) |
| Sentry integration | active on revision (Plan 01 commit `f792ae4` deployed) |

## 안정 관측 window

- 시작: 2026-04-27 15:19:33 KST (revision `grabit-api-00013-lkx` 100% traffic)
- 종료 예정: 2026-04-29 15:30 KST (~48h)
- 조건: (a) revision-scoped `Resend send failed` 0 건, (b) Sentry `component:email-service` 신규 이벤트 0 건
- Window 종료 후 후속 작업 없음 (Resend 에 grapit.com 미등록 → Task 5 N/A 이미 처리)

## Self-Check: PASSED (with assumption corrections)

- ✅ Plan 01 deploy pre-gate (Task 0)
- ✅ Cloud Run cutover (Task 2 — 2차 실행)
- ✅ Resend API direct smoke test → Gmail inbox 수신
- ✅ Revision-scoped logging baseline empty (Task 4)
- ✅ HUMAN-UAT.md / STATE.md / ROADMAP.md 업데이트 (Task 6, 7)
- ⏭ Tasks 1, 5: SKIP (사실관계 변경 — audit 기록 보존)
- ⏳ Naver/Daum UAT, Sentry dashboard 0건 확인: 운영 트래픽 + 48h window 로 deferred 자연 검증

## Lessons learned (Phase 15 retrospective insights)

1. **Layered silent failures 의 위험성** — Phase 13 UAT gap 9 의 root cause 가 단일 (resend domain unverified) 가 아니라 **2개의 누적된 silent failure** (도메인 unverified + API key placeholder). enumeration defense 가 두 layer 모두 가시화를 차단했음 → Plan 01 의 Sentry 통합이 미래에 동일 패턴 발견을 가능하게 함.
2. **Plan 가정 검증의 중요성** — Plan 03 가 "구 grapit.com → 신 heygrabit.com 교체" 시나리오를 가정했으나 사실관계는 다름. 실행 단계에서 prod state 를 직접 inspect 한 것이 시간 낭비 / 오작동을 막음.
3. **Production-grade placeholder 검출 메커니즘 필요** — `re_PLACEHOLDER_SET_AGAIN_VERIFY` 같은 placeholder 가 12일 동안 prod 에 살아있었던 것은 monitoring/alerting 부재. 향후 phase 에서 secret value pattern validation (e.g., regex enforcing `re_[A-Za-z0-9_]{27,}` for Resend keys) 또는 startup-time sanity check 도입 고려.
4. **`auth.service.ts` enumeration defense 의 trade-off** — 보안 (account enumeration 방지) vs 가시성 (silent failure 누적). 본 phase 는 후자를 Sentry observability 로 부분 해결. 향후 ops dashboard 에 password-reset request 카운터 / Resend send rate 비교 metric 추가하면 statistical anomaly 로 감지 가능.

## Outstanding follow-ups (not in this phase scope)

- [ ] Sentry 대시보드에서 `component:email-service` 누적 0 건 확인 (48h window 종료 시)
- [ ] (옵션) password 기반 테스트 계정 생성 후 /auth/forgot-password 정식 UAT — auth flow 까지 end-to-end 검증
- [ ] (옵션) Secret value placeholder validation 메커니즘 도입 검토 (lessons #3)
- [ ] resend-api-key 가 conversation 에 노출되었으므로 향후 보안 hygiene 차원에서 키 rotation 권장
