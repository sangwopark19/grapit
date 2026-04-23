# Phase 13: 브랜드명 grapit → grabit 일괄 rename - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 13-grapit-grabit-rename
**Areas discussed:** prod DB rename 범위, Cloud Run 블루-그린 전환, 레포 디렉토리 rename, Plan 분할 단위

---

## prod DB rename 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 앱 레벨만 rename (추천) | DB 이름(`grapit_prod`)·ROLE·DATABASE_URL 식별자는 그대로 유지. 코드·환경변수 이름·로그 메시지만 grabit. 다운타임 0, 롤백 간단. 외부에서 DB 이름 보는 사람 없음. | ✓ |
| 새 DB 복제 후 전환 | `grabit_prod` 새 DB + pg_dump/restore + 도메인 전환. 다운타임 발생 가능. 런칭 전이라 트래픽 적지만 SQL 연결 문제 리스크. | |
| ALTER DATABASE RENAME | in-place rename. 연결 풀 재시작 필요 · 짧은 다운타임. 롤백 시 동일 명령 역방향. 로그·관계소 복잡도 중간. | |

**User's choice:** 앱 레벨만 rename
**Notes:** 1인 개발 · 런칭 전 복구성 확보 관점에서 가장 안전. D-01로 기록.

---

## Cloud Run 블루-그린 전환

### 전환 전략

| Option | Description | Selected |
|--------|-------------|----------|
| 새 서비스 생성 후 도메인 컷오버 (추천) | `grabit-web`/`grabit-api` 새로 배포 → `heygrabit.com` 도메인을 새 서비스에 mapping. Sentry·Artifact Registry·이미지명도 같이 정리. 구 서비스는 N일 유예 후 정리. 롤백 간단. | ✓ |
| 기존 서비스 유지 | Cloud Run 서비스명은 내부 식별자라 그대로 두고 코드·문서·Sentry만 rename. 운영 변화 0, 가장 단순. | |
| 서비스는 유지, Sentry·이미지만 rename | Cloud Run 서비스명은 그대로, 외부 식별 지표(Sentry 프로젝트, Artifact Registry 이미지명)는 grabit으로. 중간 타협. | |

**User's choice:** 새 서비스 생성 후 도메인 컷오버
**Notes:** Cloud Run service name은 immutable이므로 블루-그린이 유일한 깔끔 경로. D-02로 기록.

### 구 서비스 유예 기간

| Option | Description | Selected |
|--------|-------------|----------|
| 7일 (임시) | 도메인 전환 후 7일간 구 서비스 유지. DNS propagation · CDN TTL 해소 · Sentry 히스토리 확인 시간 확보. | ✓ |
| 즉시 정리 | 새 서비스에 트래픽 전환 확인 즉시 구 삭제. 비용 줄이고 결정적. | |
| plan-phase에서 결정 | 세부는 PR 예정 잡을 때 결정. 지금은 "구 서비스 정리 단계 포함"만 고정. | |

**User's choice:** 7일 (임시)
**Notes:** D-02b로 기록.

---

## 레포 디렉토리 rename

| Option | Description | Selected |
|--------|-------------|----------|
| 포함 안 함 (추천) | 레포 디렉토리는 개인 작업 path라 프로젝트 범위 아님. .claude/worktrees · CLAUDE · GSD 문서에 하드코딩된 경로 없음(확인됨). GitHub 원격 레포명도 별개. | ✓ |
| 같이 rename | 레포 디렉토리까지 같이 바꿔 완전하게 통일. git mv 후 로컬 작업 path 정리 필요. worktree 매핑·IDE 설정·셸 쪽 히스토리 영향 있음. | |

**User's choice:** 포함 안 함
**Notes:** D-03으로 기록.

---

## Plan 분할 단위

| Option | Description | Selected |
|--------|-------------|----------|
| 4개 plan (추천) | P1: 코드/설정/패키지/스크립트 rename — P2: 사용자 노출 카피 — P3: 인프라 식별자 생성 — P4: 도메인 cutover + 7일 후 구 서비스 정리 + HUMAN-UAT | ✓ |
| 3개 plan | P1: 코드+카피 통합 — P2: 인프라 식별자 생성 — P3: cutover+정리. 더 간단하지만 PR diff가 커져 리뷰 부담. | |
| 5개 plan (SEED-002 초안 일부 유지) | P1: 코드/설정 — P2: 사용자 노출 카피 — P3: 로그/메트릭 (DB rename 대신) — P4: 새 Cloud Run 서비스·Sentry 프로젝트 생성 — P5: cutover+정리. 세분화되지만 오버헤드 가능. | |

**User's choice:** 4개 plan
**Notes:** D-04로 기록. P1/P2는 코드 rename이라 PR 리뷰·롤백 단위로 깔끔, P3는 GCP/Sentry manual step 섞여 독립, P4는 배포 cutover라 HUMAN-UAT 별도.

---

## Claude's Discretion

- Plan 내부 작업 단위, 커밋 단위, 파일별 순서 등 구현 세부사항 — planner 판단.
- 환경변수 이름 prefix 정사 — 현재 `GRAPIT_*` 사용 사례 없음 확인. 발견 시 `GRABIT_*`로 정사.
- 문서 rename 깊이 — 완료된 milestone record는 그대로 둔다는 기준선 내에서 판단.

## Deferred Ideas

- prod DB 이름·ROLE·DATABASE_URL 자체의 rename (D-01로 제외) — 대규모 DB 재설계 시점에 재검토.
- 로컬 레포 디렉토리 rename (D-03으로 제외).
- GitHub 원격 레포명 변경 — 이번 phase에서 결정하지 않음.

---

# Partial Session #2 — 2026-04-22 (post-codex REVIEWS)

**Trigger:** `/gsd-discuss-phase 13 --partial` after `/gsd-review --phase 13 --all` produced REVIEWS.md (codex only; cursor auth failed, claude skipped as running host).
**Reviewers surfacing concerns:** codex (gpt-5.4) — HIGH 3 / MEDIUM 6 / LOW 2.
**Areas discussed:** API 도메인 라우팅 전략, P1 rename inventory 완전성, Plan 13-03/04 운영 안전장치, Plan 13-02 잔여 이슈.

---

## API 도메인 라우팅 전략 (HIGH)

**Context:** 코드베이스 검증으로 현재 prod는 browser → `CLOUD_RUN_API_URL` (.run.app 직접) 구조이고 `next.config.ts` rewrite는 dev-only 확인. Plan 13-04의 `heygrabit.com/api/v1/health 200` acceptance 및 OAuth provider 등록 URL이 현 구조와 맞지 않음.

| Option | Description | Selected |
|--------|-------------|----------|
| api.heygrabit.com 서브도메인 (추천) | grabit-api Cloud Run 에 별도 domain-mapping. OAuth callback = https://api.heygrabit.com/api/v1/auth/social/{provider}/callback (stable). CLOUD_RUN_API_URL=https://api.heygrabit.com. SSL 발급 시간 추가되나 OAuth 1회 등록으로 종결. | ✓ |
| .run.app 방식 유지 | API는 grabit-api-YYY.run.app 직접 호출. Plan 13-04 heygrabit.com/api 검증 삭제. OAuth callback은 새 .run.app URL. 추가 리소스 0 이지만 서비스 재생성마다 OAuth 재등록. | |
| Next.js rewrite 프록시 (grabit-web이 grabit-api로 더블홉) | prod에서 rewrites destination을 grabit-api .run.app으로 분기. 레이턴시↑/비용↑/Socket.IO 호환성 이슈. | |

**User's choice:** api.heygrabit.com 서브도메인
**Notes:** D-09로 기록. Plan 13-03에 DNS 레코드 설정 + gcloud domain-mapping create 추가 필요. Plan 13-04 acceptance 수정. Plan 13-04 OAuth provider 등록 URL은 api.heygrabit.com 기반.

---

## P1 rename inventory 완전성 (HIGH)

**Context:** codex가 현재 Plan 13-01이 @grapit/ bulk rename만 수행함을 지적. `apps/api/test/admin-dashboard.integration.spec.ts` (grapit_test), `apps/api/src/modules/admin/upload.service.spec.ts` (grapit-uploads, cdn.grapit.kr), `apps/api/src/modules/auth/email/templates/password-reset.tsx` (Grapit comment), `apps/web/e2e/admin-dashboard.spec.ts` (admin@grapit.test) 누락 확인.

| Option | Description | Selected |
|--------|-------------|----------|
| Full inventory 동적 생성 + allowlist (추천) | STEP 0: rg -l 'grapit\|Grapit\|@grapit/\|@grapit\.' > /tmp/grapit-inventory.txt. Task 2/3 이 inventory 기반 동작. audit-brand-rename.sh allowlist line-level (grapit_dev, /grapit/.env, grapit-cloudrun@, @social.grabit.com). 새 파일 추가돼도 자동 포착. | ✓ |
| files_modified 확장 + 패턴 확장 | 명시적 파일 4개 추가 + \bGrapit\b/grapit_test/grapit-uploads/cdn.grapit.kr 패턴 추가. 단순하지만 향후 드리프트 시 재누락. | |
| 기존 Plan 유지 + audit script 수동 재시도 | 잡히면 Executor가 수동 추가. PR 조각분할 위험. | |

**User's choice:** Full inventory 동적 생성 + allowlist
**Notes:** D-10으로 기록. Plan 13-01 Task 1 STEP 0 추가. audit-brand-rename.sh 재작성.

---

## Plan 13-03/04 운영 안전장치 (MEDIUM)

**multiSelect question — 4개 서브 옵션 중 채택할 항목**

| Option | Description | Selected |
|--------|-------------|----------|
| AR IAM 바인딩 검증 | Plan 13-03 Task 1 HUMAN-AUTH 체크리스트에 gcloud projects get-iam-policy로 deploy principal artifactregistry.writer + Cloud Run pull principal artifactregistry.reader 확인. 미바인딩 시 수동 추가. | ✓ |
| Sentry 이벤트 검증 강화 | admin-only test endpoint (GET /admin/_sentry-test)에서 captureException 호출 → event ID 반환. Task 4 acceptance에 API/UI 조회 확인 포함. | ✓ |
| GitHub vars 갱신 후 재배포 강제 | Plan 13-03 Task 4 acceptance에 "workflow_dispatch 재배포 + gcloud run services describe로 revision env/build arg 반영 검증" step 추가. | ✓ |
| cleanup 스크립트 7-day hard gate | scripts/cleanup-old-grapit-resources.sh에 --confirm-after-date YYYY-MM-DD 필수 argument + domain mapping routeName=grabit-web 확인 + 구 서비스 최근 24h 요청 0건 자동 확인. | ✓ |

**User's choice:** 모두 채택 (AR IAM + Sentry 검증 + 재배포 강제 + cleanup gate)
**Notes:** D-11/D-12/D-13/D-14로 기록. 1인 운영 환경 안전장치로 전부 도입.

---

## Plan 13-02 잔여 이슈 (MEDIUM/LOW)

### legal MD HTML 주석 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 제거 (codex 추천) | legal/법무 문서에 내부 TODO 섞지 않음. deferred mailbox 항목은 13-04-SUMMARY.md / PROJECT.md Concerns로 이관. MDX renderer 전환 등 노출 위험 제거. | ✓ |
| 유지 (현 상태) | HTML 주석은 현 Next.js markdown renderer에서 비노출. 편의성 우선. | |

**User's choice:** 제거
**Notes:** D-15로 기록. Plan 13-02 Task 3 STEP 4 삭제. 13-04-SUMMARY.md + PROJECT.md로 이관.

### SMS spec INFOBIP_SENDER='Grapit' fixture

| Option | Description | Selected |
|--------|-------------|----------|
| 'Grabit' 단순 치환 (현 plan 동작) | 'Grabit'도 alphanumeric 이라 KISA 거부 반례로 동일 유효. allowlist 불필요. 단순. | ✓ |
| line-level allowlist로 'Grapit' 유지 | "원래 구 브랜드명이 alphanumeric 예시로 고정"이라는 의도 문서화. 역사적 의미 보존. | |

**User's choice:** 'Grabit' 단순 치환
**Notes:** D-17로 기록.

### `rg -c ... | wc -l` 패턴 semantics

| Option | Description | Selected |
|--------|-------------|----------|
| `\|\| echo 0` 패턴으로 fix (추천) | rg -c 'pattern' file 2>/dev/null \|\| echo 0 형태로 교체. set -euo pipefail 환경에서 safe. 영향 파일 소수. | ✓ |
| 무시 | 현 plan 그대로. 일부 acceptance에서 no-match 시 파이프 중단 가능. | |

**User's choice:** `|| echo 0` 패턴으로 fix
**Notes:** D-16으로 기록. 모든 plan의 verify/acceptance bash snippet 일괄 revise.

---

## Claude's Discretion (partial session 2)

- D-09 적용 시 `api.heygrabit.com` DNS CNAME 값 구체 타겟 (ghs.googlehosted.com vs custom) — Cloud Run 도메인 매핑 설정에 따라 planner 판단.
- D-12 admin-only test endpoint 구현 세부 (컨트롤러 파일명, guard 재사용 방식, 응답 포맷) — planner 판단.
- D-14 cleanup gate 의 `gcloud logging read` 필터 세부 구성 — planner 판단.

## Deferred Ideas (partial session 2 addendum)

- **Legal mailbox 실제 수신 개설** (D-15로 이관) — 사업자등록 후 Cloudflare Email Routing / Workspace Admin.
- **Resend verified sender domain 재설정** — 이메일 발송자 검증 갱신.
- **Infobip sender ID 정책 재확인** — KISA 정책상 현재 number-only라 영향 미미 예상.
- **구 .run.app URL OAuth callback 임시 등록 정리** (해당 시) — 7일 유예 이후 provider 콘솔에서 정리.
