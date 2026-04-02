import { pgTable, uuid, varchar, timestamp, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { showtimes } from './showtimes.js';

export const seatStatusEnum = pgEnum('seat_status', ['available', 'locked', 'sold']);

export const seatInventories = pgTable('seat_inventories', {
  id: uuid('id').defaultRandom().primaryKey(),
  showtimeId: uuid('showtime_id').notNull().references(() => showtimes.id, { onDelete: 'cascade' }),
  seatId: varchar('seat_id', { length: 20 }).notNull(),
  status: seatStatusEnum('status').notNull().default('available'),
  lockedBy: uuid('locked_by'),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  soldAt: timestamp('sold_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_seat_inv_showtime_seat').on(table.showtimeId, table.seatId),
]);
