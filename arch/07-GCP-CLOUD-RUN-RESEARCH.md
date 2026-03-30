# GCP Cloud Functions vs Cloud Run Research
> Korean Ticket Booking Platform (Next.js 16 + NestJS 11 + PostgreSQL + Redis)
> Research Date: 2026-03-25

---

## 1. Google Cloud Functions (2nd Gen) / Cloud Run Functions

### 1.1 Rebranding Notice
As of **August 2024**, Google renamed **Cloud Functions (2nd gen)** to **Cloud Run functions** and folded it under the Cloud Run umbrella. Cloud Functions 2nd gen **IS Cloud Run under the hood** -- each function is deployed as a Cloud Run service with Eventarc managing event triggers.

### 1.2 Seoul Region (asia-northeast3)
- **Available**: Cloud Run functions are available in asia-northeast3 (Seoul)
- Seoul is classified as a **Tier 2 pricing region** (approximately 40% more expensive than Tier 1 regions like us-central1)

### 1.3 Runtime Limits (2nd Gen / Cloud Run Functions)
| Resource | Limit |
|---|---|
| Max execution time (HTTP) | **60 minutes** |
| Max execution time (event-driven) | **60 minutes** (was 9 min, now lifted) |
| Max memory | **32 GiB** |
| Max vCPUs | **8 vCPUs** |
| Concurrency per instance | **Up to 1,000** (requires >= 1 full CPU) |
| Default concurrency | **80** |
| Max instances | **100** (default, can be increased) |

### 1.4 Cold Starts (Node.js)
- Typical Node.js cold start: **400-700ms** baseline
- NestJS adds significant overhead due to dependency injection and module loading: estimated **1-3 seconds** total cold start
- **Startup CPU Boost** feature: temporarily doubles CPU during startup to reduce cold start time
- Concurrency setting (up to 1000) means fewer new instances needed, reducing cold start frequency

### 1.5 NestJS Compatibility
- NestJS **can** run as a Cloud Function, but it is NOT the recommended approach
- Requires special bootstrapping: create an Express adapter, initialize the NestJS app, then export the Express handler
- TypeScript config needs `emitDecoratorMetadata` and `experimentalDecorators`
- **Recommended approach**: Deploy NestJS as a **Cloud Run service** (container) rather than a Cloud Function
- Cloud Functions are better suited for lightweight, single-purpose event handlers, not full framework applications

### 1.6 Pricing (2nd Gen = Cloud Run Pricing)
Since 2nd gen functions use Cloud Run pricing:

**Tier 2 (Seoul) -- Request-based (on-demand) CPU allocation:**
| Resource | Rate |
|---|---|
| vCPU-second | $0.00003360 |
| GiB-second (memory) | $0.00000350 |
| Per request (beyond 2M free) | $0.40 per million |
| Networking egress | $0.12 per GB |

**Free Tier (monthly):**
- 180,000 vCPU-seconds
- 360,000 GiB-seconds
- 2,000,000 requests
- 1 GB egress (North America)

**Cost Estimate -- 100k requests/day (3M/month), 200ms avg, 1 vCPU, 512 MiB:**
- CPU: 3M x 0.2s x 1 vCPU = 600,000 vCPU-sec. After free tier (180k): 420,000 x $0.00003360 = **$14.11/mo**
- Memory: 3M x 0.2s x 0.5 GiB = 300,000 GiB-sec. After free tier (360k): **$0.00** (within free tier)
- Requests: 3M - 2M free = 1M x $0.40/M = **$0.40/mo**
- **Total: ~$14.51/mo** (compute only, Seoul Tier 2)

### 1.7 Cloud Functions 2nd Gen vs Cloud Run Services
| Aspect | Cloud Run Functions (2nd gen) | Cloud Run Services |
|---|---|---|
| Underlying infra | Cloud Run | Cloud Run |
| Deployment | Source code, auto-containerized | Docker container you build |
| Configuration | Limited (via function config) | Full control (Dockerfile, env, etc.) |
| Event triggers | Built-in via Eventarc | Manual setup needed |
| Custom runtime | No (Node.js, Python, Go, etc.) | Yes (any language/framework) |
| WebSockets | Not supported | Supported |
| Health checks | Automatic | Configurable (startup, liveness, readiness) |
| Best for | Event-driven glue code | Full services (NestJS, Next.js) |

**Verdict**: For a NestJS backend, **Cloud Run Services** is the correct choice. Cloud Functions are appropriate only for ancillary event-driven tasks (e.g., image processing triggers, Pub/Sub consumers).

---

## 2. Google Cloud Run (Services)

### 2.1 Seoul Region (asia-northeast3)
- **Fully available** in asia-northeast3 (Seoul)
- **Tier 2 pricing** region (~40% premium over Tier 1)
- 3 availability zones in Seoul region

### 2.2 Always-On vs Scale-to-Zero

**Scale-to-Zero (default):**
- Instances scale down to 0 when no traffic
- No cost when idle
- Cold start penalty on first request

**Min-Instances (always-on):**
- Set `--min-instances=1` (or more) to keep instances warm
- Idle instances still incur cost but at **reduced rate** (always-allocated CPU pricing)
- Eliminates cold start for the first N concurrent requests

**Always-Allocated CPU Pricing (Tier 2 Seoul):**
| Resource | Active Rate | Idle Rate (min-instances) |
|---|---|---|
| vCPU-second | $0.00002160 | $0.00002160 (same -- always allocated) |
| GiB-second | $0.00000240 | $0.00000240 (same) |

Note: Always-allocated CPU is ~36% cheaper per-second than on-demand, but you pay 24/7 even when idle.

**Cost of 1 always-on min-instance (1 vCPU, 512 MiB, Seoul):**
- CPU: 2,592,000 sec/mo x $0.00002160 = $55.99
- Memory: 2,592,000 sec/mo x 0.5 GiB x $0.00000240 = $3.11
- **Total: ~$59.10/mo** per always-on instance

### 2.3 Container Support (Docker + NestJS)
- Full Docker support -- deploy any containerized application
- NestJS deploys naturally as a Docker container
- Supports multi-stage builds for optimized images
- Max container image size: **32 GiB** (but keep images small for faster cold starts)
- Recommended: Alpine-based Node.js images, < 200MB

### 2.4 WebSocket Support
- **GA (Generally Available)** -- no additional configuration needed
- Streams are subject to the **request timeout** (default 300s, configurable up to 60 min)
- CPU is allocated as long as at least one client is connected
- **Important caveat**: Cloud Run can have multiple instances; WebSocket connections are NOT shared across instances
- Must use external pub/sub (Redis Pub/Sub, Memorystore, Firestore) to synchronize state across instances
- **Session affinity** is NOT guaranteed -- clients may reconnect to different instances

**For real-time seat booking**: WebSockets work but require Redis Pub/Sub for cross-instance state. Consider **Server-Sent Events (SSE)** as a simpler alternative if one-way updates suffice.

### 2.5 Concurrency
- **Max concurrent requests per instance: 1,000** (configurable)
- Default: 80
- Higher concurrency = fewer instances needed = lower cost + fewer cold starts
- NestJS handles concurrent requests well due to async/non-blocking nature
- Recommendation for NestJS: Set concurrency to **80-250** depending on workload

### 2.6 Cold Starts

**Without min-instances (scale from zero):**
| Component | Time |
|---|---|
| Instance scheduling | 200-500ms |
| Container image pull | 500-2000ms (depends on image size) |
| Node.js runtime start | 200-400ms |
| NestJS bootstrap (DI, modules) | 500-2000ms |
| **Total estimated** | **1.5-5 seconds** |

**With min-instances = 1:**
- First request: **0ms cold start** (instance already warm)
- Scale-out cold starts still occur when traffic exceeds single instance capacity

**Optimization strategies:**
1. Use **Startup CPU Boost** (2x CPU during startup, free)
2. Keep Docker image small (Alpine, multi-stage builds)
3. Lazy-load non-critical NestJS modules
4. Use min-instances = 1 for production

### 2.7 Pricing (Seoul, Tier 2)

**On-Demand (CPU allocated only during requests):**
| Resource | Rate |
|---|---|
| vCPU-second | $0.00003360 |
| GiB-second | $0.00000350 |
| Requests | $0.40 per million (after 2M free) |

**Always-Allocated CPU (CPU allocated even when idle):**
| Resource | Rate |
|---|---|
| vCPU-second | $0.00002160 |
| GiB-second | $0.00000240 |
| Requests | $0.40 per million (after 2M free) |

**Cost Estimate -- 100k req/day (3M/month), NestJS backend:**

Assumptions: 1 vCPU, 1 GiB memory, 200ms avg response time, on-demand CPU

| Item | Calculation | Cost/mo |
|---|---|---|
| CPU | (3M x 0.2s - 180k free) x $0.00003360 | $14.11 |
| Memory | (3M x 0.2s x 1 GiB - 360k free) x $0.00000350 | $0.84 |
| Requests | (3M - 2M) x $0.40/M | $0.40 |
| Egress (est. 10GB) | 10 x $0.12 | $1.20 |
| **Subtotal** | | **$16.55/mo** |

With always-allocated CPU + 1 min-instance:
| Item | Calculation | Cost/mo |
|---|---|---|
| Min-instance (24/7) | 1 vCPU + 1 GiB always-on | $62.21 |
| Extra instances (burst) | Estimated 10% overage | $6.22 |
| Requests | (3M - 2M) x $0.40/M | $0.40 |
| **Subtotal** | | **~$68.83/mo** |

### 2.8 Database: Cloud SQL PostgreSQL (Seoul)

**Smallest Instance Options:**

| Instance | vCPU | RAM | Approx. Monthly Cost (Seoul) |
|---|---|---|---|
| db-f1-micro | 0.6 shared | 0.6 GB | ~$10-12/mo |
| db-g1-small | 0.5 shared | 1.7 GB | ~$27-33/mo |
| db-custom-1-3840 | 1 dedicated | 3.75 GB | ~$52-60/mo |

**Storage:** SSD $0.222/GB/mo, HDD $0.118/GB/mo

**Additional Costs:**
- High Availability (HA): approximately 2x instance cost
- Automated backups: $0.08/GB/mo
- Network egress (cross-region): $0.12/GB

**Recommendation for MVP/early stage:** db-f1-micro ($10/mo) + 10GB SSD ($2.22/mo) = **~$12/mo**
**Recommendation for production:** db-custom-1-3840 with HA = **~$110-120/mo**

### 2.9 Redis Options

#### Option A: Memorystore for Redis (Seoul)

| Tier | Capacity | Approx. $/GB/hr | Monthly (1GB) |
|---|---|---|---|
| Basic M1 | 1-4 GB | ~$0.06/GB/hr | ~$44/mo |
| Standard M1 | 1-4 GB | ~$0.08/GB/hr | ~$58/mo |

- Minimum instance: **1 GB**
- Basic tier: No replication, no failover
- Standard tier: Automatic failover, cross-zone replication
- **Always running** -- no scale-to-zero
- Committed use discounts: 20% (1-year), 40% (3-year)

**Memorystore 1GB Basic in Seoul: ~$44/mo**
**Memorystore 1GB Standard in Seoul: ~$58/mo**

#### Option B: Upstash Redis (Serverless) -- RECOMMENDED for early stage

| Plan | Cost | Included |
|---|---|---|
| Free | $0/mo | 500K commands, 256MB |
| Pay-as-you-go | $0.20/100K commands | 100GB, unlimited bandwidth |
| Fixed 250MB | $10/mo | Predictable cost |
| Fixed 1GB | $10/mo+ | Predictable cost |

**Advantages over Memorystore:**
- True serverless -- scale to zero, pay per use
- No minimum $44/mo commitment
- Global replication available
- REST API + standard Redis protocol
- Available on GCP regions

**For 100k req/day with ~5 Redis commands per request:**
- Monthly commands: 3M x 5 = 15M commands
- Cost: (15M - 500K free) / 100K x $0.20 = **$29/mo** (pay-as-you-go)
- Or: Fixed plan at **$10/mo** (if within limits)

**Recommendation:** Start with **Upstash** ($0-10/mo), migrate to Memorystore when you need sub-millisecond latency at scale.

### 2.10 Cloud Run Jobs (Batch Processing)

Cloud Run Jobs are designed for run-to-completion tasks -- perfect for:
- **Settlement processing**: Nightly/weekly payment reconciliation
- **Notification batches**: Bulk email/push notification sending
- **Data cleanup**: Expired ticket cleanup, session purging
- **Report generation**: Analytics, sales reports

**Key features:**
- Up to **10,000 parallel tasks** per job
- Each task runs as a separate container instance
- Configurable retries on failure
- **Schedule via Cloud Scheduler** (cron-like)
- Same pricing as Cloud Run services (pay for execution time only)
- Max execution time: **24 hours** per task

**Example scheduled jobs for ticket platform:**
```
# Settlement: daily at 2 AM KST
gcloud scheduler jobs create http settlement-job \
  --schedule="0 2 * * *" --time-zone="Asia/Seoul"

# Expired tickets cleanup: every hour
gcloud scheduler jobs create http cleanup-job \
  --schedule="0 * * * *" --time-zone="Asia/Seoul"
```

### 2.11 Cloud Run + Cloud SQL Connector

**Connection Methods (ranked by recommendation):**

1. **Cloud SQL Auth Proxy (sidecar)** -- RECOMMENDED
   - Runs as a sidecar container in Cloud Run
   - Handles IAM-based authentication automatically
   - No public IP needed on Cloud SQL
   - No password management
   - Does NOT provide connection pooling

2. **Cloud SQL Node.js Connector**
   - `@google-cloud/cloud-sql-connector` npm package
   - Built-in connection pooling
   - Direct library integration

3. **Private IP + Serverless VPC Access**
   - Requires VPC connector ($7-10/mo for smallest)
   - Direct TCP connection

**Connection Pooling Strategy:**
- Cloud SQL Auth Proxy does NOT pool connections
- Must implement application-level pooling (TypeORM/Prisma pool)
- **Cloud SQL Managed Connection Pooling** (PgBouncer-based): Available for PostgreSQL, integrated with Auth Proxy v2.15.2+
- Recommended: TypeORM pool size of 5-10 per Cloud Run instance, with managed connection pooling enabled

**Connection Limits:**
- db-f1-micro: **25 max connections**
- db-g1-small: **50 max connections**
- 1 vCPU dedicated: **100 max connections**
- Cloud Run can scale to many instances -- each opens its own pool
- **Critical gotcha**: 10 Cloud Run instances x 10 pool connections = 100 connections, which can exceed db-f1-micro limits

### 2.12 Startup Probe / Health Checks

Cloud Run supports three types of probes:

**Startup Probe:**
- Determines when container is ready
- Liveness/readiness probes disabled until startup succeeds
- Essential for NestJS (slow bootstrap)
- Types: HTTP, TCP, gRPC

**Liveness Probe:**
- Detects deadlocks/hangs, triggers container restart
- Use sparingly -- only for unrecoverable failures

**Readiness Probe:**
- Controls traffic routing to instance
- Instance stays alive but stops receiving traffic if failing
- Note: Readiness probes configured before Nov 2025 may not take effect

**Example configuration for NestJS:**
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT/nestjs-api
          startupProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 2
            failureThreshold: 15
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            periodSeconds: 30
            failureThreshold: 3
```

### 2.13 Known Gotchas

#### Billing Complexity
- Two CPU allocation modes with different rates create confusion
- Min-instances cost adds up quickly ($59-68/mo per instance in Seoul)
- Free tier resets monthly -- no rollover
- Tier 2 regions (Seoul) are 40% more expensive than Tier 1

#### Egress Costs
- $0.12/GB for internet egress (can add up with API responses)
- Cross-region traffic to Cloud SQL or Memorystore incurs charges
- **Keep all services in the same region (asia-northeast3)**

#### Cloud SQL Connection Limits
- **#1 production issue**: Cloud Run autoscaling + connection pooling = connection exhaustion
- Each Cloud Run instance opens its own pool; at scale, this exceeds Cloud SQL limits
- Mitigation: Use Cloud SQL Managed Connection Pooling (PgBouncer)
- Mitigation: Use smaller pool sizes (3-5 per instance)
- Mitigation: Use a larger Cloud SQL instance with more connection headroom

#### WebSocket Limitations
- No session affinity guarantee -- clients may reconnect to different instances
- Must use external state store (Redis) for cross-instance communication
- Request timeout applies to WebSocket connections (max 60 min, then must reconnect)

#### Container Image Size
- Large images = slow cold starts
- Avoid: Full `node:20` image (~1GB)
- Use: `node:20-alpine` (~130MB) or distroless

#### VPC Connector Costs
- If using private IP for Cloud SQL: VPC connector starts at $7-10/mo
- Alternative: Use Cloud SQL Auth Proxy with public IP + IAM auth

---

## 3. Comparison: Cloud Functions vs Cloud Run for This Use Case

### Decision Matrix

| Criteria | Cloud Functions (2nd gen) | Cloud Run Services | Winner |
|---|---|---|---|
| NestJS compatibility | Possible but hacky | Native Docker support | **Cloud Run** |
| WebSocket support | Not supported | GA, full support | **Cloud Run** |
| Cold start control | Limited | Min-instances, startup boost | **Cloud Run** |
| Event-driven tasks | Built-in Eventarc | Manual setup | **Cloud Functions** |
| Custom Docker | No | Yes | **Cloud Run** |
| Health checks | Automatic only | Full control | **Cloud Run** |
| Pricing | Same (Cloud Run under hood) | Same | **Tie** |
| Developer experience | Simpler for small functions | More setup, more control | Depends |
| Batch processing | Not designed for it | Cloud Run Jobs | **Cloud Run** |

### Recommended Architecture

```
[Next.js 16 Frontend]  -->  Vercel (or Cloud Run)
        |
        v
[NestJS 11 API]        -->  Cloud Run Service (asia-northeast3)
        |
        +-- PostgreSQL  -->  Cloud SQL (asia-northeast3)
        +-- Redis       -->  Upstash Redis (or Memorystore)
        +-- Real-time   -->  Cloud Run WebSocket + Redis Pub/Sub

[Batch Jobs]           -->  Cloud Run Jobs + Cloud Scheduler
  - Settlement
  - Notifications
  - Cleanup

[Event Handlers]       -->  Cloud Run Functions (optional)
  - Image processing
  - Pub/Sub consumers
  - Webhook receivers
```

### Monthly Cost Estimate (100k req/day, MVP)

| Service | Configuration | Monthly Cost |
|---|---|---|
| Cloud Run (NestJS API) | 1 vCPU, 1 GiB, on-demand | $16-17 |
| Cloud Run (min-instance add) | +1 always-on instance | +$62 (optional) |
| Cloud SQL PostgreSQL | db-f1-micro, 10GB SSD | $12-14 |
| Redis (Upstash) | Pay-as-you-go | $10-29 |
| Cloud Run Jobs | Settlement + cleanup | $1-3 |
| Egress | ~10GB/mo | $1-2 |
| **Total (scale-to-zero)** | | **$40-65/mo** |
| **Total (with min-instance)** | | **$100-130/mo** |

### Monthly Cost Estimate (100k req/day, Production)

| Service | Configuration | Monthly Cost |
|---|---|---|
| Cloud Run (NestJS API) | 2 vCPU, 2 GiB, always-allocated, min=1 | $125-140 |
| Cloud SQL PostgreSQL | 1 vCPU, 3.75GB, HA, 20GB SSD | $115-125 |
| Redis (Memorystore) | 1GB Standard tier | $58 |
| Cloud Run Jobs | Settlement + cleanup + notifications | $3-5 |
| VPC Connector | Smallest | $7-10 |
| Egress | ~30GB/mo | $3-4 |
| **Total (Production)** | | **$310-340/mo** |

---

## 4. Final Recommendation

**Use Cloud Run Services** as the primary compute platform for NestJS + Next.js ticket booking:

1. **Cloud Run Services** for the NestJS API backend (with min-instances=1 for production)
2. **Cloud Run Jobs** for batch processing (settlement, notifications)
3. **Cloud Run Functions** only for lightweight event-driven tasks if needed
4. **Cloud SQL PostgreSQL** for the database (start with db-f1-micro, upgrade to dedicated core for production)
5. **Upstash Redis** for MVP/early stage; migrate to **Memorystore** when latency-sensitive at scale
6. **All services in asia-northeast3 (Seoul)** to minimize latency and avoid cross-region egress costs

Cloud Functions 2nd gen is Cloud Run under the hood anyway -- deploying NestJS directly as a Cloud Run service gives you full control over containers, health checks, WebSocket support, and Docker configuration without any compatibility hacks.

---

## Sources
- [Google Cloud Functions in 2025](https://cloudchipr.com/blog/google-cloud-functions)
- [Cloud Run Functions Quotas](https://docs.cloud.google.com/functions/quotas)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Run Pricing Guide 2025](https://cloudchipr.com/blog/cloud-run-pricing)
- [Cloud Run Pricing Breakdown](https://hamy.xyz/blog/2025-04_google-cloud-run-pricing)
- [Cloud Run Locations](https://docs.cloud.google.com/run/docs/locations)
- [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Cloud Run Health Checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run Min Instances](https://docs.cloud.google.com/run/docs/configuring/min-instances)
- [Cloud Run Cold Start Optimization 2025](https://markaicode.com/google-cloud-run-cold-start-optimization-2025/)
- [Cloud Run + Cloud SQL Connection](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL Managed Connection Pooling](https://docs.cloud.google.com/sql/docs/postgres/managed-connection-pooling)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [Cloud Run Functions Pricing Guide](https://modal.com/blog/google-cloud-function-pricing-guide)
- [Cloud Run Jobs](https://docs.cloud.google.com/run/docs/create-jobs)
- [Cloud Run Jobs on Schedule](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule)
- [Memorystore Redis Pricing](https://cloud.google.com/memorystore/docs/redis/pricing)
- [Memorystore Pricing Tiers Explained](https://ventusserver.com/gcp-memorystore-pricing-tiers-explained/)
- [Upstash Redis Pricing](https://upstash.com/pricing/redis)
- [NestJS on GCP](https://tisankan.dev/nestjs-google-cloud/)
- [Cloud Functions to Cloud Run Rename](https://cloud.google.com/blog/products/serverless/google-cloud-functions-is-now-cloud-run-functions)
- [Compare Cloud Run Functions](https://docs.cloud.google.com/run/docs/functions/comparison)
- [Cloud Run and Cloud SQL Connection Gotchas](https://www.keypup.io/blog/cloud-run-and-cloud-sql-avoid-hitting-cloud-sql-admin-connection-quota/)
