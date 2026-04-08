---
phase: quick-260408-nij
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/modules/admin/upload.service.ts
  - apps/api/src/modules/admin/local-upload.controller.ts
  - apps/api/src/database/schema/seat-maps.ts
  - apps/api/src/modules/admin/admin.service.ts
  - apps/api/src/modules/admin/admin.service.spec.ts
autonomous: true
must_haves:
  truths:
    - "path traversal 공격으로 uploads 디렉토리 밖에 파일을 쓸 수 없다"
    - "프로덕션(R2 모드)에서 LocalUploadController 엔드포인트가 비활성화된다"
    - "seat_maps.performance_id에 UNIQUE 제약이 있어 onConflictDoUpdate가 정상 동작한다"
    - "존재하지 않는 ID로 updateBanner/updatePerformance 호출 시 404 NotFoundException이 발생한다"
    - "reorderBanners가 트랜잭션 안에서 실행되어 partial failure가 불가능하다"
  artifacts:
    - path: "apps/api/src/modules/admin/upload.service.ts"
      provides: "path traversal 방어 로직"
      contains: "path.resolve"
    - path: "apps/api/src/modules/admin/local-upload.controller.ts"
      provides: "isLocalMode 가드"
      contains: "isLocalMode"
    - path: "apps/api/src/database/schema/seat-maps.ts"
      provides: "uniqueIndex on performanceId"
      contains: "uniqueIndex"
    - path: "apps/api/src/modules/admin/admin.service.ts"
      provides: "NotFoundException + transaction 적용"
      contains: "NotFoundException"
  key_links:
    - from: "local-upload.controller.ts"
      to: "upload.service.ts"
      via: "isLocalMode 체크"
      pattern: "this\\.uploadService\\.isLocalMode"
    - from: "seat-maps.ts schema"
      to: "admin.service.ts saveSeatMap"
      via: "onConflictDoUpdate target"
      pattern: "uniqueIndex.*performance_id"
---

<objective>
Phase 2 코드리뷰에서 발견된 보안/안정성 이슈 4건을 수정한다.

Purpose: path traversal 취약점 제거, DB 제약 조건 정합성 확보, null crash 방지, 트랜잭션 일관성 보장
Output: 수정된 4개 소스 파일 + Drizzle 마이그레이션 생성
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/modules/admin/upload.service.ts
@apps/api/src/modules/admin/local-upload.controller.ts
@apps/api/src/database/schema/seat-maps.ts
@apps/api/src/modules/admin/admin.service.ts
@apps/api/src/modules/admin/admin.service.spec.ts

<interfaces>
<!-- 기존 코드 패턴 참조 -->

From apps/api/src/modules/admin/upload.service.ts:
```typescript
readonly isLocalMode: boolean;  // R2_ACCOUNT_ID 미설정 시 true
async saveLocalFile(key: string, buffer: Buffer): Promise<string>;
async getLocalFile(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
```

From apps/api/src/database/schema/seat-inventories.ts (uniqueIndex 사용 예시):
```typescript
import { uniqueIndex } from 'drizzle-orm/pg-core';
uniqueIndex('idx_seat_inv_showtime_seat').on(table.showtimeId, table.seatId),
```

From apps/api/src/modules/admin/admin-booking.service.ts (NotFoundException 사용 예시):
```typescript
import { NotFoundException } from '@nestjs/common';
throw new NotFoundException('예매를 찾을 수 없습니다');
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Path traversal 방어 + LocalUpload 프로덕션 가드</name>
  <files>apps/api/src/modules/admin/upload.service.ts, apps/api/src/modules/admin/local-upload.controller.ts</files>
  <action>
**Issue 1 수정: upload.service.ts**

`saveLocalFile`과 `getLocalFile` 두 메서드에 path traversal 방어를 추가한다.

1. `saveLocalFile` 메서드에서 `path.join(uploadDir, key)` 이후 `path.resolve(filePath)`로 정규화한다.
2. 정규화된 경로가 `uploadDir`로 시작하는지 검증한다. 시작하지 않으면 `BadRequestException('Invalid file path')`를 throw한다.
3. `getLocalFile`에도 동일한 검증 로직을 적용한다.
4. 검증 로직을 private 메서드 `private validateLocalPath(key: string): string`로 추출하여 중복을 제거한다:
   ```typescript
   private validateLocalPath(key: string): string {
     const uploadDir = path.resolve(path.join(process.cwd(), 'uploads'));
     const filePath = path.resolve(path.join(uploadDir, key));
     if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
       throw new BadRequestException('Invalid file path');
     }
     return filePath;
   }
   ```
5. `BadRequestException`을 `@nestjs/common`에서 import한다.

**Issue 1 수정: local-upload.controller.ts**

1. `UploadService`의 `isLocalMode`를 체크하는 가드를 추가한다.
2. `uploadLocal`과 `serveLocal` 메서드 시작 부분에서 `this.uploadService.isLocalMode`가 false이면 `NotFoundException`을 throw한다:
   ```typescript
   if (!this.uploadService.isLocalMode) {
     throw new NotFoundException();
   }
   ```
3. `NotFoundException`을 `@nestjs/common`에서 import한다 (기존 import 라인에 추가).
4. `@Public()` 데코레이터는 유지한다 (로컬 dev에서 이미지 서빙에 필요).
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- upload.service.ts의 saveLocalFile/getLocalFile에서 "../../../etc/passwd" 같은 key가 BadRequestException으로 거부된다
- local-upload.controller.ts에서 isLocalMode=false(R2 모드)일 때 404가 반환된다
- 타입체크 통과
  </done>
</task>

<task type="auto">
  <name>Task 2: seat_maps UNIQUE 제약 + updateBanner/updatePerformance null crash + reorderBanners 트랜잭션</name>
  <files>apps/api/src/database/schema/seat-maps.ts, apps/api/src/modules/admin/admin.service.ts, apps/api/src/modules/admin/admin.service.spec.ts</files>
  <action>
**Issue 2 수정: seat-maps.ts**

1. `index` import를 `uniqueIndex`로 변경한다:
   ```typescript
   import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
   ```
2. 테이블 정의의 `index('idx_seat_maps_performance_id')` 를 `uniqueIndex('idx_seat_maps_performance_id')` 로 변경한다.
3. 스키마 변경 후 Drizzle 마이그레이션을 생성한다:
   ```bash
   cd /Users/sangwopark19/icons/grapit && DOTENV_CONFIG_PATH=../../.env pnpm --filter @grapit/api exec drizzle-kit generate
   ```
   (주의: DB 연결 없이 generate만 실행. migrate는 사용자가 별도로 실행한다.)

**Issue 3 수정: admin.service.ts — null crash 방어**

1. `NotFoundException`을 `@nestjs/common`에서 import한다 (파일 최상단에 추가):
   ```typescript
   import { Inject, Injectable, NotFoundException } from '@nestjs/common';
   ```
2. `updatePerformance` 메서드 (line 169-173 부근): `.returning()` 후 결과 체크를 추가한다. `const [perf]` 디스트럭처링 직후에:
   ```typescript
   if (!perf) {
     throw new NotFoundException(`공연을 찾을 수 없습니다 (id: ${id})`);
   }
   ```
3. `updateBanner` 메서드 (line 388-392 부근): 동일하게 `.returning()` 후 결과 체크:
   ```typescript
   if (!result) {
     throw new NotFoundException(`배너를 찾을 수 없습니다 (id: ${id})`);
   }
   ```

**Issue 4 수정: admin.service.ts — reorderBanners 트랜잭션**

`reorderBanners` 메서드 (line 422-429)를 `this.db.transaction`으로 감싼다:
```typescript
async reorderBanners(orderedIds: string[]): Promise<void> {
  await this.db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(banners)
        .set({ sortOrder: i })
        .where(eq(banners.id, orderedIds[i]!));
    }
  });
}
```

**테스트 업데이트: admin.service.spec.ts**

1. 기존 `updateBanner` 테스트에 존재하지 않는 ID 케이스를 추가한다:
   - mockDb의 update chain에서 `returning`이 빈 배열 `[]`을 반환하도록 설정
   - `expect(service.updateBanner('nonexistent', {...})).rejects.toThrow(NotFoundException)` 검증
2. `reorderBanners` 테스트에서 `mockDb.transaction`이 호출되는지 검증한다.
3. `NotFoundException`을 `@nestjs/common`에서 import한다.
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && pnpm --filter @grapit/api exec tsc --noEmit && pnpm --filter @grapit/api test -- --run 2>&1 | tail -30</automated>
  </verify>
  <done>
- seat_maps 스키마에 uniqueIndex가 적용되고 마이그레이션 SQL이 생성됨
- updateBanner('없는ID')와 updatePerformance('없는ID')가 500 대신 404 NotFoundException을 throw함
- reorderBanners가 db.transaction 안에서 실행됨
- 기존 테스트 + 새 테스트 케이스 모두 통과
- 타입체크 통과
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> LocalUploadController | URL 파라미터(folder, filename)가 파일시스템 경로로 사용됨 |
| client -> AdminService update | 클라이언트 제공 ID가 DB 조회에 사용됨 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | T (Tampering) | upload.service.ts saveLocalFile/getLocalFile | mitigate | path.resolve로 정규화 후 uploadDir prefix 검증. 벗어나면 BadRequestException |
| T-quick-02 | I (Info Disclosure) | local-upload.controller.ts | mitigate | isLocalMode 가드로 R2 모드(프로덕션)에서 로컬 파일 엔드포인트 비활성화 |
| T-quick-03 | D (Denial of Service) | admin.service.ts reorderBanners | mitigate | 트랜잭션으로 감싸서 partial failure 시 자동 rollback |
| T-quick-04 | I (Info Disclosure) | admin.service.ts updateBanner/updatePerformance | mitigate | null check 후 NotFoundException throw (500 스택트레이스 대신 깔끔한 404) |
</threat_model>

<verification>
1. 타입체크: `pnpm --filter @grapit/api exec tsc --noEmit` 통과
2. 테스트: `pnpm --filter @grapit/api test -- --run` 통과
3. 마이그레이션: `drizzle-kit generate` 로 SQL 파일 생성 확인
</verification>

<success_criteria>
- path traversal: `../` 포함 key로 saveLocalFile 호출 시 BadRequestException 발생
- R2 모드 가드: isLocalMode=false 시 LocalUploadController 엔드포인트가 404 반환
- UNIQUE 제약: seat_maps 스키마에 uniqueIndex 적용, 마이그레이션 SQL 생성됨
- null crash: 존재하지 않는 ID로 updateBanner/updatePerformance 호출 시 NotFoundException 발생
- 트랜잭션: reorderBanners가 this.db.transaction으로 감싸져 있음
- 모든 기존 테스트 통과
</success_criteria>

<output>
After completion, create `.planning/quick/260408-nij-phase-2-4-path-traversal-seat-maps-uniqu/260408-nij-SUMMARY.md`
</output>
