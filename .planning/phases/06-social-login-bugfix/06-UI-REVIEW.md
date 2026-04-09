---
phase: 06
slug: social-login-bugfix
audited: 2026-04-09
baseline: UI-SPEC.md (approved)
screenshots: captured (localhost:3000)
---

# Phase 06 — UI Review

**Audited:** 2026-04-09
**Baseline:** 06-UI-SPEC.md (approved 2026-04-09)
**Screenshots:** captured — `.planning/ui-reviews/06-20260409-171651/`

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | CTA, 에러 메시지 대부분 스펙 준수; provider 이름 인터폴레이션 미구현 |
| 2. Visuals | 3/4 | 에러 아이콘 + 계층구조 명확; error-surface 컨테이너 배경 스펙 미준수 |
| 3. Color | 4/4 | 토큰 일관 사용, 하드코딩은 소셜 버튼 브랜드 컬러에 한정 (의도적) |
| 4. Typography | 3/4 | 스펙 토큰 대부분 준수; text-sm 3곳 비선언 사용 (Phase 6 외 파일) |
| 5. Spacing | 2/4 | 재시도 버튼 간격 스펙 24px vs 실제 8px; 에러 메시지 위치 구조 편차 |
| 6. Experience Design | 4/4 | 로딩/에러/빈 상태 모두 처리, Suspense 올바름, disabled 상태 완비 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **재시도 버튼 margin-top 8px (mt-2) — 스펙 24px (mt-6) 미달** — detail 텍스트와 버튼이 붙어 있어 시각적 분리감 부족, 탭 터치 영역 인식 약화 — `apps/web/app/auth/callback/page.tsx:178`의 `className="mt-2 w-full max-w-[280px]"`를 `mt-6`으로 변경

2. **oauth_failed 메시지에 provider 이름 인터폴레이션 미구현** — 스펙: "{provider} 서비스에 일시적으로 연결할 수 없습니다." 실제: "소셜 로그인에 실패했습니다." — provider 파라미터(`errorInfo.provider`)를 이미 state에 담고 있으므로, `oauth_failed` 케이스에서 `${providerName} 서비스에 연결할 수 없습니다.`로 분기 출력하면 해결

3. **에러 컨테이너 background 스펙 미준수** — 스펙: `bg-error-surface` + `border-l-4 border-error` 컨테이너; 실제: 일반 흰 배경에 아이콘만 빨간색 — `apps/web/app/auth/callback/page.tsx:165-184`의 내부 `<div>` 에 `bg-error-surface rounded-lg border-l-4 border-error p-6` 추가

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**통과:**
- CTA "다시 로그인하기" — 스펙 그대로 구현 (`callback/page.tsx:181`)
- 처리 중 상태 "로그인 처리 중..." — 스펙 그대로 (`callback/page.tsx:194`)
- token_expired, server_error, account_conflict 메시지 — 스펙 내용과 실질 동일
- 로그인폼 소셜 에러 인라인 문구 — 간결하고 명확

**편차:**
- `oauth_failed` 에러 메시지: 스펙 "**{provider} 서비스에 일시적으로 연결할 수 없습니다.** 잠시 후 다시 시도해주세요." vs 실제 "소셜 로그인에 실패했습니다." — provider 이름이 전혀 표시되지 않아 사용자가 어떤 서비스가 문제인지 파악 불가 (`callback/page.tsx:20-23`)
- `oauth_denied` detail 메시지: 스펙에 없는 표현이지만 "다시 로그인해주세요."는 적절
- 스펙에 선언된 "네트워크 연결을 확인해주세요." 코드가 별도 error key 없이 toast로만 처리됨 (`callback/page.tsx:105`). 스펙은 이것도 인라인 에러 패턴으로 기대할 수 있음 — 단, toast 처리도 허용 범위

### Pillar 2: Visuals (3/4)

**통과 (스크린샷 기반):**
- 로그인 폼: 이메일 → 비밀번호 → 로그인 버튼 → 구분선 → 소셜 버튼 순서로 명확한 시각 계층
- 에러 아이콘 AlertCircle(32px) + 빨간색으로 에러 상태 명확히 표시
- 소셜 에러 인라인 메시지가 구분선과 소셜 버튼 사이 적절한 위치 (`login-with-social-error.png` 확인)
- 모바일(375px): 폼이 전체 너비로 자연스럽게 렌더링, 소셜 버튼 터치 영역 충분

**편차:**
- 에러 상태 UI가 단순 텍스트 + 아이콘 나열에 그침. 스펙이 명시한 `bg-error-surface` 배경 컨테이너가 없어서 에러 상태임을 시각적으로 구분할 배경색 단서 부재. 흰 배경 위 빨간 아이콘만으로는 에러 컨테이너 인식이 약함
- `callback/page.tsx` 에러 상태는 정적 스크린샷 도구 타이밍 문제로 처리 중 스피너만 캡처됨. 코드 리뷰로 평가: `errorInfo` 체크가 `isProcessing` 보다 앞에 위치하므로 실제 에러 URL 진입 시 즉시 에러 UI 렌더

### Pillar 3: Color (4/4)

**통과:**
- `text-primary` — 스피너, 호버 링크에만 제한적 사용 (약 14 uses, 모두 인터랙티브 요소)
- `text-error` — 필수 표시(*), 에러 메시지, AlertCircle에 한정 사용
- `bg-primary` — step-indicator 활성 상태 전용
- 하드코딩 색상 (`social-login-button.tsx:29,36,43`) — 카카오(#FEE500), 네이버(#03C75A), 구글(#FFFFFF/#1F1F1F) 브랜드 가이드라인 준수 컬러로 토큰화 불가한 외부 브랜드 컬러. CSS 토큰으로 대체 불가하며 의도적 예외
- 60/30/10 분포: 흰 배경 dominant, gray-100 secondary, primary accent 10% 이하 유지 확인

### Pillar 4: Typography (3/4)

**스펙 선언 토큰 사용:**
- `text-base` (16px) — 에러 메시지 primary, 버튼 레이블 (18 uses)
- `text-caption` (14px) — 에러 detail, 인라인 에러 (12 uses)
- `text-heading` (20px) — 추가 정보 입력 헤딩 (4 uses)
- `font-semibold` (600) — 에러 메시지 primary, 버튼 레이블 (12 uses)

**편차:**
- `text-sm` — 스펙 선언 외 사이즈. `phone-verification.tsx:201,205,222`, `step-indicator.tsx:32` 4곳 사용. Phase 6 직접 구현 파일(callback, login-form)에는 없으므로 기존 파일 잔존 이슈로 감점 경미
- `text-xs` 1곳 — Phase 6 파일 외부
- 사용 폰트 사이즈 종류: xs, sm, base, caption, heading — 5종. 스펙 선언(caption, heading, display, base) + sm/xs가 혼입. 스펙 엄격 준수 기준으로 경미 감점

### Pillar 5: Spacing (2/4)

**통과:**
- 스펙 스케일 토큰(gap-2=8px, gap-4=16px, gap-6=24px, space-y-6=24px, px-4=16px, py-12=48px) 주로 사용
- `max-w-[400px]` — 스펙 명시 컨테이너 너비 준수 (`callback/page.tsx:166`, `page.tsx:27`)
- `max-w-[280px]` — 스펙 명시 버튼 최대 너비 준수 (`callback/page.tsx:178`)

**편차 (스펙 vs 실제):**

| 항목 | 스펙 | 실제 | 파일:라인 |
|------|------|------|-----------|
| 재시도 버튼 margin-top (detail 기준) | 24px (mt-6) | 8px (mt-2) | `callback/page.tsx:178` |
| primary 메시지 margin-top (아이콘 기준) | 16px (mt-4 또는 gap-4) | gap-4 컨테이너 전체 공유, text-center div 별도 margin 없음 — 아이콘 16px gap은 gap-4로 달성되나 text-center div 내 primary와 detail 간 8px(mt-2)은 스펙 준수 | `callback/page.tsx:166-173` |

재시도 버튼(mt-2=8px)이 스펙(24px)보다 16px 부족. 모바일에서 detail 텍스트와 버튼이 과도하게 근접하여 터치 영역 분리가 약함.

### Pillar 6: Experience Design (4/4)

**통과:**
- 로딩 상태: 콜백 처리 중 Loader2 스피너, 소셜 버튼 클릭 시 개별 isLoading, Suspense fallback 스피너 — 완비
- 에러 상태: `errorInfo` state로 5가지 에러 코드 처리, unknown 코드는 server_error로 fallback (`callback/page.tsx:163`)
- next.js error boundary: `apps/web/app/auth/error.tsx` 존재
- disabled 상태: 폼 제출 중(isLoading), 조건 미충족(canProceed, isFormValid), 소셜 버튼(isLoading) — 모두 적절히 처리
- Suspense 패턴: `useSearchParams` 두 곳 모두 Suspense로 래핑 — Next.js App Router 호환
- 에러 우선 처리: `useEffect` 내 `errorCode` 체크가 `status` 체크 전에 위치하여 에러 URL에서 즉시 에러 UI 표시 (`callback/page.tsx:52-59`)
- 소셜 에러 인라인 표시: `SocialErrorMessage` Suspense 래핑 + null 안전 처리 (`login-form.tsx:36-48`)

---

## Registry Audit

shadcn 초기화: YES (components.json 확인)
제3자 레지스트리: 없음 — UI-SPEC Registry Safety 테이블에 shadcn official 전용 선언
Registry audit: 0 third-party blocks — 스캔 불필요

---

## Files Audited

- `apps/web/app/auth/callback/page.tsx` (252 lines)
- `apps/web/components/auth/login-form.tsx` (198 lines)
- `apps/web/components/auth/social-login-button.tsx` (85 lines)
- `apps/web/app/globals.css` (120 lines)
- `apps/web/components.json`
- `apps/web/app/auth/error.tsx` (참조)
- `apps/web/components/auth/step-indicator.tsx` (참조, text-sm 이슈)
- `apps/web/components/auth/phone-verification.tsx` (참조, text-sm 이슈)

Screenshots: `.planning/ui-reviews/06-20260409-171651/`
- `desktop-login.png` — 로그인 페이지 1440px
- `mobile-login.png` — 로그인 페이지 375px
- `login-with-social-error.png` — 소셜 에러 인라인 표시 확인
- `callback-error-oauth-failed.png` — (타이밍 문제로 스피너 캡처됨, 코드 감사로 대체)
- `callback-error-oauth-denied.png` — (동일)
- `callback-error-server.png` — (동일)
- `mobile-callback-error.png` — (동일)
