# Quick Task 260409-crd: Cloud Run 프로덕션 배포 + OAuth 연동

**Date:** 2026-04-09
**Status:** Complete

## Goal

GCP Cloud Run에 API(NestJS) + Web(Next.js) 프로덕션 배포 파이프라인 구축 및 OAuth 소셜 로그인 연동.

## GCP 인프라 프로비저닝 (일회성)

1. **필수 API 7개 활성화**: run, artifactregistry, sqladmin, iam, iamcredentials, cloudresourcemanager, secretmanager
2. **Artifact Registry**: `grapit` Docker 저장소 (asia-northeast3)
3. **Cloud SQL PostgreSQL 16**: `grapit-db` (db-f1-micro, 서울 리전)
4. **DB/유저 생성**: grapit / grapit_app
5. **Secret Manager 시크릿 9개**: db-password, jwt-secret, jwt-refresh-secret, database-url, kakao-client-id/secret, naver-client-id/secret, google-client-id/secret
6. **서비스 계정 2개**: grapit-cloudrun (런타임), github-actions-deployer (CI/CD)
7. **Workload Identity Federation**: GitHub OIDC → GCP 인증 (키 없는 배포)
8. **GitHub Secrets 5개**: GCP_PROJECT_ID, GCP_WIF_PROVIDER, GCP_SERVICE_ACCOUNT, CLOUD_SQL_CONNECTION_NAME, DATABASE_URL

## 코드 변경사항

### Commit 1: infra: Cloud Run 배포 설정 보완 (PR #10)
- `deploy.yml`: 서비스 계정, Cloud SQL 연결, Secret Manager 마운트, 환경변수 추가
- `deploy-web`: CI 성공 게이트 조건 추가
- `.gitignore`: `.gcp.md` 제외

### Commit 2: fix: GCP 인증을 마이그레이션 앞으로 이동 + Cloud SQL Auth Proxy
- `deploy.yml`: GCP Auth → Cloud SQL Proxy → Migration 순서로 재배치
- CI에서 Cloud SQL 접근을 위한 Auth Proxy 설정

### Commit 3: fix: API Dockerfile pnpm deploy로 의존성 해결
- `apps/api/Dockerfile`: pnpm 심볼릭 링크 문제 → `pnpm deploy --prod --legacy`로 self-contained node_modules 생성

### Commit 4: fix: OAuth strategy 기본값을 placeholder로 변경
- `kakao.strategy.ts`, `naver.strategy.ts`, `google.strategy.ts`: 빈 문자열 → `'not-configured'` (passport-oauth2가 빈 clientID 거부)

### Commit 5: feat: Web-API 연결 + OAuth 시크릿 마운트
- `apps/web/Dockerfile`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` 빌드 인수 추가
- `deploy.yml`: Web에 `--build-arg` API URL 주입, API에 FRONTEND_URL + OAuth 콜백 URL + OAuth 시크릿 마운트

## 배포 중 해결한 이슈

| # | 이슈 | 원인 | 해결 |
|---|------|------|------|
| 1 | 마이그레이션 실패 | CI 러너에서 Cloud SQL Unix socket 접근 불가 | Cloud SQL Auth Proxy + TCP DATABASE_URL |
| 2 | DATABASE_URL 파싱 에러 | 비밀번호의 `@` 문자 | URL 인코딩 (`%40`) |
| 3 | Docker 빌드 MODULE_NOT_FOUND | pnpm 심볼릭 링크 깨짐 | `pnpm deploy --prod --legacy` |
| 4 | pnpm deploy 에러 | pnpm v10 inject-workspace 요구 | `--legacy` 플래그 추가 |
| 5 | NestJS 부트스트랩 실패 | OAuth clientID 빈 문자열 거부 | placeholder 기본값 |
| 6 | Web에서 API 호출 불가 | NEXT_PUBLIC_API_URL 미설정 | Dockerfile ARG + deploy.yml build-arg |

## 결과

| 서비스 | URL | 상태 |
|--------|-----|------|
| API | https://grapit-api-d3c6wrfdbq-du.a.run.app | ✅ 정상 |
| Web | https://grapit-web-d3c6wrfdbq-du.a.run.app | ✅ 정상 |

## 예상 월 비용 (초기)

- Cloud Run 2서비스 (min=0): $0-10
- Cloud SQL (db-f1-micro): ~$10
- 기타 (AR, Secret Manager): ~$2
- **합계: ~$12-23/월**
