# Phase 5: Polish + Launch - Research

**Researched:** 2026-04-07
**Domain:** Mobile Responsive / Skeleton UI / Error Handling / CI/CD + Cloud Run Deployment / Sentry Observability
**Confidence:** HIGH

## Summary

Phase 5는 기존 구현체를 프로덕션 수준으로 끌어올리는 단계이다. 4개 도메인이 있다: (1) 모바일 반응형 (GNB -> 하단 탭바, 전체 공개 페이지 반응형 대응), (2) 스켈레톤 UI (컴포넌트별 세분화된 로딩 상태), (3) 에러 처리 UX (API 에러 인터셉터, 에러 코드 시스템, 네트워크 배너, 404 페이지), (4) 프로덕션 인프라 (Sentry 에러 추적, GitHub Actions CI/CD, Docker 멀티스테이지, Cloud Run 배포).

코드베이스에는 이미 `Skeleton` 컴포넌트가 18개 파일에서 사용 중이고, `error.tsx` 글로벌 에러 페이지가 존재하며, `sonner` 토스트가 설정되어 있다. GNB는 `md:` 브레이크포인트로 데스크톱/모바일 분기가 이미 구현되어 있다. 반면 Dockerfile, GitHub Actions workflow, Sentry 설정 파일, `not-found.tsx`는 아직 없다. `output: 'standalone'`은 이미 next.config.ts에 설정되어 있으나, `outputFileTracingRoot`는 설정되어 있지 않다.

**Primary recommendation:** 4개 도메인을 순차적으로 구현하되, 프론트엔드 UX (반응형 + 스켈레톤 + 에러 처리)를 먼저 완료한 후 인프라 (Sentry + CI/CD + Docker + Cloud Run)를 구축한다. 프론트엔드 UX는 기존 코드 수정이 주이므로 병렬화 가능하고, 인프라는 순서 의존성이 있다 (Sentry -> Docker -> GitHub Actions -> Cloud Run).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 모든 공개 페이지를 동시에 모바일 반응형 대응. Admin은 데스크톱 전용으로 유지
- **D-02:** 모바일에서 복잡한 테이블(예매 내역, 검색 결과 등)은 카드형 리스트로 변환
- **D-03:** GNB를 모바일에서 하단 탭바로 교체. 4탭: 홈 / 카테고리 / 검색 / 마이페이지
- **D-04:** 모든 터치 타겟 최소 44px 엄격 적용 (WCAG 기준)
- **D-05:** 공연 상세 페이지 모바일: 포스터를 상단 전체 폭으로 표시
- **D-06:** 예매 플로우 날짜/회차 선택: 모바일에서 상단 접힘식으로 배치
- **D-07:** API 데이터 페치 영역에만 스켈레톤 적용
- **D-08:** 컴포넌트별 스켈레톤 세분화
- **D-09:** shadcn Skeleton 기본 Pulse 애니메이션 유지
- **D-10:** API 에러는 sonner 토스트로 표시, 폼 유효성 에러는 필드 인라인, 모두 한국어
- **D-11:** 네트워크 오프라인/타임아웃 시 화면 상단 전체 폭 배너 표시
- **D-12:** 에러 메시지에 에러 코드 포함 (ERR-{HTTP_STATUS})
- **D-13:** 404 페이지: "( ._.)" + "페이지를 찾을 수 없습니다" + 홈으로 버튼
- **D-14:** Sentry 프론트엔드(@sentry/nextjs) + 백엔드(@sentry/nestjs) 모두 설정
- **D-15:** GitHub Actions 풀 파이프라인: PR시 lint+typecheck+test -> main merge시 Docker -> Cloud Run
- **D-16:** Cloud Run web + api 별도 서비스로 배포
- **D-17:** DB 마이그레이션은 CI/CD에서 자동 실행
- **D-18:** Cloud Run min-instances=1
- **D-19:** Dockerfile 멀티스테이지 빌드
- **D-20:** 환경변수는 GCP Secret Manager로 관리

### Claude's Discretion
- 하단 탭바 아이콘 및 애니메이션 디자인
- 스켈레톤 컴포넌트별 레이아웃 세부 형태
- 에러 코드 체계 (ERR-xxx 네이밍/범위)
- 404 일러스트 구체적 디자인
- Sentry 샘플링 레이트 설정
- GitHub Actions workflow 파일 구조
- Dockerfile 최적화 세부사항
- Cloud Run 서비스 리소스 설정
- GCP Secret Manager 시크릿 구조

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | 모바일 반응형 디자인이 적용된다 (터치 타겟 44px, 바텀시트 등) | MobileTabBar 컴포넌트 신규 생성, 전체 공개 페이지 브레이크포인트 대응, LayoutShell 모바일 분기 |
| INFR-02 | 페이지 로딩 시 스켈레톤 UI가 표시된다 | 기존 Skeleton 컴포넌트 활용, 11개 컴포넌트별 스켈레톤 variant 추가, React Query isLoading 패턴 |
| INFR-03 | API 에러 시 사용자 친화적 에러 메시지와 재시도 버튼이 표시된다 | api-client.ts 에러 인터셉터 확장, NetworkBanner 신규 생성, not-found.tsx 신규 생성, error.tsx 개선 |
</phase_requirements>

## Standard Stack

### Core (이미 설치됨)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^16.2.0 | SSR 프레임워크 | 이미 설치됨, `output: 'standalone'` 설정 완료 [VERIFIED: apps/web/package.json] |
| Tailwind CSS | ^4.2.0 | 유틸리티 CSS | 반응형 브레이크포인트 `sm:`, `md:`, `lg:` 이미 30+ 컴포넌트에서 사용 [VERIFIED: codebase scan] |
| shadcn/ui | new-york | UI 컴포넌트 | Skeleton, Sheet, Sonner 등 이미 설치 [VERIFIED: apps/web/components.json] |
| sonner | ^2.0.7 | 토스트 알림 | 에러/성공 토스트에 사용 중, top-center 위치 [VERIFIED: apps/web/components/ui/sonner.tsx] |
| lucide-react | ^1.7.0 | 아이콘 | 하단 탭바 아이콘에 사용 (Home, LayoutGrid, Search, User) [VERIFIED: package.json] |

### 신규 설치 필요
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sentry/nextjs | 10.47.0 | Next.js 에러 추적 + 성능 모니터링 | 프론트엔드 에러 캡처, 소스맵 업로드 [VERIFIED: npm registry] |
| @sentry/nestjs | 10.47.0 | NestJS 에러 추적 | 백엔드 에러 캡처, 트랜잭션 추적 [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @sentry/nextjs | Bugsnag, Datadog RUM | Sentry는 무료 티어로 충분하고, Next.js 공식 통합이 가장 성숙함 |
| sonner | react-hot-toast | sonner가 이미 설치되어 있고 richColors 지원이 더 나음 |
| navigator.onLine | Service Worker offline detection | navigator.onLine은 단순하고 충분함, SW는 이 단계에서 과한 복잡도 |

**Installation:**
```bash
# Frontend (apps/web)
pnpm --filter @grapit/web add @sentry/nextjs@^10.47.0

# Backend (apps/api)
pnpm --filter @grapit/api add @sentry/nestjs@^10.47.0
```

## Architecture Patterns

### 프론트엔드 신규 파일 구조
```
apps/web/
├── instrumentation-client.ts        # Sentry 클라이언트 초기화
├── instrumentation.ts               # Sentry 서버/엣지 초기화 래퍼
├── sentry.server.config.ts          # Sentry 서버 설정
├── sentry.edge.config.ts            # Sentry 엣지 설정
├── app/
│   ├── global-error.tsx             # Sentry 에러 바운더리 (root layout 에러)
│   ├── not-found.tsx                # 404 페이지 (신규)
│   └── error.tsx                    # 글로벌 에러 페이지 (개선: 에러 코드 추가)
├── components/
│   └── layout/
│       ├── gnb.tsx                  # 수정: md 이상에서만 표시
│       ├── mobile-tab-bar.tsx       # 신규: 모바일 하단 탭바
│       ├── network-banner.tsx       # 신규: 오프라인/타임아웃 배너
│       └── layout-shell.tsx         # 수정: MobileTabBar 추가, 조건부 표시 로직
└── lib/
    ├── api-client.ts                # 수정: 에러 인터셉터 확장, 에러 코드 포함
    └── error-messages.ts            # 신규: HTTP 상태별 한국어 에러 메시지 매핑
```

### 백엔드 신규 파일 구조
```
apps/api/src/
├── instrument.ts                    # Sentry 초기화 (main.ts보다 먼저 import)
├── main.ts                          # 수정: instrument.ts import 추가
└── app.module.ts                    # 수정: SentryModule.forRoot() 추가
```

### 인프라 신규 파일 구조
```
(project root)
├── apps/web/Dockerfile              # Next.js standalone 멀티스테이지 빌드
├── apps/api/Dockerfile              # NestJS 멀티스테이지 빌드
├── .github/
│   └── workflows/
│       ├── ci.yml                   # PR: lint + typecheck + test
│       └── deploy.yml               # main merge: Docker 빌드 -> Cloud Run 배포
└── .dockerignore                    # Docker 빌드 최적화
```

### Pattern 1: MobileTabBar + LayoutShell 통합
**What:** 기존 LayoutShell에 MobileTabBar를 추가하고, GNB의 모바일 표시를 제어한다.
**When to use:** 모든 공개 페이지에서 모바일/데스크톱 레이아웃 분기.
**Example:**
```typescript
// Source: CONTEXT.md D-03, 기존 layout-shell.tsx 패턴
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const isBookingCheckout =
    pathname.startsWith('/booking') && !pathname.endsWith('/complete');
  const hideShell = isAdmin || isBookingCheckout;

  return (
    <>
      {/* 데스크톱 GNB: md 이상에서만 표시 */}
      {!hideShell && <GNB />}
      {/* 본문: 모바일 탭바 높이만큼 하단 패딩 */}
      <div className={cn('flex flex-1 flex-col', !hideShell && 'md:pb-0 pb-[56px]')}>
        {children}
      </div>
      {/* 모바일 하단 탭바: md 미만에서만 표시 */}
      {!hideShell && <MobileTabBar />}
      {!hideShell && <Footer />}
    </>
  );
}
```
[VERIFIED: apps/web/app/layout-shell.tsx 기존 패턴 확인]

### Pattern 2: API 에러 인터셉터 + 에러 코드 시스템
**What:** api-client.ts의 request() 함수에서 HTTP 에러를 분류하고, sonner 토스트로 사용자 친화적 메시지를 표시한다.
**When to use:** 모든 API 호출에서 자동 적용.
**Example:**
```typescript
// Source: CONTEXT.md D-10, D-12, 기존 api-client.ts 패턴
import { toast } from 'sonner';

const ERROR_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  403: '접근 권한이 없습니다.',
  404: '요청하신 정보를 찾을 수 없습니다.',
  408: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

// throw 전에 토스트 표시
toast.error(errorMessage, {
  description: `오류 코드: ERR-${status}`,
  duration: 5000,
});
```
[VERIFIED: apps/web/lib/api-client.ts 기존 구조 확인, sonner API 확인]

### Pattern 3: Sentry Next.js 통합
**What:** `withSentryConfig`으로 next.config.ts를 래핑하고, 4개 파일로 클라이언트/서버/엣지 초기화한다.
**When to use:** 프로덕션 에러 추적 및 소스맵 업로드.
**Example:**
```typescript
// instrumentation-client.ts
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,       // 프로덕션에서 10% 샘플링
  replaysSessionSampleRate: 0,  // 리플레이 비활성화 (무료 티어 할당량 보존)
  replaysOnErrorSampleRate: 1.0, // 에러 시에만 리플레이
});
```
[CITED: docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/]

### Pattern 4: Sentry NestJS 통합
**What:** `instrument.ts`를 main.ts에서 가장 먼저 import하고, SentryModule을 AppModule에 추가한다.
**When to use:** 백엔드 에러 추적.
**Example:**
```typescript
// apps/api/src/instrument.ts
// Source: https://docs.sentry.io/platforms/javascript/guides/nestjs/
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

// apps/api/src/main.ts -- 첫 줄에 import
import './instrument.js';
// ... (나머지 기존 코드)

// apps/api/src/app.module.ts
import { SentryModule } from '@sentry/nestjs/setup';
@Module({
  imports: [SentryModule.forRoot(), /* ...기존 모듈 */],
})
```
[CITED: docs.sentry.io/platforms/javascript/guides/nestjs/]

### Pattern 5: Docker 멀티스테이지 빌드 (Next.js standalone + pnpm monorepo)
**What:** 3단계 멀티스테이지 빌드: deps -> build -> production.
**When to use:** Cloud Run 배포용 컨테이너 이미지 생성.
**Key considerations:**
- `outputFileTracingRoot`를 monorepo root로 설정해야 standalone이 shared 패키지를 포함한다
- pnpm의 symlink 기반 node_modules 구조는 standalone 출력에서 실제 파일로 복사되어야 한다
- `sharp`는 standalone 이미지에서 명시적으로 설치해야 한다
- Node 22 alpine 베이스 이미지 사용
[CITED: nextjs.org/docs/app/api-reference/config/next-config-js/output]
[CITED: github.com/vercel/next.js/discussions/38435]

### Pattern 6: GitHub Actions CI/CD (OIDC + Cloud Run)
**What:** 2개 workflow: PR 검증 (ci.yml) + main merge 시 배포 (deploy.yml).
**When to use:** 자동화된 빌드-테스트-배포 파이프라인.
**Key considerations:**
- Workload Identity Federation으로 keyless 인증 (서비스 키 없음)
- `google-github-actions/auth@v2`로 GCP 인증
- `google-github-actions/deploy-cloudrun@v2`로 Cloud Run 배포
- pnpm monorepo에서는 `pnpm install --frozen-lockfile` 사용
- turbo cache로 빌드 속도 최적화
[CITED: cloud.google.com/blog/products/devops-sre/deploy-to-cloud-run-with-github-actions]
[CITED: github.com/google-github-actions/deploy-cloudrun]

### Anti-Patterns to Avoid
- **Sentry DSN 하드코딩:** 환경변수로 주입. DSN은 공개 가능하지만, 코드에 직접 넣지 않는다. `NEXT_PUBLIC_SENTRY_DSN` (프론트) / `SENTRY_DSN` (백엔드).
- **전역 loading.tsx로 스켈레톤 대체:** 기존 loading.tsx는 스피너를 보여주지만, D-07/D-08 결정에 따라 컴포넌트별 세분화된 스켈레톤을 사용해야 한다. `loading.tsx`는 Next.js route 전환용으로 유지하되, 각 컴포넌트 내부에서 React Query의 `isLoading` 상태로 스켈레톤을 표시한다.
- **모바일 탭바에서 client-side state로 현재 탭 관리:** `usePathname()`으로 결정해야 라우트 변경 시 동기화가 보장된다. [VERIFIED: 기존 GNB의 isActiveGenre 패턴]
- **Docker COPY에서 전체 monorepo 복사:** `pnpm deploy --filter=@grapit/web --prod` 또는 standalone 출력만 복사하여 이미지 크기를 최소화한다.
- **CI에서 secrets를 환경변수로 직접 노출:** GitHub Actions에서 GCP Secret Manager를 참조하는 Cloud Run 환경설정을 사용한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 에러 추적 | 커스텀 에러 로거 | @sentry/nextjs + @sentry/nestjs | 소스맵, 성능 추적, 세션 리플레이, 알림 내장 |
| 토스트 알림 | 커스텀 토스트 컴포넌트 | sonner (이미 설치) | 스택형 토스트, richColors, promise 토스트 등 |
| Docker 이미지 빌드 | 수동 빌드 스크립트 | Dockerfile + GitHub Actions | 멀티스테이지, 레이어 캐싱, 자동화 |
| GCP 인증 | 서비스 키 파일 관리 | Workload Identity Federation (OIDC) | 키 없는 인증, 자동 만료, 보안 모범 사례 |
| 네트워크 상태 감지 | WebSocket heartbeat | navigator.onLine + online/offline 이벤트 | 브라우저 내장, 추가 의존성 없음 |
| 스켈레톤 UI | 커스텀 shimmer 효과 | shadcn Skeleton (이미 사용 중) | animate-pulse 내장, 일관된 디자인 |

**Key insight:** 이 Phase는 "새로 만드는" 것보다 "기존 것을 연결하고 확장하는" 작업이 대부분이다. 기존에 이미 설치된 라이브러리(sonner, Skeleton, Tailwind breakpoints)를 최대한 활용한다.

## Common Pitfalls

### Pitfall 1: Next.js standalone + pnpm monorepo symlink 문제
**What goes wrong:** pnpm은 symlink 기반 node_modules를 사용하는데, Next.js standalone 출력이 symlink를 그대로 복사하면 Docker에서 깨진다.
**Why it happens:** `@vercel/nft`(Node File Tracing)이 symlink 구조를 따라가며 실제 파일 대신 symlink를 복사한다.
**How to avoid:**
1. `next.config.ts`에 `outputFileTracingRoot: resolve(__dirname, '../../')`를 monorepo root로 설정한다.
2. Dockerfile에서 standalone 디렉토리를 복사한 후, `node_modules`가 정상인지 확인한다.
3. sharp는 standalone에 자동 포함되지 않을 수 있으므로, 프로덕션 스테이지에서 `npm install sharp`를 별도로 실행한다.
**Warning signs:** Docker 빌드 성공 후 런타임에 `MODULE_NOT_FOUND` 에러.
[CITED: github.com/vercel/next.js/discussions/38435, github.com/vercel/next.js/discussions/40482]

### Pitfall 2: Sentry withSentryConfig + Turbopack 호환성
**What goes wrong:** Sentry의 `withSentryConfig`가 Turbopack dev 서버에서 warning을 발생시키거나 소스맵 업로드가 실패할 수 있다.
**Why it happens:** Turbopack은 Webpack 플러그인을 지원하지 않으며, Sentry의 일부 기능(소스맵 업로드)은 빌드 시에만 작동한다.
**How to avoid:** `withSentryConfig`의 옵션에서 `disableServerWebpackPlugin: true`를 dev 환경에서만 설정하거나, Sentry 소스맵 업로드를 CI/CD의 빌드 단계에서만 실행한다.
**Warning signs:** `turbo dev` 실행 시 Sentry 관련 경고 메시지.
[ASSUMED]

### Pitfall 3: Cloud Run WebSocket + min-instances 설정
**What goes wrong:** min-instances=1로 설정하면 WebSocket 연결이 단일 인스턴스에 고정되어 스케일링 시 문제가 발생할 수 있다.
**Why it happens:** Cloud Run이 새 인스턴스를 추가하면, 기존 WebSocket 연결은 이전 인스턴스에 남아 있다.
**How to avoid:** `@socket.io/redis-adapter`가 이미 설치되어 있으므로, 배포 시 Redis pub/sub를 통해 인스턴스 간 메시지 릴레이가 작동하는지 확인한다. D-18에서 min-instances=1을 결정했으므로, 초기에는 단일 인스턴스로 시작하되, 추후 스케일링 시 테스트한다.
**Warning signs:** 다른 인스턴스의 사용자에게 좌석 상태가 전파되지 않음.
[VERIFIED: apps/api/package.json에 @socket.io/redis-adapter 설치 확인]

### Pitfall 4: LayoutShell의 모바일 바텀 패딩 누락
**What goes wrong:** MobileTabBar가 고정 위치(fixed bottom)이므로, 본문 콘텐츠가 탭바에 가려진다.
**Why it happens:** 탭바 높이(56px + safe-area)만큼의 하단 패딩을 본문에 추가하지 않으면, 마지막 콘텐츠가 보이지 않는다.
**How to avoid:** LayoutShell에서 `pb-[56px]` (또는 safe-area 포함 `pb-[68px]`)를 md 미만에서만 적용한다. `env(safe-area-inset-bottom)`을 CSS 변수로 사용하여 iOS 디바이스 대응.
**Warning signs:** 모바일에서 페이지 하단 콘텐츠가 탭바에 가려져 보이지 않음.
[VERIFIED: UI-SPEC에서 pb-[56px] 지시 확인]

### Pitfall 5: 에러 토스트 중복 표시
**What goes wrong:** API 에러 인터셉터에서 토스트를 표시하고, 컴포넌트에서도 `onError`로 토스트를 표시하면 같은 에러가 두 번 나타난다.
**Why it happens:** React Query의 `onError` 콜백과 api-client.ts의 에러 인터셉터가 독립적으로 동작한다.
**How to avoid:** 에러 토스트를 api-client.ts 인터셉터에서만 표시하고, 컴포넌트 레벨에서는 추가 토스트를 표시하지 않는다. 401 (auth expired)은 인터셉터에서 처리하되 토스트 대신 리다이렉트를 수행한다.
**Warning signs:** 하나의 API 에러에 대해 동일한 토스트가 2개 쌓인다.
[VERIFIED: api-client.ts 기존 구조에서 throw만 하고 toast는 없음 -- 인터셉터에서 toast를 추가할 때 주의]

### Pitfall 6: Dockerfile에서 pnpm workspace 의존성 해결 실패
**What goes wrong:** Docker 빌드 시 `@grapit/shared` 패키지를 찾지 못한다.
**Why it happens:** pnpm workspace는 `workspace:*` 프로토콜로 로컬 패키지를 참조하는데, Docker 빌드 컨텍스트에 monorepo 전체를 포함하지 않으면 해결되지 않는다.
**How to avoid:** Docker 빌드 컨텍스트를 monorepo root로 설정하고 (`docker build -f apps/web/Dockerfile .`), pnpm-workspace.yaml과 모든 package.json을 먼저 복사한 후 `pnpm install --frozen-lockfile`을 실행한다.
**Warning signs:** `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` 에러.
[ASSUMED]

## Code Examples

### MobileTabBar 컴포넌트
```typescript
// Source: UI-SPEC + CONTEXT.md D-03
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/', label: '홈', icon: Home },
  { href: '/genre/musical', label: '카테고리', icon: LayoutGrid },
  { href: '/search', label: '검색', icon: Search },
  { href: '/mypage', label: '마이페이지', icon: User },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav
      role="navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] border-t border-border bg-white pb-safe md:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5',
              active ? 'text-primary' : 'text-gray-400',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className={cn('text-caption', active ? 'font-semibold text-primary' : 'font-normal text-gray-500')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
```
[VERIFIED: lucide-react 아이콘 이름 확인 (Home, LayoutGrid, Search, User)]

### NetworkBanner 컴포넌트
```typescript
// Source: UI-SPEC + CONTEXT.md D-11
'use client';

import { useEffect, useState } from 'react';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function handleOffline() { setIsOffline(true); }
    function handleOnline() { setIsOffline(false); }

    // 초기 상태 체크
    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[60] flex h-[44px] items-center justify-center gap-3 bg-error text-white"
    >
      <span className="text-caption font-semibold">인터넷 연결을 확인해주세요</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md border border-white bg-transparent px-3 h-8 text-caption text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
```
[VERIFIED: UI-SPEC 사양 반영]

### API 에러 인터셉터 확장
```typescript
// Source: CONTEXT.md D-10, D-12
// apps/web/lib/api-client.ts 수정 -- request() 함수 내 에러 처리 부분
import { toast } from 'sonner';

const STATUS_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  403: '접근 권한이 없습니다.',
  404: '요청하신 정보를 찾을 수 없습니다.',
  408: '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
};

const DEFAULT_ERROR = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

// request() 함수 내 !res.ok 분기에서:
if (!res.ok) {
  const status = res.status;
  let errorMessage = STATUS_MESSAGES[status] ?? DEFAULT_ERROR;
  try {
    const errorData = await res.json() as { message?: string };
    if (errorData.message) errorMessage = errorData.message;
  } catch { /* use default */ }

  // 401은 이미 위에서 처리 (리다이렉트). 여기서는 토스트만.
  if (status !== 401) {
    toast.error(errorMessage, {
      description: `오류 코드: ERR-${status}`,
      duration: 5000,
    });
  }

  throw new ApiClientError(errorMessage, status);
}
```
[VERIFIED: sonner toast API -- description prop으로 부가 텍스트 지원]

### Next.js standalone Dockerfile (monorepo)
```dockerfile
# Source: nextjs.org/docs + community best practices
# apps/web/Dockerfile

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
# shared 패키지 먼저 빌드
RUN pnpm --filter @grapit/shared build
# Next.js 빌드
RUN pnpm --filter @grapit/web build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
```
[ASSUMED -- pnpm monorepo standalone 경로는 실제 빌드 출력을 확인하며 조정 필요]

### GitHub Actions CI Workflow
```yaml
# Source: google-github-actions/auth + deploy-cloudrun
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```
[CITED: pnpm/action-setup 공식 문서]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.outputFileTracingRoot` | `outputFileTracingRoot` (top-level) | Next.js 15+ | 설정 위치 변경 -- experimental 접두어 제거 |
| Sentry 8.x `sentry.client.config.ts` | Sentry 10.x `instrumentation-client.ts` | 2025 | 파일명 변경, Next.js instrumentation API 사용 |
| GCP 서비스 키 JSON | Workload Identity Federation (OIDC) | 2023+ | 키 없는 인증이 표준 |
| `docker build` 수동 실행 | GitHub Actions + google-github-actions/deploy-cloudrun | 2024+ | 완전 자동화된 CI/CD |

**Deprecated/outdated:**
- `sentry.client.config.ts` / `sentry.server.config.ts` 파일명: Sentry 10.x에서는 `instrumentation-client.ts` + `instrumentation.ts` 래퍼 사용 [CITED: docs.sentry.io]
- GCP 서비스 키 JSON: Workload Identity Federation으로 대체 권장 [CITED: cloud.google.com]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sentry withSentryConfig가 Turbopack dev에서 warning 발생 가능 | Pitfall 2 | dev 환경에서 에러 발생 시 추가 설정 필요, 프로덕션에는 영향 없음 |
| A2 | pnpm workspace Docker에서 ERR_PNPM_WORKSPACE_PKG_NOT_FOUND 가능 | Pitfall 6 | Docker 빌드 실패 시 컨텍스트 경로 조정 필요 |
| A3 | Next.js standalone 출력에서 server.js 경로가 apps/web/server.js | Dockerfile | 실제 빌드 후 경로 확인 필요, 틀리면 CMD 수정 |
| A4 | Sentry 10.x에서 sentry.server.config.ts 대신 instrumentation.ts 사용 | Architecture | 버전에 따라 파일명이 다를 수 있음, npx @sentry/wizard로 자동 설정 권장 |

## Open Questions

1. **GCP 프로젝트 및 Workload Identity Federation 설정 완료 여부**
   - What we know: CONTEXT.md D-15에서 OIDC 인증을 결정함
   - What's unclear: GCP 프로젝트 ID, Workload Identity Pool, Service Account가 이미 생성되었는지
   - Recommendation: CI/CD 구현 시 사용자에게 GCP 설정 완료 여부를 확인하고, 미완료 시 설정 가이드를 별도 문서로 제공

2. **Sentry 프로젝트 및 DSN 생성 여부**
   - What we know: @sentry/nextjs + @sentry/nestjs 사용 결정됨
   - What's unclear: Sentry 계정에 프로젝트가 생성되었는지, DSN이 준비되었는지
   - Recommendation: Sentry 설정 task에서 DSN을 환경변수 placeholder로 두고, 실제 DSN은 사용자가 주입

3. **Cloud Run 서비스 이름 및 리전 확인**
   - What we know: asia-northeast3 (서울), web/api 별도 서비스
   - What's unclear: 서비스 이름 (`grapit-web`, `grapit-api`?), Artifact Registry 이름
   - Recommendation: deploy.yml에서 변수로 처리하고, 초기 수동 배포로 확인

4. **Secret Manager 시크릿 구조**
   - What we know: DATABASE_URL, JWT_SECRET 등 필수 환경변수 목록은 CLAUDE.md에 정의
   - What's unclear: Secret Manager에 시크릿이 이미 생성되었는지, 이름 컨벤션
   - Recommendation: CI/CD workflow에서 `--update-secrets` 플래그로 Cloud Run에 시크릿을 마운트

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Dockerfile 로컬 테스트 | YES | 29.1.3 | CI에서만 빌드 (로컬 테스트 불필요) |
| gcloud CLI | Cloud Run 수동 배포 | NO | -- | GitHub Actions에서 자동 배포 |
| GitHub CLI (gh) | PR 생성, Actions 확인 | YES | 2.89.0 | -- |
| Node.js | 빌드 및 런타임 | YES | 22.x (engines 제약 확인) | -- |
| pnpm | 패키지 관리 | YES | 10.28.1 (corepack) | -- |

**Missing dependencies with no fallback:**
- 없음

**Missing dependencies with fallback:**
- gcloud CLI: 로컬에 설치되어 있지 않지만, GitHub Actions에서 `google-github-actions/auth@v2`로 대체. 로컬 배포가 필요하면 `brew install google-cloud-sdk`로 설치 가능.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.x |
| Config file | `apps/web/vitest.config.ts`, `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @grapit/web test` |
| Full suite command | `pnpm test` (turbo로 모든 패키지 테스트) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | MobileTabBar 렌더링 + 탭 활성화 | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/mobile-tab-bar.test.tsx` | Wave 0 |
| INFR-01 | 44px 터치 타겟 준수 | manual | 브라우저 DevTools 모바일 모드에서 시각적 확인 | manual-only (CSS 검증) |
| INFR-02 | 스켈레톤 컴포넌트 렌더링 | unit | `pnpm --filter @grapit/web exec vitest run components/__tests__/skeleton-variants.test.tsx` | Wave 0 |
| INFR-03 | API 에러 인터셉터 에러 코드 포함 | unit | `pnpm --filter @grapit/web exec vitest run lib/__tests__/api-client.test.ts` | Wave 0 |
| INFR-03 | NetworkBanner 온/오프라인 전환 | unit | `pnpm --filter @grapit/web exec vitest run components/layout/__tests__/network-banner.test.tsx` | Wave 0 |
| INFR-03 | NotFoundPage 렌더링 | unit | `pnpm --filter @grapit/web exec vitest run app/__tests__/not-found.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grapit/web test` + `pnpm --filter @grapit/api test`
- **Per wave merge:** `pnpm test` (전체)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/components/layout/__tests__/mobile-tab-bar.test.tsx` -- INFR-01
- [ ] `apps/web/lib/__tests__/api-client.test.ts` -- INFR-03 에러 인터셉터
- [ ] `apps/web/components/layout/__tests__/network-banner.test.tsx` -- INFR-03 네트워크 배너

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 이전 Phase에서 구현 완료 |
| V3 Session Management | no | 이전 Phase에서 구현 완료 |
| V4 Access Control | no | 이전 Phase에서 구현 완료 |
| V5 Input Validation | yes | zod (기존), 에러 메시지에 사용자 입력 미포함 |
| V6 Cryptography | no | 이 Phase에서 암호화 작업 없음 |
| V7 Error Handling & Logging | yes | Sentry 에러 추적, 에러 메시지에 스택 트레이스 미포함 |
| V10 Communications | yes | Cloud Run HTTPS 강제, CORS 설정 |
| V14 Configuration | yes | Secret Manager, 환경변수, Dockerfile 보안 |

### Known Threat Patterns for Phase 5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 에러 메시지에 서버 내부 정보 노출 | Information Disclosure | 한국어 사용자 메시지만 표시, 스택 트레이스는 Sentry로만 전송 |
| Sentry DSN 노출 | Information Disclosure | DSN은 공개 가능하나, Sentry 프로젝트 설정에서 rate limiting 적용 |
| Docker 이미지에 시크릿 포함 | Information Disclosure | 멀티스테이지 빌드로 빌드 환경 분리, .dockerignore로 .env 제외 |
| GitHub Actions에 하드코딩된 시크릿 | Elevation of Privilege | Workload Identity Federation으로 keyless 인증, 서비스 키 미사용 |
| Cloud Run 공개 접근 | Spoofing | Cloudflare WAF 뒤에 배치, Cloud Run invoker 권한 제어 |

## Sources

### Primary (HIGH confidence)
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) - 파일 구조, 설정 방법 확인
- [Sentry NestJS Guide](https://docs.sentry.io/platforms/javascript/guides/nestjs/) - instrument.ts, SentryModule 설정 확인
- [npm registry: @sentry/nextjs@10.47.0](https://www.npmjs.com/package/@sentry/nextjs) - 최신 버전 확인
- [npm registry: @sentry/nestjs@10.47.0](https://www.npmjs.com/package/@sentry/nestjs) - 최신 버전 확인
- Codebase scan: 기존 18개 파일의 Skeleton 사용, api-client.ts 에러 처리, LayoutShell 패턴

### Secondary (MEDIUM confidence)
- [Next.js Standalone Output Docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) - outputFileTracingRoot 설정
- [google-github-actions/deploy-cloudrun](https://github.com/google-github-actions/deploy-cloudrun) - Cloud Run 배포 Action
- [google-github-actions/auth](https://github.com/google-github-actions/auth) - Workload Identity Federation 인증
- [pnpm Docker Docs](https://pnpm.io/docker) - pnpm fetch, frozen-lockfile
- [Next.js pnpm Docker Discussion #38435](https://github.com/vercel/next.js/discussions/38435) - monorepo standalone 이슈

### Tertiary (LOW confidence)
- [Next.js Turbopack outputFileTracingRoot Issue #88579](https://github.com/vercel/next.js/issues/88579) - Turbopack 경로 중복 이슈 (수정 여부 미확인)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 모든 패키지 npm registry에서 버전 확인, 기존 설치 패키지 codebase에서 확인
- Architecture: HIGH - 기존 코드 패턴 (LayoutShell, api-client, GNB) 분석 완료, 확장 방향 명확
- Pitfalls: MEDIUM - pnpm + standalone Docker 이슈는 커뮤니티 보고 기반, 실제 빌드에서 확인 필요
- CI/CD: MEDIUM - GitHub Actions + Cloud Run 패턴은 공식 문서 기반이나, GCP 프로젝트 설정 사전 작업 필요

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Sentry SDK 업데이트 빈번하므로 30일)
