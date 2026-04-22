# Phase 13: 브랜드명 grapit → grabit 일괄 rename - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

코드/문서/설정/사용자 노출 카피/인프라 식별자에서 `grapit`을 `grabit`으로 치환한다. 확정 도메인 `heygrabit.com` 런칭 전에 브랜드 정합성을 확보하는 것이 목적이며, 새로운 capability를 추가하지 않는다.

**이번 phase가 포함하는 것:**
- 모노레포 패키지명(`@grapit/*` → `@grabit/*`)과 npm scope
- pnpm-workspace · Dockerfile · docker-compose.yml · turbo 설정
- GitHub Actions workflow 환경변수·서비스명
- 이메일 템플릿 · SMS 발신자명 · UI 카피 · meta/title · seed 데이터
- 새로운 Cloud Run 서비스(`grabit-web`/`grabit-api`) 생성 및 도메인 cutover
- 새로운 Sentry 프로젝트 · 새로운 Artifact Registry 저장소

**이번 phase가 포함하지 않는 것 (deferred 참조):**
- prod DB 이름·ROLE·DATABASE_URL 자체의 rename
- 로컬 레포 디렉토리 rename(/icons/grapit)
- 완료된 milestone/phase 기록, 과거 commit message
- `.planning/`, `.playwright-mcp/` 자동 생성 파일

</domain>

<decisions>
## Implementation Decisions

### prod DB rename 범위

- **D-01:** prod DB는 **앱 레벨만 rename**한다. DB 이름(`grapit_prod`)·ROLE·DATABASE_URL 식별자는 그대로 유지하고, 코드·환경변수 이름·로그 메시지만 `grabit`으로 바꾼다.
- **근거:** 1인 개발 · 런칭 전 롤백 가능성 확보 · 외부에서 DB 이름을 보는 사람이 없음 · DB rename은 연결 풀 재시작/다운타임 유발. 식별자 rename으로 얻는 가치 대비 리스크가 과함.
- **영향:** docker-compose.yml의 `POSTGRES_PASSWORD: grapit_dev`(dev) 같은 로컬 문자열도 in-place 유지.

### Cloud Run 서비스 전환 전략

- **D-02:** 새 `grabit-web`/`grabit-api` Cloud Run 서비스를 별도로 생성하고, 도메인(`heygrabit.com`)을 **새 서비스에 매핑**하는 블루-그린 cutover 방식으로 전환한다. 함께 rename 대상은:
  - Cloud Run service names: `grapit-web` → `grabit-web`, `grapit-api` → `grabit-api`
  - Sentry projects: `grapit-web` → `grabit-web`, `grapit-api` → `grabit-api` (새 프로젝트 생성, 새 DSN 발급)
  - Artifact Registry 저장소/이미지명
  - `.github/workflows/deploy.yml` 의 `WEB_SERVICE`/`API_SERVICE` 변수
- **D-02b:** cutover 후 구 `grapit-*` 서비스·Sentry 프로젝트는 **7일 유예** 후 정리한다. DNS propagation·CDN TTL 해소·Sentry 히스토리 확인 시간 확보 목적.
- **근거:** Cloud Run 서비스명은 immutable이므로 새 서비스 생성이 유일한 방법. 블루-그린은 롤백 용이(도메인 mapping만 되돌리면 됨). 이미지 재빌드·Artifact Registry 설정·Sentry DSN 교체를 깔끔하게 분리.

### 레포 로컬 디렉토리 rename

- **D-03:** 로컬 레포 디렉토리(`/icons/grapit`) rename은 **이번 phase에 포함하지 않는다**. 개인 작업 path이며 프로젝트 산출물에 영향 없음.
- **근거:** 레포 path는 개인 환경 설정 · `.claude/worktrees`/CLAUDE 파일 등에 하드코딩된 경로 없음을 확인 · GitHub 원격 레포명은 별도 결정.

### Plan 분할 구조

- **D-04:** Phase 13은 **4개 plan**으로 분할한다.
  - **P1 — 코드/설정 rename:** 모노레포 `@grapit/*` import, `package.json` name/workspace, `pnpm-workspace.yaml`, `docker-compose.yml`, `Dockerfile`, `turbo.json`, `.github/workflows/*` 의 env/변수, seed.mjs 의 브랜드 문자열, next.config.ts/auth.ts 등 빌드·타입체크·린트 범위.
  - **P2 — 사용자 노출 카피:** 이메일 템플릿(`apps/api/src/modules/auth/email/`)·SMS 발신자명(`apps/api/src/modules/sms/sms.service.ts`)·UI 카피(`apps/web/`)·`<title>`/meta description/OpenGraph.
  - **P3 — 인프라 식별자 생성:** 새 Cloud Run 서비스(`grabit-web`/`grabit-api`) 프로비저닝 · 새 Sentry 프로젝트 생성 + DSN 교체 · 새 Artifact Registry 저장소 · `deploy.yml` `WEB_SERVICE`/`API_SERVICE` 갱신 + Secret Manager 키 이름(있다면) 복제.
  - **P4 — 도메인 cutover + 정리:** `heygrabit.com` 도메인을 새 서비스에 매핑 · 스모크 테스트 · 7일 후 구 `grapit-*` 서비스·Sentry 프로젝트 삭제 · HUMAN-UAT 체크리스트.
- **근거:** P1~P2는 순수 코드/문자열 rename이라 PR 리뷰·롤백 단위로 깔끔하게 분리됨. P3는 GCP 콘솔·Sentry 대시보드에서 manual step이 섞이므로 독립 plan. P4는 배포 cutover라 별도 HUMAN-UAT 필요.

### Open Question 해소 (2026-04-22 research 이후 결정)

- **D-05 (Q1 해소) — Cloud Run service account는 유지.** `grapit-cloudrun@...`는 이름 그대로 두고, deploy.yml/provision-valkey.sh 내 SA 참조도 변경하지 않는다. 근거: IAM 바인딩 14~16개 재생성 리스크 > 외부 미노출 식별자 rename 이익.
- **D-06 (Q2 해소) — dev/CI DB 식별자는 전부 rename.** `grapit_test`→`grabit_test`(ci.yml POSTGRES_DB + DATABASE_URL), `grapit-postgres`→`grabit-postgres`(docker-compose container_name), `POSTGRES_DB: grapit`→`grabit`(docker-compose, 있는 경우). **단 D-01의 `grapit_dev` password는 여전히 유지** (prod DB rename 제외 원칙의 연장).
- **D-07 (Q3 해소) — `@grapit.com` 이메일은 `@heygrabit.com`으로 전단 일괄 치환.** legal MD 4건(`support@`, `privacy@`), test fixture(`no-reply@`, `admin@*.test`, `@e2e.*.dev`, `@social.*.com`) 모두 heygrabit 도메인. P2에 "실제 mailbox 개설은 사업자등록 후 별도 작업" 노트 포함. 운영 mailbox가 없는 상태에서 legal 문서에 이메일 주소가 남는 건 인지된 deferred 이슈.
- **D-08 (Q4 해소) — OAuth callback URL 재등록은 P4 HUMAN-UAT에 포함.** 카카오/네이버/구글 개발자 콘솔에서 `https://heygrabit.com/auth/callback/{provider}` 를 신규 등록하는 작업을 P4 cutover 직전 수동 절차로 편성. P3 단계에서는 신규 callback 등록 없음(OAuth 테스트는 cutover 이후에만). **D-09에 의해 callback URL은 `https://api.heygrabit.com/api/v1/auth/social/{provider}/callback`로 확정 — 본 D-08 문구보다 D-09가 우선.**

### Review-driven Addendum (2026-04-22 post-codex REVIEWS)

13-REVIEWS.md (codex gpt-5.4, 2026-04-22)가 HIGH 3건 + MEDIUM 6건을 지적했다. 코드베이스 검증 후 모두 유효함을 확인하고 다음 결정을 추가한다.

- **D-09 — API 도메인 = `api.heygrabit.com` 서브도메인.** `grabit-api` Cloud Run 서비스에 별도 domain-mapping 생성. OAuth callback URL = `https://api.heygrabit.com/api/v1/auth/social/{provider}/callback` (안정, Cloud Run 재배포 영향 없음). `CLOUD_RUN_API_URL` GitHub variable = `https://api.heygrabit.com`. Web app의 `NEXT_PUBLIC_API_URL` build-arg도 동일 값. **근거:** `apps/web/lib/api-client.ts:8` 외 5개 파일이 browser 런타임에 `NEXT_PUBLIC_API_URL`로 API를 직접 호출하는 구조 + `apps/web/next.config.ts:50` rewrite가 dev 전용(`http://localhost:8080`) 이므로, apex 도메인만으로 API를 서빙할 수 없음. `.run.app` URL을 OAuth에 쓰면 서비스 재생성 시마다 provider 콘솔 재등록 필요 → 운영 부담. **영향:** Plan 13-03에 `api.heygrabit.com` DNS 레코드 설정 (CNAME ghs.googlehosted.com) + `gcloud beta run domain-mappings create --service=grabit-api --domain=api.heygrabit.com` 단계 추가. Plan 13-04 Task 3의 acceptance `heygrabit.com/api/v1/health 200` → `api.heygrabit.com/api/v1/health 200`으로 수정.

- **D-10 — P1 rename inventory = Full inventory 동적 생성 + allowlist audit.** Plan 13-01 Task 1에 **STEP 0** 추가: `rg -l 'grapit|Grapit|@grapit/|@grapit\.' --glob '!.planning/**' --glob '!pnpm-lock.yaml' --glob '!node_modules/**' --glob '!**/node_modules/**' --glob '!apps/*/dist/**' --glob '!apps/*/.next/**' --glob '!packages/*/dist/**' --glob '!.claude/**' > /tmp/grapit-inventory.txt`. Task 2/3이 이 inventory 위에서 동작. audit-brand-rename.sh의 allowlist는 **line-level**: `grapit_dev`(D-01), `/grapit/.env`(D-03), `grapit-cloudrun@`(D-05), `@social.grabit.com`(D-07 예외). **근거:** 13-REVIEWS.md HIGH #3 확인 — `apps/api/test/admin-dashboard.integration.spec.ts:47,60` (grapit_test), `apps/api/src/modules/admin/upload.service.spec.ts:27-28,102` (grapit-uploads, cdn.grapit.kr), `apps/api/src/modules/auth/email/templates/password-reset.tsx:8` (Grapit comment), `apps/web/e2e/admin-dashboard.spec.ts:15,20` (admin@grapit.test) 가 기존 Plan 13-01 `files_modified` + bulk `@grapit/` 패턴으로 포착 안 됨. **영향:** Plan 13-01 Task 1 STEP 4 bulk rename 패턴이 `@grapit/` 단일 → `@grapit/` + `\bGrapit\b` + `grapit_test` + `grapit-uploads` + `cdn\.grapit\.kr` + `admin@grapit\.test` + `@e2e\.grapit\.dev` 멀티 패턴으로 확장 (inventory 기반이라 빠진 파일이 자동 포함). `cdn.grapit.kr` 처리는 test fixture 값 전용 → `cdn.heygrabit.com` 으로 치환 (실 prod R2 설정은 이미 R2 phase 완료 영역이라 별개).

- **D-11 — AR IAM 바인딩 사전 검증.** Plan 13-03 Task 1 HUMAN-AUTH 체크리스트에 추가: `gcloud projects get-iam-policy $PROJECT_ID --flatten='bindings[].members' --filter='bindings.members:serviceAccount:$GCP_SERVICE_ACCOUNT AND bindings.role:roles/artifactregistry.writer'` 로 deploy principal의 write 권한 확인, 동일 방식으로 `grapit-cloudrun@` 에 `roles/artifactregistry.reader` 확인. 미바인딩 시 `gcloud projects add-iam-policy-binding` 으로 수동 추가. **근거:** 13-REVIEWS.md MEDIUM — 새 `grabit` AR repo 생성만으론 기존 project-level 바인딩이 신 repo에 자동 적용되지만, 신 repo 생성 직후 deploy가 돌 때 eventual consistency 로 간헐적 `Permission denied` 가능성 제거.

- **D-12 — Sentry 이벤트 검증 = admin-only test endpoint + captureException.** Plan 13-03 Task 4의 "404는 기본 capture 안 됨 + SDK init만으로 이벤트 가정" 방식을 **폐기**. 대안: `apps/api/src/modules/admin/admin-diagnostics.controller.ts` (신규, admin guard 적용) 에 `GET /api/v1/admin/_sentry-test` 엔드포인트 추가 — `Sentry.captureException(new Error('phase-13 sentry-test <uuid>'))` 호출 후 response에 이벤트 ID 반환. Task 4의 acceptance는 해당 endpoint를 호출하여 반환된 event ID를 Sentry API / UI에서 조회 확인. 동일 pattern을 grabit-web에도 `GET /admin/_sentry-test` 로 추가. **근거:** 13-REVIEWS.md MEDIUM — Sentry 검증 신뢰성 확보. **영향:** Plan 13-03에 소량 코드 추가 (admin guard 재사용, controller 2개 파일).

- **D-13 — GitHub vars 갱신 후 재배포 강제.** Plan 13-03 Task 4 acceptance를 **단일 deploy 검증**에서 **두 번째 deploy 완료 검증**으로 승격. 순서: (1) main 머지 → 첫 deploy (env는 구 CLOUD_RUN_API_URL 가리킴, fail 가능) → (2) 첫 deploy 결과로 얻은 새 .run.app URL을 GitHub vars `CLOUD_RUN_WEB_URL`에 임시 세팅 + `CLOUD_RUN_API_URL=https://api.heygrabit.com` (D-09 적용) → (3) `gh workflow run deploy.yml` 재실행 → (4) `gcloud run services describe grabit-{web,api} --format='value(spec.template.spec.containers[0].env)'` 로 새 env 반영 확인 + web은 `docker inspect` 또는 빌드 로그에서 `NEXT_PUBLIC_API_URL=https://api.heygrabit.com` build-arg 반영 확인. **근거:** 13-REVIEWS.md MEDIUM #4. **영향:** Plan 13-03 Task 4 acceptance_criteria에 재배포 step 추가 + "두 번째 deploy 완료 증명" 항목.

- **D-14 — cleanup 스크립트 7-day hard gate.** `scripts/cleanup-old-grapit-resources.sh`에 다음 precondition 추가: (1) 필수 argument `--confirm-after-date YYYY-MM-DD`, 현재 날짜(`date +%Y-%m-%d`)가 인자보다 이전이면 exit 1. (2) `gcloud beta run domain-mappings describe --domain=heygrabit.com --region=asia-northeast3 --format='value(spec.routeName)'` 결과가 `grabit-web` 이어야 함. 마찬가지로 `api.heygrabit.com` → `grabit-api`. (3) `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name=("grapit-web" OR "grapit-api")' --freshness=24h --limit=1 --format='value(timestamp)'` 결과가 empty 이어야 함 (최근 24h 트래픽 0). 하나라도 실패 시 exit 1 + 실패 이유 로깅. **근거:** 13-REVIEWS.md MEDIUM #7. **영향:** Plan 13-04 Task 1 cleanup 스크립트 작성 부분에 이 gate 로직 embed, Plan 13-04 Task 5 acceptance에 `--confirm-after-date` 사용 증거 기록.

- **D-15 — legal MD deferred follow-up HTML 주석 제거.** Plan 13-02 Task 3 STEP 4의 `<!-- [Phase 13 deferred follow-up] ... -->` 주석 추가 단계 **삭제**. deferred mailbox / Resend verified sender / Infobip sender ID 항목은 `.planning/phases/13-grapit-grabit-rename/13-04-SUMMARY.md` 의 `Additional post-phase tasks` 블록 + `.planning/PROJECT.md` Concerns 섹션에 기록 이관. **근거:** 13-REVIEWS.md MEDIUM — legal/법무 문서는 사용자·법무 outward-facing이라 내부 TODO 섞지 않음이 원칙. MDX renderer 전환 등으로 주석 노출 위험 제거.

- **D-16 — `rg -c ... | wc -l` acceptance bash 패턴 fix.** 모든 Plan의 `<verify>` / `<acceptance_criteria>` 내 bash snippet 에서 no-match 시 pipe 중단 위험 있는 pattern 을 다음 중 하나로 교체: (a) `rg -c 'pattern' path 2>/dev/null || echo 0` (count), (b) `rg -l 'pattern' path 2>/dev/null | wc -l` (file count, no-match 시 빈 입력으로 0), (c) `rg -c 'pattern' path | awk -F: '{s+=$2} END {print s}'` (sum). `set -euo pipefail` 환경 safe. **근거:** 13-REVIEWS.md LOW #10. **영향:** Plan 13-01/02/03/04 의 모든 verify 블록 grep 패턴 일괄 revise.

- **D-17 — SMS spec `INFOBIP_SENDER: 'Grapit'` fixture = 'Grabit' 단순 치환.** `apps/api/src/modules/sms/sms.service.spec.ts:137` 의 KISA alphanumeric 반례 fixture 는 bulk `\bGrapit\b` 치환으로 `'Grabit'` 됨. **'Grabit' 도 alphanumeric 이라 KISA 거부 반례로 여전히 유효**. Line-level allowlist 불필요. audit-brand-rename.sh allowlist 에서도 제외. **근거:** 반례의 의도(sender-ID validation 이 alphanumeric 을 reject 하는지 검증)는 literal 값 자체가 아니라 alphanumeric 특성. **영향:** Plan 13-02 decision_constraints 에서 "sms.service.ts L115 주석 내 `INFOBIP_SENDER=Grapit` 예시는 반례 제시이므로 함께 Grabit으로 치환" 문구 유지, spec L137 fixture 는 별도 언급 없이 자동 치환.

### Claude's Discretion

- **Plan 내부 작업 단위, 커밋 단위, 파일별 순서 등 구현 세부사항** — planner가 판단.
- **환경변수 이름 prefix** — 현재 `GRAPIT_*` prefix 사용 사례 없음(확인됨). 만약 추가 발견 시 `GRABIT_*`로 정사 (Claude 재량).
- **문서(`CLAUDE.md`, `AGENTS.md`, `docs/*`, `arch/*`) rename 깊이** — P1에 포함하되 완료된 milestone record(`.planning/milestones/v1.0-phases/`)는 건드리지 않는 기준선 유지.

### Folded Todos

해당 없음.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Seed Document (scope of record)

- `.planning/seeds/SEED-002-brand-rename-grapit-to-grabit.md` — 원시 scope 정의, 5분할 초안, out-of-scope 기준선. 본 CONTEXT의 decisions가 이 seed의 P3/P5를 조정했음에 주의.

### Roadmap Entry

- `.planning/ROADMAP.md` § Phase 13 — Goal · Success Criteria · Depends on(Phase 12).

### Global Memory

- `~/.claude/projects/-Users-sangwopark19-icons-grapit/memory/project_brand_rename.md` — 브랜드 확정(heygrabit.com) 배경.

### Review Artifact (drives D-09~D-17)

- `.planning/phases/13-grapit-grabit-rename/13-REVIEWS.md` — codex gpt-5.4 cross-AI review (2026-04-22). HIGH 3건 + MEDIUM 6건 → D-09~D-17 근거.

### Infrastructure Source Files

- `.github/workflows/deploy.yml` §L11-13 env — `AR_REPO`/`WEB_SERVICE`/`API_SERVICE` 환경변수. P3에서 갱신 필요.
- `.github/workflows/deploy.yml` §L81,L168 — `grapit-cloudrun@` SA 참조 (D-05로 유지).
- `.github/workflows/deploy.yml` §L99-101 — OAuth callback env `KAKAO/NAVER/GOOGLE_CALLBACK_URL=${{ vars.CLOUD_RUN_API_URL }}/...` (D-09 후 CLOUD_RUN_API_URL = `https://api.heygrabit.com`).
- `.github/workflows/deploy.yml` §L147-148 — web build-arg `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` = `${{ vars.CLOUD_RUN_API_URL }}` (D-09 반영 대상).
- `.github/workflows/ci.yml` — CI에서 사용하는 서비스명/DB 이름.
- `docker-compose.yml` — dev 환경 DB password `grapit_dev` (D-01에 따라 in-place 유지).

### API Domain Routing 구조 증거 (D-09 근거)

- `apps/web/next.config.ts` §L50-60 — rewrites destination `http://localhost:8080/api/:path*` 은 dev 전용 (prod Cloud Run 분리 배포라 localhost 미존재).
- `apps/web/lib/api-client.ts` §L8 — `API_URL = process.env.NEXT_PUBLIC_API_URL || ''` → browser bundle 에 build-time 값 박힘.
- `apps/web/lib/socket-client.ts` §L3 — `WS_URL = process.env.NEXT_PUBLIC_WS_URL || ''` → WebSocket 도 동일 값.
- `apps/web/Dockerfile` §L5-8 — `ARG NEXT_PUBLIC_API_URL` / `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`.
- `apps/api/src/modules/auth/strategies/kakao.strategy.ts` §L26 — `callbackURL` 은 `KAKAO_CALLBACK_URL` env 직접 consume.

### 사용자 노출 문자열 소스

- `apps/api/src/modules/auth/email/` — 이메일 템플릿(password-reset 등).
- `apps/api/src/modules/auth/email/templates/password-reset.tsx` §L8 — `Grapit password reset flow` doc comment (D-10 inventory 대상).
- `apps/api/src/modules/sms/sms.service.ts` — SMS 발신자명.
- `apps/api/src/modules/sms/sms.service.spec.ts` §L137 — `INFOBIP_SENDER: 'Grapit'` KISA 반례 fixture (D-17로 'Grabit' 단순 치환).
- `apps/api/src/database/seed.mjs` — 시드 데이터의 브랜드명.
- `apps/web/next.config.ts`, `apps/web/lib/auth.ts` — 웹 설정·auth 상수.

### P1 Inventory 누락 파일 (D-10 근거, STEP 0 inventory가 자동 포착해야 함)

- `apps/api/test/admin-dashboard.integration.spec.ts` §L31,L47,L60 — `@grapit/api` filter, `grapit_test` DB 참조 2건.
- `apps/api/src/modules/admin/upload.service.spec.ts` §L27-28,L102 — `grapit-uploads` R2 bucket fixture, `cdn.grapit.kr` R2 public URL fixture (D-10: `cdn.heygrabit.com` 으로 치환).
- `apps/web/e2e/admin-dashboard.spec.ts` §L15,L20 — `admin@grapit.test` doc comment 2건.

### 안 건드릴 구역 (out-of-scope 확인용)

- `.planning/milestones/v1.0-phases/*` — 과거 milestone record.
- `.planning/phases/0X-*`, `09.1-*`, `10.1-*`, `11-*`, `12-*` — 완료된 phase 폴더.
- `.planning/quick/*` — 완료된 quick phase 기록.
- `.playwright-mcp/page-*.yml` — 자동 재생성.
- git commit history.

</canonical_refs>

<code_context>
## Existing Code Insights

### Rename Surface (scanned 2026-04-22)

- 678 grapit occurrence / 399 파일 (`.planning/` 제외, `node_modules` 제외).
- 전체(.planning 포함 시): 1,582 occurrence / 250 파일(seed 기록 기준).
- GRAPIT_ env prefix **미사용** (확인됨) — 환경변수 rename 작업량 거의 0.

### 주요 Integration Points

- **npm scope:** `@grapit/root`, `@grapit/api`, `@grapit/web`, `@grapit/shared` (근거: `package.json`, `pnpm-workspace.yaml`). `@grabit/*`로 일괄 치환 후 `pnpm-lock.yaml` 재생성 필요.
- **Cloud Run service names:** `.github/workflows/deploy.yml` `WEB_SERVICE=grapit-web`, `API_SERVICE=grapit-api`.
- **Sentry projects:** v1.0 Phase 05 artifact에 프로젝트명 기록됨(`grapit-web`, `grapit-api`). 새 프로젝트 생성 후 DSN을 Secret Manager에 갱신.
- **DB 식별자:** docker-compose.yml의 `POSTGRES_PASSWORD: grapit_dev`는 D-01에 따라 유지.

### Established Patterns

- Phase 08(R2), Phase 10.1(SMS) 등 최근 phase가 **secrets → Cloud Run env → deploy.yml** 3단 구조를 따름. P3도 동일 패턴 재사용.
- Phase 12(UX)가 토큰 기반 브랜드 색상을 정의해둬 UI 카피 rename이 컬러·타이포 변경 없이 독립적으로 가능.

### Reusable Assets

- 기존 `260420-cd7-deploy-secrets-missing-infobip-sentry-toss` quick phase가 deploy.yml 시크릿 주입 패턴을 이미 검증. P3에서 동일 절차로 새 Cloud Run 서비스에 시크릿 복제.

</code_context>

<specifics>
## Specific Ideas

- 도메인은 `heygrabit.com` (확정, `hey` prefix 포함).
- Cloud Run 서비스명 · Sentry 프로젝트 · Artifact Registry 저장소는 블루-그린 기간 동안 양쪽 공존.
- 7일 유예 이후 구 `grapit-*` 리소스는 일괄 삭제. 삭제 실행은 P4 내 checklist 아이템.

</specifics>

<deferred>
## Deferred Ideas

### 본 phase 범위에서 제외된 것들

- **prod DB 이름 자체의 rename** — `grapit_prod` → `grabit_prod`. D-01로 in-place 유지 결정. 향후 대규모 DB 재설계 또는 신규 리전 이전 시점에 재검토.
- **로컬 레포 디렉토리 rename** — `/icons/grapit` → `/icons/grabit`. D-03으로 phase 범위 제외. 개인 작업 path.
- **GitHub 원격 레포명 변경** — 이번 phase에서 결정하지 않음. 별도 판단.

### Deferred follow-up (D-15로 legal MD 주석에서 이관)

- **Legal mailbox (@heygrabit.com) 실제 개설** — `support@heygrabit.com`, `privacy@heygrabit.com` 수신. 사업자등록 후 Cloudflare Email Routing 또는 Workspace Admin. 13-04-SUMMARY.md 의 `Additional post-phase tasks` 블록 + PROJECT.md Concerns 섹션에 기록.
- **Resend verified sender domain 재설정** — heygrabit.com 도메인 발송자 검증. 현재 `RESEND_FROM_EMAIL` secret 값 유지. Plan 04 HUMAN-UAT에서 실제 이메일 수신 실패 시 대응.
- **Infobip sender ID 재설정** — 브랜드 변경 시 sender ID 등록 갱신 가능. KISA 정책상 현재 number-only라 실제 영향은 없을 수 있으나 모니터링 대상.
- **구 `grabit-api-XXX.run.app` URL OAuth callback 정리** — D-09로 api.heygrabit.com 사용하지만, 만약 debug 목적으로 `.run.app` URL을 provider에 임시 등록했다면 7일 유예 이후 정리 (Plan 13-04 Task 5 참조).

### Reviewed Todos (not folded)

해당 없음 — match-phase에서 매칭된 todo 없음.

</deferred>

---

*Phase: 13-grapit-grabit-rename*
*Context gathered: 2026-04-22*
*Partial update: 2026-04-22 (post-codex REVIEWS — D-09~D-17 추가)*
