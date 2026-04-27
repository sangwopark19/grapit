# Phase 15 HUMAN-UAT — Resend heygrabit.com cutover

**Created:** 2026-04-27 (KST) — Task 0 실행 시점
**Goal:** 프로덕션 transactional email 경로가 `heygrabit.com` 로 cutover 되고 3사 inbox 수신이 검증됨.
**References:** 15-CONTEXT.md D-01~D-16, 15-RESEARCH.md §Implementation Approach, .planning/debug/password-reset-email-not-delivered-prod.md Resolution

---

## Pre-conditions

**Wave 1 (code):**
- [ ] Plan 01 merged (email.service.ts Sentry.captureException 삽입 + spec 8 테스트 green)
- [ ] `pnpm --filter @grabit/api test` 전체 green
- [ ] GitHub Actions deploy.yml → Cloud Run `grabit-api` 새 revision 이 Ready (Sentry 통합 코드, secret 값은 아직 구 grapit.com)

**Wave 2 Plan 02 (본 파일 생성 시점까지):**
- [ ] Resend 대시보드에 heygrabit.com 추가됨 + 발급 레코드 table 기록됨 (Plan 02 Task 1)
- [ ] 후이즈 DNS 에 Resend 대시보드 row 전부 등록됨 (Plan 02 Task 2)
- [ ] dig 전파 확인 (row 별 literal match) + Resend 대시보드 Verified 전환 확인됨 (Plan 02 Task 3)

**Wave 3 Plan 03 pre-gates:**
- [ ] 위 Wave 2 pre-conditions 전부 PASS → Plan 03 Secret rotation 실행 가능 (D-08)
- [ ] **Plan 01 code (email.service.ts Sentry 통합) 가 Cloud Run 현재 serving revision 에 배포됨을 확인 — REVIEWS HIGH H1** (Plan 03 Task 0 pre-gate)

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
- [ ] gcloud logging read (revision scoped) 결과 empty 확인 시각: __________
- [ ] 검증 대상 신규 revision 이름: __________
- [ ] Sentry email-service 이벤트 0 건 확인 시각 (Task 2 이후 범위): __________

---

## Operational Audit Log (CONTEXT D-16)

### Wave 2 — DNS / Resend 도메인

**Resend 발급 원본 레코드 (Plan 02 Task 1 에서 대시보드 detail page 의 row 를 그대로 기록):**

*아래 table 은 Resend 가 실제로 표시하는 row 의 수 / type / name 을 그대로 반영한다. Row 가 3 개면 3 줄, 5 개면 5 줄. type 은 TXT 일 수도 MX 일 수도 CNAME 일 수도 있다 — 고정 가정 금지 (REVIEWS M1).*

| # | Type | Name | Value | Priority |
|---|------|------|-------|----------|
| 1 | __________ | __________ | __________ | __________ |
| 2 | __________ | __________ | __________ | __________ |
| 3 | __________ | __________ | __________ | __________ |
| 4 | __________ | __________ | __________ | __________ |
| (add more rows if Resend shows more) | | | | |

**Project-defined DMARC record (Resend required 아님, D-04 locked):**
- Type: TXT
- Name: `_dmarc.heygrabit.com`
- Value: `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com`

**후이즈 DNS 등록 (Plan 02 Task 2):**
- 등록 시각: __________ (ISO8601 KST)
- 등록자: sangwopark19icons@gmail.com
- 등록된 row 수 (Resend table 전부 + project-defined DMARC 1): __________

**dig 전파 확인 (Plan 02 Task 3) — 각 row 별 literal match table (REVIEWS M1):**

| # | dig command (TYPE NAME) | Resend 발급 VALUE | dig 결과 | 일치 여부 |
|---|--------------------------|--------------------|----------|-----------|
| 1 | `dig +short __________ __________` | __________ | __________ | ✅ / ❌ |
| 2 | `dig +short __________ __________` | __________ | __________ | ✅ / ❌ |
| 3 | `dig +short __________ __________` | __________ | __________ | ✅ / ❌ |
| 4 | `dig +short __________ __________` | __________ | __________ | ✅ / ❌ |
| DMARC | `dig +short TXT _dmarc.heygrabit.com` | `v=DMARC1; p=none; rua=mailto:sangwopark19icons@gmail.com` | __________ | ✅ / ❌ |

*TXT chunked-string 비교: dig 결과의 다중 quoted-string (`"abc" "def"`) 은 DNS RFC 1035 chunked-string — `tr -d '" '` 또는 `sed 's/" "//g; s/"//g'` 로 concat 후 Resend 원본값과 literal match.*

**Resend 대시보드 heygrabit.com Verified 전환 시각:** __________ (ISO8601 KST) — Plan 02 Task 3 resume-signal

### Wave 3 — Secret Manager / Cloud Run (Plan 03 fill-in)

- Secret Manager 신규 version 번호: __________ (예: `projects/.../secrets/resend-from-email/versions/N`)
- `gcloud secrets versions access <N> --secret=resend-from-email` 출력값: __________ (= `no-reply@heygrabit.com` 기대)
- **이전 version 번호 (rollback pin 용)** — 명시 filter+sort 사용 (REVIEWS M3): `gcloud secrets versions list resend-from-email --project=grapit-491806 --filter='state=ENABLED' --sort-by='~createTime' --limit=1 --format='value(name)'` 출력: __________
- Cloud Run update 실행 시각: __________ (ISO8601 KST)
- 신규 Cloud Run revision ID: __________ (예: `grabit-api-000NN-xxx`)
- `gcloud run services describe` traffic 100% 확인 시각: __________
- 100% traffic 도달 시각: __________

### Wave 3 — UAT & cleanup (Plan 03 fill-in)

- 3 사 UAT 수신 시각: (SC-1 체크리스트 참조)
- gcloud logging (revision scoped) empty 확인 시각: (SC-2 체크리스트 참조)
- **안정 관측 window (REVIEWS HIGH H3):** Cloud Run 신규 revision 100% 도달 시각 + 최소 48h 동안 (a) Resend 발송 실패 0 건, (b) Sentry email-service 신규 이벤트 0 건. window 종료 시각: __________
- Resend 구 `grapit.com` 도메인 제거 시각 (D-02, 안정 window 종료 후): __________

---

## Sign-off

- [ ] Plan 02 Task 0/1/2/3 전부 PASS — heygrabit.com Verified + audit shell 생성
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
