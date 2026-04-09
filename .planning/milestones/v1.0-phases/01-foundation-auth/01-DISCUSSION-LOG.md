# Phase 1: Foundation + Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 01-foundation-auth
**Areas discussed:** 회원가입 수집 정보, 인증 화면 UX, Phase 1 앱 쉘 범위, 브랜드 컬러/폰트

---

## 회원가입 수집 정보

### 가입 필드

| Option | Description | Selected |
|--------|-------------|----------|
| 이메일 + 비밀번호만 | 가입 마찰 최소화. 닉네임/전화번호는 나중에 프로필에서 선택 입력 | |
| 이메일 + 비밀번호 + 닉네임 | 닉네임을 필수로 받아 표시명으로 활용 | |
| 이메일 + 비밀번호 + 닉네임 + 전화번호 | 전화번호까지 필수. 결제/예매 시 연락처로 활용 | |
| (Other) | 이메일 + 비밀번호 or OAuth → 약관 동의 → 이름, 성별, 국가, 생년월일, 전화번호 인증 | ✓ |

**User's choice:** 이메일 + 비밀번호 or OAuth 회원가입 후 약관 동의하고 이름, 성별, 국가, 생년월일, 전화번호 인증 필요함
**Notes:** 소셜 로그인도 일반 회원가입과 동일하게 추가 정보 입력 필수

### 소셜 온보딩

| Option | Description | Selected |
|--------|-------------|----------|
| 바로 가입 완료 | 소셜 프로필 정보만으로 자동 가입 | |
| 닉네임만 추가 입력 | 소셜 가입 후 닉네임 설정 화면 1개만 거침 | |
| 추가 프로필 작성 | 소셜 가입 후 닉네임 + 전화번호 + 선호 장르 등 온보딩 | |
| (Other) | 일반 회원가입과 동일한 추가 정보 입력 | ✓ |

**User's choice:** 소셜로그인도 일반회원가입과 마찬가지로 동일
**Notes:** 소셜 로그인 유저도 약관 동의 + 이름/성별/국가/생년월일/전화번호 인증 모두 필수

### 전화번호 인증

| Option | Description | Selected |
|--------|-------------|----------|
| 입력만 받기 | 전화번호 필드만 받고 SMS 인증은 미구현 | |
| SMS 인증코드 구현 | 6자리 인증코드 SMS 발송 + 검증 플로우 | ✓ |
| PASS 본인인증 | 통신사 본인인증. 연령제한/실명 확인 가능 | |

**User's choice:** SMS 인증코드 구현
**Notes:** None

### 약관 동의

| Option | Description | Selected |
|--------|-------------|----------|
| 기본 3개 | 이용약관(필수) + 개인정보(필수) + 마케팅(선택). 전체동의 체크박스 포함 | ✓ |
| 최소 2개 | 이용약관(필수) + 개인정보(필수)만 | |

**User's choice:** 기본 3개 (추천)
**Notes:** None

---

## 인증 화면 UX

### 페이지 구성

| Option | Description | Selected |
|--------|-------------|----------|
| 통합 페이지 + 탭 전환 | 로그인/회원가입을 한 페이지에서 탭으로 전환. NOL티켓 방식 | ✓ |
| 분리 페이지 | 로그인(/login)과 회원가입(/signup) 별도 페이지 | |
| 소셜 우선 레이아웃 | 소셜 로그인 버튼을 상단에 크게 배치, 이메일은 하단 링크로 축소 | |

**User's choice:** 통합 페이지 + 탭 전환 (추천)
**Notes:** None

### 가입 플로우

| Option | Description | Selected |
|--------|-------------|----------|
| 단계별 스텝 | Step 1: 이메일/비밀번호 → Step 2: 약관 → Step 3: 추가정보+SMS → 완료 | ✓ |
| 한 페이지 스크롤 | 모든 필드를 한 페이지에 스크롤로 배치 | |

**User's choice:** 단계별 스텝 (추천)
**Notes:** None

### 에러 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 인라인 메시지 | 입력 필드 아래에 빨간 텍스트로 에러 표시 | ✓ |
| 토스트 알림 | 화면 상단에 토스트 팝업으로 에러 표시 | |

**User's choice:** 인라인 메시지 (추천)
**Notes:** None

### 비밀번호 찾기

| Option | Description | Selected |
|--------|-------------|----------|
| 포함 | 이메일 입력 → 임시 비밀번호 발송 또는 비밀번호 재설정 링크 발송 | ✓ |
| Phase 2로 미루기 | Phase 1에서는 없이 진행 | |

**User's choice:** 포함 (추천)
**Notes:** None

---

## Phase 1 앱 쉘 범위

### GNB 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 기본 쉘 | 로고 + 로그인/마이페이지 버튼만 | |
| 풀 GNB 구조 | 로고 + 장르 탭(placeholder) + 검색바(placeholder) + 로그인 | ✓ |

**User's choice:** 풀 GNB 구조
**Notes:** Phase 2에서 장르 탭, 검색바에 기능 연결

### 홈 페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 빈 상태 + CTA | 브랜드 로고 + "곧 다양한 공연이 찾아옵니다" + 로그인 CTA | ✓ |
| 목업 레이아웃 | Phase 2 카탈로그 레이아웃을 마크업으로 미리 구성 | |

**User's choice:** 빈 상태 + CTA (추천)
**Notes:** None

### 마이페이지

| Option | Description | Selected |
|--------|-------------|----------|
| 기본 구조 포함 | 프로필 정보 확인/수정 + 로그아웃 버튼 | ✓ |
| Phase 2로 미루기 | 로그인 후에도 홈으로만 이동 | |

**User's choice:** 기본 구조 포함 (추천)
**Notes:** 예매 내역은 Phase 4에서 추가

---

## 브랜드 컬러/폰트

### 브랜드 컬러

| Option | Description | Selected |
|--------|-------------|----------|
| 딥 퍼플 계열 | Primary #6C3CE0, Secondary #FF6B35, Accent #00D4AA | ✓ |
| 레드/코랄 계열 | Primary #E63946, Secondary #1D3557, Accent #F4A261 | |
| 블루/네이비 계열 | Primary #2563EB, Secondary #7C3AED, Accent #06B6D4 | |

**User's choice:** 딥 퍼플 계열
**Notes:** 인터파크(#3549FF)/YES24와 차별화

### 폰트

| Option | Description | Selected |
|--------|-------------|----------|
| Pretendard | 한국어 웹 표준 폰트. 애플 SD 산돌고딕 Neo 기반 | ✓ |
| Noto Sans KR | Google Fonts. 가장 널리 사용되는 한국어 웹폰트 | |
| SUIT | Spoqa Han Sans 후속. 타이트한 자간으로 모던한 느낌 | |

**User's choice:** Pretendard (추천)
**Notes:** Next.js localFont으로 셀프 호스팅

### 좌석 등급 컬러

| Option | Description | Selected |
|--------|-------------|----------|
| 지금 정하기 | VIP=#FFD700, R=#E63946 등 5등급 기본값 설정 | |
| Phase 3에서 | 좌석맵 구현 시점에 결정 | ✓ |
| 내가 직접 설정 | 등급별 색상을 직접 지정 | |

**User's choice:** Phase 3에서 (추천)
**Notes:** None

---

## Claude's Discretion

- 프로젝트 모노레포 구조 (apps/web, apps/api, packages/shared 등)
- SMS API 제공사 선택 (NHN Cloud vs Twilio)
- 비밀번호 재설정 방식 (임시 비밀번호 vs 재설정 링크)
- 비밀번호 유효성 검증 규칙
- 로딩/전환 애니메이션

## Deferred Ideas

None — discussion stayed within phase scope
