---
id: SEED-002
status: dormant
planted: 2026-04-21
planted_during: v1.1 / Phase 12 (UX)
trigger_when: Phase 12 (UX)가 verified/완료된 직후, 또는 다음 milestone 시작 시
scope: Medium
---

# SEED-002: 브랜드명 grapit → grabit 일괄 rename phase

## Why This Matters

회사가 도메인을 `heygrabit.com`으로 최종 확정함. 기존 프로젝트명 `grapit`의 'p'는 오타였음.
'p' vs 'b' 한 글자 차이는 사용자 혼란 / SEO / 타이핑 오류 측면에서 장기 비용이 큼.

런칭 전이 변경 비용이 가장 싼 시점이지만, **phase 12 (UX) 진행 중에 섞으면 PR diff가 폭발하고
디자인 토큰 변경과 rename이 한 PR에 섞여 리뷰/롤백 어려움**. 따라서 phase 12 완료 후 별도 phase로
일괄 처리하는 것으로 결정 (2026-04-21).

## When to Surface

**Trigger:** Phase 12 (UX) verified/완료 직후

`/gsd-new-milestone` 또는 `/gsd-add-phase` 시 다음 조건에 매치되면 surface:
- Phase 12 status가 verified/shipped로 전환된 직후
- v1.1 milestone wrap-up 또는 v1.2 milestone 시작 시
- 런칭 직전 polish phase 검토 시

## Scope Estimate

**Medium** — 단일 phase 내 처리 가능하나 plan 분할 필수.

예상 plan 분할:
1. **신규 코드/문서/설정 rename**: `package.json`, `pnpm-workspace.yaml`, `@grapit/*` import, `docker-compose.yml`, `Dockerfile`, `.github/workflows/*`, `CLAUDE.md`, `AGENTS.md`, `docs/`
2. **사용자 노출 문자열 정정**: 이메일 템플릿(`apps/api/src/modules/auth/email/`), SMS 발신자명, `<title>`, 메타태그, UI 카피 (`apps/web/`)
3. **DB 마이그레이션**: dev/staging은 자유롭게, **prod DB는 신중히** (rename 마이그레이션 또는 새 DB로 데이터 이관)
4. **인프라 식별자 변경**: GCP Cloud Run 서비스명 (`grapit-web` → `grabit-web`, `grapit-api` → `grabit-api`), Artifact Registry 이미지명, Secret Manager 키 prefix
5. **레포 디렉토리 rename** (선택): `/icons/grapit` → `/icons/grabit` (로컬 작업 path 변경 영향)

## Out of Scope (건드리지 않음)

- `.planning/quick/*` (완료된 quick phase 기록)
- `.planning/phases/0X-*`, `09.1-*`, `10.1-*`, `11-*` 등 완료된 phase 폴더
- `.planning/milestones/v1.0-phases/*` (완료된 milestone)
- `.playwright-mcp/page-*.yml` (자동 재생성)
- 과거 commit message
- 이유: historical record는 시점 기록이라 rewrite 가치 없음. "왜 이름이 다르지?"는 rename phase의 commit으로 설명됨.

## Breadcrumbs

스캔 결과 (2026-04-21 기준): **1,582 occurrence / 250 파일**.

핵심 변경 대상 (production-affecting):
- 루트 `package.json`, `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`
- `pnpm-workspace.yaml`, `pnpm-lock.yaml` (재생성 필요)
- `docker-compose.yml`, `apps/api/Dockerfile`
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `apps/api/src/modules/auth/email/email.service.ts` + 템플릿 (`password-reset.tsx` 등)
- `apps/api/src/modules/sms/sms.service.ts` (발신자명)
- `apps/api/src/database/seed.mjs` (시드 데이터의 브랜드명)
- `apps/web/next.config.ts`, `apps/web/lib/auth.ts`
- `scripts/provision-valkey.sh`
- `arch/*`, `docs/*`, `CLAUDE.md`, `AGENTS.md`

진행 중 문서 (phase 12)는 일괄 rename 시점에 함께 처리:
- `.planning/phases/12-ux/*`

관련 메모리: `~/.claude/projects/-Users-sangwopark19-icons-grapit/memory/project_brand_rename.md`

## Notes

- 도메인은 `heygrabit.com` (확정), `hey` prefix 포함
- 1인 개발 프로젝트이므로 한 번에 PR 하나로 처리 가능 (대규모 팀 조율 불필요)
- DB rename은 `pg_dump` + restore 또는 `ALTER DATABASE ... RENAME TO`. prod 다운타임 최소화 필요시 maintenance window 잡기
- Cloud Run 서비스명 변경 = 새 서비스 생성 → DNS/Load Balancer 전환 → 구 서비스 정리 순서 (블루-그린)
- 환경변수 prefix (`GRAPIT_*` → `GRABIT_*`) 있다면 함께 정정. 현재 `.env`에 prefix 사용 안 하는 것으로 보임
