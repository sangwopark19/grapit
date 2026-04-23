---
phase: 13-grapit-grabit-rename
plan: 03
subsystem: infra-provisioning
tags: [infra, cloud-run, sentry, dns, load-balancer, grabit, heygrabit, d-09, d-12, d-13]

# Dependency graph
requires:
  - phase: 13-grapit-grabit-rename
    plan: 01
    provides: "`@grapit/*` → `@grabit/*` scope rename + `audit-brand-rename.sh` D-10 allowlist (deploy.yml 의 `pnpm --filter @grabit/api` 수정의 전제)"
  - phase: 13-grapit-grabit-rename
    plan: 02
    provides: "사용자-노출 카피 정리 (SC-2 green), Wave 3 cutover 관찰 구간 커뮤니케이션 기반"
provides:
  - "SC-3 gate 전반부 달성: prod Cloud Run 서비스 `grabit-api` / `grabit-web` 이 `grabit` 식별자 기반으로 신규 기동 (asia-northeast3, status=True)"
  - "D-09 완결: `api.heygrabit.com` 서브도메인이 Global External HTTPS Load Balancer 경유로 `grabit-api` 에 연결됨, OAuth callback SoT 확정"
  - "D-11 IAM 바인딩 사전 검증 통과 (deploy SA writer + grapit-cloudrun@ reader, 사전 프로비저닝 상태 그대로 유지)"
  - "D-12 Sentry captureException 기반 event 수신 검증 (api/web 각각 grabit-api/grabit-web 프로젝트로 이벤트 분리 도착)"
  - "D-13 second-deploy 후 Cloud Run env/build-arg 반영 확정 (`CLOUD_RUN_API_URL=api.heygrabit.com`, `CLOUD_RUN_WEB_URL=grabit-web .run.app`)"
  - "기존 버그 드러냄 + 해소: (a) Next.js App Router 의 `_` prefix private folder 규칙으로 `/admin/_sentry-test` 가 404 → `admin/sentry-test` 로 rename, (b) grabit-web 의 server-side `SENTRY_DSN` 누락 → `sentry-dsn-web` secret 신설 + deploy.yml 주입"
affects: [13-04]

# Tech tracking
tech-stack:
  added:
    - "Global External HTTPS Load Balancer (addresses + serverless NEG + backend-service + url-map + managed SSL + target-https-proxy + forwarding-rule)"
    - "Secret Manager secret: `sentry-dsn-web` (grabit-web 전용 DSN, project-level 이벤트 분리)"
  patterns:
    - "asia-northeast3 Cloud Run 커스텀 도메인은 domain-mappings v1beta1 미지원 → Global HTTPS LB + Serverless NEG 가 유일한 GA 경로 (공식 문서 확인)"
    - "SSL cert PROVISIONING 상태는 A 레코드 전파 후 Google 자동 검증 → ACTIVE 전환 (본 케이스 10분 소요)"
    - "Sentry slug rename (API 측): `node-nestjs` → `grabit-api`, `javascript-nextjs` → `grabit-web` — DSN 불변, Secret Manager/GH secret 갱신 불필요 (D-02 exception)"
    - "Next.js App Router `_` prefix 디렉토리 = private folder → route 제외 (SDK template 이 아닌 public diagnostic 엔드포인트에는 underscore 사용 금지)"

key-files:
  created:
    - "scripts/provision-grabit-infra.sh — idempotent blue provisioner (AR / IAM 가이드 / Cloud Run 검증 / domain-mapping helper)"
    - "apps/api/src/modules/admin/admin-diagnostics.controller.ts — D-12 admin-only `/api/v1/admin/_sentry-test` (NestJS, leading-`_` 라우팅 영향 없음)"
    - "apps/web/app/admin/sentry-test/route.ts — D-12 admin-only `/admin/sentry-test` (Next.js, leading-`_` private folder 회피)"
    - ".planning/phases/13-grapit-grabit-rename/13-03-SUMMARY.md"
  modified:
    - ".github/workflows/deploy.yml — AR_REPO/WEB_SERVICE/API_SERVICE env 3줄 rename + pnpm --filter @grabit/api + D-05 SA 유지 주석 + grabit-web SENTRY_DSN=sentry-dsn-web:latest 추가"
    - "apps/api/src/modules/admin/admin.module.ts — AdminDiagnosticsController 등록"
  external_state:
    - "(GCP) Artifact Registry repo `grabit` (asia-northeast3, docker) — 기존 프로비저닝 유지"
    - "(GCP) Cloud Run service `grabit-api` (asia-northeast3, status=True, url=grabit-api-d3c6wrfdbq-du.a.run.app)"
    - "(GCP) Cloud Run service `grabit-web` (asia-northeast3, status=True, url=grabit-web-d3c6wrfdbq-du.a.run.app)"
    - "(GCP) Global Static IPv4 `grabit-api-ip` = 34.117.215.31"
    - "(GCP) Serverless NEG `grabit-api-neg` → grabit-api, Backend Service `grabit-api-backend`, URL Map `grabit-api-urlmap`, Google-managed SSL `grabit-api-cert` (ACTIVE), Target HTTPS Proxy `grabit-api-proxy`, Forwarding Rule `grabit-api-forwarding` (443)"
    - "(GCP) Secret Manager `sentry-dsn-web` (grabit-web DSN), grapit-cloudrun@ secretAccessor 바인딩"
    - "(Sentry) project slug rename: node-nestjs → grabit-api, javascript-nextjs → grabit-web (DSN 불변)"
    - "(DNS, whois.co.kr → whoisdomain.kr NS 위임) heygrabit.com TXT `google-site-verification=MAmYe...`, api.heygrabit.com A 34.117.215.31"
    - "(GitHub) variable `CLOUD_RUN_API_URL=https://api.heygrabit.com`, `CLOUD_RUN_WEB_URL=https://grabit-web-d3c6wrfdbq-du.a.run.app`, secret `TEST_USER_EMAIL=admin@grabit.test`"

key-decisions:
  - "asia-northeast3 에서 Cloud Run domain-mappings v1beta1 이 미지원(`UNIMPLEMENTED: Creating domain mappings is not allowed in asia-northeast3.`) → 공식 문서 권장 경로인 Global External HTTPS LB + Serverless NEG 로 전환. Plan 원안의 `gcloud beta run domain-mappings create` 명령은 사용하지 않음. 리전 이동(asia-northeast1 등) 대안은 Valkey 지역 일치 깨짐 리스크로 기각."
  - "이전에 CNAME `api → ghs.googlehosted.com` 으로 등록했던 DNS 레코드는 LB 전환으로 A 레코드(`api → 34.117.215.31`)로 교체. Google Search Console TXT 소유권 검증은 발급된 SSL cert 가 DNS-01 챌린지를 통과하지는 않지만 Cloud Run domain-mappings 경로 전제였기에 남겨둠(재사용 가치)."
  - "Sentry 프로젝트 생성 대신 기존 `node-nestjs` / `javascript-nextjs` slug 를 API 로 rename (Sentry Dashboard UI 작업 없이 토큰 `project:admin` scope 로 일괄 처리). DSN 이 project ID 기반이라 slug 변경은 URL/UI 만 영향 — D-02 exception 경로 그대로."
  - "grabit-web 의 server-side `SENTRY_DSN` 을 sentry-dsn 이 아닌 신설된 `sentry-dsn-web` secret 으로 주입 — api event 와 web event 가 Sentry 프로젝트 레벨에서 분리되도록 강제 (Plan 원안 의도 보존). 임시 fallback (sentry-dsn API DSN 사용) 커밋은 후속 `ebaa317` 으로 바로 교정."
  - "Next.js `_sentry-test` 디렉토리는 private folder 규칙으로 라우팅 제외됨 → `sentry-test` 로 rename 하고 admin guard 는 handler 내부로 이동한 기존 구조 유지. NestJS API 측 `@Get('_sentry-test')` 는 영향 없어 그대로 보존 (재배포 비용 절감)."
  - "D-13 second-deploy 는 empty commit `faf1575` 로 CI→Deploy 재트리거. 이후 grabit-web DSN 경로 보정 커밋 `aae05e3`, `ebaa317` 이 실제 second-deploy 역할을 겸했다."
  - "TEST_USER_EMAIL CI secret 을 `admin@grapit.test` → `admin@grabit.test` 갱신 (Phase 13 seed rename 결과와 일치) — CI E2E 실패 직접 원인 해소. Prod DB 의 실제 admin 계정(`admin@grapit.test`)은 migrate 하지 않음 (운영 데이터 보호, D-12 검증에만 활용)."
  - "`.continue-here.md` 삭제 (Wave 3 재개 완료). 재개 조건으로 기록된 DNS/OAuth/Sentry 체크리스트는 이 SUMMARY 와 Wave 3 커밋 시퀀스로 대체됨."

patterns-established:
  - "Cloud Run 서울 리전(asia-northeast3) 커스텀 도메인 = Global HTTPS LB + Serverless NEG 고정 패턴 — 프로젝트 전반의 향후 서브도메인 추가 시 본 Wave 3 커밋 시퀀스(grabit-api-ip → grabit-api-neg → grabit-api-backend → grabit-api-urlmap → grabit-api-cert → grabit-api-proxy → grabit-api-forwarding)를 템플릿으로 사용."
  - "Sentry API slug rename 자동화 (curl + User Auth Token project:admin) — 2 프로젝트/30초. UI 클릭보다 멱등성 + 감사 용이."
  - "grabit-web server-side Sentry 는 `sentry-dsn-web` secret 경유 — 앞으로 웹 전용 error/event 가 web 프로젝트에 그대로 격리됨 (api 이벤트 섞임 방지)."
  - "D-12 admin diagnostic 엔드포인트 = admin guard + captureException(Error(marker)) + eventId 반환. 향후 비슷한 'Sentry 연동 검증' 에 재사용 가능한 패턴."

verification:
  sc_mapping:
    - sc: SC-3
      status: partial
      note: "SC-3 전반부 (prod Cloud Run `grabit-*` 정상 기동 + api 서브도메인 + Sentry 이벤트 검증) 달성. 나머지 절반(`heygrabit.com` apex cutover + 구 `grapit-*` Cloud Run/AR 정리) 은 Plan 04."
    - sc: SC-4
      status: pass
      note: "audit-brand-rename.sh ALL CHECKS PASSED — 완료된 phase 폴더/milestone 폴더 변경 0건."
  acceptance_evidence:
    - "health: `curl https://api.heygrabit.com/api/v1/health` → 200 `{\"status\":\"ok\",\"info\":{\"redis\":{\"status\":\"up\"}}}`"
    - "health: `curl https://grabit-api-d3c6wrfdbq-du.a.run.app/api/v1/health` → 200 (baseline, LB 없이도 정상)"
    - "health: `curl https://grabit-web-d3c6wrfdbq-du.a.run.app/` → 200"
    - "SSL: `gcloud compute ssl-certificates describe grabit-api-cert` → managed.status=ACTIVE, domainStatus api.heygrabit.com=ACTIVE"
    - "D-12 api: eventId=`86c6c597ec1647a39e889bd281860904`, Sentry API GET projects/icons-vw/grabit-api/events/{id}/ → 200 FOUND, title=`Error: phase-13 sentry-test <uuid>`, projectID=4511182797406208"
    - "D-12 web: eventId=`44e8230d2eaf4e3b9874037787925770`, Sentry API GET projects/icons-vw/grabit-web/events/{id}/ → 200 FOUND, title=`Error: phase-13 sentry-test <uuid>`, projectID=4511182780432384"
    - "D-13: grabit-api env 포함 KAKAO_CALLBACK_URL=https://api.heygrabit.com/api/v1/auth/social/kakao/callback (+ NAVER, GOOGLE 동일 호스트), FRONTEND_URL=https://grabit-web-d3c6wrfdbq-du.a.run.app"
    - "DNS: dig @8.8.8.8 api.heygrabit.com A +short → 34.117.215.31; dig @ns3.whoisdomain.kr heygrabit.com TXT +short → `google-site-verification=MAmYe...` (Google Search Console apex 소유권 확인 완료)"
    - "GitHub Actions: CI run 24822851404 / 24823218314 success, Deploy run 24819865915 / 24821170475 / 24822962470 / 24823328375 success (2번째 이후가 D-13 second-deploy 후속)"
  gaps_surfaced_then_closed:
    - "Next.js private folder 404 (apps/web/app/admin/_sentry-test/route.ts) — 커밋 `9d95438` 에서 rename 으로 해소"
    - "grabit-web SENTRY_DSN 누락 (기존 deploy.yml) — 커밋 `aae05e3` 에서 sentry-dsn 주입 후, 커밋 `ebaa317` 에서 sentry-dsn-web 으로 교체하여 프로젝트 분리 복원"
    - "CI TEST_USER_EMAIL secret 구 브랜드(grapit.test) 잔류 — 재실행 전에 `gh secret set TEST_USER_EMAIL` 로 갱신"

# Sequence note: this summary is written at Wave 3 completion on 2026-04-23,
# consolidating commits 0e4cace..ebaa317 on gsd/phase-13-grapit-grabit-rename
# merged into main via f1a7759. Wave 4 (apex cutover) tracked separately.
---

# Wave 3 — 인프라 식별자 프로비저닝 완료 (Plan 03)

## 1. 달성 요약

Phase 13 의 "블루-그린 cutover 블루 쪽 프로비저닝" 을 완료했다. `grabit` 식별자로 된 Cloud Run 두 서비스, asia-northeast3 의 Global HTTPS LB 스택, Sentry 프로젝트 slug rename, Secret Manager/GitHub 환경 변수 반영, D-12 Sentry 이벤트 수신 검증까지 모두 green. apex `heygrabit.com` 과 기존 `grapit-*` 정리는 Wave 4.

## 2. 경로 변경 (plan 과 실제 집행의 차이)

Plan 원안은 `gcloud beta run domain-mappings create --service=grabit-api --domain=api.heygrabit.com` 을 전제했으나, 실집행 중 asia-northeast3 에서 v1beta1 domain-mappings API 가 `UNIMPLEMENTED` 로 거부됨을 확인했다 (`Creating domain mappings is not allowed in asia-northeast3.`). 공식 문서(`cloud.google.com/run/docs/mapping-custom-domains`)에서 지원 리전 목록이 `asia-east1 / asia-northeast1 / asia-southeast1 / europe-{north1,west1,west4} / us-{central1,east1,east4,west1}` 로 제한되어 있음을 교차 검증, 나아가 "Cloud Run Integrations" 도 공식 CLI 에서 deprecated 상태로 확인되었다. 결과적으로 **Global External Application Load Balancer + Serverless NEG** (공식 Recommended 경로) 로 전환했다.

## 3. 주요 커밋 타임라인

| SHA | 내용 |
|-----|------|
| 5137325 | `deploy.yml` env rename (AR_REPO/WEB_SERVICE/API_SERVICE) + `pnpm --filter @grabit/api` + D-05 SA 주석 |
| 1caa2c6 | `admin-diagnostics.controller.ts` + `_sentry-test` route (api/web) 추가 |
| c3e1308 | `scripts/provision-grabit-infra.sh` (idempotent provisioner) |
| 67ebcd7 | `.continue-here.md` 작성 + DNS 이전 대기 pause |
| f1a7759 | main 머지 (Wave 1-3 code) |
| 24819625214 | CI 첫 시도 실패 — TEST_USER_EMAIL 구 브랜드 |
| — | `gh secret set TEST_USER_EMAIL` 갱신 + CI rerun |
| 24819865915 | Deploy 성공 — grabit-api/grabit-web 신규 기동 |
| — | Global HTTPS LB 스택 9단 프로비저닝 (grabit-api-ip=34.117.215.31 외) |
| — | 후이즈 DNS CNAME 삭제 + A 레코드 추가 (사용자) |
| — | Google Search Console TXT 소유권 검증 (사용자) |
| faf1575 | empty commit — D-13 second-deploy 트리거 |
| 9d95438 | `apps/web/app/admin/_sentry-test` → `sentry-test` (Next.js private folder 회피) |
| aae05e3 | grabit-web SENTRY_DSN 임시 주입 (sentry-dsn) |
| ebaa317 | grabit-web SENTRY_DSN 를 신규 `sentry-dsn-web` 으로 교체 (프로젝트 분리) |

## 4. 검증 결과 (요약)

- `api.heygrabit.com` 200 health, SSL cert ACTIVE (10분 provisioning)
- D-12 api event (`86c6c59...`) Sentry `grabit-api` 에서 FOUND
- D-12 web event (`44e8230...`) Sentry `grabit-web` 에서 FOUND
- D-13 second-deploy 후 Cloud Run env 재확인 완료
- SC-4 ALL CHECKS PASSED

## 5. Wave 4 에 남긴 상태

- apex `heygrabit.com` 은 여전히 구 `grapit-web` Cloud Run 도메인 매핑 (또는 미매핑) 상태. 본 Wave 에서 건드리지 않음.
- 구 `grapit-api` / `grapit-web` Cloud Run 서비스, 구 AR `grapit` 이미지 repo, 구 DSN 값(없음) — Wave 4 cutover 직후 순서대로 정리.
- OAuth 3종 콘솔은 구/신 callback URL 모두 allow-list 에 등록된 상태 (Wave 4 cutover 확정 후 구 URL 제거).
- `.continue-here.md` 는 Wave 3 커밋 시퀀스로 대체되어 제거 예정 (본 커밋 세트에 포함).
