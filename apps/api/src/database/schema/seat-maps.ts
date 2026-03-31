import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { performances } from './performances.js';

export const seatMaps = pgTable('seat_maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  svgUrl: varchar('svg_url', { length: 1000 }).notNull(),
  seatConfig: jsonb('seat_config'),
  totalSeats: integer('total_seats').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_seat_maps_performance_id').on(table.performanceId),
]);
