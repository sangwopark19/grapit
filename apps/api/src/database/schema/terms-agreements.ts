import { pgTable, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const termsAgreements = pgTable('terms_agreements', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  termsOfService: boolean('terms_of_service').notNull(),
  privacyPolicy: boolean('privacy_policy').notNull(),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  agreedAt: timestamp('agreed_at', { withTimezone: true }).notNull().defaultNow(),
});
