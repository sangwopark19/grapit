import { z } from 'zod';

export const dashboardPeriodSchema = z.enum(['7d', '30d', '90d']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const periodQuerySchema = z.object({
  period: dashboardPeriodSchema.default('30d'),
});
