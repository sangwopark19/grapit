import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { performances } from './performances.js';

export const showtimes = pgTable('showtimes', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  dateTime: timestamp('date_time', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_showtimes_performance_id').on(table.performanceId),
]);
