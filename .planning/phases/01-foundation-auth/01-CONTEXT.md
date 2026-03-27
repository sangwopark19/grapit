# Phase 1: Foundation + Auth - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

프로젝트 스캐폴딩(Next.js 16 + NestJS 11 모노레포), PostgreSQL 초기 스키마, 사용자 인증 시스템(이메일/소셜 로그인 + JWT + SMS 인증) 구축. 인증된 사용자가 세션을 유지하며 앱을 탐색할 수 있는 기반을 완성한다.

</domain>

<decisions>
## Implementation Decisions

### 회원가입 수집 정보
- **D-01:** 가입 플로우는 이메일/비밀번호 or 소셜 로그인 → 약관 동의 → 추가 정보 입력 순서
- **D-02:** 약관 동의 3개: 이용약관(필수) + 개인정보처리방침(필수) + 마케팅 수신동의(선택). 전체동의 체크박스 포함
- **D-03:** 추가 정보 필수 입력: 이름, 성별, 국가, 생년월일, 전화번호(SMS 인증)
- **D-04:** 소셜 로그인(카카오/네이버/구글) 최초 가입 시에도 일반 회원가입과 동일하게 약관 동의 + 추가 정보 입력 필수
- **D-05:** 전화번호 인증은 SMS 인증코드 6자리 발송 + 검증 플로우로 구현 (NHN Cloud 또는 Twilio 연동)

### 인증 화면 UX
- **D-06:** 로그인/회원가입은 통합 페이지(/auth)에서 탭 전환 방식. 소셜 로그인 버튼은 이메일 폼 아래 "또는" 구분선 하단에 배치
- **D-07:** 회원가입은 3단계 스텝: Step 1(이메일/비밀번호) → Step 2(약관 동의) → Step 3(추가 정보 + SMS 인증) → 완료
- **D-08:** 로그인 실패 시 인라인 에러 메시지 (입력 필드 아래 빨간 텍스트). "이메일 또는 비밀번호가 일치하지 않습니다"
- **D-09:** 비밀번호 찾기 기능 Phase 1에 포함. 이메일 입력 → 비밀번호 재설정 링크/임시 비밀번호 발송

### Phase 1 앱 쉘
- **D-10:** GNB는 풀 구조로 구현: 로고 + 장르 탭(placeholder, 클릭 시 "준비중" 또는 비활성) + 검색바(placeholder) + 로그인/프로필 버튼. Phase 2에서 기능 연결
- **D-11:** 홈 페이지는 빈 상태 + CTA: 브랜드 로고 + "곧 다양한 공연이 찾아옵니다" 메시지 + 로그인 유도 CTA. Phase 2에서 카탈로그로 교체
- **D-12:** 마이페이지 기본 구조 포함: 프로필 정보 확인/수정(이름, 전화번호 등) + 로그아웃 버튼. 예매 내역은 Phase 4에서 추가
- **D-13:** 푸터에 이용약관, 개인정보처리방침 링크 포함

### 브랜드 컬러/폰트
- **D-14:** Primary: #6C3CE0 (딥 퍼플), Secondary: #FF6B35 (오렌지), Accent: #00D4AA (티어 그린)
- **D-15:** Neutral: Gray-900 #1A1A2E, Gray-100 #F5F5F7, White #FFFFFF
- **D-16:** Semantic: Success #22C55E, Error #EF4444, Warning #FFB41B, Info #6C3CE0 (Primary와 동일)
- **D-17:** 폰트: Pretendard (Next.js localFont으로 셀프 호스팅). 코드/숫자는 시스템 모노스페이스
- **D-18:** 좌석 등급별 색상은 Phase 3에서 결정

### Claude's Discretion
- 프로젝트 모노레포 구조 (apps/web, apps/api, packages/shared 등)
- SMS API 제공사 선택 (NHN Cloud vs Twilio — 비용/편의성 기준)
- 비밀번호 재설정 방식 (임시 비밀번호 vs 재설정 링크)
- 비밀번호 유효성 검증 규칙 (최소 길이, 특수문자 등)
- 로딩/전환 애니메이션 세부 사항

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 아키텍처
- `docs/03-ARCHITECTURE.md` — 시스템 아키텍처, 모듈 구조, 인증/인가 플로우(JWT + Refresh Token Rotation), API 엔드포인트 설계, Cloud Run 배포 구성
- `docs/03-ARCHITECTURE.md` §3.3 — 인증/인가 플로우 시퀀스 다이어그램. Access Token(15분) + Refresh Token(7일, httpOnly Cookie) + 소셜 로그인 OAuth 코드

### UI/UX
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰(컬러, 타이포, 스페이싱), 컴포넌트 패턴, 레이아웃 구조. 단, Primary/Secondary 컬러는 이 문서 대신 D-14~D-16의 Grapit 고유 컬러 사용
- `docs/04-UIUX-GUIDE.md` §2 — 디자인 토큰 상세 (NOL 티켓 기반 구조, Grapit 컬러로 교체 적용)

### 기능 요구사항
- `docs/02-PRD.md` — NOL 티켓 분석 기반 기능 요구사항. 인증 관련 페르소나, 사용자 플로우 참조
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 사이트맵, URL 패턴, GNB 구조, 예매 플로우 분석

### 기술 스택
- `CLAUDE.md` §Technology Stack — 전체 기술 스택 상세 (버전, 선정 이유, 대안 비교). 특히 인증 관련: argon2, @nestjs/jwt, @nestjs/passport, zod, drizzle-zod

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 프로젝트가 아직 초기 상태 — 소스 코드 없음. Phase 1에서 모든 기반 코드를 처음부터 작성

### Established Patterns
- `docs/03-ARCHITECTURE.md`의 라우팅 구조, 컴포넌트 계층, 모듈 구조를 따름
- 상태관리: React Query (서버), Zustand (클라이언트), URL searchParams (필터)
- 유효성 검증: zod + drizzle-zod (프론트/백엔드 공유)

### Integration Points
- GNB 레이아웃 → Phase 2에서 장르 탭/검색 기능 연결
- 마이페이지 → Phase 4에서 예매 내역 추가
- 홈 페이지 → Phase 2에서 카탈로그로 교체
- 인증 가드 → 모든 Phase에서 보호 라우트에 재사용

</code_context>

<specifics>
## Specific Ideas

- NOL 티켓 방식의 통합 로그인/회원가입 탭 UI 참조
- GNB에 장르 탭과 검색바를 placeholder로 미리 배치하여 Phase 2 전환 시 자연스럽게 연결
- 홈 페이지는 "곧 다양한 공연이 찾아옵니다" 형태의 간결한 랜딩
- 딥 퍼플(#6C3CE0) 기반 브랜드로 인터파크(#3549FF)/YES24와 차별화

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-auth*
*Context gathered: 2026-03-27*
