# Research Summary: Grapit Ticket Booking Platform

**Domain:** Live entertainment ticket booking (Korean market)
**Researched:** 2026-03-27
**Overall confidence:** HIGH

---

## Executive Summary

The existing technology choices defined in PROJECT.md and docs/03-ARCHITECTURE.md are sound and well-reasoned. The core stack -- Next.js 16 + NestJS 11 + PostgreSQL 16 + Upstash Redis + Cloudflare R2 + Google Cloud Run -- is a strong fit for a solo-developer ticket booking platform. The "Just Use Postgres" philosophy (replacing Elasticsearch with tsvector/pg_trgm, replacing Kafka with pg-boss) is the right call at this scale.

Research validates every major infrastructure choice. The primary recommendations are at the library level: use Drizzle ORM over the TypeORM/Prisma mentioned in the architecture doc (better performance, smaller bundle, faster cold starts on Cloud Run), use argon2 over bcrypt for password hashing (OWASP 2025 primary recommendation), and adopt zod + drizzle-zod instead of class-validator for shared frontend/backend validation.

The highest-risk area is the SVG seat map -- rendering 1000+ interactive SVG elements with real-time WebSocket updates on mobile is the project's core technical challenge. The recommended approach (inline SVG + react-zoom-pan-pinch + Socket.IO with Redis adapter) is proven but requires careful performance profiling from the start. Start testing with small venues (<500 seats) and profile on low-end Android devices before scaling to large venues.

Payment integration with Toss Payments is straightforward but the state machine between payment confirmation and booking creation is a critical correctness concern. The "PENDING -> CONFIRMED" payment record pattern with pg-boss reconciliation jobs is essential to prevent charged-but-no-ticket scenarios.

## Key Findings

**Stack:** Next.js 16.2 + NestJS 11.1 + Drizzle ORM + PostgreSQL 16 + Upstash Redis + Socket.IO + Toss Payments. All versions verified current as of March 2026.

**Architecture:** Modular monolith is correct for solo development. Dual Redis client pattern (HTTP for general ops, TCP for WebSocket pub/sub) is a necessary architectural detail.

**Critical pitfall:** Double-booking race condition. Must implement Redis SET NX (first defense) + PostgreSQL WHERE status='AVAILABLE' (final guard) + full transaction wrapping. This is non-negotiable.

---

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation + Auth** - Project scaffolding, monorepo setup, database schema, authentication
   - Addresses: Project structure, Drizzle schema, JWT + Passport auth
   - Avoids: Starting with features before infrastructure is solid
   - Rationale: Every subsequent feature depends on auth and database

2. **Performance Catalog + Admin** - CRUD for performances, genre filtering, search, admin panel
   - Addresses: Performance catalog, PostgreSQL FTS, admin CRUD
   - Avoids: Building booking flow without content to book
   - Rationale: Need performances in the system before booking can work

3. **Seat Map + Real-Time** - SVG rendering, zoom/pan, WebSocket seat updates, Redis locking
   - Addresses: SVG seat map, real-time occupancy, seat locking
   - Avoids: SVG performance pitfall (start small, profile early)
   - Rationale: Highest-risk feature -- give it dedicated focus, not mixed with payment

4. **Booking + Payment** - Complete booking flow, Toss Payments integration, payment state machine
   - Addresses: End-to-end booking, payment, confirmation, cancellation
   - Avoids: Payment desync pitfall (dedicated phase for correctness)
   - Rationale: Payment integration requires Toss sandbox testing, business registration

5. **Polish + Launch Prep** - Error handling, loading states, mobile optimization, E2E testing, Sentry, deployment pipeline
   - Addresses: Production readiness, monitoring, CI/CD
   - Avoids: Shipping without observability
   - Rationale: Quality gate before real users

**Phase ordering rationale:**
- Auth before everything because all features are gated on user identity
- Catalog before booking because you need content to book
- Seat map before payment because the booking flow depends on seat selection working
- Payment separated from seat map to isolate the two highest-risk areas
- Polish last to consolidate quality across all features

**Research flags for phases:**
- Phase 3 (Seat Map): Likely needs deeper research on SVG performance with 1000+ seats on mobile. Profile early.
- Phase 4 (Payment): Needs Toss Payments sandbox account setup. Business registration required.
- Phase 3 (WebSocket): Test multi-instance Socket.IO with Redis adapter using min-instances=2 on Cloud Run.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (core frameworks) | HIGH | All versions verified via npm/official docs. Next.js 16, NestJS 11, React 19 all stable and current. |
| Stack (ORM choice) | HIGH | Drizzle ORM recommendation based on multiple 2025/2026 comparisons, Trilon (NestJS consultancy) endorsement, performance benchmarks. |
| Stack (supporting libraries) | HIGH | TanStack Query, Zustand, react-hook-form, Swiper, zod -- all actively maintained, React 19 compatible, versions verified. |
| Stack (react-zoom-pan-pinch) | MEDIUM | Stable at v3.7 but last npm publish was ~1 year ago. API is stable, 350+ dependents, but watch for React 19 edge cases. |
| Features | HIGH | Based on direct NOL ticket competitor analysis in project docs + standard ticket platform expectations. |
| Architecture | HIGH | Modular monolith, dual Redis pattern, Socket.IO + Redis adapter all well-documented patterns. |
| Pitfalls | HIGH | Double-booking, payment desync, SVG performance -- all based on real production incident patterns in ticket booking systems. |
| Payment (Toss) | MEDIUM | SDK verified (v2.5.0), but actual integration requires sandbox testing + business registration that cannot be validated via research alone. |

---

## Gaps to Address

- **SVG seat map performance benchmarks**: Need actual profiling with 500/1000/2000 seat venues on target devices. Research can only recommend patterns, not guarantee performance.
- **Toss Payments sandbox access**: Requires business registration + PG contract. Cannot fully validate integration flow without real sandbox credentials.
- **Upstash Redis Seoul edge latency**: Theoretical 5-15ms from Cloud Run Seoul, but needs validation under load. If latency is higher, consider Upstash TCP connection or self-hosted Redis on GCP.
- **Cloud SQL + pg-boss under Cloud Run**: pg-boss polls PostgreSQL. Need to verify that Cloud Run's request-based billing model doesn't conflict with pg-boss's always-polling worker pattern. May need to set min-instances=1 for the API service or run pg-boss worker as a separate Cloud Run service.
- **drizzle-zod stability**: At v0.7.x, this is a younger package. If schema generation has edge cases, fall back to manually writing Zod schemas (still use zod, just not auto-generated).
- **Korean search quality**: pg_trgm + tsvector is theoretically sufficient, but actual Korean search quality needs validation with real user queries. Monitor zero-result rate post-launch.
