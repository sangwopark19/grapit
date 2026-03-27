# Domain Pitfalls

**Domain:** Ticket Booking Platform (Grapit)
**Researched:** 2026-03-27

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture failures.

### Pitfall 1: Double-Booking Race Condition

**What goes wrong:** Two users simultaneously select and pay for the same seat. Both payments succeed, but only one seat exists. Results in overselling and refund nightmares.

**Why it happens:** Checking seat availability and marking it as sold are done as separate operations without atomicity. Or Redis lock exists but DB write does not verify status within a transaction.

**Consequences:** Oversold seats, angry customers, refund costs, reputation damage. This is the single most destructive bug for a ticket platform.

**Prevention:**
1. Redis SET NX (atomic check-and-set) for temporary lock -- first line of defense
2. PostgreSQL UPDATE with WHERE status='AVAILABLE' as the final guard -- even if Redis fails, DB prevents double-write
3. Wrap the entire payment confirmation in a single DB transaction: verify seat status -> update to SOLD -> create reservation -> create payment record
4. Never trust the frontend's claim about seat availability

**Detection:** Monitor for reservation count > seat count per schedule. Alert on any payment confirmation that fails the DB WHERE clause.

### Pitfall 2: Redis Lock Leak (Zombie Locks)

**What goes wrong:** A user locks a seat via Redis SET NX with 10-minute TTL, but the application crashes, deploys, or the user's connection drops before the lock is released or TTL expires. The seat appears locked but nobody is actually booking it.

**Why it happens:** Cloud Run instances can be killed at any time (scale-down, deployment, OOM). Redis TTL is the safety net, but if TTL is too long, seats are blocked unnecessarily.

**Consequences:** Available seats appear unavailable for up to 10 minutes. During high-demand events, this causes perceived sellouts that aren't real.

**Prevention:**
1. Keep TTL at 600 seconds (10 min) -- long enough for payment, short enough for recovery
2. Implement a "heartbeat" from the frontend: extend TTL every 2 minutes while user is on the seat selection page. If heartbeat stops, lock expires faster
3. Provide admin "force unlock" capability for stuck seats
4. On payment timeout (10 min client timer), explicitly DELETE the Redis key rather than waiting for TTL

**Detection:** Monitor Redis keys with pattern `seat:*` -- alert if any key exists beyond expected duration. Log lock creation/deletion pairs.

### Pitfall 3: SVG Seat Map Performance Collapse

**What goes wrong:** Rendering 2000+ SVG seat elements causes the browser to freeze, especially on mobile devices. The seat selection page becomes unusable.

**Why it happens:** Each seat is a DOM element with event listeners, ARIA attributes, and CSS transitions. 2000 DOM nodes with real-time updates = heavy main thread work.

**Consequences:** Page freezes on mobile, users cannot select seats, bookings lost.

**Prevention:**
1. Use CSS `will-change` on the SVG container for GPU compositing
2. Batch WebSocket seat updates: debounce incoming updates and apply in requestAnimationFrame batches, not one-by-one
3. For venues >1500 seats: implement section-level zoom (show sections first, load individual seats only when zoomed in)
4. Use React.memo aggressively on individual seat components -- a seat only re-renders when its own status changes
5. Avoid inline styles on seats; use CSS classes toggled by data-status attribute

**Detection:** Measure First Input Delay (FID) and Interaction to Next Paint (INP) on the seat map page. Alert if INP > 200ms.

### Pitfall 4: Payment State Machine Desync

**What goes wrong:** Payment succeeds at Toss Payments but the booking confirmation fails in your DB (network error, DB timeout, deployment during transaction). The user is charged but has no ticket.

**Why it happens:** Two-phase operations (external payment + internal DB write) without a robust state machine. The Toss Payments "confirm" API is the point of no return -- once called, the charge is real.

**Consequences:** Money charged, no ticket. Customer support nightmare. PG dispute.

**Prevention:**
1. Create a `payments` record with status='PENDING' BEFORE calling Toss confirm
2. Call Toss confirm API (server-to-server)
3. On success: update payment status='COMPLETED' + create reservation in single transaction
4. On failure: update payment status='FAILED' + release seat lock
5. Implement an idempotency check: if the same orderId is confirmed twice, return the existing result
6. pg-boss cron job: scan for PENDING payments older than 15 minutes. Query Toss API for actual status. Reconcile.
7. Never rely on Toss webhook alone -- always do server-to-server verification

**Detection:** Monitor for payments in PENDING status > 5 minutes. Reconciliation job should run every 5 minutes.

---

## Moderate Pitfalls

### Pitfall 5: Cloud Run Cold Start on WebSocket Reconnection

**What goes wrong:** Cloud Run scales to zero. When a new user connects, the instance cold-starts (3-5 seconds). During this time, WebSocket connections fail and seat map shows stale data.

**Prevention:**
1. Set min-instances=1 for the API service once traffic is regular (Phase 2)
2. For MVP (min-instances=0): client-side Socket.IO has automatic reconnection with exponential backoff. Users will see a brief "connecting" state.
3. On reconnection, client must fetch full seat state via REST API, not rely on catching missed WebSocket events
4. Show a clear "Reconnecting..." indicator rather than stale data

### Pitfall 6: Upstash Redis HTTP Latency vs TCP

**What goes wrong:** @upstash/redis uses HTTP, adding 30-50ms per request compared to TCP-based ioredis. For seat locking during high-demand events, this latency compounds.

**Prevention:**
1. Upstash HTTP latency from Cloud Run Seoul to Upstash Seoul edge is typically 5-15ms -- acceptable for seat locking
2. Use Redis pipeline for multi-key operations (lock seat + publish update = 1 round trip instead of 2)
3. If latency becomes an issue at scale: switch to Upstash Redis TCP connection (available but requires persistent connection management)
4. Never chain sequential Redis calls where a pipeline or Lua script would suffice

### Pitfall 7: PostgreSQL Full-Text Search Korean Limitations

**What goes wrong:** The `simple` parser used for tsvector does not do Korean morphological analysis. Searching "뮤지" (partial of "뮤지컬") returns no results via tsvector. Users think search is broken.

**Prevention:**
1. Always combine tsvector search with pg_trgm similarity search as a fallback
2. Search flow: try tsvector first (exact/stemmed match), then fall back to pg_trgm LIKE (partial match), merge results
3. For autocomplete: use pg_trgm exclusively (it handles substrings well)
4. Monitor "zero results" rate. If >15% of searches return nothing, investigate adding textsearch_ko extension or application-level tokenization
5. Cloud SQL for PostgreSQL supports custom extensions but textsearch_ko (mecab-based) may not be available. Verify before depending on it.

### Pitfall 8: Drizzle ORM Migration Workflow Missteps

**What goes wrong:** `drizzle-kit generate` creates migration files from schema diff, but if you modify generated SQL files manually and regenerate, conflicts arise. Or, running migrations on production without testing on staging first.

**Prevention:**
1. Never edit generated migration files. If you need custom SQL (indexes, triggers), create a separate manual migration file
2. Always run `drizzle-kit generate` -> review SQL -> `drizzle-kit migrate` on staging -> verify -> apply to production
3. Add migration status check to CI: fail build if there are un-applied migrations
4. Use drizzle-kit's `--custom` flag for manual migration files that drizzle-kit should track but not auto-generate

### Pitfall 9: Toss Payments Sandbox vs Production Gotchas

**What goes wrong:** Code works in Toss sandbox but fails in production because: (1) sandbox uses test API keys that are more permissive, (2) sandbox doesn't enforce PG contract terms, (3) real payment methods have different error codes.

**Prevention:**
1. Get a Toss Payments test MID (Merchant ID) early -- it requires business registration
2. Test with REAL card numbers in test mode (Toss provides test card numbers)
3. Implement exhaustive error handling for payment failures: card declined, insufficient balance, network timeout, duplicate transaction
4. Never hardcode payment amounts on the frontend -- always derive from server-side calculation

---

## Minor Pitfalls

### Pitfall 10: next/image in Standalone Mode

**What goes wrong:** Next.js image optimization fails silently in production because `sharp` is not installed or the NEXT_SHARP_PATH environment variable is not set in the Docker container.

**Prevention:** Explicitly install sharp in the Dockerfile. Add `NEXT_SHARP_PATH=/app/node_modules/sharp` to runtime environment.

### Pitfall 11: Socket.IO Version Mismatch

**What goes wrong:** socket.io (server) and socket.io-client (frontend) major versions don't match, causing silent connection failures.

**Prevention:** Pin both to the same major version (v4.x). Add a version check in CI.

### Pitfall 12: Zustand Store Naming for React Compiler

**What goes wrong:** React Compiler assumes hooks start with `use`. Zustand stores not prefixed with `use` cause React Compiler warnings or incorrect optimizations.

**Prevention:** Always name Zustand stores with `use` prefix: `useBookingStore`, `useAuthStore`.

### Pitfall 13: Cloudflare R2 CORS Configuration

**What goes wrong:** Frontend cannot load poster images or SVG seat maps from R2 because CORS is not configured for the web domain.

**Prevention:** Configure R2 bucket CORS policy to allow the web domain origin. Use `AllowedOrigins: ["https://yourdomain.com"]`, not `*`.

### Pitfall 14: Time Zone Issues in Schedule Display

**What goes wrong:** Server stores schedule times in UTC but displays them without conversion. Korean users see wrong show times.

**Prevention:** Store all times in UTC (timestamptz in PostgreSQL). Convert to Asia/Seoul (KST, UTC+9) in the frontend display layer. Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Seoul'`.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth (JWT + Passport) | Token refresh race condition (multiple tabs) | Use httpOnly cookie for refresh token, handle 401 with single retry queue |
| SVG Seat Map (MVP) | Mobile performance with large venues | Start with <500 seat test venues. Profile on low-end Android. |
| Real-time (WebSocket) | Multi-instance broadcast failure | Test with min-instances=2 early to verify Redis adapter works |
| Payment (Toss) | Webhook vs server-to-server confusion | Always do server-to-server confirm. Webhook is backup only. |
| Admin (CRUD) | SVG upload without validation | Validate SVG content server-side: sanitize, check viewBox, reject scripts |
| Queue System (Phase 2) | Queue position estimation accuracy | Use Redis Sorted Set with timestamp score, estimate wait time from processing rate |
| Search (PostgreSQL) | Korean search quality | Monitor zero-result rate from day 1, build pg_trgm fallback into initial implementation |

---

## Sources

- [Toss Payments API docs](https://docs.tosspayments.com/)
- [NestJS WebSocket scaling (LogRocket)](https://blog.logrocket.com/scalable-websockets-with-nestjs-and-redis/)
- [Cloud Run cold start best practices](https://cloud.google.com/run/docs/tips/general)
- [PostgreSQL FTS Korean limitations](https://www.postgresql.org/docs/16/textsearch-parsers.html)
- [Drizzle ORM migration docs](https://orm.drizzle.team/docs/migrations)
- [Next.js sharp in production](https://nextjs.org/docs/messages/sharp-missing-in-production)
- [Socket.IO version compatibility](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [Upstash Redis performance](https://upstash.com/docs/redis/overall/performance)
- [Password hashing guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/)
- docs/03-ARCHITECTURE.md (concurrency handling design)
