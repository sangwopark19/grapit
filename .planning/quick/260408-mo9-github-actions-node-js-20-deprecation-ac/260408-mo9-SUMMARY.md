# Quick Task 260408-mo9: GitHub Actions Node.js 20 deprecation 해결

**Date:** 2026-04-08

## Changes

GitHub Actions 러너가 2026-06-02부터 Node.js 24를 기본으로 사용하고, 2026-09-16에 Node.js 20을 완전 제거함. 영향받는 action 버전을 Node.js 24 호환 버전으로 업데이트.

| Action | Before | After |
|--------|--------|-------|
| actions/checkout | v4 | v6 |
| actions/setup-node | v4 | v6 |
| pnpm/action-setup | v4 | v5 |
| google-github-actions/setup-gcloud | v2 | v3 |

이미 호환: `google-github-actions/auth@v3`, `google-github-actions/deploy-cloudrun@v3`

## Commits

| Hash | Message |
|------|---------|
| 14a3c9d | fix(ci): GitHub Actions Node.js 20 deprecation 해결 |

## Files Modified

- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
