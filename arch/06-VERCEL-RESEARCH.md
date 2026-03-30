# Vercel Platform Research for GrapIt (Korean Ticket Booking Platform)

> Research Date: 2026-03-25
> Stack: Next.js 16 + NestJS 11 + PostgreSQL + Redis

---

## 1. Seoul/Korea Edge & Region Presence

**Vercel HAS a Seoul compute region: `icn1` (ap-northeast-2)**

Vercel operates 20 compute-capable regions globally, and Seoul is one of them:

| Region Code | AWS Region | Location |
|-------------|-----------|----------|
| `icn1` | ap-northeast-2 | Seoul, South Korea |
| `hnd1` | ap-northeast-1 | Tokyo, Japan |
| `kix1` | ap-northeast-3 | Osaka, Japan |
| `sin1` | ap-southeast-1 | Singapore |
| `hkg1` | ap-east-1 | Hong Kong |

Additionally, Vercel has 126+ Points of Presence (PoPs) globally for CDN/edge caching, with multiple in Korea for static asset delivery.

**Where functions run:**
- **Serverless Functions (Node.js runtime):** Can be pinned to `icn1` (Seoul). This is critical -- set your function region to `icn1` to co-locate with your Korean database.
- **Edge Functions (Edge runtime):** Run at the nearest PoP globally. Cannot be pinned to a single region (they are global by design).
- **Edge Middleware:** Runs at every PoP worldwide, including Korean PoPs.
- **Default region** is `iad1` (Washington D.C., USA) -- you MUST change this to `icn1` for a Korean platform.

**Configuration:**
```json
// vercel.json
{
  "regions": ["icn1"]
}
```

---

## 2. Serverless Functions: Runtime Limits

### With Fluid Compute (default for new projects since April 2025)

| Feature | Hobby (Free) | Pro ($20/mo) | Enterprise |
|---------|-------------|-------------|------------|
| **Default Duration** | 300s (5 min) | 300s (5 min) | 300s (5 min) |
| **Max Duration** | 300s (5 min) | 800s (~13 min) | 800s (~13 min) |
| **Default Memory** | 2 GB / 1 vCPU | 2 GB / 1 vCPU | 2 GB / 1 vCPU |
| **Max Memory** | 2 GB / 1 vCPU | 4 GB / 2 vCPU | 4 GB / 2 vCPU |
| **Bundle Size** | 250 MB (uncompressed) | 250 MB | 250 MB |
| **Request/Response Body** | 4.5 MB | 4.5 MB | 4.5 MB |
| **Concurrency** | Up to 30,000 | Up to 30,000 | 100,000+ |
| **File Descriptors** | 1,024 shared | 1,024 shared | 1,024 shared |

### Without Fluid Compute (legacy projects before April 2025)

| Feature | Hobby | Pro | Enterprise |
|---------|-------|-----|------------|
| **Default Duration** | 10s | 15s | 15s |
| **Max Duration** | 60s | 300s (5 min) | 900s (15 min) |

### Cold Start Times
- **Node.js runtime:** Typically 200ms-2s+ depending on bundle size. Large NestJS apps with many dependencies can see 1-3s cold starts.
- **Edge runtime:** ~5ms cold start (V8 isolates, no microVM overhead).
- **Fluid Compute mitigations:** Bytecode caching (Node.js 20+), function pre-warming on production, optimized concurrency (reuses warm instances for multiple requests).
- **Bytecode caching:** Only on production environments. First request is uncached; subsequent cold starts benefit from cached bytecode.

---

## 3. Fluid Compute

**What it is:** Vercel's hybrid execution model (launched early 2025, default for new projects since April 2025). It combines serverless elasticity with server-like capabilities -- a single function instance handles multiple concurrent requests.

**Key features:**
1. **Optimized Concurrency:** Multiple requests share one instance (like a traditional server). Dramatically reduces cold starts under load.
2. **Active CPU Billing:** You only pay for actual CPU execution time. I/O wait (DB queries, API calls) is NOT billed for CPU -- only memory continues billing.
3. **`waitUntil` API:** Run background tasks after sending the HTTP response (logging, analytics, cache warming). The function stays alive to complete these tasks.
4. **Bytecode Caching:** Pre-compiled JavaScript bytecode stored after first execution, eliminating recompilation on subsequent cold starts.
5. **Cross-region Failover:** Automatic failover to another AZ, then to the next closest region if `icn1` goes down.
6. **Error Isolation:** Unhandled errors in one request do not crash concurrent requests on the same instance.

**How it helps ticket booking:**
- During a ticket sale rush (flash sale), Fluid Compute reuses warm instances instead of spinning up thousands of new cold lambdas.
- 10-minute seat hold TTL: With 800s max duration on Pro, a single function invocation can last ~13 minutes, sufficient for managing seat reservation workflows.
- Background processing via `waitUntil`: After confirming a booking to the user, continue processing payment webhooks, sending notifications, updating analytics.
- Vercel claims up to **85% cost reduction** vs traditional serverless.

**Configuration:**
```json
// vercel.json
{
  "fluid": true
}
```

---

## 4. Edge Functions vs Serverless Functions

| Feature | Edge Functions (Edge Runtime) | Serverless Functions (Node.js Runtime) |
|---------|------------------------------|---------------------------------------|
| **Cold Start** | ~5ms | 200ms - 3s+ |
| **Runtime** | V8 isolates (Web APIs only) | Full Node.js |
| **Location** | Nearest PoP globally | Specific region(s) |
| **Max Duration** | Must begin response within 25s, can stream up to 300s | Up to 800s (Pro) |
| **Bundle Size** | 4 MB | 250 MB |
| **Max Request Size** | 1 MB | 4.5 MB |
| **Node.js APIs** | Limited (no `fs`, no native modules, no TCP/UDP) | Full support |
| **NPM Packages** | Only those using Web APIs | All packages |
| **Database Access** | HTTP-based only (no TCP) | Full TCP/connection pooling |
| **Cost** | Generally cheaper | Pay for CPU + memory |

**When to use each for ticket booking:**

| Use Case | Recommended Runtime |
|----------|-------------------|
| Authentication/session checks | Edge (fast, global) |
| Geo-routing, A/B testing | Edge |
| API routes (booking, payments) | Serverless (Node.js) in `icn1` |
| Database queries | Serverless (needs TCP for PostgreSQL) |
| Redis operations | Either (Upstash has HTTP API for Edge) |
| Heavy computation | Serverless |
| Middleware (rate limiting, redirects) | Edge Middleware |

---

## 5. NestJS 11 on Vercel

**Yes, NestJS can run on Vercel.** Vercel has first-party NestJS support with zero-configuration deployment.

**How it works:**
- Your entire NestJS application becomes a **single Vercel Function**.
- Fluid Compute is enabled by default.
- Vercel detects the entrypoint automatically from: `src/main.ts`, `src/app.ts`, `src/index.ts`, `src/server.ts`.
- Auto-scales up and down based on traffic.

**Entrypoint example:**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Limitations:**

| Limitation | Impact on Ticket Booking | Workaround |
|-----------|------------------------|------------|
| **No WebSockets** | Cannot do real-time seat maps via WS | Use SSE, or external service (Ably, Pusher, Rivet) |
| **No persistent state** | No in-memory session/cache between requests | Use Redis (Upstash) for all shared state |
| **250 MB bundle limit** | Large NestJS apps with many deps may approach this | Tree-shake, exclude unnecessary modules |
| **4.5 MB request/response body** | Large payload limits | Use streaming, Vercel Blob for files |
| **No long-running background processes** | No cron-like internal schedulers | Use Vercel Cron Jobs or external scheduler |
| **Cold starts** | NestJS bootstrapping with DI container is heavier than plain functions | Fluid Compute bytecode caching helps; keep modules lean |
| **800s max duration** | Long-polling limited | Use SSE with streaming |
| **No TCP listeners** | Cannot bind custom ports/protocols | HTTP only |
| **1,024 file descriptor limit** | Limits concurrent DB connections per instance | Use connection pooling (PgBouncer/Neon pooler) |

**Critical consideration:** NestJS on Vercel is best for the API layer. For a ticket booking platform with complex real-time requirements, consider running NestJS on a dedicated server/container (Railway, Fly.io, AWS ECS) and using Vercel only for the Next.js frontend.

---

## 6. Next.js 16 on Vercel

Next.js 16 was released in late 2025. Vercel is the creator of Next.js, so Vercel is the best-optimized platform for it.

**Key Next.js 16 features relevant to ticket booking:**

1. **Cache Components (`use cache`):** Explicit opt-in caching. Cache event listings, venue info, artist pages while keeping seat availability dynamic.
2. **Turbopack (stable, default bundler):** 2-5x faster production builds, up to 10x faster Fast Refresh in development.
3. **Partial Pre-Rendering (PPR):** Static shell renders instantly, dynamic content (seat availability, prices) streams in. Perfect for event pages.
4. **Server Components:** Fetch event data on the server with zero JS sent to client. Reduces bundle size significantly.
5. **Server Actions:** Handle form submissions (booking, payment) without separate API routes.
6. **Streaming SSR:** Show event page structure immediately, stream in dynamic seat map data progressively.
7. **`proxy.ts` (replaces `middleware.ts`):** Explicit network boundary for routing, auth checks, geo-detection.
8. **React Compiler (stable):** Automatic memoization reduces unnecessary re-renders -- critical for complex seat map UIs.
9. **Async Request APIs:** `params` and `searchParams` are now fully async (breaking change from Next.js 15).

**Vercel-specific advantages for Next.js 16:**
- ISR (Incremental Static Regeneration) with on-demand revalidation
- Image Optimization (Vercel's built-in CDN)
- Analytics & Speed Insights integration
- Preview deployments for every PR
- Instant Rollback

---

## 7. Database Options

### Vercel Postgres (Neon) -- via Vercel Marketplace

> Note: Vercel's own Postgres/KV products are **sunset**. They now redirect to marketplace partners.

**Neon Postgres (recommended by Vercel):**

| Feature | Details |
|---------|---------|
| **Seoul Region** | **NOT available.** Closest: `aws-ap-southeast-1` (Singapore) |
| **Available Asia-Pacific** | Singapore (`aws-ap-southeast-1`), Sydney (`aws-ap-southeast-2`) |
| **Connection Pooling** | Built-in (PgBouncer-compatible) |
| **Serverless Driver** | `@neondatabase/serverless` for HTTP-based queries from Edge |
| **Autoscaling** | Scale to zero, auto-scale compute |
| **Branching** | Database branching for preview deployments |

**Neon Pricing (via Vercel Marketplace):**
- Free: 0.5 GB storage, 190 compute hours/month
- Launch: $19/mo -- 10 GB storage, 300 compute hours
- Scale: $69/mo -- 50 GB storage, 750 compute hours
- Business: $700/mo -- 500 GB storage, 1000 compute hours

**CRITICAL ISSUE: No Seoul region for Neon.** Singapore is ~4,700km from Seoul. Expected latency: ~40-80ms per query. For a ticket booking system with multiple DB queries per request, this adds up significantly.

**Alternative:** Self-hosted PostgreSQL on AWS `ap-northeast-2` (Seoul) with Vercel functions pinned to `icn1`. Use Neon's serverless driver or standard `pg` driver with connection pooling.

### Upstash Redis (recommended by Vercel for KV)

| Feature | Details |
|---------|---------|
| **Seoul Region** | **NOT available as primary.** `ap-northeast-1` (Tokyo) available for replication |
| **Closest Primary Regions** | `ap-southeast-1` (Singapore), `ap-southeast-2` (Sydney) |
| **Global Replication** | Available -- replicate across multiple read regions |
| **HTTP API** | Works from Edge Functions (no TCP needed) |
| **REST API** | `@upstash/redis` SDK |

**Upstash Redis Pricing:**
- Free: 10,000 commands/day, 256 MB
- Pay-as-you-go: $0.2 per 100K commands, up to 10 GB
- Pro (fixed): $280/mo -- unlimited commands, 50 GB, multi-region

**Recommendation for Redis:** Use Upstash with global replication (Tokyo read replica) for the lowest latency from Seoul, OR self-host Redis on AWS Seoul for sub-1ms latency.

### Vercel Blob

| Feature | Details |
|---------|---------|
| **Use Case** | Static assets (event images, venue photos, PDFs) |
| **Pro Included** | 5 GB storage |
| **Pricing** | $0.023/GB storage, operations billed separately |
| **Status** | Generally available |

---

## 8. WebSocket Support

**Vercel does NOT natively support WebSockets. This is a fundamental limitation.**

WebSocket connections require persistent, bidirectional TCP connections. Vercel Functions are request-response oriented -- even with Fluid Compute, they cannot maintain WebSocket server connections.

**Alternatives for real-time seat booking:**

| Solution | Pros | Cons |
|----------|------|------|
| **SSE (Server-Sent Events)** | Works on Vercel, server-to-client push, simple | Unidirectional only, subject to function timeout (800s max on Pro) |
| **Pusher** | Managed, reliable, Seoul PoP | Additional cost, vendor dependency |
| **Ably** | Enterprise-grade, global edge, exactly-once delivery | Cost at scale |
| **Supabase Realtime** | PostgreSQL integration, presence | No Seoul region |
| **Rivet (2025)** | Open-source, WebSocket hibernation on Vercel Functions, actor model | New/less mature, additional infrastructure |
| **Separate WS Server** | Full control, any provider | Separate infra to manage |
| **Polling (short)** | Simplest, works everywhere | Higher latency, more requests |

**Recommended approach for GrapIt:**
1. **Primary:** SSE from Next.js API routes for seat availability updates (unidirectional server push)
2. **Fallback:** Short polling every 2-3 seconds for seat map refresh
3. **If bidirectional needed:** Pusher or Ably for real-time bidding/queue position updates
4. **Seat hold/release:** Redis pub/sub via Upstash with SSE bridge

**SSE on Vercel constraints:**
- Edge Runtime: Must begin response within 25s, can stream up to 300s
- Node.js Runtime: Up to 800s on Pro plan
- Must set `dynamic = 'force-dynamic'` to prevent caching

---

## 9. Pricing (Pro Plan - $20/mo per seat)

### Included Resources

| Resource | Included (Pro) |
|----------|----------------|
| **Base Price** | $20/user/month |
| **Usage Credit** | $20/month (applies to overages) |
| **Function Invocations** | 1,000,000/month |
| **Edge Requests** | 10,000,000/month |
| **Fast Data Transfer (Bandwidth)** | 1 TB/month |
| **Build Minutes** | Pay-as-you-go |
| **Cron Jobs** | 100 per project |
| **Concurrent Builds** | 12 |
| **Deployments/Day** | 6,000 |
| **Image Optimization Transformations** | 10K/month |

### Overage Rates

| Resource | Rate |
|----------|------|
| **Function Invocations** | $0.60 per 1M |
| **Active CPU Time** | $0.128 per CPU-hour (varies by region) |
| **Provisioned Memory** | $0.0106 per GB-hour (varies by region) |
| **Fast Data Transfer** | $0.15/GB (default regions) |
| **Edge Requests** | Regional pricing |
| **Image Transformations** | $0.05 per 1K |

### Cost Estimate for 100K+ Daily Users

Assumptions: 100K DAU, 10 pageviews/user, 5 API calls/pageview, average function duration 200ms active CPU:

| Resource | Monthly Usage | Cost |
|----------|-------------|------|
| **Function Invocations** | ~150M/month | (150M - 1M) * $0.60/M = ~$89 |
| **Active CPU** | ~8,333 CPU-hours | 8,333 * $0.128 = ~$1,067 |
| **Provisioned Memory** (2GB instances) | ~16,666 GB-hours | 16,666 * $0.0106 = ~$177 |
| **Bandwidth** (1 TB+) | ~2 TB | 1 TB overage * $0.15/GB = ~$150 |
| **Base (3 developers)** | 3 seats | $60 |
| **TOTAL ESTIMATE** | | **~$1,543/month** |

**Warning:** These are rough estimates. During flash sales (ticket drops), traffic can spike 10-100x, dramatically increasing costs. Vercel's pay-per-use model means costs scale linearly with traffic. A viral event could easily push costs to $5,000-$10,000+/month.

**Regional pricing impact:** Seoul region (`icn1`) may have higher rates than US regions. Check Vercel's regional pricing page for `icn1` specific multipliers.

---

## 10. Cron Jobs

| Feature | Hobby | Pro | Enterprise |
|---------|-------|-----|------------|
| **Max Cron Jobs per Project** | 100 | 100 | 100 |
| **Minimum Interval** | Once per day | Once per minute | Once per minute |
| **Scheduling Precision** | Hourly (+/- 59 min) | Per-minute | Per-minute |
| **Timezone** | UTC only | UTC only | UTC only |
| **Max Duration** | Same as function limits (300s) | Same (up to 800s) | Same (up to 800s) |

**How cron works:** Vercel makes an HTTP GET request to your production deployment URL at the scheduled time.

**Use cases for ticket booking:**
- Settlement processing (daily): Process payments, generate reports
- Notification dispatch: Send reminders for upcoming events
- Expired hold cleanup: Release seats where payment timed out
- Cache warming: Pre-populate popular event data
- Analytics aggregation: Daily/hourly stats compilation

**Configuration:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/settle",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/cleanup-holds",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/notifications",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Limitations:**
- Cron jobs only run on **production** deployments
- No redirect following (3xx responses end the job)
- Subject to same function timeout limits
- UTC timezone only (no KST configuration)
- 100 cron jobs max per project
- For sub-minute scheduling, need external solution (e.g., Upstash QStash)

---

## 11. Known Gotchas for Ticket Booking

### Critical Issues

1. **No WebSockets:** Real-time seat selection/bidding requires external service. SSE is the best native option but limited to 800s max.

2. **Cold Starts During Flash Sales:** When tickets go on sale, thousands of users hit simultaneously. Despite Fluid Compute improvements, the initial burst will trigger cold starts. Mitigation: pre-warm with cron pings 1-2 minutes before sale time.

3. **Database Latency (No Seoul DB):** Neither Neon nor Upstash has a Seoul region. Using Singapore Neon adds ~40-80ms per query. For a booking flow with 5+ DB queries, that is 200-400ms additional latency.

4. **4.5 MB Request/Response Limit:** Large seat maps with thousands of seats may exceed this. Use pagination or streaming.

5. **Function Duration for Seat Holds:** A 10-minute seat hold TTL works fine with Vercel's 800s (13 min) max duration on Pro. But DO NOT implement holds as long-running functions. Use Redis TTL keys instead.

6. **Queue System Challenges:** Vercel has no native queue. For a waiting room / queue system during high-demand sales:
   - Use Vercel's new **Queue API** (available on Pro, regional pricing)
   - Or use Upstash QStash for message queuing
   - Or use external queue (AWS SQS, BullMQ on separate server)

7. **1,024 File Descriptor Limit:** With connection pooling to PostgreSQL, this limits the number of concurrent DB connections per function instance. Use Neon's built-in pooler or PgBouncer.

### Vendor Lock-In

| Aspect | Lock-In Level | Notes |
|--------|--------------|-------|
| **Next.js** | Low | Can self-host on any Node.js server |
| **Vercel Functions** | Medium | Standard Node.js, but Vercel-specific config |
| **Edge Config** | High | Vercel-proprietary |
| **Vercel Blob** | Medium | S3-compatible API |
| **Cron Jobs** | Low | Standard cron expressions |
| **`waitUntil`** | Medium | Vercel-specific API |
| **ISR/Revalidation** | Medium | Next.js feature, but optimized for Vercel |
| **Fluid Compute** | High | Vercel-proprietary execution model |

**Migration path:** Next.js can be self-hosted. NestJS is portable. The main lock-in risk is around Vercel-specific features (Edge Config, Blob, `waitUntil`, preview deployments workflow).

### Cost Unpredictability

- Pay-per-use means costs spike with traffic spikes
- No spend caps on Pro plan -- you get a bill after the fact
- Flash sales can generate 10-100x normal traffic
- Set up billing alerts and consider Enterprise plan for predictable pricing

---

## 12. Streaming / SSE

**Vercel supports SSE and streaming responses.** This is the recommended real-time approach on Vercel.

### Implementation Details

| Runtime | Behavior |
|---------|----------|
| **Node.js** | Full streaming support, up to 800s on Pro |
| **Edge** | Must begin response within 25s, can stream up to 300s |

### Configuration Requirements
```typescript
// Next.js App Router
export const dynamic = 'force-dynamic'; // Prevent caching
export const runtime = 'nodejs'; // or 'edge'

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // Send seat updates
      const interval = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify(seatUpdate)}\n\n`);
      }, 1000);

      // Clean up after timeout
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 300000); // 5 minutes
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### SSE Use Cases for Ticket Booking
1. **Seat availability updates:** Push seat status changes to all viewers of a seat map
2. **Queue position updates:** Tell users their position in the waiting room
3. **Price updates:** Dynamic pricing changes for events
4. **Booking confirmation:** Stream payment processing status
5. **Countdown timers:** Server-authoritative timer for seat hold expiry

### Limitations
- **Unidirectional only:** Server-to-client. For client-to-server, use regular HTTP requests.
- **Connection limits:** Each SSE connection is a function invocation. 10,000 concurrent viewers = 10,000 concurrent function instances (Fluid Compute helps by sharing instances, but each connection is still a request).
- **Timeout:** Max 800s per connection on Pro. Client must reconnect after timeout.
- **Cost:** Each SSE connection consumes provisioned memory for its entire duration. 10K users connected for 5 minutes each = significant memory-hours.

---

## Summary: Vercel Suitability for GrapIt

### What Works Well
- Next.js 16 frontend: Excellent. Vercel is the best platform for Next.js.
- Seoul compute region (`icn1`): Available for serverless functions.
- Fluid Compute: Good for handling traffic spikes during ticket sales.
- Cron jobs: Sufficient for settlement, cleanup, notifications.
- SSE/Streaming: Viable for real-time seat updates.
- Preview deployments, instant rollback: Great DX.

### What Does NOT Work Well
- **NestJS backend with WebSockets:** Vercel cannot host WebSocket servers. NestJS loses much of its value on Vercel (no WebSocket gateway, no microservices transport, no long-running processes).
- **Database proximity:** No Seoul region for Neon Postgres or Upstash Redis. ~40-80ms latency penalty per query from Singapore.
- **High-concurrency flash sales:** Cost unpredictability. Thousands of concurrent SSE connections are expensive.
- **Queue system:** No native robust queue for waiting room functionality.

### Recommended Architecture

**Hybrid approach:**

| Component | Platform | Reason |
|-----------|----------|--------|
| **Next.js 16 Frontend** | Vercel (`icn1`) | Best-in-class Next.js hosting |
| **NestJS 11 API** | AWS ECS/Fargate or Railway (Seoul) | Full Node.js, WebSockets, persistent connections |
| **PostgreSQL** | AWS RDS or Supabase (Seoul region) | Sub-5ms latency from Seoul |
| **Redis** | AWS ElastiCache or self-hosted (Seoul) | Sub-1ms latency, pub/sub for real-time |
| **Real-time (WebSockets)** | NestJS on dedicated server, or Ably/Pusher | Persistent bidirectional connections |
| **CDN / Static Assets** | Vercel Edge Network | Global, Korean PoPs |
| **Cron / Scheduled Tasks** | Vercel Cron or AWS EventBridge | Depends on where the API lives |

This gives you Vercel's strengths (Next.js hosting, edge network, DX) without its weaknesses (no WebSockets, no Seoul database, cost unpredictability for backend).
