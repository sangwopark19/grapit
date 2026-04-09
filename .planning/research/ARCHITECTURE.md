# Architecture Patterns

**Domain:** v1.1 Integration Architecture -- Valkey Migration, R2 Production, SMS Real, Admin Dashboard, UX Modernization
**Researched:** 2026-04-09

## Current Architecture Snapshot

```
[Browser] --> [Cloudflare CDN/WAF]
                |
    +-----------+-----------+
    |                       |
[Cloud Run: web]    [Cloud Run: api]
  Next.js 16          NestJS 11
  (standalone)         |
    |                  +--[Cloud SQL PostgreSQL 16]
    |                  +--[Upstash Redis (HTTP)] -- seat lock, cache
    |                  +--[ioredis (TCP)] -- Socket.IO pub/sub
    |                  +--[Cloudflare R2] -- local fallback mode
    |                  +--[Twilio] -- dev mock mode
    |
[Socket.IO /booking namespace] -- real-time seat updates
```

### Key Architectural Characteristics
- **Dual Redis client**: @upstash/redis (HTTP, serverless) for seat locking/cache + ioredis (TCP) for Socket.IO Redis adapter pub/sub
- **Local fallback pattern**: UploadService has local file mode when R2 not configured; SmsService has dev mock when Twilio not configured; InMemoryRedis when Upstash not configured
- **NestJS module isolation**: 9 feature modules (auth, user, sms, performance, search, admin, booking, payment, reservation) with clean DI boundaries
- **Admin as route group**: /admin routes share layout with sidebar, protected by role check in layout.tsx client component

---

## 1. Valkey Migration Architecture

### Problem Statement

Current dual-client Redis architecture (Upstash HTTP + ioredis TCP) works but creates:
- Two separate connection management paths
- Two sets of credentials to manage
- Upstash HTTP adds ~5-15ms latency per call vs TCP
- No VPC-level security (Upstash is external, over public internet)

### Recommended Architecture: Single iovalkey Client

**Confidence: HIGH** (iovalkey is official Valkey fork of ioredis, API-compatible, verified)

```
[Cloud Run: api] --[Direct VPC Egress]--> [Memorystore for Valkey]
                                            (asia-northeast3, PSC)
                                            shared-core-nano (1.12GB)
```

#### Networking: Direct VPC Egress (NOT VPC Connector)

Cloud Run supports two VPC egress methods. Use **Direct VPC Egress** because:

| Criterion | Direct VPC Egress | Serverless VPC Access Connector |
|-----------|-------------------|---------------------------------|
| Cost | Scales to zero with service | Always-on connector instances (~$7/mo min) |
| Latency | Lower (no connector hop) | Higher (extra hop through connector) |
| Throughput | Higher | Limited by connector size |
| Setup | Cloud Run config only | Separate connector resource |
| Status | GA, recommended by Google | Legacy, being superseded |

**Setup steps:**
1. Create a subnet in the existing VPC for Cloud Run (`cloud-run-subnet`, e.g. `10.8.0.0/28`)
2. Create a Service Connection Policy for `gcp-memorystore` service class in asia-northeast3
3. Create Memorystore for Valkey instance (shared-core-nano, Cluster Mode Disabled, no replicas)
4. Configure Cloud Run `api` service: Network > "Send traffic directly to a VPC" > select network + subnet
5. Update environment variables: single `VALKEY_HOST` + `VALKEY_PORT` (no auth token needed within VPC)

**Important**: Memorystore for Valkey uses **Private Service Connect (PSC) only** -- no traditional VPC peering option. The Service Connection Policy automates PSC endpoint deployment.

#### Client Migration: @upstash/redis + ioredis --> iovalkey

**iovalkey** is the official Valkey fork of ioredis. It is a drop-in replacement with identical API.

```typescript
// BEFORE (two clients)
import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

// AFTER (single client)
import { Valkey } from 'iovalkey';
```

**Migration path for BookingService Lua scripts:** The Lua scripts (LOCK_SEAT, UNLOCK_SEAT, GET_VALID_LOCKED_SEATS) use standard Redis commands (SET, GET, DEL, SADD, SREM, SMEMBERS, EXISTS, EXPIRE). These are fully compatible with Valkey -- no changes needed to Lua script content.

**Migration path for Socket.IO adapter:** iovalkey supports `.duplicate()` and pub/sub, same as ioredis. The `@socket.io/redis-adapter` accepts any ioredis-compatible client.

```typescript
// BEFORE (redis-io.adapter.ts)
import { createAdapter } from '@socket.io/redis-adapter';
import type IORedis from 'ioredis';
export function createSocketIoRedisAdapter(ioredisClient: IORedis) {
  const pubClient = ioredisClient;
  const subClient = pubClient.duplicate();
  return createAdapter(pubClient, subClient);
}

// AFTER
import { createAdapter } from '@socket.io/redis-adapter';
import type { Valkey } from 'iovalkey';
export function createSocketIoRedisAdapter(valkeyClient: Valkey) {
  const pubClient = valkeyClient;
  const subClient = pubClient.duplicate();
  return createAdapter(pubClient, subClient);
}
```

#### Component Changes

| Component | Change Type | Details |
|-----------|-------------|---------|
| `config/redis.config.ts` | **MODIFY** | Replace upstashUrl/upstashToken/ioredisUrl with valkeyHost/valkeyPort |
| `booking/providers/redis.provider.ts` | **REWRITE** | Single ValkeyProvider replacing both upstashRedisProvider + ioredisClientProvider. Keep InMemoryRedis for local dev. |
| `booking/providers/redis-io.adapter.ts` | **MODIFY** | Change import from ioredis to iovalkey |
| `booking/booking.service.ts` | **MODIFY** | Change `@Inject(UPSTASH_REDIS)` to `@Inject(VALKEY_CLIENT)`. API calls identical (eval, set, get, del, smembers, etc.) |
| `booking/booking.module.ts` | **MODIFY** | Replace two provider imports with single valkeyProvider |
| `health/health.controller.ts` | **MODIFY** | Add Valkey health check indicator |
| `.env` / Cloud Run env vars | **MODIFY** | Replace UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, REDIS_URL with VALKEY_HOST, VALKEY_PORT |

#### New Provider Pattern

```typescript
// booking/providers/valkey.provider.ts
import { Valkey } from 'iovalkey';

export const VALKEY_CLIENT = Symbol('VALKEY_CLIENT');

export const valkeyProvider: Provider = {
  provide: VALKEY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Valkey | InMemoryRedis => {
    const host = config.get<string>('valkey.host', '');
    const port = config.get<number>('valkey.port', 6379);

    if (!host) {
      console.warn('[valkey] No VALKEY_HOST -- using in-memory mock.');
      return new InMemoryRedis() as unknown as Valkey;
    }

    return new Valkey({ host, port, maxRetriesPerRequest: 3 });
  },
};
```

#### Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Memorystore shared-core-nano (1.12GB, no replicas) | ~$30-50 (region-dependent, verify on GCP pricing calculator) |
| Direct VPC Egress | $0 (scales to zero, no connector cost) |
| **Total delta vs Upstash** | Upstash free tier covers current usage; Valkey adds $30-50/mo but gains VPC security + lower latency |

**Trade-off decision**: If cost is a concern for early stage, Upstash free tier is hard to beat. Valkey migration makes sense when: (a) you need VPC-level security, (b) latency matters for seat locking, (c) you want single-client simplicity. Consider deferring until traffic justifies the cost.

---

## 2. R2 Production Integration Architecture

### Current State

UploadService already has complete R2 integration code using `@aws-sdk/client-s3`. The gap is operational:
- R2 API tokens not provisioned for production
- No custom domain configured for public asset serving
- Local file fallback used in all environments

### Recommended Architecture: R2 Public Bucket + Custom Domain + Cloudflare Cache

**Confidence: HIGH** (R2 public bucket with custom domain is documented, standard pattern)

```
[Admin uploads] --> [NestJS: presigned PUT URL] --> [R2 bucket]
                                                       |
[User browser] --> [cdn.grapit.co.kr] --> [Cloudflare Cache] --> [R2 bucket]
```

#### Asset Serving Strategy

| Asset Type | Access Pattern | Serving Method |
|------------|---------------|----------------|
| Performance posters | Public, high traffic | R2 public bucket + custom domain + Cloudflare Cache |
| SVG seat maps | Public, moderate traffic | Same as posters |
| Banner images | Public, high traffic | Same as posters |
| Actor photos | Public, low traffic | Same as posters |

All assets are public read. No signed URLs needed for reads. Use presigned URLs only for uploads (already implemented).

#### Setup Steps

1. **R2 bucket**: Create `grapit-assets` bucket in Cloudflare dashboard
2. **API token**: Create R2 API token with Object Read & Write permissions, scoped to `grapit-assets` bucket
3. **Custom domain**: Add `cdn.grapit.co.kr` (or similar) as custom domain on the bucket. Requires domain to be on Cloudflare DNS (already using Cloudflare CDN/WAF).
4. **Disable r2.dev**: Turn off the development URL after custom domain is active
5. **Cache rules**: Enable Smart Tiered Cache. Set Cache-Control headers via R2 bucket lifecycle or upload metadata (`max-age=31536000, immutable` for versioned keys like `posters/<uuid>.webp`)
6. **CORS**: Configure R2 CORS to allow PUT from admin domain origin

#### Component Changes

| Component | Change Type | Details |
|-----------|-------------|---------|
| `admin/upload.service.ts` | **MODIFY** | Update `r2PublicUrl` to use custom domain. Add Cache-Control metadata to PutObjectCommand. No structural changes needed -- code is already R2-ready. |
| `admin/local-upload.controller.ts` | **KEEP** | Retain for local development. No changes needed. |
| `.env` | **ADD** | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL |
| Cloud Run env vars | **ADD** | Same R2 credentials via Secret Manager |
| Frontend image URLs | **VERIFY** | Ensure all `<Image>` components handle both localhost and cdn.grapit.co.kr origins. Update `next.config.ts` remotePatterns. |

#### Upload Flow (No Structural Change)

The existing presigned URL flow is correct for production:

```
1. Admin clicks "upload poster"
2. Frontend calls POST /api/v1/admin/performances/:id/seatmap (or similar)
3. Backend generates presigned PUT URL (UploadService.generatePresignedUrl)
4. Frontend PUTs file directly to R2 via presigned URL
5. Backend stores the public URL (cdn.grapit.co.kr/posters/<uuid>.webp) in DB
6. Users fetch image via custom domain -> Cloudflare Cache -> R2
```

#### next.config.ts Update Required

```typescript
// Add R2 custom domain to allowed image sources
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'cdn.grapit.co.kr' },
    // keep localhost for dev
    { protocol: 'http', hostname: 'localhost' },
  ],
},
```

---

## 3. SMS Service Architecture

### Current State

SmsService already has Twilio integration code with dev/prod mode switching. The architecture is sound -- the gap is operational (Twilio credentials not configured in production).

### Recommended Architecture: Keep Twilio Verify, Minimal Changes

**Confidence: HIGH** (existing code is production-ready, just needs credentials)

#### Why Twilio Verify Over Korean Alternatives

| Provider | Per SMS (Korea) | Pros | Cons |
|----------|----------------|------|------|
| Twilio Verify | ~$0.05/verification + ~$0.05/SMS | Already integrated, global, well-documented SDK | Higher cost per message |
| CoolSMS/Aligo | ~$0.015-0.02/SMS | Cheaper, Korean-native | New integration, Korean-only docs, separate SDK |

**Decision**: Keep Twilio for v1.1. The code is already written. Cost difference is negligible at early-stage volume (<100 verifications/day = ~$3/day). Revisit Korean SMS providers only if volume exceeds 1000/day.

#### Module Structure (Already Correct)

```
SmsModule
  |- SmsController (POST /sms/send, POST /sms/verify)
  |- SmsService (Twilio client, dev mock logic)
  |- Exported to AuthModule (for signup/password-reset verification)
```

#### Component Changes

| Component | Change Type | Details |
|-----------|-------------|---------|
| `sms/sms.service.ts` | **MINOR MODIFY** | Add rate limiting per phone number (store attempts in Valkey with TTL). Add retry logic with exponential backoff for Twilio API failures. |
| `sms/sms.controller.ts` | **MINOR MODIFY** | Add IP-based rate limiting via @nestjs/throttler decorator override (e.g., 3 requests per 60s per IP for /sms/send) |
| Cloud Run env vars | **ADD** | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID via Secret Manager |
| `.env` | **ALREADY EXISTS** | Dev mode auto-activates when env vars are missing -- no code change needed |

#### SMS Rate Limiting Pattern (New)

```typescript
// In SmsService.sendVerificationCode(), add before Twilio call:
const rateLimitKey = `sms-rate:${normalizedPhone}`;
const attempts = await this.valkey.incr(rateLimitKey);
if (attempts === 1) {
  await this.valkey.expire(rateLimitKey, 300); // 5-min window
}
if (attempts > 3) {
  throw new BadRequestException('인증번호 요청이 너무 많습니다. 5분 후 다시 시도해주세요.');
}
```

This requires SmsModule to import the Valkey provider from BookingModule (or extract Valkey provider to a shared ValkeyModule).

#### Shared ValkeyModule Extraction (New Component)

Since SMS rate limiting, booking seat locks, and future caching all need Valkey, extract the provider into a shared module:

```
NEW: common/valkey/valkey.module.ts
NEW: common/valkey/valkey.provider.ts
MODIFY: booking/booking.module.ts -- import ValkeyModule instead of inline provider
MODIFY: sms/sms.module.ts -- import ValkeyModule for rate limiting
```

---

## 4. Admin Dashboard Architecture

### Current State

Admin has CRUD for performances, banners, bookings. No statistics/analytics. AdminService queries PostgreSQL directly for list views.

### Recommended Architecture: Direct Queries + pg-boss Scheduled Aggregation for Expensive Metrics

**Confidence: MEDIUM** (pattern is sound; Drizzle materialized view support has known bugs, use raw SQL views instead)

```
[Admin Dashboard Page]
    |
    +-- Realtime KPIs (today's sales, active bookings)
    |     --> Direct SQL queries (fast, current data)
    |
    +-- Trend Charts (daily/weekly/monthly revenue, ticket sales)
    |     --> Materialized views, refreshed by pg-boss cron
    |
    +-- Top Performances (ranking by ticket sales)
          --> Materialized views, refreshed by pg-boss cron
```

#### Data Aggregation Strategy

| Metric | Freshness Needed | Strategy | Query Cost |
|--------|-----------------|----------|------------|
| Today's revenue | Real-time | Direct query on payments table | Low (small dataset per day) |
| Active reservations count | Real-time | Direct query, `COUNT WHERE status = 'CONFIRMED'` | Low |
| Pending payments | Real-time | Direct query | Low |
| Daily revenue trend (30 days) | Hourly | Materialized view `mv_daily_revenue` | Medium (aggregates 30 days) |
| Weekly ticket sales trend | Daily | Materialized view `mv_weekly_sales` | Medium |
| Top performances by revenue | Daily | Materialized view `mv_performance_ranking` | High (joins + aggregation) |
| Genre distribution | Daily | Materialized view `mv_genre_stats` | Medium |

#### Why NOT Drizzle pgMaterializedView

Drizzle ORM's `pgMaterializedView` has known limitations:
- Migration generation bugs with materialized views (Issue #3179)
- Dependency ordering issues between materialized views (Issue #4520)
- Index support on materialized views is missing (Issue #2976)

**Instead**: Define materialized views in raw SQL migrations via `drizzle-kit generate`, then query them with `db.execute(sql\`SELECT * FROM mv_daily_revenue\`)`.

#### Materialized View Definitions

```sql
-- Migration: create_admin_materialized_views.sql

CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT
  DATE(p.paid_at AT TIME ZONE 'Asia/Seoul') AS sale_date,
  COUNT(*) AS ticket_count,
  SUM(p.amount) AS total_revenue
FROM payments p
WHERE p.status = 'DONE'
GROUP BY DATE(p.paid_at AT TIME ZONE 'Asia/Seoul')
ORDER BY sale_date DESC;

CREATE UNIQUE INDEX idx_mv_daily_revenue_date ON mv_daily_revenue(sale_date);

CREATE MATERIALIZED VIEW mv_performance_ranking AS
SELECT
  perf.id AS performance_id,
  perf.title,
  perf.genre,
  COUNT(r.id) AS total_reservations,
  SUM(p.amount) AS total_revenue
FROM performances perf
JOIN showtimes s ON s.performance_id = perf.id
JOIN reservations r ON r.showtime_id = s.id AND r.status = 'CONFIRMED'
JOIN payments p ON p.reservation_id = r.id AND p.status = 'DONE'
GROUP BY perf.id, perf.title, perf.genre
ORDER BY total_revenue DESC;

CREATE UNIQUE INDEX idx_mv_perf_ranking_id ON mv_performance_ranking(performance_id);
```

#### pg-boss Refresh Scheduling

pg-boss is already in the tech stack (not yet integrated). Add a custom NestJS provider:

```typescript
// NEW: common/jobs/pg-boss.provider.ts
import PgBoss from 'pg-boss';

export const PG_BOSS = Symbol('PG_BOSS');

export const pgBossProvider: Provider = {
  provide: PG_BOSS,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const boss = new PgBoss(config.get<string>('DATABASE_URL')!);
    await boss.start();
    return boss;
  },
};

// NEW: common/jobs/jobs.module.ts
// NEW: common/jobs/stats-refresh.job.ts
// Schedules: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue
//            every hour via boss.schedule('refresh-stats', '0 * * * *', ...)
```

#### Component Changes

| Component | Change Type | Details |
|-----------|-------------|---------|
| NEW `modules/admin/admin-stats.service.ts` | **NEW** | Real-time KPI queries + materialized view reads |
| NEW `modules/admin/admin-stats.controller.ts` | **NEW** | GET /admin/stats/kpi, GET /admin/stats/revenue-trend, GET /admin/stats/top-performances |
| `modules/admin/admin.module.ts` | **MODIFY** | Add AdminStatsService, AdminStatsController, import JobsModule |
| NEW `common/jobs/pg-boss.provider.ts` | **NEW** | pg-boss lifecycle management |
| NEW `common/jobs/jobs.module.ts` | **NEW** | Global job scheduling module |
| NEW `common/jobs/stats-refresh.job.ts` | **NEW** | Scheduled materialized view refresh |
| NEW SQL migration | **NEW** | Materialized view definitions |
| Frontend: NEW `app/admin/dashboard/page.tsx` | **NEW** | Dashboard page with charts |
| Frontend: NEW `components/admin/stats-cards.tsx` | **NEW** | KPI card components |
| Frontend: NEW `components/admin/revenue-chart.tsx` | **NEW** | Revenue trend chart (use recharts or lightweight chart lib) |
| Frontend: NEW `hooks/use-admin-stats.ts` | **NEW** | TanStack Query hooks for stats endpoints |

#### Chart Library Recommendation

Use **recharts** (v2.x, ~45kb gzipped). It is the most popular React charting library, works well with Next.js, and has simple declarative API. Alternatives considered:
- chart.js + react-chartjs-2: More flexible but heavier setup
- nivo: Beautiful but heavier bundle
- lightweight-charts: Overkill for admin dashboards (designed for financial data)

---

## 5. UX Modernization Architecture

### Current State

- Design tokens defined in `globals.css` via Tailwind v4 `@theme` (brand colors, spacing, semantic colors)
- shadcn/ui components in `components/ui/` (20 components)
- Domain components in `components/{home,booking,admin,auth,performance,reservation}/`
- No shared design token TypeScript layer
- No component documentation/storybook

### Recommended Architecture: Incremental Refinement, Not Rewrite

**Confidence: HIGH** (existing token system is solid; add progressive enhancement)

#### Design Token Architecture (Extend, Don't Replace)

The current `globals.css` `@theme` block already follows best practices. For UX modernization:

```
globals.css @theme (source of truth)
    |
    +-- Tailwind utility classes (existing, keep)
    +-- shadcn/ui component variants (existing, keep)
    +-- NEW: CSS custom properties for motion/transition tokens
    +-- NEW: Dark mode tokens (if desired, via @theme with media query)
```

**Do NOT create a TypeScript design token layer.** Tailwind v4's CSS-first config is the token system. Adding a JS layer adds complexity without value for a single-developer project.

#### Component Library Approach

| Layer | Current | v1.1 Target |
|-------|---------|-------------|
| Primitives (Button, Input, etc.) | shadcn/ui | Keep as-is. Update styles via Tailwind classes only. |
| Domain components | 40+ components | Refine layout, spacing, animation. No structural changes. |
| Motion/transitions | Minimal (enter/exit keyframes) | Add shared transition utilities |
| SVG seat map | react-zoom-pan-pinch wrapper | Improve touch UX, add seat selection animation |

#### Specific UX Enhancement Components

| Component | Change | Impact |
|-----------|--------|--------|
| `components/home/banner-carousel.tsx` | Add autoplay, smoother transitions, swipe indicators | User acquisition |
| `components/booking/seat-map-viewer.tsx` | Add seat hover tooltip, selection pulse animation, better mobile zoom UX | Core booking flow |
| `components/booking/countdown-timer.tsx` | Visual urgency design (color gradient as time decreases) | Conversion |
| `components/layout/gnb.tsx` | Modernize header design, add scroll-based transparency | Brand perception |
| `components/layout/mobile-tab-bar.tsx` | Add micro-interactions, active state animation | Mobile UX |
| `components/performance/*.tsx` | Card hover effects, image loading transitions | Browse experience |

#### Shared Transition Utilities (New)

Add to `globals.css`:

```css
@theme {
  /* Motion tokens */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### Component Changes Summary

| Component | Change Type | Details |
|-----------|-------------|---------|
| `globals.css` | **MODIFY** | Add motion tokens, optional dark mode tokens |
| `components/ui/*.tsx` | **MINOR MODIFY** | Style-only changes, no API changes |
| `components/home/banner-carousel.tsx` | **MODIFY** | Swiper config updates, autoplay, indicators |
| `components/booking/seat-map-viewer.tsx` | **MODIFY** | Tooltip, animation, mobile gesture improvements |
| `components/layout/gnb.tsx` | **MODIFY** | Scroll behavior, visual refresh |
| `components/layout/mobile-tab-bar.tsx` | **MODIFY** | Micro-interactions |
| NEW `components/ui/transition.tsx` | **NEW** (optional) | Shared transition wrapper if pattern repeats |

---

## Cross-Cutting: New Shared Modules

The feature additions reveal a need for two new shared modules:

### ValkeyModule (Shared)

Currently, the Valkey/Redis client is embedded in BookingModule. Multiple modules now need it:

```
NEW: common/valkey/
  |- valkey.module.ts (Global module, exports VALKEY_CLIENT)
  |- valkey.provider.ts (Connection factory + InMemoryRedis fallback)
  |- valkey.health.ts (Terminus health indicator)

Consumers:
  - BookingModule (seat locking, real-time)
  - SmsModule (rate limiting)
  - HealthModule (Valkey health check)
  - Future: CacheModule (performance catalog caching)
```

### JobsModule (Shared)

pg-boss integration for scheduled tasks:

```
NEW: common/jobs/
  |- jobs.module.ts (Global module, exports PG_BOSS)
  |- pg-boss.provider.ts (Lifecycle management)
  |- stats-refresh.job.ts (Materialized view refresh)
  |- Future: seat-lock-cleanup.job.ts, notification.job.ts
```

---

## Build Order (Dependency-Driven)

```
Phase 1: Foundation (no feature dependencies)
  |- ValkeyModule extraction (shared module)
  |- pg-boss integration (JobsModule)
  |- R2 production setup (operational, not code)

Phase 2: Valkey Migration (depends on ValkeyModule)
  |- Swap providers in BookingModule
  |- Update Socket.IO adapter
  |- Cloud Run VPC networking
  |- Health check update

Phase 3: Feature Integration (depends on ValkeyModule + JobsModule)
  |- SMS rate limiting (needs ValkeyModule)
  |- SMS production credentials
  |- Admin stats backend (needs JobsModule + materialized views)
  |- Admin dashboard frontend

Phase 4: UX Polish (independent, can parallel with Phase 3)
  |- Motion tokens
  |- Component-by-component refinement
  |- SVG seat map UX
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating a CacheModule Abstraction Too Early
**What:** Building a generic caching layer (Redis -> Cache interface -> consumers) before knowing cache patterns.
**Why bad:** Abstractions before patterns crystallize create leaky abstractions. The booking Lua scripts need raw Redis commands, not a cache interface.
**Instead:** Use the Valkey client directly. If a caching pattern emerges (e.g., performance catalog cache), extract then.

### Anti-Pattern 2: Materialized Views via Drizzle Schema
**What:** Defining materialized views using `pgMaterializedView()` in Drizzle schema files.
**Why bad:** Drizzle's materialized view support has migration generation bugs, no index support, and dependency ordering issues.
**Instead:** Define views in raw SQL migrations. Query with `db.execute(sql\`...\`)`.

### Anti-Pattern 3: WebSocket for Admin Dashboard Real-Time
**What:** Adding a Socket.IO namespace for admin dashboard to show live stats.
**Why bad:** 1 admin user does not justify WebSocket complexity. Polling every 30-60 seconds is simpler and sufficient.
**Instead:** TanStack Query with `refetchInterval: 30000` for KPI cards.

### Anti-Pattern 4: Splitting the Monorepo for Admin
**What:** Creating `apps/admin` as a separate Next.js app.
**Why bad:** 1-person team, shared auth, shared components. Separate app doubles build/deploy complexity.
**Instead:** Keep `/admin` as route group in `apps/web`. The existing `LayoutShell` conditional rendering pattern works well.

### Anti-Pattern 5: Over-Engineering SMS Provider Abstraction
**What:** Building an SMS provider interface with pluggable Twilio/CoolSMS/Aligo adapters.
**Why bad:** Twilio is already integrated. YAGNI until volume justifies switching.
**Instead:** Keep the current Twilio-specific implementation. If switching providers later, it is a single service file replacement.

---

## Scalability Considerations

| Concern | Current (v1.0) | v1.1 Target | At 10K users |
|---------|----------------|-------------|-------------|
| Redis/Valkey | Upstash free tier | Memorystore shared-core-nano (1.12GB, 5K max clients) | Sufficient for seat locking. Scale to standard-small if needed. |
| Asset serving | Local files | R2 + Cloudflare Cache (unlimited cache, zero egress) | No changes needed. Cloudflare handles scale. |
| DB queries (admin) | Direct queries | Direct + materialized views | Materialized views prevent expensive joins on live tables. |
| SMS | Dev mock | Twilio Verify (~$0.10/verification) | At 10K users, ~$100/day. Consider Korean SMS provider at this scale. |
| WebSocket | Single Cloud Run instance | Valkey pub/sub adapter | Multi-instance broadcasting works with iovalkey + @socket.io/redis-adapter. |

---

## Sources

### Valkey / Memorystore
- [Memorystore for Valkey Networking (PSC only)](https://docs.cloud.google.com/memorystore/docs/valkey/networking) -- HIGH confidence
- [Cloud Run Direct VPC Egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc) -- HIGH confidence
- [Memorystore Valkey Node Specifications](https://docs.cloud.google.com/memorystore/docs/valkey/instance-node-specification) -- HIGH confidence
- [iovalkey GitHub (ioredis fork for Valkey)](https://github.com/valkey-io/iovalkey) -- HIGH confidence
- [Memorystore Valkey Client Library Samples](https://docs.cloud.google.com/memorystore/docs/valkey/client-library-code-samples) -- HIGH confidence
- [Socket.IO Redis Adapter docs](https://socket.io/docs/v4/redis-adapter/) -- HIGH confidence

### R2 / Cloudflare
- [R2 Public Buckets docs](https://developers.cloudflare.com/r2/buckets/public-buckets/) -- HIGH confidence
- [R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- HIGH confidence
- [R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/) -- HIGH confidence

### SMS
- [Twilio Verify Pricing](https://www.twilio.com/en-us/verify/pricing) -- HIGH confidence

### Admin Dashboard
- [Drizzle ORM Views docs](https://orm.drizzle.team/docs/views) -- HIGH confidence
- [Drizzle materialized view bugs: #3179, #4520, #2976](https://github.com/drizzle-team/drizzle-orm/issues/3179) -- HIGH confidence
- [pg-boss GitHub](https://github.com/timgit/pg-boss) -- HIGH confidence
- [NestJS + Drizzle Views (wanago.io)](https://wanago.io/2024/08/05/api-nestjs-drizzle-orm-views-postgresql/) -- MEDIUM confidence
