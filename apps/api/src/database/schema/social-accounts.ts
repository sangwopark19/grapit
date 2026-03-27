import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).notNull(), // kakao | naver | google
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    providerEmail: varchar('provider_email', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('social_accounts_provider_provider_id_unique').on(
      table.provider,
      table.providerId,
    ),
  ],
);
