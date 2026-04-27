# Phase 15 HUMAN-UAT — Resend heygrabit.com cutover

**Created:** 2026-04-27 (KST) — Task 0 실행 시점
**Goal:** 프로덕션 transactional email 경로가 `heygrabit.com` 로 cutover 되고 3사 inbox 수신이 검증됨.
**References:** 15-CONTEXT.md D-01~D-16, 15-RESEARCH.md §Implementation Approach, .planning/debug/password-reset-email-not-delivered-prod.md Resolution

---

## Pre-conditions

**Wave 1 (code):**
- [x] Plan 01 merged (email.service.ts Sentry.captureException 삽입 + spec 8 테스트 green) — PR #20 merge commit `6c1388d` (2026-04-27 11:53 KST)
- [x] `pnpm --filter @grabit/api test` 전체 green — 307/307
- [x] GitHub Actions deploy.yml → Cloud Run `grabit-api` 새 revision 이 Ready (`grabit-api-00011-5c8` created 2026-04-27 11:58:38 KST, image `sha256:c26a4d32...`, traffic 100%)
  - **중요 finding:** `RESEND_FROM_EMAIL` secret 값은 이미 `no-reply@heygrabit.com` 이었음 (v1, 2026-04-15 created). Phase 13 의 deferred EMAIL-VS-01 는 사실 secret 값 교체가 아니라 Resend 도메인 verification 누락이 root cause. Plan 02 의 Resend Verified (오늘 11:41 KST) 가 cutover 의 진짜 trigger. Plan 03 Task 1 (Add Secret v2) + Task 2 (--update-secrets) 는 따라서 NO-OP — PR #20 deploy 가 자동으로 신규 revision 을 롤링.

**Wave 2 Plan 02 (본 파일 생성 시점까지):**
- [x] Resend 대시보드에 heygrabit.com 추가됨 + 발급 레코드 table 기록됨 (Plan 02 Task 1) — 2026-04-27 09:40 KST (Tokyo ap-northeast-1)
- [x] 후이즈 DNS 에 Resend 대시보드 row 전부 등록됨 (Plan 02 Task 2)
- [x] dig 전파 확인 (row 별 literal match) + Resend 대시보드 Verified 전환 확인됨 (Plan 02 Task 3) — 2026-04-27 11:41 KST

**Wave 3 Plan 03 pre-gates:**
- [x] 위 Wave 2 pre-conditions 전부 PASS → Plan 03 진행 가능 (D-08)
- [x] **Plan 01 code (email.service.ts Sentry 통합) 가 Cloud Run 현재 serving revision 에 배포됨을 확인 — REVIEWS HIGH H1** (Plan 03 Task 0 pre-gate) — 신규 revision `grabit-api-00011-5c8` 가 PR #20 머지 commit `6c1388d` 빌드의 image 사용, traffic 100%, 2026-04-27 11:58 KST

---

## SC-1: 프로덕션 3사 inbox 수신 검증 (LOCKED D-14)

**Preconditions (REVIEWS HIGH H2):**
- [ ] UAT 에 사용할 Gmail / Naver / Daum(또는 Kakao) 3 개 주소가 prod grabit DB 에 가입된 계정임을 확인. `/auth/password-reset` 는 enumeration 방어로 미등록 이메일에도 200 을 반환하므로 미등록 주소로는 메일이 발송되지 않는다.
- [ ] 3 개 주소가 미등록이면 먼저 `https://heygrabit.com/auth/signup` 에서 회원가입 완료 (seed 스크립트 없음 — 수동 signup)
- [ ] 각 계정의 email 주소 + 가입 시각 기록: Gmail `__________`, Naver `__________`, Daum/Kakao `__________`

**Steps:**
1. https://heygrabit.com/auth/forgot-password 접속 (또는 직접 API 호출)
2. 수신 메일 주소 입력 — 차례로 Gmail / Naver / Daum(또는 Kakao) 3개 계정 (위 Preconditions 에 등록된 주소)
3. "비밀번호 재설정 링크 받기" 클릭
4. 각 inbox 에서 아래 조건 모두 확인:
   - Subject: `[Grabit] 비밀번호 재설정`
   - From: `no-reply@heygrabit.com`
   - **Inbox (받은편지함) 수신 — spam/정크 폴더 아님**
   - 본문 내 "비밀번호 재설정" 링크 존재

**Expected:** 3사 모두 inbox (not spam) 수신, from header 정확. Gmail 의 경우 "자세히 보기" 헤더에서 SPF/DKIM alignment 가 pass 로 표기.

**체크리스트:**
- [ ] Gmail inbox 수신 시각: __________ (spam 아님 ✅ / spam 분류됨 ❌)
- [ ] Naver inbox 수신 시각: __________ (spam 아님 ✅ / spam 분류됨 ❌)
- [ ] Daum(또는 Kakao) inbox 수신 시각: __________ (spam 아님 ✅ / spam 분류됨 ❌)
- [ ] 한 곳이라도 spam 분류 → DKIM/SPF alignment 재검토 (Plan 03 FAIL, rollback 트리거 후보)

---

## SC-2: Silent failure 관측성 확인 (Sentry + Cloud Logging)

**Purpose:** D-11 의 Sentry 통합이 production 에서 작동하고, D-13 의 gcloud logging 쿼리 조건이 충족됨을 확인.

**Steps:**
1. UAT 트리거 (SC-1) 가 끝난 후 최소 2 분 경과
2. Plan 03 Task 4 의 revision-scoped gcloud logging 쿼리 실행 (REVIEWS MEDIUM M2 — cutover 이전 로그가 false fail 만드는 것을 방지하기 위해 `resource.labels.revision_name` 또는 `timestamp >= <cutover_update_time>` 필터 포함):
   ```
   gcloud logging read \
     "resource.type=cloud_run_revision \
      AND resource.labels.service_name=grabit-api \
      AND resource.labels.revision_name=\"<NEW_REVISION_NAME>\" \
      AND (textPayload:\"Resend send failed\" OR jsonPayload.message:\"Resend send failed\")" \
     --project=grapit-491806 --limit=50 --format=json
   ```
3. 결과가 empty 여야 함 (D-13, REVIEWS M2 보강 — 신규 revision 범위 scope + cutover 이후 10분 window)
4. Sentry `grabit-api` 프로젝트 → Issues → filter `tags:component:email-service` — Task 2 cutover 시각 이후 0 건

**체크리스트:**
- [x] gcloud logging read (revision scoped) 결과 empty 확인 시각 (deploy 직후 baseline): 2026-04-27 12:00 KST
- [x] 검증 대상 신규 revision 이름: `grabit-api-00011-5c8`
- [ ] Sentry email-service 이벤트 0 건 확인 시각 (3 사 UAT 트리거 이후 범위): __________ (사용자가 Sentry 대시보드에서 확인 후 기록)
- [ ] 3사 UAT 후 재확인 시각 (Resend send failed 0 건 + Sentry 0 건): __________

**baseline (deploy 직후, UAT 트리거 전) — 사전 확인 결과:**
- `gcloud logging read` revision-scoped (`grabit-api-00011-5c8`, since 2026-04-27 02:58:00Z) "Resend send failed" → empty ✅
- Cloud Run severity>=ERROR (since 2026-04-27 02:58:00Z) → empty ✅
- 신규 revision 시작 시각: 2026-04-27 02:58:38Z (UTC) = 11:58:38 KST, 정상 startup INFO log 확인됨

---

## Operational Audit Log (CONTEXT D-16)

### Wave 2 — DNS / Resend 도메인

**Resend 발급 원본 레코드 (Plan 02 Task 1 에서 대시보드 detail page 의 row 를 그대로 기록):**

*아래 table 은 Resend 가 실제로 표시하는 row 의 수 / type / name 을 그대로 반영한다. Row 가 3 개면 3 줄, 5 개면 5 줄. type 은 TXT 일 수도 MX 일 수도 CNAME 일 수도 있다 — 고정 가정 금지 (REVIEWS M1).*

| # | Type | Name | Value | Priority |
|---|------|------|-------|----------|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIJN1oyMnw4Drxn9/wz2tyeuViq7hrU8NeqEydKBk8HgWp8g5diaMD0fHB57EVktS2Y0mB07HeIAUNShT2tILAcdFx9Tjf0o8K1HdFRKeroq1wAZ8aEIr+LkqFQVw+zBF7IibNEpTxACCesuSqwgnlFyHWQ5U5l+X8sfaiIgIZYwIDAQAB` | — (Auto) |
| 2 | MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — (Auto) |

*Resend 가 발급한 required record 는 정확히 3 개 (DKIM TXT 1 + SPF MX 1 + SPF TXT 1). region=Tokyo (ap-northeast-1) 라서 MX target 이 `feedback-smtp.ap-northeast-1.amazonses.com` 으로 발급됨. Resend 대시보드는 옵셔널 DMARC (`v=DMARC1; p=none;` no rua) 도 제안했으나, 프로젝트 D-04 lock 값 (rua 포함) 을 우선하여 아래 project-defined DMARC 만 등록.*

**Project-defined DMARC record (Resend required 아님, D-04 locked):**
- Type: TXT
- Name: `_dmarc.heygrabit.com`
- Value: `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com`

**후이즈 DNS 등록 (Plan 02 Task 2):**
- 등록 시각: 2026-04-27 ~11:30 KST (정확한 등록 시각은 후이즈 콘솔 history 확인. Resend `DNS verified` 시각이 11:40 KST 이므로 그 직전 5~10분 사이로 추정)
- 등록자: sangwopark19icons@gmail.com
- 등록된 row 수 (Resend table 전부 + project-defined DMARC 1): 4 (DKIM TXT 1 + SPF MX 1 + SPF TXT 1 + DMARC TXT 1)
- 후이즈 메뉴별 등록 위치:
  - **MX 레코드 관리**: `send` (priority 10) → `feedback-smtp.ap-northeast-1.amazonses.com`
  - **SPF(TXT) 레코드 관리**: 3 row (DKIM `resend._domainkey`, SPF `send`, DMARC `_dmarc`)

**dig 전파 확인 (Plan 02 Task 3) — 각 row 별 literal match table (REVIEWS M1):**

| # | dig command (TYPE NAME) | Resend 발급 VALUE | dig 결과 (concat 후) | 일치 여부 |
|---|--------------------------|--------------------|----------|-----------|
| 1 | `dig +short TXT resend._domainkey.heygrabit.com \| tr -d '" '` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIJN1oyMnw4Drxn9/wz2tyeuViq7hrU8NeqEydKBk8HgWp8g5diaMD0fHB57EVktS2Y0mB07HeIAUNShT2tILAcdFx9Tjf0o8K1HdFRKeroq1wAZ8aEIr+LkqFQVw+zBF7IibNEpTxACCesuSqwgnlFyHWQ5U5l+X8sfaiIgIZYwIDAQAB` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIJN1oyMnw4Drxn9/wz2tyeuViq7hrU8NeqEydKBk8HgWp8g5diaMD0fHB57EVktS2Y0mB07HeIAUNShT2tILAcdFx9Tjf0o8K1HdFRKeroq1wAZ8aEIr+LkqFQVw+zBF7IibNEpTxACCesuSqwgnlFyHWQ5U5l+X8sfaiIgIZYwIDAQAB` | ✅ |
| 2 | `dig +short MX send.heygrabit.com` | `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10) | `10 feedback-smtp.ap-northeast-1.amazonses.com.` (trailing dot 제거 + priority 일치) | ✅ |
| 3 | `dig +short TXT send.heygrabit.com \| tr -d '" '` | `v=spf1 include:amazonses.com ~all` | `v=spf1 include:amazonses.com ~all` | ✅ |
| DMARC | `dig +short TXT _dmarc.heygrabit.com \| tr -d '" '` | `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com` | `v=DMARC1;p=none;rua=mailto:sangwopark19icons@gmail.com` (concat 후 공백 제거 → 동일) | ✅ |

*TXT chunked-string 비교: dig 결과의 다중 quoted-string (`"abc" "def"`) 은 DNS RFC 1035 chunked-string — `tr -d '" '` 또는 `sed 's/" "//g; s/"//g'` 로 concat 후 Resend 원본값과 literal match.*

**Resend 대시보드 heygrabit.com Verified 전환 시각:** 2026-04-27 11:41 KST (Resend Domain Events: Domain added 09:40, DNS verified 11:40, Domain verified 11:41) — Plan 02 Task 3 resume-signal

### Wave 3 — Secret Manager / Cloud Run (Plan 03 fill-in)

**중요 — Plan 03 Task 1+2 SKIP 사유 (반드시 이 audit 기록 보존):**

운영 중 발견: `resend-from-email` secret v1 (created 2026-04-15T07:30:46Z) 의 값이 이미 `no-reply@heygrabit.com` 이었음. 즉 Cloud Run prod 는 2026-04-15 부터 heygrabit.com 으로 발송을 시도해 왔지만, Resend 가 heygrabit.com 을 unverified 상태로 두었기 때문에 422 silent failure 가 누적 (그게 Phase 13 UAT gap 9 / `password-reset-email-not-delivered-prod.md` 의 root cause). Plan 03 가 가정한 "구 grapit.com → 신 heygrabit.com 으로 secret 교체" 시나리오는 사실관계가 반대였음.

따라서 cutover 의 진짜 trigger 는 Plan 02 Task 3 의 Resend Verified (오늘 11:41 KST) 였고, Plan 03 Task 1 (Add Secret v2) + Task 2 (`gcloud run services update --update-secrets`) 는 functionally NO-OP. PR #20 머지로 인한 자동 deploy 가 신규 revision 을 롤링하면서 그 revision 이 secret v1 (= `no-reply@heygrabit.com`) 을 동일하게 사용. 따라서 Task 1+2 는 SKIP 처리하고 PR #20 deploy 자체를 cutover boundary 로 audit.

- Secret Manager 신규 version 번호: **(SKIPPED — v1 이 이미 정확한 값)** `projects/grapit-491806/secrets/resend-from-email/versions/1`
- `gcloud secrets versions access 1 --secret=resend-from-email` 출력값: `no-reply@heygrabit.com` ✅
- **이전 version 번호 (rollback pin 용):** 없음 — secret 에 v1 이 유일. **Rollback 시 새 version (no-reply@grapit.com) 을 추가한 뒤 `--update-secrets` 해야 함** (D-15 의 [A] 시나리오 갱신: 30초 즉시 rollback 불가, version 추가 + redeploy ~2-3 분 소요. 단, grapit.com 이 Resend 에서 아직 Verified 인 동안에만 유효).
- Cloud Run update 실행 시각: 2026-04-27 11:58 KST (PR #20 deploy 가 자동 트리거)
- 신규 Cloud Run revision ID: `grabit-api-00011-5c8`
- `gcloud run services describe` traffic 100% 확인 시각: 2026-04-27 11:58 KST (deploy.yml 의 `--no-traffic=false` 기본값으로 즉시 100%)
- 100% traffic 도달 시각: 2026-04-27 11:58 KST
- 신규 revision image digest: `sha256:c26a4d32294e0df36cfa37defcee665b4164eb40b0b985b93017d7679fd9de4e`
- 신규 revision env binding: `RESEND_FROM_EMAIL` → `secretKeyRef name=resend-from-email key=latest` (= v1, 동일)

**🚨 추가 발견 — `resend-api-key` placeholder 교체 (2026-04-27 15:19 KST):**

UAT 미수신 디버깅 중 발견: `resend-api-key` secret v1 (created 2026-04-15T07:30:42Z) 의 값이 placeholder 문자열 `re_PLACEHOLDER_SET_AGAIN_VERIFY` (38 chars) 로 설정되어 있었음. 즉 production EmailService 가 Resend API 호출 시 invalid key 로 401 을 받아왔음. 그러나 auth.service.ts L233-235 의 enumeration defense (`if (!user || !user.passwordHash) return;`) 가 social-only 계정 + 미가입 계정에서 silent return 처리하기 때문에 EmailService 호출 자체가 거의 일어나지 않아 Sentry/log 에 잡히지 않은 silent silent failure.

조치:
- v2 (real key) 추가: `printf '%s' '<key>' | gcloud secrets versions add resend-api-key --data-file=-` → 2026-04-27 06:19:06Z UTC = 15:19 KST
- v1 (placeholder) disabled (보안 hygiene)
- Cloud Run 강제 redeploy: `gcloud run services update grabit-api --update-secrets RESEND_API_KEY=resend-api-key:latest` → 신규 revision `grabit-api-00013-lkx` (created 2026-04-27 06:19:33Z = 15:19:33 KST), 100% traffic
- Resend API smoke test: `curl POST /emails to=sangwopark19icons@gmail.com from=no-reply@heygrabit.com` → email id `4e53d589-8ea6-43b6-9ba0-66ff64a2a062`, `last_event: delivered` ✅
- Resend domains list 검증: heygrabit.com 만 존재, status=verified, region=ap-northeast-1 → **D-02 의 grapit.com 제거 (Plan 03 Task 5) 도 NO-OP — 제거할 도메인이 없음**

**최종 serving revision: `grabit-api-00013-lkx`** — Plan 01 Sentry 통합 + RESEND_API_KEY v2 (real) + RESEND_FROM_EMAIL v1 (`no-reply@heygrabit.com`).

### Wave 3 — UAT & cleanup (Plan 03 fill-in)

- 3 사 UAT 수신 시각: (SC-1 체크리스트 참조 — 진행 중)
- gcloud logging (revision scoped) empty 확인 시각: 2026-04-27 12:00 KST baseline (`grabit-api-00011-5c8`), 후속 `grabit-api-00013-lkx` baseline 검증 필요
- **Resend API direct smoke test:** id `4e53d589...`, to=sangwopark19icons@gmail.com, last_event=`delivered`, 2026-04-27 15:20 KST ✅ (heygrabit.com 발송 경로 + DKIM/SPF/DMARC 정상 검증)
- **안정 관측 window (REVIEWS HIGH H3):** revision `grabit-api-00013-lkx` 100% 도달 시각 (2026-04-27 15:19:33 KST) + 최소 48h 동안 (a) Resend 발송 실패 0 건, (b) Sentry email-service 신규 이벤트 0 건. window 종료 시각: 2026-04-29 ~15:30 KST 예정
- Resend 구 `grapit.com` 도메인 제거 시각 (D-02, 안정 window 종료 후): **N/A — Resend 계정에 grapit.com 도메인 자체가 등록되어 있지 않음** (Resend domains API 검증 결과: heygrabit.com 단일). Plan 03 Task 5 SKIP 처리.

---

## Sign-off

- [x] Plan 02 Task 0/1/2/3 전부 PASS — heygrabit.com Verified + audit shell 생성 (2026-04-27 11:41 KST)
- [ ] Plan 03 Task 0/1/2/3/4 전부 PASS — pre-gate (Plan 01 배포 확인) + Secret rotation + Cloud Run update + UAT + 관측
- [ ] Plan 03 Task 5 (deferred cleanup, REVIEWS H3) — 안정 window 종료 후 별도 실행
- [ ] SC-1 체크리스트 PASS (3사 inbox 수신, spam 아님, 등록 계정 사용 확인)
- [ ] SC-2 체크리스트 PASS (revision-scoped gcloud logging empty + Sentry email-service 0 건)
- [ ] 검증자: sangwopark19icons@gmail.com
- [ ] 완료 날짜: __________
- [ ] `.planning/STATE.md` Phase 15 상태 "shipped (code+prod UAT)" 로 업데이트 — Plan 03 Task 7 또는 `/gsd-verify-work` 흐름

---

## Rollback 기준 (D-15)

**Rollback 트리거 조건:**
- 3사 중 2개 이상이 spam 분류 또는 미수신
- Cloud Run 신규 revision 배포 직후 1시간 내 revision-scoped `Resend send failed` 로그가 5건 이상
- Sentry `component:email-service` 신규 이벤트가 재배포 후 10분 내 다수 발생

**Rollback playbook — 시점 의존적 (REVIEWS HIGH H3 — 안정 window 전/후 구분):**

**[A] Plan 03 Task 5 (grapit.com Resend 제거) 실행 전 — 30초 rollback 유효:**
```bash
# Wave 3 Audit Log 의 "이전 version 번호 (rollback pin 용)" 값 사용
gcloud run services update grabit-api \
  --region=asia-northeast3 --project=grapit-491806 \
  --update-secrets RESEND_FROM_EMAIL=resend-from-email:<previous_version>
```
- 30~60초 내 revision rollover → 구 `no-reply@grapit.com` 복귀 (Resend 대시보드에 `grapit.com` 아직 Verified 로 남아 있어 발송 가능)
- DNS 레코드는 revert 하지 않음 (propagation 지연으로 fast rollback 수단 아님)

**[B] Plan 03 Task 5 (grapit.com 제거) 이후 — 30초 rollback 불가, 수동 복구 (~5-10 분):**
- Secret version rollback 만으로는 복구 불가 — Resend 대시보드에서 `grapit.com` 이 이미 제거된 상태라 `no-reply@grapit.com` 발송이 422 로 실패
- 복구 절차: (1) Resend 대시보드에서 `grapit.com` 도메인 재등록 → (2) Resend 가 요구하는 DNS 는 이미 grapit.com 의 외부 DNS provider 에 있을 수도 없을 수도 있음 (Phase 13 HANDOFF L248 — 소유권 불확실) → (3) Verified 되면 Secret rollback 수행 → 전체 5-10 분
- Plan 03 Task 5 는 본 문서의 "안정 관측 window 종료" 체크박스가 완료된 후에만 실행 가능 (Task 5 pre-gate)
- Rollback 후 `.planning/debug/` 하위에 session 개시, 원인 조사
