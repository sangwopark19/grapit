# Phase 8: R2 프로덕션 연동 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 08-R2 프로덕션 연동
**Areas discussed:** CDN 도메인 전략, CORS 및 보안 설정, 기존 데이터 마이그레이션, 환경변수 및 배포

---

## CDN 도메인 전략

| Option | Description | Selected |
|--------|-------------|----------|
| cdn.grapit.kr | 커스텀 서브도메인으로 R2 버킷 연결. 브랜딩 일관성, CDN 교체 시 URL 유지 | ✓ (최종 목표) |
| R2 기본 공개 URL | r2.dev 도메인. 설정 간단, 브랜딩 불일치 | ✓ (초기 연동) |
| assets.grapit.kr | cdn 대신 assets 서브도메인. 기능적 차이 없음 | |

**User's choice:** cdn.grapit.kr를 최종 목표로, 도메인 미보유이므로 R2 기본 URL로 먼저 연동
**Notes:** 도메인 구매 전까지 r2.dev URL 사용, 구매 후 R2_PUBLIC_URL 환경변수만 교체

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare DNS | 이미 Cloudflare에서 관리 중 | |
| 다른 DNS | 다른 네임서버 사용 중 | |
| 도메인 아직 없음 | 도메인 구매 전 | ✓ |

**User's choice:** 도메인 아직 없음

---

## CORS 및 보안 설정

| Option | Description | Selected |
|--------|-------------|----------|
| Presigned URL 유지 | 현재 구현된 방식. 프론트엔드→R2 직접 업로드 | ✓ |
| 백엔드 프록시 | 파일을 백엔드 경유. CORS 불필요하지만 트래픽 부담 | |

**User's choice:** Presigned URL PUT 방식 유지

| Option | Description | Selected |
|--------|-------------|----------|
| 프로덕션 URL만 | 최소 범위 보안 | ✓ |
| 프로덕션 + localhost | 로컬 개발에서도 R2 접근 | |
| 와일드카드 (*) | 모든 origin 허용 | |

**User's choice:** 프로덕션 URL만

| Option | Description | Selected |
|--------|-------------|----------|
| 읽기 공개 + 쓰기 presigned | CDN 서빙 가능, 업로드는 인증 필요 | ✓ |
| 전체 비공개 + presigned | 보안 최대, CDN 불가 | |

**User's choice:** 읽기 공개 + 쓰기 presigned

---

## 기존 데이터 마이그레이션

| Option | Description | Selected |
|--------|-------------|----------|
| 시드 삭제 후 재등록 | 시드 데이터 정리, 어드민에서 R2로 재업로드 | ✓ |
| 시드 이미지 R2 업로드 + URL 업데이트 | 마이그레이션 스크립트 작성 | |
| 그냥 둠 | 시드 데이터 유지, 새 공연부터 R2 적용 | |

**User's choice:** 시드 데이터 삭제 후 어드민에서 재등록
**Notes:** 프로덕션 DB에 시드 데이터 1건만 존재 (posterUrl: /seed/poster/25012652_p.gif — Next.js public 정적 파일). gcloud CLI + API 호출로 확인됨. 마이그레이션 스크립트 불필요.

---

## 환경변수 및 배포

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud Run 환경변수 직접 | gcloud run services update로 설정 | ✓ |
| GCP Secret Manager 전체 | 시크릿 키 포함 전부 Secret Manager | |
| 하이브리드 | 시크릿만 Secret Manager, 나머지 환경변수 | |

**User's choice:** Cloud Run 환경변수 직접 설정

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Secrets | Actions secrets에 추가, 배포 시 주입 | ✓ |
| gcloud CLI 수동 | 배포와 별도로 한 번만 설정 | |

**User's choice:** GitHub Secrets

| Option | Description | Selected |
|--------|-------------|----------|
| 환경변수 기반 | NEXT_PUBLIC_R2_HOSTNAME으로 동적 설정 | ✓ |
| 하드코딩 | r2.dev 도메인 직접 입력 | |
| Claude 재량 | 최적 방식 결정 위임 | |

**User's choice:** 환경변수 기반 remotePatterns

---

## Claude's Discretion

- R2 버킷 이름 결정
- CORS AllowedHeaders 구체적 목록
- presigned URL 만료 시간
- GitHub Actions workflow 수정 세부사항
- .env.example 업데이트

## Deferred Ideas

- 커스텀 도메인 cdn.grapit.kr — 도메인 구매 후 별도 작업
- R2 이미지 리사이징/WebP 변환 — Out of Scope
- public/seed/ 디렉토리 삭제 — R2 연동 확인 후 별도 정리
