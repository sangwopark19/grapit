# Roadmap: Grapit

## Overview

Grapit delivers a ticket booking platform through 5 phases that follow the core transaction flow: authenticate users, populate a catalog, enable seat selection, process payments, and polish for launch. Each phase delivers a coherent, verifiable capability. The two highest-risk areas -- SVG seat maps and payment integration -- are isolated into separate phases to allow focused attention and early risk reduction.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Auth** - Project scaffolding, database schema, and user authentication
- [x] **Phase 2: Catalog + Admin** - Performance catalog, search, and admin content management
- [x] **Phase 3: Seat Map + Real-Time** - SVG seat rendering, interaction controls, and real-time seat occupancy
- [x] **Phase 4: Booking + Payment** - End-to-end booking flow, Toss Payments integration, and reservation management
- [ ] **Phase 5: Polish + Launch** - Mobile responsiveness, loading states, error handling, and production readiness

## Phase Details

### Phase 1: Foundation + Auth
**Goal**: Users can create accounts and maintain authenticated sessions across the application
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password and immediately log in
  2. User can log in via Kakao, Naver, or Google OAuth and have an account created automatically
  3. User's session persists across browser refreshes without re-login (JWT + refresh token rotation)
  4. User can log out and their session is invalidated
  5. NestJS modular monolith serves API endpoints and Next.js renders pages with shared type definitions
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffolding + DB schema + shared types
- [x] 01-02-PLAN.md — NestJS auth backend (email auth + JWT + refresh rotation + logout)
- [x] 01-03-PLAN.md — Frontend app shell + design system (GNB, Footer, Home, shadcn)
- [x] 01-04-PLAN.md — Social OAuth strategies (Kakao/Naver/Google) + SMS verification
- [x] 01-05-PLAN.md — Frontend auth pages + API integration + protected routes

### Phase 2: Catalog + Admin
**Goal**: Users can discover performances by genre and search, and admins can manage all content
**Depends on**: Phase 1
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, SRCH-01, SRCH-02, SRCH-03, ADMN-01, ADMN-02, ADMN-03
**Success Criteria** (what must be TRUE):
  1. User can browse performances by genre category and filter by subcategory
  2. User can view a performance detail page with poster, venue, dates, runtime, age rating, casting, and tier pricing
  3. User can search by performance name and filter results by genre, with a toggle to include/exclude ended shows
  4. Admin can create, edit, and delete performances with all required fields including poster upload
  5. Admin can manage showtimes (date/time) for each performance and upload SVG seat maps with tier/price configuration
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [x] 02-00-PLAN.md — Wave 0 test scaffolds for backend services (PerformanceService, SearchService, AdminService, RolesGuard)
- [x] 02-01-PLAN.md — DB schema (7 tables) + shared types/schemas + dependencies install
- [x] 02-02-PLAN.md — NestJS backend API (catalog, search, admin CRUD, RBAC, R2 upload)
- [x] 02-03-PLAN.md — Frontend public pages (homepage, genre, detail, search) + GNB activation
- [x] 02-04-PLAN.md — Frontend admin panel (performance form, banner management, SVG seat map)
- [x] 02-05-PLAN.md — UAT gap closure: detail page spacing + search layout shift fixes

### Phase 3: Seat Map + Real-Time
**Goal**: Users can view an interactive SVG seat map, select available seats, and see other users' selections in real time
**Depends on**: Phase 2
**Requirements**: SEAT-01, SEAT-02, SEAT-03, SEAT-04, SEAT-05, SEAT-06, BOOK-01, BOOK-02, BOOK-03, BOOK-04
**Success Criteria** (what must be TRUE):
  1. User can select a date and showtime, then see an SVG seat map with seats color-coded by tier
  2. User can zoom, pan, and pinch-zoom (mobile) the seat map, and see sold/occupied seats clearly disabled
  3. User can select seats and see them listed in a side panel with tier, row, number, and price
  4. Selected seat is locked via Redis SET NX for 10 minutes; lock auto-releases on TTL expiry
  5. Other users see seat selections/releases reflected in real time via WebSocket without page refresh
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Backend: Redis 좌석 잠금 + Socket.IO WebSocket 게이트웨이 + REST API
- [x] 03-02-PLAN.md — Frontend: SVG 좌석맵 UI + 날짜/회차 선택 + Zustand 예매 스토어
- [x] 03-03-PLAN.md — Real-time: Socket.IO 클라이언트 + 카운트다운 타이머 + 만료 모달
- [x] 03-04-PLAN.md — Gap closure: 만료 모달 레이아웃 + locked 좌석 토스트 + 모바일 반응형

### Phase 4: Booking + Payment
**Goal**: Users can complete the full booking-to-payment flow and manage their reservations
**Depends on**: Phase 3
**Requirements**: BOOK-05, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, RESV-01, RESV-02, RESV-03, ADMN-04
**Success Criteria** (what must be TRUE):
  1. User sees correct total price based on selected seat tiers/quantities before confirming payment
  2. User can pay via credit/debit card, KakaoPay, NaverPay, or bank transfer through Toss Payments
  3. User receives a booking number on the confirmation page after successful payment
  4. On payment failure or cancellation, seat locks are released and the user sees a clear error message with guidance
  5. User can view booking history, see booking details (number, seats, payment info, cancellation deadline), and cancel/refund before the deadline from My Page
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md — Backend: DB schema (reservations, payments), shared types, TossPaymentsClient, reservation/payment services
- [x] 04-02-PLAN.md — Frontend: 결제 확인 페이지 + Toss Payments 위젯 + 결제 완료 페이지
- [x] 04-03-PLAN.md — Frontend: 마이페이지 예매 내역 + 취소/환불 + 관리자 예매 대시보드

### Phase 5: Polish + Launch
**Goal**: The application handles edge cases gracefully, performs well on mobile, and is ready for real users
**Depends on**: Phase 4
**Requirements**: INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. All pages render correctly on mobile with 44px touch targets and responsive layout (bottom sheets where appropriate)
  2. Page loads show skeleton UI placeholders instead of blank screens or layout shifts
  3. API errors display user-friendly Korean messages with retry buttons instead of raw error codes
  4. Sentry captures errors in production and CI/CD pipeline deploys to Cloud Run on merge to main
**Plans**: 5 plans

Plans:
- [x] 05-01-PLAN.md — Mobile responsive: MobileTabBar + LayoutShell 통합 + 전체 공개 페이지 반응형 CSS
- [x] 05-02-PLAN.md — Skeleton UI: 11개 컴포넌트별 스켈레톤 variant + barrel export
- [x] 05-03-PLAN.md — Error handling: API 에러 인터셉터 + NetworkBanner + 404 페이지 + error.tsx 개선
- [x] 05-04-PLAN.md — Production infra: Sentry 설정 + Dockerfiles + GitHub Actions CI/CD + Cloud Run 배포
- [x] 05-05-PLAN.md — UAT gap closure: 포스터 이미지 잘림 + 예매 버튼 MobileTabBar 가림 수정

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 5/5 | Complete | 2026-03-30 |
| 2. Catalog + Admin | 6/6 | Complete | 2026-03-31 |
| 3. Seat Map + Real-Time | 4/4 | Complete | 2026-04-02 |
| 4. Booking + Payment | 3/3 | Complete | 2026-04-07 |
| 5. Polish + Launch | 0/5 | Not started | - |
