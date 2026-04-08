---
phase: quick
plan: 260408-ldc
subsystem: observability
tags: [sentry, error-tracking, next.js]
one_liner: "error.tsx에 Sentry.captureException 추가 및 deprecated 옵션 제거"
key-files:
  modified:
    - apps/web/app/error.tsx
    - apps/web/next.config.ts
---

# Quick Task 260408-ldc: Sentry 에러 캡처 안되는 문제 수정

## 문제
- `.env`에 DSN 설정 후에도 Sentry 대시보드에 에러가 표시되지 않음

## 원인
1. **테스트 방법 오류**: 404 페이지 접속은 에러가 아닌 정상 HTTP 응답 — Sentry가 캡처하지 않음
2. **error.tsx에 Sentry 누락**: `error.tsx`가 `console.error(error)`만 호출하고 `Sentry.captureException(error)`를 호출하지 않음. Next.js에서 대부분의 클라이언트 에러는 `error.tsx`로 라우팅되므로 실제 에러도 Sentry에 전송되지 않았음
3. **deprecated 옵션**: `withSentryConfig`에서 `disableLogger`, `automaticVercelMonitors` 사용

## 수정 내용
- `error.tsx`: `console.error` → `Sentry.captureException` 교체
- `next.config.ts`: deprecated 옵션 2개 제거

## 검증
- dev-browser로 테스트 페이지에서 에러 발생 → sentry.io 응답 200 OK 3건 확인
