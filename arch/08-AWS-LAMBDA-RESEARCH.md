# AWS Lambda Research for Korean Ticket Booking Platform

**Date**: 2025-03-25
**Stack**: Next.js 16 + NestJS 11 + PostgreSQL + Redis
**Target Region**: ap-northeast-2 (Seoul)

---

## 1. Seoul Region (ap-northeast-2) Availability & Latency

- **Full availability**: ap-northeast-2 supports Lambda, API Gateway, RDS, ElastiCache, SQS, SNS, Step Functions, and all required services.
- **Latency from Korean users**: Domestic round-trip latency is typically **1-5ms** to the Seoul region from within Korea. This is the best possible choice for Korean end users.
- **AZs**: Seoul has 4 Availability Zones (apne2-az1 through apne2-az4).

---

## 2. Lambda Runtime Limits

| Resource | Limit |
|---|---|
| **Max execution time** | 15 minutes (900 seconds) |
| **Memory** | 128 MB to **10,240 MB** (10 GB), 1 MB increments |
| **Deployment package (zip)** | 50 MB compressed, 250 MB uncompressed |
| **Container image** | 10 GB |
| **/tmp storage** | 512 MB to **10,240 MB** (configurable) |
| **Concurrent executions** | 1,000 default (soft limit, can request increase) |
| **Burst concurrency** | 500-3000 depending on region |
| **Environment variables** | 4 KB total |
| **Layers** | 5 per function, 250 MB total unzipped |
| **Payload (sync)** | 6 MB request/response |
| **Payload (async)** | 256 KB |

---

## 3. Cold Starts: Node.js 22

### Typical Cold Start Times
- **Node.js 22 (optimized)**: ~375ms Init Duration
- **Node.js (general)**: 200-400ms range
- **With NestJS framework overhead**: 500-1500ms (depends on module count and bundle size)
- **VPC cold start addition**: Under 50-100ms (Hyperplane ENI improvement from 2019+)

### INIT Phase Billing Change (August 2025)
**Critical change**: AWS now bills the INIT phase (cold start) at the same rate as invocation duration.
- Before: Cold starts cost ~$0.80 per million invocations
- After: Cold starts cost ~$17.80 per million invocations (**22x increase**)
- Impact: 10-50% Lambda cost increase for functions with heavy startup logic

### Provisioned Concurrency Pricing (Seoul)
From AWS Pricing API (ap-northeast-2):

| Metric | x86 Price | ARM Price |
|---|---|---|
| **Provisioned Concurrency** | $0.0000051254/GB-s | $0.0000041003/GB-s |
| **Provisioned Duration** | $0.0000119592/GB-s | $0.0000095674/GB-s |

**Example cost**: 512MB function, 10 provisioned instances, 730 hours/month:
- x86: ~$15-20/month (concurrency charge only, plus invocation charges)
- A 1GB / 5-instance setup: ~$220/month before executions

**SnapStart**: Not available for Node.js. Only Java (Corretto) and Python are supported.

### Cold Start Mitigation Strategies
1. **Provisioned Concurrency** - eliminates cold starts, expensive
2. **Keep-warm pinging** - schedule CloudWatch Events every 5 min (cheap but hacky)
3. **esbuild bundling** - reduce package size, AWS-recommended for Node.js 18+
4. **Lazy loading** - defer module loading until first invocation needs them

---

## 4. NestJS on Lambda

### How It Works
Use **@codegenie/serverless-express** (formerly @vendia/serverless-express) to wrap the NestJS application:

```typescript
// lambda.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import express from 'express';
import { AppModule } from './app.module';

let cachedServer;

async function bootstrap() {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  await app.init();
  return serverlessExpress({ app: expressApp });
}

export const handler = async (event, context) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(event, context);
};
```

### Performance Implications
- **Cold start overhead**: NestJS DI container initialization adds 300-800ms on top of base Node.js cold start. Total: 700-1500ms.
- **Warm invocations**: Similar to traditional NestJS (~5-50ms for typical API calls). The `cachedServer` pattern reuses the NestJS app instance.
- **Bundle optimization**: Use esbuild to tree-shake and produce a smaller Lambda package. Critical for reducing cold starts.
- **Lambdalith pattern**: Deploy entire NestJS app as a single Lambda behind API Gateway. Simpler but all-or-nothing scaling.

### WebSocket Limitations
- **Lambda is stateless and short-lived** -- it cannot maintain persistent WebSocket connections.
- NestJS WebSocket Gateways (`@WebSocketGateway()`) will NOT work on Lambda.
- Must use **API Gateway WebSocket APIs** instead (see Section 8).
- Lambda functions handle `$connect`, `$disconnect`, and `$default` routes individually.
- Connection state must be stored externally (DynamoDB or Redis).

---

## 5. Next.js on Lambda (OpenNext / SST)

### How It Works
**SST (Serverless Stack Toolkit)** uses **OpenNext** as an adapter to deploy Next.js to AWS:
- OpenNext reverse-engineers the Next.js build output (designed for Vercel)
- Splits output into: Lambda functions (server-side), S3 (static assets), CloudFront (CDN)
- Image optimization runs in a separate Lambda

### Production Readiness
- **Used in production by**: NHS England, Udacity, Gymshark UK, and many others
- **Next.js 15**: Fully supported via OpenNext 3.9.14
- **Next.js 16**: Works but does NOT support the new `proxy.ts` convention yet; continue using `middleware.ts`
- **OpenNext actively maintained**: Regular releases tracking Next.js updates

### Known Issues & Gotchas
1. **Security**: Lambda Function URLs are publicly accessible by default (AuthType: NONE). Must enable IAM Authentication + CloudFront OAC to prevent direct DDoS.
2. **Feature gaps**: Some edge-case Next.js features may lag behind Vercel's native support.
3. **Middleware**: Runs on CloudFront Functions or Lambda@Edge, not in the main Lambda. Some middleware features may behave differently.
4. **Cold starts**: Each SSR request hitting a cold Lambda adds 1-3 seconds. Provisioned concurrency recommended for critical pages.

### Deployment
```bash
npx sst deploy --stage production
```
SST manages: CloudFront distribution, S3 bucket, Lambda functions, API routes, image optimization.

---

## 6. Database Connectivity

### RDS PostgreSQL Seoul Pricing (On-Demand)

| Instance | vCPU | RAM | Single-AZ $/mo | Multi-AZ $/mo |
|---|---|---|---|---|
| **db.t4g.micro** | 2 | 1 GB | **$18.25** | $37.23 |
| **db.t3.micro** | 2 | 1 GB | **$20.44** | $40.88 |
| **db.t4g.small** | 2 | 2 GB | **$37.23** | $74.46 |

**Storage**: gp3 = ~$0.1288/GB-month in Seoul. 20GB minimum = ~$2.58/mo.

### Lambda-to-RDS Connection Problem
Lambda creates a new DB connection per cold start. Under high concurrency, this can exhaust PostgreSQL's `max_connections` (typically 100-200 for small instances).

### RDS Proxy (Recommended Solution)
- **What it does**: Maintains a warm connection pool. Lambda connects to proxy, proxy multiplexes to RDS.
- **Pricing**: ~$0.015/vCPU-hour. For db.t4g.micro (2 vCPU): **~$21.90/month**.
- **VPC requirement**: Both RDS and RDS Proxy must be in VPC. Lambda must be in VPC too.
- **Benefit**: Reduces connection overhead from seconds to milliseconds on warm connections.

### VPC Cold Start Impact
- Post-2019 Hyperplane ENI: VPC adds **under 50-100ms** to cold starts.
- No longer a significant concern. AWS pre-provisions ENIs.

### Total DB Cost Estimate (Minimum)
- db.t4g.micro Single-AZ: $18.25
- 20GB gp3 storage: $2.58
- RDS Proxy: $21.90
- **Total: ~$42.73/month**

---

## 7. Redis Options

### ElastiCache Redis Pricing (Seoul, On-Demand)

| Instance | Memory | Price/hr | Price/mo |
|---|---|---|---|
| **cache.t4g.micro** (Redis) | 0.5 GB | $0.019 | **$13.87** |
| **cache.t3.micro** (Redis) | 0.5 GB | $0.020 | **$14.60** |
| **cache.t4g.small** (Redis) | 1.37 GB | $0.038 | **$27.74** |

Note: Some Redis entries show higher prices ($0.024/hr, $17.52/mo) which likely reflect different configurations (e.g., data tiering or replication).

### ElastiCache Serverless
- Minimum: 1 GB of metered data storage
- Pricing: Per GB-hour stored + per ECPU (ElastiCache Compute Unit)
- Good for unpredictable traffic but potentially more expensive at steady-state

### ElastiCache Valkey (Redis-compatible, open source)
| Instance | Memory | Price/hr | Price/mo |
|---|---|---|---|
| **cache.t4g.micro** (Valkey) | 0.5 GB | $0.0192 | **$14.02** |
| **cache.t4g.small** (Valkey) | 1.37 GB | $0.0376 | **$27.45** |

Valkey is AWS's Redis-compatible fork after the Redis license change. Slightly cheaper and recommended for new deployments.

### MemoryDB for Redis
- Durable, Redis-compatible, multi-AZ by default
- More expensive than ElastiCache (~2x)
- Overkill for caching; better suited for primary data store use cases
- Minimum instance: db.t4g.small ~$55-65/month in Seoul

### VPC Requirement
ElastiCache MUST run in a VPC. Lambda must be VPC-attached to reach it.

---

## 8. WebSocket: API Gateway WebSocket APIs

### Pricing (Seoul, ap-northeast-2)
| Metric | Price |
|---|---|
| **Messages** (first 1B/mo) | **$1.14 per million** |
| **Messages** (over 1B/mo) | $0.94 per million |
| **Connection minutes** | **$0.285 per million minutes** |

Messages metered in 32KB chunks. A 33KB message = 2 messages billed.

### Connection Limits
| Limit | Value |
|---|---|
| Max message size | 128 KB |
| Max connection duration | **2 hours** (must reconnect) |
| New connections/second | 500 (default, can increase) |
| Theoretical max concurrent | ~3.6 million |
| Idle connection timeout | 10 minutes |

### Architecture for Real-Time Seat Updates
```
Client <-> API Gateway WebSocket <-> Lambda ($connect, $disconnect, sendMessage)
                                        |
                                   DynamoDB (connection registry)
                                        |
                                   Lambda (seat update broadcaster)
```

### Limitations for Ticket Booking
- **2-hour max connection**: Clients must implement reconnection logic.
- **10-minute idle timeout**: Must send ping/keepalive messages.
- **No server push without connection ID**: Must store connection IDs in DynamoDB/Redis and iterate to broadcast.
- **Cost at scale**: 10,000 concurrent users, each connected 1 hour, 100 messages each = ~$1.14 + negligible connection minutes. Very cheap.

---

## 9. Pricing: Lambda in Seoul (ap-northeast-2)

### Lambda Pricing (from AWS Pricing API)

| Metric | x86 Price | ARM (Graviton) Price |
|---|---|---|
| **Requests** | $0.20/million | $0.20/million |
| **Duration Tier 1** (first 6B GB-s) | $0.0000166667/GB-s | $0.0000133334/GB-s |
| **Duration Tier 2** (next 9B GB-s) | $0.0000150000/GB-s | $0.0000120001/GB-s |
| **Duration Tier 3** (over 15B GB-s) | $0.0000133334/GB-s | $0.0000106667/GB-s |
| **Ephemeral storage** | $0.0000000352/GB-s | $0.0000000352/GB-s |

**Free tier**: 1M requests + 400,000 GB-seconds per month (12 months).

### Cost Estimates: Ticket Booking API (NestJS on Lambda)

**Assumptions**: 512MB memory, average 200ms duration per request, x86 architecture.

#### 100K requests/day (3M/month)
| Item | Calculation | Monthly Cost |
|---|---|---|
| Requests | 3M x $0.20/M | $0.60 |
| Duration | 3M x 0.2s x 0.5GB x $0.0000166667 | $5.00 |
| **Lambda subtotal** | | **$5.60** |

#### 1M requests/day (30M/month)
| Item | Calculation | Monthly Cost |
|---|---|---|
| Requests | 30M x $0.20/M | $6.00 |
| Duration | 30M x 0.2s x 0.5GB x $0.0000166667 | $50.00 |
| **Lambda subtotal** | | **$56.00** |

### Total Infrastructure Cost Estimates

#### Minimum Viable (100K req/day)
| Service | Monthly Cost |
|---|---|
| Lambda (API) | $5.60 |
| Lambda (Next.js SSR) | ~$3-8 |
| API Gateway (HTTP API) | $3.69 (3M x $1.23/M) |
| RDS PostgreSQL (db.t4g.micro, Single-AZ) | $18.25 |
| RDS Storage (20GB gp3) | $2.58 |
| RDS Proxy | $21.90 |
| ElastiCache Redis (cache.t4g.micro) | $13.87 |
| NAT Gateway | **$32-45** |
| CloudFront | ~$5-10 |
| S3 (static assets) | ~$1-2 |
| **TOTAL** | **~$107-137/month** |

#### Growth (1M req/day)
| Service | Monthly Cost |
|---|---|
| Lambda (API) | $56.00 |
| Lambda (Next.js SSR) | ~$30-80 |
| API Gateway (HTTP API) | $36.90 (30M x $1.23/M) |
| RDS PostgreSQL (db.t4g.small, Single-AZ) | $37.23 |
| RDS Storage (50GB gp3) | $6.44 |
| RDS Proxy | $21.90 |
| ElastiCache Redis (cache.t4g.small) | $27.74 |
| NAT Gateway | **$32-60** |
| WebSocket API (est.) | ~$5-15 |
| CloudFront | ~$15-30 |
| S3 | ~$2-5 |
| **TOTAL** | **~$270-374/month** |

---

## 10. Event-Driven Architecture

### SQS (Seoul Pricing)
| Queue Type | Price per Million Requests |
|---|---|
| Standard (Tier 1) | $0.40 |
| FIFO (Tier 1) | $0.50 |
| Fair Queue surcharge | +$0.10 |

Free tier: 1M SQS requests/month.

### SQS vs pgboss
| Feature | SQS | pgboss |
|---|---|---|
| **Infrastructure** | Fully managed | Runs on your PostgreSQL |
| **Scalability** | Virtually unlimited | Limited by PostgreSQL connections |
| **Cost** | Pay-per-message | No extra cost (uses existing DB) |
| **Visibility timeout** | Built-in | Built-in |
| **FIFO ordering** | FIFO queues available | Yes |
| **Delayed jobs** | Up to 15 min delay | Flexible scheduling |
| **Lambda integration** | Native event source | Not applicable (needs long-running process) |
| **Verdict** | **Required for Lambda** | **Cannot run on Lambda** (needs persistent process) |

**pgboss requires a long-running process** to poll the database -- it cannot work in Lambda. SQS is the natural replacement in a serverless architecture.

### SNS (Seoul Pricing)
- API requests: $0.50/million
- HTTP/S deliveries: $0.06/100K
- Use for fan-out (one event -> multiple Lambda consumers)

### Step Functions (Seoul Pricing)
| Type | Price |
|---|---|
| **Standard** (state transitions) | **$0.0271 per 1,000 transitions** |
| **Express** (requests) | $1.00/million |
| **Express** (duration) | $0.0000166700/GB-s |

Free tier: 4,000 state transitions/month.

### Use Cases for Ticket Booking
- **SQS**: Payment processing queue, email notification queue, ticket generation
- **Step Functions**: Complex booking workflow (reserve -> pay -> confirm -> notify -> generate ticket)
- **SNS**: Fan-out seat updates to multiple services, push notifications
- **EventBridge**: Event routing between microservices

---

## 11. API Gateway: REST vs HTTP API

### Pricing Comparison (Seoul)

| Feature | REST API | HTTP API |
|---|---|---|
| **Price (first tier)** | $3.50/million | **$1.23/million** |
| **Price (300M+ tier)** | $3.19/million | $1.11/million |
| WebSocket support | No | No (separate WebSocket API) |
| Lambda proxy integration | Yes | Yes |
| Request validation | Yes | No |
| Caching | Yes (0.5GB: $0.02/hr) | No |
| WAF integration | Yes | No |
| Usage plans / API keys | Yes | No |
| Custom authorizers | Yes (Lambda) | Yes (Lambda, JWT) |
| Private APIs | Yes | No |

### Throttling Limits
- **Default rate**: 10,000 requests/second
- **Default burst**: 5,000 requests
- Per-route throttling available
- Can request increase from AWS

### Recommendation
**Use HTTP API** for the ticket booking platform:
- 65% cheaper than REST API
- Sufficient features for most use cases
- JWT authorizer support built-in
- If you need WAF or caching, use CloudFront in front of HTTP API

---

## 12. Known Gotchas

### NAT Gateway Costs (The Hidden Tax)
- **~$0.059/hour + $0.059/GB** in Seoul (estimated, similar to Tokyo at $0.062)
- **Base cost: ~$43/month** just for the gateway existing, before any data transfer
- Required when Lambda is in VPC and needs internet access (e.g., calling external payment APIs)
- **Mitigation options**:
  - Use **VPC Endpoints** for AWS services (S3, DynamoDB, SQS) -- free or $0.013/hr
  - Use **IPv6 with dual-stack** (`Ipv6AllowedForDualStack: true`) -- eliminates NAT for internet traffic
  - Use a **NAT instance** (t4g.nano: ~$3-4/month) instead of NAT Gateway -- 85% savings but less reliable
  - Avoid VPC entirely if possible (use DynamoDB instead of RDS/Redis) -- not practical for this stack

### VPC Networking Complexity
- Lambda, RDS, ElastiCache, and RDS Proxy all must be in the same VPC
- Need at least 2 subnets across 2 AZs
- Security groups and routing tables add configuration overhead
- VPC Endpoints needed for each AWS service to avoid NAT costs

### Solo Developer Operational Overhead
| Concern | Impact |
|---|---|
| Infrastructure as Code | Must learn CDK/SST/Terraform |
| Monitoring & debugging | CloudWatch Logs fragmented across functions |
| Local development | Harder to replicate Lambda environment locally |
| Cold start tuning | Ongoing optimization needed |
| VPC configuration | Complex networking setup |
| Deployment pipeline | More moving parts than a single server |
| Cost monitoring | Many small charges across services |

### Other Gotchas
1. **Lambda concurrency limits**: Default 1,000. During ticket sale bursts, you may hit this. Request increase proactively.
2. **API Gateway 29-second timeout**: API Gateway has a hard 29-second timeout, even though Lambda supports 15 minutes. Long-running operations must be async.
3. **Cold start during flash sales**: Ticket sales have extreme burst patterns. Without provisioned concurrency, first hundreds of users get 1-3 second delays.
4. **Connection limits with RDS Proxy**: RDS Proxy helps but db.t4g.micro only supports ~80-100 connections. May bottleneck during bursts.
5. **CloudWatch Logs costs**: High-traffic Lambda generates significant log volume. Set log retention and consider sampling.
6. **Vendor lock-in**: Heavy use of SQS, Step Functions, API Gateway WebSocket, and Lambda-specific patterns makes migration difficult.
7. **INIT billing**: Since August 2025, cold starts are billed, making burst-heavy workloads like ticket sales significantly more expensive.

---

## Summary Comparison

### Lambda vs. Alternatives for This Project

| Factor | AWS Lambda | Cloud Run (GCP) | Vercel |
|---|---|---|---|
| **Min monthly cost** | ~$107-137 | ~$50-80 | ~$20-50 |
| **Cold starts** | 500-1500ms (NestJS) | 500-2000ms | N/A (edge) |
| **WebSocket** | API GW WebSocket | Native | Limited |
| **DB connectivity** | Needs RDS Proxy ($22/mo) | Direct (Cloud SQL) | External |
| **Networking overhead** | NAT Gateway ($32-45/mo) | Simpler | None |
| **Complexity** | High | Medium | Low |
| **Max burst capacity** | Excellent | Good | Good |
| **Solo developer fit** | Poor-Medium | Medium-Good | Good |

### Verdict for Korean Ticket Booking Platform

**Lambda is viable but expensive and complex for a solo developer.**

Pros:
- Excellent auto-scaling for burst traffic (ticket sales)
- Seoul region with sub-5ms latency
- Pay-per-use (cheap at low traffic)
- Robust event-driven architecture (SQS, Step Functions)

Cons:
- NAT Gateway is an unavoidable ~$32-45/month tax for VPC-based resources
- RDS Proxy adds another ~$22/month just for connection pooling
- NestJS cold starts are painful (700-1500ms) without provisioned concurrency
- INIT billing (Aug 2025) makes burst-heavy workloads expensive
- Significant operational complexity for a solo developer
- WebSocket requires a completely different architecture than traditional NestJS
- Total minimum cost (~$107-137/month) is higher than simpler alternatives

---

## Sources

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [AWS Lambda Quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [Lambda Cold Start Optimization 2025](https://zircon.tech/blog/aws-lambda-cold-start-optimization-in-2025-what-actually-works/)
- [Lambda Cold Starts Now Cost Money (Aug 2025)](https://www.cloudyali.io/blogs/aws-lambda-cold-starts-now-cost-money-august-2025-billing-changes-explained)
- [Fastest Node 22 Lambda Coldstart](https://speedrun.nobackspacecrew.com/blog/2025/07/21/the-fastest-node-22-lambda-coldstart-configuration.html)
- [NestJS Serverless FAQ](https://docs.nestjs.com/faq/serverless)
- [NestJS on Lambda - Ultimate CDK Deployment](https://dev.to/slsbytheodo/nestjs-on-aws-lambda-the-ultimate-cdk-deployment-strategy-for-monolithic-apis-380j)
- [OpenNext for AWS](https://opennext.js.org/aws)
- [SST Next.js Docs](https://sst.dev/docs/start/aws/nextjs/)
- [RDS Proxy with Lambda](https://aws.amazon.com/blogs/compute/using-amazon-rds-proxy-with-aws-lambda/)
- [RDS Proxy Pricing](https://aws.amazon.com/rds/proxy/pricing/)
- [API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [API Gateway WebSocket Quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html)
- [Lambda VPC NAT Optimization](https://futuretechstack.io/posts/aws-lambda-vpc-nat-optimization/)
- [Lambda IPv6 VPC (No NAT)](https://carriagereturn.nl/aws/lambda/ipv6/vpc/nat/2025/11/16/lambda-ipv6-vpc.html)
- [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
- [SQS Pricing](https://aws.amazon.com/sqs/pricing/)
- [Step Functions Pricing](https://aws.amazon.com/step-functions/pricing/)
- [AWS Lambda Cold Start 7 Fixes 2026](https://www.agilesoftlabs.com/blog/2026/02/aws-lambda-cold-start-7-proven-fixes)
- [Provisioned Concurrency Cost Guide](https://cloudburn.io/blog/aws-lambda-provisioned-concurrency-cost-guide)
