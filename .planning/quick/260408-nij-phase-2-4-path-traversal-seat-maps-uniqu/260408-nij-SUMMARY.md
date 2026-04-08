# Quick Task 260408-nij: Phase 2 코드리뷰 이슈 4건 수정

**Completed:** 2026-04-08
**Commits:** `1e13eb7`, `e937543`

## Changes

### Task 1: Path Traversal 방어 + LocalUpload 프로덕션 가드 (`1e13eb7`)

**upload.service.ts:**
- `validateLocalPath()` private 메서드 추가: `path.resolve()` 결과가 uploads 디렉토리 내부인지 `startsWith` 검증
- `saveLocalFile()`, `getLocalFile()`에서 파일 I/O 전 `validateLocalPath()` 호출
- 경로 순회 시도 시 `BadRequestException` throw

**local-upload.controller.ts:**
- `uploadLocal()`, `serveLocal()` 양쪽에 `isLocalMode` 가드 추가
- 프로덕션 환경(R2 설정 시) 접근 시 403 Forbidden 반환

### Task 2: seat_maps UNIQUE + NotFoundException + reorderBanners TX (`e937543`)

**seat-maps.ts:**
- `index('idx_seat_maps_performance_id')` → `uniqueIndex('idx_seat_maps_performance_id')` 변경
- `onConflictDoUpdate` 정상 동작을 위한 UNIQUE 제약 추가

**0006_luxuriant_tony_stark.sql:**
- 기존 일반 인덱스 DROP → UNIQUE 인덱스 CREATE 마이그레이션

**admin.service.ts:**
- `updatePerformance()`: `.returning()` 후 `perf` null 체크, 없으면 `NotFoundException` throw
- `updateBanner()`: `.returning()` 후 `result` null 체크, 없으면 `NotFoundException` throw
- `reorderBanners()`: `this.db.transaction(async (tx) => { ... })` 트랜잭션 래핑

**admin.service.spec.ts:**
- `updatePerformance` 존재하지 않는 ID 테스트 추가
- `reorderBanners` 트랜잭션 내 업데이트 테스트 추가

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/modules/admin/upload.service.ts` | `validateLocalPath` 메서드 추가 |
| `apps/api/src/modules/admin/local-upload.controller.ts` | `isLocalMode` 가드 추가 |
| `apps/api/src/database/schema/seat-maps.ts` | `index` → `uniqueIndex` |
| `apps/api/src/database/migrations/0006_luxuriant_tony_stark.sql` | UNIQUE 인덱스 마이그레이션 |
| `apps/api/src/modules/admin/admin.service.ts` | NotFoundException + 트랜잭션 |
| `apps/api/src/modules/admin/admin.service.spec.ts` | 테스트 2건 추가 |
