import { z } from 'zod';

export const seatStatusQuerySchema = z.object({
  showtimeId: z.string().uuid('올바른 회차 ID가 아닙니다'),
});

export type SeatStatusQuery = z.infer<typeof seatStatusQuerySchema>;
