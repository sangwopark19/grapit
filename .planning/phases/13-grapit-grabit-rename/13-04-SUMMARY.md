---
phase: 13-grapit-grabit-rename
plan: 04
subsystem: apex-cutover
tags: [cutover, load-balancer, ssl, dns, grabit, heygrabit, d-09, d-14, d-15]

# Dependency graph
requires:
  - phase: 13-grapit-grabit-rename
    plan: 01
    provides: "`@grapit/*` → `@grabit/*` scope rename (production build 전제)"
  - phase: 13-grapit-grabit-rename
    plan: 02
    provides: "사용자 노출 카피 정리 (UI `Grabit`, legal `@heygrabit.com`, email/SMS `[Grabit]`)"
  - phase: 13-grapit-grabit-rename
    plan: 03
    provides: "Global HTTPS LB 스택(static IP 34.117.215.31, URL Map `grabit-api-urlmap`, Target HTTPS Proxy `grabit-api-proxy`, SSL cert `grabit-api-cert` ACTIVE), api.heygrabit.com 서브도메인 live, Sentry slug `grabit-api`/`grabit-web`, Secret Manager `sentry-dsn` / `sentry-dsn-web`, OAuth 3종 callback URL 병행 등록"
provides:
  - "SC-3 gate 완결: apex heygrabit.com + www.heygrabit.com 이 grabit-web Cloud Run 에 연결되어 웹 접속 200, api.heygrabit.com 은 grabit-api (Wave 3 유지) — 브랜드 식별자 기반 3-호스트 라우팅 완성"
  - "D-09 cutover 완결: CLOUD_RUN_WEB_URL=https://heygrabit.com, CLOUD_RUN_API_URL=https://api.heygrabit.com (OAuth callback SoT 유지)"
  - "Rollback 스크립트 준비 (LB URL Map 기반, apex 대상): `scripts/rollback-cutover.sh {capture|restore}`, `rollback.yaml` gitignored"
  - "Cleanup 스크립트 (D-14 LB-adapted hard gate 3종): `scripts/cleanup-old-grapit-resources.sh`"
  - "HUMAN-UAT 체크리스트 (`13-HUMAN-UAT.md`): pre-cutover/cutover/UAT/rollback-trigger/7-day-grace 섹션"
  - "D-15: Additional post-phase tasks 블록 (본 SUMMARY 하단) — legal mailbox/Resend/Infobip 이관 항목 명시, 실제 잔여 여부는 PROJECT.md Concerns 에 반영"
affects: []

# Tech tracking
tech-stack:
  added:
    - "Serverless NEG: grabit-web-neg (asia-northeast3 → grabit-web Cloud Run)"
    - "Backend Service (global, EXTERNAL_MANAGED): grabit-web-backend → grabit-web-neg"
    - "Google-managed SSL cert: grabit-web-cert (domains: heygrabit.com, www.heygrabit.com, ACTIVE)"
    - "URL Map host-based routing: api-matcher (api.heygrabit.com → grabit-api-backend), web-matcher (heygrabit.com, www.heygrabit.com → grabit-web-backend)"
    - "Target HTTPS Proxy SNI 공존: grabit-api-cert + grabit-web-cert 이중 첨부"
  patterns:
    - "Plan 원안의 `gcloud beta run domain-mappings create --domain=heygrabit.com` (apex cutover) 경로는 asia-northeast3 미지원 — Wave 3 경로 선택(Global HTTPS LB + Serverless NEG) 과 동일 패턴으로 연장 (URL Map host rule + 멀티 cert SNI)"
    - "기존 Wave 3 LB 스택(static IP, Target HTTPS Proxy, URL Map)을 **재사용** 하고 NEG/Backend/cert/host-rule 만 추가 — 비용 증가 없이 apex 수용"
    - "Rollback 경로 단순화: 기존 cutover 모델 (old-service delete + new-service create) 대신 URL Map host-rule remove + SSL cert detach 로 즉시 api-only 복귀 가능"

key-files:
  created:
    - "scripts/rollback-cutover.sh — LB URL Map 기반 apex rollback (capture/restore)"
    - "scripts/cleanup-old-grapit-resources.sh — D-14 hard gate 3종(날짜/URL Map host rule routeName/24h traffic log) LB-adapted"
    - ".planning/phases/13-grapit-grabit-rename/13-HUMAN-UAT.md — cutover-day 체크리스트 + 7-day grace cleanup 안내"
    - ".planning/phases/13-grapit-grabit-rename/13-04-SUMMARY.md"
  modified:
    - ".gitignore — `rollback.yaml` 엔트리 추가 (T-13-23 mitigation)"
  external_state:
    - "(GCP) Serverless NEG `grabit-web-neg` (asia-northeast3 → grabit-web)"
    - "(GCP) Backend Service `grabit-web-backend` (global, EXTERNAL_MANAGED)"
    - "(GCP) SSL cert `grabit-web-cert` (heygrabit.com + www.heygrabit.com, ACTIVE)"
    - "(GCP) URL Map `grabit-api-urlmap` — hostRules + pathMatchers 확장 (api-matcher, web-matcher)"
    - "(GCP) Target HTTPS Proxy `grabit-api-proxy` — sslCertificates = [grabit-api-cert, grabit-web-cert]"
    - "(DNS) heygrabit.com A = 34.117.215.31, www.heygrabit.com A = 34.117.215.31"
    - "(GitHub) variable CLOUD_RUN_WEB_URL = https://heygrabit.com (Wave 3 의 .run.app 에서 apex 로 교체)"

key-decisions:
  - "Plan 원안의 Task 3 (`gcloud beta run domain-mappings create --domain=heygrabit.com --service=grabit-web`) 은 asia-northeast3 미지원 확정 (Wave 3 학습) — URL Map host-rule add + 멀티 cert SNI 로 전환. 이로써 static IP / forwarding rule / target proxy 재사용."
  - "기존 cutover 가정(구 grapit-web 이 apex 에 매핑되어 있어 delete+create 필요)은 **사실이 아님** — heygrabit.com apex 는 이전에 매핑된 적 없음 (dig 실측 확인). 따라서 Plan Task 1 의 rollback.yaml capture 는 URL Map 상태 dump 로 대체 (apex 구 매핑 없음)."
  - "SSL cert 발급 대기 중 domainStatus 가 일시 `FAILED_NOT_VISIBLE` 관찰됨 — Google 내부 재시도 후 ACTIVE 로 전환 (총 소요 약 38분). Wave 3 단일 도메인(10분) 대비 느렸지만 최종 성공."
  - "Plan Task 4 (OAuth 3종 콘솔 callback URL 등록) 는 Wave 3 대기 중 선행 완료되어 Wave 4 에서 별도 작업 없음. Wave 4 는 기존 등록 상태 유지 확인만."
  - "Plan Task 5 (7-day grace cleanup) 는 본 SUMMARY 시점 **미실행** — cutover 직후 관찰 기간이 필요. 사용자가 단축안 희망 시 `--confirm-after-date=$(date +%F -d '+7 days')` 기준으로 별도 실행 필요."
  - "Plan Task 6 (D-15 Additional post-phase tasks 이관) 은 아래 하단 블록에 명시. PROJECT.md Concerns 업데이트는 실제 deferred 항목 (legal mailbox/Resend/Infobip sender ID) 유무에 따라 별도 판단 필요 — 기존 운영 체계에 이미 반영된 경우 skip."
  - "Plan 원안의 D-14 gate [2] `gcloud beta run domain-mappings describe --domain=heygrabit.com --format='value(spec.routeName)'` 는 LB 기반으로 전환됨 — `gcloud compute url-maps describe grabit-api-urlmap --format=json` 의 hostRules + pathMatchers 를 파싱해 `heygrabit.com` → `grabit-web-backend`, `api.heygrabit.com` → `grabit-api-backend` 를 검증."
  - "rollback.yaml 캡처 내용은 URL Map yaml + 현재 Target HTTPS Proxy sslCertificates 목록 — restore 시 `remove-path-matcher` 와 `set-default-service grabit-api-backend` 조합으로 Wave 3 상태로 복귀."

patterns-established:
  - "asia-northeast3 Cloud Run 다중 도메인 라우팅 = 단일 Global HTTPS LB + URL Map host-rule + 멀티 cert SNI 패턴. 향후 추가 도메인(예: admin.heygrabit.com, status.heygrabit.com) 도 동일 구조로 확장 — (a) NEG/Backend 신규 or 기존 공유, (b) SSL cert 신규 생성 후 target proxy 첨부, (c) URL Map host-rule 추가"
  - "Google-managed SSL cert 발급은 A 레코드 + target proxy 첨부 후 5~60분 범위. 중간 `FAILED_NOT_VISIBLE` 상태는 재시도 중 일시 관찰 가능 — 30분 이내 자동 회복 기대."
  - "LB SNI 전파는 cert ACTIVE 직후에도 1~2분 지연 가능 — `openssl s_client -servername <host>` 로 실제 반환 cert 확인 후 HTTPS curl 성공 판정."

verification:
  sc_mapping:
    - sc: SC-3
      status: pass
      note: "apex heygrabit.com (grabit-web) + www (grabit-web) + api.heygrabit.com (grabit-api) 모두 HTTP 200 — SC-3 `prod Cloud Run 서비스가 grabit 식별자로 정상 동작` 완전 달성. 구 grapit-* 서비스는 관찰 기간 유지 후 cleanup script 로 삭제 예정."
    - sc: SC-4
      status: pass
      note: "active phase 외 폴더(milestones/, completed phases, quick/) 변경 0건. LOW #11 예외 적용 (active 13-* 내부 SUMMARY/UAT 생성만 허용)."
  acceptance_evidence:
    - "health: `curl -sS https://heygrabit.com/` → HTTP 200, SNI cert CN=heygrabit.com (Google Trust Services WR3)"
    - "health: `curl -sS https://www.heygrabit.com/` → HTTP 200, SNI cert CN=heygrabit.com"
    - "health: `curl -sS https://api.heygrabit.com/api/v1/health` → HTTP 200, SNI cert CN=api.heygrabit.com"
    - "SSL cert: grabit-web-cert status=ACTIVE, domains=heygrabit.com;www.heygrabit.com"
    - "URL Map: host api.heygrabit.com → api-matcher → grabit-api-backend, host heygrabit.com/www.heygrabit.com → web-matcher → grabit-web-backend (gcloud compute url-maps describe --format=json)"
    - "Target HTTPS Proxy: sslCertificates = [grabit-api-cert, grabit-web-cert]"
    - "D-13 재배포: grabit-api env FRONTEND_URL=https://heygrabit.com (Cloud Run 최신 revision 반영), OAuth callback env 3종 api.heygrabit.com 유지"
    - "CI run 24826072669 success; Deploy run 24826202215 success (deploy-api + deploy-web 양쪽)"
    - "scripts: `test -x scripts/rollback-cutover.sh && test -x scripts/cleanup-old-grapit-resources.sh` exit 0"
    - "`.gitignore` rollback.yaml: `git check-ignore -q rollback.yaml` exit 0"
  deferred_tasks:
    - "HUMAN-UAT 실기기 테스트 (카카오/네이버/구글 로그인 E2E + 비밀번호 재설정 이메일 + SMS OTP 수신) — 사용자 직접 수행, 13-HUMAN-UAT.md `## User-Facing Verification` 섹션 체크"
    - "7일 관찰 후 cleanup: `./scripts/cleanup-old-grapit-resources.sh grapit-491806 --confirm-after-date YYYY-MM-DD`"
    - "구 Cloud Run 서비스 `grapit-api` / `grapit-web`, AR repo `grapit` 삭제 (위 cleanup 로 일괄)"
    - "OAuth 3종 콘솔에서 구 run.app callback URL 삭제 (Wave 3 에서 병행 등록만 했으므로 cleanup 시점에 제거)"
    - "Sentry User Auth Token `phase-13-grabit-rename` revoke (Wave 3 진행 중 생성, cutover 완료 후 불필요)"

# Additional post-phase tasks (D-15 carryover)
# Plan 02 legal MD 의 deferred HTML 주석은 Wave 1-2 에서 bulk rename 에 흡수되어 현재는 존재하지 않음
# (13-02-SUMMARY.md 의 D-15 negative audit 결과 참조). 그럼에도 불구하고 향후 운영 관점에서 추적이
# 필요한 항목은 아래와 같다:
additional_post_phase_tasks:
  - title: "legal-mailbox@heygrabit.com 실제 메일박스 개설"
    owner: "ops"
    trigger: "Wave 4 cutover 이후 30일 이내 외부 문의/권리침해 신고 대응 창구 가동"
    status: "pending — Resend 등 메일 서비스와 별개로, MX 레코드 + receive-only 메일박스 세팅 필요"
  - title: "Resend verified sender heygrabit.com 등록"
    owner: "ops"
    trigger: "Phase 13 cutover 이후 transactional email 수신율 모니터링 (SPF/DKIM 추가 설정)"
    status: "pending — 현재 Resend 는 기존 grapit.com 전제로 운영 중, heygrabit.com 전환 필요"
  - title: "Infobip sender ID `Grabit` 갱신"
    owner: "ops"
    trigger: "Phase 13 cutover 이후 SMS 발신자 표기가 기존 `Grapit` 로 남아있는지 확인 필요"
    status: "pending — 한국 KISA 송신자 ID 등록은 별도 절차; 현재 alphanumeric `Grabit` 대체 노출만 Wave 1-2 에서 반영됨"
  - title: "legacy OAuth callback run.app URL 정리"
    owner: "ops"
    trigger: "apex cutover + 7일 관찰 후 카카오/네이버/구글 콘솔 allow-list 에서 구 URL 제거"
    status: "pending — 7-day grace cleanup 단계 내 진행"

# Sequence note: this summary is written at Wave 4 completion on 2026-04-23,
# consolidating commits ebaa317..0690397 on main. Phase 13 production-side complete;
# 7-day cleanup + HUMAN-UAT manual verification are the only remaining items.
---

# Wave 4 — Apex 도메인 cutover 완료 (Plan 04)

## 1. 달성 요약

`https://heygrabit.com/`, `https://www.heygrabit.com/`, `https://api.heygrabit.com/api/v1/health` 세 호스트 모두 HTTP 200 수신. 기존 Wave 3 의 Global HTTPS LB 스택을 **확장** 하여 URL Map host-rule 과 멀티 cert SNI 로 apex 까지 수용. Plan 원안의 `gcloud beta run domain-mappings` 경로는 asia-northeast3 미지원이므로 Wave 3 전략을 그대로 승계.

## 2. 실행한 인프라 변경

1. `grabit-web-neg` (Serverless NEG, asia-northeast3 → grabit-web)
2. `grabit-web-backend` (Global Backend Service, EXTERNAL_MANAGED, NEG 연결)
3. `grabit-web-cert` (Google-managed SSL cert: heygrabit.com, www.heygrabit.com)
4. URL Map `grabit-api-urlmap` 확장:
   - hostRules 추가: `api.heygrabit.com` → api-matcher, `heygrabit.com`/`www.heygrabit.com` → web-matcher
   - pathMatchers 추가: api-matcher (→ grabit-api-backend), web-matcher (→ grabit-web-backend)
5. Target HTTPS Proxy `grabit-api-proxy` SSL cert 목록에 `grabit-web-cert` 추가 첨부 (SNI 공존)
6. DNS (사용자 수동): `heygrabit.com` A = 34.117.215.31, `www.heygrabit.com` A = 34.117.215.31
7. GitHub variable `CLOUD_RUN_WEB_URL` = `https://heygrabit.com`
8. Empty commit → CI/Deploy 재트리거 → Cloud Run env FRONTEND_URL 반영

## 3. 검증 결과 (요약)

```
$ curl -sS -o /dev/null -w "%{http_code}" https://heygrabit.com/
200
$ curl -sS -o /dev/null -w "%{http_code}" https://www.heygrabit.com/
200
$ curl -sS -o /dev/null -w "%{http_code}" https://api.heygrabit.com/api/v1/health
200
$ openssl s_client -connect heygrabit.com:443 -servername heygrabit.com </dev/null 2>/dev/null | grep subject
subject=CN=heygrabit.com
$ gcloud run services describe grabit-api --format='value(spec.template.spec.containers[0].env)' \
    | tr ';' '\n' | grep FRONTEND_URL
{'name': 'FRONTEND_URL', 'value': 'https://heygrabit.com'}
```

## 4. 롤백 경로

Wave 4 변경은 LB URL Map 확장 + cert 추가 첨부 뿐이므로, 긴급 롤백 시:
```
./scripts/rollback-cutover.sh restore
```
가 web-matcher/api-matcher path-matcher 를 제거하고 URL Map default-service 를 `grabit-api-backend` 로 되돌려, Wave 3 말미 상태 (api.heygrabit.com only) 로 즉시 복귀. `grabit-web-neg`/`grabit-web-backend`/`grabit-web-cert` 리소스는 보존되어 재-cutover 시 재사용 가능.

## 5. 잔여 작업

- HUMAN-UAT 실기기 테스트 (13-HUMAN-UAT.md § User-Facing Verification)
- 7-day grace cleanup 실행 (구 grapit-* 리소스 + AR repo + 구 OAuth callback URL 제거)
- Sentry User Auth Token revoke
