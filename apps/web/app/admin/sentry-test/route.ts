import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

/**
 * GET /admin/sentry-test — Phase 13 Plan 03 (D-12).
 *
 * 새 Sentry 프로젝트(grabit-web) server-side 이벤트 수신 검증용 admin-only route.
 * Next.js App Router treats leading-`_` folders as private (excluded from routing),
 * so the directory is `sentry-test` without underscore; admin guard inside the handler
 * preserves the intended non-public semantics.
 * 반환된 eventId 를 Sentry UI/API 에서 조회해 수신 여부를 확정한다.
 *
 * 인증 모델 (T-13-27 mitigation):
 * - apps/web/proxy.ts 가 문서화한 대로 refreshToken 쿠키는 API 도메인에 set 되며
 *   web 도메인 server-side 에서는 보이지 않는다. 따라서 세션 기반 server-side
 *   admin 체크는 불가능 — 클라이언트가 `Authorization: Bearer <accessToken>` 헤더를
 *   직접 전달하면 해당 토큰으로 API `/api/v1/users/me` 를 호출하여 role === 'admin'
 *   인지 검증한다.
 * - 미인증 / 관리자 아님 / API 불가 → 401 또는 403 반환, Sentry captureException 미호출.
 *
 * 주의: 본 endpoint 는 phase 13 cutover 검증 목적 1회성 호출을 가정한다.
 * Plan 13-04 cutover 완료 + verification 종료 후 endpoint 제거 또는 gate 강화 재검토.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface MeResponse {
  readonly id: string;
  readonly role?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization: Bearer <accessToken>' },
      { status: 401 },
    );
  }

  if (!API_URL) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_API_URL not configured' },
      { status: 500 },
    );
  }

  let me: MeResponse;
  try {
    const meRes = await fetch(`${API_URL}/api/v1/users/me`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!meRes.ok) {
      return NextResponse.json(
        { error: 'Token invalid or expired' },
        { status: 401 },
      );
    }
    me = (await meRes.json()) as MeResponse;
  } catch {
    return NextResponse.json(
      { error: 'Failed to verify admin session' },
      { status: 502 },
    );
  }

  if (me.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const marker = `phase-13 sentry-test ${randomUUID()}`;
  const eventId = Sentry.captureException(new Error(marker));
  return NextResponse.json({ eventId, marker });
}
