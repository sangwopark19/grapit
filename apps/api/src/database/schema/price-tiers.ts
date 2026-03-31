import { pgTable, uuid, varchar, integer, index } from 'drizzle-orm/pg-core';
import { performances } from './performances.js';

export const priceTiers = pgTable('price_tiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  tierName: varchar('tier_name', { length: 50 }).notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_price_tiers_performance_id').on(table.performanceId),
]);
