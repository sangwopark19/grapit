import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

// Mock the guard module -- it does not exist yet (RED state)
vi.mock('./roles.guard.js', () => {
  return {
    RolesGuard: vi.fn().mockImplementation(function (this: Record<string, unknown>, reflector: unknown) {
      this.reflector = reflector;
      return this;
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type RolesGuardType = import('./roles.guard.js').RolesGuard;

/**
 * Phase 2 Plan 00: RED-state test stubs for RolesGuard
 *
 * These tests describe the expected contract for RolesGuard:
 * - Allow access when no @Roles() metadata is set (public route)
 * - Allow access when user.role matches required role
 * - Deny access when user.role does not match
 *
 * Guard will be implemented in Plan 02. Tests should turn GREEN then.
 */

function createMockReflector(roles?: string[]): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(roles),
    get: vi.fn().mockReturnValue(roles),
    getAll: vi.fn().mockReturnValue(roles ? [roles] : []),
    getAllAndMerge: vi.fn().mockReturnValue(roles ?? []),
  } as unknown as Reflector;
}

function createMockExecutionContext(userRole?: string): ExecutionContext {
  const request = {
    user: userRole ? { id: 'user-123', role: userRole } : undefined,
  };

  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(request),
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    getType: vi.fn().mockReturnValue('http'),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuardType;

  it('should allow access when no roles metadata is set', async () => {
    const reflector = createMockReflector(undefined);
    const { RolesGuard } = await import('./roles.guard.js');
    guard = new RolesGuard(reflector);

    const context = createMockExecutionContext('user');
    const result = guard.canActivate(context);

    // When no @Roles() decorator is present, the route is accessible to all authenticated users
    expect(result).toBe(true);
  });

  it('should allow access when user role matches required role', async () => {
    const reflector = createMockReflector(['admin']);
    const { RolesGuard } = await import('./roles.guard.js');
    guard = new RolesGuard(reflector);

    const context = createMockExecutionContext('admin');
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user role does not match', async () => {
    const reflector = createMockReflector(['admin']);
    const { RolesGuard } = await import('./roles.guard.js');
    guard = new RolesGuard(reflector);

    const context = createMockExecutionContext('user');
    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });
});
