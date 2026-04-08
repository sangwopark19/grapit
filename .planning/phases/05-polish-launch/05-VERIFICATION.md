---
phase: 05-polish-launch
verified: 2026-04-08T02:30:00Z
status: human_needed
score: 3/4 must-haves verified
gaps:
  - truth: "스켈레톤 variant 컴포넌트가 API 데이터 로딩 중 실제 페이지에 표시된다"
    status: partial
    reason: "11개 스켈레톤 variant가 생성되었으나 실제 페이지/컴포넌트에서 한 곳도 사용되지 않음. 테스트 파일에서만 임포트됨. 홈 페이지는 BannerSkeleton 대신 기본 Skeleton 원시 컴포넌트를 직접 사용. ROADMAP SC2 '빈 화면이나 레이아웃 시프트 대신 skeleton UI placeholder'는 부분적으로만 충족."
    artifacts:
      - path: "apps/web/components/skeletons/banner-skeleton.tsx"
        issue: "ORPHANED — 생성은 되었으나 실제 페이지에서 사용되지 않음"
      - path: "apps/web/components/skeletons/performance-card-skeleton.tsx"
        issue: "ORPHANED — 생성은 되었으나 실제 페이지에서 사용되지 않음"
      - path: "apps/web/components/skeletons/genre-grid-skeleton.tsx"
        issue: "ORPHANED — 생성은 되었으나 실제 페이지에서 사용되지 않음"
      - path: "apps/web/components/skeletons/section-skeleton.tsx"
        issue: "ORPHANED — 생성은 되었으나 실제 페이지에서 사용되지 않음"
    missing:
      - "각 페이지/컴포넌트에서 로딩 상태 시 대응하는 variant 스켈레톤을 사용해야 함 (홈: BannerSkeleton+SectionSkeleton, 공연 상세: DetailHeaderSkeleton+DetailTabsSkeleton, 검색: SearchResultsSkeleton, 마이페이지: ReservationListSkeleton+MyPageProfileSkeleton, 예매: SeatMapSkeleton)"
human_verification:
  - test: "모바일(375px) 기기 또는 Chrome DevTools에서 주요 페이지 직접 확인"
    expected: "홈, 장르, 공연 상세, 검색, 마이페이지, 예매 페이지가 375px에서 레이아웃 깨짐 없이 렌더링됨. 하단 탭바 4탭이 표시되고 데스크톱(768px+)에서는 GNB가 표시됨"
    why_human: "CSS 반응형 레이아웃과 실제 렌더링 결과는 코드 정적 분석만으로 완전 검증 불가"
  - test: "Sentry 실제 에러 캡처 동작 확인"
    expected: "NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN 환경변수 설정 후 의도적 에러 발생 시 Sentry 대시보드에 에러가 캡처됨"
    why_human: "Sentry DSN이 설정되지 않은 상태이므로 자동 검증 불가. 실제 외부 서비스 연동 필요"
  - test: "Docker 빌드 로컬 테스트"
    expected: "docker build -f apps/web/Dockerfile . 와 docker build -f apps/api/Dockerfile . 이 오류 없이 완료됨"
    why_human: "Docker 빌드는 컨테이너 실행 환경 필요, 자동 정적 검증 불가"
  - test: "CI/CD 파이프라인 실제 동작 확인"
    expected: "PR 생성 시 GitHub Actions ci.yml이 트리거되고 lint+typecheck+test 통과. main 머지 시 deploy.yml이 Cloud Run에 배포함"
    why_human: "GCP Workload Identity Federation, Artifact Registry, Cloud Run 설정이 완료된 후에만 검증 가능"
---

# Phase 05: Polish + Launch 검증 보고서

**Phase Goal:** The application handles edge cases gracefully, performs well on mobile, and is ready for real users
**Verified:** 2026-04-08T02:30:00Z
**Status:** human_needed
**Re-verification:** No — 초기 검증

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | 모든 페이지가 모바일에서 44px 터치 타겟과 반응형 레이아웃으로 정상 렌더링된다 | ? HUMAN | MobileTabBar(min-h-[44px]) 존재, layout-shell에 pb-[56px] md:pb-0 확인. 공연 상세 md:flex-row 확인. 실제 렌더링은 인간 검증 필요 |
| SC2 | 페이지 로딩 시 빈 화면 대신 skeleton UI placeholder가 표시된다 | ✗ FAILED | 11개 variant 스켈레톤 생성되었으나 실제 페이지에서 ORPHANED. 홈 페이지는 기본 Skeleton 원시 컴포넌트 직접 사용 |
| SC3 | API 에러 시 한국어 메시지와 재시도 버튼이 표시된다 | ✓ VERIFIED | api-client.ts에 toast.error + ERR-{status} 구현. NetworkBanner에 다시 시도 버튼. 401 제외 처리 확인 |
| SC4 | Sentry가 프로덕션 에러를 캡처하고 CI/CD가 main 머지 시 Cloud Run에 배포한다 | ? HUMAN | 설정 파일 모두 존재. 실제 Sentry DSN 미설정, GCP 미구성 — 인간 검증 필요 |

**Score:** 1/4 완전 검증 (1 failed, 2 human_needed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/layout/mobile-tab-bar.tsx` | MobileTabBar 4탭 컴포넌트 | ✓ VERIFIED | export function MobileTabBar, md:hidden, min-h-[44px], role=navigation, aria-current 모두 확인 |
| `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` | MobileTabBar 유닛 테스트 | ✓ VERIFIED | describe('MobileTabBar') 포함, 8개 테스트 케이스 |
| `apps/web/app/layout-shell.tsx` | MobileTabBar 통합 + 하단 패딩 | ✓ VERIFIED | MobileTabBar import, pb-[56px] md:pb-0, hidden md:block 확인 |
| `apps/web/components/skeletons/index.ts` | 11개 스켈레톤 barrel export | ✓ VERIFIED | 11개 모두 export 확인 |
| `apps/web/components/__tests__/skeleton-variants.test.tsx` | 스켈레톤 테스트 | ✓ VERIFIED | describe(*Skeleton) 패턴 포함 |
| `apps/web/lib/error-messages.ts` | HTTP 상태별 한국어 메시지 | ✓ VERIFIED | STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE export, 400/403/404/408/429 포함 |
| `apps/web/lib/api-client.ts` | 에러 인터셉터 | ✓ VERIFIED | toast.error, ERR-{status}, duration:5000, status !== 401 조건 확인 |
| `apps/web/components/layout/network-banner.tsx` | 오프라인 배너 | ✓ VERIFIED | export function NetworkBanner, role=alert, aria-live=assertive, 인터넷 연결을 확인해주세요 |
| `apps/web/app/not-found.tsx` | 커스텀 404 페이지 | ✓ VERIFIED | 페이지를 찾을 수 없습니다, ( ._.), 홈으로 돌아가기, href="/" |
| `apps/web/app/error.tsx` | ERR- 코드 포함 에러 페이지 | ✓ VERIFIED | ERR-{error.statusCode} 표시, ApiClientError instanceof 분기 |
| `apps/web/instrumentation-client.ts` | Sentry 클라이언트 초기화 | ✓ VERIFIED | Sentry.init, NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 |
| `apps/web/instrumentation.ts` | Sentry 서버/엣지 래퍼 | ✓ VERIFIED | onRequestError = Sentry.captureRequestError |
| `apps/web/sentry.server.config.ts` | Sentry 서버 설정 | ✓ VERIFIED | Sentry.init 포함 |
| `apps/web/sentry.edge.config.ts` | Sentry 엣지 설정 | ✓ VERIFIED | Sentry.init 포함 |
| `apps/web/app/global-error.tsx` | 루트 레이아웃 에러 경계 | ✓ VERIFIED | Sentry.captureException 포함 |
| `apps/api/src/instrument.ts` | Sentry 백엔드 초기화 | ✓ VERIFIED | Sentry.init, SENTRY_DSN |
| `apps/web/Dockerfile` | Next.js Docker 빌드 | ✓ VERIFIED (2-stage) | node:22-alpine, server.js CMD 확인. SUMMARY에서 3-stage 주장하나 실제 2-stage |
| `apps/api/Dockerfile` | NestJS Docker 빌드 | ✓ VERIFIED (2-stage) | node:22-alpine, dist/main.js CMD 확인. 실제 2-stage |
| `.github/workflows/ci.yml` | PR 검증 파이프라인 | ✓ VERIFIED | pnpm lint, pnpm typecheck, pnpm test 모두 포함 |
| `.github/workflows/deploy.yml` | 배포 파이프라인 | ✓ VERIFIED | google-github-actions/auth@v3, deploy-cloudrun@v3, min-instances=1, drizzle-kit migrate |
| `.dockerignore` | Docker 컨텍스트 제외 | ✓ VERIFIED | .env, node_modules 포함 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/layout-shell.tsx` | `mobile-tab-bar.tsx` | import MobileTabBar | ✓ WIRED | line 6: import { MobileTabBar } from '@/components/layout/mobile-tab-bar' |
| `apps/web/components/layout/mobile-tab-bar.tsx` | usePathname() | Next.js navigation hook | ✓ WIRED | line 4: import { usePathname } from 'next/navigation' |
| `apps/web/lib/api-client.ts` | `error-messages.ts` | import STATUS_MESSAGES | ✓ WIRED | lines 3-6: import { STATUS_MESSAGES, DEFAULT_ERROR_MESSAGE } from './error-messages' |
| `apps/web/lib/api-client.ts` | sonner | toast.error() | ✓ WIRED | line 1: import { toast } from 'sonner', line 119: toast.error(errorMessage) |
| `apps/web/app/layout.tsx` | `network-banner.tsx` | import NetworkBanner | ✓ WIRED | line 5: import { NetworkBanner }, line 25: 렌더링됨 |
| `apps/api/src/main.ts` | `instrument.ts` | 첫 줄 import | ✓ WIRED | line 1: import './instrument.js' |
| `apps/web/next.config.ts` | @sentry/nextjs | withSentryConfig | ✓ WIRED | line 2: import, line 56: export default withSentryConfig(...) |
| `apps/api/src/app.module.ts` | @sentry/nestjs | SentryModule.forRoot() | ✓ WIRED | line 5 import, line 23 SentryModule.forRoot() 첫 번째 imports 항목 |
| Skeleton variants | 실제 페이지 | 페이지에서 import | ✗ NOT WIRED | 11개 스켈레톤 variant가 테스트 외에 어느 페이지에서도 임포트/사용되지 않음 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apps/web/app/page.tsx` (BannerSkeleton 대신 기본 Skeleton 사용) | bannersLoading | useHomeBanners() | 실제 API 훅 | ✓ FLOWING (기본 Skeleton으로) |
| `apps/web/components/skeletons/*.tsx` (11개 variant) | N/A (정적 UI) | 사용처 없음 | N/A | ✗ HOLLOW_PROP — 생성됐으나 페이지에서 렌더링 경로 없음 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 스켈레톤 barrel export 11개 확인 | `ls apps/web/components/skeletons/ \| wc -l` | 12개 파일(index.ts 포함) | ✓ PASS |
| api-client.ts toast.error + ERR 코드 | `grep "ERR-" apps/web/lib/api-client.ts` | line 120: 오류 코드: ERR-${status} | ✓ PASS |
| MobileTabBar md:hidden 클래스 | `grep "md:hidden" apps/web/components/layout/mobile-tab-bar.tsx` | line 39 확인 | ✓ PASS |
| Sentry main.ts 첫 import | `head -1 apps/api/src/main.ts` | import './instrument.js' | ✓ PASS |
| deploy.yml min-instances=1 | `grep "min-instances" .github/workflows/deploy.yml` | 두 서비스 모두 min-instances=1 | ✓ PASS |
| 스켈레톤 variant 실제 페이지 사용 | `grep -r "from.*skeletons" apps/web/app/` | 결과 없음 | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| INFR-01 | 05-01-PLAN.md | 모바일 반응형 디자인 (터치 타겟 44px, 바텀시트) | ? NEEDS HUMAN | MobileTabBar(44px) 구현 확인. 실제 렌더링은 인간 검증 필요 |
| INFR-02 | 05-02-PLAN.md | 페이지 로딩 시 스켈레톤 UI | ✗ BLOCKED | 스켈레톤 variant가 ORPHANED — 실제 페이지 로딩에 적용되지 않음 |
| INFR-03 | 05-03-PLAN.md, 05-04-PLAN.md | API 에러 시 사용자 친화적 에러 메시지와 재시도 버튼 | ✓ SATISFIED | api-client 에러 인터셉터, NetworkBanner 다시시도 버튼, error.tsx 개선 모두 확인 |

**REQUIREMENTS.md 매핑 확인:** INFR-01, INFR-02, INFR-03 모두 Phase 5 매핑됨. REQUIREMENTS.md에 Phase 5로 추가 매핑된 orphaned requirement 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/components/skeletons/*.tsx` (11개) | - | 컴포넌트 존재하나 어느 페이지에도 사용되지 않음 (ORPHANED) | ⚠️ Warning | INFR-02 요구사항 미충족. 생성만 되고 연결되지 않아 실제 로딩 UX 개선 효과 없음 |
| `apps/web/Dockerfile` | - | SUMMARY에서 "3-stage" 주장하나 실제 2-stage 구현 | ℹ️ Info | deps 분리 스테이지 없음. 기능적으로는 동작하나 빌드 캐싱 효율 낮음 |
| `apps/api/Dockerfile` | - | SUMMARY에서 "3-stage" 주장하나 실제 2-stage 구현 | ℹ️ Info | 동일 |

### Human Verification Required

#### 1. 모바일 반응형 레이아웃 실제 렌더링 확인

**Test:** Chrome DevTools 또는 실제 모바일 기기(375px)에서 홈, 장르, 공연 상세, 검색, 마이페이지, 예매 페이지를 각각 방문한다
**Expected:**
- 하단에 4탭 탭바(홈/카테고리/검색/마이페이지)가 표시됨
- 데스크톱(768px+)에서는 상단 GNB가 표시되고 탭바는 숨겨짐
- 공연 상세 포스터가 모바일에서 전체 폭으로 표시됨
- 예매 날짜 선택이 접힘식으로 동작함
- 모든 버튼/링크가 44px 이상 터치 타겟을 가짐
**Why human:** CSS 반응형 레이아웃과 실제 렌더링 결과는 정적 코드 분석만으로 완전 검증 불가

#### 2. Sentry 실제 에러 캡처 동작 확인

**Test:** .env에 NEXT_PUBLIC_SENTRY_DSN 및 SENTRY_DSN 설정 후 앱 실행 → 의도적으로 에러 발생 (존재하지 않는 URL 접근 또는 개발자 도구에서 네트워크 오류 강제)
**Expected:** Sentry 대시보드(프로젝트 grapit-web, grapit-api)에 에러가 캡처되어 표시됨
**Why human:** 실제 외부 Sentry 서비스 연동과 DSN 설정이 필요

#### 3. Docker 빌드 로컬 테스트

**Test:** 프로젝트 루트에서 `docker build -f apps/web/Dockerfile .` 및 `docker build -f apps/api/Dockerfile .` 실행
**Expected:** 두 빌드 모두 오류 없이 완료되고, 실행 가능한 이미지가 생성됨
**Why human:** Docker 실행 환경이 필요. Dockerfile이 2-stage(계획상 3-stage)로 구현된 점도 의도적 변경인지 승인 필요

#### 4. GitHub Actions CI/CD 파이프라인 동작 확인

**Test:** PR 생성 후 GitHub Actions ci.yml 트리거 확인. main 브랜치 머지 후 deploy.yml 실행 확인
**Expected:** CI: lint+typecheck+test 통과. Deploy: OIDC 인증 → Docker 빌드 → Cloud Run 배포 자동 실행
**Why human:** GCP Workload Identity Federation, Artifact Registry, Cloud Run 서비스 사전 구성 필요

### Gaps Summary

**주요 갭: 스켈레톤 variant ORPHANED (SC2 실패)**

11개 스켈레톤 variant 컴포넌트 (BannerSkeleton, PerformanceCardSkeleton, GenreGridSkeleton 등)가 `apps/web/components/skeletons/` 디렉토리에 정상적으로 생성되었고 barrel export도 완비되었습니다. 그러나 실제 페이지나 컴포넌트에서 단 한 곳도 사용되지 않습니다. 테스트 파일에서만 임포트됩니다.

홈 페이지(`apps/web/app/page.tsx`)는 `BannerSkeleton` 대신 기본 `Skeleton` 원시 컴포넌트를 직접 사용하고, 장르 페이지, 검색 페이지, 공연 상세 페이지는 스켈레톤이 전혀 없습니다.

ROADMAP 성공 기준 2 "Page loads show skeleton UI placeholders instead of blank screens or layout shifts"는 충족되지 않았습니다.

**보조 갭: Dockerfile 스테이지 불일치**

SUMMARY에서는 "3-stage multi-stage build (deps -> builder -> runner)"라고 명시하나 실제 구현은 2-stage (builder -> runner)입니다. deps 스테이지 분리로 얻는 빌드 캐싱 최적화 효과가 없습니다. 기능적으로는 동작하나 계획 명세와 다릅니다.

---

_Verified: 2026-04-08T02:30:00Z_
_Verifier: Claude (gsd-verifier)_
