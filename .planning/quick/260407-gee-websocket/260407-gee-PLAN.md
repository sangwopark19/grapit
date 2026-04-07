---
phase: quick-260407-gee
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/lib/socket-client.ts
  - apps/web/hooks/use-socket.ts
  - apps/api/src/modules/booking/booking.gateway.ts
autonomous: true
must_haves:
  truths:
    - "서버 미실행 상태에서 예매 페이지 진입 시 토스트가 1회만 표시된다"
    - "서버 실행 중 연결 성공 후 끊어졌을 때만 '연결 끊김' 토스트가 표시된다"
    - "재연결 최대 횟수 초과 시 '재연결 실패' 안내 토스트가 1회 표시된다"
    - "로컬 네트워크 IP(192.168.x.x:3000)에서 접근해도 WebSocket CORS 오류가 발생하지 않는다"
  artifacts:
    - path: "apps/web/lib/socket-client.ts"
      provides: "reconnectionAttempts 제한된 Socket.IO 클라이언트"
      contains: "reconnectionAttempts: 10"
    - path: "apps/web/hooks/use-socket.ts"
      provides: "connect_error, reconnect_failed 핸들러 및 disconnect 조건부 토스트"
      contains: "connect_error"
    - path: "apps/api/src/modules/booking/booking.gateway.ts"
      provides: "개발 환경 다중 origin CORS 지원"
  key_links:
    - from: "apps/web/lib/socket-client.ts"
      to: "apps/web/hooks/use-socket.ts"
      via: "createBookingSocket() 호출"
      pattern: "createBookingSocket"
    - from: "apps/web/hooks/use-socket.ts"
      to: "apps/api/src/modules/booking/booking.gateway.ts"
      via: "Socket.IO WebSocket 연결"
      pattern: "connect_error|disconnect|reconnect_failed"
---

<objective>
예매하기 페이지 WebSocket 재연결 토스트 반복 노출 버그 수정

Purpose: 서버 미실행 또는 네트워크 불안정 시 "실시간 연결이 끊어졌습니다" 토스트가 무한 반복되어 UX를 해치는 문제를 해결한다.
Output: 조건부 토스트 표시, 유한 재연결 시도, 개발 환경 CORS 다중 origin 지원
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/lib/socket-client.ts
@apps/web/hooks/use-socket.ts
@apps/api/src/modules/booking/booking.gateway.ts
</context>

<interfaces>
<!-- 현재 코드베이스에서 추출한 핵심 인터페이스 -->

From apps/web/hooks/use-socket.ts:
```typescript
// useBookingStore에서 사용하는 상태
useBookingStore.getState().setConnected(true | false);

// sonner toast API
toast.success(msg, { id, duration });
toast.loading(msg, { id });
toast.error(msg, { id, duration });

// hadPreviousConnection ref는 이미 존재 (line 21)
const hadPreviousConnection = useRef(false);
```

From apps/web/lib/socket-client.ts:
```typescript
export function createBookingSocket(): Socket;
// Socket.IO 클라이언트 옵션: reconnectionAttempts, reconnectionDelay 등
```

From apps/api/src/modules/booking/booking.gateway.ts:
```typescript
@WebSocketGateway({
  namespace: '/booking',
  cors: {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
  },
})
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: socket-client.ts 재연결 횟수 제한 + booking.gateway.ts CORS 다중 origin</name>
  <files>apps/web/lib/socket-client.ts, apps/api/src/modules/booking/booking.gateway.ts</files>
  <action>
1. `apps/web/lib/socket-client.ts` 수정:
   - `reconnectionAttempts: Infinity`를 `reconnectionAttempts: 10`으로 변경
   - 나머지 옵션(transports, withCredentials, autoConnect, reconnection, reconnectionDelay, reconnectionDelayMax)은 그대로 유지

2. `apps/api/src/modules/booking/booking.gateway.ts` CORS origin 수정:
   - 기존 단일 string origin을 함수 기반 dynamic origin으로 변경
   - `process.env.NODE_ENV !== 'production'`일 때 모든 origin 허용 (개발/로컬 네트워크 IP 대응)
   - production에서는 `process.env['FRONTEND_URL']`만 허용
   - 구현 패턴:
     ```typescript
     cors: {
       origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
         const allowedOrigin = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
         if (process.env['NODE_ENV'] !== 'production' || !origin || origin === allowedOrigin) {
           callback(null, true);
         } else {
           callback(new Error('CORS not allowed'));
         }
       },
       credentials: true,
     }
     ```
   - 이 방식으로 192.168.x.x:3000, localhost:3000 등 개발 환경의 모든 네트워크 접근 허용
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20 && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
  - socket-client.ts의 reconnectionAttempts가 10으로 제한됨
  - booking.gateway.ts CORS가 개발 환경에서 모든 origin을 허용하고 프로덕션에서는 FRONTEND_URL만 허용
  - 두 파일 모두 TypeScript 컴파일 에러 없음
  </done>
</task>

<task type="auto">
  <name>Task 2: use-socket.ts disconnect 조건부 토스트 + connect_error/reconnect_failed 핸들러 추가</name>
  <files>apps/web/hooks/use-socket.ts</files>
  <action>
`apps/web/hooks/use-socket.ts`의 useEffect 내부에서 다음 이벤트 핸들러를 수정/추가한다.

1. **`disconnect` 핸들러 수정** (기존 line 47-51):
   - `hadPreviousConnection.current`를 체크하여, 이전에 한 번이라도 연결 성공한 적이 있을 때만 토스트 표시
   - 수정 후:
     ```typescript
     socket.on('disconnect', () => {
       useBookingStore.getState().setConnected(false);
       if (hadPreviousConnection.current) {
         toast.loading('실시간 연결이 끊어졌습니다. 재연결 중...', {
           id: 'ws-status',
         });
       }
     });
     ```

2. **`connect_error` 핸들러 추가** (connect 핸들러와 disconnect 핸들러 사이에 배치):
   - 연결 자체가 불가할 때(서버 다운, CORS 거부 등) 호출됨
   - `hadPreviousConnection.current`가 false일 때(초기 연결 시도 실패)만 토스트 표시, 재연결 중에는 disconnect 토스트가 이미 표시되어 있으므로 중복 방지
   - 구현:
     ```typescript
     socket.on('connect_error', () => {
       if (!hadPreviousConnection.current) {
         toast.error('실시간 좌석 업데이트 연결에 실패했습니다', {
           id: 'ws-status',
           duration: 5000,
         });
       }
     });
     ```

3. **`reconnect_failed` 핸들러 추가** (seat-update 핸들러 앞에 배치):
   - Socket.IO의 `io` 레벨 이벤트이므로 `socket.io.on('reconnect_failed', ...)` 사용
   - 재연결 최대 횟수(10회) 초과 시 최종 안내 토스트 표시
   - 구현:
     ```typescript
     socket.io.on('reconnect_failed', () => {
       toast.error('실시간 연결을 복구하지 못했습니다. 페이지를 새로고침해 주세요.', {
         id: 'ws-status',
         duration: Infinity,
       });
     });
     ```
   - 주의: `reconnect_failed`는 Manager 레벨 이벤트이므로 반드시 `socket.io.on()`으로 등록 (socket.on()이 아님)

4. **cleanup 함수**에서 추가된 리스너 정리:
   - 기존 cleanup의 `socket.disconnect()` 호출 전에 `socket.io.off('reconnect_failed')` 추가
   - `socket.disconnect()`가 모든 socket-level 리스너를 정리하므로 connect, disconnect, connect_error, seat-update는 별도 off 불필요
  </action>
  <verify>
    <automated>cd /Users/sangwopark19/icons/grapit && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
  - 서버 미실행 상태에서 예매 페이지 진입 시 connect_error 토스트가 1회만 표시됨 (disconnect 토스트 아님)
  - 서버 실행 중 연결 성공 후 끊어졌을 때만 '실시간 연결이 끊어졌습니다' 토스트 표시
  - 재연결 10회 실패 시 '페이지를 새로고침해 주세요' 토스트가 1회 표시되고 더 이상 재연결 시도 안 함
  - TypeScript 컴파일 에러 없음
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> WS gateway | WebSocket 연결 시 CORS origin 검증 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | S (Spoofing) | booking.gateway.ts CORS | mitigate | 프로덕션에서는 FRONTEND_URL만 허용, 개발 환경에서만 전체 origin 허용 (NODE_ENV 분기) |
| T-quick-02 | D (DoS) | socket-client.ts | mitigate | reconnectionAttempts를 10으로 제한하여 무한 재연결 방지 |
</threat_model>

<verification>
1. TypeScript 컴파일: `npx tsc --noEmit -p apps/web/tsconfig.json` 및 `npx tsc --noEmit -p apps/api/tsconfig.json` 에러 없음
2. 수동 확인: API 서버 미실행 상태에서 예매 페이지 진입 -> 토스트 1회만 표시 확인
3. 수동 확인: API 서버 실행 상태에서 예매 페이지 진입 -> 연결 성공 -> 서버 중지 -> '연결 끊김' 토스트 -> 서버 재시작 -> '연결 복구' 토스트
</verification>

<success_criteria>
- 서버 미실행 시 예매 페이지에서 토스트가 무한 반복되지 않음
- disconnect 토스트는 이전 연결 성공 이력이 있을 때만 표시
- 재연결 최대 10회 후 최종 실패 안내 1회 표시
- 로컬 네트워크 IP에서 WebSocket CORS 오류 없음
- TypeScript 컴파일 에러 없음
</success_criteria>

<output>
After completion, create `.planning/quick/260407-gee-websocket/260407-gee-SUMMARY.md`
</output>
