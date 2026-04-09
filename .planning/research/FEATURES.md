# Feature Landscape

**Domain:** Live entertainment ticket booking platform (v1.1 milestone features)
**Researched:** 2026-04-09
**Scope:** Valkey migration, R2 production, SMS verification, admin dashboard, UX modernization

---

## Table Stakes

Features that are expected / mandatory for the v1.1 milestone. Missing any means the platform feels incomplete or amateurish for a production-grade service.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| **Valkey: Seat locking (SET NX + TTL)** | Core booking flow breaks without it. Must survive migration 1:1. | Low | booking.service.ts Lua scripts, redis.provider.ts |
| **Valkey: Socket.IO pub/sub relay** | Multi-instance real-time seat sync. Existing redis-io.adapter.ts. | Low | ioredis provider, @socket.io/redis-adapter |
| **Valkey: Session/cache layer** | Performance catalog caching, rate-limit counters. Expected in production infra. | Low | New -- currently no caching layer exists |
| **R2: Poster image upload from admin** | Admin already has SVG/poster upload. Must work with real R2, not just local fallback. | Low | upload.service.ts (already has S3Client code) |
| **R2: SVG seat map upload + serving** | Seat maps are core UX. Must serve from CDN, not local filesystem. | Low | upload.service.ts, seat-map-viewer.tsx fetches svgUrl |
| **R2: CDN serving via custom domain** | Production images should load fast via CDN. Users expect sub-second poster loads. | Medium | Cloudflare DNS + R2 public bucket config |
| **SMS: OTP send + verify flow** | Phone verification is standard for Korean ticketing. Already in schema (isPhoneVerified). | Medium | sms.service.ts (Twilio skeleton exists), sms.controller.ts |
| **SMS: Rate limiting per phone** | Prevent SMS pumping / toll fraud. Standard security measure. | Low | Twilio Verify built-in limits + application-level |
| **SMS: Dev mock mode preservation** | Existing dev mock (code 000000) must keep working in dev environment. | Low | sms.service.ts isDevMode pattern |
| **Admin dashboard: Today's summary cards** | Any admin expects at-a-glance KPIs (bookings, revenue, cancels). Already partially exists. | Low | admin-stat-card.tsx, admin-booking-dashboard.tsx |
| **Admin dashboard: Booking statistics** | Performance-level booking data (fill rate, revenue per show). Expected for content management. | Medium | reservations + payments schema, new aggregation queries |
| **UX: Mobile touch target compliance** | 44px minimum touch targets on seat map and buttons. 58%+ of ticketing is mobile. | Low | seat-map-viewer.tsx, seat-map-controls.tsx |
| **UX: Skeleton loading states** | Already partially implemented. Full coverage expected for all async pages. | Low | Existing skeleton pattern, extend to new admin pages |

## Differentiators

Features that set Grapit apart from basic implementations. Not strictly required but create meaningful quality improvement.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Admin: Revenue trend charts** | Visual sales trends (daily/weekly) help admin make informed decisions about promotions and scheduling. Most small ticketing platforms lack this. | Medium | Use shadcn/ui chart components (Recharts-based). Data exists in payments table (paidAt, amount). |
| **Admin: Genre breakdown visualization** | Pie/donut chart showing booking distribution by genre. Helps prioritize content acquisition. | Low | Aggregate from performances.genre + reservations join. |
| **Admin: Popular performances ranking** | Top 10 by booking count or revenue. Quick insight into what sells. | Low | Simple SQL aggregation from reservations + performances. |
| **Admin: Payment method distribution** | Know which payment methods users prefer (card vs KakaoPay vs NaverPay). Informs PG negotiation. | Low | Aggregate from payments.method. |
| **SVG seat map: Orphan seat prevention** | Algorithm that warns admin when seat selection would leave orphan (single isolated) seats. Increases fill rate 3-5%. | High | New logic in booking flow. Must analyze seat adjacency from SVG data-seat-id topology. |
| **SVG seat map: Stage orientation indicator** | "STAGE" label at top of seat map for orientation. Users get confused about which direction they face. | Low | Inject text element into processed SVG in seat-map-viewer.tsx. |
| **SVG seat map: Minimap navigator** | Small overview showing current viewport position when zoomed in. Helps orientation on large venue maps. | Medium | Overlay on TransformWrapper, mirror viewport bounds. |
| **UX: Seat selection haptic feedback (mobile)** | Vibration API on seat tap. Subtle tactile confirmation. | Low | navigator.vibrate(10) on successful seat click. |
| **UX: Animated seat state transitions** | Smooth color transitions when seats change state (available -> selected -> locked). Currently uses instant style changes. | Low | CSS transitions on fill attribute. processedSvg already sets styles inline. |
| **R2: Presigned URL with content-type validation** | Reject wrong file types at S3 level, not just application level. Defense in depth. | Low | Already using PutObjectCommand with ContentType. Enforce on validation. |
| **Valkey: Connection pooling with health checks** | Better resilience than current single-connection ioredis setup. Cloud Run auto-scaling means many instances. | Medium | Configure ioredis pool + @nestjs/terminus health check. |

## Anti-Features

Features to explicitly NOT build in v1.1. Each has been considered and rejected with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full real-time dashboard (WebSocket updates)** | Overkill for a 1-person admin. The admin is checking stats 2-3 times/day, not monitoring a live wall. Adds WebSocket complexity to admin pages. | Polling with TanStack Query (refetchInterval: 60s). Add real-time in a future milestone if needed. |
| **Excel/CSV export from dashboard** | Nice-to-have but significant effort (streaming large datasets, file generation). Not core for v1.1. | Phase 2. Use browser copy-paste or screenshot for now. |
| **Advanced analytics (funnel analysis, cohorts)** | Requires significant data engineering. Not enough booking volume yet to make it meaningful. | Track basic KPIs. Add funnel analysis when monthly bookings exceed 1,000. |
| **Valkey Cluster mode** | Single node with 1GB is sufficient for current scale (<100 concurrent bookings). Cluster adds operational complexity. | Start with single-node Memorystore for Valkey. Migrate to cluster if latency degrades. |
| **Custom Valkey Lua scripts rewrite** | Existing Lua scripts for seat locking work with Valkey as-is (wire-compatible). No rewrite needed. | Test existing scripts against Valkey. Fix only if tests fail. |
| **SMS fallback providers** | Multi-provider SMS routing is premature. Twilio Verify has 99.95% uptime. | Stick with Twilio. Add NHN Cloud/Solapi fallback only if delivery issues arise. |
| **PASS real-name verification** | Heavy regulatory integration (통신사 본인인증). Not needed at this stage. Out of scope per PROJECT.md. | Phone SMS OTP is sufficient identity verification for ticketing. |
| **Admin RBAC (role-based access control)** | Currently 1 admin. RBAC infrastructure for 1 user is pure overhead. | Single admin role check (`user.role === 'admin'`). Add RBAC when team grows. |
| **Dark mode for admin** | Admin is internal tool. No user-facing UX benefit. | Defer indefinitely. Use light theme. |
| **Inline SVG seat map editor** | Explicitly out of scope per PROJECT.md. 4-8 weeks effort. | Keep using external tool (Figma/Illustrator) + upload flow. |
| **R2 image optimization (resize/WebP conversion)** | Cloudflare Images service costs extra. Sharp on Cloud Run adds build complexity. | Require admin to upload already-optimized images. Add guidelines for poster dimensions (800x1200). Use Next.js Image component for client-side optimization. |
| **SMS verification for every login** | Friction kills conversion. SMS OTP should be one-time phone verification, not MFA. | Verify phone once during registration. Use JWT tokens for subsequent logins. |

## Feature Dependencies (v1.1 specific)

```
Infrastructure Foundation
  |
  +-> Valkey Migration (must be first -- everything depends on Redis)
  |     |
  |     +-> Seat locking verification (existing Lua scripts)
  |     +-> Socket.IO pub/sub adapter reconnection
  |     +-> Cache layer for performance catalog
  |
  +-> R2 Production Integration (can parallel with Valkey)
  |     |
  |     +-> R2 credentials (API key generation)
  |     +-> Presigned URL upload (existing code, just needs config)
  |     +-> CDN custom domain setup (Cloudflare DNS)
  |     +-> Migrate existing local-mode uploads
  |
  +-> SMS Real Integration (independent)
  |     |
  |     +-> Twilio account + Verify Service setup
  |     +-> Rate limiting middleware
  |     +-> Frontend OTP input UI polish
  |     +-> Phone verification flow in registration
  |
  +-> Admin Dashboard (depends on existing data, can parallel)
  |     |
  |     +-> Summary stats API endpoints
  |     +-> Chart components (shadcn/ui + Recharts)
  |     +-> Genre/revenue/booking trend visualizations
  |     +-> Popular performances ranking
  |
  +-> UX Modernization (mostly independent, some depends on R2)
        |
        +-> Seat map UX improvements (stage indicator, animations)
        +-> Mobile touch optimization
        +-> Loading state polish
        +-> Image loading from R2 CDN (depends on R2 integration)
```

## Feature Detail: Valkey Migration

### What Must Be Preserved (1:1 behavior)

| Behavior | Current Implementation | Valkey Expectation |
|----------|----------------------|-------------------|
| Seat lock (SET NX + EX) | Upstash Redis HTTP + Lua script | Wire-compatible. ioredis connects to Valkey endpoint directly. |
| Seat unlock (atomic DEL + SREM) | Lua script via `eval()` | Lua scripting supported in Valkey 7.2+. |
| User seat count tracking (SADD + SCARD) | Redis Set per user-showtime | Identical behavior. |
| Locked seats set (SMEMBERS) | Redis Set per showtime | Identical behavior. |
| TTL-based auto-expiry | SET EX 600 | Identical behavior. |
| Socket.IO pub/sub broadcast | ioredis TCP connection to Redis | Change endpoint URL. ioredis connects to Valkey transparently. |
| InMemoryRedis dev fallback | Custom class in redis.provider.ts | Keep as-is. Only production changes. |

### What Improves

| Improvement | Detail |
|-------------|--------|
| Cost | Memorystore for Valkey pricing is generally lower than Upstash pay-per-request at production scale. No per-request billing. |
| Latency | Same VPC as Cloud Run (asia-northeast3). No HTTP overhead like Upstash REST API. Sub-millisecond latency. |
| Dual client elimination | Can use single ioredis client for both key/value AND pub/sub. Removes need for @upstash/redis HTTP client entirely. |
| Connection stability | Persistent TCP in same VPC vs. HTTP-over-internet to Upstash. More reliable for Lua script execution. |
| SLA | 99.99% availability SLA with Memorystore. |

### Migration Scope

- **redis.config.ts**: Replace Upstash env vars with Valkey endpoint. Simplify to single connection string.
- **redis.provider.ts**: Remove `@upstash/redis` provider. Unify on ioredis for all operations.
- **booking.service.ts**: Change `Redis` type imports from `@upstash/redis` to ioredis. Lua `eval()` API differs slightly (ioredis uses positional args, Upstash uses named params).
- **redis-io.adapter.ts**: Change connection URL only. No code changes.
- **package.json**: Remove `@upstash/redis` dependency.
- **Environment variables**: Replace `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` with single `VALKEY_URL` or `REDIS_URL`.

## Feature Detail: R2 Production Integration

### Current State

The `upload.service.ts` already has the full R2 integration code with S3Client, PutObjectCommand, and presigned URL generation. It falls back to local filesystem when `R2_ACCOUNT_ID` is not configured. This is a configuration-complete, code-ready feature.

### What Needs to Happen

| Task | Detail | Complexity |
|------|--------|------------|
| R2 API key generation | Create API token in Cloudflare dashboard with `Object Read & Write` permission | Config only |
| Environment variables | Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Config only |
| Public bucket or custom domain | Enable public access on R2 bucket OR connect custom domain (e.g., `assets.grapit.kr`) | Config |
| CORS configuration | Allow browser PUT from web domain for presigned URL uploads | Config |
| Content-type enforcement | Already implemented in `generatePresignedUrl`. Validate extension whitelist (jpg, png, webp, svg). | Low |
| CDN cache headers | Set `Cache-Control: public, max-age=31536000, immutable` for poster images (content-addressed by UUID key) | Low |
| Migrate existing uploads | One-time script to copy any local `uploads/` files to R2 bucket | Low |

### Serving Strategy

**Use public bucket with custom domain** because:
- Poster images and SVG seat maps are public content (no access control needed).
- Custom domain enables Cloudflare CDN caching automatically.
- Presigned URLs cannot be used with custom domains (Cloudflare limitation). Use presigned URLs only for uploads (S3 API endpoint), serve via custom domain.
- Zero egress cost (R2's key advantage).

### Upload Flow (Production)

```
Admin uploads poster/SVG:
  1. Frontend calls POST /api/v1/admin/upload/presign { folder, contentType, extension }
  2. Backend generates presigned PUT URL (600s TTL) + public URL
  3. Frontend PUTs file directly to R2 presigned URL
  4. Frontend saves public URL to performance record
  5. Users access via https://assets.grapit.kr/posters/{uuid}.jpg (CDN-cached)
```

## Feature Detail: SMS Verification

### Current State

Full Twilio Verify integration exists in `sms.service.ts` with dev mock mode. Controller validates phone format (`01[016789]\d{7,8}$`) and 6-digit code. The `isPhoneVerified` boolean exists in users schema.

### What Needs to Happen

| Task | Detail | Complexity |
|------|--------|------------|
| Twilio account setup | Sign up, get Verify Service SID | Config only |
| Environment variables | Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Config only |
| Application-level rate limiting | 5 sends per phone per hour, 3 sends per IP per 10 minutes | Medium |
| Frontend OTP input polish | 6-digit auto-focusing input, countdown timer (60s resend), clear error states | Medium |
| Registration flow integration | After phone input, trigger OTP -> verify -> set `isPhoneVerified = true` | Low |
| Resend cooldown | 60-second countdown before allowing resend. Visual timer on frontend. | Low |
| Cost awareness | Twilio Verify: $0.05/successful verification + carrier SMS fee. Korea SMS ~$0.03-0.05/msg. Budget ~$0.08-0.10 per verification. | N/A |

### Rate Limiting Strategy

| Limit | Scope | Value | Enforcement |
|-------|-------|-------|-------------|
| Send attempts per phone | Per phone number | 5 per hour | Twilio Verify built-in + application guard |
| Send attempts per IP | Per IP address | 10 per 10 minutes | NestJS ThrottlerGuard or custom middleware |
| Verify attempts per phone | Per phone number | 5 per code | Twilio Verify built-in (auto-invalidates after 5 failures) |
| Daily send limit per phone | Per phone number | 10 per day | Application-level counter (Valkey INCR + EXPIRE 86400) |

### Provider Decision: Twilio Verify

Stick with Twilio because:
- Code already written and tested in dev mock mode.
- Twilio Verify handles OTP generation, delivery, retry, and validation server-side. No need to manage OTP state.
- Built-in rate limiting and fraud detection.
- Korean domestic providers (NHN Cloud, Solapi, CoolSMS) are cheaper per SMS (~10-15 KRW vs ~50-80 KRW for Twilio) but require building OTP state management from scratch.
- At Grapit's scale (likely <100 verifications/day initially), cost difference is negligible (~$5/day max).
- Switch to domestic provider only if monthly SMS cost exceeds $500.

## Feature Detail: Admin Dashboard

### Current State

Admin has:
- 3 stat cards (total bookings, total revenue, cancel rate) in `admin-booking-dashboard.tsx`
- Booking list with search/filter
- Booking detail modal with refund action
- Performance CRUD, showtime management, banner management

### What to Add

| Metric | Data Source | Visualization | Priority |
|--------|------------|---------------|----------|
| Today's bookings count | `COUNT(reservations) WHERE createdAt >= today AND status = 'CONFIRMED'` | Stat card | P0 |
| Today's revenue | `SUM(payments.amount) WHERE paidAt >= today AND status = 'DONE'` | Stat card | P0 |
| Today's cancellation count | `COUNT(reservations) WHERE cancelledAt >= today` | Stat card | P0 |
| Active performances count | `COUNT(performances) WHERE status IN ('selling', 'closing_soon')` | Stat card | P0 |
| Booking trend (7d/30d) | Daily aggregation from reservations.createdAt | Line chart | P1 |
| Revenue trend (7d/30d) | Daily aggregation from payments.paidAt + amount | Area chart | P1 |
| Genre distribution | Group by performances.genre through reservations JOIN | Donut chart | P1 |
| Payment method breakdown | Group by payments.method | Bar chart | P1 |
| Top 10 performances | Rank by reservation count or revenue | Table/list | P1 |
| Seat fill rate per performance | (sold seats / total seats) per active performance | Progress bar | P2 |
| New user registrations (7d) | COUNT(users) WHERE createdAt >= 7d ago | Stat card | P2 |

### Chart Library Decision

Use **shadcn/ui chart components** (built on Recharts) because:
- Already using shadcn/ui for all admin components (buttons, inputs, selects, modals).
- Consistent design language. No extra styling needed.
- Recharts is the de facto standard for React charts.
- Tremor is overkill -- it provides its own design system that conflicts with existing shadcn/ui.
- Copy-paste components from shadcn/ui docs. No new dependency installation needed (Recharts is the only addition).

### Dashboard Layout

```
+------+------+------+------+
| Today| Today| Today|Active|
| Book | Rev  |Cancel|Perfs |
+------+------+------+------+
|  Booking Trend (Line)     |  Genre Split  |
|  7d / 30d toggle          |  (Donut)      |
+---------------------------+---------------+
|  Revenue Trend (Area)     | Pay Methods   |
|  7d / 30d toggle          |  (Bar)        |
+---------------------------+---------------+
|  Top 10 Performances (Table)              |
|  rank | title | bookings | revenue | fill |
+-------------------------------------------+
```

## Feature Detail: UX Modernization

### Seat Map UX Improvements

| Improvement | Current State | Target State | Complexity |
|-------------|--------------|--------------|------------|
| Stage indicator | None -- users don't know which end is the stage | "STAGE" text injected at top of SVG with icon | Low |
| Tier color legend | No legend -- users must guess what colors mean | Floating legend showing tier name + color + price | Low |
| Seat hover tooltip | Shows "VIP A열 3번" on hover | Add price to tooltip: "VIP A열 3번 - 110,000원" | Low |
| Selection animation | Instant fill change + checkmark | CSS transition (200ms ease) for fill color change | Low |
| Zoom to selected area | User manually zooms/pans | "Zoom to selection" button that frames all selected seats | Medium |
| Mobile pinch UX | Works but TransformWrapper defaults are generic | Tune initialScale for venue size, set smooth deceleration | Low |
| Accessibility keyboard nav | Not implemented | Tab/arrow key navigation between seats, ARIA labels per seat | High |
| Orphan seat warning | No logic | Detect if selection would leave isolated single seats. Show warning toast. | High |

### General UX Improvements

| Improvement | Detail | Complexity |
|-------------|--------|------------|
| Page transition animations | Fade/slide between booking steps (date -> seat -> payment) | Low |
| Success/error toast consistency | Standardize all toast messages with consistent Korean wording and icons | Low |
| Form validation UX | Show validation inline (not just on submit). Use react-hook-form formState.errors with field-level display. | Low |
| Image lazy loading | Next.js Image component with blur placeholder for poster images | Low |
| Empty state illustrations | "No results" and "No bookings" states with helpful illustrations instead of plain text | Low |
| Admin table improvements | Sortable columns, sticky headers, responsive stacking on mobile | Medium |
| Breadcrumb navigation (admin) | Current page location indicator in admin (e.g., Admin > Performances > Edit) | Low |

### Design Trend Alignment

Based on 2025-2026 ticketing platform trends:

| Trend | Grapit Implementation | Priority |
|-------|----------------------|----------|
| Glassmorphism / frosted glass | Use for overlay panels (seat selection sheet, booking summary) with `backdrop-blur` | Low |
| Micro-interactions | Seat selection pulse animation, button press scale, loading spinners | Low |
| Content-first layout | Already aligned (poster-centric cards, minimal chrome) | Done |
| 1-step checkout feeling | Already aligned (one-stop flow). Polish with progress indicator. | Low |
| Mobile-first seat selection | Bottom sheet for selected seats (already exists). Add swipe gestures. | Medium |

## v1.1 Prioritized Feature Roadmap Recommendation

### Phase 1: Infrastructure Stabilization
*Valkey + R2 -- zero user-facing changes, all backend*

1. Valkey migration (swap connection, verify Lua scripts, remove @upstash/redis)
2. R2 credential setup + environment variables
3. R2 CORS + custom domain configuration
4. Verify all existing uploads work through R2

### Phase 2: SMS + Admin Dashboard
*User-facing verification + admin visibility*

5. Twilio Verify production setup
6. SMS rate limiting middleware
7. Frontend OTP input UI
8. Dashboard summary API endpoints
9. Dashboard stat cards expansion (4 cards)
10. Dashboard chart components (Recharts via shadcn/ui)

### Phase 3: UX Polish
*Visual and interaction improvements*

11. Seat map improvements (stage indicator, legend, tooltip with price)
12. Seat selection animations
13. Admin table improvements (sort, sticky headers)
14. Breadcrumbs + empty states
15. Mobile touch optimization pass

---

## Sources

- [Valkey Migration from Redis](https://valkey.io/topics/migration/) -- wire compatibility confirmed
- [Memorystore for Valkey GA](https://cloud.google.com/blog/products/databases/announcing-general-availability-of-memorystore-for-valkey) -- pricing, SLA, features
- [Memorystore for Valkey 9.0](https://cloud.google.com/blog/products/databases/memorystore-for-valkey-9-0-is-now-ga) -- latest version info
- [ioredis to Valkey GLIDE Migration Guide](https://github.com/valkey-io/valkey-glide/wiki/Migration-Guide-ioredis) -- API differences
- [Redis vs Valkey 2026](https://dev.to/synsun/redis-vs-valkey-in-2026-what-the-license-fork-actually-changed-1kni) -- ecosystem status
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- upload best practices
- [R2 Public Buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) -- CDN serving
- [R2 Public vs Presigned discussion](https://community.cloudflare.com/t/general-advice-concerning-public-r2-buckets-vs-pre-signed-urls/718993) -- serving strategy
- [Twilio Verify Best Practices](https://www.twilio.com/docs/verify/developer-best-practices) -- OTP flow
- [Twilio Verify Rate Limits](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts) -- built-in limits
- [Twilio Verify Programmable Rate Limits](https://www.twilio.com/docs/verify/api/programmable-rate-limits) -- custom rate limits
- [Twilio Verify Pricing](https://www.twilio.com/en-us/verify/pricing) -- $0.05/verification base
- [Twilio SMS Retry Logic](https://www.twilio.com/en-us/blog/best-practices-retry-logic-sms-2fa) -- retry patterns
- [OTP Rate Limiting Best Practices](https://arkesel.com/otp-expiration-rate-limiting-best-practices/) -- expiration, limits
- [Ticketing KPIs](https://businessplansuite.com/blogs/metrics/online-ticketing) -- dashboard metrics
- [Event Monitoring Dashboard](https://ticketsdata.com/blog/event-monitoring-dashboard) -- real-time metrics patterns
- [Ticketing Platform KPIs](https://financialmodelslab.com/blogs/kpi-metrics/online-event-ticketing-platform) -- financial metrics
- [Interactive Seating Charts](https://softjourn.com/insights/interactive-seating-charts) -- seat map UX trends
- [Ticketing Accessibility](https://inspeerity.com/blog/94-8-of-ticketing-platforms-fail-wcag-2-is-your-seat-map-blocking-users/) -- WCAG compliance
- [Ticketing Industry Trends 2026](https://softjourn.com/insights/top-event-ticketing-industry-trends) -- UX trends
- [Must-Have Ticketing Features 2026](https://softjourn.com/insights/top-ticketing-features) -- feature standards
- [shadcn/ui Charts](https://ui.shadcn.com/docs/components/radix/chart) -- Recharts integration
- [Tremor Dashboard Components](https://www.tremor.so/) -- alternative considered
- Existing codebase analysis: booking.service.ts, redis.provider.ts, upload.service.ts, sms.service.ts, admin.service.ts, admin-booking-dashboard.tsx
