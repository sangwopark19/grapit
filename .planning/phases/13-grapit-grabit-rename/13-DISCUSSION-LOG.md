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
