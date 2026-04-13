# Phase 8: R2 프로덕션 연동 - Research

**Researched:** 2026-04-13
**Domain:** Cloudflare R2 Object Storage + S3 SDK + CDN serving + CI/CD integration
**Confidence:** HIGH

## Summary

Phase 8은 이미 구현 완료된 `UploadService`(presigned URL 생성 + 로컬 fallback)를 프로덕션 R2 버킷에 연결하는 인프라 연동 작업이다. 코드 변경 범위가 좁고(S3Client 설정 보완, next.config.ts remotePatterns, GitHub Actions 환경변수), 핵심 작업은 Cloudflare 대시보드에서의 R2 버킷 생성/CORS 설정과 GCP Secret Manager/Cloud Run 환경변수 주입이다.

가장 큰 리스크는 R2 CORS 설정이다. R2는 `AllowedHeaders: "*"` 와일드카드를 지원하지 않으며, 브라우저 PUT 업로드 시 `content-type` 등을 명시적으로 나열해야 한다. curl로 성공해도 브라우저에서 CORS 에러가 발생하는 패턴이 R2 사용자들에게서 반복적으로 보고되고 있다. 또한 presigned URL은 S3 API 도메인(`<account>.r2.cloudflarestorage.com`)에서만 동작하며 커스텀 도메인에서는 작동하지 않으므로, 업로드 도메인과 공개 읽기 도메인이 분리되는 점을 CORS 설정에 반영해야 한다.

**Primary recommendation:** S3Client에 `forcePathStyle: true` 추가, R2 CORS에 `content-type` 명시적 지정, `NEXT_PUBLIC_R2_HOSTNAME` 환경변수 기반 remotePatterns 설정, GitHub Actions deploy.yml에 R2 시크릿 5개 추가.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 최종 목표 도메인은 `cdn.grapit.kr`이지만, 도메인 미보유 상태이므로 R2 기본 공개 URL(r2.dev)로 먼저 연동
- **D-02:** 도메인 구매 후 `R2_PUBLIC_URL` 환경변수만 교체하면 전환 완료되는 구조로 설계
- **D-03:** Next.js `remotePatterns`는 `NEXT_PUBLIC_R2_HOSTNAME` 환경변수 기반으로 동적 설정 (r2.dev -> cdn.grapit.kr 교체 시 코드 변경 불필요)
- **D-04:** 업로드 방식: 현재 구현된 presigned URL PUT 방식 유지 (프론트엔드 -> R2 직접 업로드)
- **D-05:** CORS AllowedOrigins: 프로덕션 웹 URL만 허용 (최소 범위 보안)
- **D-06:** R2 CORS AllowedHeaders: 와일드카드(*) 불가이므로 Content-Type 등 명시적 지정 (R2-02 요구사항)
- **D-07:** 버킷 접근 제어: 읽기 공개(CDN 서빙) + 쓰기는 presigned URL로만 가능
- **D-08:** 프로덕션 DB에 시드 데이터 1건만 존재 (posterUrl: `/seed/poster/25012652_p.gif`)
- **D-09:** 마이그레이션 스크립트 불필요 -- 시드 데이터 삭제 후 어드민에서 R2로 직접 재등록
- **D-10:** `apps/web/public/seed/` 디렉토리는 R2 연동 완료 후 정리 대상
- **D-11:** R2 환경변수 5개(R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)를 Cloud Run 환경변수로 직접 설정
- **D-12:** CI/CD: GitHub Actions secrets에 R2_* 변수 추가, 배포 시 Cloud Run에 주입
- **D-13:** Next.js용 `NEXT_PUBLIC_R2_HOSTNAME` 환경변수 추가 (remotePatterns 동적 설정용)

### Claude's Discretion
- R2 버킷 이름 결정 (ex: grapit-assets)
- CORS AllowedHeaders 구체적 목록 (Content-Type, Content-Length 등)
- presigned URL 만료 시간 조정 (현재 600초)
- GitHub Actions workflow 파일 수정 세부사항
- .env.example 업데이트 내용

### Deferred Ideas (OUT OF SCOPE)
- 커스텀 도메인 `cdn.grapit.kr` 설정 -- 도메인 구매 후 별도 작업
- R2 이미지 리사이징/WebP 변환 -- Out of Scope (REQUIREMENTS 확정, Next.js Image로 대체)
- `apps/web/public/seed/` 디렉토리 완전 삭제 -- R2 연동 확인 후 별도 커밋으로 정리
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R2-01 | Cloudflare R2 API 토큰 발급 + 버킷 생성 | Cloudflare 대시보드에서 R2 버킷 생성, API 토큰(Object Read & Write 권한) 발급. S3Client endpoint, credentials 설정 가이드 확인 완료 |
| R2-02 | R2 CORS 설정 (AllowedHeaders 명시적 지정) | R2 CORS는 와일드카드 AllowedHeaders 불가. content-type 명시 필수. Wrangler CLI 또는 대시보드로 설정. 공식 문서 확인 완료 |
| R2-03 | 포스터/SVG 프로덕션 업로드 및 CDN 서빙 동작 | UploadService 코드 검토 완료: forcePathStyle 추가 필요, next.config.ts remotePatterns 동적 설정 필요, deploy.yml R2 시크릿 주입 필요 |
| R2-04 | 커스텀 도메인 설정 (CDN 서빙) | 도메인 미보유로 r2.dev 공개 URL 우선 사용 (D-01). R2_PUBLIC_URL 환경변수 기반으로 향후 전환 용이한 구조 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-s3 | ^3.1020.0 (installed) | R2 S3 호환 API 클라이언트 | 프로젝트에 이미 설치됨. R2는 S3 호환 API 사용 [VERIFIED: apps/api/package.json] |
| @aws-sdk/s3-request-presigner | ^3.1020.0 (installed) | Presigned URL 생성 | 프로젝트에 이미 설치됨 [VERIFIED: apps/api/package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| wrangler | latest (npx) | R2 CORS 설정 CLI | CORS 정책 적용 시 `npx wrangler r2 bucket cors set` [CITED: developers.cloudflare.com/r2/buckets/cors/] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Wrangler CLI CORS 설정 | Cloudflare 대시보드 UI | 대시보드가 더 직관적. Wrangler는 스크립트화 가능하지만 일회성 설정에는 과한 편 |
| Presigned URL 직접 업로드 | API 프록시 업로드 | 프록시는 파일 크기 제한 가능하지만 Cloud Run 메모리/대역폭 소비. presigned이 현재 구현 패턴 |

**Installation:**
```bash
# 추가 설치 불필요 -- 모든 의존성이 이미 설치됨
# CORS 설정 시 일회성 사용:
npx wrangler r2 bucket cors set grapit-assets --file cors.json
```

## Architecture Patterns

### R2 연동 아키텍처
```
[Admin Frontend]
  │
  ├─ POST /api/v1/admin/upload/presigned ──> [NestJS API] ──> S3Client.getSignedUrl()
  │                                                              │
  │  <─── { uploadUrl, publicUrl, key, mode: 'r2' } ───────────┘
  │
  ├─ PUT uploadUrl (presigned) ──────────> [R2 Bucket] (직접 업로드)
  │
  └─ publicUrl (R2_PUBLIC_URL/key) ──────> [R2 Public Access / r2.dev]
                                              │
                                              └─> [Next.js Image] (remotePatterns 허용)
```

### Pattern 1: S3Client forcePathStyle 설정
**What:** R2는 path-style URL을 사용하므로 `forcePathStyle: true` 추가 필요
**When to use:** R2 버킷 연동 시 필수
**Example:**
```typescript
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
// + https://www.bucketmate.app/blogs/s3-compatible-setup-cloudflare-r2
this.s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,  // R2 호환성을 위해 필수 추가
  credentials: {
    accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', '') as string,
    secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', '') as string,
  },
});
```

### Pattern 2: Next.js remotePatterns 환경변수 기반 동적 설정
**What:** `NEXT_PUBLIC_R2_HOSTNAME` 환경변수로 remotePatterns hostname을 런타임에 결정
**When to use:** r2.dev -> cdn.grapit.kr 전환 시 코드 변경 없이 환경변수만 변경
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/components/image
// next.config.ts
const r2Hostname = process.env.NEXT_PUBLIC_R2_HOSTNAME;

const nextConfig: NextConfig = {
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      ...(r2Hostname
        ? [{ protocol: 'https' as const, hostname: r2Hostname }]
        : []),
    ],
  },
};
```

### Pattern 3: GitHub Actions R2 시크릿 주입
**What:** deploy.yml의 Cloud Run 배포 단계에 R2 환경변수 추가
**When to use:** API 서비스 배포 시
**Example:**
```yaml
# deploy.yml - deploy-api job
secrets: |
  R2_ACCOUNT_ID=r2-account-id:latest
  R2_BUCKET_NAME=r2-bucket-name:latest
  R2_PUBLIC_URL=r2-public-url:latest
  R2_ACCESS_KEY_ID=r2-access-key-id:latest
  R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest

# deploy-web job - build args
--build-arg NEXT_PUBLIC_R2_HOSTNAME=<r2.dev 서브도메인 hostname>
```

### Anti-Patterns to Avoid
- **AllowedHeaders 와일드카드 사용:** R2에서 `"*"`를 AllowedHeaders에 사용하면 브라우저 PUT 요청이 CORS 에러 발생. 반드시 `"content-type"` 등 명시적 나열 [CITED: developers.cloudflare.com/r2/buckets/cors/]
- **커스텀 도메인으로 presigned URL 사용:** R2 presigned URL은 S3 API 도메인에서만 동작. 커스텀 도메인/r2.dev에서는 작동하지 않음 [CITED: developers.cloudflare.com/r2/api/s3/presigned-urls/]
- **프로덕션에서 r2.dev 과의존:** r2.dev는 rate limiting이 적용되며 개발 목적 전용. 프로덕션 트래픽이 증가하면 커스텀 도메인 전환 필수 [CITED: developers.cloudflare.com/r2/buckets/public-buckets/]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URL 생성 | 직접 서명 로직 구현 | @aws-sdk/s3-request-presigner | 서명 알고리즘 오류, 보안 취약점 위험 |
| R2 CORS 설정 | API 직접 호출 | Cloudflare 대시보드 또는 Wrangler CLI | 일회성 설정, 대시보드가 가장 안전 |
| 파일 업로드 프록시 | NestJS 파일 수신 후 R2 전달 | Presigned URL 직접 업로드 | Cloud Run 메모리/대역폭 절약. 이미 구현됨 |

**Key insight:** UploadService가 이미 완성되어 있으므로 코드 변경은 최소한이고, 핵심 작업은 인프라 설정(R2 버킷, CORS, 환경변수)이다.

## Common Pitfalls

### Pitfall 1: R2 CORS -- 브라우저 PUT 실패 (curl은 성공)
**What goes wrong:** R2에 presigned URL로 curl PUT은 성공하는데, 브라우저 fetch/PUT은 CORS 에러 발생
**Why it happens:** R2의 AllowedHeaders에 `"*"` 와일드카드를 사용하거나, `content-type` 헤더를 누락
**How to avoid:** AllowedHeaders에 `["content-type"]` 명시적 지정. AllowedOrigins에 프로덕션 웹 URL 추가
**Warning signs:** 개발 환경에서 문제없다가 프로덕션 배포 후 업로드 실패
**Source:** [CITED: community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567]

### Pitfall 2: forcePathStyle 미설정
**What goes wrong:** S3Client가 virtual-hosted-style URL(`<bucket>.r2.cloudflarestorage.com`)로 요청 전송. DNS 오류 또는 403 발생
**Why it happens:** AWS SDK v3의 기본 동작이 virtual-hosted-style. R2는 path-style 필요
**How to avoid:** S3Client 생성 시 `forcePathStyle: true` 추가
**Warning signs:** R2 연동 첫 테스트에서 즉시 실패
**Source:** [CITED: bucketmate.app/blogs/s3-compatible-setup-cloudflare-r2]

### Pitfall 3: Next.js Image unoptimized 설정과 remotePatterns 충돌
**What goes wrong:** 현재 `unoptimized: process.env.NODE_ENV !== 'production'`으로 설정됨. 개발 환경에서는 unoptimized=true라서 remotePatterns 검증을 건너뛰지만, 프로덕션에서는 remotePatterns에 R2 hostname이 없으면 이미지 로딩 실패
**Why it happens:** unoptimized 모드에서는 Next.js Image가 원본 URL을 그대로 사용하므로 remotePatterns 불필요. 프로덕션에서만 이미지 최적화가 활성화되어 remotePatterns 검증 발생
**How to avoid:** `NEXT_PUBLIC_R2_HOSTNAME` 환경변수를 프로덕션 빌드 시 반드시 주입
**Warning signs:** 로컬 개발에서 정상 작동하다가 프로덕션 배포 후 이미지 로딩 실패

### Pitfall 4: Presigned URL 도메인 vs 공개 URL 도메인 CORS 불일치
**What goes wrong:** presigned URL은 `<account>.r2.cloudflarestorage.com` 도메인이고, 공개 URL은 `<bucket>.<account>.r2.dev` 또는 커스텀 도메인. CORS를 한쪽만 설정하면 다른 쪽에서 실패
**Why it happens:** 업로드(PUT)와 읽기(GET)가 서로 다른 도메인을 사용
**How to avoid:** R2 CORS 설정의 AllowedOrigins에 프론트엔드 도메인을 포함시키되, presigned URL 자체에는 CORS가 R2 버킷 레벨에서 적용되므로 버킷 CORS 설정으로 충분
**Warning signs:** 이미지 업로드는 되는데 이미지 표시가 안 되거나, 그 반대
**Source:** [CITED: developers.cloudflare.com/r2/api/s3/presigned-urls/]

### Pitfall 5: deploy.yml env_vars vs secrets 혼동
**What goes wrong:** R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY 같은 시크릿을 `env_vars`에 넣으면 평문으로 노출
**Why it happens:** Cloud Run deploy에 `env_vars`(평문)와 `secrets`(GCP Secret Manager 참조)가 구분됨
**How to avoid:** 모든 R2 자격증명은 `secrets:` 섹션에 배치. 현재 deploy.yml의 DATABASE_URL, JWT_SECRET 등과 동일 패턴 사용
**Warning signs:** GitHub Actions 로그에 시크릿 값이 평문으로 출력됨

### Pitfall 6: r2.dev Rate Limiting
**What goes wrong:** 프로덕션에서 r2.dev URL로 이미지를 서빙하면 트래픽 증가 시 rate limit에 걸려 이미지 로딩 실패
**Why it happens:** r2.dev는 개발/테스트 목적 전용이며 rate limiting이 적용됨
**How to avoid:** D-01에 따라 초기 r2.dev 사용 가능하지만, 트래픽 증가 전 커스텀 도메인 전환 계획 수립. 커스텀 도메인은 Cloudflare Cache + CDN 지원
**Warning signs:** 간헐적 이미지 로딩 실패, 429 응답
**Source:** [CITED: developers.cloudflare.com/r2/buckets/public-buckets/]

## Code Examples

### R2 CORS 설정 JSON
```json
// Source: https://developers.cloudflare.com/r2/buckets/cors/
// cors.json -- Wrangler 또는 대시보드에서 적용
[
  {
    "AllowedOrigins": [
      "https://grapit-web-d3c6wrfdbq-du.a.run.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
[VERIFIED: Cloudflare R2 CORS 공식 문서에서 JSON 포맷 확인]

### UploadService S3Client 수정 (forcePathStyle 추가)
```typescript
// Source: 현재 코드(upload.service.ts) + Cloudflare R2 S3 SDK 가이드
this.s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,  // 추가 필요
  credentials: {
    accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', '') as string,
    secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', '') as string,
  },
});
```
[VERIFIED: upload.service.ts 코드 확인, forcePathStyle 누락 확인]

### next.config.ts remotePatterns 동적 설정
```typescript
// Source: Next.js Image 공식 문서 + 프로젝트 코드
const r2Hostname = process.env.NEXT_PUBLIC_R2_HOSTNAME;

images: {
  unoptimized: process.env.NODE_ENV !== 'production',
  remotePatterns: [
    ...(r2Hostname
      ? [{ protocol: 'https' as const, hostname: r2Hostname }]
      : []),
  ],
},
```
[VERIFIED: next.config.ts 현재 코드 확인, remotePatterns 주석 처리 상태 확인]

### deploy.yml R2 시크릿 추가
```yaml
# Source: 현재 deploy.yml 패턴 참고
# deploy-api job - secrets 섹션에 추가:
secrets: |
  DATABASE_URL=database-url:latest
  JWT_SECRET=jwt-secret:latest
  JWT_REFRESH_SECRET=jwt-refresh-secret:latest
  # ... existing secrets ...
  R2_ACCOUNT_ID=r2-account-id:latest
  R2_BUCKET_NAME=r2-bucket-name:latest
  R2_PUBLIC_URL=r2-public-url:latest
  R2_ACCESS_KEY_ID=r2-access-key-id:latest
  R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest

# deploy-web job - build args에 추가:
--build-arg NEXT_PUBLIC_R2_HOSTNAME=${{ secrets.R2_PUBLIC_HOSTNAME }}
```
[VERIFIED: .github/workflows/deploy.yml 현재 구조 확인]

### Web Dockerfile build arg 추가
```dockerfile
# Source: 현재 Dockerfile 패턴
ARG NEXT_PUBLIC_R2_HOSTNAME
ENV NEXT_PUBLIC_R2_HOSTNAME=$NEXT_PUBLIC_R2_HOSTNAME
```
[VERIFIED: apps/web/Dockerfile 현재 패턴 확인]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| R2 대시보드 CORS 설정 | Wrangler CLI `r2 bucket cors set` | 2024 | 스크립트화 가능, 재현성 향상 |
| forcePathStyle 필수 | R2는 여전히 path-style 권장 | 현재 | SDK 기본 동작과 다름, 명시적 설정 필요 |
| r2.dev 프로덕션 사용 | 커스텀 도메인 필수 (rate limit) | 현재 | r2.dev는 개발 전용, 프로덕션은 커스텀 도메인 |

## Codebase Audit -- 변경 필요 파일

### 코드 변경 필요
| File | Change | Reason |
|------|--------|--------|
| `apps/api/src/modules/admin/upload.service.ts` | `forcePathStyle: true` 추가 | R2 path-style 호환성 |
| `apps/web/next.config.ts` | remotePatterns 환경변수 기반 동적 설정 | R2 이미지 서빙 허용 |
| `apps/web/Dockerfile` | `NEXT_PUBLIC_R2_HOSTNAME` build arg 추가 | 빌드 시 환경변수 주입 |
| `.github/workflows/deploy.yml` | R2 secrets 5개 + web build arg 추가 | Cloud Run에 R2 자격증명 주입 |

### 프론트엔드 업로드 패턴 -- 변경 불필요
현재 3개 컴포넌트가 presigned URL 업로드를 사용하며, 모두 동일한 패턴을 따름:
- `performance-form.tsx`: 포스터 업로드 (local mode 분기 있음)
- `banner-manager.tsx`: 배너 이미지 업로드
- `svg-preview.tsx`: SVG 좌석맵 업로드
- `casting-manager.tsx`: 캐스팅 사진 업로드

모든 컴포넌트가 `usePresignedUpload()` -> `fetch(uploadUrl, { method: 'PUT' })` 패턴을 사용하고 있어 R2 모드 전환 시 코드 변경 불필요. [VERIFIED: 4개 컴포넌트 코드 확인]

### Next.js Image 사용 컴포넌트 -- remotePatterns 영향
R2 URL을 `<Image>` src로 전달받는 컴포넌트:
- `performance-card.tsx`: `posterUrl` -- `<Image src={performance.posterUrl}>` [VERIFIED]
- `banner-carousel.tsx`: `imageUrl` -- `<Image src={banner.imageUrl}>` [VERIFIED]
- `app/performance/[id]/page.tsx`: 상세 페이지 포스터 [VERIFIED]
- `reservation-card.tsx`, `order-summary.tsx`, `booking-page.tsx`: 예매 흐름 포스터 [VERIFIED]

이 컴포넌트들은 코드 변경 없이 remotePatterns 설정만으로 R2 이미지 로딩 가능.

### 주의: `<img>` 직접 사용 컴포넌트
- `performance-form.tsx`: 포스터 미리보기에 `<img src={posterPreview}>` 사용 (blob URL 또는 publicUrl)
- `banner-manager.tsx`: 배너 미리보기에 `<img src={imageUrl}>` 사용
- `casting-manager.tsx`: 캐스팅 사진에 `<img src={displayUrl}>` 사용
- `svg-preview.tsx`: SVG에 `<object data={svgUrl}>` 사용

`<img>` 태그는 remotePatterns 제약이 없으므로 R2 URL 직접 표시 가능. 단, R2 공개 접근이 활성화되어 있어야 함.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | forcePathStyle: true가 R2에서 필수 | Architecture Patterns | 공식 문서에는 명시하지 않지만 다수 커뮤니티 소스에서 권장. 미설정 시 간헐적 실패 가능 |
| A2 | r2.dev rate limiting이 현재 트래픽 수준에서 문제되지 않음 | Pitfalls | 초기 트래픽이 적으므로 r2.dev로 시작 가능하나, 트래픽 증가 시 커스텀 도메인 필요 |
| A3 | GCP Secret Manager에 R2 시크릿 저장 후 Cloud Run secrets 참조 방식 사용 | Code Examples | 현재 deploy.yml의 DATABASE_URL 등과 동일 패턴. GCP Secret Manager 접근 권한 확인 필요 |

## Open Questions

1. **R2 API 토큰 발급 범위**
   - What we know: Cloudflare 대시보드에서 R2 API 토큰 발급 필요. Object Read & Write 권한 부여
   - What's unclear: 버킷 단위 제한(특정 버킷만 접근) 가능 여부
   - Recommendation: 보안 최소 권한 원칙에 따라 특정 버킷만 접근 가능하도록 설정. 대시보드에서 확인 후 진행

2. **r2.dev URL 형식**
   - What we know: r2.dev 활성화 후 공개 URL 제공. 형식은 `pub-<hash>.r2.dev` 또는 `<bucket>.<account>.r2.dev`
   - What's unclear: 정확한 URL 형식은 버킷 생성 후 확인 필요
   - Recommendation: 환경변수 기반 설계이므로 실제 URL 확인 후 즉시 적용 가능

3. **NEXT_PUBLIC_R2_HOSTNAME 빌드 타임 vs 런타임**
   - What we know: `NEXT_PUBLIC_*` 환경변수는 Next.js 빌드 타임에 인라인됨. Cloud Run 런타임 env_vars로는 주입 불가
   - What's unclear: 없음 -- 이것은 확인된 사실
   - Recommendation: Dockerfile의 build arg로 주입하고, deploy.yml에서 `--build-arg`로 전달 (현재 NEXT_PUBLIC_API_URL과 동일 패턴)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @aws-sdk/client-s3 | R2 S3 API | ✓ | ^3.1020.0 | -- |
| @aws-sdk/s3-request-presigner | Presigned URL | ✓ | ^3.1020.0 | -- |
| Cloudflare R2 버킷 | 파일 저장 | ✗ (생성 필요) | -- | 로컬 모드 fallback 존재 |
| GCP Secret Manager | R2 시크릿 저장 | ✓ (기존 사용 중) | -- | -- |
| GitHub Actions secrets | CI/CD 시크릿 | ✓ (기존 사용 중) | -- | -- |

**Missing dependencies with no fallback:**
- R2 버킷 생성 + API 토큰 발급 (Cloudflare 대시보드에서 수동 작업 필요)
- GCP Secret Manager에 R2 시크릿 5개 등록 (gcloud CLI 또는 콘솔에서 수동 작업 필요)
- GitHub Actions secrets에 R2 관련 시크릿 등록 (GitHub Settings에서 수동 작업 필요)

**Missing dependencies with fallback:**
- 없음 -- 모든 코드 의존성은 이미 설치됨

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/api test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2-01 | S3Client가 R2 endpoint로 올바르게 초기화됨 | unit | `pnpm --filter @grapit/api test -- upload.service` | ✅ (upload.service.spec.ts) |
| R2-02 | CORS 설정이 content-type AllowedHeaders 포함 | manual-only | Cloudflare 대시보드/API 확인 | N/A (인프라 설정) |
| R2-03 | Presigned URL 생성 + R2 업로드 + 공개 URL 접근 | unit + manual | `pnpm --filter @grapit/api test -- upload.service` + 브라우저 수동 테스트 | ✅ (기존 테스트) |
| R2-04 | R2_PUBLIC_URL 교체로 커스텀 도메인 전환 가능 | unit | `pnpm --filter @grapit/api test -- upload.service` | ✅ (publicUrl 생성 테스트) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/api test -- upload.service`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green + 브라우저에서 실제 R2 업로드/표시 수동 확인

### Wave 0 Gaps
- [ ] `upload.service.spec.ts`에 `forcePathStyle: true` 검증 테스트 추가 -- covers R2-01
- [ ] `next.config.ts` remotePatterns 환경변수 기반 동적 설정은 테스트보다 타입체크로 검증

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Presigned URL 시간 제한(600초), 어드민 JWT guard, R2 API 토큰 최소 권한 |
| V5 Input Validation | yes | 프론트엔드 파일 크기 검증(5MB/10MB), content-type 제한 |
| V6 Cryptography | no | -- |

### Known Threat Patterns for R2 + Presigned URL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 대용량 파일 업로드 남용 | Denial of Service | 프론트엔드 파일 크기 검증 (포스터 5MB, SVG 10MB). R2 presigned PUT은 content-length-range 미지원이므로 프론트엔드 검증에 의존 |
| Presigned URL 탈취/재사용 | Spoofing | 600초 만료, HTTPS 전용, 어드민 JWT guard로 발급 제한 |
| SVG XSS 삽입 | Tampering | SVG가 `<object>` 태그로 표시되므로 동일 출처 정책 적용. R2 공개 도메인에서 서빙되어 메인 도메인과 분리됨 |
| R2 API 토큰 유출 | Information Disclosure | GCP Secret Manager 저장, Cloud Run secrets 참조, 평문 env_vars 사용 금지 |

## Sources

### Primary (HIGH confidence)
- [Cloudflare R2 CORS 공식 문서](https://developers.cloudflare.com/r2/buckets/cors/) -- CORS 설정 JSON 포맷, AllowedHeaders 제약사항
- [Cloudflare R2 S3 SDK 가이드](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) -- S3Client 설정, endpoint 포맷
- [Cloudflare R2 Public Buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) -- r2.dev vs 커스텀 도메인, rate limiting
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- presigned URL 제약사항 (커스텀 도메인 미지원)
- [Cloudflare R2 CORS API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/cors/methods/update/) -- API로 CORS 설정
- Codebase 분석: `upload.service.ts`, `upload.service.spec.ts`, `next.config.ts`, `deploy.yml`, `Dockerfile`, 프론트엔드 4개 업로드 컴포넌트

### Secondary (MEDIUM confidence)
- [R2 CORS Presigned URL 이슈 (Cloudflare Community)](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567) -- 실제 사용자 CORS 문제 사례
- [R2 S3 호환 forcePathStyle (BucketMate)](https://www.bucketmate.app/blogs/s3-compatible-setup-cloudflare-r2) -- forcePathStyle 필요성
- [Next.js Image remotePatterns 문서](https://nextjs.org/docs/app/api-reference/components/image) -- 환경변수 기반 동적 설정

### Tertiary (LOW confidence)
- 없음

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- 모든 의존성이 이미 프로젝트에 설치됨, 공식 문서 확인 완료
- Architecture: HIGH -- 기존 코드 패턴 분석 완료, 변경 범위가 명확하고 좁음
- Pitfalls: HIGH -- Cloudflare 공식 문서 + 커뮤니티 사례로 주요 함정 확인

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (R2 API는 안정적, 30일 유효)
