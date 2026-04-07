# Quick Task 260407-gru: confirm 페이지 이동 시 disconnect 토스트 노출 방지

**Completed:** 2026-04-07
**Commit:** ed8dc53

## Root Cause

좌석 선택 페이지에서 `/booking/:id/confirm`으로 `router.push` 네비게이션 시:
1. useEffect cleanup에서 `socket.disconnect()` 호출
2. `disconnect` 이벤트 핸들러가 동기적으로 실행됨
3. 이 시점에 `hadPreviousConnection.current`가 아직 `true` (cleanup에서 false 설정 전)
4. → "실시간 연결이 끊어졌습니다. 재연결 중..." 토스트 표시

## Fix

`disconnect` 핸들러에서 Socket.IO `reason` 파라미터 체크 추가:
- `reason === 'io client disconnect'`: 클라이언트가 의도적으로 끊음 (페이지 이동) → 토스트 미표시
- 그 외 (transport close, ping timeout 등): 비정상 연결 끊김 → 토스트 표시

## Changed File

- `apps/web/hooks/use-socket.ts`: `disconnect` 핸들러에 `reason !== 'io client disconnect'` 조건 추가
