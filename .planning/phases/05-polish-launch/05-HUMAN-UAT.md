---
status: partial
phase: 05-polish-launch
source: [05-VERIFICATION.md]
started: 2026-04-08T05:25:00Z
updated: 2026-04-08T05:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 모바일 반응형 실제 렌더링
expected: 홈, 장르, 공연 상세, 검색, 마이페이지, 예매 페이지가 375px에서 레이아웃 깨짐 없이 렌더링됨. 하단 탭바 4탭이 표시되고 데스크톱(768px+)에서는 GNB가 표시됨. 공연 상세 포스터가 잘리지 않고 전체 표시됨. 예매 버튼이 MobileTabBar 위에 노출됨
result: [pending]

### 2. Sentry 실제 에러 캡처 동작 확인
expected: NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN 환경변수 설정 후 의도적 에러 발생 시 Sentry 대시보드에 에러가 캡처됨
result: [pending]

### 3. Docker 빌드 로컬 테스트
expected: docker build -f apps/web/Dockerfile . 와 docker build -f apps/api/Dockerfile . 이 오류 없이 완료됨
result: [pending]

### 4. CI/CD 파이프라인 실제 동작 확인
expected: PR 생성 시 GitHub Actions ci.yml이 트리거되고 lint+typecheck+test 통과. main 머지 시 deploy.yml이 Cloud Run에 배포함
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
