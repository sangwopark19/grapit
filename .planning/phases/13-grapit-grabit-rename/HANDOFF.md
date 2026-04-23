---
doc: phase-13-handoff
phase: 13-grapit-grabit-rename
session_date: 2026-04-23
status: production-live; observation + cleanup pending
next_review: 2026-04-26 (3-day observation window)
---

# Phase 13 — 세션 핸드오프 문서

**작업일:** 2026-04-23 (KST)
**주 작업자:** Sangwoo Park
**작업 범위:** Wave 3 재개(DNS 이전 완료 후) → Wave 4 apex cutover → 프로덕션 런칭

---

## 0. TL;DR

| 질문 | 답 |
|------|-----|
| 지금 서비스 live 인가? | ✅ `https://heygrabit.com`, `https://www.heygrabit.com`, `https://api.heygrabit.com` 모두 HTTP 200 |
| 구 grapit-* 서비스는? | 살아있음 (min-instances=0 idle, 비용 0). 48~72h 후 수동 cleanup 예정 |
| 당장 해야 할 일은? | Sentry User Auth Token revoke 1건뿐 |
| 48~72h 후 할 일은? | HUMAN-UAT + cleanup script 실행 (cutover_date+3일 이후 언제든) |
| Rollback 가능한가? | 네, `./scripts/rollback-cutover.sh restore` 로 즉시 api-only 상태 복귀 |

---

## 1. 세션 시작 시점 상태 (2026-04-23 새벽)

- 브랜치 `gsd/phase-13-grapit-grabit-rename` 에 13 커밋 보관 (main 미머지)
- Wave 1 (13-01 코드/설정 rename): 완료, SUMMARY 작성
- Wave 2 (13-02 카피): 완료, SUMMARY 작성 (Wave 1 bulk rename 에 흡수되어 no-op)
- Wave 3 (13-03 인프라): 코드 3 commit 만 있고 "DNS 이전 대기" 로 pause
- Wave 4 (13-04 cutover): 미착수
- DNS: `heygrabit.com` 등록만 되어 있고 nameserver 권한은 이전 회사(ICONS) 보유, 레코드 0건
- `.continue-here.md` 에 blocking anti-pattern 3건 + 재개 체크리스트 기록됨

## 2. 세션 중 처리 순서 (시간 축)

### Phase A — DNS 이전 + Wave 3 재개 전제 충족 (새벽 ~ 오전)

1. 사용자 후이즈 로그인 → NS 위임을 `후이즈 기본 NS (whoisdomain.kr)` 로 전환
2. 전환 후 "네임서버 고급설정" → **CNAME 레코드 관리** → `api.heygrabit.com → ghs.googlehosted.com` 등록 (당시 Cloud Run domain-mapping 전제)
3. Google Search Console apex 소유권 검증:
   - TXT 값 발급: `google-site-verification=MAmYeWlUkQGUo_Sq4g5j0Wb0lzZN5gkZa4TRHqUWe3A`
   - 후이즈 "SPF 레코드 신청정보" 섹션에 등록 (실제로는 TXT 레코드로 발행)
   - Search Console "확인" 성공
4. **Sentry slug rename (자동, Sentry API)**:
   - `node-nestjs` → `grabit-api`, `javascript-nextjs` → `grabit-web`
   - DSN 불변 확인 (D-02 exception 조건 충족)
5. **GitHub variable 갱신**:
   - `CLOUD_RUN_API_URL = https://api.heygrabit.com` (`gh variable set`)

### Phase B — Wave 3 실행 (main 머지 + Cloud Run 신규 기동)

6. `gsd/phase-13-...` 브랜치를 `main` 에 merge + push → CI 첫 시도 **실패** (E2E `loginAsTestUser` 401)
7. 원인: CI secret `TEST_USER_EMAIL` 이 구 `admin@grapit.test` 상태. seed.mjs 는 Phase 13 에서 `admin@grabit.test` 로 rename됨
8. `gh secret set TEST_USER_EMAIL admin@grabit.test` → CI 재실행 → success → Deploy success
9. 신규 Cloud Run 서비스 `grabit-api` (`grabit-api-d3c6wrfdbq-du.a.run.app`), `grabit-web` (`grabit-web-d3c6wrfdbq-du.a.run.app`) 기동 확인

### Phase C — asia-northeast3 domain-mapping 미지원 발견 → LB 경로 전환

10. `gcloud beta run domain-mappings create --service=grabit-api --domain=api.heygrabit.com --region=asia-northeast3` 실행 → **501 UNIMPLEMENTED** 에러
11. 공식 문서 2개 교차 검증 — domain-mapping 지원 리전 10개에 `asia-northeast3` **미포함**. Cloud Run Integrations 는 "no longer supported"
12. 공식 Recommended 경로 = **Global External HTTPS Load Balancer + Serverless NEG** 로 전환
13. LB 9단 스택 생성:
    - `grabit-api-ip` (Global Static IPv4 = `34.117.215.31`)
    - `grabit-api-neg` (Serverless NEG → `grabit-api`)
    - `grabit-api-backend` (Global Backend Service, EXTERNAL_MANAGED)
    - `grabit-api-urlmap` (URL Map, default=grabit-api-backend)
    - `grabit-api-cert` (Google-managed SSL for `api.heygrabit.com`)
    - `grabit-api-proxy` (Target HTTPS Proxy)
    - `grabit-api-forwarding` (Global Forwarding Rule, 443)
14. 사용자 DNS 교체: `api` CNAME 삭제 → `api` A 레코드 `34.117.215.31` 추가 (후이즈 네임서버 고급설정 → A 레코드 관리)
15. SSL cert `grabit-api-cert` — DNS 전파 후 **10분 내 ACTIVE**

### Phase D — D-13 재배포 + D-12 Sentry event 검증

16. Empty commit (`faf1575`) → CI → Deploy → Cloud Run env 새 `CLOUD_RUN_API_URL=api.heygrabit.com` 반영
17. D-12 API 측 Sentry test endpoint (`GET /api/v1/admin/_sentry-test`) 호출 → eventID=`86c6c59...` Sentry `grabit-api` 프로젝트에서 FOUND
18. D-12 Web 측 호출 → **404 반환** 발견
    - 원인 1: `apps/web/app/admin/_sentry-test/` 디렉토리 — Next.js App Router 의 `_` prefix private folder 규칙으로 라우팅 제외
    - 원인 2: `deploy.yml` 의 `deploy-web` job 에 `SENTRY_DSN` 주입 누락 (기존 버그)
    - 원인 3: `sentry-dsn` Secret Manager 값 = API DSN. web 에 그대로 쓰면 event 가 api 프로젝트로 섞임
19. 3-커밋 fix:
    - `9d95438` rename `_sentry-test` → `sentry-test`
    - `aae05e3` deploy.yml web `SENTRY_DSN=sentry-dsn:latest` 임시
    - `ebaa317` Secret Manager `sentry-dsn-web` 신설 + deploy.yml 교체 (IAM 바인딩 `grapit-cloudrun@ → secretmanager.secretAccessor`)
20. 재배포 후 D-12 Web eventID=`44e8230...` Sentry `grabit-web` 프로젝트 FOUND → 프로젝트 격리 복원

### Phase E — Wave 3 마감 + `.continue-here.md` 제거

21. `13-03-SUMMARY.md` 작성
22. ROADMAP / STATE 업데이트 (13-03 [x], Wave 3 shipped)
23. `.continue-here.md` 삭제 (pause 해제)
24. 커밋 `f4efc5a`

### Phase F — Wave 4 경로 재설계 + apex cutover

25. Plan `13-04-PLAN.md` 리뷰 → **전제 3건 오류** 식별:
    - `gcloud beta run domain-mappings` 사용 가정 → asia-northeast3 미지원 (Wave 3 동일 이슈)
    - 구 apex 매핑 `heygrabit.com → grapit-web` 존재 가정 → 실측 결과 DNS 자체 없음
    - Cleanup D-14 gate [2] 의 `domain-mappings describe` → LB 환경 부적합
26. Wave 3 LB 전략 **승계** — 기존 스택 재사용 + URL Map host-rule + 멀티 cert SNI 로 확장
27. `scripts/rollback-cutover.sh` (LB URL Map 기반), `scripts/cleanup-old-grapit-resources.sh` (D-14 LB-adapted), `13-HUMAN-UAT.md`, `.gitignore` (rollback.yaml) 작성
28. LB 확장 7단 실행:
    - `grabit-web-neg` (Serverless NEG → `grabit-web`)
    - `grabit-web-backend` (Global Backend Service)
    - `grabit-web-cert` (SSL for `heygrabit.com` + `www.heygrabit.com`)
    - URL Map host rules 추가 (api/apex/www 분기)
    - Target HTTPS Proxy sslCertificates 에 `grabit-web-cert` 추가 (SNI 공존)
29. 사용자 DNS: `heygrabit.com` apex A `34.117.215.31`, `www` A `34.117.215.31` 추가
30. SSL `grabit-web-cert` provisioning — 중간 `FAILED_NOT_VISIBLE` 일시 관찰 후 **38분 내 ACTIVE**
31. `gh variable set CLOUD_RUN_WEB_URL https://heygrabit.com`
32. Empty commit (`0690397`) → CI → Deploy → Cloud Run env 반영
33. 최종 health check — 3 호스트 HTTP 200, openssl s_client SNI 기반 cert 선택 정상
34. `13-04-SUMMARY.md` + ROADMAP/STATE 업데이트 + 커밋 `eda3d07`

---

## 3. 현재 프로덕션 상태 스냅샷

### 3.1 라이브 URL

| URL | Service | Cert CN | 응답 |
|-----|---------|---------|------|
| `https://heygrabit.com/` | grabit-web | `heygrabit.com` | 200 |
| `https://www.heygrabit.com/` | grabit-web | `heygrabit.com` (SAN 포함) | 200 |
| `https://api.heygrabit.com/api/v1/health` | grabit-api | `api.heygrabit.com` | 200 |

### 3.2 GCP 리소스 (신규 / 브랜드 `grabit`)

| 타입 | 이름 | 상태 |
|------|------|------|
| Artifact Registry | `grabit` (asia-northeast3) | 이미지 latest 보관 중 |
| Cloud Run service | `grabit-api` (asia-northeast3) | Ready=True, min-instances=0, max=5 |
| Cloud Run service | `grabit-web` (asia-northeast3) | Ready=True, min-instances=0, max=10 |
| Global Static IP | `grabit-api-ip` = 34.117.215.31 | 예약 중 |
| Serverless NEG | `grabit-api-neg` | → grabit-api |
| Serverless NEG | `grabit-web-neg` | → grabit-web |
| Backend Service | `grabit-api-backend` | NEG 연결 |
| Backend Service | `grabit-web-backend` | NEG 연결 |
| URL Map | `grabit-api-urlmap` | host rules: api / apex / www |
| SSL Certificate | `grabit-api-cert` | ACTIVE, domains=api.heygrabit.com |
| SSL Certificate | `grabit-web-cert` | ACTIVE, domains=heygrabit.com, www.heygrabit.com |
| Target HTTPS Proxy | `grabit-api-proxy` | 두 cert 모두 첨부 |
| Forwarding Rule | `grabit-api-forwarding` | 34.117.215.31:443 → proxy |
| Secret Manager | `sentry-dsn` | value = grabit-api DSN |
| Secret Manager | `sentry-dsn-web` | value = grabit-web DSN (신규) |
| IAM | `grapit-cloudrun@` → secretmanager.secretAccessor on sentry-dsn-web | 부여됨 |

### 3.3 GCP 리소스 (구 / 브랜드 `grapit` — 관찰 중)

| 타입 | 이름 | 상태 |
|------|------|------|
| Artifact Registry | `grapit` | 미사용, 삭제 대상 (cleanup) |
| Cloud Run service | `grapit-api` | 트래픽 0 예상, 삭제 대상 |
| Cloud Run service | `grapit-web` | 트래픽 0 예상, 삭제 대상 |
| IAM SA | `grapit-cloudrun@grapit-491806` | **유지** (D-05: IAM 바인딩 재설정 리스크 회피) |
| GCP Project ID | `grapit-491806` | **유지** (D-01: 불가역 제약) |

### 3.4 외부 서비스

| 서비스 | 상태 |
|--------|------|
| Sentry `grabit-api` (project 4511182797406208) | events 수신 중 |
| Sentry `grabit-web` (project 4511182780432384) | events 수신 중 |
| Kakao Developers callback | `https://api.heygrabit.com/...` 병행 등록 (구 run.app URL 도 allow-list 에 남음) |
| Naver Developers callback | 동일 |
| Google Cloud Console OAuth callback | 동일 |
| Resend email sender | `grapit.com` 기반 (D-15 이관 대상) |
| Infobip SMS sender ID | alphanumeric `Grabit` 알려짐 (D-15 이관 대상) |
| heygrabit.com legal mailbox | 미개설 (D-15 이관 대상) |

### 3.5 GitHub Repo 상태

| 항목 | 값 |
|------|-----|
| Variables | `CLOUD_RUN_API_URL=https://api.heygrabit.com`, `CLOUD_RUN_WEB_URL=https://heygrabit.com` |
| Secrets | `TEST_USER_EMAIL=admin@grabit.test` (나머지는 변경 없음) |
| Branch | `main` (최신 `eda3d07`) — Wave 3/4 전부 병합됨 |
| `gsd/phase-13-grapit-grabit-rename` | 보존됨, PR 불필요 (이미 머지) |
| DNS provider | 후이즈 (whoisdomain.kr NS) |

---

## 4. 나중에 할 일 (우선순위 순)

### 🔴 즉시 (오늘)

- [ ] **Sentry User Auth Token revoke**
  - URL: https://sentry.io/settings/account/api/auth-tokens/
  - 토큰 이름: `phase-13-grabit-rename` (or 본인이 만든 이름)
  - 🗑 Revoke 클릭
  - 30초 안에 끝남. 늦어도 며칠 내에 반드시 처리.

### 🟡 48~72h 내 (2026-04-25~04-26 예상)

- [ ] **HUMAN-UAT 실기기 테스트** — `.planning/phases/13-grapit-grabit-rename/13-HUMAN-UAT.md` § User-Facing Verification
  - 카카오 로그인: `https://heygrabit.com` → 카카오 로그인 → 가입자 정보 확인
  - 네이버 로그인: 동일
  - 구글 로그인: 동일
  - 비밀번호 재설정 요청 → 실제 메일박스 수신 확인 — subject `[Grabit] 비밀번호 재설정` 포함
  - 회원가입 SMS OTP 요청 → 실제 단말 수신 확인 — body `[Grabit] 인증번호 XXXXXX (3분 이내 입력)`
  - 완료 체크리스트에 서명 (실명 + 날짜)

- [ ] **OAuth 3종 콘솔 구 callback URL 제거** — HUMAN-UAT 통과 직후
  - Kakao: `https://developers.kakao.com/console/app/{APP_ID}/config/platform` — Redirect URI 중 `grapit-*.run.app` / `grapit-api-d3c6wrfdbq-du.a.run.app` 기반 URL 삭제
  - Naver: `https://developers.naver.com/apps/#/myapps/{APP_ID}/api` — Callback URL 중 구 run.app URL 삭제
  - Google: `https://console.cloud.google.com/apis/credentials` — Authorized redirect URIs 중 구 run.app URL 삭제

### 🟢 cutover_date + 3~7일 후 (2026-04-26 이후)

- [ ] **구 grapit-* 리소스 cleanup** (D-14 hard gate 3종 통과 전제)
  ```bash
  ./scripts/cleanup-old-grapit-resources.sh grapit-491806 --confirm-after-date 2026-04-26
  ```
  - Gate [1]: 오늘 날짜 ≥ 인자 날짜 확인
  - Gate [2]: URL Map host rule 정합성 확인 (api → grabit-api-backend, apex/www → grabit-web-backend)
  - Gate [3]: 최근 24h grapit-* 서비스 트래픽 log empty
  - 성공 시: Cloud Run `grapit-api`/`grapit-web` 삭제 + AR repo `grapit` 삭제
  - Sentry "구 grapit-* 프로젝트" 는 해당 없음 (slug rename 방식 사용했기에 실제 구 프로젝트 미존재)

- [ ] **rollback.yaml 로컬 파일 삭제**
  ```bash
  rm rollback.yaml
  ```
  - `.gitignore` 되어 있어 실수로 커밋될 걱정은 없지만 관찰 종료 후 정리

### 🔵 수 주 ~ 수 개월 후 (운영 연동)

- [ ] **Resend verified sender `heygrabit.com` 등록**
  - 현재: `grapit.com` 기반 transactional email
  - 목표: SPF/DKIM/DMARC 를 `heygrabit.com` 기준으로 재구성
  - 수신율 모니터링 필요

- [ ] **Infobip sender ID `Grabit` 한국 KISA 등록**
  - 현재: alphanumeric `Grabit` 로 발신 (SMS body 표기만)
  - 목표: 공식 sender ID 등록으로 수신 신뢰도 상승
  - 한국 KISA 심사 별도 절차

- [ ] **legal mailbox `legal@heygrabit.com` 실제 메일박스 개설**
  - 현재: legal 문서에 `legal@heygrabit.com` 표기만 존재, 실제 받을 박스 없음
  - 목표: MX 레코드 + receive-only 메일박스 (Google Workspace / Zoho / Resend MX 등)
  - 외부 문의/권리침해 신고 대응 창구 가동

- [ ] **구 `grapit` DNS / 이메일 도메인 처리**
  - `grapit.com` 자체가 본인 소유인지 여부에 따라 다름 (보유 중이면 리다이렉트 or 유지, 미보유면 걱정 없음)
  - 현재 세션 스코프 밖. 필요 시 별도 작업

---

## 5. Rollback 가이드

### 전체 Wave 4 rollback (apex 매핑 제거 → api-only 로 복귀)

```bash
./scripts/rollback-cutover.sh restore
```

수행 작업:
- URL Map `grabit-api-urlmap` 에서 `web-matcher`, `api-matcher` path-matcher 제거
- `set-default-service grabit-api-backend` 로 복귀
- Target HTTPS Proxy 에서 `grabit-web-cert` 분리 (api cert 만 유지)

결과: `heygrabit.com` / `www.heygrabit.com` 접근 시 502/SSL 에러 (의도됨), `api.heygrabit.com` 은 그대로 200.

### Wave 3 rollback (api 도 롤백) — **극단적 경우에만**

DNS A 레코드 `api` 삭제 후 구 callback URL 로 OAuth 환경변수 되돌림. 구 Cloud Run 이 살아있는 한 복구 가능. 다만 이 시점에서는 `scripts/rollback-cutover.sh` 범위 밖이라 수동.

### 구 grapit-* 서비스 보존 권장 기간

최소 **72시간** (주말 트래픽 패턴 관찰 목적). 권장 **7일**. 삭제 전 `gcloud logging read` 로 24h 트래픽 0 확인 필수 (cleanup script 에 embed 되어 있음).

---

## 6. 주요 결정 & 학습

### 결정

| 이슈 | 결정 | 근거 |
|------|------|------|
| asia-northeast3 domain-mapping 불가 | Global HTTPS LB + Serverless NEG + URL Map host-rule | 공식 문서 Recommended 경로, 리전 이동 시 Valkey 지역 일치 깨짐 |
| Sentry 프로젝트 구조 | 신규 생성 대신 slug rename (DSN 불변) | D-02 exception — Secret Manager/GH secret 갱신 비용 절감 |
| grabit-web 의 server-side DSN | `sentry-dsn-web` secret 신설 (api 와 분리) | 프로젝트 격리, D-12 검증 의도 보존 |
| Wave 3 후 Wave 4 타이밍 | 즉시 진행 (관찰 기간 0) | 사용자 요청, heygrabit.com 은 신규 도메인이라 cutover 영향 0 |
| 구 grapit-* 리소스 | 최소 3~7일 보존 | D-14 gate 통과 전제, 비용 0, 긴급 롤백 여유 |
| Sentry token 전달 방식 | 직접 메시지 (일회성) | sentry-cli 미설치, env var 미구성, 작업 즉시 종료 후 revoke 안내 |

### 이번 세션에서 드러난 숨은 버그 (전부 해소)

1. Next.js App Router `_` prefix private folder 규칙 — `_sentry-test` 404
2. `deploy.yml` `deploy-web` job 에서 `SENTRY_DSN` 환경변수 누락 (기존 버그, D-12 endpoint 가 드러냄)
3. CI secret `TEST_USER_EMAIL` 이 Phase 13 seed rename 반영 안 됨 (CI E2E 401)
4. Plan 13-04 의 apex cutover 가정 오류 (기존 매핑 존재 전제 / domain-mapping 사용 가정) — LB 경로로 재설계

---

## 7. 관련 문서 & 명령어

### 문서
- `.planning/phases/13-grapit-grabit-rename/13-03-SUMMARY.md` — Wave 3 상세
- `.planning/phases/13-grapit-grabit-rename/13-04-SUMMARY.md` — Wave 4 상세 + D-15 Additional post-phase tasks
- `.planning/phases/13-grapit-grabit-rename/13-HUMAN-UAT.md` — cutover-day 체크리스트
- `.planning/ROADMAP.md` — Phase 13 4/4 완료 반영
- `.planning/STATE.md` — v1.1 milestone 91%

### 스크립트
- `./scripts/rollback-cutover.sh {capture|restore}` — LB URL Map 기반 롤백
- `./scripts/cleanup-old-grapit-resources.sh <PROJECT> --confirm-after-date YYYY-MM-DD` — 7-day 유예 cleanup (D-14 hard gate 3종)
- `./scripts/audit-brand-rename.sh` — SC-1 ~ SC-4 audit (CI 에도 포함)
- `./scripts/provision-grabit-infra.sh <PROJECT>` — idempotent 블루 인프라 프로비저너 (Wave 3 에서 사용, 이후 불필요)

### 빠른 검증 명령
```bash
# 3-host health
for h in heygrabit.com www.heygrabit.com api.heygrabit.com; do
  url="https://$h/"; [[ "$h" == api.* ]] && url="https://$h/api/v1/health"
  echo "$h: $(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url")"
done

# SNI cert 확인
for h in heygrabit.com www.heygrabit.com api.heygrabit.com; do
  echo "$h: $(openssl s_client -connect $h:443 -servername $h </dev/null 2>/dev/null | grep 'subject=' | head -1)"
done

# 구 grapit-* 트래픽 체크 (cleanup 전 필수)
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name=("grapit-web" OR "grapit-api")' \
  --project=grapit-491806 --freshness=24h --limit=5 --format='value(timestamp)'
# empty 반환되어야 cleanup 진행 가능

# URL Map host rule 확인
gcloud compute url-maps describe grabit-api-urlmap --project=grapit-491806 --format=json \
  | python3 -c "import sys,json;d=json.load(sys.stdin);[print(r) for r in d['hostRules']]"
```

### 주요 URL
- 프로덕션: https://heygrabit.com
- Cloud Run (fallback): https://grabit-web-d3c6wrfdbq-du.a.run.app, https://grabit-api-d3c6wrfdbq-du.a.run.app
- GCP Console: https://console.cloud.google.com/home/dashboard?project=grapit-491806
- GitHub Actions: https://github.com/sangwopark19/grapit/actions
- Sentry: https://sentry.io/organizations/icons-vw/

---

## 8. 커밋 타임라인 (main, 이번 세션)

```
eda3d07 feat(13-04): Wave 4 apex cutover — LB URL Map 확장 + SNI 공존
0690397 chore(13-04): Wave 4 trigger deploy with FRONTEND_URL=heygrabit.com
f4efc5a docs(13-03): complete Wave 3 tracking — SUMMARY + ROADMAP/STATE
ebaa317 fix(13-03): route grabit-web SENTRY_DSN to sentry-dsn-web secret
aae05e3 fix(13-03): inject SENTRY_DSN into grabit-web Cloud Run (D-12 gap)
9d95438 fix(13-03): rename web admin/_sentry-test → admin/sentry-test
faf1575 chore(13-03): D-13 second deploy — force env refresh after LB
f1a7759 Merge gsd/phase-13-grapit-grabit-rename (Wave 1-3, 158 files)
```

+ 외부 상태 변경 (git log 에 없음):
- GitHub secret `TEST_USER_EMAIL` rename
- GitHub variables `CLOUD_RUN_API_URL`, `CLOUD_RUN_WEB_URL` 갱신
- GCP LB 스택 15개 리소스 생성
- GCP Secret Manager `sentry-dsn-web` 신설
- Sentry project 2개 slug rename
- DNS 레코드 5건 추가 (api CNAME→A, apex A, www A, TXT verification)

---

**문서 작성:** 2026-04-23
**다음 리뷰 포인트:** 2026-04-26 (cleanup gate 통과 조건 확인)
**잔여 작업 owner:** Sangwoo Park (UAT) + ops (Resend/Infobip/mailbox)
