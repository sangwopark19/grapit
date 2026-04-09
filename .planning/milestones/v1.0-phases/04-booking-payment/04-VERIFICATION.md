---
phase: 04-booking-payment
verified: 2026-04-03T01:06:56Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "User can pay via credit/debit card, KakaoPay, NaverPay, or bank transfer through Toss Payments"
    status: failed
    reason: "@tosspayments/tosspayments-sdk is declared in package.json and pnpm-lock.yaml but not installed in node_modules. The toss-payment-widget.tsx import fails at compile time (TS2307: Cannot find module '@tosspayments/tosspayments-sdk')."
    artifacts:
      - path: "apps/web/components/booking/toss-payment-widget.tsx"
        issue: "Import of @tosspayments/tosspayments-sdk fails — module not found in node_modules. pnpm install has not been run after the lockfile was updated."
    missing:
      - "Run `pnpm install` from the monorepo root to materialize the @tosspayments/tosspayments-sdk package into node_modules"
human_verification:
  - test: "End-to-end payment flow with Toss test keys"
    expected: "After configuring NEXT_PUBLIC_TOSS_CLIENT_KEY and TOSS_SECRET_KEY, the Toss Payments widget renders inline on the confirm page showing card, KakaoPay, NaverPay, and bank transfer options. Clicking '결제하기' triggers Toss redirect. On success, the complete page shows the booking number. On cancellation, the confirm page shows a toast error."
    why_human: "Requires Toss Payments test credentials (external service) and live browser interaction to verify SDK widget rendering and redirect-based payment flow."
  - test: "Reservation cancel flow on My Page"
    expected: "Navigating to /mypage?tab=reservations shows reservation cards. Clicking a card navigates to detail page. The cancel button opens AlertDialog. Selecting a reason and confirming sends the cancel request and shows success toast. The cancel button is disabled after the deadline with a tooltip."
    why_human: "Requires authenticated session with existing reservation data in the database to verify end-to-end cancel flow and deadline enforcement display."
  - test: "Admin booking dashboard with real data"
    expected: "Navigating to /admin/bookings (as admin) shows 3 stat cards with real values from DB, a searchable booking table, and clicking a row opens a detail modal with a working refund button."
    why_human: "Requires admin session and populated booking data in the database to verify stats accuracy and refund flow."
---

# Phase 4: Booking & Payment Verification Report

**Phase Goal:** Users can complete the full booking-to-payment flow and manage their reservations
**Verified:** 2026-04-03T01:06:56Z
**Status:** gaps_found — 1 gap blocking full goal achievement
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees correct total price based on selected seat tiers/quantities before confirming payment | VERIFIED | `order-summary.tsx` renders `totalPrice.toLocaleString('ko-KR')원`; server recalculates from `price_tiers` in `reservation.service.ts:calculateTotalAmount()` before confirming |
| 2 | User can pay via credit/debit card, KakaoPay, NaverPay, or bank transfer through Toss Payments | FAILED | `toss-payment-widget.tsx` imports `@tosspayments/tosspayments-sdk` which is declared in `package.json` but not installed in `node_modules`. `tsc --noEmit` reports TS2307. |
| 3 | User receives a booking number on the confirmation page after successful payment | VERIFIED | `booking-complete.tsx` renders `booking.reservationNumber` with `ui-monospace` font; server generates `GRP-YYYYMMDD-XXXXX` format in `reservation.service.ts:generateReservationNumber()` |
| 4 | On payment failure or cancellation, seat locks are released and the user sees a clear error message with guidance | VERIFIED | `confirm/page.tsx` parses Toss `failUrl` params (`code`, `message`) and shows targeted toast errors. Server-side: cancel endpoint calls `tossClient.cancelPayment()` and updates reservation status atomically. |
| 5 | User can view booking history, see booking details (number, seats, payment info, cancellation deadline), and cancel/refund before the deadline from My Page | VERIFIED | `mypage/page.tsx` has Tabs (프로필/예매 내역) with `useMyReservations`; `reservation-detail.tsx` shows all required fields; `cancel-confirm-modal.tsx` (AlertDialog, non-dismissible) with reason selection and refund preview; deadline enforced server-side via `ForbiddenException`. |

**Score:** 4/5 success criteria verified

---

## Required Artifacts

### Plan 01 — Backend Foundation

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/api/src/database/schema/reservations.ts` | VERIFIED | `pgEnum('reservation_status', ...)`, `cancelDeadline`, indexes present |
| `apps/api/src/database/schema/reservation-seats.ts` | VERIFIED | `reservation_seats` table with `seatId`, `tierName`, `price`, `row`, `number` |
| `apps/api/src/database/schema/payments.ts` | VERIFIED | `payment_key` column, Toss-specific fields present |
| `packages/shared/src/types/booking.types.ts` | VERIFIED | `ReservationStatus`, `ReservationDetail`, `PaymentInfo`, `BookingStats` all exported |
| `apps/api/src/modules/reservation/reservation.service.ts` | VERIFIED | `ReservationService` with amount validation, atomic transaction, deadline enforcement |
| `apps/api/src/modules/payment/toss-payments.client.ts` | VERIFIED | `TossPaymentsClient` with Basic auth, `confirmPayment`, `cancelPayment` |
| `apps/api/src/modules/admin/admin-booking.service.ts` | VERIFIED | `AdminBookingService` with stats queries, search/filter, refund via Toss API |

### Plan 02 — Booking Frontend

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/app/booking/[performanceId]/confirm/page.tsx` | VERIFIED | `use client`, `결제하기`, `useBookingStore`, `TossPaymentWidget`, all 4 components assembled |
| `apps/web/app/booking/[performanceId]/complete/page.tsx` | VERIFIED | `useConfirmPayment`, `paymentKey`, `clearBooking`, `BookingComplete`, page-refresh recovery |
| `apps/web/components/booking/toss-payment-widget.tsx` | STUB (compile error) | Implementation is complete (contains `loadTossPayments`, `renderPaymentMethods`, `requestPayment`) but SDK not installed in node_modules → TS2307 at compile time |
| `apps/web/hooks/use-booking.ts` | VERIFIED | `useConfirmPayment`, `useBookingDetail`, `useReservationByOrderId` present; calls `apiClient.post('/api/v1/payments/confirm', ...)` |
| `apps/web/stores/use-booking-store.ts` | VERIFIED | `selectedSeats`, `expiresAt`, `useBookingStore` present |

### Plan 03 — Reservation Management Frontend

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/app/mypage/page.tsx` | VERIFIED | `Tabs`, `예매 내역`, `프로필`, `useMyReservations` all present |
| `apps/web/app/mypage/reservations/[id]/page.tsx` | VERIFIED | `useReservationDetail`, `useCancelReservation` both imported and used |
| `apps/web/app/admin/bookings/page.tsx` | VERIFIED | Wraps `AdminBookingDashboard` |
| `apps/web/components/reservation/cancel-confirm-modal.tsx` | VERIFIED | `예매를 취소하시겠습니까`, `AlertDialog`, `환불 예정 금액`, `단순 변심`, non-dismissible (`onEscapeKeyDown={(e) => e.preventDefault()}`) |
| `apps/web/hooks/use-reservations.ts` | VERIFIED | `useMyReservations`, `useReservationDetail`, `useCancelReservation`, `useAdminBookings`, `useAdminRefund`, `keepPreviousData` all present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `reservation.service.ts` | `toss-payments.client.ts` | DI injection | WIRED | `private readonly tossClient: TossPaymentsClient` injected; calls `this.tossClient.confirmPayment()` (line 103) and `this.tossClient.cancelPayment()` (line 347) |
| `reservation.service.ts` | `schema/reservations.ts` | Drizzle ORM | WIRED | `this.db.insert(reservations)`, `this.db.update(reservations)`, `this.db.select().from(reservations)` throughout service |
| `confirm/page.tsx` | `toss-payment-widget.tsx` | Component composition | WIRED | `<TossPaymentWidget ... ref={paymentWidgetRef}>` at line 163; `paymentWidgetRef.current.requestPayment()` at line 109 |
| `toss-payment-widget.tsx` | `@tosspayments/tosspayments-sdk` | SDK import | NOT_WIRED | Import declared but SDK not installed in node_modules — TS2307 error |
| `complete/page.tsx` | `use-booking.ts` | React Query hooks | WIRED | `useConfirmPayment`, `useReservationByOrderId` both imported and called |
| `complete/page.tsx` | `/api/v1/payments/confirm` | `useConfirmPayment` mutation | WIRED | `confirmMutation.mutateAsync({paymentKey, orderId, amount, showtimeId, seats})` |
| `mypage/page.tsx` | `use-reservations.ts` | React Query hook | WIRED | `useMyReservations(filter)` called, data passed to `ReservationList` |
| `cancel-confirm-modal.tsx` | `use-reservations.ts` | Cancel mutation | WIRED | `useCancelReservation` called in `reservations/[id]/page.tsx`, passed to `ReservationDetail` → `CancelConfirmModal` |
| `admin/bookings/page.tsx` | `use-reservations.ts` | Admin booking hooks | WIRED | `AdminBookingDashboard` calls `useAdminBookings` and `useAdminRefund` |
| `admin.module.ts` | `payment.module.ts` | NestJS module import | WIRED | `imports: [PerformanceModule, PaymentModule]` — `TossPaymentsClient` available to `AdminBookingService` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `mypage/page.tsx` | `reservations` | `useMyReservations` → `GET /api/v1/users/me/reservations` → `reservation.service.getMyReservations()` → Drizzle joins `reservations + showtimes + performances + venues` | Yes — DB query with joins, seat fetch loop | FLOWING |
| `confirm/page.tsx` | `selectedSeats`, `performanceTitle`, etc. | `useBookingStore` (populated by Phase 3 seat selection flow) | Yes — populated by Phase 3 when seats are locked | FLOWING |
| `complete/page.tsx` | `bookingData` | `useConfirmPayment` mutation → `POST /api/v1/payments/confirm` → Toss API → DB transaction → `getReservationDetail()` | Yes — full DB query with joins | FLOWING |
| `admin-booking-dashboard.tsx` | `data.stats`, `data.bookings` | `useAdminBookings` → `GET /api/v1/admin/bookings` → `admin-booking.service.getBookings()` → real SQL count/sum queries | Yes — separate count/sum queries for stats | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Reservation number generated in GRP-YYYYMMDD-XXXXX format | `reservation.service.ts:43` — `return \`GRP-${dateStr}-${random}\`` | VERIFIED |
| Cancel deadline enforced server-side | `reservation.service.ts:337` — `ForbiddenException('취소 마감시간이 지났습니다')` when `cancelDeadline <= new Date()` | VERIFIED |
| Atomic reservation creation (reservation + seats + payment) | `reservation.service.ts:113` — `this.db.transaction(async (tx) => { ... insert reservations, reservationSeats, payments ... })` | VERIFIED |
| Server recalculates total before confirming (fraud prevention) | `reservation.service.ts:85-89` — `calculateTotalAmount()` from DB `price_tiers`, throws `BadRequestException` on mismatch | VERIFIED |
| All 6 plan commits exist in git history | `94d9d89`, `340e490`, `f29d5d7`, `45a3717`, `9f53466`, `3b70e0d` all verified in `git log` | VERIFIED |
| TypeScript compilation (API) | `tsc --noEmit` fails with Phase 3 pre-existing errors (`SeatState`, `LockSeatResponse` missing from @grapit/shared) — NOT introduced by Phase 4 | PRE-EXISTING |
| TypeScript compilation (Web) | `tsc --noEmit` fails — `@tosspayments/tosspayments-sdk` not installed (TS2307). Additional pre-existing Phase 3 errors (`SeatState`, `tierColor`, `Showtime.performanceId`). One Phase 4 error in `admin-booking-detail-modal.tsx:150` — `formatDateTime(booking.paymentInfo.paidAt)` receives `string | null` but expects `string`. | GAPS_FOUND |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| BOOK-05 | 04-01, 04-02 | 예매 플로우 완성 (좌석 선택 → 결제 → 예매번호 발급) | VERIFIED | Confirm page assembles full checkout flow; server creates reservation atomically and generates GRP number |
| PAY-01 | 04-02 | 신용/체크카드로 결제할 수 있다 | BLOCKED | SDK not installed — widget cannot render |
| PAY-02 | 04-02 | 카카오페이로 결제할 수 있다 | BLOCKED | SDK not installed — widget cannot render |
| PAY-03 | 04-02 | 네이버페이로 결제할 수 있다 | BLOCKED | SDK not installed — widget cannot render |
| PAY-04 | 04-02 | 계좌이체로 결제할 수 있다 | BLOCKED | SDK not installed — widget cannot render |
| PAY-05 | 04-01, 04-02 | 최종 결제 금액이 좌석 등급/수량 기반으로 정확히 표시된다 | VERIFIED | Server-side `calculateTotalAmount()` validates against DB `price_tiers`; `order-summary.tsx` displays breakdown |
| PAY-06 | 04-01, 04-02 | 결제 완료 시 예매번호가 발급되고 확인 페이지가 표시된다 | VERIFIED | `booking-complete.tsx` renders `reservationNumber` with monospace font; server generates GRP format |
| PAY-07 | 04-02 | 결제 실패/취소 시 좌석 점유가 해제되고 안내 메시지가 표시된다 | VERIFIED (partial) | `confirm/page.tsx` handles Toss `failUrl` params with targeted toast messages. Seat lock TTL-based release is per Phase 3 design (locks expire naturally within 10min); no explicit Redis unlock on failure (by design). |
| RESV-01 | 04-03 | 마이페이지에서 예매 내역 목록을 조회할 수 있다 | VERIFIED | `mypage/page.tsx` has reservations tab with `useMyReservations`; `reservation-list.tsx` with filter chips and card list |
| RESV-02 | 04-03 | 예매 상세(예매번호, 좌석, 결제 정보, 취소마감시간)를 확인할 수 있다 | VERIFIED | `reservation-detail.tsx` renders all four fields; detail page at `/mypage/reservations/[id]` |
| RESV-03 | 04-03 | 취소마감시간 전 예매를 취소하고 환불받을 수 있다 | VERIFIED | `cancel-confirm-modal.tsx` (AlertDialog) + `useCancelReservation` → `PUT /api/v1/reservations/:id/cancel` → `tossClient.cancelPayment()` → DB update; deadline enforced by `ForbiddenException` |
| ADMN-04 | 04-01, 04-03 | 관리자가 예매 목록을 조회하고 환불 처리할 수 있다 | VERIFIED | Admin sidebar updated with "예매 관리"; `admin-booking-dashboard.tsx` with stats + searchable table + refund modal via `useAdminRefund` |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web/components/booking/toss-payment-widget.tsx:4` | `Cannot find module '@tosspayments/tosspayments-sdk'` (TS2307) | BLOCKER | Payment widget cannot compile — entire payment flow broken in TypeScript strict mode |
| `apps/web/components/admin/admin-booking-detail-modal.tsx:150` | `formatDateTime(booking.paymentInfo.paidAt)` — `paidAt` is `string \| null` but `formatDateTime` expects `string` | WARNING | TypeScript error in admin modal; potential runtime error if `paidAt` is null |
| `apps/api/src/modules/booking/booking.gateway.ts` (Phase 3 pre-existing) | `SeatState`, `LockSeatResponse`, `SeatStatusResponse`, `UnlockAllResponse` not exported from `@grapit/shared` | WARNING | Pre-existing from Phase 3; not introduced by Phase 4; API tsc fails |
| `apps/web/components/booking/booking-page.tsx` (Phase 3 pre-existing) | `tierColor` not in `SeatSelection`, `Showtime.performanceId` missing | WARNING | Pre-existing from Phase 3; not introduced by Phase 4 |

---

## Human Verification Required

### 1. Toss Payments Widget End-to-End Flow

**Prerequisite:** Run `pnpm install` from monorepo root, then configure Toss test keys.

**Test:**
1. Add `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_...` and `TOSS_SECRET_KEY=test_gsk_...` to `.env`
2. Start servers (`pnpm dev`)
3. Complete seat selection on `/booking/[id]`
4. Navigate to `/booking/[id]/confirm` — verify Toss widget renders with payment method options
5. Click "결제하기" — verify Toss payment UI loads
6. Complete payment with test card — verify redirect to `/booking/[id]/complete` with booking number
7. Cancel payment — verify return to confirm page with "결제가 취소되었습니다." toast

**Expected:** Full payment flow works with Toss sandbox; booking number appears in GRP-YYYYMMDD-XXXXX format
**Why human:** Requires Toss Payments test credentials (external service) and browser interaction

### 2. Reservation Cancel Flow

**Test:**
1. Log in as user with an existing confirmed reservation
2. Navigate to `/mypage?tab=reservations`
3. Verify: reservation cards with poster, title, date, seat summary, status badge
4. Click reservation card → verify detail page shows booking number, all sections
5. Click "예매 취소" → verify AlertDialog opens (non-dismissible by backdrop/Escape)
6. Select cancel reason, verify "환불 예정 금액" shows correct amount
7. Confirm cancellation → verify success toast and status badge updates to "취소완료"
8. Navigate to a past-deadline reservation → verify cancel button is disabled with tooltip

**Expected:** Cancel flow completes, Toss refund is triggered server-side, status updates to CANCELLED
**Why human:** Requires live DB data and authenticated session; deadline behavior needs real timestamps

### 3. Admin Booking Management

**Test:**
1. Log in as admin, navigate to `/admin/bookings`
2. Verify "예매 관리" appears in admin sidebar
3. Verify 3 stat cards (총 예매수, 총 매출액, 취소율) render with real values
4. Test search by booking number and by booker name
5. Test status filter (예매완료 / 취소완료)
6. Click a row → verify detail modal shows full booking info
7. For a CONFIRMED booking, click "환불 처리" → enter reason → verify refund completes

**Expected:** Admin dashboard shows accurate statistics; search and filter work; refund processed via Toss API
**Why human:** Requires admin session and populated booking data

---

## Gaps Summary

**1 blocker gap: Toss Payments SDK not installed**

The `@tosspayments/tosspayments-sdk` package is listed in `apps/web/package.json` (v2.6.0) and recorded in `pnpm-lock.yaml`, but is not present in any `node_modules` directory accessible to the main worktree. The SDK was installed in a separate agent worktree (`/.claude/worktrees/agent-a01bb604/`) but the lockfile changes were not followed by running `pnpm install` in the main repo.

This causes:
- TypeScript compilation failure (TS2307) for `toss-payment-widget.tsx`
- The Toss Payments widget cannot be imported at build time
- PAY-01 through PAY-04 (all payment method requirements) are blocked

**Fix:** Run `pnpm install` from `/Users/sangwopark19/icons/grapit` to materialize the SDK.

**1 warning gap: TypeScript error in admin-booking-detail-modal.tsx**

`formatDateTime(booking.paymentInfo.paidAt)` at line 150 passes `string | null` where `string` is expected. This should be guarded: `booking.paymentInfo.paidAt ? formatDateTime(booking.paymentInfo.paidAt) : '—'`.

**Pre-existing issues (Phase 3 scope, not Phase 4 responsibility):**

Both API and Web TypeScript compilation fail due to Phase 3 code (`SeatState`, `LockSeatResponse`, `tierColor`, `Showtime.performanceId` mismatches). These are not introduced by Phase 4 and should be tracked as Phase 3 debt.

---

*Verified: 2026-04-03T01:06:56Z*
*Verifier: Claude (gsd-verifier)*
