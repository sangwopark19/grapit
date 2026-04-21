---
quick_id: 260420-cd7
date: 2026-04-20
status: complete
commit: c84ff98
files_changed:
  - .github/workflows/deploy.yml
  - apps/web/Dockerfile
external_changes:
  gcp_secret_manager_created:
    - infobip-api-key
    - infobip-base-url
    - infobip-sender
    - sentry-dsn
    - toss-secret-key
  github_secrets_added:
    - NEXT_PUBLIC_SENTRY_DSN
    - NEXT_PUBLIC_TOSS_CLIENT_KEY
  github_secrets_removed:
    - TOSS_CLIENT_KEY_TEST
    - TOSS_SECRET_KEY_TEST
---

# Quick Task 260420-cd7 — SUMMARY

## Task
Phase 10.1 머지 이후 Deploy workflow 실패 복구. 누락된 프로덕션 시크릿 7개를 올바른 저장소(Secret Manager / GitHub Secrets)에 주입하고 `deploy.yml` / `Dockerfile` 연결.

## Root Cause
Phase 10.1 에서 `SmsService` constructor 가 production 환경에서 `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_SENDER` 를 **필수**로 검증(`apps/api/src/modules/sms/sms.service.ts:150`) 하도록 강화됐으나, 배포 파이프라인(Secret Manager + deploy.yml) 에 반영되지 않음. `grapit-api-00018-j2z` 리비전이 NestFactory 부트스트랩 중 throw → `exit(1)` → Cloud Run TCP probe 실패 → 배포 롤아웃 실패.

동일 점검 과정에서 `SENTRY_DSN`, `TOSS_SECRET_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TOSS_CLIENT_KEY` 도 전혀 주입되지 않음을 추가로 발견 → 한 번에 처리.

## What Changed

### 1. GCP Secret Manager (project `grapit-491806`) — api runtime 시크릿 5개 신규 생성
| 이름 | 값 출처 | 런타임 ENV |
|---|---|---|
| `infobip-api-key` | 사용자 제공 `.env` | `INFOBIP_API_KEY` |
| `infobip-base-url` | 사용자 제공 `.env` | `INFOBIP_BASE_URL` |
| `infobip-sender` | 사용자 제공 `.env` | `INFOBIP_SENDER` |
| `sentry-dsn` | 사용자 제공 `.env` | `SENTRY_DSN` |
| `toss-secret-key` | Toss docs test key | `TOSS_SECRET_KEY` |

모두 version 1 생성. `grapit-cloudrun` SA 가 프로젝트 레벨 `roles/secretmanager.secretAccessor` 이미 보유 → 추가 IAM 바인딩 불필요.

### 2. GitHub Secrets (`sangwopark19/grapit`) — web 빌드타임 값 2개 추가
| 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Next.js 클라이언트 번들 인라인 (Sentry 브라우저 SDK init) |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | Toss Payments 위젯 초기화 |

추가 정리: `TOSS_CLIENT_KEY_TEST`, `TOSS_SECRET_KEY_TEST` 2개 고아 시크릿 제거 (deploy.yml 어디서도 참조되지 않고 있었음).

> **⚠️ 보정 (2026-04-20, quick `260420-ci-toss-secrets-restore`)**: 이 두 시크릿 제거는 **오판이었다**. Phase 09-03 D-13 격리 설계상 `TOSS_CLIENT_KEY_TEST` / `TOSS_SECRET_KEY_TEST` 는 **의도적으로 `deploy.yml` 에 주입 금지**이며 `ci.yml` 전용 (E2E Toss 결제 테스트 + non-fork hard-gate)으로 존재해야 한다. orphan 검사를 `deploy.yml` 단독 기준으로 돌리면 D-13 격리 시크릿은 반드시 false positive 로 잡힌다. 이후 PR #17 CI 의 `Verify Toss test secrets present` step 이 exit 1 로 실패했고, 동일 값으로 즉시 재등록했다. 다음 번 orphan 검사는 반드시 `.github/workflows/*.yml` 전체 grep 으로 확인할 것.

### 3. `apps/web/Dockerfile` (+4 lines)
builder stage 에 ARG/ENV 쌍 2개 추가:
```
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY
ENV NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY
```

### 4. `.github/workflows/deploy.yml` (+7 lines)
- `deploy-api.secrets:` 블록에 5줄 추가 (Infobip 3 + Sentry + Toss)
- `deploy-web` Build step 에 `--build-arg` 2줄 추가 (Sentry + Toss)

## Verification

**Cloud Run 서비스 상태 (post-deploy):**
```
grapit-api: Ready=True, latestReady=grapit-api-00019-7nn
grapit-web: Ready=True, latestReady=grapit-web-00013-674
```

**워크플로 run:**
- CI: run 24646715348 → success
- Deploy: run 24646786786 → success
  - deploy-api: 2m56s ✓
  - deploy-web: 1m43s ✓

이전 실패 리비전 `grapit-api-00018-j2z` 는 `SmsService` throw 로 컨테이너 기동 자체가 안 됐으나, 신규 리비전 `grapit-api-00019-7nn` 은 startup probe 통과하여 `Ready=True` 마킹됨 → 기동 단계 크래시 해결 검증 완료.

## Rollback / Rollforward
- Rollback 필요 시: `gcloud run services update-traffic grapit-api --to-revisions=grapit-api-00017-xxx=100 --region=asia-northeast3` (이전 healthy 리비전으로 traffic 복귀)
- 하지만 현 시점 롤백해도 Phase 10.1 코드가 main 에 머지된 상태라 `SmsService` 가드가 다시 트리거될 가능성 있음 → Rollforward(이번 커밋) 가 정답

## Followups (별도 처리 권장)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` 프로덕션 값 로테이션 검토 (`openssl rand -hex 64` 기준)
- Toss 키는 현재 test 키(`test_gsk_docs_*`, `test_gck_docs_*`). 실결제 전환 시 live 키로 replace 필요
- Infobip 1eelj9 은 개발/테스트 base URL 여부 확인 필요 (Infobip 계정 티어에 따라 production base URL 이 다를 수 있음)
