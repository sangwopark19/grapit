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
  tossOrderId: varchar('toss_order_id', { length: 200 }).unique(),
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
  index('idx_reservations_toss_order_id').on(table.tossOrderId),
]);
