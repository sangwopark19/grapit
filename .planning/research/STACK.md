# Technology Stack

**Project:** Grapit -- Ticket Booking Platform
**Researched:** 2026-03-27
**Overall Confidence:** HIGH

---

## Recommended Stack

### Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 22.22.x LTS (Jod) | Server runtime for Next.js + NestJS | Active LTS until April 2027. All frameworks in this stack require >= 20.9.0. v22 is the safe choice -- v24 LTS exists but ecosystem adoption is still catching up. | HIGH |
| TypeScript | 5.9.x | Type system | Stable since August 2025. TS 6.0 and 7.0 (Go-based) are coming but not production-ready. Stick with 5.9 for now; upgrade path is straightforward. | HIGH |

### Frontend Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 16.2.x | SSR/SSG framework | Released Oct 2025. Turbopack stable for dev+prod, 50%+ faster builds. `output: 'standalone'` for Cloud Run containers. App Router is the standard. | HIGH |
| React | 19.x (bundled with Next.js 16) | UI library | React 19 ships with Next.js 16. Use whatever version Next.js pins -- currently 19.1.x in the Next.js peer dependency. Do not independently pin React. | HIGH |
| Tailwind CSS | 4.2.x | Utility CSS | v4 is 5x faster full builds, 100x faster incremental. CSS-first config (no JS config file). next/font integration works out of the box. | HIGH |

### Frontend Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| @tanstack/react-query | 5.95.x | Server state management | The standard for async state in React. Built-in Suspense support, optimistic updates, streaming with RSC. Actively maintained (releases weekly). | HIGH |
| zustand | 5.0.x | Client state management | Minimal API, ~1kb, React 19 compatible. Use for booking flow state (selected seats, schedule), user session. Name stores with `use` prefix for React Compiler compatibility. | HIGH |
| react-hook-form | 7.72.x | Form management | Uncontrolled-first approach minimizes re-renders. Works with React 19 and useActionState. Pair with zod for schema validation. | HIGH |
| zod | 4.3.x | Schema validation | TypeScript-first validation. Use for both frontend form schemas and backend DTO validation (via drizzle-zod for DB schema parity). v4 is stable. | HIGH |
| swiper | 12.1.x | Carousel/slider | v12 (Sep 2025): pure CSS theming, no SCSS/LESS. Use for banner carousels, performance card sliders. Element-based API is the recommended approach. | HIGH |
| react-day-picker | 9.x | Calendar component | Lightweight, accessible (WCAG 2.1 AA), customizable. Better for booking calendars than react-calendar because it supports disabled dates natively, locale, and custom modifiers for "sold out" / "available" states. | MEDIUM |
| react-zoom-pan-pinch | 3.7.x | SVG seat map zoom/pan | 350+ downstream projects. Supports pinch zoom, wheel zoom, double-tap zoom. Wrap the SVG seat map with TransformWrapper + TransformComponent. Last release was ~1 year ago but stable API, no breaking changes expected. | MEDIUM |
| @tosspayments/tosspayments-sdk | 2.5.x | Payment UI (frontend) | Official Toss Payments SDK. Handles payment widget rendering, card input, easy-pay flow. The `@tosspayments/sdk` package is deprecated -- use this one. | HIGH |
| @sentry/nextjs | 10.x | Error tracking (frontend) | Official Sentry SDK for Next.js. Source map upload, performance monitoring, session replay. Install via `npx @sentry/wizard`. | HIGH |
| sharp | latest | Image optimization | Required for Next.js image optimization in standalone mode. Must be explicitly installed for Cloud Run deployment. | HIGH |

### Backend Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| NestJS | 11.x (@nestjs/core 11.1.x) | API framework | Modular monolith via NestJS modules. TypeScript-native, DI container, guards/interceptors/pipes. v11 (Jan 2025) added JSON logging, IntrinsicException. | HIGH |
| Drizzle ORM | 0.45.x (stable) | Database ORM | Use over TypeORM and Prisma. 14x lower latency than N+1-prone ORMs, ~7kb bundle, zero dependencies, SQL-first approach. Code-first schema definition in TypeScript. 1.0-beta exists but stick with 0.45.x stable for production. | HIGH |
| drizzle-kit | 0.30.x | DB migrations | Companion CLI for Drizzle. Generates SQL migrations from schema changes. `drizzle-kit generate` + `drizzle-kit migrate`. | HIGH |
| pg (node-postgres) | 8.x | PostgreSQL driver | Use with Drizzle ORM. Connection pooling via `pg.Pool`. Drizzle wraps this -- do not use an ORM-specific driver. | HIGH |
| pg-boss | 12.14.x | Job queue | PostgreSQL-native job queue using SKIP LOCKED. Cron scheduling, priority queues, dead letter queues, automatic retries with exponential backoff. Direct integration (no NestJS wrapper needed -- create a custom provider). | HIGH |

### Backend Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| @nestjs/jwt | 10.x | JWT token management | Official NestJS JWT module. Access token (15min) + Refresh token rotation (7d httpOnly cookie). | HIGH |
| @nestjs/passport | 11.0.x | Auth strategies | Official NestJS Passport module. Use passport-kakao, passport-naver for social login strategies. | HIGH |
| @nestjs/config | 4.0.x | Configuration | `.env` loading, typed config namespaces, validation via Joi or zod. | HIGH |
| @nestjs/terminus | 11.1.x | Health checks | Cloud Run health check endpoint. Checks DB connection + Redis connection. | HIGH |
| @nestjs/websockets | 11.1.x | WebSocket gateway | Real-time seat status broadcasting. Use with Socket.IO adapter for namespace support + Redis adapter for multi-instance. | HIGH |
| @nestjs/platform-socket.io | 11.1.x | Socket.IO adapter | Default WebSocket adapter for NestJS. Provides namespaces, rooms, automatic reconnection. Use over raw `ws` because Cloud Run multi-instance requires Redis pub/sub relay, and Socket.IO has built-in Redis adapter. | HIGH |
| socket.io | 4.x | WebSocket server | Underlying WebSocket library. Paired with @socket.io/redis-adapter for multi-instance broadcast. | HIGH |
| @socket.io/redis-adapter | 8.x | Multi-instance WebSocket | Connects Socket.IO across Cloud Run instances via Redis pub/sub. Essential for seat status broadcast when scaled to multiple instances. | HIGH |
| @upstash/redis | 1.37.x | Redis client | HTTP-based Redis client for Upstash. Serverless-friendly, no persistent connections. Use for seat locking (SET NX), queue position, ranking cache. | HIGH |
| ioredis | 5.x | Redis client (WebSocket pub/sub) | TCP-based Redis client. Required for Socket.IO Redis adapter (pub/sub requires persistent connections that @upstash/redis HTTP client cannot provide). Use ioredis ONLY for WebSocket pub/sub; use @upstash/redis for everything else. | HIGH |
| argon2 | 0.41.x | Password hashing | OWASP-recommended over bcrypt. Memory-hard (resists GPU/ASIC attacks). Use argon2id variant. Configured: memory 19 MiB, iterations 2, parallelism 1. | HIGH |
| helmet | 8.x | HTTP security headers | OWASP security headers middleware. Apply via NestJS middleware. | HIGH |
| @aws-sdk/client-s3 | 3.x | R2 object storage | S3-compatible SDK for Cloudflare R2. Change endpoint to `<ACCOUNT_ID>.r2.cloudflarestorage.com`. Zero egress fees. | HIGH |
| @sentry/nestjs | 10.x | Error tracking (backend) | Official Sentry SDK for NestJS. Performance monitoring, distributed tracing, exception capture. | HIGH |
| drizzle-zod | 0.7.x | Schema-to-Zod bridge | Auto-generate Zod schemas from Drizzle table definitions. Shared validation between DB layer and API DTOs. Eliminates class-validator/class-transformer dependency. | MEDIUM |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloud SQL PostgreSQL | 16 | Primary database | Seoul region (asia-northeast3), automatic backup (7-day PITR), 99.95% SLA. PostgreSQL 16 for tsvector FTS, pg_trgm, SKIP LOCKED. | HIGH |
| Upstash Redis | Serverless | Cache + real-time | Seat locking (SET NX + TTL), queue position (Sorted Set), ranking cache, real-time pub/sub. Serverless = no idle cost. Seoul edge node for low latency. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Google Cloud Run | N/A | Container hosting | Seoul region, auto-scale to zero (min-instances=0 for cost), WebSocket/SSE native support. Separate services: `web` (Next.js) + `api` (NestJS). | HIGH |
| Cloudflare R2 | N/A | Object storage | S3-compatible, zero egress fees. Posters, SVG seat maps, static assets. | HIGH |
| Cloudflare CDN/WAF | Free plan | CDN + security | Static asset caching, DDoS protection, rate limiting. | HIGH |
| GitHub Actions | N/A | CI/CD | Workload Identity Federation (OIDC) for GCP auth. Build -> Artifact Registry -> Cloud Run deploy. | HIGH |
| Sentry | Free tier | Observability | Frontend + backend error tracking, performance monitoring. | HIGH |

### Dev Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @nestjs/cli | 11.x | NestJS scaffolding | Code generation, build, dev server |
| @nestjs/testing | 11.x | Test utilities | Integration testing with DI container |
| vitest | 3.x | Test runner | Fast, ESM-native, TypeScript-first. Use over Jest for new projects. |
| @testing-library/react | 16.x | Component testing | DOM testing utilities for React 19 |
| eslint | 9.x | Linting | Flat config format. Use @typescript-eslint for TS rules |
| prettier | 3.x | Formatting | Code formatting |
| drizzle-kit | 0.30.x | DB tooling | Migration generation and execution |
| @playwright/test | 1.x | E2E testing | Cross-browser E2E tests |

---

## Alternatives Considered

### ORM Decision: Drizzle over TypeORM and Prisma

| Criterion | Drizzle (Chosen) | TypeORM | Prisma |
|-----------|-----------------|---------|--------|
| Performance | 14x lower latency, single optimized SQL | N+1 prone, heavy abstraction | Rust query engine binary, cold start overhead |
| Bundle size | ~7kb, zero deps | Heavy, many deps | Requires binary engine (~5MB) |
| Type safety | Full TypeScript inference from schema | Decorator-based, weaker inference | Schema-first, generated client |
| NestJS integration | Manual provider (simple) | First-class (@nestjs/typeorm) | Community module |
| SQL control | SQL-like API, transparent queries | QueryBuilder or raw SQL | Limited raw SQL escape hatch |
| Cloud Run fit | Tiny bundle, fast cold start | Acceptable | Binary engine = slower cold start |
| Maintenance | Active, trending | Legacy, slower releases | Active but heavier |

**Decision:** Drizzle ORM. For a 1-person project on Cloud Run (where cold starts matter), Drizzle's minimal footprint and SQL-first approach provides better performance with less abstraction. The "manual provider" tradeoff is a one-time 20-line setup.

**Migration note:** The architecture doc mentions `TypeORM/Prisma` in `database.config.ts`. This should be changed to Drizzle configuration. The Drizzle schema will serve as the single source of truth for both migrations and Zod validation schemas (via drizzle-zod).

### Validation: drizzle-zod over class-validator

| Criterion | drizzle-zod + zod (Chosen) | class-validator + class-transformer |
|-----------|---------------------------|-------------------------------------|
| Schema source | Drizzle table = single source of truth | Separate DTO classes |
| Frontend sharing | Zod schemas work in browser | class-validator is backend-only |
| Bundle | zod: ~13kb | class-validator: ~50kb + class-transformer |
| TypeScript DX | Full type inference | Decorator-based, less inference |
| NestJS pipes | Custom ZodValidationPipe (10 lines) | Built-in ValidationPipe |

**Decision:** Use zod throughout the stack. Share validation schemas between frontend forms and backend DTOs. Write a simple NestJS ZodValidationPipe to replace the built-in class-validator ValidationPipe.

### WebSocket: Socket.IO over raw ws

| Criterion | Socket.IO (Chosen) | ws (raw WebSocket) |
|-----------|--------------------|--------------------|
| Multi-instance | @socket.io/redis-adapter built-in | Manual Redis pub/sub relay |
| Reconnection | Automatic with exponential backoff | Manual implementation |
| Namespaces/rooms | Built-in (useful for per-schedule seat rooms) | Not supported |
| Performance overhead | ~5-10% higher latency | Raw, minimal overhead |
| NestJS integration | @nestjs/platform-socket.io official | @nestjs/platform-ws official |

**Decision:** Socket.IO. The 5-10% latency overhead is negligible for seat status updates (not a latency-critical path). Built-in Redis adapter + rooms + reconnection saves significant implementation effort for a solo developer.

### Password Hashing: argon2 over bcrypt

| Criterion | argon2 (Chosen) | bcrypt |
|-----------|----------------|--------|
| Security | Memory-hard, GPU/ASIC resistant | CPU-only, vulnerable to GPU |
| OWASP recommendation | Primary recommendation (2025) | Acceptable with cost 12+ |
| Performance | ~200-500ms tunable | ~200-500ms with cost 12 |
| Node.js support | Native binding (argon2 npm) | Native binding (bcryptjs or bcrypt) |

**Decision:** argon2id. For a new project in 2026, use the OWASP primary recommendation. bcrypt is acceptable for existing projects but no reason to choose it for greenfield.

### Calendar: react-day-picker over react-calendar

| Criterion | react-day-picker (Chosen) | react-calendar |
|-----------|---------------------------|----------------|
| Size | Lightweight | Heavier |
| Disabled dates | Native disabled modifier | Less flexible |
| Custom modifiers | "sold-out", "available", "selected" modifiers | Limited |
| Accessibility | WCAG 2.1 AA compliant | Good but less documented |
| Styling | CSS-first, easy Tailwind integration | Requires overrides |

**Decision:** react-day-picker. Its modifier system maps perfectly to booking calendar requirements (available/sold-out/selected dates).

### SVG Seat Map: react-zoom-pan-pinch over react-svg-pan-zoom

| Criterion | react-zoom-pan-pinch (Chosen) | react-svg-pan-zoom |
|-----------|------------------------------|---------------------|
| React integration | Hooks-based, modern API | Class-based, older API |
| Touch support | Pinch zoom, wheel zoom, double-tap | Pinch zoom, wheel zoom |
| DOM agnostic | Works with any child element | SVG-specific |
| Bundle | Small | Larger |
| Maintenance | Stable (v3.7), widely used | Less active |

**Decision:** react-zoom-pan-pinch wrapping an inline SVG element. The SVG itself handles seat elements with click handlers; the wrapper handles zoom/pan/pinch gestures.

---

## What NOT to Use

| Technology | Why Not | Use Instead |
|------------|---------|-------------|
| TypeORM | Legacy patterns, N+1 prone, heavy abstraction, slower releases | Drizzle ORM |
| Prisma | Binary query engine (slow cold starts on Cloud Run), schema-first adds indirection | Drizzle ORM |
| MikroORM | Smaller ecosystem, less NestJS community adoption | Drizzle ORM |
| class-validator + class-transformer | Backend-only, cannot share with frontend, decorator-heavy | zod + drizzle-zod |
| BullMQ + Redis | Adds Redis complexity for job queue when PostgreSQL is already available | pg-boss (PostgreSQL native) |
| Kafka | Massive overkill for ~100/min job throughput | pg-boss |
| Elasticsearch | Overkill for performance catalog search (<100k records) | PostgreSQL tsvector + pg_trgm |
| raw ws library | No built-in reconnection, rooms, or Redis adapter | Socket.IO via @nestjs/platform-socket.io |
| bcrypt | Acceptable but not OWASP primary recommendation for new projects | argon2 |
| @tosspayments/sdk | Deprecated package | @tosspayments/tosspayments-sdk |
| @tosspayments/payment-sdk | Older package | @tosspayments/tosspayments-sdk |
| Jest | Slower, CJS-first, heavier config | vitest |
| Moment.js | Deprecated, heavy bundle | date-fns or native Intl |
| styled-components / CSS Modules | Unnecessary with Tailwind CSS v4 | Tailwind CSS |
| Redux / MobX | Overkill for this project's client state needs | Zustand |
| Apollo Client / urql | GraphQL clients -- this project uses REST | TanStack Query |
| Vercel hosting | Project deploys to Cloud Run, not Vercel | Google Cloud Run |

---

## Installation

### Frontend (apps/web)

```bash
# Core
npm install next@latest react@latest react-dom@latest

# Styling
npm install tailwindcss@latest @tailwindcss/postcss

# State & Data
npm install @tanstack/react-query@latest zustand@latest
npm install react-hook-form@latest zod@latest @hookform/resolvers@latest

# UI Components
npm install swiper@latest react-day-picker@latest react-zoom-pan-pinch@latest

# Payment
npm install @tosspayments/tosspayments-sdk@latest

# Observability
npm install @sentry/nextjs@latest

# Image optimization (required for standalone)
npm install sharp

# Dev
npm install -D typescript@~5.9 @types/react @types/node
npm install -D tailwindcss @tailwindcss/postcss
npm install -D eslint @typescript-eslint/eslint-plugin prettier
npm install -D vitest @testing-library/react @playwright/test
```

### Backend (apps/api)

```bash
# Core
npm install @nestjs/core@latest @nestjs/common@latest @nestjs/platform-express@latest
npm install rxjs reflect-metadata

# Database
npm install drizzle-orm@latest pg
npm install -D drizzle-kit @types/pg

# Validation
npm install zod drizzle-zod

# Auth
npm install @nestjs/jwt@latest @nestjs/passport@latest passport passport-jwt passport-kakao
npm install argon2

# WebSocket
npm install @nestjs/websockets@latest @nestjs/platform-socket.io@latest socket.io
npm install @socket.io/redis-adapter ioredis

# Redis
npm install @upstash/redis@latest

# Job Queue
npm install pg-boss@latest

# Storage
npm install @aws-sdk/client-s3

# Config & Health
npm install @nestjs/config@latest @nestjs/terminus@latest

# Security
npm install helmet

# Observability
npm install @sentry/nestjs@latest

# Dev
npm install -D @nestjs/cli@latest @nestjs/testing@latest
npm install -D typescript@~5.9 @types/node
npm install -D vitest
```

---

## Version Pinning Strategy

Pin major+minor, allow patch updates:

```json
{
  "next": "~16.2",
  "react": "^19.0",
  "@nestjs/core": "~11.1",
  "drizzle-orm": "~0.45",
  "pg-boss": "~12.14",
  "zustand": "~5.0",
  "@tanstack/react-query": "~5.95",
  "zod": "~4.3",
  "typescript": "~5.9"
}
```

Use `~` (tilde) for framework packages to get patches but not minor bumps. Use `^` (caret) for React since Next.js manages the React version.

---

## Redis Client Strategy (Important Architectural Note)

This project uses TWO Redis clients for different purposes:

| Client | Transport | Used For | Why |
|--------|-----------|----------|-----|
| @upstash/redis | HTTP | Seat locking, queue, ranking cache, general key/value | Serverless-friendly, no connection pool, works everywhere |
| ioredis | TCP | Socket.IO Redis adapter (pub/sub) | Pub/sub requires persistent TCP connections that HTTP client cannot provide |

Do NOT use ioredis for general Redis operations. Do NOT use @upstash/redis for WebSocket pub/sub. This dual-client pattern is intentional and necessary.

---

## pg-boss Integration Pattern (NestJS without wrapper)

Do not use community wrapper packages (@wavezync/nestjs-pgboss, etc.) -- they are small, often unmaintained, and add unnecessary abstraction. Instead, create a simple NestJS provider:

```typescript
// pgboss.provider.ts
import PgBoss from 'pg-boss';

export const PG_BOSS = Symbol('PG_BOSS');

export const pgBossProvider = {
  provide: PG_BOSS,
  useFactory: async () => {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
    });
    await boss.start();
    return boss;
  },
};
```

This is all you need. pg-boss manages its own schema, tables, and worker polling.

---

## Sources

- [Next.js 16 release blog](https://nextjs.org/blog/next-16)
- [Next.js 16.1 release blog](https://nextjs.org/blog/next-16-1)
- [NestJS 11 announcement (Trilon)](https://trilon.io/blog/announcing-nestjs-11-whats-new)
- [TypeScript 5.9 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
- [Drizzle ORM + NestJS (Trilon)](https://trilon.io/blog/nestjs-drizzleorm-a-great-match)
- [NestJS ORM comparison 2025](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c)
- [Node.js ORM comparison (thedataguy)](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)
- [Drizzle vs Prisma 2026 (makerkit)](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [pg-boss GitHub](https://github.com/timgit/pg-boss)
- [React Zoom Pan Pinch GitHub](https://github.com/BetterTyped/react-zoom-pan-pinch)
- [Swiper v12 blog](https://swiperjs.com/blog/swiper-v12)
- [React DayPicker docs](https://daypicker.dev/)
- [Toss Payments SDK npm](https://www.npmjs.com/package/@tosspayments/tosspayments-sdk)
- [Upstash Redis npm](https://www.npmjs.com/package/@upstash/redis)
- [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Cloudflare R2 S3 SDK](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- [Password hashing guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/)
- [NestJS WebSocket docs](https://docs.nestjs.com/websockets/gateways)
- [Scalable WebSockets NestJS + Redis (LogRocket)](https://blog.logrocket.com/scalable-websockets-with-nestjs-and-redis/)
- [TanStack Query npm](https://www.npmjs.com/package/@tanstack/react-query)
- [Zustand npm](https://www.npmjs.com/package/zustand)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [Node.js 22.22.x LTS](https://nodejs.org/en/about/previous-releases)
