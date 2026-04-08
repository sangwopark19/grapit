---
status: complete
phase: 05-polish-launch
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md]
started: 2026-04-08T02:35:42Z
updated: 2026-04-08T14:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 서버(web + api)를 완전히 종료 후 재시작합니다. 에러 없이 부팅되고, 홈페이지(localhost:3000) 또는 API health check(localhost:8080)가 정상 응답합니다.
result: pass

### 2. MobileTabBar 하단 네비게이션
expected: 모바일 화면(< 768px)에서 화면 하단에 4개 탭(홈/카테고리/검색/마이페이지)이 고정 표시됩니다. 각 페이지로 이동하면 해당 탭이 활성(파란색) 상태로 변합니다.
result: pass

### 3. 모바일 GNB/Footer 숨김
expected: 모바일 화면에서 상단 GNB(데스크톱 네비게이션 바)와 하단 Footer가 숨겨지고, MobileTabBar만 표시됩니다. 768px 이상에서는 GNB/Footer가 다시 나타납니다.
result: pass

### 4. 모바일 반응형 레이아웃
expected: 모바일에서 각 공개 페이지(홈, 장르, 검색, 마이페이지)에 적절한 좌우 패딩이 적용됩니다. 공연 상세 페이지에서 포스터가 적절한 크기로 표시되고, 768px 이상에서 2단 레이아웃으로 전환됩니다.
result: pass

### 5. 예매 날짜/회차 접힘 UI
expected: 모바일에서 예매 페이지의 날짜 선택과 회차 선택이 접힘/펼침 버튼으로 토글됩니다. 버튼 클릭 시 해당 섹션이 열리고/닫힙니다.
result: pass

### 6. 스켈레톤 로딩 UI
expected: 페이지 데이터 로딩 중 회색 깜빡이는 스켈레톤 플레이스홀더가 표시됩니다. 데이터 로딩 완료 후 실제 콘텐츠로 교체됩니다.
result: pass

### 7. API 에러 한국어 Toast
expected: API 호출이 실패하면(예: 서버 중단 상태에서 요청) 화면 우측 상단에 한국어 에러 메시지 toast가 5초간 표시됩니다. ERR-{상태코드} 형식의 에러 코드가 포함됩니다.
result: pass

### 8. 오프라인 감지 배너
expected: 브라우저에서 네트워크를 끊으면(DevTools > Network > Offline) 화면 상단에 "인터넷 연결을 확인해주세요" 배너가 표시됩니다. 네트워크 복구 시 배너가 사라집니다.
result: pass

### 9. 커스텀 404 페이지
expected: 존재하지 않는 URL(예: localhost:3000/asdfasdf)에 접근하면 ( ._.) 이모지와 "페이지를 찾을 수 없습니다" 메시지, 홈으로 돌아가기 버튼이 있는 커스텀 404 페이지가 표시됩니다.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all gaps resolved by plan 05]
