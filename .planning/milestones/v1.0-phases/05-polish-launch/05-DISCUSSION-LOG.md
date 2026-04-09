# Phase 5: Polish + Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 05-polish-launch
**Areas discussed:** 모바일 반응형 전략, 스켈레톤 UI 범위, 에러 처리 UX, 프로덕션 인프라

---

## 모바일 반응형 전략

| Option | Description | Selected |
|--------|-------------|----------|
| 예매 플로우 우선 | 예매 핵심 플로우를 최우선 대응. 그 다음 홈/상세/검색 | |
| 전체 페이지 동시 대응 | 모든 공개 페이지를 한번에 모바일 최적화. Admin은 데스크톱 전용 | ✓ |
| 사용자 진입순 | 홈→검색/장르→상세→예매→마이페이지 순서로 동선 따라 대응 | |

**User's choice:** 전체 페이지 동시 대응

### 테이블 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 카드형으로 변환 | 모바일에서는 테이블을 카드 리스트로 변환 | ✓ |
| 수평 스크롤 테이블 | 테이블 유지하되 수평 스크롤로 처리 | |
| Claude 재량 | 페이지별로 최적 방식 판단에 맡김 | |

**User's choice:** 카드형으로 변환

### GNB

| Option | Description | Selected |
|--------|-------------|----------|
| 햄버거 메뉴 | 모바일에서 GNB를 햄버거 아이콘으로 축소 | |
| 하단 탭바 | 모바일에서 GNB 대신 하단 탭바(홈/검색/마이페이지 등) | ✓ |
| 기존 GNB 유지 | 현재 GNB가 이미 반응형이면 미세 조정만 | |

**User's choice:** 하단 탭바

### 탭바 항목

| Option | Description | Selected |
|--------|-------------|----------|
| 홈/검색/마이페이지 | 3탭: 최소한으로 유지 | |
| 홈/카테고리/검색/마이페이지 | 4탭 | ✓ |
| 홈/검색/예매내역/마이페이지 | 4탭: 예매내역 바로가기 포함 | |

**User's choice:** 홈/카테고리/검색/마이페이지

### 터치 타겟

| Option | Description | Selected |
|--------|-------------|----------|
| 44px 엄격 적용 | WCAG 기준 44px. 모든 인터랙티브 요소에 최소 44px 적용 | ✓ |
| 48px (Material) | Material Design 기준 48px | |
| Claude 재량 | 요소별로 적절한 크기 판단에 맡김 | |

**User's choice:** 44px 엄격 적용

### 상세 페이지 모바일

| Option | Description | Selected |
|--------|-------------|----------|
| 포스터 전체폭 + 정보 아래 | 포스터를 상단 전체 폭으로 표시, 아래에 정보/탭 배치 | ✓ |
| 포스터 고정 + 스크롤 정보 | 포스터를 상단 고정하고 아래 정보 영역만 스크롤 | |
| Claude 재량 | 적절한 레이아웃 판단에 맡김 | |

**User's choice:** 포스터 전체폭 + 정보 아래

### 예매 날짜/회차 선택

| Option | Description | Selected |
|--------|-------------|----------|
| 상단 접힘식 | 날짜/회차 선택을 상단에 접힘식으로 배치. 좌석맵에 최대 공간 확보 | ✓ |
| 바텀시트 날짜선택 | 날짜/회차 선택을 바텀시트로 처리 | |
| Claude 재량 | 적절한 레이아웃 판단에 맡김 | |

**User's choice:** 상단 접힘식

---

## 스켈레톤 UI 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 주요 페이지 전체 | 홈, 상세, 장르, 검색, 예매, 마이페이지 등 모든 공개 페이지 | |
| 데이터 페치 영역만 | API 호출로 데이터를 가져오는 영역만 스켈레톤. 정적 영역은 그대로 노출 | ✓ |
| 최소한만 | 홈페이지와 상세 페이지 등 핵심 페이지만 | |

**User's choice:** 데이터 페치 영역만

### 세분화 수준

| Option | Description | Selected |
|--------|-------------|----------|
| 컴포넌트별 | 각 컴포넌트가 자체 스켈레톤을 가짐. 데이터 도착 시 개별 렌더링 | ✓ |
| 페이지 전체 | 페이지 단위로 하나의 스켈레톤. 데이터 도착 시 한번에 전체 교체 | |
| Claude 재량 | 페이지별 적절한 수준 판단 | |

**User's choice:** 컴포넌트별

### 애니메이션

| Option | Description | Selected |
|--------|-------------|----------|
| Pulse 애니메이션 | shadcn Skeleton 기본 pulse. 기존 코드와 일관 | ✓ |
| Shimmer/Wave | 좌우로 밝은 빛이 지나가는 시머 효과 | |
| Claude 재량 | 기존 패턴 따른 선택 | |

**User's choice:** Pulse 애니메이션

---

## 에러 처리 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 토스트 기본 + 인라인 보조 | API 에러는 sonner 토스트, 폼 에러는 필드 인라인. 모두 한국어 | ✓ |
| 토스트 전용 | 모든 에러를 토스트로 통일 | |
| 인라인 전용 | 모든 에러를 해당 영역 내 인라인으로 표시 | |

**User's choice:** 토스트 기본 + 인라인 보조

### 오프라인 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 전체 배너 | 화면 상단/하단에 전체 폭 배너 + 재시도 버튼 | ✓ |
| 토스트 알림 | 오프라인 상태를 토스트로 알림 | |
| Claude 재량 | 상황에 맞는 처리 방식 판단 | |

**User's choice:** 전체 배너

### 메시지 전략

| Option | Description | Selected |
|--------|-------------|----------|
| 사용자 친화적 한국어 | 기술적 에러 코드 숨기고 안내성 메시지 | |
| 에러 코드 포함 | 사용자 메시지 + 에러 코드(ERR-001 등). CS 문의 시 참조 가능 | ✓ |
| 상황별 분기 | 4xx는 구체적 안내, 5xx는 일반적 안내 | |

**User's choice:** 에러 코드 포함

### 404 페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 일러스트 + 홈으로 | 친근한 일러스트 + "페이지를 찾을 수 없습니다" + 홈으로 버튼 | ✓ |
| 검색 유도 | 404 + 검색창 표시하여 사용자가 직접 검색하도록 유도 | |
| Claude 재량 | 적절한 디자인 판단 | |

**User's choice:** 일러스트 + 홈으로

---

## 프로덕션 인프라

### Sentry

| Option | Description | Selected |
|--------|-------------|----------|
| 프론트+백엔드 | Next.js + NestJS 모두 Sentry 설정 | ✓ |
| 프론트엔드만 | Next.js만 Sentry 설정 | |
| Claude 재량 | 적절한 범위 판단 | |

**User's choice:** 프론트+백엔드

### CI/CD

| Option | Description | Selected |
|--------|-------------|----------|
| 풀 파이프라인 | PR시 lint+typecheck+test → main merge시 배포 | ✓ |
| 배포만 | main merge시 배포만 자동화 | |
| Claude 재량 | 적절한 범위 판단 | |

**User's choice:** 풀 파이프라인

### 배포 전략

| Option | Description | Selected |
|--------|-------------|----------|
| web+api 각각 서비스 | Next.js와 NestJS를 별도 Cloud Run 서비스로 배포 | ✓ |
| 모노레포 단일 배포 | 하나의 컨테이너로 합쳐서 배포 | |
| Claude 재량 | 아키텍처에 맞는 판단 | |

**User's choice:** web+api 각각 서비스

### DB 마이그레이션

| Option | Description | Selected |
|--------|-------------|----------|
| CI/CD에서 자동 | GitHub Actions에서 drizzle-kit migrate 자동 실행 | ✓ |
| 수동 실행 | 마이그레이션은 수동으로 실행 | |
| Claude 재량 | 적절한 방식 판단 | |

**User's choice:** CI/CD에서 자동

### Cloud Run 인스턴스

| Option | Description | Selected |
|--------|-------------|----------|
| min=0 | 비용 최소화. 콜드 스타트 있음 | |
| min=1 | 콜드 스타트 없이 즉각 응답. 월 비용 발생 | ✓ |
| Claude 재량 | 상황에 맞는 설정 판단 | |

**User's choice:** min=1
**Notes:** PROJECT.md에는 min-instances=0으로 정의되어 있으나, 사용자가 min=1 선택

### Dockerfile

| Option | Description | Selected |
|--------|-------------|----------|
| 멀티스테이지 빌드 | deps 설치 → 빌드 → 프로덕션 이미지 분리 | ✓ |
| Claude 재량 | 최적화된 Dockerfile 판단에 맡김 | |

**User's choice:** 멀티스테이지 빌드

### 환경변수

| Option | Description | Selected |
|--------|-------------|----------|
| GCP Secret Manager | Cloud Run에서 Secret Manager로 시크릿 주입 | ✓ |
| Cloud Run 환경변수 | Cloud Run 콘솔/YAML에서 직접 설정 | |
| Claude 재량 | 보안 수준에 맞는 판단 | |

**User's choice:** GCP Secret Manager

---

## Claude's Discretion

- 하단 탭바 아이콘 및 애니메이션 디자인
- 스켈레톤 컴포넌트별 레이아웃 세부 형태
- 에러 코드 체계 (ERR-xxx 네이밍/범위)
- 404 일러스트 구체적 디자인
- Sentry 샘플링 레이트 설정
- GitHub Actions workflow 파일 구조
- Dockerfile 최적화 세부사항
- Cloud Run 서비스 리소스 설정

## Deferred Ideas

None — discussion stayed within phase scope
