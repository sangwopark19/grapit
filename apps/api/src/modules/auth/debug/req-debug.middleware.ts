/**
 * PHASE 09.1 DIAGNOSTIC — REMOVE IN PLAN 05 (Wave 4).
 * Gated by DEBUG_AUTH_REQ=1. CI-only. MUST NOT ship to production logs.
 */
import type { NextFunction, Request, Response } from 'express';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function createAuthReqDebugMiddleware(): (
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction,
) => void {
  return (req, _res, next) => {
    if (process.env['DEBUG_AUTH_REQ'] !== '1') return next();
    if (!(req.method === 'POST' && req.url.includes('/auth/login'))) return next();

    const body: unknown = req.body;
    const isObjectBody = body !== null && typeof body === 'object';
    const bodyRecord = isObjectBody ? (body as Record<string, unknown>) : null;
    const emailValue = bodyRecord ? bodyRecord['email'] : null;
    const passwordValue = bodyRecord ? bodyRecord['password'] : null;

    console.log(
      JSON.stringify({
        tag: 'AUTH_LOGIN_DEBUG',
        method: req.method,
        url: req.url,
        headers: req.headers,
        bodyType: typeof body,
        bodyKeys: bodyRecord ? Object.keys(bodyRecord) : null,
        bodyEmail: typeof emailValue === 'string' ? emailValue : null,
        bodyPasswordLen: typeof passwordValue === 'string' ? passwordValue.length : null,
        rawBodyLen: req.rawBody?.length ?? null,
        rawBodyUtf8: req.rawBody?.toString('utf8') ?? null,
      }),
    );

    next();
  };
}
