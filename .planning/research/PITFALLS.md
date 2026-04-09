# Domain Pitfalls

**Domain:** Ticket Booking Platform (Grapit) -- v1.1 Feature Addition
**Researched:** 2026-04-09
**Focus:** Common mistakes when adding Valkey migration, R2 integration, SMS verification, admin dashboard, and UX modernization to an existing NestJS + Next.js ticketing platform

---

## Critical Pitfalls

Mistakes that cause downtime, data loss, broken booking flow, or require architectural rewrites.

### Pitfall 1: Valkey Migration -- Upstash HTTP API to ioredis TCP Unification Mismatch

**What goes wrong:** The current codebase uses two completely different Redis clients with different APIs: `@upstash/redis` (HTTP, custom `eval()` signature) for seat locking/cache, and `ioredis` (TCP) for Socket.IO pub/sub. Migrating to a single Memorystore Valkey instance means replacing BOTH clients with a single ioredis (or iovalkey) TCP client. The `@upstash/redis` `eval()` call signature differs from ioredis's `eval()` signature -- directly swapping will break every Lua script invocation.

**Why it happens:** Upstash's `eval()` takes `(script, keys[], args[])` while ioredis's `eval()` takes `(script, numKeys, ...keysAndArgs)`. The BookingService currently calls `this.redis.eval(LOCK_SEAT_LUA, [keys], [args])` using the Upstash signature. Swapping to ioredis without changing every eval call site will silently produce wrong results or throw errors.

**Consequences:** Seat locking breaks completely. Users cannot select seats. The core booking flow -- Grapit's reason for existing -- stops working.

**Prevention:**
1. Create a `ValkeyProvider` abstraction layer that wraps ioredis and exposes the same `eval(script, keys[], args[])` signature currently used by BookingService
2. Alternatively, refactor BookingService to use ioredis's `eval(script, numKeys, key1, key2, ..., arg1, arg2, ...)` syntax
3. The InMemoryRedis mock in `redis.provider.ts` also needs updating -- it currently emulates the Upstash API pattern
4. Write integration tests that run actual Lua scripts against a local Valkey/Redis instance before deploying
5. NEVER deploy the migration without running the full booking flow E2E (lock -> unlock -> payment -> refund)

**Detection:** Unit tests for BookingService will fail immediately if eval signature changes. Add an integration test that actually executes Lua scripts against a real Valkey instance.

**Phase:** Must be addressed in the Valkey migration phase. This is the highest-risk item in the entire v1.1 milestone.

### Pitfall 2: Valkey Migration -- Cloud Run VPC Networking Cold Start Penalty

**What goes wrong:** Memorystore Valkey requires VPC networking (Private Service Connect or VPC connector). Cloud Run with Direct VPC egress adds 60+ seconds of connection establishment delay on cold start. The first request after scale-from-zero times out, and the booking flow fails.

**Why it happens:** Cloud Run's Direct VPC egress needs to allocate a network interface on the VPC when an instance starts. This is fundamentally slower than the current Upstash HTTP client, which needs no VPC setup (it makes outbound HTTPS calls that work from any Cloud Run instance immediately).

**Consequences:** With min-instances=0 (current cost-optimization config), the first user to hit the API after an idle period waits 60+ seconds. Seat locking, real-time updates, and all Redis-dependent operations fail during this window.

**Prevention:**
1. Configure a startup probe that tests Valkey connectivity: `startup_probe.tcp_socket.port: 6379` or HTTP probe that calls a `/health/redis` endpoint which pings Valkey
2. Set the startup probe with generous retries: `initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 12` (60 seconds total)
3. After Valkey migration, consider min-instances=1 for the API service (adds ~$7-15/month on Cloud Run Seoul) to eliminate cold start entirely
4. Use `lazyConnect: true` on the ioredis client, and add connection retry logic with exponential backoff in the NestJS module initialization
5. Use Direct VPC egress (not Serverless VPC Connector) -- it has lower latency after initial setup and no connector instance costs

**Detection:** Monitor Cloud Run startup latency via Cloud Monitoring. Alert if p99 startup time exceeds 30 seconds. Sentry will capture connection timeouts during cold starts.

**Phase:** Valkey migration phase. Must be validated BEFORE removing Upstash fallback.

### Pitfall 3: Valkey Migration -- No Rollback Without Dual-Write

**What goes wrong:** After switching environment variables from Upstash to Valkey, existing seat locks in Upstash become invisible. Active users who locked seats before the cutover lose their locks. If Valkey has issues, rolling back to Upstash means a second data loss event.

**Why it happens:** Seat locks are ephemeral (10-minute TTL). There is no migration tool for real-time lock state between two Redis-compatible stores. The cutover is binary -- you point to one or the other.

**Consequences:** Users in the middle of booking lose their seat selections. During rollback, the same thing happens again. Two disruptions instead of one.

**Prevention:**
1. Implement a dual-write phase: write to BOTH Upstash and Valkey for 1-2 hours, read from Upstash (primary). This ensures Valkey has current state.
2. Switch reads to Valkey (Upstash becomes the backup write target). Monitor for 30 minutes.
3. If stable, remove Upstash writes. If not, switch reads back to Upstash instantly.
4. Schedule the cutover during lowest-traffic period (typically 3-5 AM KST for Korean entertainment platforms)
5. The dual-write adapter can be a simple wrapper: `async set(...) { await Promise.all([upstash.set(...), valkey.set(...)]) }` -- reads go to one or the other based on a feature flag

**Detection:** Log every Redis operation with a `source` tag (upstash/valkey). Compare operation counts and latencies. Alert on any Valkey timeout during dual-write period.

**Phase:** Valkey migration phase. The dual-write strategy adds ~2 days of work but eliminates the catastrophic rollback scenario.

### Pitfall 4: R2 Presigned URL CORS -- Browser PUT Fails Despite curl Working

**What goes wrong:** Server generates a presigned PUT URL for R2. The admin uploads a poster image or SVG seat map. `curl` works fine. The browser JavaScript fetch/XMLHttpRequest fails with a CORS error. The admin cannot upload anything.

**Why it happens:** R2's CORS configuration has specific requirements that differ from AWS S3:
1. Allowed headers must NOT use `"*"` wildcard -- you must explicitly list `"content-type"`, `"content-length"`, etc.
2. The CORS configuration JSON format for the R2 API differs from how it appears in the Cloudflare dashboard UI
3. The presigned URL domain (`<ACCOUNT_ID>.r2.cloudflarestorage.com`) is different from the public URL domain, so CORS must cover both origins

**Consequences:** Admin upload functionality is completely broken in production. Posters, seat maps, banners -- nothing can be uploaded from the browser.

**Prevention:**
1. Configure R2 CORS explicitly:
   ```json
   {
     "AllowedOrigins": ["https://your-domain.com", "http://localhost:3000"],
     "AllowedMethods": ["GET", "PUT", "HEAD"],
     "AllowedHeaders": ["content-type", "content-length", "x-amz-content-sha256"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 3600
   }
   ```
2. Test browser uploads IMMEDIATELY after CORS configuration -- do not assume curl success means browser success
3. The current `UploadService` generates presigned URLs without `ContentLength` constraints. Add `content-length-range` validation server-side before generating the URL
4. For SVG seat maps: validate the SVG content server-side AFTER upload (XSS via SVG is a real vector)

**Detection:** Browser console will show CORS errors. Add Sentry breadcrumbs on the frontend upload component. Monitor R2 4xx error rates.

**Phase:** R2 integration phase. This is the first thing that will break when switching from local file storage.

### Pitfall 5: SMS Pumping Fraud -- Unauthenticated Endpoint with No Rate Limiting

**What goes wrong:** The current `POST /sms/send-code` endpoint is decorated with `@Public()` and has zero rate limiting. An attacker scripts thousands of SMS sends to premium-rate numbers. Twilio bills pile up to thousands of dollars in hours.

**Why it happens:** The endpoint is public by design (users need to verify their phone before having an account). The current implementation has no IP-based rate limiting, no CAPTCHA, no per-phone-number throttle, and no Twilio Fraud Guard configuration. The Zod schema only validates phone format, not request frequency.

**Consequences:** Twilio billing fraud. Real-world SMS pumping attacks have cost companies $10K-$100K+ in a single weekend. Twilio's Fraud Guard has blocked $62.7M in fraudulent charges for customers, but it must be explicitly enabled.

**Prevention:**
1. Add IP-based rate limiting: max 3 SMS sends per IP per 10 minutes (use NestJS `@nestjs/throttler` or custom guard)
2. Add phone-number rate limiting: max 3 sends to the same number per hour (store in Valkey with TTL)
3. Enable Twilio Verify Fraud Guard in the Twilio console -- it's free and blocks known fraud patterns
4. Add a spending cap in Twilio console ($50/month for initial launch)
5. For Korean market: restrict to Korean phone numbers only (`+82` prefix). The current regex `^01[016789]\d{7,8}$` already does this for input, but validate on the server after E.164 normalization too
6. Consider adding reCAPTCHA v3 (invisible) on the send-code form -- this alone blocks 90%+ of automated attacks
7. Monitor Twilio usage daily. Set up Twilio usage triggers for alerts at $10, $25, $50 thresholds

**Detection:** Twilio console shows per-number and per-country send volumes. Alert on >10 sends to the same number in an hour. Alert on any send to non-Korean numbers.

**Phase:** SMS verification phase. Rate limiting MUST be implemented BEFORE enabling real Twilio credentials in production. This is not optional.

---

## Moderate Pitfalls

### Pitfall 6: R2 -- forcePathStyle Missing in S3Client Configuration

**What goes wrong:** The S3 SDK sends requests to `<bucket>.r2.cloudflarestorage.com` (virtual-hosted style) instead of `<account>.r2.cloudflarestorage.com/<bucket>` (path style). R2 requires path-style URLs. All S3 operations silently fail with DNS resolution errors or 403s.

**Why it happens:** AWS SDK v3 defaults to virtual-hosted-style URLs for S3. The current `UploadService` does not set `forcePathStyle: true` in the S3Client constructor. This will fail intermittently or completely when the SDK version changes default behavior.

**Consequences:** All R2 operations fail. File uploads, presigned URL generation, and reads all break.

**Prevention:**
Add `forcePathStyle: true` to the S3Client configuration:
```typescript
this.s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,  // REQUIRED for R2
  credentials: { ... },
});
```

**Phase:** R2 integration phase. Check this FIRST before debugging any R2 issue.

### Pitfall 7: R2 -- Presigned URL File Size Not Enforced

**What goes wrong:** The current `generatePresignedUrl()` method does not set any file size limits. An attacker or careless admin uploads a 500MB file via the presigned URL, consuming R2 storage and bandwidth. Unlike AWS S3's `content-length-range` condition, R2 presigned URLs do NOT support file size restrictions natively.

**Why it happens:** R2's S3-compatible API does not implement the `Conditions` parameter for presigned POST or content-length-range for presigned PUT. This is a documented gap.

**Consequences:** Uncontrolled storage costs. Potential abuse. Large SVG files that crash browsers.

**Prevention:**
1. Validate file size on the frontend BEFORE uploading (reject >10MB for images, >5MB for SVGs)
2. Proxy uploads through your NestJS API instead of direct browser-to-R2 for critical file types (seat maps). This adds latency but gives you full control.
3. For poster images (less sensitive): use presigned URLs but add a post-upload validation step via R2 HeadObject to check ContentLength, and delete if oversized
4. Set R2 storage lifecycle rules to auto-delete orphaned uploads older than 24 hours

**Phase:** R2 integration phase.

### Pitfall 8: Admin Dashboard -- Aggregate Queries Scanning Full Reservation Table

**What goes wrong:** The current `getBookings()` method runs THREE separate COUNT/SUM queries against the entire `reservations` table on every page load. As the table grows to 100K+ rows, each admin dashboard page load takes 2-5 seconds. Multiple admins refreshing the dashboard creates DB load.

**Why it happens:** The current implementation (lines 51-69 of `admin-booking.service.ts`) calculates `totalBookings`, `totalRevenue`, and `cancelledCount` with full table scans every request. There is no caching, no materialized view, and no pre-aggregation.

**Consequences:** Dashboard becomes slow. DB CPU spikes. Could impact the customer-facing booking flow if DB connections are saturated.

**Prevention:**
1. Cache dashboard stats in Valkey with a 5-minute TTL:
   ```typescript
   const cacheKey = 'admin:stats:bookings';
   const cached = await valkey.get(cacheKey);
   if (cached) return JSON.parse(cached);
   // ... compute stats ...
   await valkey.set(cacheKey, JSON.stringify(stats), 'EX', 300);
   ```
2. Add a composite index: `CREATE INDEX idx_reservations_status ON reservations(status)` (if not already present) for the WHERE status='CONFIRMED'/'CANCELLED' queries
3. For the statistics dashboard (new feature): use a materialized view refreshed by pg-boss every 15 minutes, NOT live queries
4. Never add a "real-time" stats dashboard that queries the reservations table directly. Always cache or pre-aggregate.
5. When adding date-range filters (daily/weekly/monthly stats), always include WHERE created_at BETWEEN ... to limit scan scope

**Detection:** Enable `pg_stat_statements` on Cloud SQL. Monitor query execution time. Alert if any admin query exceeds 1 second.

**Phase:** Admin dashboard phase. Must be addressed before deploying the statistics feature.

### Pitfall 9: Admin Dashboard -- Timezone Mismatch in KST Reports

**What goes wrong:** Dashboard shows "today's revenue" as 0 at 9 AM KST because the query uses `DATE(created_at) = CURRENT_DATE` which operates in UTC. All bookings from midnight-to-9AM KST are attributed to the previous day in the dashboard.

**Why it happens:** PostgreSQL `CURRENT_DATE` uses the session timezone (UTC by default on Cloud SQL). Korean users expect KST (UTC+9). A booking made at 2026-04-09 01:00 KST is stored as 2026-04-08 16:00 UTC, and grouped into April 8th instead of April 9th.

**Consequences:** Dashboard statistics are wrong by up to 9 hours. Daily revenue reports are inaccurate. This is subtle -- nobody notices until they compare dashboard numbers with Toss Payments settlement reports.

**Prevention:**
1. All date-grouped queries must use `AT TIME ZONE 'Asia/Seoul'`:
   ```sql
   WHERE created_at AT TIME ZONE 'Asia/Seoul' >= '2026-04-09'::date
   AND created_at AT TIME ZONE 'Asia/Seoul' < '2026-04-10'::date
   ```
2. For materialized views with daily aggregation, bucket by KST date:
   ```sql
   DATE(created_at AT TIME ZONE 'Asia/Seoul') AS report_date
   ```
3. Never set the PostgreSQL session timezone to KST globally -- this breaks other systems. Always convert explicitly in queries.
4. The frontend should pass date ranges in ISO 8601 with timezone offset (`2026-04-09T00:00:00+09:00`), and the backend should convert to UTC for queries
5. Add a test that verifies a booking made at 2026-04-09 00:30:00 KST appears in the April 9th KST daily report, not April 8th

**Detection:** Compare dashboard daily totals with Toss Payments settlement reports. Any discrepancy near midnight KST indicates timezone handling issues.

**Phase:** Admin dashboard phase. This is easy to get wrong and hard to notice.

### Pitfall 10: Valkey -- Lua Script Compatibility with Valkey 8.x

**What goes wrong:** The three Lua scripts in `booking.service.ts` (LOCK_SEAT_LUA, UNLOCK_SEAT_LUA, GET_VALID_LOCKED_SEATS_LUA) use standard Redis commands (SMEMBERS, EXISTS, SET NX EX, SADD, SREM, GET, DEL, EXPIRE). These are Valkey-compatible. However, the `eval()` call uses the Upstash SDK's type signature `eval<KeyTypes, ReturnType>()` which does not exist on ioredis.

**Why it happens:** Valkey 8.x is wire-compatible with Redis 7.2 for standard commands. Lua scripting is fully supported. But the CLIENT API varies -- ioredis sends `CLIENT INFO` and `HELLO` during connection setup, and older ioredis versions may fail version negotiation with Valkey 8.x.

**Consequences:** Connection fails on startup. Or, Lua scripts fail at runtime due to incorrect eval signature.

**Prevention:**
1. Ensure ioredis is version 5.4.0+ (check `HELLO` command compatibility with Valkey 8.x)
2. Refactor eval calls from Upstash format to ioredis format:
   ```typescript
   // Before (Upstash):
   this.redis.eval(script, [key1, key2], [arg1, arg2])
   // After (ioredis):
   this.redis.eval(script, 2, key1, key2, arg1, arg2)
   ```
3. Test each Lua script individually against a local Valkey 8.x container (Docker: `docker run -p 6379:6379 valkey/valkey:8`)
4. The LOCK_SEAT_LUA script uses `redis.call('SET', key, value, 'NX', 'EX', ttl)` -- this is standard and Valkey-compatible. No script changes needed.
5. Consider using `EVALSHA` + `SCRIPT LOAD` for production to avoid sending full Lua script text on every call

**Phase:** Valkey migration phase. Test scripts BEFORE deploying.

### Pitfall 11: SMS -- OTP Replay and Brute Force on Verify Endpoint

**What goes wrong:** The `POST /sms/verify-code` endpoint is also `@Public()` with no rate limiting. An attacker can brute-force all 1,000,000 possible 6-digit codes in minutes (1M requests at 100 req/sec = ~3 hours, but with parallelism much faster).

**Why it happens:** Twilio Verify has built-in attempt limiting (5 attempts per verification), but if the attacker creates new verifications in parallel (send-code to get a new OTP, then brute-force verify-code), they can bypass Twilio's per-verification limit.

**Consequences:** Account takeover. An attacker can verify any phone number and potentially gain access to accounts that use phone verification.

**Prevention:**
1. Rate limit verify-code: max 5 attempts per phone number per 10 minutes
2. Rate limit send-code: max 3 per phone number per hour (also prevents verification-refresh attack)
3. Bind the verification to a session or IP -- the same IP that requested send-code must also call verify-code
4. Twilio Verify already tracks attempts per verification SID, but add your own layer on top
5. After 3 failed verify attempts for a phone number, require a cooldown period of 30 minutes before allowing a new send-code
6. Log all verify attempts with IP + phone number for audit

**Detection:** Alert on >5 verify-code attempts from any single IP in 10 minutes. Alert on verify-code calls without a preceding send-code call from the same session.

**Phase:** SMS verification phase. Must be implemented alongside send-code rate limiting.

### Pitfall 12: UX Modernization -- SVG Seat Map Accessibility Regression

**What goes wrong:** The current seat map viewer uses `dangerouslySetInnerHTML` to render processed SVG. It has a `role="grid"` and `aria-label` on the container, but individual seats have no ARIA attributes. Screen readers cannot identify individual seats, their status, or their tier. A UI refactor that adds visual polish without fixing accessibility makes the situation worse.

**Why it happens:** The SVG is fetched as raw text and parsed/modified with DOMParser. The current processing adds `fill`, `stroke`, and `style` attributes but no `role`, `aria-label`, `aria-selected`, `aria-disabled`, or `tabindex` attributes to individual seat elements.

**Consequences:** WCAG 2.1 AA non-compliance. Korean accessibility law (KADO) requires public service websites to be accessible. More practically, keyboard-only users cannot select seats at all.

**Prevention:**
1. During SVG processing in `seat-map-viewer.tsx`, add to each `[data-seat-id]` element:
   - `role="gridcell"` (or `button` if clickable)
   - `aria-label="[TierName] [Row]열 [Number]번"` (e.g., "VIP A열 3번")
   - `aria-selected="true/false"` for selected state
   - `aria-disabled="true"` for sold/locked seats
   - `tabindex="0"` for available seats, `tabindex="-1"` for unavailable
2. Add keyboard event handling: Enter/Space to select, arrow keys to navigate between seats
3. Ensure color contrast: the current `LOCKED_COLOR = '#D1D5DB'` on white background barely meets 3:1 contrast ratio. On the `bg-gray-50` container, it likely fails.
4. Do NOT rely solely on color to indicate seat status -- add a pattern or icon (the checkmark for selected is good, extend this pattern to locked/sold)

**Detection:** Run `axe-core` automated accessibility tests on the seat map page. Manual test with VoiceOver (macOS) and keyboard-only navigation.

**Phase:** UX modernization phase. Should be bundled with the design refresh, not deferred.

---

## Minor Pitfalls

### Pitfall 13: R2 -- Public URL vs Presigned URL Domain Mismatch

**What goes wrong:** The `R2_PUBLIC_URL` environment variable points to a custom domain (e.g., `cdn.grapit.co.kr`) while presigned URLs use the R2 API endpoint (`<ACCOUNT_ID>.r2.cloudflarestorage.com`). If CORS is only configured for the public URL domain, presigned upload URLs fail.

**Prevention:** Configure CORS for BOTH the public domain and the R2 API endpoint domain, or route uploads through a Worker/proxy on the public domain. Additionally, the current `UploadService` returns `publicUrl` using `R2_PUBLIC_URL` but `uploadUrl` using the presigned URL -- ensure the public URL domain is connected to the R2 bucket in Cloudflare dashboard.

**Phase:** R2 integration phase.

### Pitfall 14: Valkey -- Connection Pool Exhaustion Under Load

**What goes wrong:** The current ioredis client uses a single connection (not a pool). Memorystore Valkey with the NestJS application under load can exhaust the single connection, causing Redis commands to queue and timeout. The current Upstash HTTP client does not have this issue because each HTTP request is independent.

**Prevention:**
1. For general commands: ioredis's single connection handles pipelining automatically, which is fine for most workloads. But if you see latency spikes under load, consider using a connection pool.
2. For pub/sub: the Socket.IO Redis adapter already creates a dedicated `sub` connection via `pubClient.duplicate()`, so pub/sub won't block general commands
3. Set `maxRetriesPerRequest: 3` (already in current config), `connectTimeout: 10000`, and `commandTimeout: 5000` to prevent hanging connections
4. Monitor connection count: Memorystore for Valkey has a max connections limit based on instance size

**Phase:** Valkey migration phase. Monitor after deployment.

### Pitfall 15: SMS -- Korean Carrier Delivery Delays

**What goes wrong:** SMS delivery to Korean carriers (SKT, KT, LG U+) can take 10-30 seconds during peak hours. Users think the SMS failed, tap "resend" multiple times, and receive 3-5 codes. Only the last code is valid (Twilio Verify invalidates previous codes), but users try the first code they received and get "invalid code" errors.

**Prevention:**
1. Show a countdown timer after send-code (60 seconds) -- disable the resend button during this period
2. Clearly indicate "most recent code is the valid one" in the UI
3. Twilio Verify handles code invalidation automatically -- document this in the UI
4. Consider using Twilio's `channelConfiguration` to set a Korean sender ID if available

**Phase:** SMS verification phase. Frontend UX matters as much as backend implementation.

### Pitfall 16: UX Modernization -- Breaking Existing Booking Flow During Refactor

**What goes wrong:** Design refresh changes component structure, state management, or routing. A seemingly safe CSS/layout change breaks the booking flow: the payment confirmation page loses its callback parameters, the seat selection panel loses its state after a re-render, or the WebSocket connection drops during the navigation change.

**Why it happens:** The booking flow spans multiple pages and maintains state across them (selected seats in Zustand store, WebSocket connection, Toss Payments widget state). UI refactoring can accidentally reset stores, unmount components that hold connections, or change URL patterns.

**Prevention:**
1. Before ANY UI refactoring: write (or verify existing) E2E tests that cover the full booking flow: browse -> select showtime -> select seats -> payment -> confirmation
2. Refactor one page at a time, not the entire app. Verify the booking flow E2E after each page.
3. The Zustand store (useBookingStore) must persist across route changes. Verify it survives the refactored navigation.
4. WebSocket connection lifecycle: ensure the BookingGateway connection is managed at the layout level, not page level. A page-level connection will disconnect on route changes.

**Detection:** E2E tests (Playwright). Manual QA of the full booking flow after every UI change. Sentry error monitoring for new errors in the booking flow.

**Phase:** UX modernization phase. E2E test coverage is the prerequisite.

### Pitfall 17: Admin Dashboard -- N+1 on New Statistics Queries

**What goes wrong:** Adding new dashboard statistics (per-performance revenue, per-venue occupancy, daily trends) with naive Drizzle ORM queries creates N+1 patterns. Querying each performance's booking count individually instead of aggregating in a single GROUP BY.

**Prevention:**
1. Always use GROUP BY aggregation, never loop-and-query:
   ```typescript
   // BAD: N+1
   for (const perf of performances) {
     const count = await db.select({ count: sql`count(*)` }).from(reservations).where(eq(...));
   }
   // GOOD: Single query
   const stats = await db.select({
     performanceId: reservations.performanceId,
     count: sql`count(*)`,
     revenue: sql`sum(total_amount)`,
   }).from(reservations).groupBy(reservations.performanceId);
   ```
2. The existing `getBookings()` already avoids N+1 for seat data (batch fetch with `inArray`). Follow this same pattern for all new queries.
3. For the statistics dashboard: pre-compute in a pg-boss scheduled job, store results in a `daily_stats` table or materialized view, and serve from cache

**Phase:** Admin dashboard phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Valkey migration | eval() API signature mismatch breaks seat locking | CRITICAL | Create adapter wrapper, test all Lua scripts against Valkey container |
| Valkey migration | VPC cold start adds 60+ seconds to first request | CRITICAL | Startup probe, consider min-instances=1 after migration |
| Valkey migration | No rollback strategy = double data loss risk | CRITICAL | Dual-write phase with feature flag, schedule cutover at low traffic |
| Valkey migration | ioredis version incompatible with Valkey 8.x HELLO command | MODERATE | Pin ioredis >= 5.4.0, test connection setup |
| R2 integration | CORS blocks browser PUT despite curl working | CRITICAL | Explicit AllowedHeaders (no wildcard), test browser upload first |
| R2 integration | Missing forcePathStyle in S3Client config | MODERATE | Add to constructor, verify before other debugging |
| R2 integration | No file size enforcement on presigned URLs | MODERATE | Frontend validation + post-upload server check |
| SMS verification | SMS pumping fraud on unauthenticated endpoint | CRITICAL | Rate limit BEFORE enabling Twilio, spending cap, Fraud Guard |
| SMS verification | OTP brute force on verify endpoint | MODERATE | Per-phone attempt limit, session binding, cooldown |
| SMS verification | Korean carrier delivery delays cause UX confusion | MINOR | Resend countdown timer, clear UI guidance |
| Admin dashboard | Full table scan on every stats page load | MODERATE | Cache in Valkey, materialized view for trends |
| Admin dashboard | Timezone mismatch in KST daily reports | MODERATE | Explicit AT TIME ZONE in all date-grouped queries |
| Admin dashboard | N+1 queries in new statistics features | MODERATE | GROUP BY aggregation, pre-compute with pg-boss |
| UX modernization | Accessibility regression on SVG seat map | MODERATE | Add ARIA attributes during SVG processing, keyboard nav |
| UX modernization | Booking flow breaks during UI refactor | MODERATE | E2E tests BEFORE refactoring, one page at a time |

---

## Integration Pitfalls (Cross-Feature)

### Valkey + Socket.IO Redis Adapter

The `@socket.io/redis-adapter` currently uses `ioredis` with a `pubClient.duplicate()` pattern. After Valkey migration, both the general-purpose client AND the Socket.IO pub/sub client will use the same Memorystore instance. Ensure the Valkey instance's max connections accommodate at least: 1 general client + 1 pub client + 1 sub client per Cloud Run instance, plus some headroom.

### R2 + UX Modernization

If the UX refresh changes poster image sizes or aspect ratios, existing R2 images may not fit. Plan for image resizing/cropping in the upload pipeline, or use Next.js `<Image>` component with explicit `sizes` and `fill` to handle arbitrary aspect ratios.

### SMS + Admin Dashboard

The admin dashboard should display SMS verification statistics (send count, verify success rate, fraud block count). This requires logging SMS events to the database (not just Twilio's dashboard), which the current `SmsService` does not do. Add a `sms_events` table or at minimum log to a structured logger that feeds into the statistics pipeline.

---

## Rollback Strategy Summary

| Feature | Rollback Method | Risk Level |
|---------|----------------|------------|
| Valkey migration | Feature flag to switch back to Upstash env vars (requires dual-write phase) | HIGH -- must plan ahead |
| R2 integration | Revert to local file storage mode (already supported via `isLocalMode` flag) | LOW -- existing fallback works |
| SMS verification | Set `TWILIO_ACCOUNT_SID=''` to revert to dev mock mode | LOW -- existing fallback works |
| Admin dashboard | Feature flag to hide new dashboard routes | LOW -- additive feature |
| UX modernization | Git revert of UI changes (if E2E tests exist to verify) | MEDIUM -- depends on test coverage |

---

## Sources

- [Memorystore Valkey Networking (GCP docs)](https://docs.cloud.google.com/memorystore/docs/valkey/networking)
- [Cloud Run Direct VPC egress (GCP docs)](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Cloud Run to Memorystore connection guide](https://docs.cloud.google.com/memorystore/docs/redis/connect-redis-instance-cloud-run)
- [Cloud Run high latency after deploy with Direct VPC](https://discuss.google.dev/t/cloud-run-high-latency-after-deploy-with-direct-vpc/181351)
- [Valkey migration from Redis (official docs)](https://valkey.io/topics/migration/)
- [Redis vs Valkey 2026 -- license fork changes](https://dev.to/synsun/redis-vs-valkey-in-2026-what-the-license-fork-actually-changed-1kni)
- [Valkey GLIDE ioredis migration guide](https://github.com/valkey-io/valkey-glide/wiki/Migration-Guide-ioredis)
- [Socket.IO Redis adapter docs](https://socket.io/docs/v4/redis-adapter/)
- [Cloudflare R2 CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 CORS issue with presigned URLs (Cloudflare Community)](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567)
- [R2 presigned URLs (Cloudflare docs)](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 AWS SDK v3 configuration (Cloudflare docs)](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- [R2 limits (Cloudflare docs)](https://developers.cloudflare.com/r2/platform/limits/)
- [Twilio Verify Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)
- [Twilio SMS pumping fraud prevention](https://www.twilio.com/en-us/blog/sms-pumping-fraud-solutions)
- [Secure OTP systems 2025 (Prelude)](https://prelude.so/blog/secure-otp)
- [SVG accessibility (A11Y Collective)](https://www.a11y-collective.com/blog/svg-accessibility/)
- [Creating accessible SVGs (Deque)](https://www.deque.com/blog/creating-accessible-svgs/)
- [PostgreSQL timezone handling](https://oneuptime.com/blog/post/2026-01-25-postgresql-timezone-handling/view)
- [PostgreSQL materialized views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [NestJS aggregate queries with raw SQL (Wanago)](https://wanago.io/2022/10/10/api-nestjs-aggregate-functions-sql/)
- Grapit codebase analysis: `booking.service.ts`, `redis.provider.ts`, `redis-io.adapter.ts`, `sms.service.ts`, `sms.controller.ts`, `upload.service.ts`, `admin-booking.service.ts`, `seat-map-viewer.tsx`
