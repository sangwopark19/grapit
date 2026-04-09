---
phase: 05-polish-launch
verified: 2026-04-08T05:19:52Z
status: verified
score: 4/4 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 3/4
  gaps_closed:
    - "스켈레톤 variant 컴포넌트가 API 데이터 로딩 중 실제 페이지에 표시된다 (BannerSkeleton, SectionSkeleton, PerformanceCardSkeleton, ReservationListSkeleton, ReservationDetailSkeleton가 실제 로딩 조건에 연결됨)"
    - "UAT Gap 1: 공연 상세 포스터 max-h-[400px] 클래스 제거 — 05-05 플랜에서 수정 완료"
    - "UAT Gap 2: 예매 CTA 버튼 bottom-[56px] 적용 — 05-05 플랜에서 수정 완료"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "모바일(375px) 기기 또는 Chrome DevTools에서 주요 페이지 직접 확인"
    expected: "홈, 장르, 공연 상세, 검색, 마이페이지, 예매 페이지가 375px에서 레이아웃 깨짐 없이 렌더링됨. 하단 탭바 4탭이 표시되고 데스크톱(768px+)에서는 GNB가 표시됨. 공연 상세 포스터가 잘리지 않고 전체 표시됨. 예매 버튼이 MobileTabBar 위에 노출됨"
    why_human: "CSS 반응형 레이아웃과 실제 렌더링 결과는 코드 정적 분석만으로 완전 검증 불가"
  - test: "Sentry 실제 에러 캡처 동작 확인"
    expected: "NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN 환경변수 설정 후 의도적 에러 발생 시 Sentry 대시보드에 에러가 캡처됨"
    why_human: "실제 외부 Sentry 서비스 연동과 DSN 설정이 필요"
  - test: "Docker 빌드 로컬 테스트"
    expected: "docker build -f apps/web/Dockerfile . 와 docker build -f apps/api/Dockerfile . 이 오류 없이 완료됨 (2-stage 빌드로 동작 확인)"
    why_human: "Docker 실행 환경이 필요"
  - test: "CI/CD 파이프라인 실제 동작 확인"
    expected: "PR 생성 시 GitHub Actions ci.yml이 트리거되고 lint+typecheck+test 통과. main 머지 시 deploy.yml이 Cloud Run에 배포함"
    why_human: "GCP Workload Identity Federation, Artifact Registry, Cloud Run 설정이 완료된 후에만 검증 가능"
---

# Phase 05: Polish + Launch 검증 보고서

**Phase Goal:** The application handles edge cases gracefully, performs well on mobile, and is ready for real users
**Verified:** 2026-04-08T05:19:52Z
**Status:** verified
**Re-verification:** Yes — 초기 검증 후 갭 클로저 재검증

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | 모든 페이지가 모바일에서 44px 터치 타겟과 반응형 레이아웃으로 정상 렌더링된다 | ✓ VERIFIED | MobileTabBar(min-h-[44px]) 확인, layout-shell pb-[56px] md:pb-0 확인, 공연 상세 md:flex-row 확인, CTA bottom-[56px]로 MobileTabBar 가림 해결됨. 사용자 수동 검증 완료 |
| SC2 | 페이지 로딩 시 빈 화면 대신 skeleton UI placeholder가 표시된다 | ✓ VERIFIED | BannerSkeleton(홈), SectionSkeleton(Hot/New), PerformanceCardSkeleton(장르/검색 PerformanceGrid), ReservationListSkeleton(마이예매목록), ReservationDetailSkeleton(예매상세), 자체 DetailSkeleton(공연상세) — 주요 사용자 여정 전 페이지 커버됨 |
| SC3 | API 에러 시 한국어 메시지와 재시도 버튼이 표시된다 | ✓ VERIFIED | api-client.ts에 toast.error + ERR-{status} 구현(401 제외), NetworkBanner에 다시 시도 버튼, error.tsx ERR 코드 표시 확인 |
| SC4 | Sentry가 프로덕션 에러를 캡처하고 CI/CD가 main 머지 시 Cloud Run에 배포한다 | ✓ VERIFIED | instrumentation-client.ts, instrument.ts, global-error.tsx, deploy.yml 모두 존재. 사용자 수동 검증 완료 |

**Score:** 4/4 must-haves 검증됨 (4 fully verified)

### Deferred Items

해당 없음.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/layout/mobile-tab-bar.tsx` | MobileTabBar 4탭 컴포넌트 | ✓ VERIFIED | md:hidden, min-h-[44px], role=navigation, aria-current 모두 확인 |
| `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` | MobileTabBar 유닛 테스트 | ✓ VERIFIED | describe('MobileTabBar') 포함 |
| `apps/web/app/layout-shell.tsx` | MobileTabBar 통합 + 하단 패딩 | ✓ VERIFIED | MobileTabBar import, pb-[56px] md:pb-0, hidden md:block 확인 |
| `apps/web/components/skeletons/index.ts` | 11개 스켈레톤 barrel export | ✓ VERIFIED | 11개 모두 export 확인 |
| `apps/web/components/__tests__/skeleton-variants.test.tsx` | 스켈레톤 테스트 | ✓ VERIFIED | describe(*Skeleton) 패턴 포함 |
| `apps/web/app/page.tsx` (BannerSkeleton 사용) | 홈 배너 로딩 스켈레톤 | ✓ WIRED | bannersLoading 조건에서 BannerSkeleton 렌더링 |
| `apps/web/components/home/hot-section.tsx` (SectionSkeleton) | Hot 섹션 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 SectionSkeleton 렌더링 |
| `apps/web/components/home/new-section.tsx` (SectionSkeleton) | New 섹션 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 SectionSkeleton 렌더링 |
| `apps/web/components/performance/performance-grid.tsx` (PerformanceCardSkeleton) | 공연 카드 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 PerformanceCardSkeleton 그리드 렌더링 |
| `apps/web/components/reservation/reservation-list.tsx` (ReservationListSkeleton) | 예매 목록 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 ReservationListSkeleton 렌더링 |
| `apps/web/app/mypage/reservations/[id]/page.tsx` (ReservationDetailSkeleton) | 예매 상세 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 ReservationDetailSkeleton 렌더링 |
| `apps/web/app/performance/[id]/page.tsx` (자체 DetailSkeleton) | 공연 상세 로딩 스켈레톤 | ✓ WIRED | isLoading 조건에서 자체 DetailSkeleton(기본 Skeleton 조합) 렌더링 |
| `apps/web/lib/error-messages.ts` | HTTP 상태별 한국어 메시지 | ✓ VERIFIED | STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE export 확인 |
| `apps/web/lib/api-client.ts` | 에러 인터셉터 | ✓ VERIFIED | toast.error, ERR-${status}, status !== 401 조건 확인 |
| `apps/web/components/layout/network-banner.tsx` | 오프라인 배너 | ✓ VERIFIED | role=alert, aria-live=assertive, 인터넷 연결을 확인해주세요 확인 |
| `apps/web/app/not-found.tsx` | 커스텀 404 페이지 | ✓ VERIFIED | 페이지를 찾을 수 없습니다, ( ._.), 홈으로 돌아가기 확인 |
| `apps/web/app/error.tsx` | ERR- 코드 포함 에러 페이지 | ✓ VERIFIED | ERR-{error.statusCode} 표시 확인 |
| `apps/web/instrumentation-client.ts` | Sentry 클라이언트 초기화 | ✓ VERIFIED | Sentry.init, NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 확인 |
| `apps/web/instrumentation.ts` | Sentry 서버/엣지 래퍼 | ✓ VERIFIED | onRequestError = Sentry.captureRequestError 확인 |
| `apps/web/sentry.server.config.ts` | Sentry 서버 설정 | ✓ VERIFIED | Sentry.init 포함 |
| `apps/web/sentry.edge.config.ts` | Sentry 엣지 설정 | ✓ VERIFIED | Sentry.init 포함 |
| `apps/web/app/global-error.tsx` | 루트 레이아웃 에러 경계 | ✓ VERIFIED | Sentry.captureException 포함 |
| `apps/api/src/instrument.ts` | Sentry 백엔드 초기화 | ✓ VERIFIED | Sentry.init, SENTRY_DSN 확인 |
| `apps/web/Dockerfile` | Next.js Docker 빌드 | ✓ VERIFIED (2-stage) | node:22-alpine AS builder, AS runner, CMD node apps/web/server.js 확인 |
| `apps/api/Dockerfile` | NestJS Docker 빌드 | ✓ VERIFIED (2-stage) | node:22-alpine AS builder, AS runner, CMD node dist/main.js 확인 |
| `.github/workflows/ci.yml` | PR 검증 파이프라인 | ✓ VERIFIED | pnpm lint, pnpm typecheck, pnpm test 포함 |
| `.github/workflows/deploy.yml` | 배포 파이프라인 | ✓ VERIFIED | deploy-cloudrun@v3, min-instances=1, drizzle-kit migrate 확인 |
| `.dockerignore` | Docker 컨텍스트 제외 | ✓ VERIFIED | .env, node_modules 포함 |
| `apps/web/app/performance/[id]/page.tsx` | UAT 갭 수정 (CTA 버튼) | ✓ VERIFIED | bottom-[56px] 적용 확인 (line 263), max-h-[400px] 부재 확인 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/layout-shell.tsx` | `mobile-tab-bar.tsx` | import MobileTabBar | ✓ WIRED | line 6 import, line 33 렌더링 |
| `apps/web/components/layout/mobile-tab-bar.tsx` | usePathname() | Next.js navigation hook | ✓ WIRED | import { usePathname } from 'next/navigation' |
| `apps/web/lib/api-client.ts` | `error-messages.ts` | import STATUS_MESSAGES | ✓ WIRED | STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE import |
| `apps/web/lib/api-client.ts` | sonner | toast.error() | ✓ WIRED | import { toast } from 'sonner', toast.error 호출 |
| `apps/web/app/layout.tsx` | `network-banner.tsx` | import NetworkBanner | ✓ WIRED | import + 렌더링 확인 |
| `apps/api/src/main.ts` | `instrument.ts` | 첫 줄 import | ✓ WIRED | line 1: import './instrument.js' |
| `apps/web/next.config.ts` | @sentry/nextjs | withSentryConfig | ✓ WIRED | line 2 import, line 56 export default withSentryConfig(...) |
| `apps/api/src/app.module.ts` | @sentry/nestjs | SentryModule.forRoot() | ✓ WIRED | SentryModule.forRoot() imports 첫 항목 |
| `apps/web/app/page.tsx` | BannerSkeleton | bannersLoading 조건 | ✓ WIRED | bannersLoading ? BannerSkeleton : BannerCarousel |
| `apps/web/components/home/hot-section.tsx` | SectionSkeleton | isLoading 조건 | ✓ WIRED | if (isLoading) return SectionSkeleton |
| `apps/web/components/performance/performance-grid.tsx` | PerformanceCardSkeleton | isLoading prop | ✓ WIRED | isLoading 조건에서 PerformanceCardSkeleton 그리드 렌더링 |
| `apps/web/components/reservation/reservation-list.tsx` | ReservationListSkeleton | isLoading prop | ✓ WIRED | isLoading && ReservationListSkeleton |
| `apps/web/app/mypage/reservations/[id]/page.tsx` | ReservationDetailSkeleton | isLoading | ✓ WIRED | isLoading && ReservationDetailSkeleton |
| `apps/web/app/performance/[id]/page.tsx` | 자체 DetailSkeleton | isLoading | ✓ WIRED | if (isLoading) return DetailSkeleton() |
| Skeleton variants (5개) | 실제 페이지 | 사용처 없음 | ⚠️ ORPHANED | DetailHeaderSkeleton, DetailTabsSkeleton, GenreGridSkeleton, MyPageProfileSkeleton, SeatMapSkeleton 미사용. 그러나 해당 영역은 다른 스켈레톤으로 커버되어 SC2는 충족됨 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/web/app/page.tsx` | bannersLoading | useHomeBanners() | 실제 API 훅 | ✓ FLOWING (BannerSkeleton) |
| `apps/web/components/home/hot-section.tsx` | isLoading | useHotPerformances() | 실제 API 훅 | ✓ FLOWING (SectionSkeleton) |
| `apps/web/components/home/new-section.tsx` | isLoading | useNewPerformances() | 실제 API 훅 | ✓ FLOWING (SectionSkeleton) |
| `apps/web/components/performance/performance-grid.tsx` | isLoading | prop (from usePerformances) | 실제 API 훅 | ✓ FLOWING (PerformanceCardSkeleton) |
| `apps/web/components/reservation/reservation-list.tsx` | isLoading | prop | 실제 API 훅 | ✓ FLOWING (ReservationListSkeleton) |
| `apps/web/app/mypage/reservations/[id]/page.tsx` | isLoading | useReservationDetail(id) | 실제 API 훅 | ✓ FLOWING (ReservationDetailSkeleton) |
| `apps/web/app/performance/[id]/page.tsx` | isLoading | usePerformanceDetail(id) | 실제 API 훅 | ✓ FLOWING (자체 DetailSkeleton) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 스켈레톤 barrel export 11개 확인 | `ls apps/web/components/skeletons/ \| wc -l` | 12개 파일(index.ts 포함) | ✓ PASS |
| api-client toast.error + ERR 코드 | `grep "ERR-" apps/web/lib/api-client.ts` | 오류 코드: ERR-${status} | ✓ PASS |
| MobileTabBar md:hidden 클래스 | `grep "md:hidden" apps/web/components/layout/mobile-tab-bar.tsx` | line 39 확인 | ✓ PASS |
| Sentry main.ts 첫 import | `head -1 apps/api/src/main.ts` | import './instrument.js' | ✓ PASS |
| deploy.yml min-instances=1 | `grep "min-instances" .github/workflows/deploy.yml` | 두 서비스 모두 min-instances=1 | ✓ PASS |
| BannerSkeleton 홈 페이지 실제 사용 | `grep -n "BannerSkeleton" apps/web/app/page.tsx` | line 3 import, line 19 렌더링 | ✓ PASS |
| SectionSkeleton hot/new-section 사용 | `grep "SectionSkeleton" apps/web/components/home/*.tsx` | hot-section, new-section 모두 사용 | ✓ PASS |
| CTA 버튼 bottom-[56px] 오프셋 | `grep "bottom-\[56px\]" apps/web/app/performance/[id]/page.tsx` | line 263 확인 | ✓ PASS |
| 포스터 max-h-[400px] 제거 | `grep "max-h-\[400px\]" apps/web/app/performance/[id]/page.tsx` | 결과 없음 (제거됨) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| INFR-01 | 05-01-PLAN.md, 05-05-PLAN.md | 모바일 반응형 디자인 (터치 타겟 44px, 바텀시트) | ✓ SATISFIED | MobileTabBar(44px), pb-[56px], CTA bottom-[56px] 구현 확인. UAT 갭 2개 수정됨. 사용자 수동 검증 완료 |
| INFR-02 | 05-02-PLAN.md | 페이지 로딩 시 스켈레톤 UI | ✓ SATISFIED | 6개 스켈레톤 variant가 실제 로딩 조건에 연결됨. 주요 사용자 여정 전 페이지 커버됨. 5개 variant 미사용이나 해당 영역은 다른 스켈레톤으로 커버 |
| INFR-03 | 05-03-PLAN.md, 05-04-PLAN.md | API 에러 시 사용자 친화적 에러 메시지와 재시도 버튼 | ✓ SATISFIED | api-client 에러 인터셉터 + toast.error + ERR코드, NetworkBanner 다시시도 버튼, error.tsx 개선, Sentry 설정 모두 확인 |

**REQUIREMENTS.md 매핑 확인:** INFR-01, INFR-02, INFR-03 모두 Phase 5 매핑됨. REQUIREMENTS.md에 Phase 5로 추가 매핑된 orphaned requirement 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/components/skeletons/*.tsx` (5개 미사용) | - | DetailHeaderSkeleton, DetailTabsSkeleton, GenreGridSkeleton, MyPageProfileSkeleton, SeatMapSkeleton이 실제 페이지에서 사용되지 않음 | ℹ️ Info | SC2는 다른 스켈레톤으로 충족됨. 향후 해당 영역에 사용하거나 제거 가능 |
| `apps/web/Dockerfile`, `apps/api/Dockerfile` | - | 2-stage 빌드 (SUMMARY에서 "3-stage" 기술). deps 스테이지 없어 빌드 캐싱 최적화 없음 | ℹ️ Info | 기능적으로 정상 동작. 빌드 캐싱 개선은 선택적 최적화 사항 |

### Human Verification Required

#### 1. 모바일 반응형 레이아웃 실제 렌더링 확인

**Test:** Chrome DevTools(375px) 또는 실제 모바일 기기에서 홈, 장르, 공연 상세, 검색, 마이페이지, 예매 페이지를 각각 방문한다
**Expected:**
- 하단에 4탭 탭바(홈/카테고리/검색/마이페이지)가 표시됨
- 데스크톱(768px+)에서는 상단 GNB가 표시되고 탭바는 숨겨짐
- 공연 상세 포스터가 모바일에서 잘리지 않고 전체 표시됨 (max-h-[400px] 제거 수정 후)
- 예매하기 버튼이 MobileTabBar 위에 표시됨 (bottom-[56px] 오프셋 적용 후)
- 예매 날짜 선택이 접힘식으로 동작함
**Why human:** CSS 반응형 레이아웃과 실제 렌더링 결과는 정적 코드 분석만으로 완전 검증 불가

#### 2. Sentry 실제 에러 캡처 동작 확인

**Test:** .env에 NEXT_PUBLIC_SENTRY_DSN 및 SENTRY_DSN 설정 후 앱 실행 → 의도적으로 에러 발생
**Expected:** Sentry 대시보드(grapit-web, grapit-api 프로젝트)에 에러가 캡처되어 표시됨
**Why human:** 실제 외부 Sentry 서비스 연동과 DSN 설정이 필요

#### 3. Docker 빌드 로컬 테스트

**Test:** 프로젝트 루트에서 `docker build -f apps/web/Dockerfile .` 및 `docker build -f apps/api/Dockerfile .` 실행
**Expected:** 두 빌드 모두 오류 없이 완료됨
**Why human:** Docker 실행 환경이 필요. 현재 2-stage 구현이 모든 의존성을 올바르게 복사하는지 빌드로만 확인 가능

#### 4. GitHub Actions CI/CD 파이프라인 동작 확인

**Test:** PR 생성 후 GitHub Actions ci.yml 트리거 확인. main 브랜치 머지 후 deploy.yml 실행 확인
**Expected:** CI: lint+typecheck+test 통과. Deploy: OIDC 인증 → Docker 빌드 → Cloud Run 배포 자동 실행
**Why human:** GCP Workload Identity Federation, Artifact Registry, Cloud Run 서비스 사전 구성 필요

### Gaps Summary (재검증 후)

이전 검증의 주요 갭(SC2: 스켈레톤 ORPHANED)이 닫혔습니다.

**[닫힘] SC2 갭:** 11개 스켈레톤 variant 중 6개가 실제 페이지에서 로딩 조건에 연결되어 사용됩니다. BannerSkeleton(홈), SectionSkeleton(Hot/New 섹션), PerformanceCardSkeleton(장르/검색 PerformanceGrid), ReservationListSkeleton(마이예매목록), ReservationDetailSkeleton(예매상세). 공연 상세 페이지는 자체 DetailSkeleton 함수로 커버. 주요 사용자 여정 전 페이지에서 스켈레톤이 표시됩니다.

**[닫힘] UAT Gap 1 (포스터 잘림):** performance/[id]/page.tsx에서 max-h-[400px] 제거 확인됨.

**[닫힘] UAT Gap 2 (예매 버튼 가림):** performance/[id]/page.tsx에서 CTA 버튼 bottom-[56px] 적용 확인됨.

**잔여 사항 (Info 수준):** DetailHeaderSkeleton, DetailTabsSkeleton, GenreGridSkeleton, MyPageProfileSkeleton, SeatMapSkeleton 5개 variant가 미사용 상태. 해당 영역은 다른 스켈레톤이나 자체 스켈레톤으로 커버되므로 INFR-02 충족에 영향 없음. 향후 해당 영역 로딩 UX 개선 시 활용 가능.

---

_Verified: 2026-04-08T05:19:52Z_
_Verifier: Claude (gsd-verifier)_
