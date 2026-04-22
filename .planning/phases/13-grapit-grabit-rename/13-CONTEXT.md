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
- **D-08 (Q4 해소) — OAuth callback URL 재등록은 P4 HUMAN-UAT에 포함.** 카카오/네이버/구글 개발자 콘솔에서 `https://heygrabit.com/auth/callback/{provider}` 를 신규 등록하는 작업을 P4 cutover 직전 수동 절차로 편성. P3 단계에서는 신규 callback 등록 없음(OAuth 테스트는 cutover 이후에만).

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

### Infrastructure Source Files

- `.github/workflows/deploy.yml` — `WEB_SERVICE`/`API_SERVICE` 환경변수가 Cloud Run 서비스명을 직접 참조. P3에서 갱신 필요.
- `.github/workflows/ci.yml` — CI에서 사용하는 서비스명/DB 이름.
- `docker-compose.yml` — dev 환경 DB password `grapit_dev` (D-01에 따라 in-place 유지).

### 사용자 노출 문자열 소스

- `apps/api/src/modules/auth/email/` — 이메일 템플릿(password-reset 등).
- `apps/api/src/modules/sms/sms.service.ts` — SMS 발신자명.
- `apps/api/src/database/seed.mjs` — 시드 데이터의 브랜드명.
- `apps/web/next.config.ts`, `apps/web/lib/auth.ts` — 웹 설정·auth 상수.

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

### Reviewed Todos (not folded)

해당 없음 — match-phase에서 매칭된 todo 없음.

</deferred>

---

*Phase: 13-grapit-grabit-rename*
*Context gathered: 2026-04-22*
