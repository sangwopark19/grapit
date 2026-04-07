# Quick Task 260407-gee: WebSocket 재연결 토스트 반복 노출 버그 수정

**Completed:** 2026-04-07
**Commits:** 68f4aba, 53fe286

## Changes

### Task 1: socket-client.ts reconnection 제한 + booking.gateway.ts CORS 수정
- `apps/web/lib/socket-client.ts`: `reconnectionAttempts: Infinity` → `10`으로 제한
- `apps/api/src/modules/booking/booking.gateway.ts`: CORS origin을 dynamic function으로 변경 — 개발 환경에서는 모든 origin 허용, 프로덕션에서는 `FRONTEND_URL`만 허용

### Task 2: use-socket.ts 조건부 토스트 + 에러 핸들러 추가
- `apps/web/hooks/use-socket.ts`:
  - `disconnect` 핸들러에 `hadPreviousConnection` 체크 추가 — 초기 연결 전에는 토스트 미표시
  - `connect_error` 핸들러 추가 — 서버 연결 불가 시 1회성 에러 토스트
  - `reconnect_failed` 핸들러 추가 — 10회 재연결 실패 후 "페이지 새로고침" 안내 토스트
  - cleanup에서 `reconnect_failed` 리스너 해제 추가

### 추가: SeatUpdateEvent 타입 공유
- `packages/shared/src/types/booking.types.ts`: `SeatUpdateEvent` 인터페이스 추가 (클라이언트/서버 공유 타입)

## Root Causes Addressed
1. `disconnect` 이벤트가 초기 연결 실패에도 무조건 토스트를 표시
2. `connect_error` 핸들러 부재로 연결 실패 원인 피드백 없음
3. `reconnectionAttempts: Infinity`로 무한 재연결 루프
4. CORS origin 불일치 (로컬 네트워크 IP 접근 시)
