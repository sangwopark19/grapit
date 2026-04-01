# Google Cloud Run (Seoul) vs Railway (Singapore): Deep Comparison Report
> Korean Ticket Booking Platform (Next.js 16 + NestJS 11 + PostgreSQL + Redis)
> Research Date: 2026-03-25

---

## Executive Summary

| Dimension | Cloud Run (Seoul) | Railway (Singapore) | Winner |
|---|---|---|---|
| **Latency to Korea** | ~2-5ms | ~67-80ms | **Cloud Run** |
| **Developer Experience** | Medium (steeper learning curve) | Excellent (fastest to deploy) | **Railway** |
| **Deployment Simplicity** | Moderate (CI/CD setup needed) | Excellent (push-to-deploy) | **Railway** |
| **Pricing (MVP)** | ~$40-65/mo | ~$25-45/mo | **Railway** |
| **Pricing (Production)** | ~$130-200/mo | ~$80-150/mo | Close, depends on usage |
| **Burst Traffic Handling** | Excellent (auto-scale, proven) | Good (vertical auto, manual horizontal) | **Cloud Run** |
| **WebSocket Support** | GA, full support (60min timeout) | Supported (10K domain limit, no sticky sessions) | **Cloud Run** |
| **Reliability/SLA** | 99.95% SLA with financial credits | No formal SLA | **Cloud Run** |
| **Operational Complexity** | High (many GCP services to manage) | Low (unified dashboard) | **Railway** |
| **Vendor Lock-in** | Low (standard Docker) | Low (Docker or Nixpacks) | Tie |
| **Scalability Ceiling** | Very High (enterprise-grade) | Moderate (24 vCPU / 24GB per replica, 42 replicas) | **Cloud Run** |

**Bottom Line**: For a Korean ticket booking platform where latency directly impacts user experience during competitive ticket opens, **Cloud Run Seoul is the stronger production choice**. The ~65ms latency penalty from Railway Singapore is unacceptable for real-time seat selection and competitive booking flows. However, Railway is significantly easier to use for rapid prototyping and MVP development.

---

## 1. Developer Experience (DX) - Deep Dive

### 1.1 Initial Project Setup: Code to Production

#### Railway (3-5 steps, ~10 minutes)
```
1. railway login
2. railway init (creates project)
3. railway link (connects to GitHub repo)
4. railway up (deploys)
   -- OR just connect GitHub repo in dashboard, push to deploy
```
- Zero-config deployment with Nixpacks auto-detection
- No Dockerfile required (but supported)
- Database added with one click in dashboard
- Environment variables set in UI or CLI

#### Cloud Run (10-20 steps, ~1-2 hours first time)
```
1. Create GCP project
2. Enable Cloud Run API, Artifact Registry API, Cloud Build API
3. Install gcloud CLI, authenticate
4. Create Artifact Registry repository
5. Write Dockerfile
6. Write cloudbuild.yaml OR set up GitHub Actions
7. Configure IAM permissions (Workload Identity Federation recommended)
8. Deploy: gcloud run deploy --image ... --region asia-northeast3
9. Set up Cloud SQL (separate wizard)
10. Configure Cloud SQL Auth Proxy or VPC connector
11. Set up Memorystore or Upstash for Redis
12. Configure secrets in Secret Manager
13. Set up custom domain
14. Configure min-instances, concurrency, health checks
```

**Verdict**: Railway wins dramatically on initial setup. Cloud Run requires learning multiple GCP services and their interactions.

### 1.2 GitHub Integration

| Feature | Railway | Cloud Run |
|---|---|---|
| Push-to-deploy | Native, one-click setup | Via Cloud Build trigger or GitHub Actions |
| PR preview deploys | Built-in (ephemeral environments) | Manual setup required (Cloud Build + traffic tags) |
| Branch deployments | Native per-environment | Manual configuration per branch |
| Setup time | 2 minutes | 30-60 minutes |

### 1.3 Environment Variables

| Feature | Railway | Cloud Run |
|---|---|---|
| UI management | Excellent dashboard UI | Secret Manager (separate service) |
| Shared variables | Cross-service references (${{service.VAR}}) | Must use Secret Manager + IAM |
| Local dev sync | `railway run` injects vars locally | Must export manually or use `gcloud` |
| Sealed/encrypted | Built-in sealed variables | Secret Manager with IAM |

### 1.4 Adding PostgreSQL and Redis

| Task | Railway | Cloud Run |
|---|---|---|
| Add PostgreSQL | Click "Add Service" → PostgreSQL plugin, done | Create Cloud SQL instance (wizard), configure Auth Proxy, set up VPC connector ($7-10/mo), manage connection string |
| Add Redis | Click "Add Service" → Redis plugin, done | Choose: Memorystore ($44+/mo always-on) or Upstash (external), configure networking |
| Connection strings | Auto-injected as environment variables | Manual configuration via Secret Manager |
| Time to set up | 2-3 minutes each | 30-60 minutes each |

### 1.5 Multi-Service Management (Next.js + NestJS)

| Feature | Railway | Cloud Run |
|---|---|---|
| Monorepo support | Auto-detects packages, creates services per package | Separate Dockerfiles, separate deploy configs |
| Service networking | Internal networking with variable references | Must be in same VPC, use internal URLs |
| Watch paths | Built-in (only rebuild changed service) | Must configure in CI/CD pipeline |
| Shared config | Shared variables across services | Secret Manager shared across services |

### 1.6 Dashboard and Monitoring

| Feature | Railway | Cloud Run |
|---|---|---|
| Dashboard quality | Clean, modern, developer-focused | GCP Console (complex, enterprise-oriented) |
| Log viewing | Real-time streaming in dashboard | Cloud Logging (powerful but complex) |
| Metrics | Basic CPU/memory/network charts | Cloud Monitoring (very detailed, overwhelming) |
| Ease of use | Intuitive, minimal learning curve | Steep learning curve, many panels |

---

## 2. Deployment Flow Comparison

### 2.1 Standard Deployment

#### Railway
```
git push origin main
→ Railway detects push
→ Nixpacks builds image (auto-detected) OR uses Dockerfile
→ Deploys container
→ Routes traffic
Total: ~1-3 minutes typical
```

#### Cloud Run (with Cloud Build trigger)
```
git push origin main
→ Cloud Build trigger fires
→ Builds Docker image
→ Pushes to Artifact Registry
→ Deploys to Cloud Run
→ Health check passes
→ Routes traffic
Total: ~3-7 minutes typical
```

### 2.2 Build + Deploy Speed

| Metric | Railway | Cloud Run |
|---|---|---|
| Optimized Dockerfile | ~15 seconds build + 4s deploy | ~2-4 minutes total |
| Nixpacks/Buildpacks | ~1.5 minutes | ~3-5 minutes (Cloud Buildpacks) |
| NestJS + deps | ~2-4 minutes | ~4-8 minutes |
| Caching | Nixpacks/Docker layer caching | Cloud Build caching (must configure) |

### 2.3 Rollback

| Feature | Railway | Cloud Run |
|---|---|---|
| Rollback method | Click three-dots menu on previous deployment | `gcloud run services update-traffic --to-revisions=REV=100` or one-click in console |
| Speed | Instant (restores image + variables) | Instant (traffic routing change) |
| Retained images | 120 hours after deployment removal | Stored in Artifact Registry (until deleted) |

### 2.4 Advanced Deployment Strategies

| Strategy | Railway | Cloud Run |
|---|---|---|
| Blue-green | Not native (use environments) | Built-in via revision traffic splitting |
| Canary | Not native | Built-in (route X% to new revision) |
| Traffic splitting | Not supported | Native (e.g., 90/10 split between revisions) |
| Gradual rollout | Not supported | Native (Cloud Deploy integration) |

**Verdict**: Cloud Run has significantly more sophisticated deployment strategies -- critical for a production booking platform where you want zero-downtime deploys and canary testing.

### 2.5 Custom Domains & SSL

| Feature | Railway | Cloud Run |
|---|---|---|
| Custom domains | Yes, add in settings | Yes, via domain mapping |
| SSL certificates | Automatic (Let's Encrypt) | Automatic (Google-managed) |
| Setup complexity | Simple | Simple |

---

## 3. Pricing Deep Dive

### 3.1 Plan Structure

#### Railway Pro
- **Subscription**: $20/month per workspace
- **Included credits**: $20/month (offsets usage)
- **Usage pricing**:
  - CPU: $20/vCPU/month
  - RAM: $10/GB/month
  - Storage: $0.15/GB/month
  - Egress: $0.05/GB

#### Cloud Run Seoul (Tier 2)
- **No subscription fee**
- **On-demand CPU**: $0.00003360/vCPU-second ($87.09/vCPU-month if 100% utilized)
- **Always-allocated CPU**: $0.00002160/vCPU-second ($55.99/vCPU-month)
- **Memory**: $0.00000350/GiB-second (on-demand) or $0.00000240/GiB-second (always-allocated)
- **Requests**: $0.40/million (after 2M free)
- **Egress**: $0.12/GB
- **Free tier**: 180K vCPU-sec, 360K GiB-sec, 2M requests/month

### 3.2 Scenario A: MVP (1K DAU, ~30K requests/day)

**Assumptions**: 900K requests/month, 150ms avg response, 0.5 vCPU, 512MB RAM, 5GB DB, 2GB egress

#### Railway Pro
| Component | Specification | Cost/month |
|---|---|---|
| NestJS API | ~0.25 avg vCPU, 512MB RAM | ~$10 (CPU: $5, RAM: $5) |
| Next.js Frontend | ~0.15 avg vCPU, 256MB RAM | ~$5.50 |
| PostgreSQL | 512MB RAM, 5GB storage | ~$5.75 |
| Redis | 256MB RAM, minimal storage | ~$2.50 |
| Egress (2GB) | | $0.10 |
| **Subtotal usage** | | **~$24** |
| Credits applied | | -$20 |
| Subscription | | +$20 |
| **Total** | | **~$24/mo** |

#### Cloud Run Seoul
| Component | Specification | Cost/month |
|---|---|---|
| Cloud Run (NestJS, on-demand) | 0.5 vCPU, 512MB, 900K req x 0.15s | $3.50 (mostly within free tier) |
| Cloud Run (Next.js, on-demand) | 0.5 vCPU, 512MB | $2.00 |
| Cloud SQL PostgreSQL | db-f1-micro, 10GB SSD | $12 |
| Redis (Upstash) | ~4.5M commands/mo | $8-10 |
| Egress (2GB) | | $0.24 |
| **Total** | | **~$26-28/mo** |

**With 1 min-instance (eliminate cold starts)**: add ~$59/mo = **~$85-87/mo**

**MVP Verdict**: Nearly identical at the lowest tier. Railway slightly cheaper with credits. Cloud Run gets expensive if you want warm instances.

### 3.3 Scenario B: Growth (10K DAU, ~300K requests/day)

**Assumptions**: 9M requests/month, 200ms avg, 1 vCPU, 1GB RAM, 20GB DB, 20GB egress

#### Railway Pro
| Component | Specification | Cost/month |
|---|---|---|
| NestJS API | ~0.8 avg vCPU, 1GB RAM | ~$26 |
| Next.js Frontend | ~0.3 avg vCPU, 512MB RAM | ~$11 |
| PostgreSQL | 2GB RAM, 20GB storage | ~$23 |
| Redis | 1GB RAM | ~$10 |
| Egress (20GB) | | $1 |
| **Subtotal usage** | | ~$71 |
| Credits applied | | -$20 |
| Subscription | | +$20 |
| **Total** | | **~$71/mo** |

#### Cloud Run Seoul
| Component | Specification | Cost/month |
|---|---|---|
| Cloud Run (NestJS, always-alloc, min=1) | 1 vCPU, 1GB | $62 |
| Cloud Run (Next.js, on-demand) | 1 vCPU, 512MB | $8 |
| Cloud SQL PostgreSQL | db-custom-1-3840, 20GB SSD | $56 |
| Redis (Upstash) | ~45M commands/mo | $29 |
| Egress (20GB) | $2.40 |
| Requests | (9M - 2M) x $0.40/M | $2.80 |
| **Total** | | **~$160/mo** |

**Growth Verdict**: Railway is significantly cheaper at this tier (~$71 vs ~$160). Cloud SQL is a major cost driver compared to Railway's integrated PostgreSQL.

### 3.4 Scenario C: Ticket Open Burst (50K concurrent, 30 minutes)

**Assumptions**: 50K users hitting the system simultaneously for 30 min, ~500 requests/user in that window = 25M requests in 30 min

#### Railway Pro
| Component | Notes | Cost (burst period) |
|---|---|---|
| NestJS API scale-up | ~8 vCPU, 8GB RAM for 30 min | ~$1.40 |
| Redis spike | 4GB RAM for 30 min | ~$0.70 |
| PostgreSQL | Under heavy load, may need larger instance pre-configured | Included in base |
| Egress (burst ~50GB) | | $2.50 |
| **Burst incremental cost** | | **~$5-10** |

**Concern**: Railway's 10K WebSocket connection limit per domain is a hard ceiling. 50K concurrent WebSocket users is NOT possible on Railway without workarounds. You would need to use HTTP polling instead, or accept only ~10K real-time connections.

#### Cloud Run Seoul
| Component | Notes | Cost (burst period) |
|---|---|---|
| Cloud Run auto-scale | Up to 50+ instances, 2 vCPU each, 30 min | ~$60-80 |
| Cloud SQL | May need to pre-scale to db-custom-4-15360 | Already provisioned |
| Redis (Memorystore) | Would need Memorystore Standard for burst | Already provisioned |
| Egress (burst ~50GB) | | $6 |
| **Burst incremental cost** | | **~$70-90** |

**Advantage**: Cloud Run can auto-scale to 100+ instances. No hard WebSocket ceiling per se (each instance handles connections independently, state synced via Redis).

**Burst Verdict**: Cloud Run is more expensive per burst but can actually handle 50K concurrent connections. Railway physically cannot with WebSocket due to the 10K domain-level limit.

### 3.5 Hidden Costs Summary

| Hidden Cost | Railway | Cloud Run |
|---|---|---|
| Egress | $0.05/GB (reasonable) | $0.12/GB (2.4x more expensive) |
| Build minutes | Included | Cloud Build: $0.003/build-minute |
| SSL/Domains | Free | Free |
| Monitoring | Built-in (basic) | Cloud Monitoring free tier, then $0.258/MB for logs |
| VPC Connector | N/A | $7-10/mo if using private IP |
| Secret Manager | Built-in | $0.06/10K access operations |
| Cloud SQL Auth Proxy | N/A | Free (sidecar) but adds complexity |
| Idle database cost | Scales down somewhat | Cloud SQL always-on ($10-60+/mo even when idle) |

---

## 4. Performance for Korean Users

### 4.1 Latency Comparison (The Critical Factor)

| Route | Estimated RTT | Source |
|---|---|---|
| Cloud Run Seoul → Korean user | **2-5ms** | Same region, within Korea |
| Railway Singapore → Korean user | **~67-80ms** | AWS inter-region measurement (BlueGoat latency map: 66.96ms), real-world likely 70-80ms+ |
| Seoul → Tokyo (reference) | ~22ms | Epsilon network data |
| Singapore → Tokyo (reference) | ~70-80ms | Various latency maps |

### 4.2 What 67-80ms Latency Means for Ticket Booking

For a typical ticket booking flow, every API call adds this base latency:

| User Action | API Calls | Cloud Run (Seoul) | Railway (Singapore) | Difference |
|---|---|---|---|---|
| Load seat map | 1 call | ~50ms total | ~120ms total | +70ms |
| Select a seat (lock) | 1 call | ~40ms total | ~110ms total | +70ms |
| Check seat availability | 1 call | ~30ms total | ~100ms total | +70ms |
| WebSocket seat updates | Continuous | ~5ms per update | ~75ms per update | +70ms |
| Complete booking (multi-step) | 3-5 calls | ~150ms total | ~500ms total | +350ms |
| **Total booking flow** | **~8 calls** | **~300ms** | **~860ms** | **+560ms** |

During competitive ticket opens where thousands of users are racing for the same seats:
- **70ms per interaction is the difference between getting or losing a seat**
- WebSocket updates arriving 70ms later means users see stale seat states
- Queue position updates are 70ms behind reality
- The 10-minute seat hold TTL becomes 10 minutes minus accumulated latency overhead

### 4.3 Cold Starts

| Factor | Cloud Run (Seoul) | Railway (Singapore) |
|---|---|---|
| Cold start (scale from zero) | 1.5-5 seconds (NestJS + Docker) | 1-3.2 seconds (Nixpacks, varies) |
| Mitigation | min-instances=1 ($59/mo) | Keep service running (always on by default in Pro, or app sleeping after 10min inactivity) |
| Scale-out cold start | New instances: 1-3s | New replicas: similar |
| Startup CPU Boost | Yes (2x CPU during startup, free) | No equivalent |

### 4.4 WebSocket Support

| Feature | Cloud Run (Seoul) | Railway (Singapore) |
|---|---|---|
| WebSocket support | GA (Generally Available) | Supported |
| Max connection duration | 60 minutes (configurable, then reconnect) | ~5 min HTTP timeout; WebSocket longer but needs keepalive every 20-30s |
| Connection limit | Per-instance concurrency (up to 1000) | **10,000 per domain** (hard limit) |
| Sticky sessions | Not guaranteed | Not supported |
| Cross-instance state | Redis Pub/Sub needed | Redis Pub/Sub needed |
| For 50K concurrent users | Feasible (50+ instances x 1000 connections) | **NOT feasible** (10K domain limit) |

### 4.5 Connection Pooling

| Feature | Cloud Run | Railway |
|---|---|---|
| DB connection pooling | Cloud SQL Managed Pooling (PgBouncer), or app-level | App-level only (PgBouncer available as addon) |
| Connection limits | db-f1-micro: 25, db-g1-small: 50, 1vCPU: 100 | Depends on provisioned instance, typical ~100 default |
| Gotcha | Multi-instance x pool size can exhaust limits | Railway had production PgBouncer incidents in Sept/Oct/Dec 2025 |

---

## 5. Operational Complexity for Solo Developer

### 5.1 What You Need to Learn

#### Railway
1. Railway CLI (`railway login`, `railway up`, `railway link`)
2. Railway dashboard (intuitive)
3. Basic Docker concepts (optional if using Nixpacks)
4. Environment variable management in UI

**Total GCP/cloud services to learn: 0**

#### Cloud Run
1. `gcloud` CLI
2. Docker + Dockerfile authoring
3. Cloud Run configuration (concurrency, min-instances, health checks)
4. Artifact Registry (container image storage)
5. Cloud Build OR GitHub Actions CI/CD setup
6. Cloud SQL (provisioning, Auth Proxy, connection pooling)
7. IAM & Service Accounts (permissions model)
8. Secret Manager (environment variables / secrets)
9. VPC / Serverless VPC Access (optional but recommended)
10. Cloud Monitoring + Cloud Logging
11. Cloud Scheduler (for cron jobs via Cloud Run Jobs)
12. Billing & budget alerts

**Total GCP services to learn: 10-12**

### 5.2 Day-to-Day Operations

| Task | Railway | Cloud Run |
|---|---|---|
| Deploy new version | `git push` (automatic) | `git push` (if CI/CD configured) |
| View logs | Dashboard → Service → Logs (real-time) | Cloud Logging console (powerful but complex query syntax) |
| Check metrics | Dashboard → Service → Metrics | Cloud Monitoring dashboards (must create) |
| Scale up | Change replica count in UI | `gcloud run services update --max-instances=N` |
| Add env variable | Dashboard → Variables → Add | Secret Manager → Create Secret → Bind to Cloud Run |
| Database backup | Use Railway's backup template or pg_dump | Cloud SQL automatic backups (built-in, $0.08/GB/mo) |
| Restore database | Click "Restore" on backup in UI | Cloud SQL restore from backup (console or gcloud) |
| Set budget alert | Not natively available (check billing page) | Cloud Billing budget alerts (email/SMS/Pub/Sub) |
| Incident debugging | Logs + metrics in one dashboard | Multiple dashboards: Cloud Run, Cloud Logging, Cloud SQL, Error Reporting |

### 5.3 Database Backup/Restore

| Feature | Railway | Cloud Run (Cloud SQL) |
|---|---|---|
| Automatic backups | Via template (deploy backup service) | Built-in automated daily backups |
| Point-in-time recovery | Not native | Available with Cloud SQL (up to 7 days) |
| Backup cost | Included in resource usage | $0.08/GB/mo |
| Restore process | Click "Restore" or pg_restore | Console wizard or gcloud command |
| Cross-region backup | Not available | Available (for disaster recovery) |

### 5.4 Cost Monitoring

| Feature | Railway | Cloud Run |
|---|---|---|
| Usage dashboard | Real-time usage in dashboard | Billing dashboard, Cloud Monitoring |
| Budget alerts | Not native | Yes, granular budget alerts with notifications |
| Cost breakdown | Per-service breakdown | Per-service, per-resource type |
| Surprise bill risk | Medium (usage-based, can spike) | Medium-high (multiple services, egress surprises) |

---

## 6. Scalability & Limits

### 6.1 Resource Limits

| Limit | Railway Pro | Cloud Run |
|---|---|---|
| Max vCPU per instance | 24 vCPU | 8 vCPU |
| Max memory per instance | 24 GB | 32 GiB |
| Max replicas/instances | 42 per service | 100 default (can request increase to 1000+) |
| Max total vCPU | 24 x 42 = 1,008 vCPU | 8 x 1000 = 8,000 vCPU |
| Concurrency per instance | No hard limit (OS-level) | Up to 1,000 concurrent requests |
| WebSocket connections | 10,000 per domain | Limited by concurrency setting per instance |
| Request timeout (HTTP) | 5 minutes (15 min max) | 60 minutes |
| Autoscaling | Vertical auto, horizontal manual | Both vertical and horizontal auto |
| Scale-to-zero | Optional (app sleeping after 10 min) | Default behavior |

### 6.2 Ticket Open Burst Scenario (50K concurrent users)

#### Cloud Run Seoul
```
Config:
- Max instances: 200 (request increase from default 100)
- Concurrency: 250 per instance
- 2 vCPU, 2 GiB per instance
- Min instances: 5 (warm pool before event)

Burst handling:
- 50K concurrent → ~200 instances auto-scaled
- Cold starts for new instances: 1-3s (mitigated by Startup CPU Boost)
- WebSocket: 50K connections distributed across 200 instances
- Redis Pub/Sub syncs seat state across instances
- Cloud SQL: Need db-custom-4 (400 max connections) with managed pooling

Result: CAN handle 50K concurrent. May see 1-5s latency spike during initial scale-up.
```

#### Railway Singapore
```
Config:
- Replicas: manual increase to 10-20 (up to 42 max)
- 8 vCPU, 8 GB per replica
- Vertical autoscaling for each replica

Burst handling:
- 50K concurrent HTTP requests: Possible with enough replicas
- 50K WebSocket connections: NOT POSSIBLE (10K domain limit)
- Must use HTTP polling instead of WebSocket for seat updates
- Manual pre-scaling required (no auto horizontal scaling)
- Additional 70ms latency on every interaction

Result: Can handle HTTP burst with pre-scaling, but WebSocket limit is a dealbreaker
for real-time seat booking. Must use polling, which increases server load.
```

### 6.3 Database Connection Limits

| Scenario | Railway | Cloud Run |
|---|---|---|
| MVP (1-2 instances) | ~10 pool x 2 = 20 connections (fine) | ~10 pool x 2 = 20 connections (fine) |
| Growth (5 instances) | ~10 pool x 5 = 50 connections | ~10 pool x 5 = 50 connections |
| Burst (50 instances) | ~10 pool x 20 = 200 (needs larger DB) | ~5 pool x 200 = 1000 (NEEDS managed pooling) |
| Mitigation | App-level pooling, PgBouncer template | Cloud SQL Managed Connection Pooling (PgBouncer) |

---

## 7. Vendor Lock-in & Migration

### 7.1 Portability Assessment

| Factor | Railway | Cloud Run |
|---|---|---|
| Compute | Docker containers (portable) or Nixpacks (Railway-specific) | Standard Docker containers (highly portable) |
| Database | Standard PostgreSQL (pg_dump to export) | Standard PostgreSQL via Cloud SQL (pg_dump) |
| Redis | Standard Redis (RDB/AOF export) | Standard Redis (Memorystore or Upstash) |
| Environment config | Railway-specific variable references | Secret Manager (GCP-specific) |
| CI/CD | Railway-specific triggers | GitHub Actions (portable) or Cloud Build (GCP-specific) |
| Networking | Railway internal networking | VPC, Cloud SQL Auth Proxy (GCP-specific) |

### 7.2 Migration Effort

| Migration Path | Difficulty | Notes |
|---|---|---|
| Railway → Cloud Run | Medium | Export Dockerfile, set up GCP services, migrate DB via pg_dump |
| Railway → Any Docker host | Easy | Use Dockerfile, standard Postgres, standard Redis |
| Cloud Run → Railway | Easy | Already Dockerized, just deploy to Railway |
| Cloud Run → AWS/Azure | Medium | Docker image is portable, but must reconfigure DB, secrets, networking |
| Cloud Run → Kubernetes | Medium | Knative-compatible, but still needs cluster setup |

### 7.3 Recommendation for Portability

Use explicit **Dockerfiles** on both platforms (not Nixpacks, not Cloud Buildpacks) for maximum portability. This ensures you can move to any platform that runs Docker containers.

---

## 8. Reliability & SLA

### 8.1 SLA Comparison

| Feature | Cloud Run | Railway |
|---|---|---|
| **Formal SLA** | **99.95%** monthly uptime | **None** (SLOs for Business Class, enterprise case-by-case) |
| Financial credits for downtime | Yes (10-50% credits based on downtime tier) | No |
| Max annual downtime (SLA) | ~4.38 hours | Undefined |
| Data center redundancy | 3 availability zones in Seoul | Single zone per region |

### 8.2 Incident History

#### Railway (2025)
- **1,098+ tracked outages** over 3+ years (StatusGator data)
- Average incident resolution: **103 minutes**
- September 22, 2025: PgBouncer incident (connection pooling failure)
- October 28, 2025: Cascading failure, PgBouncer exhausted all DB connections
- December 8, 2025: Database migration caused lock contention, PgBouncer overwhelmed
- March 23, 2026: EU West connectivity issues
- Growing pains noted: 9,000+ new users daily causing queue overload on Trial/Hobby tiers
- Railway is transparent about incidents (public post-mortems)

#### Cloud Run / GCP (2025)
- June 12, 2025: Null pointer bug affected 50+ services for 7 hours (GCP-wide)
- Generally more stable due to mature infrastructure
- 100+ combined outages across AWS/Azure/GCP (Aug 2024 - Aug 2025)
- Seoul region specifically: No major region-specific outages reported

### 8.3 Verdict

Cloud Run provides enterprise-grade reliability with a contractual SLA and financial backing. Railway is transparent and improving, but is a younger platform experiencing growing pains. For a production ticket booking platform handling real money transactions, the SLA matters.

---

## 9. Community & Support

### 9.1 Documentation

| Aspect | Railway | Cloud Run |
|---|---|---|
| Quality | Clean, developer-friendly, concise | Comprehensive but overwhelming |
| Getting started | Excellent (one-page quickstart) | Good (many quickstarts by language) |
| Advanced topics | Limited depth | Very deep (architecture guides, best practices) |
| Examples/Templates | Railway templates marketplace | Cloud Run samples, codelabs |
| Search experience | Good | GCP docs search is mediocre |

### 9.2 Community & Support

| Aspect | Railway | Cloud Run |
|---|---|---|
| Discord community | 28,000+ members, active | N/A (uses StackOverflow, Google forums) |
| StackOverflow | Smaller presence | Very large presence |
| Support (free/hobby) | Community only (no guarantee) | Free tier of Cloud support (no SLA) |
| Support (paid) | Pro: Central Station, ~72 hour response | Premium/Enhanced Support: $500-12,500+/mo |
| Business support | Business Class add-on | Enterprise Support available |

### 9.3 For Solo Developer

Railway's community support is more accessible (Discord, quick answers from other devs and Railway team). Cloud Run's support requires paid plans for guaranteed response times, but StackOverflow has extensive coverage for common issues.

---

## 10. The Singapore Latency Question - Quantified

### 10.1 Raw Numbers

| Measurement | Value | Source |
|---|---|---|
| Singapore → Seoul RTT | **~67ms** | AWS inter-region latency map (BlueGoat) |
| Seoul → Tokyo RTT (reference) | ~22ms | Epsilon network data |
| Singapore → Tokyo RTT (reference) | ~70-80ms | Various measurements |
| Intra-Seoul RTT | **~1-3ms** | Same-region GCP data center |

### 10.2 Real Application Impact (Not Just Ping)

Raw ping is one-way. Real API calls include: DNS + TCP handshake + TLS handshake + HTTP request + server processing + HTTP response.

For a **first API call** from Seoul user to Singapore server:
```
DNS lookup:           ~5ms (cached after first)
TCP handshake:        ~67ms (1 RTT)
TLS handshake:        ~134ms (2 RTTs for TLS 1.3)
HTTP request:         ~67ms (1 RTT)
Server processing:    ~20ms
HTTP response:        ~67ms (1 RTT)
─────────────────────────────────
Total first call:     ~360ms from Singapore
Total first call:     ~45ms from Seoul (same math, 2ms RTT)
Difference:           ~315ms
```

For **subsequent API calls** (connection reuse with HTTP/2 keep-alive):
```
HTTP request + processing + response: ~67ms + 20ms + 67ms = ~154ms from Singapore
HTTP request + processing + response: ~2ms + 20ms + 2ms    = ~24ms from Seoul
Difference per call:  ~130ms
```

### 10.3 Can CDN (Cloudflare) Mitigate This?

| What CDN Can Help With | What CDN CANNOT Help With |
|---|---|---|
| Static assets (JS, CSS, images): Yes, served from Seoul edge | API calls: NO, must reach origin server |
| Cached HTML pages: Yes | Database queries: NO |
| DNS resolution: Faster with Cloudflare DNS | WebSocket connections: NO (must connect to origin) |
| | Real-time seat updates: NO |
| | Booking transactions: NO |
| | Queue position updates: NO |

**For a ticket booking platform, 90% of latency-sensitive operations are API calls that CANNOT be CDN-cached.** A CDN helps with the initial page load (static assets), but every seat selection, lock, payment, and real-time update must reach the Singapore origin.

### 10.4 Potential Workarounds for Railway's Latency

| Workaround | Feasibility | Limitations |
|---|---|---|
| Cloudflare Workers/Edge Functions for caching | Partial | Only helps read operations, not writes |
| Optimistic UI updates | Partial | User sees instant feedback but server state may differ by 130ms |
| Pre-fetch likely data | Partial | Reduces perceived latency for reads |
| Batch API calls | Partial | Reduces number of round trips |
| Move to a cloud provider with Seoul region | Complete | Defeats the purpose of choosing Railway |

### 10.5 Quantified Impact on Ticket Booking Flows

#### Seat Selection Race (Most Critical)
Two users click the same seat at the same time. User A is on Cloud Run Seoul, User B is on Railway Singapore:
- User A's lock request arrives at server: **~24ms**
- User B's lock request arrives at server: **~154ms**
- **User A wins the seat 100% of the time** if clicking within ~130ms of User B

During hot ticket opens, this 130ms difference means Railway users are systematically disadvantaged. For a platform where YOUR users are ALL in Seoul, using a Seoul server means they all get the fastest possible experience.

#### Queue System
- Queue position updates: Cloud Run delivers in ~5ms, Railway in ~75ms
- 10-minute seat hold TTL: No meaningful impact (70ms on 600,000ms is negligible)
- Initial queue entry: Cloud Run ~24ms vs Railway ~154ms (130ms advantage)

#### Payment Flow
- Payment API call chain (3-5 calls): Cloud Run ~120ms total vs Railway ~650ms total
- Not a deal-breaker but noticeably slower

### 10.6 Final Latency Verdict

**The 67-80ms base latency from Singapore to Seoul is a fundamental, unmitigable disadvantage for Railway when building a competitive ticket booking platform for Korean users.** CDN cannot help with API calls. Edge functions cannot help with stateful operations. The only real solution is to put the server in Seoul.

---

## 11. Consolidated Recommendation

### For MVP / Rapid Prototyping Phase (0-3 months)

**Consider Railway** if:
- You want to ship the fastest possible MVP
- You're testing product-market fit and latency is not yet critical
- You want to minimize DevOps learning curve
- Your initial users can tolerate ~150ms API response times

**Estimated cost**: $24-45/month on Railway Pro

### For Production Launch (3+ months)

**Use Cloud Run Seoul** because:
1. **Latency**: 67-80ms round-trip penalty from Singapore is unacceptable for competitive ticket booking
2. **WebSocket**: Railway's 10K domain limit cannot support 50K concurrent users for hot ticket opens
3. **Burst scaling**: Cloud Run's auto-scaling handles ticket open bursts without manual intervention
4. **Reliability**: 99.95% SLA with financial credits vs no SLA
5. **Deployment strategies**: Canary and traffic splitting are essential for a production payment platform
6. **Data sovereignty**: Korean user data stored in Seoul data center

**Estimated cost**: $85-200/month depending on configuration

### Recommended Architecture (Production)

```
[Next.js 16 Frontend]  →  Vercel (Seoul CDN edge) or Cloud Run
        |
        v
[NestJS 11 API]        →  Cloud Run Service (asia-northeast3, Seoul)
        |                   - min-instances=1
        |                   - max-instances=100+
        |                   - concurrency=250
        |
        +── PostgreSQL  →  Cloud SQL (asia-northeast3)
        |                   - Start: db-f1-micro ($12/mo)
        |                   - Scale: db-custom-1-3840 + HA ($110/mo)
        |
        +── Redis       →  Upstash (Start) → Memorystore (Scale)
        |                   - Start: $0-10/mo
        |                   - Scale: $44-58/mo
        |
        +── Real-time   →  Cloud Run WebSocket + Redis Pub/Sub

[Batch Jobs]           →  Cloud Run Jobs + Cloud Scheduler
```

### Migration Path (If Starting on Railway)

If you start on Railway for MVP speed and later need to migrate to Cloud Run:

1. **Use Dockerfile from day one** (not Nixpacks) for portability
2. **Use standard PostgreSQL** (pg_dump works on both)
3. **Use Upstash Redis** (works with both platforms)
4. **Avoid Railway-specific features** like variable references (${{...}})
5. Migration effort: ~1-2 days for an experienced developer

---

## 12. Final Comparison Scorecard

| Dimension (Weight) | Cloud Run Seoul | Railway Singapore |
|---|---|---|
| Latency to Korea (25%) | **10/10** | **3/10** |
| Developer Experience (15%) | 6/10 | **10/10** |
| WebSocket/Real-time (15%) | **9/10** | 5/10 |
| Burst Traffic (15%) | **9/10** | 6/10 |
| Pricing - MVP (5%) | 7/10 | **9/10** |
| Pricing - Production (5%) | 6/10 | **8/10** |
| Reliability/SLA (10%) | **10/10** | 5/10 |
| Operational Simplicity (5%) | 4/10 | **10/10** |
| Scalability Ceiling (5%) | **10/10** | 7/10 |
| **Weighted Total** | **8.3/10** | **5.8/10** |

**For this specific use case (Korean ticket booking with real-time seat selection and burst traffic), Cloud Run Seoul is the clear winner despite its operational complexity.**

---

## Sources

### Railway
- [Railway Pricing](https://railway.com/pricing)
- [Railway Pricing Plans Documentation](https://docs.railway.com/pricing/plans)
- [Railway Deployment Regions](https://docs.railway.com/reference/deployment-regions)
- [Railway Scaling Documentation](https://docs.railway.com/reference/scaling)
- [Railway Monorepo Deployment Guide](https://docs.railway.com/guides/monorepo)
- [Railway Variables Documentation](https://docs.railway.com/variables)
- [Railway Environments](https://docs.railway.com/environments)
- [Railway WebSocket Connection Limits](https://station.railway.com/questions/concurrency-limit-for-websocket-connecti-0ef3813c)
- [Railway Request Timeout Workarounds](https://station.railway.com/questions/any-workarounds-for-the-5-min-request-ti-b055adde)
- [Railway PostgreSQL Backup Guide](https://blog.railway.com/p/postgre-backup)
- [Railway Automated PostgreSQL Backups](https://blog.railway.com/p/automated-postgresql-backups)
- [Railway Database Connection Pooling](https://blog.railway.com/p/database-connection-pooling)
- [Railway Incident Report: Sept 22, 2025](https://blog.railway.com/p/incident-report-sept-22-2025)
- [Railway Incident Report: Oct 28, 2025](https://blog.railway.com/p/incident-report-oct-28th-2025)
- [Railway Incident Report: Dec 8, 2025](https://blog.railway.com/p/incident-report-december-8-2025)
- [Railway Infrastructure Growing Pains](https://www.webpronews.com/railways-infrastructure-growing-pains-how-a-rising-cloud-platform-is-navigating-reliability-challenges-in-real-time/)
- [Railway SLA Discussion](https://station.railway.com/questions/railway-s-sl-as-b851c079)
- [Railway Support Tiers](https://docs.railway.com/platform/support)
- [Railway Cold Start Performance](https://blog.railway.com/p/launch-week-01-scale-to-zero)
- [Railway Deployment Methods Comparison](https://blog.railway.com/p/comparing-deployment-methods-in-railway)
- [Railway Docker Support](https://docs.railway.com/builds/dockerfiles)
- [Railway Deployment Actions (Rollback)](https://docs.railway.com/deployments/deployment-actions)
- [Railway Custom Domains](https://docs.railway.com/networking/domains)
- [Railway NestJS + Next.js Monorepo Example](https://github.com/GRoobArt/Railway-Monorepo-Next-Nest)
- [Railway Review 2026](https://www.srvrlss.io/provider/railway/)
- [Railway vs Render 2026](https://northflank.com/blog/railway-vs-render)

### Google Cloud Run
- [Cloud Run SLA](https://cloud.google.com/run/sla)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Run Pricing Guide 2025](https://cloudchipr.com/blog/cloud-run-pricing)
- [Cloud Run Autoscaling](https://docs.cloud.google.com/run/docs/about-instance-autoscaling)
- [Cloud Run Concurrency](https://docs.cloud.google.com/run/docs/about-concurrency)
- [Cloud Run Rollbacks and Traffic Migration](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
- [Cloud Run Continuous Deployment](https://docs.cloud.google.com/run/docs/continuous-deployment)
- [Cloud Run GitHub Actions](https://github.com/google-github-actions/deploy-cloudrun)
- [Cloud Run WebSocket Support](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Cloud Run Health Checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks)
- [Cloud Run Startup CPU Boost](https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions)
- [Cloud Run Node.js Optimization](https://docs.cloud.google.com/run/docs/tips/nodejs)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [Cloud SQL Connection Pooling](https://docs.cloud.google.com/sql/docs/postgres/managed-connection-pooling)
- [Cloud Run + Cloud SQL Connection](https://docs.cloud.google.com/sql/docs/postgres/connect-run)
- [Memorystore Redis Pricing](https://cloud.google.com/memorystore/docs/redis/pricing)
- [GCP Service Health](https://status.cloud.google.com/products/3zaaDb7antc73BM1UAVT/history)
- [Deploy NestJS to Cloud Run](https://levelup.gitconnected.com/deploy-nest-js-application-on-google-cloud-run-759ecd1a0ac3)
- [Cloud Run Blue-Green Deployments](https://oneuptime.com/blog/post/2026-02-17-how-to-implement-blue-green-deployments-for-cloud-run-services-using-traffic-splitting-and-revisions/view)

### Latency & Networking
- [AWS Inter-Region Latency Map (BlueGoat)](https://latency.bluegoat.net/)
- [WonderNetwork Seoul-Singapore Ping](https://wondernetwork.com/pings/Seoul/Singapore)
- [Epsilon Network Latency Table](https://epsilontel.com/global-network-footprint/network-latency-city/)
- [Cloudflare CDN Performance](https://www.cloudflare.com/learning/cdn/performance/)

### Comparisons
- [Google Cloud vs Railway (GetDeploying)](https://getdeploying.com/google-cloud-vs-railway)
- [Railway vs Google Cloud (Sealos)](https://sealos.io/comparison/railway-vs-gcp/)
- [Railway vs Heroku vs Render 2025](https://deploy.me/blog/railway-vs-heroku-vs-render-2025)
- [Google Cloud Run vs Railway (srvrlss)](https://www.srvrlss.io/compare/google-cloud-vs-railway/)
