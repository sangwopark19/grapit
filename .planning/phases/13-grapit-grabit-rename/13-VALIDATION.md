---
phase: 13
slug: grapit-grabit-rename
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase는 rename 성격이라 "정상 동작 증명"이 주된 검증. 신규 비즈니스 로직 테스트는 추가하지 않되 rename 잔여물 0건 / 빌드·타입체크 통과 / 런타임 정합성을 자동 검증한다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (이미 installed — Phase 05 도입) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm -r --filter @grabit/api --filter @grabit/web test --run` (rename 후 이름 기준) |
| **Full suite command** | `pnpm -r test && pnpm -r typecheck && pnpm -r lint && pnpm -r build` |
| **Estimated runtime** | ~90s (test+typecheck+lint) + ~60s (build) = ~150s |

**Rename-specific verification commands (this phase의 핵심):**

| Check | Command | Expected |
|-------|---------|----------|
| grapit 잔여물 (코드/설정/문서) | `rg -n -i "grapit" --glob '!.planning/**' --glob '!.playwright-mcp/**' --glob '!pnpm-lock.yaml' --glob '!node_modules/**'` | 0 matches (예외: legal email 주소는 Open Question Q3 해소 후 결정) |
| grapit 잔여물 (사용자 노출 카피) | `rg -n "grapit\|Grapit\|GRAPIT" apps/api/src/modules/auth/email apps/api/src/modules/sms apps/web/app apps/web/components apps/web/lib` | 0 matches |
| historical 보존 (SC-4) | `git diff --name-only main...HEAD -- .planning/milestones/ .planning/phases/0* .planning/phases/09.1-* .planning/phases/10.1-* .planning/phases/11-* .planning/phases/12-* .planning/quick/` | empty output |
| npm scope 일관성 | `rg -n "@grapit/" --glob '!.planning/**' --glob '!pnpm-lock.yaml'` | 0 matches |

---

## Sampling Rate

- **After every task commit:** Quick rename-grep (`rg -n "grapit"` scoped to touched files)
- **After every plan wave:** Full suite — `pnpm -r test && pnpm -r typecheck && pnpm -r lint && pnpm -r build`
- **Before `/gsd-verify-work`:** Full suite green + historical 보존 diff empty + 신규 Cloud Run 서비스 health check 200
- **Max feedback latency:** 150s (local), +이메일/SMS 실제 발송 테스트는 HUMAN-UAT 범주

---

## Per-Task Verification Map

> Plan이 생성되기 전이므로 task ID는 placeholder (planner가 plan 작성 시 고유 ID 부여). 본 표는 각 plan이 다뤄야 할 **verification 축**을 고정한다.

| Scope | Plan | Wave | Success Criterion | Test Type | Automated Command | Notes |
|-------|------|------|-------------------|-----------|-------------------|-------|
| npm scope rename 완료 | P1 (코드/설정) | 1 | SC-1 | static grep | `rg -n "@grapit/" --glob '!.planning/**' --glob '!pnpm-lock.yaml'` → 0 matches | lockfile 재생성 필수 |
| package.json name 필드 | P1 | 1 | SC-1 | static grep | `jq -r '.name' package.json apps/*/package.json packages/*/package.json \| grep -c grapit` → 0 | all packages |
| tsconfig paths 갱신 | P1 | 1 | SC-1 | typecheck | `pnpm -r typecheck` → exit 0 | |
| pnpm-lock.yaml drift 없음 | P1 | 1 | SC-1 | lockfile integrity | `pnpm install --frozen-lockfile` → exit 0 | CI와 동일 커맨드 |
| workspace protocol 정합성 | P1 | 1 | SC-1 | static grep | `rg -n "workspace:" \| grep -c grapit` → 0 | |
| Dockerfile / docker-compose.yml rename | P1 | 1 | SC-1 | static grep | `rg -n "grapit" Dockerfile docker-compose.yml` → **D-01 예외만** (POSTGRES_PASSWORD=grapit_dev 1건) | D-01 decision respect |
| turbo.json pipeline | P1 | 1 | SC-1 | build | `pnpm turbo build` → exit 0 | |
| GitHub Actions workflow rename | P1 | 1 | SC-1 | static grep + lint | `rg -n "grapit" .github/workflows/` → allowed (old service name in comments only 안 됨, 새 name으로 완전 치환) + `actionlint .github/workflows/*.yml` exit 0 | `WEB_SERVICE`/`API_SERVICE` 값 갱신 |
| 빌드 / 타입체크 / 린트 (SC-1) | P1 | 1 | SC-1 | build+typecheck+lint | `pnpm -r build && pnpm -r typecheck && pnpm -r lint` | 모든 package 통과 |
| UI title / meta / OG | P2 (사용자 노출) | 2 | SC-2 | static grep | `rg -n "Grapit\|grapit" apps/web/app apps/web/components` → 0 | next.config.ts / page metadata |
| Email template (HTML + subject) | P2 | 2 | SC-2 | static grep + snapshot | `rg -n "Grapit\|grapit" apps/api/src/modules/auth/email` → 0 + 기존 vitest snapshot 재생성 후 diff 확인 | password-reset email 등 |
| SMS 발신자 / 본문 | P2 | 2 | SC-2 | static grep | `rg -n "Grapit\|grapit" apps/api/src/modules/sms` → 0 + `sms.service.ts` unit test green | |
| seed.mjs 브랜드 문자열 | P2 | 2 | SC-2 | static grep | `rg -n "grapit\|Grapit" apps/api/src/database/seed.mjs` → 0 | admin user name / email은 Q4 해소 후 |
| legal MD / ToS / 개인정보처리방침 | P2 | 2 | SC-2 | static grep | `rg -n "grapit\|Grapit" apps/web/app/legal/ docs/legal/` → 0 (이메일 주소는 Q3 확인 후) | support@ 등 |
| Cloud Run service 생성 완료 | P3 (인프라) | 3 | SC-3 | CLI probe | `gcloud run services describe grabit-web --region asia-northeast3 --format='value(status.url)'` → non-empty URL | HUMAN-AUTH 필요 |
| Sentry 새 프로젝트 DSN 교체 | P3 | 3 | SC-3 | Secret Manager | `gcloud secrets versions access latest --secret=SENTRY_DSN_WEB \| grep -c grabit` → 1 | new DSN 주입 확인 |
| Artifact Registry 신규 repo | P3 | 3 | SC-3 | CLI probe | `gcloud artifacts repositories describe grabit --location asia-northeast3` → exit 0 | 이미지 push 가능 상태 |
| deploy.yml `WEB_SERVICE`/`API_SERVICE` | P3 | 3 | SC-3 | static grep | `grep -E "WEB_SERVICE\|API_SERVICE" .github/workflows/deploy.yml \| grep -c grabit` → 2 | |
| 도메인 매핑 switchover | P4 (cutover) | 4 | SC-3 | HTTPS probe | `curl -sI https://heygrabit.com/ \| head -1 \| grep -E 'HTTP/2 200\|HTTP/1.1 200'` | SSL 재발급 대기 포함 |
| 새 서비스 health check | P4 | 4 | SC-3 | HTTPS probe | `curl -fsS https://api.heygrabit.com/health \| jq -e '.status == "ok"'` exit 0 | |
| 블루-그린 롤백 스크립트 준비 | P4 | 4 | SC-3 | file exists | `test -f scripts/rollback-cutover.sh && head -1 scripts/rollback-cutover.sh \| grep -q '#!'` | describe 사전 캡처 포함 |
| 7일 유예 후 구 서비스 삭제 | P4 | 4 | SC-3 | CLI probe | `gcloud run services describe grapit-web --region asia-northeast3 2>&1 \| grep -c "NOT_FOUND"` → 1 (7일 후 실행) | checklist item, deferred verify |
| historical 보존 (SC-4) | P1~P4 전부 | all | SC-4 | git diff | `git diff --name-only main...HEAD -- .planning/milestones/ .planning/phases/0* .planning/phases/09.1-* .planning/phases/10.1-* .planning/phases/11-* .planning/phases/12-* .planning/quick/` → empty | 모든 plan의 acceptance에 포함 |
| 브랜드 잔여물 전역 (SC-2/SC-4 합성) | P1~P2 최종 | 2 | SC-2 | static grep | `rg -n -i "grapit" --glob '!.planning/**' --glob '!.playwright-mcp/**' --glob '!pnpm-lock.yaml' --glob '!node_modules/**' --glob '!docker-compose.yml' \| wc -l` → 0 (D-01 예외 파일만 제외) | 최종 wave 전에 실행 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 기존 vitest/typecheck/lint 인프라 활용 — **신규 프레임워크 설치 불필요**
- [ ] `scripts/rollback-cutover.sh` (P4에서 생성) — 도메인 매핑 원복 절차 기록, `#!/usr/bin/env bash` shebang + `set -euo pipefail`
- [ ] `.github/workflows/` actionlint 로컬 실행 가능 여부 확인 (없으면 P1에서 `actionlint` 설치 스텝 포함)
- [ ] Email/SMS snapshot test 갱신 전략: snapshot 업데이트 후 사람 검토 커밋

*Existing infrastructure (vitest / typecheck / lint / build)는 모든 SC-1/SC-2 검증을 커버한다. Rename 전용 커맨드는 shell 단발 실행으로 충분.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실제 이메일 발송 시 Grabit 표시 | SC-2 | SMTP 전송 및 수신 mailbox 확인 필요 | P2 완료 후 stage 환경에서 `/auth/password-reset` 요청 → 수신 이메일 본문/발신자/subject 모두 Grabit 표기 |
| 실제 SMS 발송 시 Grabit 발신자명 | SC-2 | Infobip 발신자명 등록·승인 절차 외부 의존 | P2 완료 후 stage 환경에서 SMS 인증 트리거 → 수신 단말 발신자 Grabit |
| heygrabit.com 도메인 전환 | SC-3 | DNS propagation + Google-managed SSL 재발급 대기 | P4 cutover 직후 5분/30분/24h 구간에서 `curl -I https://heygrabit.com/` 수행 — 최종 200 OK |
| OAuth 콜백 정상 (카카오/네이버/구글) | SC-3 | 외부 개발자 콘솔에서 redirect URI 등록 필요 | heygrabit.com 연결 후 소셜 로그인 3종 → 성공 콜백 확인 |
| 구 Cloud Run 서비스 7일 후 삭제 | SC-3 | 7일 유예 deferred 검증 | 2026-04-29 이후 `gcloud run services list --region asia-northeast3 \| grep grapit-` → empty |
| Sentry 이벤트 수집 | SC-3 | 실제 에러 이벤트 발생 유도 | stage에서 의도된 error 트리거 → Sentry 새 프로젝트(grabit-web/grabit-api)에만 이벤트 도착 확인 |

---

## Validation Sign-Off

- [ ] 모든 rename surface가 위 Per-Task Verification Map의 grep 커맨드로 검증 가능
- [ ] Sampling continuity: 각 plan 최종 wave에서 Full suite 실행 — 3 consecutive task without automated verify 없음
- [ ] Wave 0: `scripts/rollback-cutover.sh` (P4), actionlint (P1) 이외 신규 infra 불필요
- [ ] No watch-mode flags — 전부 `--run` / CLI 단발
- [ ] Feedback latency < 150s (로컬), HUMAN-UAT는 별도 timeline
- [ ] `nyquist_compliant: true` 는 plan-checker 통과 후 orchestrator가 갱신

**Approval:** pending
