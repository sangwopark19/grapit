---
phase: 07-valkey
plan: 03
subsystem: infra
tags: [gcp, memorystore, valkey, cloud-run, vpc, psc, secret-manager, bash]

# Dependency graph
requires:
  - phase: 07-valkey/07-01
    provides: ioredis 단일 클라이언트로 통합 (REDIS_URL 환경변수 기반 연결)
provides:
  - Google Memorystore for Valkey 인스턴스 (grapit-valkey, asia-northeast3, ACTIVE)
  - PSC (Private Service Connect) 서비스 연결 정책 (grapit-valkey-policy)
  - GCP Secret Manager에 redis-url 시크릿 등록 (버전 1)
  - Cloud Run Direct VPC Egress 플래그 추가 (deploy.yml)
  - Cloud Run secrets에 REDIS_URL 매핑 추가 (deploy.yml)
affects:
  - 07-valkey/07-04 (app-layer Valkey 연결 검증)
  - 모든 Cloud Run 배포 (deploy.yml 변경으로 다음 배포부터 VPC Egress + REDIS_URL 자동 주입)

# Tech tracking
tech-stack:
  added:
    - Google Memorystore for Valkey (VALKEY_8_0, shared-core-nano)
    - GCP Secret Manager secret: redis-url
    - Cloud Run Direct VPC Egress (--network=default --subnet=default --vpc-egress=private-ranges-only)
  patterns:
    - "PSC 자동 연결 패턴: pscAutoConnection으로 Memorystore가 VPC에 자동 엔드포인트 생성"
    - "Secret Manager → Cloud Run 시크릿 주입: secrets 블록에 NAME=secret-name:latest 형식"
    - "VPC-only Redis 접근: Direct VPC Egress + AUTH_DISABLED 조합 (VPC가 경계선)"

key-files:
  created:
    - scripts/provision-valkey.sh
  modified:
    - .github/workflows/deploy.yml

key-decisions:
  - "AUTH_DISABLED + TLS_DISABLED 선택: PSC가 VPC 경계를 대신하므로 앱 레벨 인증 불필요. Cloud Run은 --vpc-egress=private-ranges-only로 외부 유출 차단"
  - "Memorystore CLUSTER 모드 수용: Valkey는 단일 샤드라도 CLUSTER 모드로 생성됨. 현재 ioredis standalone 연결 방식과 호환성 검증은 Phase 07-04에서 수행"
  - "REDIS_URL 값으로 redis://10.178.0.3:6379 사용: discovery endpoint 주소 (PSC auto-connected)"

patterns-established:
  - "GCP 인프라 프로비저닝 스크립트 패턴: set -euo pipefail + 단계별 echo + 멱등성 처리(already exists 예외 처리)"
  - "Secret Manager IAM 바인딩: serviceAccount:grapit-cloudrun@PROJECT.iam.gserviceaccount.com에 secretAccessor 역할"

requirements-completed: [VALK-02, VALK-05]

# Metrics
duration: ~40min (스크립트 작성 ~10min + 사용자 프로비저닝 실행 ~30min)
completed: 2026-04-10
---

# Phase 07 Plan 03: Valkey Infrastructure Provisioning Summary

**PSC 기반 Memorystore for Valkey 인스턴스 프로비저닝 + Cloud Run Direct VPC Egress 연결 확립 (REDIS_URL: redis://10.178.0.3:6379)**

## Performance

- **Duration:** ~40min (자동화 ~10min + 수동 프로비저닝 ~30min)
- **Started:** 2026-04-10T03:00:00Z (추정)
- **Completed:** 2026-04-10T03:27:32Z (Secret Manager 버전 생성 타임스탬프 기준)
- **Tasks:** 2 (Task 1: 자동화, Task 2: human-verify checkpoint)
- **Files modified:** 2 (scripts/provision-valkey.sh 신규, .github/workflows/deploy.yml 수정)

## Accomplishments

- `scripts/provision-valkey.sh` 작성: GCP API 활성화 → PSC 정책 → Memorystore 인스턴스 생성 → 엔드포인트 출력의 4단계 멱등성 스크립트
- `.github/workflows/deploy.yml`에 Direct VPC Egress 3개 플래그(`--network=default`, `--subnet=default`, `--vpc-egress=private-ranges-only`) + `REDIS_URL=redis-url:latest` 시크릿 추가
- 사용자 프로비저닝 실행 완료: `grapit-valkey` 인스턴스 ACTIVE, discovery endpoint `10.178.0.3:6379`, Secret Manager `redis-url` 등록, Cloud Run 서비스 계정 IAM 바인딩 완료

## Task Commits

각 태스크는 개별 커밋으로 기록됨:

1. **Task 1: 프로비저닝 스크립트 생성 + deploy.yml 업데이트** - `299ca58` (feat)
2. **Task 2: GCP 프로비저닝 실행** - 사용자 수동 실행 (gcloud CLI, 코드 커밋 없음)

**Merge commit:** `7fe9e89` (chore: merge executor worktree)

## Files Created/Modified

- `scripts/provision-valkey.sh` (신규, +91 lines) — GCP API 활성화 + PSC 정책 + Memorystore 인스턴스 생성 자동화 스크립트 (실행 권한 포함)
- `.github/workflows/deploy.yml` (+4 lines) — API 서비스 deploy 단계에 Direct VPC Egress 플래그 3개 + REDIS_URL 시크릿 매핑 추가

## Decisions Made

**AUTH_DISABLED + TLS_DISABLED 선택:** Memorystore PSC 엔드포인트는 VPC 내부에서만 접근 가능하므로 별도 앱 레벨 인증이 불필요하다. Cloud Run에서 `--vpc-egress=private-ranges-only`를 설정하면 private IP(RFC 1918) 트래픽만 VPC를 경유하므로 외부 유출이 차단된다. 이 조합이 보안 경계선을 담당한다.

**REDIS_URL 형식을 `redis://IP:PORT`로 단순화:** Memorystore는 AUTH가 없으므로 인증 정보 없는 URL을 사용. ioredis는 `REDIS_URL` 환경변수를 자동으로 파싱한다.

## Deviations from Plan

### 관찰 사항 (계획 대비 차이점, 자동 수정 불필요)

**1. [관찰] Memorystore CLUSTER 모드 강제 적용**
- **발견 시점:** Task 2 (사용자 프로비저닝 실행)
- **내용:** `shardCount: 1, replicaCount: 0`으로 생성했음에도 인스턴스 `mode`가 `CLUSTER`로 설정됨. Memorystore for Valkey는 모든 인스턴스를 CLUSTER 모드로 생성하며, 이는 변경 불가능한 기본값이다.
- **영향:** 현재 `apps/api/src/modules/booking/providers/redis.provider.ts`는 `new Redis({host, port})` (standalone 모드)로 연결 중. 단일 샤드 클러스터에서는 standalone 클라이언트로도 연결 가능한 경우가 있으나, 실제 Cloud Run 배포 후 연결 동작을 검증해야 한다.
- **후속 조치:** Phase 07-04 (또는 통합 검증 단계)에서 실제 Valkey 인스턴스 연결 테스트 수행. 만약 standalone 모드가 CLUSTER 엔드포인트와 호환되지 않으면 `new Redis.Cluster([{host, port}])`로 변경 필요 (단, ioredis Cluster API는 좌석 잠금 로직에 영향 없음).
- **현재 상태:** 미해결 오픈 이슈 — Phase 07-04 검증 블로커가 될 수 있음.

**2. [관찰] PSC 포워딩 규칙 2개 생성 (예상 1개)**
- **발견 시점:** Task 2 (사용자 프로비저닝 실행)
- **내용:** discovery endpoint `10.178.0.3:6379` (CONNECTION_TYPE_DISCOVERY) 외에 secondary PSC forwarding rule `10.178.0.2` (클러스터 보조 규칙, 클라이언트 포트 없음)도 생성됨.
- **영향:** 클라이언트는 `10.178.0.3:6379` discovery endpoint만 사용하므로 동작에 영향 없음. `10.178.0.2`는 Memorystore 내부 클러스터 관리용.

---

**총 편차:** 0건 자동 수정, 2건 관찰 기록
**계획 영향:** 자동 수정 없음. CLUSTER 모드 이슈는 Phase 07-04 검증에서 확인 필요.

## 보안 결정 문서화

| 항목 | 값 | 근거 |
|------|-----|------|
| authorizationMode | AUTH_DISABLED | PSC VPC 경계로 대체. 네트워크 레벨 격리로 충분 |
| transitEncryptionMode | TRANSIT_ENCRYPTION_DISABLED | VPC 내부 트래픽, GCP 물리 네트워크 암호화로 보호 |
| Cloud Run 접근 | `--vpc-egress=private-ranges-only` | private IP만 VPC 경유, 외부 직접 접근 불가 |
| Secret 관리 | GCP Secret Manager | deploy.yml에 평문 미포함, IAM 서비스 계정 전용 접근 |

## Issues Encountered

- 없음 — 프로비저닝 스크립트 실행이 계획대로 완료됨. CLUSTER 모드 기본값은 GCP 제품 특성으로, 버그가 아닌 예상 범위 내 동작임.

## User Setup Required

다음 작업이 사용자에 의해 이미 완료됨 (Task 2 checkpoint):

1. `./scripts/provision-valkey.sh grapit-491806` 실행 → 인스턴스 ACTIVE 확인
2. `printf 'redis://10.178.0.3:6379' | gcloud secrets create redis-url --data-file=-` → 시크릿 버전 1 생성
3. Cloud Run 서비스 계정에 `roles/secretmanager.secretAccessor` IAM 바인딩 완료

**다음 배포 시 자동 적용:** `main` 브랜치 push → GitHub Actions CI 통과 → deploy.yml의 `--vpc-egress=private-ranges-only` + `REDIS_URL=redis-url:latest`가 Cloud Run에 자동 주입됨.

## Next Phase Readiness

**준비 완료:**
- Memorystore Valkey 인스턴스 `grapit-valkey` ACTIVE (asia-northeast3)
- REDIS_URL `redis://10.178.0.3:6379` Secret Manager 등록
- Cloud Run IAM 시크릿 접근 권한 설정
- deploy.yml VPC Egress 플래그 추가 (다음 배포부터 적용)

**후속 검증 필요 (Phase 07-04 또는 통합 테스트):**
- Cloud Run에서 `10.178.0.3:6379`로 실제 ioredis 연결 성공 여부 확인
- CLUSTER 모드 엔드포인트에 ioredis standalone 클라이언트 호환성 검증
- 좌석 잠금 (SET NX), pub/sub (subscribe/publish) 동작 E2E 검증

---

*Phase: 07-valkey*
*Completed: 2026-04-10*

## Self-Check: PASSED

- `scripts/provision-valkey.sh` 존재 확인: 커밋 `299ca58`에 포함
- `.github/workflows/deploy.yml` 수정 확인: 커밋 `299ca58`에 포함 (`--vpc-egress=private-ranges-only`, `REDIS_URL=redis-url:latest`)
- 코드 커밋 `299ca58` 존재 확인: `git log` 출력에서 확인됨
- Merge commit `7fe9e89` 존재 확인: `git log` 출력에서 확인됨
