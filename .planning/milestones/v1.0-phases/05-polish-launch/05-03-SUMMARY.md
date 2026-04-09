---
phase: 05-polish-launch
plan: 03
subsystem: ui
tags: [sonner, error-handling, toast, network-detection, 404, api-client]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: api-client.ts, sonner Toaster, LayoutShell, auth store
provides:
  - HTTP status-specific Korean error message mapping (STATUS_MESSAGES)
  - API error interceptor with sonner toast + ERR-{status} error codes
  - NetworkBanner component for offline detection
  - Custom 404 NotFound page with Korean copy
  - Enhanced error.tsx with ApiClientError code display
affects: [05-polish-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized error toast in api-client only (no component-level duplicate toasts)"
    - "Error code format: ERR-{HTTP_STATUS} for CS tracking"
    - "navigator.onLine + online/offline events for network state detection"

key-files:
  created:
    - apps/web/lib/error-messages.ts
    - apps/web/components/layout/network-banner.tsx
    - apps/web/app/not-found.tsx
    - apps/web/lib/__tests__/api-client.test.ts
    - apps/web/components/layout/__tests__/network-banner.test.tsx
    - apps/web/app/__tests__/not-found.test.tsx
  modified:
    - apps/web/lib/api-client.ts
    - apps/web/app/error.tsx
    - apps/web/app/layout.tsx

key-decisions:
  - "Error toast only in api-client.ts centrally, not at component level (prevents duplicate toasts)"
  - "401 errors skip toast entirely (redirect-only flow preserved from Phase 1)"
  - "Server custom message overrides default STATUS_MESSAGES when non-empty"

patterns-established:
  - "Error interceptor pattern: STATUS_MESSAGES lookup -> server message override -> toast.error with ERR code"
  - "Network banner pattern: useEffect with online/offline event listeners, fixed position z-[60]"

requirements-completed: [INFR-03]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 5 Plan 3: Error Handling UX Summary

**API error interceptor with Korean messages + ERR codes via sonner toast, NetworkBanner for offline detection, custom 404 page with ( ._.) emoji**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T00:41:10Z
- **Completed:** 2026-04-08T00:45:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- HTTP 상태별 한국어 에러 메시지 매핑 + ERR-{status} 에러 코드 시스템 구현
- API 에러 인터셉터가 sonner toast로 5000ms 동안 사용자 친화적 에러 메시지 표시 (401 제외)
- NetworkBanner가 오프라인 감지 시 상단 고정 배너로 "인터넷 연결을 확인해주세요" 표시
- 커스텀 404 페이지: ( ._.) 이모지 + "페이지를 찾을 수 없습니다" + 홈 버튼
- error.tsx에 ApiClientError 인스턴스일 때 ERR-{statusCode} 코드 표시 추가

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1: 에러 메시지 매핑 + API 클라이언트 에러 인터셉터**
   - `858ef8a` (test: failing tests for API error interceptor)
   - `f7e117b` (feat: implement API error interceptor with Korean messages and ERR codes)

2. **Task 2: NetworkBanner + NotFoundPage + 글로벌 에러 페이지 개선**
   - `e039988` (test: failing tests for NetworkBanner and NotFoundPage)
   - `58f4ff9` (feat: add NetworkBanner, NotFoundPage, and enhance error page with ERR codes)

## Files Created/Modified
- `apps/web/lib/error-messages.ts` - HTTP status-specific Korean error messages (STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE)
- `apps/web/lib/api-client.ts` - Error interceptor: sonner toast with ERR-{status} code, 5000ms duration, 401 skip
- `apps/web/components/layout/network-banner.tsx` - Offline detection banner with role=alert, aria-live=assertive
- `apps/web/app/not-found.tsx` - Custom 404 page with ( ._.) emoji, Korean copy, home button
- `apps/web/app/error.tsx` - Enhanced with ERR-{statusCode} display for ApiClientError
- `apps/web/app/layout.tsx` - NetworkBanner integrated above LayoutShell
- `apps/web/lib/__tests__/api-client.test.ts` - 8 tests for error interceptor behavior
- `apps/web/components/layout/__tests__/network-banner.test.tsx` - 5 tests for NetworkBanner
- `apps/web/app/__tests__/not-found.test.tsx` - 4 tests for NotFoundPage

## Decisions Made
- Error toast only in api-client.ts centrally (not at component level) to prevent Pitfall 5 duplicate toasts
- 401 errors skip toast entirely -- redirect-only flow preserved from Phase 1
- Server custom message overrides default STATUS_MESSAGES when non-empty string returned

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error handling UX complete, ready for production infrastructure (Plan 04)
- All 17 tests pass for this plan's scope
- Pre-existing test failure in hooks/__tests__/use-socket.test.ts (unrelated to this plan)

## Self-Check: PASSED

---
*Phase: 05-polish-launch*
*Completed: 2026-04-08*
