# Phase 13: 브랜드명 grapit → grabit 일괄 rename — Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 약 120개 수정 대상 (package manifest 4 + config 6 + workflow 2 + Dockerfile 2 + 애플리케이션 code import 92 + script 1 + seed/fixture 5 + user-facing copy 8 + docs 7)
**Analogs found:** N/A (이 phase는 rename — "새 파일 analog"가 아니라 **"기존 파일의 정확한 변경 패턴"**을 제공)

## Overview

**이 phase의 성격:** 새 capability 없음. 678건의 `grapit` 출현(.planning 제외)을 `grabit`으로 치환하고 Cloud Run/Sentry/Artifact Registry를 블루-그린으로 재생성.

**PATTERNS.md의 역할:** planner가 plan action/acceptance_criteria에 **그대로 복사**할 수 있는 before/after snippet과 sed/grep 명령, exclusion glob, 예외 리스트를 카테고리별로 제공한다. 각 snippet은 실제 파일의 라인 번호와 맞춰 검증 가능.

**상위 치환 규칙 (Case Sensitivity Table — 모든 카테고리에 공통 적용):**

| From | To | 현재 개수 (.planning 제외) | 예외? |
|------|-----|---------------------------|-------|
| `Grapit` | `Grabit` | UI 로고/footer/admin 제목 5건 + legal 4건 + email subject 1건 + SMS body 1건 + sms.service.ts:115,119 주석 예시 2건 | 없음 — 전수 치환 |
| `grapit` | `grabit` | package scope `@grapit/*` (4 manifest + 92 import + Dockerfile 5라인 + workflow 5라인 + vitest alias 2 + tsconfig paths 1) + service name `grapit-web/api/cloudrun/postgres/valkey` + AR_REPO `grapit` + CI DB `grapit_test` + container `grapit-postgres` + `POSTGRES_DB: grapit` + seed/test fixture 이메일 9건 | **유지 5건** — D-01/D-05/SC-4 하단 참조 |
| `GRAPIT` | `GRABIT` | **0건 확인** (RESEARCH §G) | N/A |

**매크로 exclude glob (모든 rename 명령에 필수):**
```bash
# ripgrep / sed / grep 공통
EXCLUDES=(
  --glob '!.planning/**'
  --glob '!.playwright-mcp/**'
  --glob '!node_modules/**'
  --glob '!**/node_modules/**'
  --glob '!apps/*/dist/**'
  --glob '!apps/*/.next/**'
  --glob '!packages/*/dist/**'
  --glob '!pnpm-lock.yaml'
  --glob '!.claude/**'
)
```

---

## Category 1: Package Manifests (P1)

### Files (topo order — 이 순서 필수)
1. `packages/shared/package.json` — name
2. `apps/api/package.json` — name + dependencies
3. `apps/web/package.json` — name + dependencies
4. `package.json` (root) — name
5. `pnpm-lock.yaml` — pnpm install로 **재생성** (수동 편집 금지)

### Reference Edits

**packages/shared/package.json:1**
```diff
- "name": "@grapit/shared",
+ "name": "@grabit/shared",
```

**apps/api/package.json:2, 19**
```diff
- "name": "@grapit/api",
+ "name": "@grabit/api",
...
-    "@grapit/shared": "workspace:*",
+    "@grabit/shared": "workspace:*",
```

**apps/web/package.json:2, 16**
```diff
- "name": "@grapit/web",
+ "name": "@grabit/web",
...
-    "@grapit/shared": "workspace:*",
+    "@grabit/shared": "workspace:*",
```

**package.json:2**
```diff
- "name": "@grapit/root",
+ "name": "@grabit/root",
```

**pnpm-lock.yaml:29, 207** (재생성 후 자동으로 `@grabit/shared: link:../../packages/shared` 로 변경됨)
```bash
# 반드시 위 4개 manifest 변경 커밋 후 실행
pnpm install   # lockfile 재생성
# 검증
pnpm install --frozen-lockfile   # exit 0 필수
```

### Why this order
`packages/shared` name을 먼저 바꾸지 않으면 consumer의 `dependencies["@grabit/shared"]`가 아직 존재하지 않는 스코프를 가리킨다. 또한 lockfile은 **마지막에 한 번만** 재생성해 partial state 방지.

### Verification
```bash
# 모든 manifest의 name이 @grabit/*인지 확인 — grapit 0 기대
jq -r '.name' package.json apps/*/package.json packages/*/package.json | grep grapit | wc -l
# Expected: 0

# workspace protocol 참조 정상
pnpm ls -r --depth 0 --json | jq -r '.[].name' | grep grapit | wc -l
# Expected: 0
```

---

## Category 2: Workspace / Build Config (P1)

### Files
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/vitest.config.ts`
- `apps/api/vitest.integration.config.ts`
- `pnpm-workspace.yaml` — **변경 불필요** (glob만 정의, 스코프명 없음 — 확인됨)
- `turbo.json` — **변경 불필요** (task 정의만, 확인됨)

### Reference Edits

**apps/web/next.config.ts:43**
```diff
-  transpilePackages: ['@grapit/shared'],
+  transpilePackages: ['@grabit/shared'],
```

**apps/web/tsconfig.json:14**
```diff
    "paths": {
      "@/*": ["./*"],
-     "@grapit/shared": ["../../packages/shared/src"]
+     "@grabit/shared": ["../../packages/shared/src"]
    }
```

**apps/web/vitest.config.ts:16**
```diff
    alias: {
      '@': resolve(__dirname, '.'),
-     '@grapit/shared': resolve(__dirname, '../../packages/shared/src'),
+     '@grabit/shared': resolve(__dirname, '../../packages/shared/src'),
    },
```

**apps/api/vitest.integration.config.ts:24**
```diff
  resolve: {
    alias: {
-     '@grapit/shared': resolve(__dirname, '../../packages/shared/src'),
+     '@grabit/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
```

### Verification
```bash
rg "@grapit/" apps/web/next.config.ts apps/web/tsconfig.json apps/*/vitest*.config.ts --count
# Expected: 0
```

---

## Category 3: Dockerfiles (P1)

### Files
- `apps/api/Dockerfile` (7, 8, 9행)
- `apps/web/Dockerfile` (17, 18행)

### Reference Edits

**apps/api/Dockerfile:7-9**
```diff
- RUN pnpm --filter @grapit/shared build
- RUN pnpm --filter @grapit/api build
- RUN pnpm --filter @grapit/api deploy --prod --legacy /deploy
+ RUN pnpm --filter @grabit/shared build
+ RUN pnpm --filter @grabit/api build
+ RUN pnpm --filter @grabit/api deploy --prod --legacy /deploy
```

**apps/web/Dockerfile:17-18**
```diff
- RUN pnpm --filter @grapit/shared build
- RUN pnpm --filter @grapit/web build
+ RUN pnpm --filter @grabit/shared build
+ RUN pnpm --filter @grabit/web build
```

### Verification
```bash
rg "@grapit/" apps/api/Dockerfile apps/web/Dockerfile --count
# Expected: 0
# 로컬 build smoke
docker build -f apps/api/Dockerfile -t grabit-api:test .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
  --build-arg NEXT_PUBLIC_WS_URL=http://localhost:8080 \
  --build-arg NEXT_PUBLIC_R2_HOSTNAME= \
  --build-arg NEXT_PUBLIC_SENTRY_DSN= \
  --build-arg NEXT_PUBLIC_TOSS_CLIENT_KEY= \
  -t grabit-web:test .
```

---

## Category 4: docker-compose.yml (P1, D-06 적용)

### File
- `docker-compose.yml`

### Reference Edits (D-06: container_name + POSTGRES_DB + POSTGRES_USER는 변경, **password는 D-01에 따라 유지**)

```diff
  services:
    postgres:
      image: postgres:16-alpine
-     container_name: grapit-postgres
+     container_name: grabit-postgres
      ports:
        - "5432:5432"
      environment:
-       POSTGRES_DB: grapit
-       POSTGRES_USER: grapit
-       POSTGRES_PASSWORD: grapit_dev
+       POSTGRES_DB: grabit
+       POSTGRES_USER: grabit
+       POSTGRES_PASSWORD: grapit_dev   # ← D-01: 비밀번호 유지
      volumes:
        - pgdata:/var/lib/postgresql/data
      healthcheck:
-       test: ["CMD-SHELL", "pg_isready -U grapit"]
+       test: ["CMD-SHELL", "pg_isready -U grabit"]
        interval: 5s
```

> **중요 — 개발자 1회 수동 작업:** `docker compose down -v && docker compose up -d` 로 컨테이너·볼륨 재생성. 기존 `grapit-postgres` 컨테이너는 이름 immutable이라 새로 만들어야 함.
> **로컬 `.env` 영향:** `DATABASE_URL=postgresql://grapit:grapit_dev@localhost:5432/grapit` 을 `DATABASE_URL=postgresql://grabit:grapit_dev@localhost:5432/grabit` 로 바꿔야 함(개발자 로컬 `.env`, 레포 커밋 대상 아님).

### Verification
```bash
rg "grapit" docker-compose.yml
# Expected: grapit_dev 1건만 남음 (D-01 password)
```

---

## Category 5: GitHub Workflows (P1 + P3)

### Files
- `.github/workflows/ci.yml` (P1 범위, D-06)
- `.github/workflows/deploy.yml` (P1 — pnpm filter / AR_REPO 등 코드 rename / P3 — 실제 Cloud Run cutover는 P3 머지와 함께)

### 5a. ci.yml — Reference Edits

**`.github/workflows/ci.yml:22, 32, 56, 59, 66, 90, 96, 136, 148`**
```diff
         env:
           POSTGRES_USER: postgres
           POSTGRES_PASSWORD: postgres
-          POSTGRES_DB: grapit_test
+          POSTGRES_DB: grabit_test
...
     env:
-      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/grapit_test
+      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/grabit_test
...
       - name: Run DB migrations
-        run: pnpm --filter @grapit/api exec drizzle-kit migrate
+        run: pnpm --filter @grabit/api exec drizzle-kit migrate

-      - name: Seed test data (admin@grapit.test)
-        run: pnpm --filter @grapit/api run seed
+      - name: Seed test data (admin@grabit.test)
+        run: pnpm --filter @grabit/api run seed
...
-          psql -h localhost -U postgres -d grapit_test -c \
-            "SELECT email, role, ... FROM users WHERE email='admin@grapit.test';"
+          psql -h localhost -U postgres -d grabit_test -c \
+            "SELECT email, role, ... FROM users WHERE email='admin@grabit.test';"
...
-        run: pnpm --filter @grapit/web exec playwright install --with-deps chromium
+        run: pnpm --filter @grabit/web exec playwright install --with-deps chromium
...
-        run: pnpm --filter @grapit/api build
+        run: pnpm --filter @grabit/api build
...
            -d '{"email":"admin@grapit.test","password":"TestAdmin2026!"}' \
# ↓
            -d '{"email":"admin@grabit.test","password":"TestAdmin2026!"}' \
...
-        run: pnpm --filter @grapit/web test:e2e
+        run: pnpm --filter @grabit/web test:e2e
```

### 5b. deploy.yml — Reference Edits (P3에서 Cloud Run cutover와 함께 머지)

**`.github/workflows/deploy.yml:11-13, 63, 81, 168`**
```diff
 env:
   GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
   GCP_REGION: asia-northeast3
-  AR_REPO: grapit
-  WEB_SERVICE: grapit-web
-  API_SERVICE: grapit-api
+  AR_REPO: grabit
+  WEB_SERVICE: grabit-web
+  API_SERVICE: grabit-api
...
       - name: Run migrations
         env:
           DATABASE_URL: ${{ secrets.DATABASE_URL }}
-        run: pnpm --filter @grapit/api exec drizzle-kit migrate
+        run: pnpm --filter @grabit/api exec drizzle-kit migrate
...
           flags: >-
-            --service-account=grapit-cloudrun@${{ env.GCP_PROJECT_ID }}.iam.gserviceaccount.com
+            --service-account=grapit-cloudrun@${{ env.GCP_PROJECT_ID }}.iam.gserviceaccount.com   # ← D-05: SA 유지
            --add-cloudsql-instances=${{ secrets.CLOUD_SQL_CONNECTION_NAME }}
... (167행도 동일 유지)
```

> **D-05 (예외):** `grapit-cloudrun@...` service account는 **유지**. deploy.yml 두 군데(L81, L168) 그대로 둠. IAM 바인딩 재생성 리스크 회피.
> **P3 cutover 타이밍:** P3 PR 머지 시점에 main push 트리거 → `grabit-*` 서비스가 처음 생성됨. 이때 domain mapping은 아직 구 `grapit-web`에 있으므로 사용자 영향 0.

### Verification
```bash
rg "@grapit/" .github/workflows/ --count
# Expected: 0

rg "grapit-web|grapit-api|grapit_test|AR_REPO: grapit" .github/workflows/ --count
# Expected: 0 (모두 grabit-*/grabit_test/AR_REPO: grabit로)

# D-05 예외 확인
rg "grapit-cloudrun@" .github/workflows/deploy.yml --count
# Expected: 2 (유지)
```

---

## Category 6: Application Code Import (P1)

### Scope
92개 파일 × `from '@grapit/shared*'` (RESEARCH §P1 확인; `Grep`로 직접 검증된 수치)

### Reference Pattern

전체 파일에서 다음 패턴이 등장:
```typescript
// BEFORE
import type { UserProfile } from '@grapit/shared/types/user.types.js';
import type { SocialAuthResult } from '@grapit/shared/types/auth.types.js';
import { REFRESH_TOKEN_EXPIRY_DAYS } from '@grapit/shared/constants/index.js';
import { SOMETHING } from '@grapit/shared';
```

모두 `@grapit/shared` → `@grabit/shared`로 치환 (suffix `/types/*.js`, `/constants/*`, `/schemas/*` 등은 그대로 유지).

### Bulk rename 명령 (macOS sed — BSD 계열이라 `-i ''` 필수)

```bash
# 1. 치환 대상 파일 목록 (git-tracked만, 오염 안전)
git ls-files '*.ts' '*.tsx' '*.mjs' '*.js' \
  | xargs rg -l "@grapit/" \
  | grep -v '^\.planning/' \
  | grep -v '^node_modules/' \
  > /tmp/grapit-rename-targets.txt

cat /tmp/grapit-rename-targets.txt | wc -l
# Expected: 92~100 (workflow/manifest 포함 시)

# 2. 일괄 치환 (macOS)
cat /tmp/grapit-rename-targets.txt | xargs sed -i '' 's|@grapit/|@grabit/|g'

# 3. 즉시 검증
rg "@grapit/" -l | grep -v '.planning/' | grep -v 'pnpm-lock.yaml'
# Expected: empty
```

### Linux sed variant (CI/container용 참고)
```bash
cat /tmp/grapit-rename-targets.txt | xargs sed -i 's|@grapit/|@grabit/|g'
```

### Verification
```bash
pnpm typecheck   # @grabit/shared 로 전체 resolve 확인
pnpm test        # unit 전체 green
```

---

## Category 7: Scripts (P1, D-05 예외 적용)

### File
- `scripts/provision-valkey.sh`

### Reference Edits (인스턴스는 재생성 안 하되 스크립트 변수만 갱신 + 주석 추가)

**scripts/provision-valkey.sh:4, 26, 32, 34, 86, 90**
```diff
 #!/usr/bin/env bash
 set -euo pipefail

-# Grapit - Google Memorystore for Valkey provisioning script
+# Grabit - Google Memorystore for Valkey provisioning script
+#
+# NOTE (Phase 13 rename): 이미 provision된 `grapit-valkey` 인스턴스는 이름 immutable
+# 이므로 그대로 사용 중. 본 스크립트 변수는 `grabit-*`로 갱신했지만 **재실행 금지**
+# (Valkey 데이터 재생성 = 좌석 잠금 유실). 신규 프로젝트에서만 rerun.
 # Usage: ./scripts/provision-valkey.sh <GCP_PROJECT_ID>
 ...
 #   3. Grant Cloud Run service account access to the secret:
 #      gcloud secrets add-iam-policy-binding redis-url \
-#        --member="serviceAccount:grapit-cloudrun@<PROJECT_ID>.iam.gserviceaccount.com" \
+#        --member="serviceAccount:grapit-cloudrun@<PROJECT_ID>.iam.gserviceaccount.com" \  # D-05: SA 유지
 ...
 PROJECT_ID="${1:?Usage: $0 <GCP_PROJECT_ID>}"
 REGION="asia-northeast3"
-INSTANCE_NAME="grapit-valkey"
+INSTANCE_NAME="grabit-valkey"
 NETWORK="default"
-POLICY_NAME="grapit-valkey-policy"
+POLICY_NAME="grabit-valkey-policy"
 ...
-#         --member='serviceAccount:grapit-cloudrun@$PROJECT_ID.iam.gserviceaccount.com' \
+#         --member='serviceAccount:grapit-cloudrun@$PROJECT_ID.iam.gserviceaccount.com' \  # D-05: SA 유지
```

### Verification
```bash
rg "grapit" scripts/provision-valkey.sh --count
# Expected: 2 (grapit-cloudrun@ 2건 D-05 예외)
```

---

## Category 8: Seed / Fixture / Test Email (P1)

### Files & Line Map
| File | Line(s) | Content |
|------|---------|---------|
| `apps/api/src/database/seed.mjs` | 19, 20, 21, 22, 49, 51 | `'admin@grapit.test'` 5건 + console.log 1건 |
| `apps/web/e2e/helpers/auth.ts` | 42, 73 | fallback `'admin@grapit.test'` + 에러 메시지 |
| `apps/web/e2e/signup-sms.spec.ts` | 27 | `test${timestamp}@e2e.grapit.dev` |
| `apps/api/src/modules/auth/email/email.service.spec.ts` | 49, 60, 89 | fixture `'no-reply@grapit.com'` 3건 |
| `apps/api/src/modules/auth/auth.service.ts` | 418 | `@social.grapit.com` fallback |

### Reference Edits (D-07: `@heygrabit.com` 기준 — legal MD와 통일)

**apps/api/src/database/seed.mjs:19-22, 49, 51**
```diff
-    await client.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grapit.test')");
-    await client.query("DELETE FROM social_accounts WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grapit.test')");
-    await client.query("DELETE FROM terms_agreements WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grapit.test')");
-    await client.query("DELETE FROM users WHERE email = 'admin@grapit.test'");
+    await client.query("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grabit.test')");
+    await client.query("DELETE FROM social_accounts WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grabit.test')");
+    await client.query("DELETE FROM terms_agreements WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@grabit.test')");
+    await client.query("DELETE FROM users WHERE email = 'admin@grabit.test'");
...
-      VALUES (gen_random_uuid(), 'admin@grapit.test', $1, '관리자', '010-0000-0000', 'unspecified', 'KR', '1990-01-01', 'admin', true, true)
+      VALUES (gen_random_uuid(), 'admin@grabit.test', $1, '관리자', '010-0000-0000', 'unspecified', 'KR', '1990-01-01', 'admin', true, true)
...
-    console.log('Inserted admin user: admin@grapit.test');
+    console.log('Inserted admin user: admin@grabit.test');
```

> **동반 작업 (plan 체크리스트):** GitHub repository secret `TEST_USER_EMAIL` 값도 `admin@grabit.test` 로 갱신. `gh secret set TEST_USER_EMAIL --body 'admin@grabit.test'` — 안 하면 E2E 인증이 빈 문자열 fallback을 거쳐도 seed 이메일과 불일치로 401.

**apps/web/e2e/helpers/auth.ts:42, 73**
```diff
-  const email = process.env['TEST_USER_EMAIL'] || 'admin@grapit.test';
+  const email = process.env['TEST_USER_EMAIL'] || 'admin@grabit.test';
...
-        `  Hint: Run 'pnpm --filter @grapit/api seed' and ensure TEST_USER_* env matches seed.mjs:39-50.`,
+        `  Hint: Run 'pnpm --filter @grabit/api seed' and ensure TEST_USER_* env matches seed.mjs:39-50.`,
```

**apps/web/e2e/signup-sms.spec.ts:27**
```diff
-    await page.getByPlaceholder('이메일을 입력해주세요').fill(`test${timestamp}@e2e.grapit.dev`);
+    await page.getByPlaceholder('이메일을 입력해주세요').fill(`test${timestamp}@e2e.grabit.dev`);
```

**apps/api/src/modules/auth/email/email.service.spec.ts:49, 60, 89**
```diff
       RESEND_FROM_EMAIL: 'no-reply@grapit.com',
# ↓ (3군데 동일)
       RESEND_FROM_EMAIL: 'no-reply@grabit.com',
...
-    expect(callArg.from).toBe('no-reply@grapit.com');
+    expect(callArg.from).toBe('no-reply@grabit.com');
```

**apps/api/src/modules/auth/auth.service.ts:418**
```diff
-    const email = payload.email ?? `${payload.provider}_${payload.providerId}@social.grapit.com`;
+    const email = payload.email ?? `${payload.provider}_${payload.providerId}@social.grabit.com`;
```

### Verification
```bash
rg "grapit\.test|grapit\.com|grapit\.dev" apps/ --count
# Expected: 0 (테스트 영역은 전수 치환)

pnpm --filter @grabit/api test -- email.service.spec sms.service.spec
# Expected: green (spec 내 expected 값도 동반 변경)
```

---

## Category 9: User-Facing Copy — UI (P2)

### Files & Line Map
| File | Line | Content |
|------|------|---------|
| `apps/web/app/layout.tsx` | 11 | `title: 'Grapit - 공연 티켓 예매'` |
| `apps/web/app/page.tsx` | 15 | `<h1 className="sr-only">Grapit</h1>` |
| `apps/web/components/layout/gnb.tsx` | 110 | `Grapit` 로고 텍스트 |
| `apps/web/components/layout/footer.tsx` | 24 | `© 2026 Grapit. All rights reserved.` |
| `apps/web/components/layout/mobile-menu.tsx` | 75 | `<span>Grapit</span>` |
| `apps/web/components/admin/admin-sidebar.tsx` | 38 | `Grapit Admin` |
| `apps/web/app/admin/layout.tsx` | 59 | `<span>Grapit Admin</span>` |

### Reference Edit Pattern (모두 단순 `Grapit` → `Grabit` 치환)

**apps/web/app/layout.tsx:11**
```diff
 export const metadata: Metadata = {
-  title: 'Grapit - 공연 티켓 예매',
+  title: 'Grabit - 공연 티켓 예매',
   description: '공연, 전시, 스포츠 등 라이브 엔터테인먼트 티켓 예매 플랫폼',
 };
```

**apps/web/components/layout/footer.tsx:24**
```diff
-          &copy; 2026 Grapit. All rights reserved.
+          &copy; 2026 Grabit. All rights reserved.
```

**apps/web/components/layout/gnb.tsx:110**
```diff
           <Link href="/" className="mr-8 text-xl font-semibold text-primary">
-            Grapit
+            Grabit
           </Link>
```

> **연도 주의:** footer의 `2026`은 유지 (브랜드만 치환).

### Bulk 명령 (UI 한정, 안전)
```bash
sed -i '' 's/\bGrapit\b/Grabit/g' \
  apps/web/app/layout.tsx \
  apps/web/app/page.tsx \
  apps/web/components/layout/gnb.tsx \
  apps/web/components/layout/footer.tsx \
  apps/web/components/layout/mobile-menu.tsx \
  apps/web/components/admin/admin-sidebar.tsx \
  apps/web/app/admin/layout.tsx
```

### Verification
```bash
rg "\\bGrapit\\b" apps/web/{app,components} --glob '!*.test.*' --glob '!*.spec.*' | wc -l
# Expected: 0
```

---

## Category 10: Email / SMS Body (P2)

### Files & Line Map
| File | Line | Before → After |
|------|------|----------------|
| `apps/api/src/modules/auth/email/email.service.ts` | 73 | `subject: '[Grapit] 비밀번호 재설정'` → `subject: '[Grabit] 비밀번호 재설정'` |
| `apps/api/src/modules/sms/sms.service.ts` | 203 | `` `[Grapit] 인증번호 ${otp} (3분 이내 입력)` `` → `[Grabit] ...` |
| `apps/api/src/modules/sms/sms.service.ts` | 115, 119 | 주석 예시 `INFOBIP_SENDER=Grapit` / `Grapit adds non-KR routes` → `Grabit` |
| `apps/api/src/modules/sms/sms.service.spec.ts` | 299, 316 | `[Grapit] 인증번호 654321 ...` 2곳 |

### Reference Edits

**apps/api/src/modules/auth/email/email.service.ts:73**
```diff
     const { data, error } = await this.resend!.emails.send({
       from: this.from,
       to,
-      subject: '[Grapit] 비밀번호 재설정',
+      subject: '[Grabit] 비밀번호 재설정',
       react: PasswordResetEmail({ resetLink }),
     });
```

**apps/api/src/modules/sms/sms.service.ts:115, 119, 203**
```diff
     // [WR-03] In production, reject alphanumeric sender IDs. ...
     // ... sender-ID typo like `INFOBIP_SENDER=Grapit` would
+    // ... sender-ID typo like `INFOBIP_SENDER=Grabit` would
     // permanently drain every user's 5/hour quota with zero delivery.
     // KISA-registered numeric senders (landline or pre-approved short codes)
-    // are typically 4-15 digits. If Grapit adds non-KR routes later, relax
+    // are typically 4-15 digits. If Grabit adds non-KR routes later, relax
...
     const otp = this.generateOtp();
-    const text = `[Grapit] 인증번호 ${otp} (3분 이내 입력)`;
+    const text = `[Grabit] 인증번호 ${otp} (3분 이내 입력)`;
```

**apps/api/src/modules/sms/sms.service.spec.ts:299, 316**
```diff
-    it('메시지 본문이 [Grapit] 인증번호 XXXXXX (3분 이내 입력) 포맷으로 전송됨', async () => {
+    it('메시지 본문이 [Grabit] 인증번호 XXXXXX (3분 이내 입력) 포맷으로 전송됨', async () => {
...
       expect(sendSmsSpy).toHaveBeenCalledWith(
         '+821012345678',
-        '[Grapit] 인증번호 654321 (3분 이내 입력)',
+        '[Grabit] 인증번호 654321 (3분 이내 입력)',
       );
```

### Verification
```bash
rg "\\[Grapit\\]" apps/api/ --count
# Expected: 0
pnpm --filter @grabit/api test -- sms.service.spec email.service.spec
# Expected: green
```

---

## Category 11: Legal / Marketing MD (P2, D-07 적용)

### Files
- `apps/web/content/legal/terms-of-service.md`
- `apps/web/content/legal/privacy-policy.md`
- `apps/web/content/legal/marketing-consent.md`

### Reference Edits (D-07: 이메일은 `@heygrabit.com`)

**apps/web/content/legal/terms-of-service.md:4, 73, 74**
```diff
 ## 제1조 (목적)
-본 약관은 Grapit(이하 "회사")이 제공하는 ...
+본 약관은 Grabit(이하 "회사")이 제공하는 ...
...
 ## 제15조 (연락처)
 본 약관에 관한 문의사항은 다음 연락처로 문의하시기 바랍니다.
-- 서비스명: Grapit
-- 이메일: support@grapit.com
+- 서비스명: Grabit
+- 이메일: support@heygrabit.com
```

**apps/web/content/legal/privacy-policy.md:3, 59, 69, 85, 86**
```diff
 # 개인정보처리방침

-Grapit(이하 "회사")은 「개인정보 보호법」 ...
+Grabit(이하 "회사")은 「개인정보 보호법」 ...
...
-정보주체는 본 국외이전에 대하여 ... 이전 거부 또는 상세 문의는 `privacy@grapit.com` 으로 요청해 주시기 바랍니다.
+정보주체는 본 국외이전에 대하여 ... 이전 거부 또는 상세 문의는 `privacy@heygrabit.com` 으로 요청해 주시기 바랍니다.
...
-위 권리 행사는 서비스 내 마이페이지에서 직접 하거나 `support@grapit.com` 으로 요청하실 수 있습니다.
+위 권리 행사는 서비스 내 마이페이지에서 직접 하거나 `support@heygrabit.com` 으로 요청하실 수 있습니다.
...
-- **개인정보 보호책임자**: Grapit 대표
-- **연락처**: `privacy@grapit.com`
+- **개인정보 보호책임자**: Grabit 대표
+- **연락처**: `privacy@heygrabit.com`
```

**apps/web/content/legal/marketing-consent.md:3**
```diff
-Grapit은 회원님께 유용한 공연·전시 정보와 ...
+Grabit은 회원님께 유용한 공연·전시 정보와 ...
```

### plan notes 삽입 필수 (P2)
> **사업자등록 + 실 mailbox 개설 시점까지:** 이메일 주소 `support@heygrabit.com` / `privacy@heygrabit.com` 는 MX 레코드 미설정 상태라 수신 불가. `support@heygrabit.com`으로 치환한 뒤 mailbox 개설 후 별도 follow-up (본 phase의 deferred 이슈로 등록).

### Verification
```bash
rg "Grapit|@grapit\.com" apps/web/content/legal/ --count
# Expected: 0
```

---

## Category 12: Documentation (P1, 선택 범위)

### Files
| File | Occurrences | Note |
|------|------------|------|
| `CLAUDE.md` | 5 (L4, L232, L237, L239, L251) | project name + 경로 예시 + pnpm filter |
| `AGENTS.md` | 5 | 확인 필요 — 마찬가지로 rename |
| `docs/03-ARCHITECTURE.md` | 8 | 아키텍처 문서 |
| `docs/06-KAKAO-OAUTH-SETUP.md` | 16 | OAuth 설정 가이드 |
| `docs/PLANNING-REVIEW.md` | 4 | 기획 리뷰 |
| `arch/06-VERCEL-RESEARCH.md` | 3 | 인프라 research |
| `arch/10-INFRA-DECISION-PROPOSAL.md` | 1 | 인프라 결정 |
| `arch/11-INFRA-RESEARCH-SUMMARY.md` | 1 | 인프라 요약 |

### Reference Pattern — CLAUDE.md:4, 232, 237, 239, 251

```diff
-**Grapit**
+**Grabit**
...
-- `.env` 파일은 **모노레포 루트** (`/grapit/.env`)에 위치한다. ...
+- `.env` 파일은 **모노레포 루트** (`/grapit/.env`)에 위치한다. ...   # ← D-03: 로컬 디렉토리 경로는 유지 (레포 path immutable)
...
-  DOTENV_CONFIG_PATH=../../.env pnpm --filter @grapit/api exec drizzle-kit migrate
+  DOTENV_CONFIG_PATH=../../.env pnpm --filter @grabit/api exec drizzle-kit migrate
-  DOTENV_CONFIG_PATH=../../.env pnpm --filter @grapit/api exec drizzle-kit generate
+  DOTENV_CONFIG_PATH=../../.env pnpm --filter @grabit/api exec drizzle-kit generate
...
-  run: pnpm --filter @grapit/api exec drizzle-kit migrate
+  run: pnpm --filter @grabit/api exec drizzle-kit migrate
```

> **주의 — CLAUDE.md L232:** `/grapit/.env` 경로 표현은 **로컬 레포 디렉토리**를 의미하는데 D-03에 따라 디렉토리 이름 변경은 out-of-scope. `@grapit/*` 스코프와 혼동 금지. 판단 기준: `@`가 없는 path segment이면 D-03 범위 → **유지**. `@grapit/api`처럼 scope prefix가 있으면 → **치환**.

### Bulk 명령 (docs 한정)
```bash
# @grapit/ → @grabit/ 만 치환 (디렉토리 path /grapit/는 제외)
git ls-files 'docs/*.md' 'arch/*.md' CLAUDE.md AGENTS.md \
  | xargs sed -i '' 's|@grapit/|@grabit/|g'

# "Grapit" (단어 경계) → "Grabit"
git ls-files 'docs/*.md' 'arch/*.md' CLAUDE.md AGENTS.md \
  | xargs sed -i '' 's/\bGrapit\b/Grabit/g'

# "grapit-" (하이픈 포함: service name) → "grabit-"
git ls-files 'docs/*.md' 'arch/*.md' CLAUDE.md AGENTS.md \
  | xargs sed -i '' 's/\bgrapit-/grabit-/g'
```

### Verification
```bash
rg "Grapit|@grapit/|grapit-(web|api|cloudrun|postgres|valkey|test)" docs/ arch/ CLAUDE.md AGENTS.md
# Expected: 0
# 단, `/grapit/.env` 같은 로컬 경로 언급(D-03)은 유지 — 확인 후 수동 판정
```

---

## Shared Patterns (cross-cutting)

### Pattern A: macOS sed의 `-i ''` quirk
모든 bulk rename에 공통 — BSD sed는 `-i` 뒤에 backup suffix 인자를 강제하므로 inline edit 시 `-i ''` 필수.
```bash
# macOS (grapit dev host):
sed -i '' 's|@grapit/|@grabit/|g' file.ts
# Linux (CI runner):
sed -i    's|@grapit/|@grabit/|g' file.ts
```

### Pattern B: git ls-files 안전 필터
`find . -type f` 는 `.planning`, `node_modules`, `dist`, `.next`를 포함해 탐욕적. 반드시 `git ls-files`를 기반으로 대상 목록을 만든다.
```bash
git ls-files '*.ts' '*.tsx' '*.md' '*.json' '*.yml' '*.yaml' '*.sh' '*.mjs' \
  | grep -v '^\.planning/' \
  | grep -v '^pnpm-lock\.yaml$' \
  | xargs rg -l "grapit"
```

### Pattern C: Verification script (SC-1 + SC-4 동시 검증)
```bash
#!/usr/bin/env bash
# scripts/audit-brand-rename.sh — plan P1~P4의 각 completion gate에서 실행
set -euo pipefail

echo "=== SC-4: .planning/milestones/ 변경 금지 ==="
CHANGED=$(git diff --name-only main...HEAD -- '.planning/milestones/' | wc -l)
if [ "$CHANGED" -gt 0 ]; then echo "FAIL: milestones touched"; exit 1; fi

echo "=== SC-4: 완료된 phase 폴더 변경 금지 ==="
CHANGED=$(git diff --name-only main...HEAD -- \
  '.planning/phases/0[1-9]*' \
  '.planning/phases/1[012]*' \
  '.planning/phases/09.1*' \
  '.planning/phases/10.1*' \
  '.planning/quick/' \
  | wc -l)
if [ "$CHANGED" -gt 0 ]; then echo "FAIL: completed phases touched"; exit 1; fi

echo "=== SC-1: grapit 잔여 (허용 예외 제외) ==="
REMAINING=$(rg -l "grapit" \
  --glob '!.planning/**' \
  --glob '!.playwright-mcp/**' \
  --glob '!node_modules/**' \
  --glob '!**/node_modules/**' \
  --glob '!apps/*/dist/**' \
  --glob '!apps/*/.next/**' \
  --glob '!packages/*/dist/**' \
  --glob '!pnpm-lock.yaml' \
  --glob '!.claude/**' \
  | wc -l)

echo "Files with 'grapit' remaining: $REMAINING"
# 다음 예외 파일들은 내용에 grapit을 가진 채 PASS:
#  - docker-compose.yml (grapit_dev password, D-01)
#  - .github/workflows/deploy.yml (grapit-cloudrun@ SA 2건, D-05)
#  - scripts/provision-valkey.sh (grapit-cloudrun@ 주석 예시, D-05)
#  - CLAUDE.md L232 (/grapit/.env 로컬 경로, D-03)
```

### Pattern D: pnpm-lock.yaml 재생성 타이밍
1. manifest 4개 전부 변경 + import 전부 변경 후
2. `pnpm install` (lockfile 변경됨)
3. 같은 PR에 lockfile도 포함 → commit
4. CI의 `pnpm install --frozen-lockfile` 통과 확인

**절대 안 되는 것:** 코드 rename과 lockfile을 다른 PR로 분리.

---

## Known Exceptions (DO NOT TOUCH)

| # | String / Path | File / Location | Reason (Decision ref) |
|---|----------------|-----------------|------------------------|
| E1 | `grapit_dev` (password) | `docker-compose.yml:10` | **D-01** — prod DB rename 제외 원칙 |
| E2 | `grapit-cloudrun@...` (SA) | `.github/workflows/deploy.yml:81, 168` | **D-05** — IAM 바인딩 14~16개 재생성 리스크 |
| E3 | `grapit-cloudrun@...` (SA 주석) | `scripts/provision-valkey.sh:26, 86` | **D-05** |
| E4 | `grapit-valkey` (실제 GCP 인스턴스) | Memorystore instance 자체 | Provisioned immutable, 재생성 = 데이터 유실 |
| E5 | `grapit_prod` (prod DB) | Cloud SQL 실 식별자 | **D-01** |
| E6 | `/icons/grapit` (로컬 레포 경로) | 개발자 filesystem, CLAUDE.md L232 | **D-03** — deferred |
| E7 | `.planning/milestones/**` | 모든 파일 | **SC-4** — 과거 milestone 기록 |
| E8 | `.planning/phases/0[1-9]-*`, `1[012]-*`, `09.1-*`, `10.1-*` | 완료된 phase 폴더 | **SC-4** |
| E9 | `.planning/quick/**` | 완료된 quick phase 기록 | **SC-4** |
| E10 | `.playwright-mcp/page-*.yml` | 자동 재생성 파일 | **SC-4** — CONTEXT 확인 |
| E11 | `.claude/**` | personal Claude config | out-of-scope |
| E12 | `node_modules/**`, `apps/*/dist/**`, `.next/**` | build artifacts | 재빌드 시 자동 갱신 |
| E13 | `pnpm-lock.yaml` 의 `@grapit/*` 참조 (L29, L207) | lockfile | **수동 편집 금지** — `pnpm install`로 재생성만 |
| E14 | git commit/tag history 내 `grapit` | `git log`, `.git/` | natural preservation, D-04 섹션 |
| E15 | `grapit-postgres` 개발자 로컬 docker 컨테이너 | 각 dev의 `docker ps` | in-place replace via `docker compose down -v && up -d` |

### Exception Defense in ripgrep/sed

```bash
# grapit 잔여를 찾되 E1, E2/E3, E6, E7~E13을 예외 처리
rg "grapit" \
  --glob '!.planning/**' \
  --glob '!.playwright-mcp/**' \
  --glob '!node_modules/**' \
  --glob '!**/node_modules/**' \
  --glob '!apps/*/dist/**' \
  --glob '!apps/*/.next/**' \
  --glob '!packages/*/dist/**' \
  --glob '!pnpm-lock.yaml' \
  --glob '!.claude/**' \
  | grep -v 'docker-compose\.yml.*grapit_dev' \
  | grep -v 'grapit-cloudrun@' \
  | grep -v '/grapit/\.env'
# Expected (after plans P1~P2 complete): 0
```

---

## Case Sensitivity Cheat Sheet (planner 인용용)

| Pattern | Applies to | Command |
|---------|-----------|---------|
| `@grapit/` → `@grabit/` | package scope (92 imports + manifest + Dockerfile + workflow + vitest alias + tsconfig) | `sed -i '' 's|@grapit/|@grabit/|g'` |
| `grapit-web`, `grapit-api`, `grapit-valkey`, `grapit-postgres`, `grapit-valkey-policy` | service/instance/container 이름 | `sed -i '' -E 's/grapit-(web\|api\|valkey\|postgres\|valkey-policy)/grabit-\1/g'` |
| `grapit_test` | CI DB name (ci.yml 2곳) | `sed -i '' 's/grapit_test/grabit_test/g' .github/workflows/ci.yml` |
| `admin@grapit.test`, `no-reply@grapit.com`, `@e2e.grapit.dev`, `@social.grapit.com` | seed/fixture/social fallback | 파일별 수동 (§Category 8) |
| `[Grapit]` | email subject / SMS body | 각 2파일 수동 (§Category 10) |
| `Grapit` (단어 경계) | UI copy + legal MD + docs | `sed -i '' 's/\bGrapit\b/Grabit/g'` |
| `support@grapit.com`, `privacy@grapit.com` | legal MD | `sed -i '' -E 's/(support\|privacy)@grapit\.com/\1@heygrabit.com/g'` |
| `AR_REPO: grapit` | deploy.yml | `sed -i '' 's/AR_REPO: grapit$/AR_REPO: grabit/' .github/workflows/deploy.yml` |
| `grapit-cloudrun@` | deploy.yml + provision-valkey.sh | **NOT CHANGED** (D-05 예외) |
| `grapit_dev` | docker-compose password | **NOT CHANGED** (D-01 예외) |
| `/grapit/` (filesystem path) | CLAUDE.md L232 | **NOT CHANGED** (D-03 예외) |

---

## Category-to-Plan Mapping (planner가 바로 plan 배정에 사용)

| Category | Applicable Plan | Notes |
|----------|-----------------|-------|
| 1. Package manifests | **P1** | topo order 필수, lockfile 재생성 |
| 2. Workspace/build config | **P1** | next.config/tsconfig/vitest |
| 3. Dockerfiles | **P1** | 로컬 docker build smoke 권장 |
| 4. docker-compose.yml | **P1** (D-06) | dev 로컬 영향, D-01 password 유지 |
| 5a. ci.yml | **P1** (D-06) | `grapit_test` → `grabit_test` |
| 5b. deploy.yml | **P3** | AR_REPO/WEB_SERVICE/API_SERVICE + P3 머지 시점 첫 deploy로 새 Cloud Run 자동 생성 |
| 6. Application code import | **P1** | 92 파일, bulk sed + `pnpm typecheck` |
| 7. scripts/provision-valkey.sh | **P1** | 변수만 rename, 재실행 금지 주석 |
| 8. Seed/fixture/test email | **P1** | TEST_USER_EMAIL GitHub secret 동반 갱신 |
| 9. UI copy | **P2** | Grapit → Grabit |
| 10. Email subject / SMS body | **P2** | spec 동반 갱신 |
| 11. Legal / marketing MD | **P2** (D-07) | `@heygrabit.com` 이메일, mailbox 개설은 deferred |
| 12. Docs (CLAUDE, AGENTS, docs, arch) | **P1** | D-03: `/grapit/` 경로 유지 |
| (infra) 새 Cloud Run / Sentry / AR repo | **P3** | gcloud CLI + Sentry dashboard manual |
| (cutover) domain-mapping swap + 7일 후 정리 | **P4** | HUMAN-UAT + 별도 commit |

---

## Metadata

**Analog search scope:** 실제 `grapit` 출현 파일 전수 (git ls-files 기준 92 code + 4 manifest + 6 config + 2 workflow + 2 Dockerfile + 1 script + 5 seed/fixture + 3 legal + 5 UI + 2 email/sms + 1 compose + 약 7 docs).
**Reference resolution:** 각 카테고리의 대표 파일을 직접 Read로 확인. 라인 번호는 2026-04-22 기준 main HEAD.
**Pattern extraction date:** 2026-04-22.

## PATTERN MAPPING COMPLETE
