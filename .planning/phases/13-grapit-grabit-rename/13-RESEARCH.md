# Phase 13: 브랜드명 grapit → grabit 일괄 rename - Research

**Researched:** 2026-04-22
**Domain:** monorepo 식별자 rename + 사용자 노출 카피 치환 + Cloud Run 블루-그린 cutover
**Confidence:** HIGH (파일 surface/설정) / MEDIUM (Cloud Run cutover 세부 gcloud 명령)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — prod DB rename 범위:** prod DB는 **앱 레벨만 rename**. DB 이름(`grapit_prod`)·ROLE·DATABASE_URL 식별자·docker-compose 비밀번호(`grapit_dev`)는 그대로 유지. 코드·환경변수 이름·로그 메시지만 `grabit`으로 치환.

**D-02 — Cloud Run 블루-그린 cutover:** 새 `grabit-web`/`grabit-api` Cloud Run 서비스를 별도 생성하고, `heygrabit.com` 도메인을 새 서비스에 매핑. 함께 rename 대상:
- Cloud Run service: `grapit-web`/`grapit-api` → `grabit-web`/`grabit-api`
- Sentry projects: 새 프로젝트 생성, 새 DSN 발급
- Artifact Registry 저장소/이미지명
- `.github/workflows/deploy.yml` `WEB_SERVICE`/`API_SERVICE`

**D-02b — 유예 기간:** cutover 후 구 `grapit-*` 리소스는 **7일 유예** 후 정리.

**D-03 — 로컬 레포 디렉토리 rename은 이번 phase 범위 제외.**

**D-04 — Plan 4분할:**
- P1: 코드/설정 rename (`@grapit/*` import, package.json, pnpm-workspace, docker-compose, Dockerfile, turbo, workflows env, seed, next.config, auth)
- P2: 사용자 노출 카피 (이메일 템플릿, SMS 발신자명, UI 카피, title/meta, OpenGraph)
- P3: 인프라 식별자 생성 (새 Cloud Run, 새 Sentry, 새 Artifact Registry, deploy.yml 갱신)
- P4: 도메인 cutover + 7일 후 구 리소스 정리 + HUMAN-UAT

### Claude's Discretion

- Plan 내부 작업 단위, 커밋 단위, 파일별 순서 등 구현 세부사항
- 환경변수 이름 prefix — 현재 `GRAPIT_*` 사용 사례 없음. 발견 시 `GRABIT_*`로 정사
- 문서 rename 깊이 — 완료된 milestone record(`.planning/milestones/v1.0-phases/`)는 건드리지 않는 기준선 유지

### Deferred Ideas (OUT OF SCOPE)

- prod DB 이름·ROLE·DATABASE_URL 자체의 rename (D-01로 제외)
- 로컬 레포 디렉토리 rename `/icons/grapit` → `/icons/grabit` (D-03으로 제외)
- GitHub 원격 레포명 변경
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP.md Success Criteria 4건을 REQ-ID proxy로 취급한다 (`SC-1`~`SC-4`).

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | 신규 코드/문서/설정이 `grabit`으로 통일되고 빌드·타입체크·린트 통과 | § npm scope rename 실행 절차, § Lockfile drift 방어 전략 |
| SC-2 | 사용자 노출 문자열(이메일 템플릿/SMS 발신자/title/meta/UI 카피) 전부 `Grabit` | § User-Facing Copy Surface Inventory |
| SC-3 | prod DB와 Cloud Run 서비스가 `grabit` 식별자로 정상 동작 | § Cloud Run 블루-그린 cutover 절차, § Sentry/AR 신규 리소스 |
| SC-4 | 과거 milestone 기록·완료된 phase 폴더·commit message는 건드리지 않음 | § Out-of-scope 경계 방어 |
</phase_requirements>

## Summary

Phase 13은 **새 capability 없음** — 678개의 grapit 출현(.planning 제외)을 grabit으로 치환하고, 블루-그린 방식으로 Cloud Run 서비스·Sentry·Artifact Registry를 새 이름으로 이중화한 뒤 도메인을 cutover하는 rename phase다. CONTEXT.md가 decision 대부분을 확정했으므로, 연구의 가치는 **"어디서 실패할 수 있는가 + 어떻게 검증할 것인가"** 에 있다.

**위험 요약:**
- **P1(코드 rename)의 실제 위험은 pnpm-lock.yaml drift** — `@grapit/*` → `@grabit/*` 치환은 workspace protocol 덕분에 버전 충돌은 없지만, CI의 `pnpm install --frozen-lockfile`은 package name만 바뀌고 lockfile이 그대로면 즉시 실패한다. lockfile을 같은 PR에서 재생성해야 한다.
- **P2(카피 rename)의 실제 위험은 "사용자가 보는 곳을 빠뜨리는 것"** — SMS 본문(`[Grapit] 인증번호 ...`), 이메일 subject(`[Grapit] 비밀번호 재설정`), legal MD 파일 내 이메일 주소(`support@grapit.com`), footer copyright가 각각 다른 모듈에 있어 단순 grep으로만 확인한 surface는 놓치기 쉽다.
- **P3/P4(cutover)의 실제 위험은 도메인 매핑의 "한 번밖에 없는 기회"** — Cloud Run domain mapping은 도메인 하나당 서비스 하나에만 연결된다. `heygrabit.com`을 구 `grapit-web`에 매핑한 상태로 있으면 안 되며, cutover 시 delete+create 순서와 SSL 인증서 재발급 대기(수분~수십분) 동안의 fallback이 필요하다.
- **SC-4의 실제 위험은 자동 rename 도구의 "탐욕성"** — `sed`/IDE의 대량 치환이 `.planning/milestones/` 와 `.planning/quick/` 까지 쉽게 닿는다. 기술적 exclude glob 없이 지시만으로는 실수가 난다.

**Primary recommendation:** P1 먼저 lockfile까지 포함해 단일 PR로 머지 → P2 카피는 surface 전수 checklist 기반 별도 PR → P3는 **기존 인프라를 유지한 채** 새 리소스를 병렬 provisioning (deploy.yml은 P3 머지 시점에는 아직 구 서비스명 가리키게 두거나 임시 분기) → P4는 gcloud CLI로 domain-mappings swap + 7일 후 정리를 별도 commit으로 분리.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| npm scope rename | Package manifests + pnpm-lock | turbo/tsconfig paths | workspace:* 는 package.json name 기준이라 모든 consumer의 `dependencies`가 동기 갱신 필요 |
| 사용자 노출 카피 | Frontend (app/layout, components, content/legal) | Backend (email subject, SMS body) | UI·이메일·SMS 각각 다른 tier에서 독립 렌더링 |
| Cloud Run service name | GCP 인프라 | GitHub Actions deploy.yml env | service name은 immutable — 새 리소스 생성 + workflow env 변수 교체 |
| Domain mapping cutover | GCP domain-mappings | DNS + SSL 인증 | managed certs는 domain-mapping 리소스에 바인딩되므로 생성 시 재발급 |
| Sentry DSN 교체 | Secret Manager 값 | Cloud Run secrets reference | 코드 변경 0 (DSN은 `process.env.SENTRY_DSN`) — 시크릿 값만 갱신 |
| Artifact Registry repo | GCP AR | deploy.yml `AR_REPO` env | 이름 immutable — 새 repo 생성 + workflow env 1줄 변경 |
| DB 이름 유지 (D-01) | — | — | 앱 코드는 DATABASE_URL을 구조적으로 참조하므로 식별자 자체는 변경 없음 |

## Standard Stack

이 phase는 **새 라이브러리 도입 없음**. 사용 도구는 기존 스택 그대로:

### Core Tooling (기존 레포 확인)
| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| pnpm | 10.28.1 | workspace dependency 재설치 + lockfile 재생성 | HIGH (package.json packageManager) |
| Turbo | ^2.8.0 | `pnpm build/lint/typecheck/test` 오케스트레이션 | HIGH (root package.json) |
| gcloud CLI | 최신 | Cloud Run / Artifact Registry / domain-mappings 제어 | HIGH |
| ripgrep / grep | N/A | rename surface scan + SC-2 잔여물 검증 | HIGH |

### 검증용 명령 (P1 gate)
- `pnpm install --frozen-lockfile` — CI와 동일 동작 재현, drift 탐지
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — turbo로 전체 워크스페이스 실행
- `pnpm --filter @grabit/api exec drizzle-kit generate` — package rename 이후 CLI가 정상 resolve되는지 확인

### Cloud Run 블루-그린 명령 (P3/P4 gate) [CITED: cloud.google.com/run/docs/mapping-custom-domains]
- `gcloud artifacts repositories create grabit --repository-format=docker --location=asia-northeast3`
- `gcloud run deploy grabit-api --image=... --region=asia-northeast3 ...` (deploy.yml flags 그대로)
- `gcloud beta run domain-mappings create --service=grabit-web --domain=heygrabit.com --region=asia-northeast3`
- `gcloud beta run domain-mappings delete --domain=heygrabit.com --region=asia-northeast3` (cutover 시 구 매핑 제거용. 단, 아래 "Cutover 전략" 절에서 설명하는 대로 `domain-mapping` 한 번에 하나의 서비스만 받는 제약 때문에 구 매핑 삭제가 선행되어야 한다.)

### Installation
해당 없음 — 새 패키지 설치 없음. 오직 workspace package name만 변경.

## Architecture Patterns

### System Diagram — Rename Data Flow

```
[sed/IDE 치환] ──┐
                 ├──> [package.json, tsconfig, turbo.json, workflows]
[grep audit] ────┘           │
                             ▼
                     [pnpm install]
                             │
                             ▼
                 [pnpm-lock.yaml 재생성]
                             │
                             ▼
                   [lint + typecheck + test]
                             │
                             ▼ (green)
                         [PR P1]
                             │
                             ▼
                     [user-facing copy]
                             │
                             ▼
                         [PR P2]
                             │
                             ▼
       ┌─────────────────────┴─────────────────────┐
       ▼                                           ▼
[새 AR repo]   [새 Cloud Run svc]   [새 Sentry proj + DSN]
       │                 │                         │
       ▼                 ▼                         ▼
  [deploy.yml]      [first deploy]         [Secret Mgr 값 갱신]
  env 갱신 (PR P3)        │
                          ▼
                 [health check green]
                          │
                          ▼
         [gcloud run domain-mappings delete (구)]
                          │
                          ▼
         [gcloud run domain-mappings create (신)]
                          │
                          ▼
                 [DNS propagation + SSL 재발급 대기]
                          │
                          ▼
                  [HUMAN-UAT (P4)]
                          │
                          ▼ (7일 후)
           [구 grapit-* 리소스 일괄 삭제]
```

### Pattern 1: workspace:* 기반 스코프 rename
**What:** `@grapit/api`, `@grapit/web`, `@grapit/shared`, `@grapit/root`의 name 필드를 `@grabit/*`로 교체하고, 각 consumer가 dependencies에 선언한 `"@grapit/shared": "workspace:*"`를 `"@grabit/shared": "workspace:*"`로 동시 갱신.

**When to use:** scope만 변경하고 버전 정책은 유지할 때.

**Example (dependency order — topo 기준):**
```
1. packages/shared/package.json          name: @grapit/shared → @grabit/shared
2. apps/api/package.json                 name 변경 + dependencies["@grapit/shared"] → dependencies["@grabit/shared"]
3. apps/web/package.json                 동일 (name + dependencies)
4. apps/web/next.config.ts               transpilePackages: ['@grapit/shared'] → ['@grabit/shared']
5. apps/web/tsconfig.json                paths["@grapit/shared"] → paths["@grabit/shared"]
6. 모든 .ts/.tsx 파일 import             from '@grapit/shared' → from '@grabit/shared'
7. apps/api/Dockerfile, apps/web/Dockerfile:  pnpm --filter @grapit/* → @grabit/*
8. .github/workflows/ci.yml, deploy.yml:      pnpm --filter @grapit/api → @grabit/api
9. 최상단 package.json                    name: @grapit/root → @grabit/root
10. pnpm install (lockfile 재생성)
```

**Why this order:** shared를 먼저 바꾸지 않으면 consumer의 dependencies rename이 "지금 존재하지 않는 스코프"를 가리키게 된다. 또한 lockfile을 마지막에 한 번만 재생성해야 partial state가 남지 않는다.

### Pattern 2: Cloud Run 도메인 cutover
**What:** Cloud Run domain-mapping은 "도메인 1개 ↔ 서비스 1개" 관계다. 따라서 구 매핑을 먼저 삭제하고 새 매핑을 만드는 방식이 **공식 권장**. [CITED: cloud.google.com/run/docs/mapping-custom-domains]

**When to use:** `heygrabit.com`을 `grapit-web`에서 `grabit-web`으로 옮길 때.

**Example (안전한 순서):**
```bash
# 사전 조건: grabit-web이 이미 asia-northeast3에 deploy되어 있고, Cloud Run URL로
# health check 통과했음을 확인. DNS A/AAAA/CNAME은 Google의 load balancer를 가리키고
# 있어 그대로 유지됨.

# 0) 구 매핑 현재 상태 캡처 (rollback 대비)
gcloud beta run domain-mappings describe \
  --domain=heygrabit.com --region=asia-northeast3 > rollback.yaml

# 1) 구 매핑 삭제 (이 시점부터 도메인 HTTPS는 잠시 503 가능)
gcloud beta run domain-mappings delete \
  --domain=heygrabit.com --region=asia-northeast3 --quiet

# 2) 새 서비스에 매핑 생성
gcloud beta run domain-mappings create \
  --service=grabit-web --domain=heygrabit.com --region=asia-northeast3

# 3) 매핑 status Ready까지 poll (SSL 인증서 자동 발급)
for i in $(seq 1 60); do
  STATUS=$(gcloud beta run domain-mappings describe --domain=heygrabit.com \
    --region=asia-northeast3 --format='value(status.conditions[0].status)')
  [ "$STATUS" = "True" ] && break
  sleep 15
done

# 4) 실제 도메인에서 HTTPS 200 확인
curl -sI https://heygrabit.com/ | head -1
```

**롤백:** Step 1의 `rollback.yaml`을 사용해 `gcloud beta run domain-mappings delete` 후 구 매핑을 재생성한다. SSL 인증서는 Google-managed라 재발급에 수 분이 추가로 걸린다.

### Anti-Patterns to Avoid

- **`sed -i 's/grapit/grabit/g' **/*`를 `.planning/` 제외 없이 실행.** `.planning/milestones/v1.0-phases/`의 historical record가 오염된다 (SC-4 위반).
- **`.planning/phases/13-grapit-grabit-rename/` 폴더 이름을 rename.** 이 phase 폴더 이름은 CONTEXT.md/SEED-002가 참조하는 canonical path다. 변경 금지.
- **lockfile을 코드 rename과 다른 PR로 분리.** CI의 `--frozen-lockfile`이 매 커밋마다 실패한다.
- **`--frozen-lockfile`을 잠깐 제거.** lockfile이 반영되지 않은 코드가 main에 들어가면 런타임 버전 drift 위험.
- **Cloud Run 구 서비스에 매핑을 유지한 채 새 서비스에도 동일 도메인 매핑 시도.** gcloud가 충돌 에러를 반환한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 파일 내 브랜드 문자열 일괄 치환 | 수작업 find+replace 스크립트 | ripgrep + `git ls-files` + `sed`/IDE 멀티커서 | rg는 glob exclude 네이티브 지원, `.planning/**` 쉽게 제외 |
| Cloud Run 블루-그린 전환 | DNS record 직접 변경 | Cloud Run domain-mappings 리소스 | Google load balancer IP는 공용, DNS는 이미 그쪽을 가리킴 |
| SSL 인증서 갱신 | Let's Encrypt 수동 | Google-managed cert (domain-mapping 기본 포함) | cert 자동 갱신 + SAN 자동 추가 |
| rename 누락 검증 | 전역 grep | `git grep --cached -n 'grapit'` + Allowlist 파일 | staged 파일만 검사, historical .planning은 exclude |

**Key insight:** rename phase는 "무언가 새로 만드는" 게 아니다. **"기존 도구의 exclude 기능을 정확히 쓰는 것"** 이 전부다. 스스로 스크립트를 짜지 말 것.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) Postgres `admin@grapit.test` seed row — seed.mjs로 항상 재생성됨. DB table 내 브랜드 문자열 없음 (스키마는 brand-agnostic). (2) Valkey `sms:otp:{e164}` 등 key prefix는 "sms:" 기반으로 브랜드 포함 안 함. | 없음 — DB 데이터는 rename 불필요. D-01대로 DB 이름/ROLE 유지. |
| **Live service config** | (1) Sentry 프로젝트 `grapit-web`/`grapit-api` — 히스토리는 구 프로젝트에 남음. 새 프로젝트 생성 후 DSN 교체하므로 rename 효과만 필요. (2) Cloud Run 서비스 `grapit-web`/`grapit-api` — immutable name. (3) Artifact Registry repo `grapit`. | 새 리소스 생성 (P3). 기존은 7일 유예 후 삭제 (D-02b). |
| **OS-registered state** | 없음 확인 (Windows Task Scheduler, launchd, systemd, pm2 미사용). 로컬 `docker-compose.yml`의 container_name `grapit-postgres`는 개발자 로컬 docker 상태에 존재 — `docker compose down` 후 재기동 시 자동 갱신. | docker-compose rename 시 개발자 1회 `docker compose down && docker compose up -d` 안내. |
| **Secrets/env vars** | `.env` / Secret Manager의 key 이름은 `DATABASE_URL`, `JWT_SECRET`, `SENTRY_DSN` 등 **브랜드 중립**. `GRAPIT_` prefix 사용 사례 0 (CONTEXT.md `code_context` 섹션에서 확인). Sentry DSN 값은 새 프로젝트의 DSN으로 갱신해야 하지만 env 변수 이름은 그대로. | Secret Manager 값 갱신만 (secret 이름 변경 없음). Cloud Run service account `grapit-cloudrun@...`는 별도 — 아래 Open Question 1 참조. |
| **Build artifacts / installed packages** | (1) `apps/*/dist/`, `apps/web/.next/`, `packages/shared/dist/` — turbo outputs. 치환 후 `pnpm build` 재실행 시 자동 재생성. (2) Artifact Registry 기존 이미지 `asia-northeast3-docker.pkg.dev/.../grapit/grapit-api:*` 는 구 서비스가 참조 중이라 7일 유예 동안 유지 필요. | P4 cutover 직후 `rm -rf apps/*/dist apps/web/.next packages/shared/dist node_modules`는 개발자 로컬에서 권장. AR 구 이미지는 구 서비스 삭제와 동시에 정리. |

**"After every file in the repo is updated, what runtime systems still have the old string?"**
→ (a) Sentry 구 프로젝트의 이벤트 히스토리, (b) Artifact Registry 구 repo의 이미지, (c) Cloud Run 구 서비스의 revision 히스토리, (d) 개발자 로컬 `grapit-postgres` docker 컨테이너. (a)~(c)는 D-02b의 7일 유예 대상, (d)는 개발자 수동 재기동.

## Dependencies & Integration Points

### P1 — 코드/설정 rename 대상 파일 (확인됨)

**Package manifests:**
- `package.json` — name: `@grapit/root`
- `apps/api/package.json` — name: `@grapit/api`, dependencies: `@grapit/shared`
- `apps/web/package.json` — name: `@grapit/web`, dependencies: `@grapit/shared`
- `packages/shared/package.json` — name: `@grapit/shared`
- `pnpm-lock.yaml` — `@grapit/*` 참조 2건, 재생성 필수

**Workspace / build config:**
- `pnpm-workspace.yaml` — glob만 정의 (변경 불필요)
- `turbo.json` — task 정의만, 변경 불필요
- `apps/web/next.config.ts` — `transpilePackages: ['@grapit/shared']`, `SENTRY_ORG`/`SENTRY_PROJECT` 는 env 기반이라 코드 변경 없음
- `apps/web/tsconfig.json` — `paths["@grapit/shared"]`
- `apps/web/vitest.config.ts`, `apps/api/vitest.integration.config.ts` — `@grapit/*` 경로 alias 포함
- `apps/api/Dockerfile` — `pnpm --filter @grapit/shared build`, `pnpm --filter @grapit/api build`, `pnpm --filter @grapit/api deploy`
- `apps/web/Dockerfile` — `pnpm --filter @grapit/shared build`, `pnpm --filter @grapit/web build`
- `docker-compose.yml` — `container_name: grapit-postgres` 는 D-01에 따라 **유지** (선택적 변경 가능하나 dev DB password `grapit_dev`는 확정 유지)

**Workflows:**
- `.github/workflows/ci.yml` — `POSTGRES_DB: grapit_test`, `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/grapit_test`, `pnpm --filter @grapit/api`, `admin@grapit.test` 하드코드. 테스트 DB 이름 `grapit_test`도 rename 필요 여부는 Open Question 2.
- `.github/workflows/deploy.yml` — `AR_REPO: grapit`, `WEB_SERVICE: grapit-web`, `API_SERVICE: grapit-api`, `grapit-cloudrun@...` service account 2곳, `pnpm --filter @grapit/api exec drizzle-kit migrate`

**Application code (import 문):**
- 모든 `.ts`/`.tsx` 파일의 `from '@grapit/shared'` (약 30+ 파일 confirmed)

**Scripts:**
- `scripts/provision-valkey.sh` — `INSTANCE_NAME="grapit-valkey"`, `POLICY_NAME="grapit-valkey-policy"`, `grapit-cloudrun@...` 서비스 계정 참조. 이미 provisioned 된 인스턴스는 immutable이라 rename = 새 인스턴스 생성인데, 이는 CONTEXT 범위 밖 → **스크립트 내 변수명만 `grabit-valkey` 로 갱신하고, 실제 인스턴스는 그대로**. 로그/주석에 `# pre-existing grapit-valkey instance still in use; rename deferred` 추가.

**Seed / Data:**
- `apps/api/src/database/seed.mjs` — `admin@grapit.test` 5군데 (DELETE 4건 + INSERT 1건), 콘솔 로그 1건. 이메일 주소를 바꾸면 **CI secret TEST_USER_EMAIL의 값**도 바꿔야 함.
- `apps/web/e2e/helpers/auth.ts` — `|| 'admin@grapit.test'` fallback
- `apps/web/e2e/signup-sms.spec.ts` — `test${timestamp}@e2e.grapit.dev`
- `apps/api/src/modules/auth/email/email.service.spec.ts` — `no-reply@grapit.com` 2군데
- `apps/api/src/modules/auth/auth.service.ts` — `@social.grapit.com` fallback email

**Documentation (변경하되 historical은 제외):**
- `CLAUDE.md` — 3곳 occurrence (project name, scope)
- `AGENTS.md` — 확인 대상
- `docs/` — 13개 파일, 변경
- `arch/` — 확인 대상

### P2 — User-Facing Copy Surface Inventory (전수 조사 결과)

카테고리별 **정확한 파일 + 라인** 매핑:

#### A. HTML `<title>` / meta / OpenGraph
| File | Line | Content |
|------|------|---------|
| `apps/web/app/layout.tsx` | 11 | `title: 'Grapit - 공연 티켓 예매'` |
| `apps/web/app/layout.tsx` | 12 | `description: '공연, 전시, 스포츠 등 ...'` (브랜드 없음 — 확인만) |
| `apps/web/app/page.tsx` | 15 | `<h1 className="sr-only">Grapit</h1>` |

**Not found (의도적 확인):** manifest.json, robots.txt, sitemap.ts, `apps/web/public/manifest*`, OpenGraph image, PWA icon → **모두 존재하지 않음** (Next.js app router의 metadata API 기본만 사용). SEO 측면에서 P2에서 brand 관련 OG image 추가는 out-of-scope (deferred).

#### B. UI Copy (React 컴포넌트)
| File | Line | Content |
|------|------|---------|
| `apps/web/components/layout/gnb.tsx` | 110 | `Grapit` (로고 텍스트) |
| `apps/web/components/layout/footer.tsx` | 24 | `© 2026 Grapit. All rights reserved.` |
| `apps/web/components/layout/mobile-menu.tsx` | 75 | `<span>Grapit</span>` (모바일 메뉴 헤더) |
| `apps/web/components/admin/admin-sidebar.tsx` | 38 | `Grapit Admin` |
| `apps/web/app/admin/layout.tsx` | 59 | `<span>Grapit Admin</span>` (모바일용 중복) |

#### C. 이메일 템플릿
| File | Line | Content |
|------|------|---------|
| `apps/api/src/modules/auth/email/email.service.ts` | 73 | `subject: '[Grapit] 비밀번호 재설정'` |
| `apps/api/src/modules/auth/email/templates/password-reset.tsx` | — | 본문 내 브랜드명 **미포함** (스타일만, 필요 시 브랜드 추가 검토 — out-of-scope) |
| `apps/api/src/modules/auth/email/email.service.spec.ts` | 49, 60, 89 | test email `no-reply@grapit.com` (테스트 expected value — 동반 갱신 필요) |

#### D. SMS 발신
| File | Line | Content |
|------|------|---------|
| `apps/api/src/modules/sms/sms.service.ts` | 203 | `` `[Grapit] 인증번호 ${otp} (3분 이내 입력)` `` |
| `apps/api/src/modules/sms/sms.service.spec.ts` | 299, 316 | test expected body `'[Grapit] 인증번호 654321 (3분 이내 입력)'` (spec + 테스트 이름 둘 다) |

**KISA sender ID 주의:** `sms.service.ts:115-121` 주석이 `INFOBIP_SENDER=Grapit` 같은 alphanumeric sender를 production에서 거부하는 가드임을 명시. 이 주석 내 `Grapit` 예시는 **유지** (실제 환경변수 값 예시가 아니라 반례) — 브랜드 변경 시 예시도 `Grabit`으로 자연스레 갱신.

#### E. Legal 문서 (Markdown)
| File | Line(s) | Content |
|------|---------|---------|
| `apps/web/content/legal/terms-of-service.md` | 4 | `Grapit(이하 "회사")` |
| `apps/web/content/legal/terms-of-service.md` | 73 | `- 서비스명: Grapit` |
| `apps/web/content/legal/terms-of-service.md` | 74 | `- 이메일: support@grapit.com` (이메일 주소 — 실제 계정 존재 여부는 Open Question 3) |
| `apps/web/content/legal/privacy-policy.md` | 3, 85 | `Grapit(이하 "회사")`, `개인정보 보호책임자: Grapit 대표` |
| `apps/web/content/legal/privacy-policy.md` | 59, 69, 86 | `privacy@grapit.com`, `support@grapit.com` (이메일 주소) |
| `apps/web/content/legal/marketing-consent.md` | 3 | `Grapit은 회원님께 ...` |

#### F. Booking/Reservation 관련 UI 카피
- `apps/web/app/booking/[performanceId]/complete/page.tsx` — `@grapit/shared` import만 (확인, 브랜드 문자열 없음)

#### G. 대소문자 케이스 분포 (SC-2 검증 시 필요)
- **`Grapit` (Title Case)** — UI 로고, legal, email subject, SMS body
- **`grapit` (lowercase)** — package scope, service name, file path, test DB name, email address
- **`GRAPIT` (ALL CAPS)** — 현재 0건 (확인됨)

### P3 — 인프라 리소스

**새 Cloud Run 서비스 복제 시 필요한 설정 (deploy.yml에서 추출):**
- service name: `grabit-web` / `grabit-api`
- region: `asia-northeast3`
- image: `${REGION}-docker.pkg.dev/${PROJECT_ID}/grabit/grabit-{web,api}:${SHA}` ← AR_REPO도 `grabit`으로 신설
- service account: `grapit-cloudrun@...` ← 아래 Open Question 1 (rename vs 유지)
- `--add-cloudsql-instances=${CLOUD_SQL_CONNECTION_NAME}` (DB 변경 없음, D-01)
- `--min-instances=0`, `--max-instances=5 (api) / 10 (web)`, `--memory=512Mi`, `--cpu=1`, `--port=8080 (api) / 3000 (web)`
- `--no-cpu-throttling`, `--session-affinity`, `--allow-unauthenticated` (api only)
- `--network=default`, `--subnet=default`, `--vpc-egress=private-ranges-only` (api only)
- env vars: `NODE_ENV`, `FRONTEND_URL`, `KAKAO_CALLBACK_URL`, `NAVER_CALLBACK_URL`, `GOOGLE_CALLBACK_URL` (`FRONTEND_URL`은 `heygrabit.com` 으로 교체 시 cutover 이후 반영)
- secrets (api): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, OAuth 6개, `REDIS_URL`, R2 5개, Resend 2개, Infobip 3개, `SENTRY_DSN`, `TOSS_SECRET_KEY`
- secrets (web): `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TOSS_CLIENT_KEY` (build-time args)

**Sentry:**
- 새 프로젝트 `grabit-web` (Next.js platform) + `grabit-api` (Node.js platform) 생성
- 새 DSN 발급 → Secret Manager `sentry-dsn` 값 **교체** (secret 이름은 유지, 값만 변경) → Cloud Run revision 재배포 시 반영됨
- 웹 빌드타임 `NEXT_PUBLIC_SENTRY_DSN` 값도 교체 — deploy.yml의 `--build-arg` 경로
- `SENTRY_ORG`, `SENTRY_PROJECT` env 값도 새 프로젝트 기준으로 갱신 (현재 next.config.ts는 env에서 읽음)

**Artifact Registry:**
- 새 repo `grabit` 생성 (기존 repo rename 불가 — 이름 immutable [CITED: cloud.google.com/artifact-registry/docs/docker/names])
- deploy.yml `env.AR_REPO: grapit` → `grabit`

### P4 — Cutover

**Prerequisites:**
- P3 PR merged → deploy.yml이 새 서비스명을 가리킴 → main push로 `grabit-*` 서비스 최초 배포 성공
- 새 서비스의 Cloud Run URL로 health check (`/api/v1/health`, `/`) green
- Sentry 새 프로젝트에서 최소 1건 이벤트 수신 확인

**Cutover sequence:**
1. 구 매핑 describe → rollback.yaml 저장
2. 구 매핑 delete
3. 신 매핑 create
4. status Ready까지 poll (Google-managed cert 재발급, 수 분 ~ 십여 분)
5. `curl -sI https://heygrabit.com/`, `https://heygrabit.com/api/v1/health` 검증
6. UI 로드 + 실제 로그인 + SMS 수신 + 이메일 수신 HUMAN-UAT

**7일 후 정리 (별도 commit):**
- `gcloud run services delete grapit-web --region=asia-northeast3`
- `gcloud run services delete grapit-api --region=asia-northeast3`
- `gcloud artifacts repositories delete grapit --location=asia-northeast3`
- Sentry 구 프로젝트 archive/delete
- (선택) `grapit-postgres` docker 컨테이너명은 로컬 영향만 — 개발자가 수동.

## Implementation Approach

### P1: 코드/설정 rename — 단일 PR

**Serial 필수 순서:**
1. `packages/shared/package.json` name → `@grabit/shared`
2. `apps/api/package.json` name + dependencies 동시
3. `apps/web/package.json` name + dependencies 동시
4. root `package.json` name
5. 모든 import `@grapit/shared` → `@grabit/shared` (IDE refactor or `rg -l '@grapit/shared' | xargs sed -i '' 's/@grapit\/shared/@grabit\/shared/g'` — macOS sed 주의)
6. `next.config.ts`, `tsconfig.json`, `vitest.config.ts` 의 scope
7. Dockerfile 2개 (`pnpm --filter @grapit/*`)
8. workflows 2개 (`pnpm --filter @grapit/*` + `grapit-cloudrun` SA 는 Open Question 1 별도)
9. `seed.mjs`, E2E helper, email spec의 `admin@grapit.test` / `@grapit.com` / `@e2e.grapit.dev` rename
10. `pnpm install` (루트) → lockfile 재생성
11. `pnpm lint` → `pnpm typecheck` → `pnpm test` 로컬 green 확인
12. git commit + push → CI green 확인 → PR 머지

**Parallelize 가능:** 5~9는 각자 독립 파일이라 한 커밋 내 서로 순서 무관. 단 1~4는 반드시 먼저 완료.

**예상 소요:** 30~60분 (lockfile 재생성 포함, 테스트 통과 확인 포함).

### P2: 사용자 노출 카피 — 단일 PR

**병렬 가능:** A/B/C/D/E/F 섹션은 각각 독립 모듈이라 순서 무관. 한 커밋에 일괄 변경.

**특이사항:**
- email/sms spec 파일의 expected value도 동반 변경 (테스트 실패 방지)
- legal MD 내 이메일 주소(`@grapit.com`)는 Open Question 3 결정 후 처리
- footer copyright `2026 Grapit`의 `Grapit`만 변경 (연도는 유지)

**예상 소요:** 20~40분.

### P3: 인프라 식별자 생성 — 단일 PR + GCP 수동 작업

**Manual (gcloud) 먼저:**
1. `gcloud artifacts repositories create grabit --repository-format=docker --location=asia-northeast3`
2. Sentry 대시보드에서 `grabit-web`, `grabit-api` 프로젝트 생성 → DSN 복사
3. Secret Manager 값 갱신:
   - `sentry-dsn` (backend): 새 `grabit-api` DSN 값으로 덮어쓰기
   - `NEXT_PUBLIC_SENTRY_DSN` (GitHub Actions secret): 새 `grabit-web` DSN으로 갱신
4. (선택) 새 GCP 서비스 계정 `grabit-cloudrun@...` 생성 + IAM 바인딩 (Open Question 1 결정 시)

**Code PR (deploy.yml 갱신):**
```yaml
env:
  AR_REPO: grabit                # was: grapit
  WEB_SERVICE: grabit-web        # was: grapit-web
  API_SERVICE: grabit-api        # was: grapit-api
```
- service-account flag도 Open Question 1 결정 반영
- 이 PR이 merge되면 첫 번째 deploy에서 **새 Cloud Run service가 자동 생성된다** (domain-mapping은 아직 구 서비스에 있으므로 사용자 영향 0)

**Parallelize 가능:** Manual 작업과 Code PR은 독립. Code PR은 먼저 열어두되, Manual 작업이 끝나기 전에 merge 금지.

**예상 소요:** 1~2시간 (Sentry 프로젝트 생성 + GCP console + PR review).

### P4: 도메인 cutover + 7일 후 정리 — 2개 commit

**Cutover commit:**
- `.planning/phases/13-grapit-grabit-rename/13-HUMAN-UAT.md` 작성 (체크리스트만)
- 코드 변경 없음
- 실제 작업은 gcloud CLI 수동 (위 Pattern 2 절차)

**정리 commit (7일 후):**
- `scripts/cleanup-old-grapit-resources.sh` (optional, 실행 이력 남기기 용)
- Cloud Run svc 삭제, AR repo 삭제, Sentry 프로젝트 archive

**예상 소요:** cutover 30분 (대기 시간 포함) + HUMAN-UAT 15~30분 + 7일 후 정리 15분.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **pnpm-lock.yaml drift → CI 전체 실패** | HIGH | HIGH (전 PR 차단) | P1 PR 머지 전 로컬에서 `pnpm install --frozen-lockfile` 통과 확인. lockfile도 같은 커밋에 포함. |
| **`sed` 치환이 `.planning/` 까지 도달** | MEDIUM | HIGH (SC-4 위반) | ripgrep/sed 명령에 `--glob '!.planning/**'` 또는 `grep -L --exclude-dir=.planning` 필수. 커맨드 alias화. |
| **Cloud Run domain-mapping cutover 중 SSL 발급 지연 (사용자 503)** | MEDIUM | MEDIUM (수 분~수십 분 장애) | (1) Off-peak 시간대 cutover, (2) rollback.yaml 사전 캡처로 즉시 되돌릴 수 있음, (3) Cloud Run URL(`.run.app`) 로 병행 접근 가능하게 안내 배너 준비. |
| **Sentry DSN 교체 누락 → 에러 유실** | LOW | MEDIUM (감시 사각) | Secret Manager에서 `sentry-dsn` 버전 history 확인. 새 revision 배포 후 일부러 에러 발생시켜 새 프로젝트에 잡히는지 확인. |
| **`admin@grapit.test` seed 이메일 변경 시 CI secret 미갱신** | MEDIUM | MEDIUM (E2E 전부 실패) | seed.mjs 변경과 동시에 `TEST_USER_EMAIL` GitHub secret 갱신 (gh secret set). CI log에서 실제 사용 이메일 grep 검증. |
| **Artifact Registry 구 repo의 이미지 공간 비용** | LOW | LOW | 7일 유예 내내 유지는 OK. 정리 commit 시 `gcloud artifacts repositories delete grapit` — 모든 이미지 같이 사라짐. |
| **`scripts/provision-valkey.sh`의 `grapit-valkey` 인스턴스명 rename을 실제로 실행** | MEDIUM | HIGH (Valkey 데이터 재생성 = 좌석 잠금 유실) | 이 스크립트는 **provisioning 용**이지 rename 용 아님. 스크립트 내부 변수만 `grabit-*`로 바꾸고 주석에 "existing `grapit-valkey` instance still in use — do NOT rerun" 추가. |
| **도메인 매핑 Status 지연 → UAT 시작이 CI 머지 직후 불가** | MEDIUM | LOW | poll 스크립트 (위 Pattern 2 step 3) 사용. 최대 15분 대기 권장. |
| **Cloud Run 서비스 계정 `grapit-cloudrun@...`를 rename하면 IAM 바인딩 전부 재설정 필요** | LOW if retain / HIGH if rename | HIGH | Open Question 1. 기본 추천: **유지**. 브랜드 통일은 이름 표면이 아니라 _외부 지표_(Sentry/AR/Cloud Run svc) 수준이면 충분. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (unit + integration) + Playwright 1.x (E2E) |
| Config files | `apps/api/vitest.config.ts`, `apps/api/vitest.integration.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm test` (turbo 전체) or `pnpm --filter @grabit/{api,web} test` |
| Full suite command | `pnpm test && pnpm --filter @grabit/api test:integration && pnpm --filter @grabit/web test:e2e` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| SC-1 | `pnpm install --frozen-lockfile` 성공 | smoke | `pnpm install --frozen-lockfile` | ✅ (CI 재현) |
| SC-1 | `pnpm lint` 통과 | static | `pnpm lint` | ✅ |
| SC-1 | `pnpm typecheck` 통과 | static | `pnpm typecheck` | ✅ |
| SC-1 | `pnpm test` 통과 | unit | `pnpm test` | ✅ |
| SC-1 | import resolution OK (@grabit/shared) | build | `pnpm --filter @grabit/{api,web} build` | ✅ |
| SC-2 | UI copy 잔여물 0 | grep | `rg 'Grapit\\|grapit' apps/web/{app,components,content} \| grep -v '@grabit'` | ✅ (새 wave 0 script) |
| SC-2 | email subject / body grabit | unit | `pnpm --filter @grabit/api test -- email.service.spec` | ✅ (기존 spec) |
| SC-2 | SMS body grabit | unit | `pnpm --filter @grabit/api test -- sms.service.spec` | ✅ (기존 spec 수정) |
| SC-2 | 실제 이메일 수신 시 subject `[Grabit]` | manual | HUMAN-UAT | ❌ Wave 0 (체크리스트) |
| SC-2 | 실제 SMS 수신 시 `[Grabit]` 접두사 | manual | HUMAN-UAT | ❌ Wave 0 (체크리스트) |
| SC-3 | `grabit-api`/`grabit-web` 서비스 Ready | smoke | `gcloud run services describe grabit-api --region=asia-northeast3 --format='value(status.conditions[0].status)'` | ❌ Wave 0 (script) |
| SC-3 | `heygrabit.com` HTTPS 200 | smoke | `curl -sI https://heygrabit.com/ \| head -1` | ❌ Wave 0 |
| SC-3 | 새 Sentry 프로젝트에 이벤트 수신 | manual | Sentry dashboard 확인 | ❌ Wave 0 (HUMAN-UAT) |
| SC-4 | `.planning/milestones/v1.0-phases/` 파일 변경 0 | git diff | `git diff --name-only main...HEAD -- '.planning/milestones/'` → empty | ✅ (git 기본) |
| SC-4 | 완료된 phase 폴더(07~12) 변경 0 | git diff | `git diff --name-only main...HEAD -- '.planning/phases/0[7-9]*' '.planning/phases/1[012]*' '.planning/phases/09.1*' '.planning/phases/10.1*'` | ✅ |

### Sampling Rate
- **Per task commit (P1/P2):** `pnpm lint && pnpm typecheck` (<30s 목표)
- **Per plan merge (P1):** `pnpm test` (unit full)
- **Per plan merge (P3):** gcloud CLI로 새 서비스 describe + curl health check
- **Phase gate (P4 HUMAN-UAT 전):** full suite + E2E + grep audit

### Wave 0 Gaps
- [ ] `scripts/audit-brand-rename.sh` — `grapit` 잔여물 scan (exclude `.planning`, `node_modules`, `.next`, `dist`, `pnpm-lock.yaml`의 `@grapit/*` 참조는 재생성 전 일시적으로 남을 수 있으므로 별도 화이트리스트 필요)
- [ ] `scripts/smoke-test-grabit-cutover.sh` — `gcloud run services describe` + curl domain 2건
- [ ] `.planning/phases/13-grapit-grabit-rename/13-HUMAN-UAT.md` — cutover 당일 체크리스트 (아래 Validation 축별 fact/signal/hook 표 기반)

*(framework 자체는 이미 설치되어 있음 — 추가 설치 없음)*

### Fact → Signal → Validation Hook 매핑 (plan에서 acceptance_criteria로 변환)

**축 1 — 빌드/타입체크/린트 (SC-1)**
| Fact | Signal | Validation Hook |
|------|--------|-----------------|
| `@grabit/shared`가 workspace에서 resolve된다 | `pnpm install --frozen-lockfile` exit 0 | P1 plan acceptance: CI pnpm install step green |
| 모든 import가 `@grabit/shared`다 | `pnpm typecheck` 0 error | P1 plan acceptance: turbo typecheck green |
| lint 규칙 유지 | `pnpm lint` exit 0 | P1 plan acceptance |
| unit test 유지 | `pnpm test` 0 failure | P1 plan acceptance + P2 plan (email/sms spec) |

**축 2 — 사용자 노출 카피 (SC-2)**
| Fact | Signal | Validation Hook |
|------|--------|-----------------|
| 프론트 코드에 `Grapit` 0건 | `rg 'Grapit' apps/web/{app,components,content} --glob '!*.test.*' --glob '!*.spec.*' \| wc -l` == 0 | P2 plan acceptance: grep script exit 0 |
| email subject가 `[Grabit]` | `email.service.spec.ts`에서 `[Grabit]` expected | P2 plan acceptance: spec update + unit green |
| SMS body가 `[Grabit]` | `sms.service.spec.ts` 299/316 라인 fixture = `[Grabit]` | P2 plan acceptance |
| 실제 이메일/SMS 발송 시 수신자에게 `[Grabit]` 표시 | 수동 — staging or prod 1회 발송 후 스크린샷 | P4 HUMAN-UAT 체크리스트 2건 |
| legal MD에 `Grapit` 0건 (이메일 주소 `@grapit.com` 제외 or 포함 결정 반영) | `rg 'Grapit' apps/web/content/legal/ \| wc -l` = 0 | P2 plan acceptance |

**축 3 — 인프라/서비스 (SC-3)**
| Fact | Signal | Validation Hook |
|------|--------|-----------------|
| 새 Cloud Run 서비스 `grabit-{api,web}` Ready | `gcloud run services describe grabit-api --region=asia-northeast3 --format='value(status.conditions[0].status)'` == `True` | P3 plan acceptance: gcloud describe green |
| 새 서비스에서 health 200 | `curl -sI ${NEW_CLOUD_RUN_URL}/api/v1/health \| head -1` == `HTTP/2 200` OR `503` (Valkey fallback OK) | P3 plan acceptance |
| 도메인이 새 서비스로 매핑됨 | `gcloud beta run domain-mappings describe --domain=heygrabit.com --region=asia-northeast3 --format='value(spec.routeName)'` == `grabit-web` | P4 plan acceptance |
| HTTPS 도메인 200 | `curl -sI https://heygrabit.com/ \| head -1` == `HTTP/2 200` | P4 plan acceptance |
| 새 Sentry 프로젝트에 실제 이벤트 수신 | Sentry dashboard 최근 이벤트 timestamp >= cutover 시각 | P4 HUMAN-UAT |

**축 4 — Out-of-scope 경계 (SC-4)**
| Fact | Signal | Validation Hook |
|------|--------|-----------------|
| `.planning/milestones/` 변경 0 | `git diff --name-only main...HEAD -- '.planning/milestones/'` == empty | All P1~P4 plans |
| 완료된 phase 폴더 변경 0 | `git diff --name-only main...HEAD -- '.planning/phases/0[1-9]*' '.planning/phases/1[012]*' '.planning/phases/09.1*' '.planning/phases/10.1*'` == empty | All P1~P4 plans |
| `.planning/quick/` 변경 0 | `git diff --name-only main...HEAD -- '.planning/quick/'` == empty | All P1~P4 plans |
| commit history 건드리지 않음 | 해당 없음 (git rebase 금지 선언만) | P1 plan의 implementation notes |

## Security Domain

> security_enforcement 상태 확인 실패 시 기본 enabled로 간주. 본 phase는 인증·데이터 취급 코드 신규 도입 없음.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 코드 변경 없음 — 문자열 rename만 |
| V3 Session Management | no | 영향 없음 |
| V4 Access Control | yes (partial) | `grapit-cloudrun@` IAM 서비스 계정 유지 권고 — rename 시 bindings 누락 리스크 |
| V5 Input Validation | no | 영향 없음 |
| V6 Cryptography | no | argon2/JWT secret 값 변경 없음 |
| V7 Error Handling | yes (partial) | Sentry DSN 교체 시 잠깐 이벤트 유실 위험 — 재배포 gate에서 검증 |
| V10 Malicious Code | no | 영향 없음 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Domain cutover 중 SSL 인증서 미발급 상태에서 사용자 오인 | Spoofing | Cutover 시간을 공지 + SSL Ready 확인 후에만 UAT 시작 |
| 구 Sentry 프로젝트로 가서 에러 유실 → 장애 미인지 | Denial (observability) | DSN 교체 후 의도적 에러 1건 발생으로 새 프로젝트 수신 확인 |
| sed 치환이 `.planning/` 의 historical record 손상 | Tampering (internal) | glob exclude 강제 + CI의 SC-4 grep check |
| CI secret `TEST_USER_EMAIL` 이 seed.mjs 와 비동기 갱신 | Functional failure (non-security) | gh secret set 을 P1 PR의 체크리스트에 포함 |

## Open Questions (RESOLVED)

> 2026-04-22 plan-phase에서 사용자 확인으로 해소됨. 각 항목에 RESOLVED 라인 추가.

**1. Cloud Run service account `grapit-cloudrun@...` rename 여부?**
   - **RESOLVED:** D-05 — **유지**. SA 이름은 `grapit-cloudrun@` 그대로. deploy.yml/provision-valkey.sh 내 SA 참조 변경 없음.
   - **What we know:** deploy.yml 81, 168 라인 + scripts/provision-valkey.sh 26, 86 라인에 `grapit-cloudrun@${PROJECT_ID}.iam.gserviceaccount.com` 하드코딩. Cloud SQL connect / Secret Manager accessor / AR reader 등 IAM 바인딩 다수.
   - **What's unclear:** SC-3("Cloud Run 서비스가 grabit 식별자로 정상 동작") 범위가 service account 이름까지 포함하는가?
   - **Recommendation:** **유지**를 plan-phase의 기본값으로 제안. 이유: (a) 서비스 계정 rename = IAM 바인딩 14~16개 재생성, 리스크 대비 가시적 이익 낮음, (b) CONTEXT.md D-02의 "함께 rename 대상" 목록에 service account 미포함 (의도적 누락일 가능성), (c) 서비스 계정 이름은 외부 지표(도메인/브랜드)에 노출되지 않음. plan-phase에서 user confirmation 받기.

**2. `grapit_test` (CI Postgres DB) / `grapit` (container_name) / `grapit_dev` (password) 처리?**
   - **RESOLVED:** D-06 — **전부 rename**. `grapit_test`→`grabit_test`, `container_name: grapit-postgres`→`grabit-postgres`, `POSTGRES_DB: grapit`→`grabit`. 단 `grapit_dev` password는 D-01의 연장으로 **유지**.
   - **What we know:** CONTEXT.md D-01이 prod DB rename은 제외지만, dev/CI는 명시 없음. docker-compose.yml의 `container_name: grapit-postgres` 와 `POSTGRES_DB: grapit`은 로컬 dev용. `.github/workflows/ci.yml`의 `POSTGRES_DB: grapit_test`는 CI 전용.
   - **What's unclear:** 이 셋이 "prod DB 제외" 원칙에 해당하는가, "코드/설정 rename" 원칙에 해당하는가?
   - **Recommendation:** (a) `docker-compose.yml` `POSTGRES_PASSWORD: grapit_dev`는 CONTEXT 명시로 **유지**, (b) `container_name: grapit-postgres`, `POSTGRES_DB: grapit`은 로컬 개발자 1회 `docker compose down` 으로 충분 → **변경 권장** (P1에 포함), (c) `grapit_test`는 CI 전용이라 CI secret 갱신 없이 자유롭게 **변경 가능** → **변경 권장** (P1에 포함, seed email과 함께). plan-phase에서 최종 확인.

**3. Legal MD의 `support@grapit.com` / `privacy@grapit.com` 처리?**
   - **RESOLVED:** D-07 — **`@heygrabit.com` 으로 전단 일괄 치환**. legal MD 4건(`support@`, `privacy@`) 모두 heygrabit 도메인. 실제 mailbox 개설은 사업자등록 후 별도 작업으로 deferred (P2 plan에 노트 포함).
   - **What we know:** `apps/web/content/legal/{privacy-policy,terms-of-service}.md`에 이메일 주소 4군데. 법적 문서에 명시된 컨택 포인트.
   - **What's unclear:** 실제 `@grapit.com` 도메인 이메일이 발송/수신 가능한 상태인가? `@heygrabit.com` 이메일은 런칭 시점에 준비되는가?
   - **Recommendation:** (a) 기본은 `@grabit.com` 혹은 `@heygrabit.com` 로 변경하되, (b) P2 plan에 "사업자등록 + 도메인 이메일 계정 생성 완료 후에만 변경" 전제 조건 명시. 만약 이메일 인프라가 아직 없다면 임시로 `@heygrabit.com`으로 치환 + `mailbox 개설 전까지 회신 불가` 플레이스홀더 처리. plan-phase에서 user confirm.

**4. `@grapit.com` 이메일의 테스트 코드 내 사용(`no-reply@grapit.com`)은 실제 도메인 일치가 필요한가?**
   - **RESOLVED:** D-07 — test fixture도 `@heygrabit.com` 으로 치환(`no-reply@heygrabit.com` 등). `email.service.spec.ts`의 `RESEND_FROM_EMAIL` fixture 갱신은 Plan 01 Task 2 범위. Resend verified sender 실제 설정은 P3 범위로 분리.  
     `@social.grapit.com` (auth.service.ts fallback) 은 소셜 로그인 내부 합성 이메일이라 사용자 노출 없음 → D-07 예외로 `@social.grabit.com` 처리 (Plan 01 Task 2 decision_constraints에 예외 명시 필요).
   - **What we know:** `email.service.spec.ts`의 `RESEND_FROM_EMAIL: 'no-reply@grapit.com'`은 pure test fixture. 실제 Resend 설정은 Secret Manager에 별도.
   - **Recommendation:** fixture만 `no-reply@grabit.com` 으로 바꾸고, Resend verified sender 설정은 P3 범위로 분리. plan-phase에서 명확히.

**5. 블루-그린 기간 중 `FRONTEND_URL` 환경변수 처리?**
   - **RESOLVED:** D-08 — OAuth callback URL 3개 콘솔 재등록은 **P4 cutover 직전 HUMAN-UAT**에 편성. P3 단계에서는 새 callback 등록 없음(OAuth 테스트는 cutover 이후). `CLOUD_RUN_WEB_URL` GitHub variable은 새 `grabit-web` Cloud Run URL로 갱신하되 OAuth 콜백은 cutover 후 등록.
   - **What we know:** deploy.yml `FRONTEND_URL=${{ vars.CLOUD_RUN_WEB_URL }}` — `grabit-web` 배포 시 GitHub variable도 새 Cloud Run URL로 갱신 필요. OAuth callback URL들도 같은 이슈.
   - **What's unclear:** 블루-그린 기간 동안 구 서비스도 살아있어야 하는데, GitHub variable은 하나뿐.
   - **Recommendation:** P3 deploy는 구 서비스에도 계속 갈 필요 없이 **새 서비스만 deploy**. GitHub variable `CLOUD_RUN_WEB_URL`은 새 `grabit-web`의 `.run.app` URL로 갱신 (cutover 전에는 OAuth 콜백이 구 URL 기반이므로 OAuth 테스트는 cutover 후 HUMAN-UAT에서만). 구 서비스는 기존 배포 상태로 domain 매핑만 유지하다 cutover 때 domain 매핑 이전. plan-phase에서 OAuth 콜백 callback URL 목록 변경 타이밍을 명확히 (카카오/네이버/구글 개발자 콘솔에서 신 URL 등록).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | P1 lockfile 재생성 | ✓ (예상) | 10.28.1 | — |
| Node.js | 로컬 test 실행 | ✓ (예상) | >= 22 | — |
| Docker | 로컬 postgres 재기동 (선택) | ✓ (예상) | 24.x | — |
| gcloud CLI | P3/P4 infra ops | ? | N/A | `docker run gcloud-sdk` or GitHub Actions 내 실행 |
| git | 모든 plan | ✓ | — | — |
| ripgrep | SC-2 검증 | ✓ (예상) | — | grep -r |
| GitHub CLI (`gh`) | CI secret 갱신 (TEST_USER_EMAIL) | ? | N/A | GitHub 웹 콘솔 |

**Missing dependencies with no fallback:** 없음.

**Missing dependencies with fallback:** 없음 (gcloud/gh는 웹 콘솔 fallback 가능하지만 자동화는 CLI 권장).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@grapit/root`, `@grapit/api`, `@grapit/web`, `@grapit/shared` 4개가 workspace package 전부다 | Dependencies & Integration Points § P1 | 추가 package 존재 시 rename 누락 — plan-phase에서 `pnpm ls -r --depth=0 --json` 으로 재확인 권장 [ASSUMED] |
| A2 | Cloud Run domain-mapping은 "도메인 1개 ↔ 서비스 1개" 관계이며 cutover는 delete→create | Pattern 2 | 만약 현재 Cloud Run 의 최신 API 가 multi-service split 지원한다면 더 안전한 경로 존재. [CITED: cloud.google.com/run/docs/mapping-custom-domains — generic docs reference, 실제 gcloud 명령 동작은 플랫폼 버전 의존] |
| A3 | Google-managed SSL 재발급은 수 분 ~ 십여 분 | Risks | 과거 경험 기반, [ASSUMED] — 최초 cutover는 off-peak 창에서 |
| A4 | `GRAPIT_*` env prefix 사용 사례 0 | CONTEXT `code_context` 섹션 인용 | CONTEXT 에서 이미 확인했다고 명시됨 (verified) |
| A5 | `apps/web/public/manifest*`, `robots.txt`, `sitemap.ts` 등 PWA/SEO 파일 미존재 | P2 Surface Inventory § A | 실제 파일시스템 스캔으로 확인 완료 (verified) |
| A6 | Sentry `SENTRY_DSN` env 변수 이름은 유지하고 값만 교체 | P3 | next.config.ts 와 sentry config 파일에서 `process.env.SENTRY_DSN` 참조 확인됨 (verified) |
| A7 | Cloud Run service account `grapit-cloudrun@` rename은 범위 제외 | Open Question 1 | 저자 판단 — user confirm 필요 [ASSUMED] |
| A8 | `grapit_test`, `grapit_dev`, `grapit-postgres` 같은 dev/CI 식별자는 rename 대상 | Open Question 2 | CONTEXT.md 에 명시 없음 — user confirm 필요 [ASSUMED] |
| A9 | Legal MD 내 이메일 주소는 `@grabit.com` 또는 `@heygrabit.com` 로 치환 | Open Question 3 | 실제 mailbox 운영 상태 모름 — user confirm 필요 [ASSUMED] |
| A10 | Artifact Registry repo 이름은 immutable (rename 불가, 재생성만 가능) | State of the Art 표 | [CITED: cloud.google.com/artifact-registry/docs/docker/names] |
| A11 | Toss Payments secret(`TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`), Resend sender(`RESEND_FROM_EMAIL`), Infobip sender(`INFOBIP_SENDER`)는 브랜드 변경 시 **외부 제공자 콘솔에서도 갱신 필요할 수 있음** | P3 Infra | 각 제공자 dashboard 확인 필요. 특히 Resend는 domain verification + DKIM 재설정 가능성 — cutover 전에 충분한 lead time 필요 [ASSUMED] |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloud Run service rename 지원 (과거 루머) | 서비스 이름 immutable, 새 서비스 생성만 가능 | GA 이후 | 블루-그린이 유일한 경로 |
| Artifact Registry repo rename | 없음 (이름 immutable) | — | 새 repo 생성 + 기존 유지 후 삭제 |
| Cloud Run managed SSL 수동 cert 설정 | Google-managed auto-provisioning | 2021~ | domain-mapping 생성 시 자동, 수 분~십여 분 대기 |
| Sentry self-hosted DSN 교체 | SaaS 프로젝트별 DSN 관리 | stable | 새 프로젝트 생성 + DSN 발급 + Secret Manager 값 교체 |

## Sources

### Primary (HIGH confidence)
- 레포 파일 직접 read: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, `.github/workflows/{ci,deploy}.yml`, `apps/web/next.config.ts`, `apps/api/{Dockerfile,src/modules/auth/email/*,src/modules/sms/sms.service.ts,src/database/seed.mjs}`, `apps/web/{Dockerfile,app/layout.tsx,components/layout/*,content/legal/*,instrumentation*.ts,sentry.*.config.ts}`, `scripts/provision-valkey.sh`, `packages/shared/package.json`
- `.planning/phases/13-grapit-grabit-rename/13-CONTEXT.md` (locked decisions)
- `.planning/seeds/SEED-002-brand-rename-grapit-to-grabit.md`

### Secondary (MEDIUM confidence)
- [Cloud Run mapping custom domains (Google Cloud docs)](https://cloud.google.com/run/docs/mapping-custom-domains)
- [gcloud beta run domain-mappings create](https://cloud.google.com/sdk/gcloud/reference/beta/run/domain-mappings/create)
- [Artifact Registry repository names](https://cloud.google.com/artifact-registry/docs/docker/names)
- [pnpm workspace docs](https://pnpm.io/workspaces)
- [pnpm install --frozen-lockfile](https://pnpm.io/cli/install)

### Tertiary (LOW confidence)
- 없음 — WebSearch 결과는 모두 공식 docs 기반으로 cross-verify됨.

## Metadata

**Confidence breakdown:**
- 파일 surface / rename target 목록: HIGH — 실제 레포 스캔으로 확인
- pnpm workspace rename 절차: HIGH — workspace:* 프로토콜 공식 docs + 레포 기존 구조 확인
- Cloud Run domain-mapping cutover 순서: MEDIUM — 공식 docs 기반이지만 실제 플랫폼 동작은 버전 의존
- Sentry / AR rename 경로: HIGH — 이름 immutable 확인, 신규 생성 경로 표준
- Service account rename 결정: LOW → Open Question 1 로 에스컬레이션
- Dev/CI DB 이름 rename 결정: LOW → Open Question 2 로 에스컬레이션

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Cloud Run/Artifact Registry의 rename 지원 여부가 바뀔 수 있으므로 cutover 실행 직전 gcloud docs 재확인 권장)

## RESEARCH COMPLETE
