# Phase 3: Seat Map + Real-Time - Research

**Researched:** 2026-04-01
**Domain:** Interactive SVG seat map, WebSocket real-time communication, Redis distributed locking
**Confidence:** HIGH

## Summary

Phase 3 implements the core booking experience: users navigate to `/booking/[performanceId]`, select a date/showtime via calendar, interact with an SVG seat map (zoom/pan/pinch), select up to 4 seats with Redis-backed locking (10 min TTL), and see other users' seat selections in real time via WebSocket. This is the highest-risk phase in the project, combining three technical domains: SVG rendering performance, distributed locking, and real-time broadcasting.

The project stack is fully decided (CLAUDE.md + CONTEXT.md): react-zoom-pan-pinch for SVG interaction, react-day-picker for calendar, Socket.IO + @socket.io/redis-adapter for WebSocket, @upstash/redis for seat locking, ioredis for Socket.IO pub/sub. No library selection decisions remain. The research focus is on correct integration patterns, performance pitfalls, and NestJS module architecture.

**Primary recommendation:** Build in three layers -- (1) backend booking module with Redis locking + WebSocket gateway first, (2) frontend SVG seat map renderer with zoom/pan, (3) real-time integration connecting frontend Socket.IO client to backend gateway. Each layer is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "예매하기" 클릭 시 `/booking/[performanceId]` 별도 페이지로 이동 (NOL 티켓 방식). 독립된 URL로 돌아가기/공유 가능
- **D-02:** 한 화면에 날짜 선택(react-day-picker 캘린더) + 회차 선택 + SVG 좌석맵을 통합 배치. 상단에 날짜/회차, 아래에 좌석맵
- **D-03:** 좌석 선택 최대 4석 제한 (NOL 티켓/인터파크 기준)
- **D-04:** 데스크톱: 좌석맵 좌측(넓은 영역) + 사이드 패널 우측(공연명, 날짜/회차, 선택 좌석 목록, 합계, 다음 버튼)
- **D-05:** 모바일: 좌석맵 전체 폭 + 하단 바텀시트(드래그로 높이 조절). 좌석 선택 시 바텀시트가 올라옴
- **D-06:** 좌석맵 바로 상단에 등급별 색상 범례(legend) 표시 -- 등급명 + 색상 칩 + 가격
- **D-07:** 기본 팔레트: VIP=#6C3CE0, R=#3B82F6, S=#22C55E, A=#F59E0B. Admin TierEditor에서 변경 가능
- **D-08:** 판매/점유된 좌석은 회색(#D1D5DB)으로 표시. X 마크 없이 회색만
- **D-09:** 내가 선택한 좌석은 등급 색상 유지 + 두꺼운 테두리(stroke) + 체크마크로 강조
- **D-10:** 예매 페이지 상단에 고정 카운트다운 타이머 "남은시간 MM:SS" 상시 표시. 3분 이하 시 빨간색 경고
- **D-11:** 타이머 만료 시 모달 안내 + "처음으로" 버튼으로 좌석 선택 화면 초기화. 연장 없음
- **D-12:** 다른 사용자의 좌석 선택/해제 시 즉시 색상 전환 (애니메이션 없이 즉각 반영)
- **D-13:** 내가 선택하려던 좌석을 다른 사용자가 먼저 점유한 경우 토스트 메시지 안내

### Claude's Discretion
- react-zoom-pan-pinch 컴포넌트 구성 및 줌 레벨/제한 설정
- WebSocket 네임스페이스/룸 설계 (per-showtime room 등)
- Redis 키 구조 (seat lock key format, TTL 관리)
- 좌석맵 SVG 렌더링 최적화 전략 (1000+ seats 모바일 성능)
- 타이머 시작 시점 (첫 좌석 선택 시 vs 페이지 진입 시)
- 바텀시트 구현 방식 (라이브러리 vs 직접 구현)
- "다음" 버튼 클릭 후 Phase 4 연결 지점 (결제 전 확인 화면 등)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEAT-01 | SVG 기반 좌석 배치도가 등급별 색상으로 구분되어 표시 | SVG inline rendering + SeatMapConfig tier color mapping (existing schema) |
| SEAT-02 | 좌석 배치도에서 확대/축소/전체보기 컨트롤 | react-zoom-pan-pinch TransformWrapper + useControls hook |
| SEAT-03 | 모바일에서 핀치 줌/드래그 이동 지원 | react-zoom-pan-pinch built-in pinch/drag (TransformComponent) |
| SEAT-04 | 판매/점유된 좌석 비활성 표시, 선택 불가 | Redis seat state query + SVG fill/cursor/opacity styling |
| SEAT-05 | 선택 좌석 사이드 패널 (등급, 가격 포함) | SeatSelectionPanel (desktop) + SeatSelectionSheet (mobile bottom sheet) |
| SEAT-06 | 타 사용자 좌석 선택/해제 실시간 반영 | Socket.IO WebSocket gateway + per-showtime rooms |
| BOOK-01 | 캘린더에서 예매 가능 날짜 선택 | react-day-picker v9 disabled modifier + showtime date list |
| BOOK-02 | 선택 날짜의 회차 선택 | ShowtimeChips component + showtimes API (existing endpoint) |
| BOOK-03 | 좌석 선택 시 Redis SET NX 10분 임시 점유 | @upstash/redis SET with {nx: true, ex: 600} |
| BOOK-04 | TTL 만료 시 좌석 자동 해제 | Redis key auto-expiry + keyspace notification or client-side timer sync |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- ES modules (import/export), not CommonJS
- Strict typing everywhere -- no `any`, no untyped variables
- Run typecheck after code changes
- Run lint after code changes, fix errors always
- Write tests before implementation for business logic and API code
- Use conventional commits
- Never add Co-Authored-By trailers
- Monorepo root `.env` only (`envFilePath: '../../.env'` in ConfigModule)
- Drizzle ORM (not TypeORM/Prisma), zod (not class-validator)
- vitest (not Jest)
- shadcn/ui New York style with Grapit brand colors
- @upstash/redis for seat locking (HTTP), ioredis ONLY for Socket.IO pub/sub (TCP)

## Standard Stack

### Core (Phase 3 New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-zoom-pan-pinch | 3.7.0 | SVG seat map zoom/pan/pinch | Only mature React zoom lib with hooks API. TransformWrapper + TransformComponent + useControls |
| react-day-picker | 9.14.0 | Calendar date selection | WCAG 2.1 AA, custom modifiers (disabled/available/sold-out), Tailwind-friendly CSS |
| socket.io-client | 4.8.3 | Frontend WebSocket client | Pairs with NestJS @nestjs/platform-socket.io. Auto-reconnect, rooms, namespaces |
| @nestjs/websockets | 11.1.17 | WebSocket gateway framework | Official NestJS WebSocket module. @WebSocketGateway, @SubscribeMessage decorators |
| @nestjs/platform-socket.io | 11.1.17 | Socket.IO adapter for NestJS | Official Socket.IO platform adapter. Rooms, namespaces, Redis adapter support |
| socket.io | 4.8.3 | WebSocket server (peer dep) | Required peer dependency for @nestjs/platform-socket.io |
| @socket.io/redis-adapter | 8.3.0 | Multi-instance WebSocket broadcast | Redis pub/sub relay for Cloud Run horizontal scaling |
| @upstash/redis | 1.37.0 | Redis client (seat locking) | HTTP-based, serverless-friendly. SET NX + EX for atomic locking |
| ioredis | 5.10.1 | Redis client (Socket.IO pub/sub) | TCP-based. Required for @socket.io/redis-adapter persistent pub/sub connections |

### Already Installed (Reused)

| Library | Version | Purpose |
|---------|---------|---------|
| @tanstack/react-query | 5.95.x | Server state (showtimes, seat status queries) |
| zustand | 5.0.x | Client state (selected seats, timer, booking flow) |
| zod | 3.25.x (api) / 4.3.x (web) | Validation schemas |
| drizzle-orm | 0.45.x | Database queries |
| sonner | 2.0.x | Toast notifications |
| lucide-react | 1.7.x | Icons (Clock, AlertTriangle, Plus, Minus, Maximize2, X, ChevronLeft, Check) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-zoom-pan-pinch | Custom pinch/zoom via CSS transform | 2-3 weeks extra work, mobile edge cases |
| Inline SVG rendering | Canvas (Konva/Pixi) | Better for 3000+ seats but requires complete rewrite of SVG pipeline |
| shadcn Sheet for bottom sheet | react-bottom-sheet (npm) | Extra dependency; Sheet + custom drag handle sufficient for MVP |
| Redis keyspace notifications for TTL | Client-side timer only | Keyspace notifications add complexity; client timer + API fallback sufficient |

**Installation (frontend -- apps/web):**
```bash
pnpm --filter @grapit/web add react-zoom-pan-pinch@^3.7.0 react-day-picker@^9.14.0 socket.io-client@^4.8.3
```

**Installation (backend -- apps/api):**
```bash
pnpm --filter @grapit/api add @nestjs/websockets@^11.1.17 @nestjs/platform-socket.io@^11.1.17 socket.io@^4.8.3 @socket.io/redis-adapter@^8.3.0 @upstash/redis@^1.37.0 ioredis@^5.10.1
```

**Dev dependencies (backend types):**
```bash
pnpm --filter @grapit/api add -D @types/ioredis
```

## Architecture Patterns

### Recommended Project Structure

**Backend (apps/api/src/):**
```
modules/
├── booking/
│   ├── booking.module.ts          # Module registration
│   ├── booking.controller.ts      # REST endpoints (seat lock/unlock, seat status)
│   ├── booking.service.ts         # Business logic (lock acquisition, validation)
│   ├── booking.gateway.ts         # WebSocket gateway (@WebSocketGateway)
│   ├── dto/
│   │   ├── lock-seat.dto.ts       # Zod schema for seat lock request
│   │   └── seat-status.dto.ts     # Zod schema for seat status response
│   └── providers/
│       ├── redis.provider.ts      # @upstash/redis + ioredis providers
│       └── redis-io.adapter.ts    # Socket.IO Redis adapter
├── (existing modules...)
config/
├── redis.config.ts                # Redis connection config (new)
```

**Frontend (apps/web/):**
```
app/
├── booking/
│   └── [performanceId]/
│       └── page.tsx               # Booking page (standalone layout, no GNB/Footer)
components/
├── booking/
│   ├── booking-page.tsx           # Main orchestrator (client component)
│   ├── date-picker.tsx            # react-day-picker wrapper
│   ├── showtime-chips.tsx         # Showtime selection chips
│   ├── seat-map-viewer.tsx        # SVG renderer + react-zoom-pan-pinch
│   ├── seat-map-controls.tsx      # Zoom in/out/reset buttons
│   ├── seat-legend.tsx            # Tier color legend bar
│   ├── seat-selection-panel.tsx   # Desktop side panel
│   ├── seat-selection-sheet.tsx   # Mobile bottom sheet
│   ├── seat-row.tsx               # Single seat item in selection list
│   ├── booking-header.tsx         # Sticky header with title + timer
│   ├── countdown-timer.tsx        # MM:SS countdown with color state
│   └── timer-expired-modal.tsx    # Non-dismissible AlertDialog
hooks/
├── use-booking.ts                 # React Query hooks (showtimes, seat status)
├── use-socket.ts                  # Socket.IO connection management
├── use-countdown.ts               # Countdown timer logic
stores/
├── use-booking-store.ts           # Zustand store (selected seats, showtime, timer)
lib/
├── socket-client.ts               # Socket.IO client singleton
```

### Pattern 1: WebSocket Gateway with Room-Based Broadcasting

**What:** NestJS WebSocket gateway using Socket.IO rooms scoped to individual showtimes. Each showtime gets a room `showtime:{showtimeId}`, and seat state changes broadcast only to users viewing that showtime.

**When to use:** All real-time seat status updates (SEAT-06).

```typescript
// apps/api/src/modules/booking/booking.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/booking',
  cors: {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    // Client joins showtime room on connect
  }

  handleDisconnect(client: Socket): void {
    // Clean up: release any locked seats for this client
  }

  @SubscribeMessage('join-showtime')
  handleJoinShowtime(
    @ConnectedSocket() client: Socket,
    @MessageBody() showtimeId: string,
  ): void {
    client.join(`showtime:${showtimeId}`);
  }

  // Called by BookingService after successful seat lock/unlock
  broadcastSeatUpdate(
    showtimeId: string,
    seatId: string,
    status: 'locked' | 'released' | 'sold',
  ): void {
    this.server
      .to(`showtime:${showtimeId}`)
      .emit('seat-update', { seatId, status });
  }
}
```

### Pattern 2: Redis Seat Locking with @upstash/redis

**What:** Atomic seat locking using Redis SET NX with 600-second TTL. Key format: `seat:{showtimeId}:{seatId}`. Value: `userId`. Returns null on conflict (seat already locked).

**When to use:** BOOK-03, BOOK-04.

```typescript
// Seat lock key pattern
const lockKey = `seat:${showtimeId}:${seatId}`;

// Acquire lock (atomic)
const result = await redis.set(lockKey, userId, { nx: true, ex: 600 });
// result === 'OK' means lock acquired, null means already locked

// Release lock (only if owner)
const owner = await redis.get(lockKey);
if (owner === userId) {
  await redis.del(lockKey);
}

// Get all locked seats for a showtime (batch)
// Use SCAN or maintain a Set of locked seat IDs
const lockedKey = `locked-seats:${showtimeId}`;
await redis.sadd(lockedKey, seatId);  // on lock
await redis.srem(lockedKey, seatId);  // on release
const lockedSeats = await redis.smembers(lockedKey);
```

### Pattern 3: SVG Inline Rendering with Seat State Overlay

**What:** Fetch SVG from R2 URL as text, parse it, inject as dangerouslySetInnerHTML into a container div, then use querySelectorAll('[data-seat-id]') to apply seat states (fill color, cursor, event listeners).

**When to use:** SEAT-01, SEAT-04.

```typescript
// Fetch SVG, parse, render inline
const response = await fetch(svgUrl);
const svgText = await response.text();

// In React component
const svgContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!svgContainerRef.current) return;
  svgContainerRef.current.innerHTML = svgText;

  const svgElement = svgContainerRef.current.querySelector('svg');
  if (!svgElement) return;

  // Apply seat states
  const seatElements = svgElement.querySelectorAll('[data-seat-id]');
  seatElements.forEach((el) => {
    const seatId = el.getAttribute('data-seat-id');
    if (!seatId) return;
    const state = seatStates.get(seatId);
    applySeatStyle(el as SVGElement, state, tierColorMap);
  });
}, [svgText, seatStates]);
```

### Pattern 4: Zustand Booking Store

**What:** Client-side booking state managed by Zustand. Stores selected seats, current showtime, timer state. Decoupled from server state (React Query handles API data).

**When to use:** All client-side booking interactions.

```typescript
// stores/use-booking-store.ts
interface BookingState {
  selectedShowtimeId: string | null;
  selectedDate: Date | null;
  selectedSeats: SeatSelection[];
  timerExpiresAt: number | null;
  isTimerExpired: boolean;

  setShowtime: (id: string | null) => void;
  setDate: (date: Date | null) => void;
  addSeat: (seat: SeatSelection) => void;
  removeSeat: (seatId: string) => void;
  clearSeats: () => void;
  setTimerExpiry: (expiresAt: number) => void;
  expireTimer: () => void;
  resetBooking: () => void;
}
```

### Pattern 5: Socket.IO Client as React Context

**What:** Singleton Socket.IO client instance wrapped in React context. Connected on booking page mount, disconnected on unmount. Provides `useSocket()` hook for components.

```typescript
// lib/socket-client.ts
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export function createBookingSocket(): Socket {
  return io(`${API_URL}/booking`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: false,
  });
}

// hooks/use-socket.ts
export function useBookingSocket(showtimeId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!showtimeId) return;

    const socket = createBookingSocket();
    socketRef.current = socket;
    socket.connect();
    socket.emit('join-showtime', showtimeId);

    socket.on('seat-update', (data: { seatId: string; status: string }) => {
      // Update seat state in query cache or Zustand
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [showtimeId]);

  return socketRef;
}
```

### Anti-Patterns to Avoid

- **Rendering SVG as React components (per-seat):** Creating a React component per seat (1000+ components) causes severe re-render performance issues. Use a single SVG container with imperative DOM manipulation for seat state updates.
- **Polling for seat status instead of WebSocket:** Polling creates unnecessary server load and lag. WebSocket push is the correct pattern for real-time seat updates.
- **Storing seat lock state in PostgreSQL:** Redis SET NX is orders of magnitude faster than DB row locks for this use case. PostgreSQL is for final reservation records only.
- **Using @upstash/redis for Socket.IO adapter:** @upstash/redis is HTTP-based and cannot support pub/sub persistent connections. Use ioredis for Socket.IO adapter only.
- **Putting booking logic in RSC (Server Components):** The booking page is inherently interactive (zoom, click, WebSocket). It must be a client component. Use RSC only for the page shell (metadata, initial data fetch).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG zoom/pan/pinch | Custom touch event handlers with CSS transform | react-zoom-pan-pinch TransformWrapper | Pinch zoom on mobile has 20+ edge cases (two-finger detection, momentum, bounds) |
| Calendar with disabled dates | Custom date grid with date-fns | react-day-picker with disabled modifier | WCAG compliance, keyboard navigation, locale support all built in |
| WebSocket reconnection | Custom reconnect loop with exponential backoff | Socket.IO client auto-reconnect | Socket.IO handles disconnection detection, backoff, resubscription to rooms |
| Distributed lock with TTL | Custom Redis Lua script | @upstash/redis SET {nx, ex} | Single atomic command, no race conditions, TTL auto-release |
| Bottom sheet drag behavior | Custom touch event + CSS transform animation | shadcn Sheet component + drag handle CSS | Sheet provides accessibility, focus trapping, backdrop. Add drag-to-resize with a thin CSS layer |
| Multi-instance WebSocket relay | Custom Redis pub/sub message forwarding | @socket.io/redis-adapter | Handles room sync, disconnect detection, message serialization across instances |

**Key insight:** Each of these problems has well-known edge cases that consume 1-2 weeks to solve from scratch. The libraries handle them reliably.

## Common Pitfalls

### Pitfall 1: SVG Performance with 1000+ Seats on Mobile

**What goes wrong:** Rendering 1000+ interactive SVG elements in React causes slow initial render and janky interactions on mobile devices, especially with re-renders on seat state changes.
**Why it happens:** Each seat element in the DOM has event listeners, fill attributes, and style recalculations. React re-rendering the entire SVG tree on any state change is expensive.
**How to avoid:**
1. Use `dangerouslySetInnerHTML` for initial SVG injection (one DOM operation)
2. Apply seat state changes via direct DOM manipulation (`element.setAttribute('fill', color)`) instead of React re-renders
3. Wrap the SVG container with `React.memo` to prevent parent re-renders from cascading
4. Use event delegation: one click handler on the SVG container, identify seats via `event.target.closest('[data-seat-id]')`
5. For very large venues (2000+ seats), consider virtualizing seats outside the visible viewport
**Warning signs:** FPS drops below 30 on mobile during zoom/pan, seat click delay > 200ms

### Pitfall 2: Race Condition Between Redis Lock and WebSocket Broadcast

**What goes wrong:** User A locks a seat, broadcast goes to all users, but User B clicks the same seat in the milliseconds between User A's lock and the broadcast arriving.
**Why it happens:** WebSocket broadcast has ~50-100ms latency. The UI shows the seat as available until the broadcast arrives.
**How to avoid:**
1. **Optimistic locking on click:** Immediately show the seat as "pending" (gray + spinner or subtle animation) on click, before the API response
2. **API response is source of truth:** If lock fails (409 Conflict), revert the optimistic update and show toast (D-13)
3. **WebSocket broadcast confirms:** Other users see the update via broadcast, but the clicking user already has the API response
**Warning signs:** Multiple users able to select the same seat momentarily

### Pitfall 3: Timer Desync Between Client and Server

**What goes wrong:** Client-side countdown timer shows 3:00 remaining, but Redis TTL already expired because the client clock was ahead.
**Why it happens:** `Date.now()` on the client may differ from the server time by seconds or minutes. The 10-minute TTL starts server-side.
**How to avoid:**
1. Server returns `expiresAt` timestamp (Unix ms) when lock is acquired
2. Client calculates remaining = `expiresAt - Date.now()` for display
3. Before timer hits 0, client sends a "heartbeat" to verify lock is still active
4. If lock expired server-side but timer shows remaining time, the API call to proceed will fail gracefully
**Warning signs:** Users report "time expired" messages with time still showing on timer

### Pitfall 4: WebSocket Connection on Cloud Run Cold Start

**What goes wrong:** Cloud Run instance scales from 0 to 1. The WebSocket connection attempt during cold start fails or times out.
**Why it happens:** Cloud Run cold start can take 3-10 seconds for NestJS. WebSocket upgrade request during this window may fail.
**How to avoid:**
1. Socket.IO client has automatic reconnection with exponential backoff (default behavior)
2. Show "실시간 연결이 끊어졌습니다. 재연결 중..." toast on disconnect (from UI-SPEC)
3. On reconnect, re-emit `join-showtime` and fetch full seat state via REST API to reconcile
4. Consider `min-instances: 1` for the API service in production to avoid cold starts
**Warning signs:** "Connection failed" errors in the console after deploy, users see stale seat states

### Pitfall 5: LayoutShell Hiding GNB/Footer for Booking Page

**What goes wrong:** The booking page shows GNB and Footer because the LayoutShell only checks for `/admin` prefix.
**Why it happens:** Current LayoutShell (`layout-shell.tsx`) only hides GNB/Footer for `pathname.startsWith('/admin')`. The booking page at `/booking/[performanceId]` is not excluded.
**How to avoid:** Update `LayoutShell` to also exclude `/booking` routes:
```typescript
const isAdmin = pathname.startsWith('/admin');
const isBooking = pathname.startsWith('/booking');
const hideShell = isAdmin || isBooking;
```
**Warning signs:** GNB visible on booking page during development

### Pitfall 6: Missing seat_inventories Table

**What goes wrong:** The architecture document defines a `seat_inventories` table (per-showtime seat tracking), but the current Drizzle schema does not include it. Without this table, there is no way to track which seats are sold vs available per showtime.
**Why it happens:** Phase 2 only needed seat_maps (SVG upload) and showtimes. The per-showtime seat inventory was not needed until booking.
**How to avoid:** Create `seat_inventories` Drizzle schema in this phase:
- Columns: `id`, `showtimeId`, `seatId` (from SVG data-seat-id), `status` (available/locked/sold), `lockedBy` (userId), `lockedUntil` (timestamp)
- Unique constraint on `(showtimeId, seatId)` for concurrent safety
- The "sold" status is the permanent record; "locked" is only relevant during booking flow (Redis is primary lock, DB is secondary for crash recovery)
**Warning signs:** No way to persist sold seats between Redis TTL cycles

## Code Examples

### react-zoom-pan-pinch: SVG Seat Map Wrapper

```typescript
// Source: react-zoom-pan-pinch npm docs + GitHub README
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from 'react-zoom-pan-pinch';

function SeatMapControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2">
      <button onClick={() => zoomIn()} aria-label="확대">
        <Plus className="h-5 w-5" />
      </button>
      <button onClick={() => zoomOut()} aria-label="축소">
        <Minus className="h-5 w-5" />
      </button>
      <button onClick={() => resetTransform()} aria-label="전체보기">
        <Maximize2 className="h-5 w-5" />
      </button>
    </div>
  );
}

function SeatMapViewer({ svgUrl }: { svgUrl: string }) {
  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={3}
      wheel={{ step: 0.1 }}
      pinch={{ step: 5 }}
      doubleClick={{ mode: 'toggle' as const }}
    >
      <SeatMapControls />
      <TransformComponent
        wrapperClass="w-full h-full"
        contentClass="w-full h-full"
      >
        {/* SVG content rendered here */}
        <div ref={svgContainerRef} />
      </TransformComponent>
    </TransformWrapper>
  );
}
```

**Note:** `useControls()` must be called inside `TransformWrapper` children. SeatMapControls is a child component.

### react-day-picker: Booking Calendar

```typescript
// Source: daypicker.dev/guides/custom-modifiers, daypicker.dev/selections/disabling-dates
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

function DatePicker({
  availableDates,
  selected,
  onSelect,
}: {
  availableDates: Date[];
  selected: Date | null;
  onSelect: (date: Date) => void;
}) {
  // Only enable dates that have showtimes
  const availableSet = new Set(
    availableDates.map((d) => d.toDateString()),
  );

  return (
    <DayPicker
      mode="single"
      selected={selected ?? undefined}
      onSelect={(day) => day && onSelect(day)}
      disabled={(date) => !availableSet.has(date.toDateString())}
      modifiers={{
        available: availableDates,
      }}
      modifiersClassNames={{
        available: 'rdp-day_available',
      }}
      locale={ko} // from date-fns/locale/ko
    />
  );
}
```

### NestJS Redis Adapter for Socket.IO

```typescript
// Source: NestJS sample 02-gateways + Socket.IO Redis adapter docs
// apps/api/src/modules/booking/providers/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): unknown {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

// main.ts integration
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);
  // ... rest of bootstrap
}
```

### @upstash/redis: Seat Lock Service

```typescript
// Source: Upstash docs + Redis SET NX pattern
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env['UPSTASH_REDIS_REST_URL']!,
  token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
});

async function lockSeat(
  showtimeId: string,
  seatId: string,
  userId: string,
): Promise<{ success: boolean; expiresAt: number }> {
  const key = `seat:${showtimeId}:${seatId}`;
  const ttl = 600; // 10 minutes

  const result = await redis.set(key, userId, { nx: true, ex: ttl });

  if (result === 'OK') {
    // Track locked seats in a Set for bulk queries
    await redis.sadd(`locked:${showtimeId}`, seatId);
    return {
      success: true,
      expiresAt: Date.now() + ttl * 1000,
    };
  }

  return { success: false, expiresAt: 0 };
}

async function unlockSeat(
  showtimeId: string,
  seatId: string,
  userId: string,
): Promise<boolean> {
  const key = `seat:${showtimeId}:${seatId}`;
  const owner = await redis.get<string>(key);

  if (owner !== userId) return false;

  await redis.del(key);
  await redis.srem(`locked:${showtimeId}`, seatId);
  return true;
}

async function getLockedSeats(showtimeId: string): Promise<string[]> {
  return redis.smembers(`locked:${showtimeId}`);
}
```

## Discretion Recommendations

### Timer Start Point
**Recommendation: Start on first seat selection.** The 10-minute timer begins when the first seat is locked (Redis TTL starts then). Showing a timer before any seat is selected creates unnecessary pressure. This matches NOL ticket behavior.

### WebSocket Namespace/Room Design
**Recommendation: `/booking` namespace + `showtime:{showtimeId}` rooms.**
- Namespace `/booking` separates booking WebSocket traffic from future features (chat, notifications)
- Room `showtime:{showtimeId}` scopes broadcasts to users viewing the same showtime
- Client emits `join-showtime` on showtime selection, `leave-showtime` on change

### Redis Key Structure
**Recommendation:**
```
seat:{showtimeId}:{seatId}     = userId     (TTL 600s)  -- individual seat lock
locked:{showtimeId}            = Set{seatIds}            -- fast bulk query
user-locks:{userId}            = Set{seat keys}          -- cleanup on disconnect
```

### SVG Rendering Optimization (1000+ seats)
**Recommendation: Imperative DOM manipulation, not React reconciliation.**
1. Fetch SVG text from R2 URL
2. Insert via `innerHTML` (one DOM operation)
3. Use `querySelectorAll('[data-seat-id]')` to build a seatId-to-element Map
4. On state change, update only affected elements' `fill`, `stroke`, `cursor`, `opacity`
5. Use event delegation (single click handler on SVG container)
6. Wrap in `React.memo` to prevent parent re-renders

### Bottom Sheet Implementation
**Recommendation: Use shadcn Sheet (already installed) with custom collapsed/expanded logic.**
Sheet provides dialog-like accessibility (focus trap, escape, backdrop). Add a collapsed state (72px summary bar) using CSS max-height transition. No extra library needed.

### "Next" Button Destination
**Recommendation: Navigate to `/booking/[performanceId]/confirm` (confirmation page before payment).** This page shows a final summary (selected seats, total price, user info) and the "결제하기" button that triggers Phase 4 payment flow. This is a natural handoff point.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-zoom-pan-pinch v2 (class-based) | v3 hooks API (useControls) | v3.0.0 (2023) | useControls hook only works inside TransformWrapper children |
| socket.io-redis (deprecated) | @socket.io/redis-adapter v8 | 2022 | New package name, new API with createAdapter() |
| DayPicker v8 | DayPicker v9 (CSS Variables, WCAG 2.1) | 2024 | New CSS customization, improved accessibility |
| NestJS 10 @WebSocketGateway | NestJS 11 (same API) | Jan 2025 | No breaking changes for WebSocket gateway |
| @upstash/redis v1.x | v1.37.0 (stable) | Ongoing | SET with {nx, ex} options syntax stable |

**Deprecated/outdated:**
- `socket.io-redis` npm package: replaced by `@socket.io/redis-adapter`
- `@tosspayments/sdk`: replaced by `@tosspayments/tosspayments-sdk` (relevant for Phase 4)

## Open Questions

1. **Redis Keyspace Notifications for TTL Expiry**
   - What we know: Redis supports keyspace notifications (`__keyevent@0__:expired`) to detect key expiry
   - What's unclear: Whether Upstash Redis supports keyspace notifications (it may not for serverless tier). ioredis can subscribe but adds complexity
   - Recommendation: Skip keyspace notifications for MVP. Use client-side timer as primary UX. The `locked:{showtimeId}` Set will have stale entries for expired seats -- clean up lazily on next seat status query by checking individual key existence

2. **Seat Inventory Initialization**
   - What we know: Each showtime needs a `seat_inventories` record per seat. The seat list comes from the SVG `data-seat-id` attributes
   - What's unclear: When to initialize these records -- on showtime creation (Admin Phase 2) or lazily on first booking page visit?
   - Recommendation: Initialize lazily on first `GET /schedules/:id/seats` call. If no inventory records exist, create them from the seat_maps.seatConfig.tiers[].seatIds. This avoids Admin UI changes and keeps Phase 2 untouched

3. **Cloud Run Sticky Sessions**
   - What we know: Socket.IO docs say sticky sessions are required even with Redis adapter to avoid HTTP 400 errors during WebSocket upgrade
   - What's unclear: Cloud Run may handle this differently with its built-in session affinity
   - Recommendation: Configure Cloud Run session affinity (available in Cloud Run settings) and set Socket.IO transports to `['websocket']` only (skip polling) to avoid the sticky session requirement for HTTP long-polling

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | 22.x | -- |
| pnpm | Package management | Yes | 10.28.x | -- |
| PostgreSQL | seat_inventories table | Yes (Cloud SQL, via .env) | 16 | -- |
| Upstash Redis | Seat locking | No (requires UPSTASH_REDIS_REST_URL in .env) | Serverless | Dev mock: in-memory Map with setTimeout for TTL |
| Redis (TCP) | Socket.IO adapter | No (requires REDIS_URL in .env) | -- | Dev mode: skip Redis adapter, use default in-memory adapter (single instance only) |

**Missing dependencies with fallback:**
- **Upstash Redis:** Not available in local dev without account setup. Create a mock Redis provider for development that uses in-memory Map + setTimeout for TTL simulation. Tests should use this mock.
- **Redis (TCP for ioredis):** Not available locally unless Redis is installed. In development, skip the Redis IO adapter and use the default Socket.IO in-memory adapter. This means multi-instance broadcast won't work in dev, but single-instance is sufficient for development.

**Environment variables needed (add to .env.example):**
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
REDIS_URL=
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file (api) | `apps/api/vitest.config.ts` |
| Config file (web) | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/api exec vitest run --reporter=verbose` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEAT-01 | SVG seats colored by tier | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/seat-map-viewer.test.tsx` | Wave 0 |
| SEAT-02 | Zoom controls work | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/seat-map-controls.test.tsx` | Wave 0 |
| SEAT-03 | Pinch zoom on mobile | manual-only | Manual test on mobile device | N/A |
| SEAT-04 | Sold/locked seats disabled | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/seat-map-viewer.test.tsx` | Wave 0 |
| SEAT-05 | Selection panel shows seat info | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/seat-selection-panel.test.tsx` | Wave 0 |
| SEAT-06 | Real-time seat updates via WebSocket | integration | `pnpm --filter @grapit/api exec vitest run src/modules/booking/booking.gateway.spec.ts` | Wave 0 |
| BOOK-01 | Calendar disables unavailable dates | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/date-picker.test.tsx` | Wave 0 |
| BOOK-02 | Showtime chips filter by date | unit | `pnpm --filter @grapit/web exec vitest run src/components/booking/showtime-chips.test.tsx` | Wave 0 |
| BOOK-03 | Redis SET NX locks seat for 10 min | unit | `pnpm --filter @grapit/api exec vitest run src/modules/booking/booking.service.spec.ts` | Wave 0 |
| BOOK-04 | Lock auto-releases on TTL expiry | unit | `pnpm --filter @grapit/api exec vitest run src/modules/booking/booking.service.spec.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/api exec vitest run && pnpm --filter @grapit/web exec vitest run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/booking/booking.service.spec.ts` -- covers BOOK-03, BOOK-04 (Redis lock logic)
- [ ] `apps/api/src/modules/booking/booking.gateway.spec.ts` -- covers SEAT-06 (WebSocket broadcast)
- [ ] `apps/web/components/booking/seat-map-viewer.test.tsx` -- covers SEAT-01, SEAT-04 (seat rendering)
- [ ] `apps/web/components/booking/date-picker.test.tsx` -- covers BOOK-01 (calendar disabled dates)
- [ ] `apps/web/components/booking/showtime-chips.test.tsx` -- covers BOOK-02
- [ ] `apps/web/components/booking/seat-selection-panel.test.tsx` -- covers SEAT-05
- [ ] `apps/web/components/booking/seat-map-controls.test.tsx` -- covers SEAT-02
- [ ] Mock Redis provider for unit tests (in-memory Map + setTimeout TTL)
- [ ] Framework install: `pnpm --filter @grapit/api add @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter @upstash/redis ioredis` and `pnpm --filter @grapit/web add react-zoom-pan-pinch react-day-picker socket.io-client`

## Sources

### Primary (HIGH confidence)
- react-zoom-pan-pinch [npm](https://www.npmjs.com/package/react-zoom-pan-pinch) + [GitHub](https://github.com/BetterTyped/react-zoom-pan-pinch) - v3.7.0, TransformWrapper/useControls API
- react-day-picker [official docs](https://daypicker.dev/) - v9.14.0, disabled modifiers, custom modifiers
- Socket.IO [Redis adapter docs](https://socket.io/docs/v4/redis-adapter/) - ioredis setup, room broadcasting
- NestJS [WebSocket gateways](https://docs.nestjs.com/websockets/gateways) + [DeepWiki](https://deepwiki.com/nestjs/nest/6.1-socket.io-integration) - @WebSocketGateway, @SubscribeMessage, Redis adapter
- NestJS [sample 02-gateways](https://github.com/nestjs/nest/blob/master/sample/02-gateways/src/adapters/redis-io.adapter.ts) - RedisIoAdapter implementation
- @upstash/redis [npm](https://www.npmjs.com/package/@upstash/redis) + [docs](https://upstash.com/docs/redis/sdks/ts/getstarted) - SET {nx, ex} API
- [Upstash distributed locking blog](https://upstash.com/blog/lock) - Lock patterns with @upstash/redis

### Secondary (MEDIUM confidence)
- [SVG seat map case study](https://lavrton.com/case-study-seat-reservation-widget/) - Performance analysis for 1000+ seats
- [Seatmap.pro rendering guide](https://seatmap.pro/blog/seating-plan-rendering/) - SVG vs Canvas tradeoffs
- Socket.IO [React integration guide](https://socket.io/how-to/use-with-react) - Client-side patterns
- [Redis distributed locking](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) - SET NX pattern

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries are locked decisions from CLAUDE.md, versions verified against npm registry
- Architecture: HIGH - patterns follow NestJS official examples and existing codebase conventions
- Pitfalls: HIGH - based on SVG performance studies, Socket.IO docs, and Redis locking documentation
- WebSocket on Cloud Run: MEDIUM - sticky session behavior needs runtime verification

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable libraries, no major releases expected)
