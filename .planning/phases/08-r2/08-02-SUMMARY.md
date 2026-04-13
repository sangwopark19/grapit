---
phase: 08-r2
plan: 02
subsystem: infra
tags: [next.js, r2, cloudflare, docker, github-actions, cloud-run]

requires:
  - phase: 08-r2-01
    provides: UploadService S3Client 설정
provides:
  - NEXT_PUBLIC_R2_HOSTNAME 기반 동적 remotePatterns
  - Dockerfile NEXT_PUBLIC_R2_HOSTNAME build arg
  - deploy.yml R2 시크릿 5개 Cloud Run 주입
  - deploy.yml web 빌드 R2 hostname build arg
affects: [08-r2-03, 08-r2-04]

tech-stack:
  added: []
  patterns:
    - "환경변수 기반 Next.js remotePatterns 동적 설정 (코드 변경 없이 도메인 전환)"
    - "GCP Secret Manager 참조 패턴으로 R2 credentials Cloud Run 주입"

key-files:
  created: []
  modified:
    - apps/web/next.config.ts
    - apps/web/Dockerfile
    - .github/workflows/deploy.yml

key-decisions:
  - "remotePatterns에 spread + 조건부 패턴 사용하여 환경변수 미설정 시 빈 배열 유지"
  - "R2 credentials를 env_vars가 아닌 secrets 섹션에 배치하여 T-08-04 위협 완화"

patterns-established:
  - "환경변수 기반 remotePatterns: r2.dev -> cdn.grapit.kr 전환 시 코드 변경 불필요"

requirements-completed: [R2-03, R2-04]

duration: 1min
completed: 2026-04-13
---

# Phase 8 Plan 02: Next.js remotePatterns + Dockerfile + deploy.yml R2 시크릿 Summary

**NEXT_PUBLIC_R2_HOSTNAME 환경변수 기반 동적 remotePatterns 설정, Dockerfile build arg 추가, deploy.yml에 R2 시크릿 5개 및 web build arg 주입**

## Performance

- **Duration:** 1min 16s
- **Started:** 2026-04-13T03:08:06Z
- **Completed:** 2026-04-13T03:09:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- next.config.ts에 NEXT_PUBLIC_R2_HOSTNAME 환경변수 기반 동적 remotePatterns 설정으로 코드 변경 없이 도메인 전환 가능
- Dockerfile에 NEXT_PUBLIC_R2_HOSTNAME build arg 추가하여 빌드 시 주입 가능
- deploy.yml에 R2 시크릿 5개를 secrets 섹션으로 Cloud Run 주입 (T-08-04 위협 완화)
- deploy.yml web 빌드에 R2_PUBLIC_HOSTNAME build arg 전달

## Task Commits

Each task was committed atomically:

1. **Task 1: Next.js remotePatterns 환경변수 기반 동적 설정 + Dockerfile build arg** - `9fe3aec` (feat)
2. **Task 2: GitHub Actions deploy.yml R2 시크릿 주입** - `c5fbf1f` (feat)

## Files Created/Modified
- `apps/web/next.config.ts` - NEXT_PUBLIC_R2_HOSTNAME 기반 동적 remotePatterns, 주석 처리된 cdn.grapit.kr 제거
- `apps/web/Dockerfile` - NEXT_PUBLIC_R2_HOSTNAME ARG + ENV 추가
- `.github/workflows/deploy.yml` - deploy-api secrets에 R2 시크릿 5개 추가, deploy-web build arg에 R2_PUBLIC_HOSTNAME 추가

## Decisions Made
- remotePatterns에 spread + 조건부 패턴 사용: 환경변수 미설정 시 빈 배열 유지하여 로컬 개발에 영향 없음
- R2 credentials(ACCESS_KEY_ID, SECRET_ACCESS_KEY)를 평문 env_vars가 아닌 secrets 섹션에 배치: T-08-04 위협 완화

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - GitHub Actions secrets (R2_PUBLIC_HOSTNAME, R2 관련 GCP Secret Manager 시크릿)은 별도 설정 필요하나 이는 08-04 플랜(Cloudflare 대시보드 + GCP Secret Manager 수동 설정)에서 다룸.

## Next Phase Readiness
- remotePatterns 인프라 준비 완료: R2 버킷 생성 후 환경변수만 설정하면 이미지 로딩 가능
- deploy.yml R2 시크릿 주입 준비 완료: GCP Secret Manager에 시크릿 생성 후 배포 시 자동 주입

---
*Phase: 08-r2*
*Completed: 2026-04-13*
