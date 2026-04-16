---
phase: 10-sms
plan: 02
subsystem: infra
tags: [infobip, sms, twilio, dependencies, env, deploy-checklist]

# Dependency graph
requires:
  - phase: 07-valkey
    provides: ioredis 단일 클라이언트 + Memorystore Valkey
provides:
  - "@nest-lab/throttler-storage-redis 의존성 (Valkey 분산 rate limiting)"
  - "libphonenumber-js 의존성 (API + Web 국가 감지/번호 검증)"
  - "INFOBIP_* 4종 환경변수 contract (.env.example)"
  - "Infobip 콘솔 운영 체크리스트 (DEPLOY-CHECKLIST.md)"
affects: [10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09]

# Tech tracking
tech-stack:
  added: ["@nest-lab/throttler-storage-redis ^1.2.0", "libphonenumber-js ^1.12.41"]
  patterns: ["Infobip env var contract (4종 hard-fail)", "DEPLOY-CHECKLIST 운영 체크리스트 패턴"]

key-files:
  created: [".planning/phases/10-sms/DEPLOY-CHECKLIST.md"]
  modified: ["apps/api/package.json", "apps/web/package.json", "pnpm-lock.yaml", ".env.example"]

key-decisions:
  - "twilio 완전 제거, Infobip 2FA API로 전환"
  - "@nest-lab/throttler-storage-redis 선택 (NestJS 11 + ioredis 5 peerDeps 호환 확인)"

patterns-established:
  - "Infobip env contract: INFOBIP_API_KEY, INFOBIP_BASE_URL, INFOBIP_APPLICATION_ID, INFOBIP_MESSAGE_ID 4종"
  - "운영 체크리스트: 코드 배포 외 수동 콘솔 작업을 DEPLOY-CHECKLIST.md로 문서화"

requirements-completed: [SMS-02, SMS-03]

# Metrics
duration: 3min
completed: 2026-04-16
---

# Phase 10 Plan 02: 의존성 교체 + 환경변수 문서화 Summary

**twilio 제거 + @nest-lab/throttler-storage-redis, libphonenumber-js 설치, INFOBIP env var contract 4종 문서화, 10단계 운영 체크리스트 작성**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-16T02:40:57Z
- **Completed:** 2026-04-16T02:44:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- twilio ^5.13.1 의존성 완전 제거 (Infobip 전환 준비)
- @nest-lab/throttler-storage-redis ^1.2.0 + libphonenumber-js ^1.12.41 설치 (api + web)
- .env.example에서 TWILIO_* 3종 제거, INFOBIP_* 4종 추가 (계정별 도메인 예시 포함)
- DEPLOY-CHECKLIST.md 10단계 운영 체크리스트 작성 (Infobip 콘솔 + GCP + GitHub Actions)

## Task Commits

Each task was committed atomically:

1. **Task 1: twilio 제거 + throttler-storage-redis, libphonenumber-js 설치** - `333d55c` (chore)
2. **Task 2: .env.example TWILIO 제거 + INFOBIP 추가 + DEPLOY-CHECKLIST** - `3b41468` (docs)

## Files Created/Modified
- `apps/api/package.json` - twilio 제거, @nest-lab/throttler-storage-redis + libphonenumber-js 추가
- `apps/web/package.json` - libphonenumber-js 추가 (프론트 국가 감지 UI)
- `pnpm-lock.yaml` - lockfile 갱신
- `.env.example` - TWILIO_* 3종 삭제, INFOBIP_* 4종 추가 (env var contract 명시)
- `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` - Infobip 콘솔 운영 체크리스트 10단계

## Decisions Made
- @nest-lab/throttler-storage-redis ^1.2.0 선택: peerDeps가 @nestjs/common ^11.0.0, @nestjs/throttler >=6.0.0, ioredis >=5.0.0으로 현재 스택과 완전 호환
- env var contract에 xxxxx.api.infobip.com 예시를 인라인 주석으로 명시 (Review #9 반영)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**외부 서비스 설정 필요.** `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` 참조:
- Infobip Portal 계정 생성 + 2FA Application/Message Template 생성
- 한국 발신번호 KISA 사전등록
- GCP Secret Manager + GitHub Actions secrets 업데이트
- Cloud Run 환경변수 바인딩

## Next Phase Readiness
- Wave 1+ 코드(Plan 03~09)가 import할 패키지가 모두 설치됨
- .env.example이 최신이므로 로컬 개발 환경 시작 가능
- DEPLOY-CHECKLIST가 프로덕션 배포 전 수동 작업을 문서화

## Self-Check: PASSED

- [x] DEPLOY-CHECKLIST.md exists
- [x] 10-02-SUMMARY.md exists
- [x] Commit 333d55c found (Task 1)
- [x] Commit 3b41468 found (Task 2)

---
*Phase: 10-sms*
*Completed: 2026-04-16*
