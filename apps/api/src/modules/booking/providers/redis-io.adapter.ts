import { createAdapter } from '@socket.io/redis-adapter';
import type IORedis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Creates a Socket.IO Redis adapter using the provided ioredis client.
 * Uses the client as pub and a duplicate as sub for Redis pub/sub.
 */
export function createSocketIoRedisAdapter(
  ioredisClient: IORedis,
): ReturnType<typeof createAdapter> {
  const pubClient = ioredisClient;
  const subClient = pubClient.duplicate();

  return createAdapter(pubClient, subClient);
}

/**
 * Socket.IO server options for the booking namespace.
 */
export function getBookingSocketOptions(): Partial<ServerOptions> {
  return {
    cors: {
      origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
      credentials: true,
    },
  };
}
