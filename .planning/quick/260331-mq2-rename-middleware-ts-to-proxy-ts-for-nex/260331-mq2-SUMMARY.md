---
plan: 260331-mq2
status: complete
started: 2026-03-31T07:21:40Z
completed: 2026-03-31T07:23:00Z
---

## Summary

Renamed `apps/web/middleware.ts` → `apps/web/proxy.ts` and updated the export function name from `middleware` to `proxy` to resolve the Next.js 16 deprecation warning.

## Changes

- `apps/web/middleware.ts` → `apps/web/proxy.ts` (git mv + function rename)
- Export: `middleware()` → `proxy()`
- Config matcher unchanged: `['/admin/:path*']`
