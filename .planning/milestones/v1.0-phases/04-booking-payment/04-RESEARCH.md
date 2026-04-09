# Phase 4: Booking + Payment - Research

**Researched:** 2026-04-02
**Domain:** Toss Payments SDK integration, reservation/payment transaction system, NestJS payment module, Drizzle ORM schema design
**Confidence:** HIGH

## Summary

Phase 4 completes the core booking-to-payment transaction flow: order confirmation page (with Toss Payments widget inline), server-side payment verification, reservation creation, and post-booking management (mypage reservation history, cancellation/refund, admin booking management).

The primary technical challenge is the Toss Payments SDK v2 widget integration combined with server-side payment confirmation that must be atomic with reservation creation and seat status finalization. The SDK v2 uses a redirect-based flow: client calls `widgets.requestPayment()` which redirects to `successUrl` with `paymentKey`, `orderId`, `amount` as query parameters. The server then calls `POST https://api.tosspayments.com/v1/payments/confirm` with Basic auth to finalize the charge. Amount validation on the server is critical for fraud prevention.

The existing codebase provides strong patterns to follow: Drizzle ORM schema definitions, NestJS module structure (auth, admin, performance modules), React Query hooks (`use-performances.ts`, `use-admin.ts`), Zustand stores (`use-auth-store.ts`), and shadcn/ui component library. Phase 3 context establishes the seat locking mechanism (Redis SET NX with 10-minute TTL) and WebSocket broadcasting that Phase 4 must integrate with for seat status finalization upon payment completion.

**Primary recommendation:** Follow the official Toss Payments SDK v2 widget sample (redirect flow), implement server-side payment confirmation with DB transaction (reservation + payment + seat inventory update in one transaction), and use the established NestJS module pattern for reservation and payment modules.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase 3 "다음" 클릭 시 별도 주문서 페이지(`/booking/[performanceId]/confirm`)로 이동. 공연 정보 + 예매자 정보 + 선택 좌석/금액 요약 + 약관 동의 + 결제 위젯 + 결제하기 버튼을 한 페이지에 배치
- **D-02:** 예매자 정보는 회원 정보(이름/전화번호)를 자동 채우기하고 [수정] 버튼으로 변경 가능. 가입 시 이미 수집된 정보 활용 (Phase 1 D-03)
- **D-03:** Toss Payments 결제 위젯을 주문서 페이지 하단에 인라인 렌더링. 페이지 이탈 없이 결제 수단 선택 -> 결제 진행. NOL 티켓 방식
- **D-04:** Phase 3의 임시점유 카운트다운 타이머를 주문서 페이지 상단에도 고정 표시. 10분 TTL 내 결제 완료 필요 안내
- **D-05:** 결제 성공 시 전용 완료 페이지(`/booking/[performanceId]/complete`)로 이동. 예매번호 + 공연정보 + 좌석 + 결제금액/수단 + 취소마감시간 + [예매내역 보기]/[홈으로] 버튼 표시
- **D-06:** 결제 실패/취소 시 좌석 선택 화면으로 복귀. 에러 메시지(토스트) 표시 + 좌석 점유 유지(TTL 내). 재시도 안내. 별도 실패 페이지 없음
- **D-07:** 마이페이지에 예매 내역 탭/섹션 추가. 카드형 목록(포스터 썸네일 + 공연명 + 날짜/시간 + 좌석 요약 + 상태 배지). 상단 상태 필터(전체/예매완료/취소완료)
- **D-08:** 카드 클릭 시 별도 예매 상세 페이지(`/mypage/reservations/[id]`)로 이동. 예매번호, 공연정보, 좌석 상세, 결제정보(금액/수단/일시), 취소마감시간, 취소 버튼 표시
- **D-09:** 전체 취소만 허용 (부분 취소 없음). 취소 버튼 클릭 -> 확인 모달(취소 사유 선택 + 환불 예정 금액 안내) -> 확인 -> Toss Payments 환불 API -> 취소 완료
- **D-10:** 취소 마감시간은 공연 시작시간 24시간 전. 마감 이후에는 취소 버튼 비활성 + "취소 마감시간이 지났습니다" 안내
- **D-11:** Admin 예매 관리 화면은 대시보드 + 테이블 결합. 상단에 통계 카드(총 예매수, 매출액, 취소율) + 하단에 테이블(예매번호, 예매자, 공연명, 날짜, 좌석, 금액, 상태) + 상태 필터 + 검색(예매번호/예매자명). Phase 2 Admin 패턴(D-16) 확장
- **D-12:** 테이블 행 클릭 -> 예매 상세 모달. 환불 버튼 + 환불 사유 입력 + 확인으로 Toss Payments 환불 API 호출. 개별 환불 처리 방식
- **D-13:** Toss Payments 결제 시스템 개발/연동 시 반드시 `mcp__tosspayments__*` MCP 도구를 사용하여 공식 문서를 참조할 것

### Claude's Discretion
- 예매번호 포맷 (GRP-YYYYMMDD-NNN 등)
- Toss Payments SDK 초기화 및 결제 요청/승인/취소 API 호출 구조
- 결제 승인 서버사이드 검증 로직 (금액 위변조 방지)
- 예매/결제 DB 스키마 (reservations, payments 테이블 설계)
- 환불 금액 계산 로직 (전액 환불)
- 예매 상태 머신 (PENDING -> CONFIRMED -> CANCELLED 등)
- Admin 통계 카드 집계 쿼리 방식
- 에러 핸들링 전략 (결제 타임아웃, 네트워크 에러 등)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOK-05 | 최종 결제 금액이 좌석 등급/수량 기반으로 정확히 표시된다 | price_tiers 테이블 기반 금액 계산, 서버사이드 검증 패턴 (Architecture Patterns > Amount Validation) |
| PAY-01 | 신용/체크카드로 결제할 수 있다 (Toss Payments) | Toss Payments SDK v2 widget -- 카드 결제 기본 지원 (Code Examples > TossPaymentWidget) |
| PAY-02 | 카카오페이로 결제할 수 있다 | Toss Payments widget variantKey: "DEFAULT" -- 간편결제 포함 (Toss 가맹점 설정에서 활성화) |
| PAY-03 | 네이버페이로 결제할 수 있다 | Toss Payments widget variantKey: "DEFAULT" -- 간편결제 포함 (Toss 가맹점 설정에서 활성화) |
| PAY-04 | 계좌이체로 결제할 수 있다 | Toss Payments widget variantKey: "DEFAULT" -- 계좌이체 기본 포함 |
| PAY-05 | 최종 결제 금액이 좌석 등급/수량 기반으로 정확히 표시된다 | price_tiers 조인 쿼리 + 서버사이드 금액 재계산 검증 (Architecture Patterns > Server-Side Confirm) |
| PAY-06 | 결제 완료 시 예매번호가 발급되고 확인 페이지가 표시된다 | 예매번호 생성 패턴 (Architecture Patterns > Reservation Number), complete 페이지 라우팅 |
| PAY-07 | 결제 실패/취소 시 좌석 점유가 해제되고 안내 메시지가 표시된다 | failUrl 리다이렉트 처리, 좌석 점유는 TTL 기반 자동 해제 (D-06) |
| RESV-01 | 마이페이지에서 예매 내역 목록을 조회할 수 있다 | GET /api/v1/users/me/reservations API + ReservationList 컴포넌트 (D-07) |
| RESV-02 | 예매 상세(예매번호, 좌석, 결제 정보, 취소마감시간)를 확인할 수 있다 | GET /api/v1/reservations/:id API + ReservationDetail 페이지 (D-08) |
| RESV-03 | 취소마감시간 전 예매를 취소하고 환불받을 수 있다 | PUT /api/v1/reservations/:id/cancel + Toss Payments cancel API (D-09, D-10) |
| ADMN-04 | 관리자가 예매 목록을 조회하고 환불 처리할 수 있다 | Admin 예매 관리 테이블 + 환불 모달 (D-11, D-12) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **ES modules only** (import/export), no CommonJS (require)
- **Strict typing** -- no `any`, no untyped variables
- **Functional patterns preferred**; classes only for external interfaces (NestJS controllers/services)
- Run typecheck and lint after code changes
- **Write tests before implementation** for business logic and API code
- **Never add Co-Authored-By trailers** -- user is sole author
- **Conventional commits** (feat:, fix:, test:, refactor:, docs:)
- **Respond in Korean** unless asked otherwise
- GSD workflow enforcement: use /gsd:execute-phase for planned work
- .env at monorepo root only (not in apps/api or apps/web)
- DOTENV_CONFIG_PATH for drizzle-kit commands
- API port: 8080, Web port: 3000

## Standard Stack

### Core (Phase 4 Specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tosspayments/tosspayments-sdk | 2.6.0 | Payment widget frontend SDK | Official Toss Payments SDK v2. Handles payment widget rendering, payment request, redirect flow. Verified via npm registry. |
| drizzle-orm | 0.45.2 | Database ORM | Already in project. SQL-first approach, TypeScript inference. Use for reservation/payment schema. |
| drizzle-zod | 0.8.3 | Schema-to-Zod bridge | Already in project. Generate Zod schemas from Drizzle tables for DTO validation. |
| zod | 4.3.6 | Validation | Already in project. Shared frontend/backend validation schemas. |
| pg-boss | 12.15.0 | Job queue | PostgreSQL-native job queue. Use for async post-payment tasks (notifications, receipts). |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.95.x | Server state | Reservation list fetching, booking detail queries |
| zustand | 5.0.x | Client state | Booking flow state (selected seats from Phase 3, terms agreement) |
| react-hook-form | 7.72.x | Form management | Booker info edit form |
| @upstash/redis | 1.37.x | Redis client | Seat lock verification, lock cleanup on payment success |
| socket.io | 4.x | WebSocket | Broadcast seat status change on payment completion |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Toss Payments redirect flow | Promise-based flow | Redirect is official recommended approach for widget; Promise flow is alternative but redirect handles mobile/popup issues better |
| pg-boss for post-payment jobs | Inline async processing | pg-boss provides retry, dead letter queues, scheduling -- critical for payment notification reliability |
| Separate payments table | Payment data on reservation | Separate table follows SoC, enables payment history tracking, supports future partial refunds |

**Installation (Phase 4 new packages):**
```bash
# Frontend (apps/web)
pnpm --filter @grapit/web add @tosspayments/tosspayments-sdk

# Backend (apps/api) -- pg-boss if not already installed
pnpm --filter @grapit/api add pg-boss
```

## Architecture Patterns

### Recommended Project Structure

**Backend (new modules):**
```
apps/api/src/modules/
  reservation/
    reservation.module.ts
    reservation.controller.ts
    reservation.service.ts
    reservation.service.spec.ts
    dto/
      create-reservation.dto.ts
      cancel-reservation.dto.ts
  payment/
    payment.module.ts
    payment.controller.ts
    payment.service.ts
    payment.service.spec.ts
    dto/
      confirm-payment.dto.ts
      refund-payment.dto.ts
    toss-payments.client.ts      # Toss Payments API wrapper
apps/api/src/database/schema/
    reservations.ts              # New
    reservation-seats.ts         # New
    payments.ts                  # New
```

**Frontend (new pages/components):**
```
apps/web/
  app/
    booking/[performanceId]/
      confirm/page.tsx           # Order confirmation + payment widget
      complete/page.tsx          # Booking complete
    mypage/
      page.tsx                   # Updated: add reservations tab
      reservations/[id]/
        page.tsx                 # Reservation detail
    admin/
      bookings/
        page.tsx                 # Admin booking management
  components/
    booking/
      order-summary.tsx
      booker-info-section.tsx
      terms-agreement.tsx
      toss-payment-widget.tsx
      booking-complete.tsx
    reservation/
      reservation-list.tsx
      reservation-card.tsx
      reservation-detail.tsx
      cancel-confirm-modal.tsx
    admin/
      admin-booking-dashboard.tsx
      admin-stat-card.tsx
      admin-booking-table.tsx
      admin-booking-detail-modal.tsx
  hooks/
    use-booking.ts               # Booking/payment React Query hooks
    use-reservations.ts          # Reservation list/detail hooks
  stores/
    use-booking-store.ts         # Booking flow state (from Phase 3)
  types/                         # or packages/shared/src/types/
    booking.types.ts             # Reservation, Payment shared types
```

### Pattern 1: Toss Payments SDK v2 Widget Integration (Redirect Flow)

**What:** Initialize SDK, render payment widget inline, handle redirect on success/fail
**When to use:** Confirm page payment widget rendering
**Source:** [Official tosspayments-sample](https://github.com/tosspayments/tosspayments-sample/blob/main/express-react/src/pages/widget/WidgetCheckout.jsx)

```typescript
// apps/web/components/booking/toss-payment-widget.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

interface TossPaymentWidgetProps {
  orderId: string;
  orderName: string;
  amount: number;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  onReady: () => void;
}

export function TossPaymentWidget({
  orderId, orderName, amount, customerKey,
  customerName, customerEmail, onReady,
}: TossPaymentWidgetProps) {
  const [widgets, setWidgets] = useState<ReturnType<
    Awaited<ReturnType<typeof loadTossPayments>>['widgets']
  > | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    async function init() {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
      const tossPayments = await loadTossPayments(clientKey);
      const w = tossPayments.widgets({ customerKey });
      setWidgets(w);
    }
    init();
  }, [customerKey]);

  useEffect(() => {
    if (!widgets) return;
    async function render() {
      await widgets!.setAmount({ currency: 'KRW', value: amount });
      await Promise.all([
        widgets!.renderPaymentMethods({
          selector: '#payment-method',
          variantKey: 'DEFAULT',
        }),
        widgets!.renderAgreement({
          selector: '#agreement',
          variantKey: 'AGREEMENT',
        }),
      ]);
      if (!readyRef.current) {
        readyRef.current = true;
        onReady();
      }
    }
    render();
  }, [widgets, amount]);

  // requestPayment is called from parent via ref or callback
  return (
    <>
      <div id="payment-method" />
      <div id="agreement" />
    </>
  );
}

// Call this from the "결제하기" button handler:
// await widgets.requestPayment({
//   orderId,
//   orderName,
//   successUrl: `${window.location.origin}/booking/${performanceId}/complete?...`,
//   failUrl: `${window.location.origin}/booking/${performanceId}/confirm?error=true`,
//   customerEmail,
//   customerName,
// });
```

**Key SDK Notes:**
- `loadTossPayments(clientKey)` returns a Promise -- must be called client-side only
- `widgets.setAmount()` MUST be called before `renderPaymentMethods()`
- `requestPayment()` redirects the browser -- it does NOT return a Promise with payment result
- `successUrl` receives query params: `paymentKey`, `orderId`, `amount`
- `failUrl` receives query params: `code`, `message`
- `customerKey` should be the user's unique ID (UUID) -- not email/phone (security)

### Pattern 2: Server-Side Payment Confirmation with DB Transaction

**What:** Verify payment with Toss API, then atomically create reservation + payment + update seat inventory
**When to use:** When success redirect arrives and server needs to finalize the booking

```typescript
// apps/api/src/modules/payment/toss-payments.client.ts
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TossPaymentsClient {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.tosspayments.com/v1';

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('TOSS_SECRET_KEY');
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async confirmPayment(params: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }) {
    const res = await fetch(`${this.baseUrl}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new TossPaymentError(error.code, error.message);
    }
    return res.json() as Promise<TossPaymentResponse>;
  }

  async cancelPayment(paymentKey: string, reason: string) {
    const res = await fetch(
      `${this.baseUrl}/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelReason: reason }),
      },
    );
    if (!res.ok) {
      const error = await res.json();
      throw new TossPaymentError(error.code, error.message);
    }
    return res.json() as Promise<TossPaymentResponse>;
  }
}
```

### Pattern 3: Atomic Reservation Creation (DB Transaction)

**What:** Use Drizzle transaction to atomically create reservation, seats, payment record
**When to use:** After Toss Payments confirm succeeds

```typescript
// Simplified transaction flow in reservation.service.ts
async confirmAndCreateReservation(params: ConfirmReservationDto) {
  // 1. Verify amount server-side (recalculate from price_tiers)
  const expectedAmount = await this.calculateTotalAmount(params.seatIds);
  if (expectedAmount !== params.amount) {
    throw new BadRequestException('금액이 일치하지 않습니다');
  }

  // 2. Confirm with Toss Payments
  const tossResult = await this.tossClient.confirmPayment({
    paymentKey: params.paymentKey,
    orderId: params.orderId,
    amount: params.amount,
  });

  // 3. DB Transaction: reservation + payment + seat inventory
  return await this.db.transaction(async (tx) => {
    const reservationNumber = generateReservationNumber();

    const [reservation] = await tx.insert(reservations).values({
      userId: params.userId,
      showtimeId: params.showtimeId,
      reservationNumber,
      status: 'CONFIRMED',
      totalAmount: params.amount,
      cancelDeadline: calculateCancelDeadline(params.showtimeDateTime),
    }).returning();

    // Insert reservation seats
    await tx.insert(reservationSeats).values(
      params.seats.map(seat => ({
        reservationId: reservation.id,
        seatId: seat.seatId,
        tierName: seat.tierName,
        price: seat.price,
        row: seat.row,
        number: seat.number,
      }))
    );

    // Insert payment record
    await tx.insert(payments).values({
      reservationId: reservation.id,
      paymentKey: tossResult.paymentKey,
      method: tossResult.method,
      amount: tossResult.totalAmount,
      status: 'DONE',
      paidAt: new Date(tossResult.approvedAt),
      tossOrderId: tossResult.orderId,
    });

    return reservation;
  });

  // 4. Post-transaction: clean up Redis locks + broadcast via WebSocket
}
```

### Pattern 4: Reservation State Machine

**What:** Status transitions for reservation lifecycle
**When to use:** All reservation status changes

```
PENDING_PAYMENT --> CONFIRMED      (on payment confirm success)
PENDING_PAYMENT --> FAILED         (on payment confirm failure)
CONFIRMED       --> CANCELLED      (on user/admin cancel + refund)
```

States:
- `PENDING_PAYMENT`: Reservation created, awaiting Toss confirm (brief intermediate state)
- `CONFIRMED`: Payment successful, booking active
- `CANCELLED`: User or admin cancelled, refund processed
- `FAILED`: Payment failed (cleanup state)

### Pattern 5: Reservation Number Format

**What:** Human-readable booking number
**Recommended format:** `GRP-YYYYMMDD-XXXXX`
- `GRP`: Grapit prefix
- `YYYYMMDD`: Date of booking
- `XXXXX`: 5-digit zero-padded sequence or random alphanumeric

```typescript
function generateReservationNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `GRP-${dateStr}-${random}`;
}
```

### Pattern 6: Amount Validation (Fraud Prevention)

**What:** Server recalculates expected amount from DB before confirming with Toss
**When to use:** Every payment confirmation

```typescript
async calculateTotalAmount(
  seatSelections: Array<{ seatId: string; tierId: string }>,
  performanceId: string,
): Promise<number> {
  // Query price_tiers for the given performance
  const tiers = await this.db
    .select()
    .from(priceTiers)
    .where(eq(priceTiers.performanceId, performanceId));

  // Map each selected seat to its tier price and sum
  let total = 0;
  for (const seat of seatSelections) {
    const tier = tiers.find(t => t.id === seat.tierId);
    if (!tier) throw new BadRequestException('유효하지 않은 등급입니다');
    total += tier.price;
  }
  return total;
}
```

### Anti-Patterns to Avoid

- **Client-side amount as source of truth:** NEVER trust the amount sent from the client. Always recalculate on the server from the price_tiers table before calling Toss confirm.
- **Non-atomic reservation creation:** NEVER create reservation and payment records outside a DB transaction. A crash between inserts would leave orphaned records.
- **Storing Toss secret key in frontend:** The secret key is for server-side only. Only the client key goes to `NEXT_PUBLIC_TOSS_CLIENT_KEY`.
- **Calling Toss confirm without idempotency:** If the confirm endpoint is hit twice (network retry), Toss returns an error for the duplicate. Handle this gracefully by checking if reservation already exists for the orderId.
- **Blocking on Redis lock cleanup:** After payment success, delete Redis seat locks asynchronously (not in the DB transaction). If Redis is temporarily down, the locks will expire via TTL anyway.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment widget UI | Custom card input form | Toss Payments SDK v2 widget (`renderPaymentMethods`) | PCI-DSS compliance, handles all payment methods, maintained by Toss |
| Payment confirmation | Direct PG API calls without SDK | `toss-payments.client.ts` wrapper calling official Toss API | Authorization header encoding, error handling, idempotency |
| Job queue for notifications | setTimeout/setInterval | pg-boss | Retry logic, dead letter queue, persistence across restarts |
| Reservation number uniqueness | UUID only | Date-prefix + random suffix (GRP-YYYYMMDD-XXXXX) | Human-readable for customer service, unique enough with date prefix |
| Korean won formatting | Manual string formatting | `Intl.NumberFormat('ko-KR')` + "원" | Handles thousands separator correctly, locale-aware |

**Key insight:** The Toss Payments SDK handles the entire payment UI surface area including PCI-DSS compliance. Building a custom payment form is not only unnecessary but would violate PCI compliance requirements. The SDK widget is a mandatory component, not an optional convenience.

## DB Schema Design

### New Tables

```typescript
// apps/api/src/database/schema/reservations.ts
import { pgTable, uuid, varchar, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { showtimes } from './showtimes.js';

export const reservationStatusEnum = pgEnum('reservation_status', [
  'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'FAILED',
]);

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  showtimeId: uuid('showtime_id').notNull().references(() => showtimes.id),
  reservationNumber: varchar('reservation_number', { length: 30 }).notNull().unique(),
  status: reservationStatusEnum('status').notNull().default('PENDING_PAYMENT'),
  totalAmount: integer('total_amount').notNull(),
  cancelDeadline: timestamp('cancel_deadline', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: varchar('cancel_reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_reservations_user_id').on(table.userId),
  index('idx_reservations_showtime_id').on(table.showtimeId),
  index('idx_reservations_status').on(table.status),
  index('idx_reservations_reservation_number').on(table.reservationNumber),
]);

// apps/api/src/database/schema/reservation-seats.ts
import { pgTable, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { reservations } from './reservations.js';

export const reservationSeats = pgTable('reservation_seats', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  seatId: varchar('seat_id', { length: 50 }).notNull(), // SVG data-seat-id
  tierName: varchar('tier_name', { length: 50 }).notNull(),
  price: integer('price').notNull(),
  row: varchar('row', { length: 10 }).notNull(),
  number: varchar('number', { length: 10 }).notNull(),
});

// apps/api/src/database/schema/payments.ts
import { pgTable, uuid, varchar, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { reservations } from './reservations.js';

export const paymentStatusEnum = pgEnum('payment_status', [
  'READY', 'DONE', 'CANCELED', 'ABORTED', 'EXPIRED',
]);

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id).unique(),
  paymentKey: varchar('payment_key', { length: 200 }).notNull().unique(),
  tossOrderId: varchar('toss_order_id', { length: 200 }).notNull(),
  method: varchar('method', { length: 50 }).notNull(), // 카드, 카카오페이, 네이버페이, 계좌이체
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').notNull().default('READY'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: varchar('cancel_reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Schema Design Rationale

- **reservations + reservation_seats**: 1:N relationship. reservation_seats stores the snapshot of each seat's tier/price at booking time (price may change later, but the booked price is fixed).
- **payments**: 1:1 with reservations. Stores Toss Payments response data (paymentKey, method, status). The `paymentKey` is the primary identifier for Toss API operations (confirm, cancel, query).
- **No seat_inventories table**: The architecture doc mentions seat_inventories, but Phase 3 uses Redis-based seat locking (SET NX). For MVP, seat status is tracked via Redis locks (temporary) + reservation_seats (permanent). A seat is "sold" if it appears in a CONFIRMED reservation's reservation_seats for that showtime.
- **cancelDeadline**: Calculated as showtime.dateTime - 24 hours. Stored on reservation for quick access without joining showtimes.

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/reservations` | Create pending reservation (pre-payment) | User |
| POST | `/api/v1/payments/confirm` | Confirm payment (Toss callback) | User |
| GET | `/api/v1/users/me/reservations` | List user's reservations | User |
| GET | `/api/v1/reservations/:id` | Reservation detail | User (owner) |
| PUT | `/api/v1/reservations/:id/cancel` | Cancel reservation + refund | User (owner) |
| GET | `/api/v1/admin/bookings` | Admin booking list with stats | Admin |
| GET | `/api/v1/admin/bookings/:id` | Admin booking detail | Admin |
| POST | `/api/v1/admin/bookings/:id/refund` | Admin refund | Admin |

## Common Pitfalls

### Pitfall 1: Toss Payments Amount Mismatch
**What goes wrong:** Client sends a manipulated amount. Server confirms with Toss using the tampered amount. Money is charged but doesn't match actual seat prices.
**Why it happens:** Trusting client-side amount without server verification.
**How to avoid:** Before calling Toss confirm API, recalculate total from price_tiers table. Compare with the amount from successUrl. If they differ, reject and refund.
**Warning signs:** Amount parameter in confirm request differs from DB calculation.

### Pitfall 2: Orphaned Reservations on Payment Failure
**What goes wrong:** Reservation record created before Toss confirm, then Toss confirm fails. Reservation sits in PENDING_PAYMENT forever.
**Why it happens:** Creating reservation before payment is confirmed.
**How to avoid:** Two approaches: (A) Create reservation only after Toss confirm succeeds (preferred for simplicity), or (B) Create with PENDING_PAYMENT status and run a pg-boss cleanup job to expire stale pending reservations after 15 minutes.
**Warning signs:** Growing count of PENDING_PAYMENT reservations in DB.

### Pitfall 3: Toss SDK Widget Not Loading in Next.js SSR
**What goes wrong:** `loadTossPayments` called during SSR causes `window is not defined` error.
**Why it happens:** Toss SDK requires browser DOM.
**How to avoid:** Mark the widget component as `'use client'` and use `useEffect` for SDK initialization. Never import Toss SDK at module level in a server component.
**Warning signs:** Hydration mismatch errors, "window is not defined" in server logs.

### Pitfall 4: Double Payment Confirmation
**What goes wrong:** User refreshes the success URL page. Server sends confirm request to Toss again. Toss returns error for duplicate.
**Why it happens:** No idempotency check on the confirm endpoint.
**How to avoid:** Before calling Toss confirm, check if a reservation with the given orderId already exists in DB. If it does, return the existing reservation data instead of calling Toss again.
**Warning signs:** `ALREADY_PROCESSED_PAYMENT` error from Toss API.

### Pitfall 5: Race Condition Between Timer Expiry and Payment Confirmation
**What goes wrong:** User clicks "결제하기" at 9:58 (2 seconds before TTL expiry). Toss processes payment, but by the time server confirms, Redis lock has expired and another user might have locked the same seat.
**Why it happens:** Narrow window between payment initiation and server confirmation.
**How to avoid:** On the server, before confirming with Toss, verify that all seat locks still exist in Redis and belong to the current user. If locks expired, reject the payment and initiate refund. Add a buffer: disable the payment button when timer < 30 seconds.
**Warning signs:** Confirmed reservations where seat is also locked by another user.

### Pitfall 6: Toss Payments Widget Secret Key Confusion
**What goes wrong:** Using the wrong secret key type. Toss has separate keys for "결제위젯 연동 키" (widget) vs "API 개별 연동 키" (direct API).
**Why it happens:** Multiple key types in Toss dashboard.
**How to avoid:** For widget flow: use widget client key (`test_gck_*`) on frontend, widget secret key (`test_gsk_*`) on server for confirm. The official sample confirms this pattern.
**Warning signs:** `UNAUTHORIZED_KEY` error from Toss API.

### Pitfall 7: Missing Cancel Deadline Enforcement
**What goes wrong:** User cancels after the 24-hour-before-show deadline.
**Why it happens:** Only checking deadline on frontend (button disabled), not on server.
**How to avoid:** Server-side check: `if (reservation.cancelDeadline < new Date()) throw ForbiddenException`. Never rely solely on frontend UI state for business rules.
**Warning signs:** Cancellations processed after deadline.

## Code Examples

### Toss Payments Widget Initialization (Verified from Official Sample)

```typescript
// Source: github.com/tosspayments/tosspayments-sample/express-react/src/pages/widget/WidgetCheckout.jsx
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

// Initialize (client-side only, inside useEffect)
const tossPayments = await loadTossPayments(clientKey);
const widgets = tossPayments.widgets({ customerKey }); // customerKey = user UUID

// Set amount FIRST
await widgets.setAmount({ currency: 'KRW', value: totalAmount });

// Render payment methods + agreement
await Promise.all([
  widgets.renderPaymentMethods({
    selector: '#payment-method',
    variantKey: 'DEFAULT',
  }),
  widgets.renderAgreement({
    selector: '#agreement',
    variantKey: 'AGREEMENT',
  }),
]);

// Request payment (triggers redirect)
await widgets.requestPayment({
  orderId: reservationOrderId,       // Unique per order
  orderName: '뮤지컬 <렘피카> 외 1건', // Display name
  successUrl: `${origin}/booking/${perfId}/complete`,
  failUrl: `${origin}/booking/${perfId}/confirm?error=true`,
  customerEmail: user.email,
  customerName: user.name,
});
```

### Server-Side Payment Confirmation (Verified from Official Sample)

```typescript
// Source: github.com/tosspayments/tosspayments-sample/express-react/server.js
// Authorization header format:
const authHeader = `Basic ${Buffer.from(`${widgetSecretKey}:`).toString('base64')}`;

// POST https://api.tosspayments.com/v1/payments/confirm
// Body: { paymentKey, orderId, amount }
// Response: Payment object with status, method, approvedAt, totalAmount, etc.
```

### Payment Cancellation API

```typescript
// POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
// Headers: Authorization: Basic {base64(secretKey:)}
// Body: { cancelReason: "단순 변심" }
// Response: Payment object with cancels array containing cancel details
```

### Drizzle Transaction Pattern (from existing codebase pattern)

```typescript
// Following existing drizzle.provider.ts pattern (Symbol-based DI)
@Injectable()
export class ReservationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tossClient: TossPaymentsClient,
  ) {}

  async confirmReservation(dto: ConfirmPaymentDto, userId: string) {
    // 1. Amount validation
    // 2. Toss confirm
    // 3. DB transaction
    return this.db.transaction(async (tx) => {
      // ... insert reservation, seats, payment
    });
  }
}
```

### React Query Hook Pattern (following use-admin.ts)

```typescript
// apps/web/hooks/use-reservations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useMyReservations(filter: string) {
  return useQuery({
    queryKey: ['reservations', 'me', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      return apiClient.get<ReservationListResponse>(
        `/api/v1/users/me/reservations?${params.toString()}`
      );
    },
  });
}

export function useCancelReservation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiClient.put(`/api/v1/reservations/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @tosspayments/payment-widget-sdk (v1) | @tosspayments/tosspayments-sdk (v2) | 2024 | Single SDK for all products. v1 package is deprecated. |
| @tosspayments/sdk | @tosspayments/tosspayments-sdk | 2024 | Old package deprecated. Must use tosspayments-sdk. |
| Separate payment window popup | Inline widget rendering | SDK v2 | Widget renders in-page, no popup needed. Better UX. |
| Manual Toss API integration | SDK v2 widgets API | SDK v2 | widgets.requestPayment handles the full flow. |

**Deprecated/outdated:**
- `@tosspayments/sdk` -- deprecated, replaced by `@tosspayments/tosspayments-sdk`
- `@tosspayments/payment-widget-sdk` -- v1 widget SDK, superseded by v2 unified SDK
- `@tosspayments/payment-sdk` -- older package, superseded by v2

## Environment Variables (Phase 4 Additions)

```bash
# .env (monorepo root) -- add these for Phase 4
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_...     # Widget client key (public, frontend)
TOSS_SECRET_KEY=test_gsk_...                  # Widget secret key (server only)
```

**Test mode keys:** Toss provides test keys starting with `test_gck_` (client) and `test_gsk_` (secret). These work without a business registration for development. Production keys require PG contract and business registration.

## Open Questions

1. **Toss Payments sandbox availability**
   - What we know: Test keys work for development without PG contract (confirmed from official docs)
   - What's unclear: Whether the test mode supports all payment methods (kakao pay, naver pay) or only card payments
   - Recommendation: Start with test keys. Card payments are guaranteed to work in test mode. Verify KakaoPay/NaverPay in test mode during implementation.

2. **Seat lock verification timing**
   - What we know: Redis locks have 10-minute TTL. Payment confirmation should verify locks still exist.
   - What's unclear: Exact timing between requestPayment redirect and server confirm -- could be 1-10 seconds depending on Toss processing.
   - Recommendation: Add seat lock verification in the confirm endpoint. If locks expired, reject and return error with guidance to re-select seats.

3. **pg-boss setup in existing project**
   - What we know: pg-boss is in the recommended stack but may not be installed yet.
   - What's unclear: Whether Phase 3 already set up pg-boss infrastructure.
   - Recommendation: Check if pg-boss is installed. If not, add as Phase 4 task. Use for post-payment notification jobs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/api test` |
| Full suite command | `pnpm test` (turbo) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-05 | Amount calculation from price tiers | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "amount"` | Wave 0 |
| PAY-05 | Server-side amount validation rejects tampered amounts | unit | `pnpm --filter @grapit/api exec vitest run src/modules/payment/payment.service.spec.ts -t "amount validation"` | Wave 0 |
| PAY-06 | Reservation number generation format | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "reservation number"` | Wave 0 |
| PAY-07 | Payment failure handling releases seats | unit | `pnpm --filter @grapit/api exec vitest run src/modules/payment/payment.service.spec.ts -t "failure"` | Wave 0 |
| RESV-01 | List reservations for user | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "list"` | Wave 0 |
| RESV-03 | Cancel before deadline succeeds | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "cancel"` | Wave 0 |
| RESV-03 | Cancel after deadline rejected | unit | `pnpm --filter @grapit/api exec vitest run src/modules/reservation/reservation.service.spec.ts -t "deadline"` | Wave 0 |
| ADMN-04 | Admin can list bookings with stats | unit | `pnpm --filter @grapit/api exec vitest run src/modules/admin/admin-booking.service.spec.ts -t "list"` | Wave 0 |
| PAY-01..04 | Toss SDK widget renders | manual-only | Visual verification -- SDK renders payment UI | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/api test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `apps/api/src/modules/reservation/reservation.service.spec.ts` -- covers BOOK-05, PAY-06, RESV-01, RESV-03
- [ ] `apps/api/src/modules/payment/payment.service.spec.ts` -- covers PAY-05, PAY-07
- [ ] `apps/api/src/modules/admin/admin-booking.service.spec.ts` -- covers ADMN-04 (if separate from existing admin.service)

## Sources

### Primary (HIGH confidence)
- [Official tosspayments-sample repository](https://github.com/tosspayments/tosspayments-sample) - WidgetCheckout.jsx, WidgetSuccess.jsx, server.js -- complete integration flow
- [Toss Payments SDK v2 JS docs](https://docs.tosspayments.com/sdk/v2/js) -- SDK initialization, widgets API
- [Toss Payments SDK npm](https://www.npmjs.com/package/@tosspayments/tosspayments-sdk) -- version 2.6.0 verified
- Existing codebase: `apps/api/src/database/schema/` -- Drizzle ORM schema patterns
- Existing codebase: `apps/web/hooks/use-admin.ts` -- React Query hook patterns
- Existing codebase: `apps/api/src/app.module.ts` -- NestJS module registration
- Existing codebase: `apps/api/src/database/drizzle.provider.ts` -- DRIZZLE Symbol injection pattern

### Secondary (MEDIUM confidence)
- [Toss Payments NestJS integration blog](https://velog.io/@from_numpy/toss-payments-NestJS) - Server-side confirm pattern, amount validation logic
- [Toss Payments cancel docs](https://docs.tosspayments.com/guides/v2/cancel-payment) - Cancel/refund API flow
- [Toss Payments core API reference](https://docs.tosspayments.com/reference) - API endpoint specifications

### Tertiary (LOW confidence)
- pg-boss integration pattern -- based on CLAUDE.md recommendation, not yet verified in codebase. Needs check if Phase 3 already installed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm registry, SDK v2 confirmed from official samples
- Architecture: HIGH -- follows existing codebase patterns (Drizzle, NestJS modules, React Query hooks), Toss API flow verified from official samples
- DB Schema: HIGH -- follows architecture doc ERD with Drizzle-idiomatic adjustments
- Pitfalls: HIGH -- derived from official docs, NestJS blog examples, and common payment integration failure modes
- Toss Payments detailed API params: MEDIUM -- some details from blog posts rather than crawlable official docs (D-13 mandates MCP tool usage during implementation for latest API specs)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days -- Toss SDK stable, no major breaking changes expected)
