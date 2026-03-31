---
phase: quick
plan: 260331-n9m
subsystem: admin-upload
tags: [bugfix, upload, local-dev, r2-fallback]
dependency_graph:
  requires: []
  provides: [local-upload-fallback]
  affects: [admin-performance-form, upload-service]
tech_stack:
  added: []
  patterns: [local-dev-fallback, blob-url-preview]
key_files:
  created:
    - apps/api/src/modules/admin/local-upload.controller.ts
  modified:
    - apps/api/src/modules/admin/upload.service.ts
    - apps/api/src/modules/admin/upload.service.spec.ts
    - apps/api/src/modules/admin/admin-performance.controller.ts
    - apps/api/src/modules/admin/admin.module.ts
    - apps/web/hooks/use-admin.ts
    - apps/web/components/admin/performance-form.tsx
    - .gitignore
decisions:
  - Separate LocalUploadController with @Public() for unauthenticated image serving
  - Blob URL preview instead of server URL for immediate UX feedback
metrics:
  duration: 3min
  completed: "2026-03-31T07:59:08Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 8
---

# Quick Task 260331-n9m: Admin Poster Upload Fix Summary

R2 credentials 미설정 로컬 개발환경에서 UploadService가 빈 문자열로 S3Client를 생성하여 getSignedUrl() 500 에러 발생하던 버그를 로컬 파일시스템 폴백으로 수정

## What Changed

### Backend (UploadService)

- `isLocalMode` 프로퍼티 추가: `R2_ACCOUNT_ID`가 비어있거나 미설정이면 `true`
- 로컬 모드에서 S3Client 생성 스킵 (`s3` 프로퍼티를 `S3Client | null`로 변경)
- `generatePresignedUrl()`: 로컬 모드시 R2 대신 로컬 파일 URL 반환 + `mode: 'local' | 'r2'` 필드 추가
- `saveLocalFile()`: `uploads/` 디렉토리에 파일 저장
- `getLocalFile()`: 저장된 파일 읽기 + MIME 타입 매핑

### Backend (Controllers)

- `AdminPerformanceController`: PUT `/upload/local/:folder/:filename` 엔드포인트 추가 (raw body stream 읽기)
- `LocalUploadController` (신규): GET `/upload/local/:folder/:filename` 엔드포인트, `@Public()` 데코레이터로 인증 없이 이미지 서빙

### Frontend

- `usePresignedUpload`: 응답 타입에 `mode: 'local' | 'r2'` 추가
- `handlePosterUpload`: mode=local 시 `credentials: 'include'` 추가, blob URL 즉시 미리보기

## Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | UploadService 로컬 dev 모드 폴백 + 로컬 업로드 엔드포인트 | a25c4a7 | upload.service.ts, local-upload.controller.ts, admin-performance.controller.ts, .gitignore |
| 2 | 프론트엔드 로컬 모드 대응 + 포스터 미리보기 개선 | 70d0233 | use-admin.ts, performance-form.tsx |

## Verification

- 13 unit tests passing (R2 mode 5 tests + local mode 7 tests + edge case 1 test)
- TypeScript check: API app -- zero errors
- TypeScript check: Web app -- zero errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Separate LocalUploadController for public file serving**
- **Found during:** Task 1
- **Issue:** Plan considered putting GET endpoint in AdminPerformanceController with class-level `@Roles('admin')` + `@UseGuards(RolesGuard)`. Since `@Public()` only bypasses JwtAuthGuard but RolesGuard reads class-level `@Roles('admin')` and would crash on undefined `req.user`, images served via `<img src>` would fail.
- **Fix:** Created separate `LocalUploadController` with `@Public()` at class level and no `@Roles()` -- both JwtAuthGuard and RolesGuard pass cleanly.
- **Files modified:** `apps/api/src/modules/admin/local-upload.controller.ts`, `admin.module.ts`
- **Commit:** a25c4a7

## Known Stubs

None -- all data paths are fully wired.
