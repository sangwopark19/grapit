# Phase 5: Polish + Launch - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

모바일 반응형 디자인, 스켈레톤 UI 로딩 상태, 에러 처리 UX를 전체 페이지에 적용하고, Sentry 에러 추적 + GitHub Actions CI/CD + Cloud Run 배포 파이프라인을 구축하여 프로덕션 런칭 준비를 완성한다.

</domain>

<decisions>
## Implementation Decisions

### 모바일 반응형 전략
- **D-01:** 모든 공개 페이지를 동시에 모바일 반응형 대응. Admin은 데스크톱 전용으로 유지
- **D-02:** 모바일에서 복잡한 테이블(예매 내역, 검색 결과 등)은 카드형 리스트로 변환. NOL 티켓 모바일 예매내역과 유사
- **D-03:** GNB를 모바일에서 하단 탭바로 교체. 4탭: 홈 / 카테고리 / 검색 / 마이페이지
- **D-04:** 모든 터치 타겟(버튼, 링크, 입력 영역) 최소 44px 엄격 적용 (WCAG 기준)
- **D-05:** 공연 상세 페이지 모바일: 포스터를 상단 전체 폭으로 표시, 그 아래에 공연 정보/탭 배치. 데스크톱 2칸 → 모바일 1칸
- **D-06:** 예매 플로우 날짜/회차 선택: 모바일에서 상단 접힘식으로 배치, 펼치면 캘린더 표시. 좌석맵에 최대 공간 확보

### 스켈레톤 UI
- **D-07:** API 데이터 페치 영역에만 스켈레톤 적용. 정적 영역(GNB, Footer, 탭 헤더 등)은 즉시 렌더링
- **D-08:** 컴포넌트별 스켈레톤 세분화. 각 컴포넌트(카드, 배너, 탭 콘텐츠 등)가 자체 스켈레톤을 가지고, 데이터 도착 시 개별 렌더링
- **D-09:** shadcn Skeleton 기본 Pulse 애니메이션 유지. 기존 코드와 일관성 유지

### 에러 처리 UX
- **D-10:** API 에러는 sonner 토스트로 표시 (기본). 폼 유효성 에러는 필드 인라인으로 표시 (보조). 모두 한국어
- **D-11:** 네트워크 오프라인/타임아웃 시 화면 상단에 전체 폭 배너 표시: "인터넷 연결을 확인해주세요" + 재시도 버튼
- **D-12:** 에러 메시지에 에러 코드 포함 (예: ERR-001). 사용자 친화적 한국어 메시지 + 에러 코드로 CS 문의 시 참조 가능
- **D-13:** 404 페이지: 친근한 일러스트/이모티콘 + "페이지를 찾을 수 없습니다" + 홈으로 버튼

### 프로덕션 인프라
- **D-14:** Sentry 프론트엔드(@sentry/nextjs) + 백엔드(@sentry/nestjs) 모두 설정. 에러 추적 + 성능 모니터링 + 소스맵 업로드
- **D-15:** GitHub Actions 풀 파이프라인: PR 시 lint + typecheck + test → main merge 시 Docker 빌드 → Artifact Registry → Cloud Run 배포. OIDC(Workload Identity Federation) 인증
- **D-16:** Cloud Run web(Next.js) + api(NestJS) 각각 별도 서비스로 배포. 독립 스케일링
- **D-17:** DB 마이그레이션은 CI/CD 파이프라인에서 자동 실행. drizzle-kit migrate를 배포 전 단계로 실행
- **D-18:** Cloud Run min-instances=1. 콜드 스타트 없이 즉각 응답 보장
- **D-19:** Dockerfile 멀티스테이지 빌드. deps 설치 → 빌드 → 프로덕션 이미지 분리. Next.js standalone + NestJS 각각 최적화
- **D-20:** 환경변수는 GCP Secret Manager로 관리. Cloud Run에서 시크릿 참조로 주입

### Claude's Discretion
- 하단 탭바 아이콘 및 애니메이션 디자인
- 스켈레톤 컴포넌트별 레이아웃 세부 형태
- 에러 코드 체계 (ERR-xxx 네이밍/범위)
- 404 일러스트 구체적 디자인
- Sentry 샘플링 레이트 설정
- GitHub Actions workflow 파일 구조
- Dockerfile 최적화 세부사항 (캐시 레이어, 이미지 크기)
- Cloud Run 서비스 리소스 설정 (CPU, 메모리, 동시성)
- GCP Secret Manager 시크릿 구조

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 아키텍처 & 배포
- `docs/03-ARCHITECTURE.md` — 시스템 아키텍처, Cloud Run 배포 구성, API 엔드포인트 설계
- `CLAUDE.md` §Technology Stack — Sentry, GitHub Actions, Cloud Run, Docker 관련 스택 정의
- `CLAUDE.md` §Conventions — 환경변수 관리 규칙 (.env 루트 위치, Cloud Run Secret Manager)

### UI/UX & 디자인
- `docs/04-UIUX-GUIDE.md` — 디자인 토큰, 컴포넌트 패턴, 반응형 가이드
- `docs/02-PRD.md` — 사용자 페르소나, 모바일 우선 UX 요구사항
- `docs/01-SITE-ANALYSIS-REPORT.md` — NOL 티켓 모바일 UI 분석, 하단 탭바 패턴 참조

### 이전 Phase 컨텍스트
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 브랜드 컬러(D-14~D-16), shadcn/ui New York 스타일, @theme 디자인 토큰
- `.planning/phases/02-catalog-admin/02-CONTEXT.md` — 상세 페이지 2칸 레이아웃(D-09~D-12), Admin 테이블 패턴(D-16)
- `.planning/phases/03-seat-map-real-time/03-CONTEXT.md` — 모바일 바텀시트(D-05), 좌석맵 줌/팬(D-04), 날짜/회차 선택 구성(D-02)
- `.planning/phases/04-booking-payment/04-CONTEXT.md` — 결제 확인 화면(D-01~D-04), 마이페이지 예매내역(D-07~D-10), Admin 예매관리(D-11~D-12)

### 기술 스택 참조
- `CLAUDE.md` §Technology Stack — @sentry/nextjs, @sentry/nestjs, sharp, Tailwind v4 등
- `CLAUDE.md` §Redis Client Strategy — @upstash/redis vs ioredis 구분 (배포 시 환경변수 설정 필요)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/ui/skeleton.tsx` — shadcn Skeleton 컴포넌트. Pulse 애니메이션. 19개 파일에서 이미 사용 중
- `apps/web/components/ui/sheet.tsx` — Sheet 컴포넌트 (바텀시트 기반)
- `apps/web/components/ui/sonner.tsx` — 토스트 알림 컴포넌트
- `apps/web/app/error.tsx` — 글로벌 에러 페이지 (한국어 메시지 + 재시도 버튼). 확장 필요
- `apps/web/components/booking/seat-selection-sheet.tsx` — 모바일 좌석 선택 바텀시트 패턴 참조
- `apps/web/components/layout/gnb.tsx` — 현재 GNB. 모바일 하단 탭바로 교체 또는 분기 필요
- `apps/web/lib/api-client.ts` — API 클라이언트. 에러 인터셉터 추가하여 통합 에러 처리 구현

### Established Patterns
- 상태관리: React Query (서버) + Zustand (클라이언트)
- UI: shadcn/ui New York + Tailwind v4 @theme 디자인 토큰
- 반응형: 30+ 컴포넌트에서 이미 `sm:`, `md:`, `lg:` 브레이크포인트 사용
- 에러: error.tsx 글로벌 에러 바운더리 존재
- 로딩: 여러 페이지에서 이미 Skeleton 컴포넌트 사용

### Integration Points
- GNB → 모바일 하단 탭바 분기/교체
- 모든 공개 페이지 → 반응형 레이아웃 조정
- API 클라이언트 → 에러 인터셉터 통합
- Next.js config → Sentry 통합
- NestJS main.ts → Sentry 초기화
- GitHub repo → Actions workflow 파일
- GCP → Cloud Run 서비스 + Artifact Registry + Secret Manager

</code_context>

<specifics>
## Specific Ideas

- 하단 탭바는 NOL 티켓/쿠팡 등 국내 앱의 하단 탭바 패턴 참조
- 공연 상세 모바일은 NOL 티켓 모바일 상세 페이지 참조 (포스터 전체폭 + 아래 정보)
- 에러 코드 시스템은 CS 문의 시 빠른 추적을 위한 것 (ERR-001 형태)
- Cloud Run min=1로 설정하여 콜드 스타트 없는 사용자 경험 보장

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-polish-launch*
*Context gathered: 2026-04-07*
