# Architecture Patterns

**Domain:** Ticket booking platform (live entertainment)
**Researched:** 2026-03-27

---

## Recommended Architecture

### High-Level Overview

```
[Browser] -> [Cloudflare CDN/WAF] -> [Cloud Run: web (Next.js 16)]
                                  -> [Cloud Run: api (NestJS 11)]
                                       |         |          |
                                  [Cloud SQL]  [Upstash]  [R2]
                                  PostgreSQL    Redis     Storage
```

Two Cloud Run services in a single GCP project (asia-northeast3, Seoul):
- **web**: Next.js 16 standalone container. SSR pages, static generation, BFF pattern for API calls.
- **api**: NestJS 11 modular monolith. REST API + WebSocket gateway + pg-boss worker in a single process.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Next.js (web) | SSR/SSG pages, client-side React, BFF for API calls | NestJS API via HTTP, Sentry |
| NestJS API (api) | Business logic, auth, REST endpoints | PostgreSQL, Redis, R2, Toss Payments, Sentry |
| NestJS WebSocket Gateway | Real-time seat status broadcast | Redis pub/sub (via ioredis), browser clients (via Socket.IO) |
| pg-boss Worker | Async jobs (notifications, email, settlement) | PostgreSQL (same DB, SKIP LOCKED) |
| PostgreSQL | Persistent data, search (tsvector), job queue (pg-boss) | N/A (passive) |
| Upstash Redis | Seat locks, queue position, ranking cache, pub/sub | N/A (passive) |
| Cloudflare R2 | Posters, SVG seat maps, static assets | N/A (passive, S3 API) |

### Data Flow: Booking Transaction

```
1. User selects seat (click on SVG element)
2. Frontend -> POST /api/v1/seats/lock { seatId, scheduleId }
3. NestJS BookingModule -> Redis SET NX seat:{scheduleId}:{seatId} = userId (EX 600)
   - SUCCESS: return lockId + 10min timer
   - FAIL: return "seat already taken"
4. NestJS -> Redis PUBLISH seat-updates:{scheduleId} { seatId, status: "locked" }
5. Socket.IO Redis Adapter -> broadcasts to all connected clients in room
6. Other users' seat maps update (seat turns gray)

7. User clicks "Pay" within 10 minutes
8. Frontend -> POST /api/v1/payments/confirm { paymentKey, orderId, amount }
9. NestJS PaymentModule -> Toss Payments confirm API (server-to-server)
10. NestJS -> PostgreSQL BEGIN TRANSACTION
    - UPDATE seat_inventory SET status='SOLD'
    - INSERT INTO reservations
    - INSERT INTO payments
    COMMIT
11. NestJS -> Redis DEL seat:{scheduleId}:{seatId}
12. NestJS -> Redis PUBLISH seat-updates:{scheduleId} { seatId, status: "sold" }
13. NestJS -> pg-boss: enqueue notification job
14. pg-boss Worker -> Send booking confirmation email
```

---

## Patterns to Follow

### Pattern 1: Modular Monolith with NestJS Modules

**What:** Each domain (auth, booking, payment, performance, venue) is a separate NestJS module with its own service, controller, and entities. Modules communicate via injected services (in-memory function calls), not HTTP.

**When:** Always -- this is the foundational pattern.

**Why:** Single deployment unit eliminates network overhead, serialization, and distributed transaction complexity. Module boundaries still enforce separation of concerns and enable future extraction to microservices if needed.

```typescript
// booking.module.ts
@Module({
  imports: [VenueModule, PaymentModule], // cross-module deps
  controllers: [BookingController],
  providers: [BookingService, SeatLockService],
  exports: [BookingService],
})
export class BookingModule {}
```

### Pattern 2: Drizzle Schema as Single Source of Truth

**What:** Define database tables in Drizzle schema files. Use drizzle-zod to generate Zod validation schemas. Use those Zod schemas for both API DTO validation and frontend form validation.

**When:** Every new table or API endpoint.

**Why:** One schema definition flows to: (1) DB migrations via drizzle-kit, (2) API validation via zod pipe, (3) Frontend validation via shared zod schema. Eliminates class-validator DTOs and keeps types in sync.

```typescript
// schema/performances.ts
export const performances = pgTable('performances', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  genreId: uuid('genre_id').references(() => genres.id),
  startDate: date('start_date').notNull(),
  // ...
});

// Auto-generate Zod schema
export const insertPerformanceSchema = createInsertSchema(performances);
export const selectPerformanceSchema = createSelectSchema(performances);
```

### Pattern 3: Dual Redis Client Pattern

**What:** Use @upstash/redis (HTTP) for all general Redis operations. Use ioredis (TCP) exclusively for Socket.IO Redis adapter pub/sub.

**When:** Any Redis interaction.

**Why:** Upstash HTTP client is serverless-friendly (no connection pool, no idle connections). But Socket.IO Redis adapter requires persistent TCP connections for pub/sub subscriptions. Mixing would either waste connections (ioredis everywhere) or break pub/sub (@upstash/redis everywhere).

```typescript
// General Redis (HTTP)
import { Redis } from '@upstash/redis';
const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
await redis.set(`seat:${scheduleId}:${seatId}`, userId, { nx: true, ex: 600 });

// WebSocket Redis adapter (TCP)
import { createClient } from 'ioredis';
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

### Pattern 4: SVG Seat Map Rendering

**What:** Load SVG seat map data from API. Render as inline SVG (not `<img>` or `<object>`). Each seat is a `<rect>` or `<circle>` with data attributes. Wrap with react-zoom-pan-pinch for gestures. Manage seat state via React state synced with WebSocket.

**When:** Seat selection page (/onestop/seat).

**Why:** Inline SVG allows individual element click handlers, CSS styling per seat state, and React state binding. External SVG references cannot be styled or interacted with.

```tsx
// SeatMap component structure
<TransformWrapper>
  <TransformComponent>
    <svg viewBox="0 0 1000 800">
      {seats.map(seat => (
        <rect
          key={seat.id}
          x={seat.x} y={seat.y}
          width={20} height={20}
          className={seatStateClass(seat.status)}
          onClick={() => handleSeatClick(seat)}
          role="gridcell"
          aria-label={`${seat.row}${seat.number}, ${seat.grade}, ${formatPrice(seat.price)}`}
        />
      ))}
    </svg>
  </TransformComponent>
</TransformWrapper>
```

### Pattern 5: Optimistic UI with TanStack Query

**What:** When a user clicks a seat, immediately show it as "selected" in the UI, then confirm with the server. If server rejects (seat taken), revert the optimistic update.

**When:** Seat selection, any user action that modifies server state.

**Why:** 200-300ms round-trip to server feels slow for seat clicking. Optimistic update makes it feel instant.

```typescript
const lockSeat = useMutation({
  mutationFn: (seatId: string) => api.post('/seats/lock', { seatId }),
  onMutate: async (seatId) => {
    // Optimistic: mark seat as "mine" immediately
    queryClient.setQueryData(['seats', scheduleId], (old) =>
      old.map(s => s.id === seatId ? { ...s, status: 'selected' } : s)
    );
  },
  onError: (err, seatId) => {
    // Revert on failure
    queryClient.invalidateQueries(['seats', scheduleId]);
    toast.error('This seat is already taken');
  },
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Eager Database Connection

**What:** Creating a database connection at module import time (top-level await or constructor).

**Why bad:** In NestJS, module imports happen before environment variables are loaded via @nestjs/config. Eager connections fail silently or crash on startup.

**Instead:** Use async factory providers that resolve after ConfigService is available.

```typescript
// BAD
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));

// GOOD
export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const pool = new Pool({ connectionString: config.get('DATABASE_URL') });
    return drizzle(pool);
  },
};
```

### Anti-Pattern 2: Single Redis Client for Everything

**What:** Using ioredis for both general key/value operations AND WebSocket pub/sub.

**Why bad:** ioredis maintains persistent TCP connections. On Cloud Run (which scales to zero), idle TCP connections are wasteful and may be killed by Upstash's serverless Redis. Also, @upstash/redis HTTP client is more reliable for serverless environments.

**Instead:** Dual client pattern (see Pattern 3 above).

### Anti-Pattern 3: N+1 Queries in Seat Map Loading

**What:** Loading seat map by querying each seat individually or loading seats without joining inventory status.

**Why bad:** A 500-seat venue = 500 queries. Absolutely kills performance on the most critical page.

**Instead:** Single query with JOIN: seats + seat_inventories for the given schedule. Return all data in one API call.

```sql
SELECT s.id, s.row_label, s.seat_number, s.x_position, s.y_position, s.grade,
       si.status, si.price
FROM seats s
JOIN seat_inventories si ON si.seat_id = s.id
WHERE si.schedule_id = $1
ORDER BY s.section, s.row_label, s.seat_number;
```

### Anti-Pattern 4: Storing SVG in Database as Text

**What:** Storing raw SVG XML in a PostgreSQL text column for every seat map.

**Why bad:** SVG files can be 100KB-1MB. Loading from DB adds latency. Cannot be CDN-cached. DB backups bloat.

**Instead:** Store SVG files in Cloudflare R2. Store only the R2 URL in the `seat_maps.svg_url` column. Seat coordinate data (x, y, row, number) lives in the `seats` table. The frontend fetches SVG shell from R2 CDN and overlays seat data from API.

**Note:** The current architecture doc has `svg_data text` in the seat_maps table. This should be changed to `svg_url varchar` pointing to R2.

---

## Scalability Considerations

| Concern | MVP (100 users) | Growth (10K users) | Scale (100K+ concurrent) |
|---------|-----------------|--------------------|----|
| Seat map rendering | Single API call, inline SVG | Same, add CDN caching for SVG shell | Virtualize off-screen seats, lazy-load sections |
| Real-time updates | Single Cloud Run instance, in-memory broadcast | Redis pub/sub + Socket.IO adapter (multi-instance) | Same pattern scales with Redis, add Socket.IO sticky sessions if needed |
| Booking throughput | Sequential Redis SET NX | Same (Redis handles 100K+ ops/sec) | Add queue system (Redis Sorted Set) to gate access |
| Search | PostgreSQL tsvector | Same (GIN index handles millions of rows) | Consider read replica or materialized views |
| Job processing | pg-boss single worker | pg-boss concurrent workers (configurable) | Split to dedicated Cloud Run Job for heavy workloads |
| Database | Single Cloud SQL instance | Enable HA (regional), add read replica | Connection pooling (PgBouncer), sharding only if >10M bookings |
| Cold starts | min-instances=0 (cost savings) | min-instances=1 (eliminate cold start) | min-instances=2-5 based on traffic patterns |

---

## Sources

- [NestJS modular monolith docs](https://docs.nestjs.com/modules)
- [Drizzle ORM + NestJS (Trilon)](https://trilon.io/blog/nestjs-drizzleorm-a-great-match)
- [Scalable WebSockets NestJS + Redis (LogRocket)](https://blog.logrocket.com/scalable-websockets-with-nestjs-and-redis/)
- [NestJS WebSocket gateway docs](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO Redis adapter docs](https://socket.io/docs/v4/redis-adapter/)
- [Cloudflare R2 S3 SDK docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- [react-zoom-pan-pinch docs](https://bettertyped.github.io/react-zoom-pan-pinch/)
- [Cloud Run WebSocket support](https://cloud.google.com/run/docs/triggering/websockets)
- docs/03-ARCHITECTURE.md (existing project architecture)
