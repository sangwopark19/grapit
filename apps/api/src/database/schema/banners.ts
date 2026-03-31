import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const banners = pgTable('banners', {
  id: uuid('id').defaultRandom().primaryKey(),
  imageUrl: varchar('image_url', { length: 1000 }).notNull(),
  linkUrl: varchar('link_url', { length: 1000 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
