# Phase 8: R2 프로덕션 연동 - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

포스터 이미지와 SVG 좌석맵 파일이 Cloudflare R2 버킷에 업로드되고, 공개 URL(초기 r2.dev, 향후 cdn.grapit.kr)을 통해 CDN 서빙된다. R2 버킷 생성, API 토큰 발급, CORS 설정, Cloud Run 환경변수 주입, Next.js remotePatterns 연동, 시드 데이터 정리까지 포함한다.

</domain>

<decisions>
## Implementation Decisions

### CDN 도메인 전략
- **D-01:** 최종 목표 도메인은 `cdn.grapit.kr`이지만, 도메인 미보유 상태이므로 R2 기본 공개 URL(r2.dev)로 먼저 연동
- **D-02:** 도메인 구매 후 `R2_PUBLIC_URL` 환경변수만 교체하면 전환 완료되는 구조로 설계
- **D-03:** Next.js `remotePatterns`는 `NEXT_PUBLIC_R2_HOSTNAME` 환경변수 기반으로 동적 설정 (r2.dev → cdn.grapit.kr 교체 시 코드 변경 불필요)

### CORS 및 보안 설정
- **D-04:** 업로드 방식: 현재 구현된 presigned URL PUT 방식 유지 (프론트엔드 → R2 직접 업로드)
- **D-05:** CORS AllowedOrigins: 프로덕션 웹 URL만 허용 (최소 범위 보안)
- **D-06:** R2 CORS AllowedHeaders: 와일드카드(*) 불가이므로 Content-Type 등 명시적 지정 (R2-02 요구사항)
- **D-07:** 버킷 접근 제어: 읽기 공개(CDN 서빙) + 쓰기는 presigned URL로만 가능

### 기존 데이터 마이그레이션
- **D-08:** 프로덕션 DB에 시드 데이터 1건만 존재 (posterUrl: `/seed/poster/25012652_p.gif` — Next.js public 정적 파일)
- **D-09:** 마이그레이션 스크립트 불필요 — 시드 데이터 삭제 후 어드민에서 R2로 직접 재등록
- **D-10:** `apps/web/public/seed/` 디렉토리는 R2 연동 완료 후 정리 대상

### 환경변수 및 배포
- **D-11:** R2 환경변수 5개(R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)를 Cloud Run 환경변수로 직접 설정
- **D-12:** CI/CD: GitHub Actions secrets에 R2_* 변수 추가, 배포 시 Cloud Run에 주입 (현재 CI/CD 패턴과 동일)
- **D-13:** Next.js용 `NEXT_PUBLIC_R2_HOSTNAME` 환경변수 추가 (remotePatterns 동적 설정용)

### Claude's Discretion
- R2 버킷 이름 결정 (ex: grapit-assets)
- CORS AllowedHeaders 구체적 목록 (Content-Type, Content-Length 등)
- presigned URL 만료 시간 조정 (현재 600초)
- GitHub Actions workflow 파일 수정 세부사항
- .env.example 업데이트 내용

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 업로드 서비스 (핵심)
- `apps/api/src/modules/admin/upload.service.ts` — S3Client + presigned URL 생성 + 로컬 fallback. R2 환경변수 5개 사용
- `apps/api/src/modules/admin/upload.service.spec.ts` — UploadService 유닛 테스트 (R2 모드 + 로컬 모드)
- `apps/api/src/modules/admin/local-upload.controller.ts` — 로컬 dev 모드 파일 업로드/서빙 컨트롤러

### 어드민 업로드 엔드포인트
- `apps/api/src/modules/admin/admin-performance.controller.ts` — `POST /admin/upload/presigned` presigned URL 발급 엔드포인트
- `apps/api/src/modules/admin/admin.module.ts` — AdminModule (UploadService 등록)

### DB 스키마 (URL 저장 필드)
- `apps/api/src/database/schema/performances.ts` — `posterUrl: varchar('poster_url', { length: 1000 })`
- `apps/api/src/database/schema/seat-maps.ts` — `svgUrl: varchar('svg_url', { length: 1000 })`
- `apps/api/src/database/schema/banners.ts` — `imageUrl: varchar('image_url', { length: 1000 })`

### Next.js 이미지 설정
- `apps/web/next.config.ts` — `images.remotePatterns` (현재 cdn.grapit.kr 주석 처리)

### 시드 데이터 (정리 대상)
- `apps/web/public/seed/` — 포스터 GIF 5개, 배너 GIF 3개, SVG 1개

### PITFALLS 리서치
- `.planning/research/PITFALLS.md` — R2 CORS + presigned URL 도메인 불일치 주의사항

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UploadService`: S3Client 초기화, presigned URL 생성, 로컬 fallback 전체 구현 완료. 환경변수만 설정하면 R2 모드로 동작
- `LocalUploadController`: 로컬 dev 모드용 PUT/GET 컨트롤러. R2 모드에서는 자동 비활성화 (`isLocalMode` 체크)
- `upload.service.spec.ts`: R2 모드와 로컬 모드 유닛 테스트 존재

### Established Patterns
- 환경변수 기반 모드 전환: `R2_ACCOUNT_ID` 유무로 R2/로컬 모드 자동 결정
- Presigned URL 플로우: 프론트엔드 → `POST /admin/upload/presigned` → presigned URL 받기 → PUT으로 R2 직접 업로드
- NestJS ConfigService: `config.get<string>('R2_*', '')` 패턴으로 환경변수 읽기

### Integration Points
- `next.config.ts`: `images.remotePatterns`에 R2 공개 도메인 추가 필요
- Cloud Run 환경변수: R2_* 5개 + NEXT_PUBLIC_R2_HOSTNAME 추가
- GitHub Actions: secrets에 R2 환경변수 추가, 배포 workflow에서 주입
- 프론트엔드 이미지 컴포넌트: `<Image>` 태그의 src가 R2 URL을 받을 수 있어야 함

</code_context>

<specifics>
## Specific Ideas

- 코드 변경은 최소한: UploadService는 이미 R2 연동 코드가 완성되어 있으므로 환경변수 설정이 핵심
- next.config.ts의 remotePatterns를 환경변수 기반으로 동적 설정하여 도메인 교체 용이성 확보
- 현재 프로덕션 API URL: `https://grapit-api-551744523763.asia-northeast3.run.app`
- 현재 프로덕션 웹 URL: `https://grapit-web-551744523763.asia-northeast3.run.app` (CORS AllowedOrigins에 사용)

</specifics>

<deferred>
## Deferred Ideas

- 커스텀 도메인 `cdn.grapit.kr` 설정 — 도메인 구매 후 별도 작업
- R2 이미지 리사이징/WebP 변환 — Out of Scope (REQUIREMENTS 확정, Next.js Image로 대체)
- `apps/web/public/seed/` 디렉토리 완전 삭제 — R2 연동 확인 후 별도 커밋으로 정리

</deferred>

---

*Phase: 08-r2*
*Context gathered: 2026-04-13*
