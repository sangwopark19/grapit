---
quick_id: 260427-pcf
description: "프로덕션 admin 포스터/배너/좌석맵 업로드 R2 CORS 차단 핫픽스 — AWS SDK v3 자동 체크섬 비활성화"
date: 2026-04-27
status: complete
hotfix_branch: hotfix/quick-260427-pcf-r2-cors-checksum
commit: 2642b24
---

# Quick Task 260427-pcf — SUMMARY

## 결과

`apps/api/src/modules/admin/upload.service.ts` `S3Client` 옵션에 다음 두 줄 추가:

```ts
requestChecksumCalculation: 'WHEN_REQUIRED',
responseChecksumValidation: 'WHEN_REQUIRED',
```

이로써 `@aws-sdk/client-s3@3.1020.0` 이 PutObject 요청에 자동 부착하던
`x-amz-checksum-crc32` / `x-amz-sdk-checksum-algorithm` 두 헤더가 사라져,
R2 presigned PUT 이 다시 simple request 로 동작하고 CORS preflight 필요
조건이 없어짐. 회귀 테스트 1건 추가, 단위 테스트 15/15 green, typecheck OK.

## 근본 원인 요약

**증상:** 프로덕션 `https://heygrabit.com/admin` 에서 포스터 업로드 시
브라우저 콘솔에 R2 도메인 PUT 의 CORS preflight 실패가 발생하며 토스트
"포스터 업로드에 실패했습니다." 표시.

```
Access to fetch at 'https://...r2.cloudflarestorage.com/grapit-assets/posters/...
  ?...&x-amz-checksum-crc32=...&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject'
from origin 'https://heygrabit.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**메커니즘 (이중 결함):**

1. **AWS SDK v3 ≥ 3.729 의 default flexible checksum** — `requestChecksumCalculation`
   기본값이 `WHEN_SUPPORTED` 로 변경되어 모든 PutObject 에 체크섬 헤더 자동 부착.
   R2 는 헤더 자체를 거부하지 않지만, 헤더가 추가됨 → 단순 PUT(simple request)
   가 아니게 됨 → CORS preflight 필요 → preflight 가 실패.
2. **R2 버킷 CORS 미정비** — `grapit-assets` 버킷의 CORS 룰에
   `https://heygrabit.com` origin 또는 새 헤더가 등록되어 있지 않아 preflight
   응답이 `Access-Control-Allow-Origin` 을 돌려주지 못함.

코드 수정으로 1차 결함은 해소. 2차 결함(인프라)은 사용자 수동 적용 대상이며
PLAN.md 에 wrangler / Dashboard 양쪽 runbook 명시.

## 변경 파일

- `apps/api/src/modules/admin/upload.service.ts` — S3Client 옵션 2개 추가
- `apps/api/src/modules/admin/upload.service.spec.ts` — 회귀 테스트 1건 추가

## 검증

- ✅ `pnpm --filter @grabit/api typecheck` 통과
- ✅ `npx vitest run upload.service` — 15/15 green
- ✅ 전체 단위 테스트 — 321/321 green
- ⏳ (사용자) 머지 후 Cloud Run 자동 배포 확인 → 프로덕션 admin 에서 실 업로드 검증

## 핫픽스 브랜치

- 브랜치: `hotfix/quick-260427-pcf-r2-cors-checksum`
- 커밋: `2642b24` — `fix(quick-260427-pcf): disable AWS SDK v3 auto-checksum to unblock R2 PUT CORS`
- 머지 전략: 브랜치 push → PR → main 직접 머지 → Cloud Run 자동 배포
- Phase 16(legal pages) 진행 중이지만 코드 격리되어 충돌 없음

## R2 버킷 CORS 정비 (2026-04-28 적용 완료)

조사 결과 기존 룰의 `allowed_headers` 가 `content-type` 만 등록되어 있었음 →
SDK 가 추가하는 모든 `x-amz-*` 헤더가 preflight 에서 거부되는 구조적 원인.

`wrangler r2 bucket cors set grapit-assets --file ./grapit-assets-cors.json --force`
로 다음 룰 적용 (Cloudflare wrangler 스키마 기준):

```json
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://heygrabit.com",
          "https://www.heygrabit.com",
          "https://grapit-web-d3c6wrfdbq-du.a.run.app",
          "http://localhost:3000"
        ],
        "methods": ["GET", "PUT", "HEAD"],
        "headers": [
          "content-type", "content-length",
          "x-amz-checksum-crc32", "x-amz-checksum-crc32c",
          "x-amz-checksum-sha1", "x-amz-checksum-sha256",
          "x-amz-sdk-checksum-algorithm",
          "x-amz-content-sha256", "x-amz-date",
          "x-amz-user-agent", "authorization"
        ]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

`wrangler r2 bucket cors list grapit-assets` 로 적용 검증 완료.

이로써 1차(코드)·2차(인프라) 결함 모두 닫힘. 향후 SDK 가 다른 `x-amz-*`
헤더를 추가하더라도 preflight 가 통과하도록 화이트리스트가 폭넓게 잡혀 있음.
