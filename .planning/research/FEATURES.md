# Feature Landscape

**Domain:** Live entertainment ticket booking platform
**Researched:** 2026-03-27

---

## Table Stakes

Features users expect from a ticket booking platform. Missing any of these means the product feels broken.

| Feature | Why Expected | Complexity | Stack Implication |
|---------|--------------|------------|-------------------|
| Performance catalog with genre filtering | Core discovery flow -- users browse by category | Medium | TanStack Query + PostgreSQL tsvector/pg_trgm |
| Performance detail page (poster, info, schedule, pricing) | Users need full info before committing | Low | Next.js SSR for SEO, TanStack Query for dynamic data |
| Date/session picker (calendar) | Users select WHEN to attend | Medium | react-day-picker with disabled date modifiers |
| SVG seat map with grade colors | Users select WHERE to sit -- this IS the core UX | High | Inline SVG + react-zoom-pan-pinch + click handlers |
| Real-time seat occupancy | Users must see which seats are taken NOW | High | Socket.IO + Redis pub/sub + NestJS WebSocket gateway |
| Seat temporary lock (10min TTL) | Prevents double-booking during payment | Medium | Redis SET NX + TTL, backend timer |
| Payment integration (card + easy-pay) | Users pay for tickets | Medium | Toss Payments SDK (@tosspayments/tosspayments-sdk) |
| Booking confirmation + ticket | Users need proof of purchase | Low | Email + in-app confirmation page |
| My bookings (view/cancel/refund) | Users manage their reservations | Medium | CRUD on reservations table, Toss refund API |
| User auth (email + social login) | Account required for booking | Medium | @nestjs/jwt + @nestjs/passport + Kakao/Naver strategies |
| Search (text + autocomplete) | Users find specific performances | Medium | PostgreSQL tsvector + pg_trgm, no Elasticsearch needed |
| Mobile-responsive design | 60%+ traffic will be mobile | Medium | Tailwind CSS responsive, bottom sheet, touch targets 44px |
| Admin CRUD (performances, schedules, bookings) | Operator must manage content | Medium | Next.js /admin route group, server actions |

## Differentiators

Features that set Grapit apart. Not expected from day 1, but create competitive advantage.

| Feature | Value Proposition | Complexity | Phase |
|---------|-------------------|------------|-------|
| Pinch-to-zoom seat map with smooth gestures | Mobile-first seat selection (competitors often have clunky maps) | High | MVP |
| One-stop booking flow (seat -> payment -> done) | Fewer steps = higher conversion. NOL ticket pattern. | Medium | MVP |
| Real-time seat animation (selection -> lock transition) | Visual feedback makes the experience feel alive | Medium | Phase 1 |
| PostgreSQL-native full-text search (no ES) | Cost savings + operational simplicity at scale | Low | MVP |
| Keyboard-navigable seat map (a11y) | Accessibility differentiator, WAI-ARIA grid pattern | High | Phase 2 |
| Queue system for high-demand events | Fair access during traffic spikes | High | Phase 2 |
| Casting schedule per session | Musical/theater fans care deeply about cast | Low | Phase 3 |
| Reviews + expectations (community) | Social proof drives conversion | Medium | Phase 3 |

## Anti-Features

Features to explicitly NOT build. Each one has been considered and rejected.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Inline SVG seat map editor (admin) | 4-8 weeks of effort for a drag-and-drop editor. Premature for MVP. | Upload pre-made SVGs from Figma/Illustrator. Add editor in Phase 3+. |
| Microservices architecture | 1-person team cannot operate distributed systems. Network overhead, deployment complexity. | NestJS modular monolith. Module boundaries enable future extraction if needed. |
| Elasticsearch cluster | Overkill for <100k performances. Operational burden (JVM tuning, data sync). | PostgreSQL tsvector + pg_trgm. Migrate to ES only if search quality degrades at scale. |
| Kafka/RabbitMQ message queue | <100/min throughput does not justify message broker infrastructure. | pg-boss (PostgreSQL SKIP LOCKED). |
| Real-time chat / community | Doesn't fit ticket booking UX. Users come to buy, not chat. | Reviews/expectations in Phase 3. |
| Mobile native app (Phase 1) | Web-first validation. Native app is Phase 4 when product-market fit is proven. | Responsive web with mobile-optimized touch interactions. |
| Multi-language i18n | Korean-only market in early phases. i18n adds complexity to every string. | Defer to Phase 3+. Design with next-intl compatibility in mind. |
| Dark mode | Not in competitor reference (NOL ticket). Low-priority for ticket platform. | Use CSS custom properties so it's addable later. |
| Coupon/promotion system | Requires booking data to be meaningful. Premature optimization. | Phase 2 after booking data accumulates. |

## Feature Dependencies

```
Auth (email/social login)
  |
  +-> Performance catalog + search
  |     |
  |     +-> Performance detail page
  |           |
  |           +-> Date/session picker
  |                 |
  |                 +-> SVG seat map + real-time status
  |                       |
  |                       +-> Seat lock (Redis)
  |                             |
  |                             +-> Payment (Toss)
  |                                   |
  |                                   +-> Booking confirmation
  |                                         |
  |                                         +-> My bookings (view/cancel/refund)

Admin CRUD (parallel track)
  |
  +-> Performance CRUD
  +-> Schedule CRUD
  +-> SVG seat map upload
  +-> Booking management (view/refund)
```

## MVP Recommendation

**Prioritize (Phase 1 MVP):**

1. Auth (email + Kakao social login) -- gate for everything
2. Performance catalog with genre tabs + search
3. Performance detail with schedule picker
4. SVG seat map with zoom/pan and real-time occupancy
5. One-stop booking flow (seat -> payment -> confirmation)
6. Toss Payments integration (card + KakaoPay)
7. My bookings (view/cancel)
8. Admin: performance CRUD, schedule CRUD, SVG upload, booking view

**Defer:**

- Naver social login: add after Kakao validates the auth flow (Phase 1.5)
- Ranking system: needs accumulated booking data (Phase 2)
- Queue system: premature before traffic proves need (Phase 2)
- Promotions/coupons: no business logic to optimize yet (Phase 2)
- Casting schedule: nice-to-have, not core flow (Phase 3)
- Reviews/expectations: community features after user base (Phase 3)
- Inline seat map editor: enormous effort, use Figma SVG upload (Phase 3+)
- Mobile app: validate product-market fit on web first (Phase 4)

---

## Sources

- PROJECT.md requirements analysis
- docs/02-PRD.md feature prioritization (P0-P2)
- docs/03-ARCHITECTURE.md system design
- docs/04-UIUX-GUIDE.md component requirements
- NOL ticket (nol.interpark.com) competitive analysis from docs/01-SITE-ANALYSIS-REPORT.md
