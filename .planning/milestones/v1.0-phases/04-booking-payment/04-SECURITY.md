# SECURITY.md — Phase 04: Booking & Payment

**Generated:** 2026-04-07
**ASVS Level:** 1
**Phase:** 04 — booking-payment (Plans 01, 02, 03)
**Total Threats:** 8 | **Closed:** 8 | **Open:** 0 | **Partial:** 0
**threats_open:** 0

---

## Threat Verification Results

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-04-01 | Tampering | mitigate | CLOSED | `calculateTotalAmount` (reservation.service.ts:57–75) queries `priceTiers` from DB and rejects request if `expectedAmount !== dto.amount` (line 108–110) |
| T-04-02 | Tampering | mitigate | CLOSED | `cancelReservation` (reservation.service.ts:472–474) checks `reservation.cancelDeadline <= new Date()` and throws `ForbiddenException('취소 마감시간이 지났습니다')` |
| T-04-03 | Spoofing | mitigate | CLOSED | `JwtAuthGuard` registered as global `APP_GUARD` (app.module.ts:46–47). All reservation queries scope on `userId` from JWT: `eq(reservations.userId, userId)` at service lines 170, 287, 390, 446 |
| T-04-04 | EoP | mitigate | CLOSED | `@UseGuards(RolesGuard)` and `@Roles('admin')` applied at class level on `AdminBookingController` (admin-booking.controller.ts:12–18); covers all 3 admin endpoints |
| T-04-05 | InfoDisclosure | mitigate | CLOSED | Secret key loaded server-side via `ConfigService.get('TOSS_SECRET_KEY')` (toss-payments.client.ts:34); client uses `process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY` only (toss-payment-widget.tsx:66). Keys never cross boundary. |
| T-04-06 | Tampering | mitigate | CLOSED | `tossOrderId` unique constraint on `reservations` table (reservations.ts:14); `paymentKey` unique constraint on `payments` table (payments.ts:11); idempotency check at reservation.service.ts:155–159 returns existing payment instead of double-processing |
| T-04-07 | Spoofing | accept | CLOSED | No webhook signature verification. Accepted risk: redirect-based flow relies on Toss Confirm API call as server-to-server verification; no inbound webhook endpoint exists. Risk documented below. |
| T-04-08 | Tampering | accept | CLOSED | `paymentKey` DB unique constraint (payments.ts:11) prevents duplicate payment records. Accepted risk at ASVS Level 1: no explicit nonce/timestamp replay window needed. Risk documented below. |

---

## Accepted Risks Log

### T-04-07 — Spoofing: No Webhook Signature Verification

**Risk:** If Toss Payments adds a webhook-based notification path in future, requests could be spoofed without HMAC signature verification.

**Accepted because:** The current implementation uses a redirect-based flow exclusively. After Toss processes payment, the browser redirects to `/complete?paymentKey=...&orderId=...&amount=...`, and the server calls `tossClient.confirmPayment()` (a server-to-Toss API call with Basic auth) as the authoritative verification step. There is no inbound webhook endpoint to exploit. The Confirm API response from Toss is the source of truth.

**Residual risk:** Low. The attack surface is bounded to the redirect URL parameters, which are validated server-side against the pending reservation's stored `totalAmount` (reservation.service.ts:183–185).

**Review trigger:** If a Toss webhook endpoint is added in a future phase, HMAC signature verification must be implemented at that time.

---

### T-04-08 — Tampering: Partial Replay Prevention

**Risk:** Duplicate `confirmPayment` calls with the same `paymentKey`/`orderId` within a narrow time window before the DB unique constraint is committed could theoretically succeed twice if requests race at the DB level.

**Accepted because:** The `paymentKey` unique constraint (payments.ts:11) and `tossOrderId` unique constraint (reservations.ts:14) enforce deduplication at the DB layer. The idempotency check at reservation.service.ts:155–159 returns the already-confirmed reservation if the payment record exists, preventing double-processing at the service layer. ASVS Level 1 does not require nonce-based replay windows beyond DB-level uniqueness.

**Residual risk:** Low at ASVS Level 1. A nonce/timestamp window could be added at Level 2 if required.

**Review trigger:** Upgrade to ASVS Level 2 or if financial auditors require explicit time-bounded replay prevention.

---

## Unregistered Flags

None. No `## Threat Flags` section was present in 04-01-SUMMARY.md, 04-02-SUMMARY.md, or 04-03-SUMMARY.md.

---

## Audit Scope

| File | Role |
|------|------|
| apps/api/src/modules/reservation/reservation.service.ts | Core reservation + amount validation + cancel deadline + IDOR scope |
| apps/api/src/modules/reservation/reservation.controller.ts | JWT-guarded user-facing endpoints |
| apps/api/src/modules/payment/toss-payments.client.ts | Secret key isolation, Basic auth header |
| apps/api/src/modules/payment/payment.service.ts | Payment query service |
| apps/api/src/modules/admin/admin-booking.controller.ts | RolesGuard + @Roles('admin') enforcement |
| apps/api/src/modules/admin/admin-booking.service.ts | Admin booking operations |
| apps/api/src/database/schema/reservations.ts | tossOrderId unique constraint |
| apps/api/src/database/schema/payments.ts | paymentKey unique constraint |
| apps/api/src/database/schema/reservation-seats.ts | Seat join table schema |
| apps/api/src/app.module.ts | Global JwtAuthGuard + ThrottlerGuard registration |
| apps/web/components/booking/toss-payment-widget.tsx | NEXT_PUBLIC key usage (client-side only) |
| apps/web/app/booking/[performanceId]/confirm/page.tsx | AuthGuard, orderId generation, payment flow |
| apps/web/app/booking/[performanceId]/complete/page.tsx | AuthGuard, server-side confirm call |
| apps/web/hooks/use-booking.ts | Payment hooks |
| apps/web/hooks/use-reservations.ts | Reservation hooks |

---

## Security Audit 2026-04-07

| Metric | Count |
|--------|-------|
| Threats found | 8 |
| Closed | 8 |
| Open | 0 |

**Decision:** T-04-07 (Webhook 서명 검증) and T-04-08 (Replay nonce) accepted as risks by user on 2026-04-07. Rationale documented in Accepted Risks Log above.
