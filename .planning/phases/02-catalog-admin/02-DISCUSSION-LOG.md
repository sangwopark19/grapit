# Phase 2: Catalog + Admin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 02-catalog-admin
**Areas discussed:** 홈/카탈로그 구성, 공연 카드 & 목록, 공연 상세 페이지, Admin 패널 UX

---

## 홈/카탈로그 구성

### 홈 페이지 형태

| Option | Description | Selected |
|--------|-------------|----------|
| NOL 티켓 참조 홈 | 메인 배너 캐러셀 + HOT 공연 + 신규 오픈 + 장르별 바로가기 | ✓ |
| 미니멀 디스커버리 홈 | 장르 카드 그리드 + 검색바 중심 | |
| 피드 중심 홈 | 전체 공연 시간순 나열 + 상단 장르 필터 칩 | |

**User's choice:** NOL 티켓 참조 홈
**Notes:** 카탈로그 중심으로 배너+섹션 구조

### GNB 장르 탭

| Option | Description | Selected |
|--------|-------------|----------|
| 주요 5개 + 더보기 | GNB에 5개 탭 유지 + 더보기 드롭다운으로 나머지 3개 | ✓ |
| 8개 전체 나열 | GNB에 8개 장르 탭 전부 표시 | |
| 6개 + 더보기 | GNB에 6개 + 더보기로 나머지 2개 | |

**User's choice:** 주요 5개 + 더보기
**Notes:** GNB가 깨끗하게 유지되도록

### 배너 캐러셀 콘텐츠

| Option | Description | Selected |
|--------|-------------|----------|
| 공연 포스터 자동 | HOT 공연 상위 3~5개 포스터 자동 노출 | |
| Admin 배너 관리 | Admin에서 배너 이미지+링크 등록/관리 | ✓ |
| 하이브리드 | 기본 자동 + Admin 수동 피닝 옵션 | |

**User's choice:** Admin 배너 관리
**Notes:** ADMN 요구사항에 없지만 홈 구성에 필요하므로 스코프에 포함

### 서브카테고리 필터

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 칩 필터 | 페이지 상단에 칩 형태 필터. URL searchParams로 관리 | ✓ |
| 사이드바 필터 | 왼쪽 사이드바에 서브카테고리 목록 | |
| 드롭다운 필터 | 정렬 옵션 옆에 드롭다운 | |

**User's choice:** 상단 칩 필터

### 홈 섹션 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 배너 + HOT + 신규 + 장르 | 메인 배너 + HOT 공연 + 신규 오픈 + 장르별 바로가기 | ✓ |
| 배너 + 장르별 탭 섹션 | 메인 배너 + 하단 장르 탭 전환 | |
| 배너 + HOT + 신규 + 마감임박 | 장르 바로가기 대신 마감임박 섹션 | |

**User's choice:** 배너 + HOT + 신규 + 장르

---

## 공연 카드 & 목록

### 카드 정보 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 포스터 + 핵심정보 | 포스터(2:3) + 공연명 + 장소 + 기간 + 상태 배지 | ✓ |
| 포스터 + 상세정보 + 가격 | 위 정보 + 최저가격 표시 | |
| 포스터 중심 미니멀 | 포스터 + 공연명만 | |

**User's choice:** 포스터 + 핵심정보

### 카드 밀도

| Option | Description | Selected |
|--------|-------------|----------|
| 4열 그리드 | 데스크톱 4열, 태블릿 3열, 모바일 2열 | ✓ |
| 3열 그리드 | 데스크톱 3열, 태블릿 2열, 모바일 1열 | |
| 리스트형 (가로) | 포스터+정보 가로 배치 리스트 | |

**User's choice:** 4열 그리드

### 페이지네이션

| Option | Description | Selected |
|--------|-------------|----------|
| 전통적 페이지네이션 | 하단 번호 페이지. URL searchParams 유지 | ✓ |
| 더보기 버튼 | 클릭하면 다음 페이지 카드 추가 | |
| 무한 스크롤 | 스크롤하면 자동 로드 | |

**User's choice:** 전통적 페이지네이션

### 정렬 옵션

| Option | Description | Selected |
|--------|-------------|----------|
| 최신순 + 인기순 | 기본 최신순, 인기순 토글 | ✓ |
| 다양한 정렬 | 최신순, 인기순, 가나다순, 마감임박순, 가격순 | |
| Claude 재량 | Claude가 적절한 정렬 옵션 결정 | |

**User's choice:** 최신순 + 인기순

---

## 공연 상세 페이지

### 상세 레이아웃

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 포스터 + 정보 사이드 | 왼쪽 포스터 + 오른쪽 정보 + 하단 탭 | ✓ |
| 풀와이드 포스터 + 하단 정보 | 상단 큰 포스터 + 스크롤 시 정보 | |

**User's choice:** 상단 포스터 + 정보 사이드

### CTA 배치

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 고정 + sticky | 오른쪽 정보 영역에 CTA 고정 + 스크롤 시 sticky + 모바일 하단 바 | ✓ |
| 상단만 고정 | CTA 배치하되 sticky 없음 | |
| Claude 재량 | Claude가 적절한 CTA 배치 결정 | |

**User's choice:** 상단 고정 + sticky

### 캐스팅 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 배우 사진 + 이름 그리드 | circle avatar + 이름 + 역할 그리드 | ✓ |
| 텍스트 리스트 | 사진 없이 이름 + 역할 텍스트 | |
| Claude 재량 | Claude가 결정 | |

**User's choice:** 배우 사진 + 이름 그리드

### 상세 탭 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 캐스팅 + 상세정보 + 판매정보 | 3개 탭 (NOL 티켓 방식) | ✓ |
| 탭 없이 스크롤 | 모든 정보 순서대로 나열 | |
| 2개 탭 | 캐스팅을 공연정보에 포함 | |

**User's choice:** 캐스팅 + 상세정보 + 판매정보

---

## Admin 패널 UX

### Admin 접근 제어

| Option | Description | Selected |
|--------|-------------|----------|
| role 컬럼 추가 | users에 role enum(USER/ADMIN). Guard + proxy 보호 | ✓ |
| 비밀번호 라우트 | /admin 경로 숨기고 URL만으로 제어 | |
| 별도 인증 | Admin 전용 로그인 + 별도 토큰 | |

**User's choice:** role 컬럼 추가

### 공연 등록 폼

| Option | Description | Selected |
|--------|-------------|----------|
| 단일 페이지 폼 | 섹션으로 구분. 스크롤하며 작성 | ✓ |
| 단계별 위저드 | Step 1~4. 단계별 저장 | |
| 탭 기반 폼 | 상단 탭으로 구분. 자유로운 이동 | |

**User's choice:** 단일 페이지 폼

### SVG 좌석맵 업로드

| Option | Description | Selected |
|--------|-------------|----------|
| 업로드 + 미리보기 + 등급매핑 | 업로드 → 미리보기 → 등급별 그룹 선택 + 색상/가격 할당 | ✓ |
| 업로드 + 자동 파싱 | 좌석 요소 자동 감지 + 등급 할당 UI | |
| 업로드 + JSON 설정파일 | SVG + 등급/가격 매핑 JSON 별도 업로드 | |

**User's choice:** 업로드 + 미리보기 + 등급매핑

### Admin 목록 페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 테이블 + 필터/검색 | 공연 테이블(썸네일, 이름, 장르, 기간, 상태) + 필터 + 검색 | ✓ |
| 카드 그리드 | 포스터 카드 그리드 | |
| Claude 재량 | Claude가 결정 | |

**User's choice:** 테이블 + 필터/검색

---

## Claude's Discretion

- Admin 레이아웃 구조 (사이드바 vs 상단 탭)
- 검색 결과 페이지 레이아웃
- 검색 자동완성/추천어 여부
- 판매종료 포함/제외 토글 UI
- 공연 상태 자동 전환 로직
- 포스터 이미지 최적화 전략

## Deferred Ideas

None — discussion stayed within phase scope
