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
  method: varchar('method', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').notNull().default('READY'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: varchar('cancel_reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
