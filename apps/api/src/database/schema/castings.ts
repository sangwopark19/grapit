import { pgTable, uuid, varchar, integer, index } from 'drizzle-orm/pg-core';
import { performances } from './performances.js';

export const castings = pgTable('castings', {
  id: uuid('id').defaultRandom().primaryKey(),
  performanceId: uuid('performance_id').notNull().references(() => performances.id, { onDelete: 'cascade' }),
  actorName: varchar('actor_name', { length: 100 }).notNull(),
  roleName: varchar('role_name', { length: 100 }),
  photoUrl: varchar('photo_url', { length: 1000 }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_castings_performance_id').on(table.performanceId),
]);
