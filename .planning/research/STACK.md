# Technology Stack: v1.1 Additions & Changes

**Project:** Grapit -- Ticket Booking Platform
**Researched:** 2026-04-09
**Scope:** Stack changes for v1.1 milestone ONLY (Valkey migration, R2 production, SMS verification, admin dashboard, UX modernization)
**Overall Confidence:** HIGH

> This document covers NEW and CHANGED stack elements for v1.1. The existing v1.0 stack (Next.js 16, NestJS 11, Drizzle ORM, PostgreSQL 16, etc.) is validated and unchanged.

---

## 1. Google Valkey (Memorystore for Valkey) -- Redis Replacement

### What Changes

| Remove | Add | Purpose |
|--------|-----|---------|
| `@upstash/redis` ^1.37.x | `ioredis` ^5.10.x (KEEP, promote to primary) | All Redis operations: seat locking, cache, pub/sub |
| Upstash Redis (serverless) | Google Memorystore for Valkey (managed) | Managed Valkey in GCP Seoul VPC |

### Recommended Client: ioredis (already installed)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ioredis | ^5.10.x | Valkey client (all operations) | Already in the project for Socket.IO pub/sub. Valkey is wire-compatible with Redis 7.2 -- ioredis works without code changes. Full TypeScript support, cluster mode, Lua scripting, pub/sub. Eliminates the dual-client pattern (@upstash/redis HTTP + ioredis TCP) by unifying on a single TCP client. | HIGH |
| Google Memorystore for Valkey | 7.2 | Managed Valkey instance | GCP Seoul region (asia-northeast3), Private Service Connect for Cloud Run connectivity, automatic failover, fully compatible with Redis 7.2 commands including Lua scripting. | HIGH |

**Why ioredis, not node-redis or iovalkey:**
- **ioredis** is already installed (`^5.10.1`) and powers the Socket.IO adapter. Promoting it to handle ALL Redis operations eliminates one dependency (`@upstash/redis`) and simplifies the architecture from dual-client to single-client.
- **node-redis** (v5.11.x) is Google's officially recommended client for Memorystore for Valkey. However, switching from ioredis to node-redis would require rewriting the Socket.IO adapter integration AND the booking Lua scripts. The `@socket.io/redis-adapter` has better documentation and testing with ioredis.
- **iovalkey** (v0.3.3, Valkey's official fork of ioredis) is too immature -- last published 9 months ago, low adoption. ioredis itself is fully compatible with Valkey 7.2, making iovalkey unnecessary.

### Migration Impact

The booking service uses `@upstash/redis`'s `.eval()` for 3 Lua scripts (LOCK_SEAT, UNLOCK_SEAT, GET_VALID_LOCKED_SEATS). These use standard Redis commands (SET, GET, DEL, SADD, SREM, SMEMBERS, EXISTS, EXPIRE) -- all 100% compatible with Valkey. The migration is a client swap, not a logic rewrite.

**Key config change:** Replace `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars with a single `REDIS_URL` pointing to Memorystore for Valkey's primary endpoint (`redis://<PRIMARY_ENDPOINT>:6379`).

### Infrastructure Requirements

- Memorystore for Valkey instance in asia-northeast3 (Seoul)
- VPC connector or Private Service Connect for Cloud Run -> Valkey connectivity
- Node type: `highmem-medium` (1 vCPU, 4 GB) is sufficient for initial load; scale up as needed
- Estimated cost: ~$0.05-0.10/hr per node (region-specific pricing, verify on GCP console)

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| @upstash/redis | Being replaced -- HTTP transport adds latency vs TCP, Upstash adds vendor dependency outside GCP |
| iovalkey | v0.3.3, immature, low adoption (ioredis works fine with Valkey) |
| node-redis | Would require rewriting Socket.IO adapter integration; ioredis is already wired in |
| valkey-glide | Rust-based client with Node.js bindings -- experimental, unnecessary complexity |
| Upstash Redis (serverless) | Replaced by Memorystore for Valkey for GCP-native VPC connectivity and lower latency |

---

## 2. Cloudflare R2 -- Production Integration

### What Changes

No new packages. The existing `@aws-sdk/client-s3` (^3.1020.x) and `@aws-sdk/s3-request-presigner` (^3.1020.x) already handle R2 operations. The `UploadService` is already correctly implemented with presigned URLs.

### Production Configuration Needed

| Item | Current State | Production State |
|------|--------------|------------------|
| R2 API Token | Not provisioned | Scoped token: Object Read + Write on specific bucket |
| CORS Policy | Not configured | AllowedOrigins: production domain + localhost:3000 |
| Bucket | Not created | Production bucket separate from dev |
| Custom Domain | Not configured | Optional: CDN via Cloudflare custom domain for public reads |
| Env Vars | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | All set in Cloud Run env or Secret Manager |

### CORS Configuration (Critical)

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

**Important:** R2 does NOT support `"*"` in `AllowedHeaders` (unlike AWS S3). Always specify exact headers like `"content-type"`.

### Presigned URL Strategy

The existing `UploadService.generatePresignedUrl()` is correct. For production:
- Presigned URLs work on the S3 API domain (`<ACCOUNT_ID>.r2.cloudflarestorage.com`) only -- NOT on custom domains
- Public reads via custom domain (Cloudflare-managed DNS required)
- Expiry: 600 seconds (10 min) is appropriate for admin uploads

### What NOT to Add

| Technology | Why Not |
|------------|---------|
| Any R2-specific SDK | R2 is S3-compatible; @aws-sdk/client-s3 is the correct SDK |
| Cloudflare Workers (for upload) | Unnecessary -- presigned URLs handle browser uploads directly to R2 |
| Cloudflare WAF HMAC validation | Pro plan required; presigned URLs are sufficient for auth |

---

## 3. SMS Verification -- Korean SMS Provider

### Recommended Provider: SOLAPI (CoolSMS)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| solapi | ^5.5.x | SMS sending SDK | Korean SMS provider (CoolSMS rebrand). Native Korean carrier support, 18 won/SMS (~$0.013), no monthly fee, REST API, Node.js SDK. 100% Korean market focus -- handles Korean carriers (SKT, KT, LGU+) natively without international routing overhead. | HIGH |

### Provider Comparison

| Criterion | SOLAPI/CoolSMS (Chosen) | NHN Cloud SMS | Twilio Verify |
|-----------|------------------------|---------------|---------------|
| Price per SMS | 18 won (~$0.013) | 9.9 won (~$0.007) | $0.0494 (~67 won) |
| Monthly fee | None | None | None |
| Korean carrier | Native (direct connection) | Native (direct connection) | International routing |
| Node.js SDK | `solapi` npm (v5.5.x) | REST API only (no official SDK) | `twilio` npm (official) |
| Setup complexity | Low (API key only) | Medium (project + appkey + secret) | Low (account SID + auth token) |
| Auth SMS support | Yes (standard SMS pricing) | Yes (auth-specific validation) | Yes (Verify API, turnkey OTP) |
| Kakao Notification | Yes (built-in) | Yes (separate service) | No |
| DX (developer experience) | Good -- simple API, Korean docs | OK -- more enterprise-oriented | Excellent -- best docs globally |
| Existing code compatibility | Easy -- replace mock with real API call | Medium -- different API structure | Already in .env (Twilio vars exist) |

**Why SOLAPI over Twilio:** The project already has Twilio env vars (`TWILIO_ACCOUNT_SID`, etc.) from the initial plan, but Twilio charges 3.7x more per SMS for Korea delivery ($0.0494 vs 18 won). For a Korean-focused service, SOLAPI provides native carrier connectivity at 73% lower cost. The dev mock pattern (`000000`) can be replaced with a simple SOLAPI integration.

**Why SOLAPI over NHN Cloud:** NHN Cloud is slightly cheaper (9.9 won vs 18 won) but lacks an official Node.js SDK -- you'd need to write a raw HTTP client. SOLAPI's `solapi` npm package provides a tested SDK. For the ~100-1000 SMS/month expected in early stages, the 8 won difference is negligible (~$6/month at 1000 SMS).

### Integration Pattern

```typescript
// sms.service.ts (NestJS provider)
import { SolapiMessageService } from 'solapi';

const messageService = new SolapiMessageService(API_KEY, API_SECRET);
await messageService.sendOne({
  to: phoneNumber,
  from: REGISTERED_SENDER_NUMBER, // Must register with Korean telecom
  text: `[Grapit] Verification code: ${code}`,
});
```

### Required Setup
- SOLAPI account registration (solapi.com)
- 발신번호 등록 (sender number registration -- Korean telecom requirement)
- API Key + API Secret in env vars
- Env vars: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| Twilio Verify | 3.7x more expensive per SMS for Korea; international routing adds latency |
| NHN Cloud SMS | No official Node.js SDK; requires manual HTTP client implementation |
| AWS SNS | Not optimized for Korean carriers; complex IAM setup |
| Firebase Phone Auth | Google's service but adds Firebase dependency; less control over verification flow |
| PASS (본인인증) | Out of scope for v1.1; requires business partnership with identity providers |

---

## 4. Admin Dashboard -- Charting Library

### Recommended: Recharts via shadcn/ui Chart Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| recharts | ^3.8.x | Chart rendering engine | The standard React charting library. v3 rewrote state management for better performance. Declarative, composable API. Works with React 19 (requires react-is override). 30k+ GitHub stars, actively maintained (latest release: 2 weeks ago). | HIGH |
| shadcn/ui Chart | (copy-paste components) | Chart wrappers + theming | shadcn/ui's chart components wrap Recharts with Tailwind CSS theming, ChartTooltip, ChartLegend. Not a separate npm package -- components are copied into the project via `npx shadcn@latest add chart`. Ensures visual consistency with existing UI. Supports React 19 + Tailwind v4. | HIGH |

### Why Not Tremor

Tremor (`@tremor/react`) was initially considered for its dashboard-focused design, but:
- The current stable release (v3.x) requires Tailwind CSS v3.4+; Tailwind v4 support is still in beta
- React 19 support is in beta, not stable
- Adding `@tremor/react` as a dependency creates a version conflict with the project's Tailwind v4.2.x
- shadcn/ui charts provide the same functionality (KPI cards, line/bar/area/donut charts) while using the project's existing Tailwind v4 setup

### react-is Peer Dependency Fix

Recharts v3 with React 19 requires overriding the `react-is` peer dependency:

```json
// package.json (apps/web)
{
  "overrides": {
    "react-is": "^19.0.0"
  }
}
```

### Chart Types for Admin Dashboard

| Chart Type | Use Case | Recharts Component |
|------------|----------|-------------------|
| Line chart | Daily ticket sales trend | `<LineChart>` |
| Bar chart | Revenue by performance/genre | `<BarChart>` |
| Area chart | Cumulative bookings over time | `<AreaChart>` |
| Pie/Donut | Revenue distribution by payment method | `<PieChart>` |
| Composed | Sales vs capacity utilization | `<ComposedChart>` |

### What NOT to Add

| Technology | Why Not |
|------------|---------|
| @tremor/react | Tailwind v4 + React 19 support still in beta; creates version conflicts |
| Chart.js / react-chartjs-2 | Canvas-based, not composable like Recharts; less React-idiomatic |
| ApexCharts | Heavy bundle (~500kb); overkill for admin stats |
| D3 (direct) | Too low-level for dashboard charts; Recharts already wraps D3 |
| Victory | Smaller ecosystem than Recharts; less maintained |
| Nivo | Beautiful but heavy; SSR complexity with Next.js |

---

## 5. UX Modernization -- Design & Component Upgrades

### No New Framework Dependencies

The UX modernization should use existing stack components. Do NOT add a component library (MUI, Ant Design, Chakra UI) -- the project uses Tailwind CSS v4 with custom components, and adding a full component library creates bloat and style conflicts.

### Recommended Additions

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| shadcn/ui (additional components) | latest (copy-paste) | UI primitives | Not an npm dependency -- copy components via CLI. Add: Dialog, Dropdown, Tabs, Tooltip, Popover for admin polish. Built on Radix UI + Tailwind, zero runtime overhead. Already used in 2026 Next.js 16 ecosystem. | HIGH |
| framer-motion | ^12.x | Page transitions + micro-interactions | The standard animation library for React 19. Use for page transitions, modal animations, seat selection feedback. ~35kb but tree-shakeable. Do NOT use for scroll animations (use CSS `scroll-timeline` instead). | MEDIUM |
| @radix-ui/react-* (via shadcn) | latest | Accessible primitives | Headless, accessible, composable. Installed as shadcn/ui dependencies. No direct installation needed. | HIGH |

### SVG Seat Map UX Improvements

No new libraries needed. The existing `react-zoom-pan-pinch` (3.7.x) handles zoom/pan. UX improvements are implementation-level:
- Seat hover tooltips (use Radix Tooltip via shadcn)
- Pinch-to-zoom sensitivity tuning (TransformWrapper props)
- Seat grade color legend overlay
- Selected seats summary panel (sticky bottom on mobile)
- Loading skeleton for SVG fetch

### What NOT to Add

| Technology | Why Not |
|------------|---------|
| MUI / Material UI | Heavy (~300kb), opinionated design system conflicts with Tailwind approach |
| Ant Design | Enterprise-oriented, heavy, CSSinJS conflicts with Tailwind |
| Chakra UI | Another CSS-in-JS approach; redundant with Tailwind |
| Headless UI | Replaced by Radix UI (shadcn/ui's foundation) |
| GSAP | Commercial license for SaaS; framer-motion covers all needs |
| Lottie | Overkill for simple micro-interactions; increases bundle significantly |
| react-spring | Less maintained than framer-motion; smaller ecosystem |

---

## Summary of Package Changes

### Add to apps/api (backend)

```bash
# SMS verification
pnpm add solapi
```

### Add to apps/web (frontend)

```bash
# Charts (admin dashboard)
pnpm add recharts

# Animation (UX modernization)
pnpm add framer-motion

# shadcn/ui chart components (not npm -- CLI copy)
npx shadcn@latest add chart

# React 19 compatibility fix for Recharts
# Add to package.json overrides:
# "react-is": "^19.0.0"
```

### Remove from apps/api (backend)

```bash
# After Valkey migration is complete
pnpm remove @upstash/redis
```

### Keep Unchanged

| Package | Current Version | Notes |
|---------|----------------|-------|
| ioredis | ^5.10.x | Promoted from Socket.IO-only to all Redis operations |
| @socket.io/redis-adapter | ^8.3.0 | Works with Valkey via ioredis |
| @aws-sdk/client-s3 | ^3.1020.x | Already handles R2; no changes needed |
| @aws-sdk/s3-request-presigner | ^3.1020.x | Already handles presigned URLs |

---

## Updated Environment Variables

### Add

| Variable | Used By | Example |
|----------|---------|---------|
| `SOLAPI_API_KEY` | SMS service | `NCSA...` |
| `SOLAPI_API_SECRET` | SMS service | `ABC123...` |
| `SOLAPI_SENDER_NUMBER` | SMS service | `01012345678` |
| `R2_ACCOUNT_ID` | Upload service | `abc123def456...` (Cloudflare account ID) |
| `R2_ACCESS_KEY_ID` | Upload service | `R2 API token access key` |
| `R2_SECRET_ACCESS_KEY` | Upload service | `R2 API token secret` |
| `R2_BUCKET_NAME` | Upload service | `grapit-assets` |
| `R2_PUBLIC_URL` | Upload service | `https://assets.grapit.kr` or R2 public URL |

### Modify

| Variable | Before | After |
|----------|--------|-------|
| `REDIS_URL` | Optional (ioredis for Socket.IO only) | Required (primary Valkey endpoint for ALL Redis operations) |

### Remove

| Variable | Reason |
|----------|--------|
| `UPSTASH_REDIS_REST_URL` | Upstash replaced by Memorystore for Valkey |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash replaced by Memorystore for Valkey |
| `TWILIO_ACCOUNT_SID` | Twilio replaced by SOLAPI |
| `TWILIO_AUTH_TOKEN` | Twilio replaced by SOLAPI |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio replaced by SOLAPI |

---

## Updated Redis Client Strategy

### Before (v1.0): Dual-Client

| Client | Transport | Used For |
|--------|-----------|----------|
| @upstash/redis | HTTP | Seat locking, cache, general key/value |
| ioredis | TCP | Socket.IO Redis adapter (pub/sub only) |

### After (v1.1): Single-Client

| Client | Transport | Used For |
|--------|-----------|----------|
| ioredis | TCP | ALL operations: seat locking, cache, pub/sub, Socket.IO adapter |

This simplifies the architecture: one client, one connection pool, one configuration. The InMemoryRedis mock in `redis.provider.ts` remains for local development when `REDIS_URL` is not configured.

---

## Version Pinning Strategy (New Packages)

```json
{
  "solapi": "^5.5",
  "recharts": "~3.8",
  "framer-motion": "~12.0"
}
```

---

## Sources

### Valkey / Redis Migration
- [Memorystore for Valkey overview](https://docs.cloud.google.com/memorystore/docs/valkey/product-overview)
- [Memorystore for Valkey client library code samples](https://docs.cloud.google.com/memorystore/docs/valkey/client-library-code-samples)
- [Memorystore for Valkey pricing](https://cloud.google.com/memorystore/valkey/pricing)
- [Memorystore for Valkey networking](https://docs.cloud.google.com/memorystore/docs/valkey/networking)
- [iovalkey GitHub](https://github.com/valkey-io/iovalkey) -- evaluated and rejected (v0.3.3, immature)
- [Redis vs Valkey in 2026](https://dev.to/synsun/redis-vs-valkey-in-2026-what-the-license-fork-actually-changed-1kni)
- [ioredis -> iovalkey discussion](https://github.com/valkey-io/valkey/issues/329)
- [Socket.IO Redis adapter docs](https://socket.io/docs/v4/redis-adapter/)
- [node-redis vs ioredis comparison](https://oneuptime.com/blog/post/2026-03-31-redis-choose-node-redis-vs-ioredis/view)

### Cloudflare R2
- [R2 Presigned URLs docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 CORS configuration docs](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 Presigned URL CORS guide (Medium)](https://mikeesto.medium.com/pre-signed-urls-cors-on-cloudflare-r2-c90d43370dc4)
- [How to Set Up Cloudflare R2 in 2026](https://www.thefixstack.com/guides/how-to-setup-cloudflare-r2/)

### SMS Verification
- [SOLAPI pricing](https://solapi.com/pricing) -- SMS 18 won, LMS 45 won
- [SOLAPI Node.js SDK GitHub](https://github.com/solapi/solapi-nodejs) -- v5.5.4
- [SOLAPI developer docs](https://solapi.com/developers)
- [NHN Cloud SMS service](https://www.nhncloud.com/kr/service/notification/sms) -- 9.9 won/SMS
- [Twilio SMS pricing for Korea](https://www.twilio.com/en-us/sms/pricing/kr) -- $0.0494/SMS
- [SMS gateways in Korea 2025](https://wp-sms-pro.com/35800/sms-gateway-for-korea/)

### Admin Dashboard Charts
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.8.1
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Recharts React 19 support](https://github.com/recharts/recharts/issues/4558)
- [shadcn/ui Chart component](https://ui.shadcn.com/docs/components/radix/chart)
- [shadcn/ui Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui React 19 support](https://ui.shadcn.com/docs/react-19)
- [Top React chart libraries 2026](https://querio.ai/articles/top-react-chart-libraries-data-visualization)

### UX Modernization
- [shadcn/ui installation for Next.js](https://ui.shadcn.com/docs/installation/next)
- [Next.js 16 admin dashboards with shadcn/ui](https://adminlte.io/blog/nextjs-admin-dashboards-shadcn/)
- [Tremor React (evaluated, rejected)](https://www.tremor.so/) -- Tailwind v4 + React 19 still in beta
