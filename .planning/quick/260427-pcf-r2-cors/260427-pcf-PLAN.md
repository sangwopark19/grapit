---
quick_id: 260427-pcf
description: "프로덕션 admin 포스터 업로드가 R2 PUT 단계에서 CORS preflight 실패로 100% 막힘 — AWS SDK v3 자동 체크섬 헤더 차단"
created: 2026-04-27
status: planned
hotfix_branch: hotfix/quick-260427-pcf-r2-cors-checksum
---

# Quick Task 260427-pcf — R2 포스터 업로드 CORS / 체크섬 핫픽스

## 배경 및 증상

- **증상:** 프로덕션 `https://heygrabit.com/admin` 에서 포스터 이미지 업로드 시 토스트 "포스터 업로드에 실패했습니다." 표시. UI 흐름은 `<input type="file">` → blob preview → `POST /api/v1/admin/upload/presigned` → `PUT <signed-url-of-r2>`.
- **presigned 발급 자체는 200 OK** (Cloud Run API 정상 응답). 직후 R2 도메인으로 가는 PUT만 실패.
- **데스크톱 Chrome 콘솔 로그 (사용자 제공):**

```
Access to fetch at 'https://6c94bc5d14389171fcb54b8b9fc1f0eb.r2.cloudflarestorage.com/grapit-assets/posters/<uuid>.jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Content-Sha256=UNSIGNED-PAYLOAD
  &X-Amz-Credential=2c1fa5ef.../20260427/auto/s3/aws4_request
  &X-Amz-Date=20260427T091401Z
  &X-Amz-Expires=600
  &X-Amz-Signature=...
  &X-Amz-SignedHeaders=host
  &x-amz-checksum-crc32=AAAAAA%3D%3D
  &x-amz-sdk-checksum-algorithm=CRC32
  &x-id=PutObject'
from origin 'https://heygrabit.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

PUT ...r2.cloudflarestorage.com/...  net::ERR_FAILED
```

## 근본 원인 (이중 결함)

### 1. AWS SDK v3 ≥ 3.729 의 default flexible checksum

- `apps/api/package.json` 은 `@aws-sdk/client-s3 ^3.1020.0` (현재 lock 도 3.1020.0).
- `S3Client` 의 `requestChecksumCalculation` 기본값이 `WHEN_SUPPORTED` 로 변경되면서, `PutObjectCommand` 가 자동으로 다음 두 헤더(쿼리스트링 변환됨)를 부착:
  - `x-amz-checksum-crc32`
  - `x-amz-sdk-checksum-algorithm`
- **이 두 헤더는 서명 시점에는 query string 으로 들어가지만**, 실제 PUT 본 요청에서는 헤더로도 전송되며 R2 의 CORS preflight 가 이를 사용자 정의 헤더로 보고 검사함.
- R2 가 헤더 자체를 거부하는 게 아니라, **CORS 가 미설정/부족해서 preflight 가 통과하지 못함**. SDK 가 더 이상 단순 PUT(simple request) 가 아닌 헤더로 사전 검사가 필요한 PUT 으로 만든 셈.
- 참고: aws-sdk-js-v3 issue #6810, R2 + 자동 체크섬 충돌의 표준 회피책은 `requestChecksumCalculation: 'WHEN_REQUIRED'` 명시.

### 2. R2 버킷 (`grapit-assets`) CORS 가 production origin 을 허용하지 않음

- 에러 메시지 자체가 "No `Access-Control-Allow-Origin` header is present on the requested resource" → 버킷 CORS 가 `https://heygrabit.com` 을 응답 헤더로 반사하지 못함.
- 버킷 이름이 `grapit-assets` 인 점은 Phase 13 grapit→grabit rename 이전에 만들어진 R2 버킷이 그대로 살아있는 것 (의도적 — 버킷 rename 은 데이터 마이그레이션 비용). 이름 자체가 결함은 아님.

체크섬 헤더를 제거해도 (= 단순 PUT 로 되돌려도) **production origin CORS 룰이 없으면 여전히 실패**. 둘 다 손봐야 함.

## 수정 범위

### 코드 (이번 PR 으로 머지)

**`apps/api/src/modules/admin/upload.service.ts`**

`S3Client` 생성자에 다음 두 옵션 추가:

```ts
this.s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  // R2 호환: SDK v3 ≥ 3.729 의 flexible checksum 자동 부착을 비활성화.
  // x-amz-checksum-crc32 / x-amz-sdk-checksum-algorithm 헤더가 붙으면
  // R2 CORS preflight 가 추가 헤더로 검사 → 룰이 모두 매칭되어야만 통과.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { ... },
});
```

`'WHEN_REQUIRED'` 는 SDK 가 명시적 알고리즘 지정이 있을 때만 체크섬을 계산. PutObject 는 명시 지정이 없으므로 헤더가 사라진다.

**`apps/api/src/modules/admin/upload.service.spec.ts`**

기존 `should create S3Client with forcePathStyle: true` 테스트에 옵션 두 개 검증 추가.

### 인프라 (사용자 수동 적용 — 본 PR 범위 밖, runbook 으로 명시)

R2 버킷 `grapit-assets` 의 CORS 룰을 다음과 같이 업데이트:

```json
[
  {
    "AllowedOrigins": [
      "https://heygrabit.com",
      "https://www.heygrabit.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "x-amz-checksum-crc32",
      "x-amz-sdk-checksum-algorithm",
      "x-amz-content-sha256",
      "x-amz-date",
      "authorization"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

적용 방법(둘 중 하나):

1. Cloudflare Dashboard → R2 → `grapit-assets` → Settings → CORS Policy → Edit
2. wrangler CLI:
   ```bash
   # cors.json 에 위 JSON 저장 후
   wrangler r2 bucket cors put grapit-assets --rules ./cors.json
   ```

코드 수정만으로도 1차 결함은 해소되지만, 향후 SDK 가 다시 헤더를 추가하거나 다른 클라이언트가 붙는 시나리오를 대비해 CORS 룰도 정비 권장.

## 검증

- [ ] `pnpm --filter @grabit/api typecheck` 통과
- [ ] `pnpm --filter @grabit/api test upload.service` 통과 (기존 + 새 검증)
- [ ] (사용자) hotfix 브랜치 머지 후 Cloud Run 배포 확인, 프로덕션 admin 에서 포스터 1장 업로드 → PUT 200 + 화면 미리보기 출력
- [ ] (사용자) 위 R2 CORS 룰 적용 후 다시 1장 업로드 → 동일 결과

## 영향 범위

- 배너 이미지 업로드 (`banner-manager.tsx`), 좌석맵 SVG 업로드 (`svg-preview.tsx`), 캐스팅 사진 업로드 (`casting-manager.tsx`) — 동일 `usePresignedUpload` hook 경유. 한 번에 모두 회복됨.
- 기존 업로드된 객체 (`grapit-assets/posters/...`) 는 변경 없음, 도메인 `cdn.heygrabit.com` 으로 서빙되는 GET 도 영향 없음.

## 핫픽스 브랜치

- 브랜치: `hotfix/quick-260427-pcf-r2-cors-checksum` (이미 main 에서 분기됨)
- 머지 전략: PR → main 직접 머지 후 Cloud Run 자동 배포 (Phase 16 진행 중이지만 Phase 16 코드 수정은 없음, 격리됨)

## 작업 순서

1. `upload.service.ts` 에 `requestChecksumCalculation` / `responseChecksumValidation` 추가
2. `upload.service.spec.ts` 의 forcePathStyle 검증 테스트 확장
3. `pnpm --filter @grabit/api typecheck` + `pnpm --filter @grabit/api test:unit -- upload.service` 통과
4. 단일 atomic commit: `fix(quick-260427-pcf): disable AWS SDK v3 auto-checksum to unblock R2 PUT CORS`
5. SUMMARY.md + STATE.md docs commit
