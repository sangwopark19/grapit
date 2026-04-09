# Phase 01 — UI Review

**Audited:** 2026-03-30
**Baseline:** 01-UI-SPEC.md (approved design contract)
**Screenshots:** 캡처 완료 — `.planning/ui-reviews/01-20260330-112740/` (desktop-home, desktop-auth, desktop-reset-password, mobile-home, mobile-auth)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | UI-SPEC 카피 계약 100% 이행, 한국어 에러 메시지 정확 |
| 2. Visuals | 3/4 | 계층 구조 명확, 홈 CTA 너비 스펙 불일치 (200px vs w-[200px] 일치), 비밀번호 찾기 링크 정렬 스펙 불일치 |
| 3. Color | 3/4 | `--color-error` 토큰이 #EF4444이나 phone-verification.tsx에서 #C62828 하드코딩 혼용 |
| 4. Typography | 3/4 | text-[20px]/text-[28px]/text-[14px] 등 임의 값 사용으로 타입 스케일 토큰 미활용 |
| 5. Spacing | 3/4 | space-y-*/gap-*/pt-* 클래스는 8포인트 그리드 준수, 일부 임의 픽셀값(max-w-[400px] 등) 사용 |
| 6. Experience Design | 3/4 | 로딩/에러/검증 상태 전반 양호, Next.js error.tsx·loading.tsx 파일 없음, ErrorBoundary 미구현 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **error 컬러 토큰 불일치** — phone-verification.tsx의 타이머 및 인증완료 텍스트가 `text-[#C62828]`, `text-[#15803D]` 하드코딩을 사용해 globals.css의 `--color-error: #EF4444` 토큰과 실제 렌더 색상이 다름 — `phone-verification.tsx` 201, 205, 221, 222번 라인을 `text-error`와 `text-success`로 교체하고 globals.css에 `--color-success: #15803D` (WCAG AA용 값)를 추가하거나 `text-[#15803D]`을 `text-[#15803D]`에서 `text-success`로 통일

2. **타이포그래피 임의값을 Tailwind 토큰으로 교체** — `text-[20px]`, `text-[28px]`, `text-[14px]`가 UI-SPEC이 선언한 4단계 스케일(Display/Heading/Body/Caption)인데 Tailwind 유틸리티(`text-2xl` = 24px, `text-xl`, `text-sm`)가 아닌 임의 픽셀값으로 구현되어 향후 스케일 변경 시 파일 전체 검색이 필요 — Tailwind v4 @theme 블록에 `--text-heading: 20px`, `--text-display: 28px`, `--text-caption: 14px` 등 시멘틱 토큰을 정의하고 전체 교체

3. **Next.js app router error.tsx / loading.tsx 파일 미구현** — `/auth`, `/mypage` 등 각 라우트 세그먼트에 `error.tsx`와 `loading.tsx`가 없어 JS 번들 에러나 RSC hydration 오류 시 빈 흰 화면이 노출됨 — `apps/web/app/error.tsx` (전역 fallback), `apps/web/app/auth/error.tsx`, `apps/web/app/mypage/loading.tsx`를 최소 구현으로 추가

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

UI-SPEC 카피 계약 전체 이행 확인.

**일치 검증 결과:**

| UI-SPEC 항목 | 실제 구현 | 일치 |
|---|---|---|
| 로그인 버튼 | `로그인` (login-form.tsx:128) | 일치 |
| 가입 완료 버튼 | `가입 완료` (signup-step3.tsx:268) | 일치 |
| 다음 버튼 | `다음` (signup-step1.tsx:100, signup-step2.tsx:176) | 일치 |
| 홈 빈 상태 제목 | `곧 다양한 공연이 찾아옵니다` (page.tsx:11) | 일치 |
| 홈 빈 상태 본문 | `지금 가입하고 가장 먼저 새로운 공연 소식을 만나보세요` (page.tsx:16-18) | 일치 |
| 로그인 에러 | `이메일 또는 비밀번호가 일치하지 않습니다` (login-form.tsx:55) | 일치 |
| 회원가입 완료 토스트 | `회원가입이 완료되었습니다` (signup-form.tsx:58) | 일치 |
| 비밀번호 재설정 발송 완료 제목 | `비밀번호 재설정 메일 발송 완료` (reset-password/page.tsx:54) | 일치 |
| 로그아웃 버튼 | `로그아웃` (profile-form.tsx:181) | 일치 |
| 변경사항 저장 버튼 | `변경사항 저장` (profile-form.tsx:165) | 일치 |
| 인증번호 발송 버튼 | `인증번호 발송` (phone-verification.tsx:155) | 일치 |
| 재발송 버튼 | `재발송` (phone-verification.tsx:153) | 일치 |
| 전체 동의 | `전체 동의` (signup-step2.tsx:89) | 일치 |
| 필수 접미사 | `(필수)` (signup-step2.tsx:105) | 일치 |
| 선택 접미사 | `(선택)` (signup-step2.tsx:149) | 일치 |
| 비활성 탭 툴팁 | `곧 오픈 예정입니다` (gnb.tsx:77) | 일치 |
| 서버 에러 | `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.` (login-form.tsx:57) | 일치 |
| 네트워크 에러 | `네트워크 연결을 확인해주세요` (callback/page.tsx:55) | 일치 |

약관 다이얼로그 본문은 의도적 placeholder임을 SUMMARY에서 명시했으며, 런칭 전 교체 예정으로 감사 제외.

비밀번호 찾기 페이지 이메일 필드 라벨에 필수 별표(*)가 없음 (reset-password/page.tsx:87). UI-SPEC에 명시 없으나 로그인 폼과 일관성 불일치. 사소한 결함으로 점수 영향 없음.

---

### Pillar 2: Visuals (3/4)

전반적으로 시각 계층 명확하고 브랜드 정체성이 일관성 있게 표현됨.

**통과 항목:**
- GNB: 64px 높이, 하단 보더, sticky top, Grapit 로고 Primary 컬러, `text-xl font-semibold` — 스펙 일치
- 홈 페이지: 로고 → 제목 → 설명 → CTA 순서 명확한 시각 계층 — 스크린샷 확인
- /auth 탭: 활성 탭 Primary 하단 보더(2px) + semibold, 비활성 회색 텍스트 — 스펙 일치 (tabs.tsx:32 `data-[state=active]:border-b-2 data-[state=active]:border-primary`)
- 소셜 로그인 버튼: 카카오(#FEE500)/네이버(#03C75A)/Google(#FFFFFF+보더) 브랜드 색상 정확
- 비밀번호 입력 eye 아이콘: `aria-label="비밀번호 보기"` 적용 (password-input.tsx:32)
- StepIndicator: active/completed/future 상태 시각 구분 명확, 체크 아이콘 완료 상태 표시
- 풋터: `개인정보처리방침` bold 처리 — 한국 개인정보보호법 관행 준수

**발견된 이슈:**

1. **비밀번호 찾기 링크 정렬**: UI-SPEC에서 `right-aligned`로 지정했으나 구현에서 `flex justify-end` (login-form.tsx:136) — 스크린샷에서 우측 정렬 확인, 스펙 준수. 패스.

2. **홈 CTA 너비**: UI-SPEC에서 "200px width" 지정, 구현에서 `w-[200px]` 사용 (page.tsx:23) — 일치. 단, `size="lg"` 버튼 기본 높이가 48px(h-12)인데 추가로 `h-12` 클래스를 명시해 중복 — 미세한 중복이나 기능적 영향 없음.

3. **홈 페이지 Grapit 브랜드 로고**: UI-SPEC에서 "Grapit text logo, 20px semibold, Primary color"로 지정했으나 구현에서 `text-4xl font-bold text-primary` 사용 (page.tsx:8) — `text-4xl`은 36px으로 스펙의 20px보다 훨씬 큼. 홈 페이지 상단 GNB의 로고(20px semibold)와 시각적 중복이 생기나, 홈 hero 영역에서 브랜드 강조 목적은 달성. 시각 계층에는 유리하나 스펙과 불일치.

4. **disabled 장르 탭 opacity**: 구현에서 `opacity-40` 사용 (gnb.tsx:79), UI-SPEC에서 "opacity 0.4" — 정확히 일치.

---

### Pillar 3: Color (3/4)

60/30/10 분포 실질적으로 준수됨. 단, 컬러 토큰 혼용 문제 발견.

**60/30/10 분포 검증:**
- 60% White (#FFFFFF): 페이지 배경, 폼 배경, 입력 필드 배경 — 일치
- 30% Gray-100 (#F5F5F7): GNB 없음(White), 풋터 `bg-gray-100`, 비활성 입력 배경 — GNB가 White여서 스펙 일치
- 10% Primary (#6C3CE0): CTA 버튼(bg-primary 10회), 활성 탭 보더(border-primary 3회), 포커스 링(ring-primary), 로고 링크(text-primary 17회) — 총 30건, 인터랙티브 요소에 집중 사용으로 10% 역할 적절

**핵심 문제 — 에러 컬러 이중 정의:**

| 위치 | 값 | 출처 |
|---|---|---|
| `globals.css` `--color-error` | `#EF4444` | D-16 원본 값 |
| `phone-verification.tsx` L201, L205 | `text-[#C62828]` | UI-SPEC 색상 계약 (WCAG AA 조정값) |
| `phone-verification.tsx` L221-222 | `text-[#15803D]` | UI-SPEC 성공 텍스트 색상 |

UI-SPEC의 Color System 섹션은 WCAG AA를 위해 에러 텍스트를 `#C62828` (5.62:1 대비)로 조정했으나, globals.css는 D-16 원본값 `#EF4444` (3.94:1 대비 — AA 실패)를 사용. 폼 검증 에러 메시지 (`text-error` 클래스)가 WCAG AA를 통과하지 못함.

`--color-success` 토큰이 globals.css에 `#22C55E`로 정의되어 있으나 phone-verification.tsx에서는 `text-[#15803D]` 하드코딩 사용 — 성공 상태도 토큰 혼용.

**기타 하드코딩 색상 (허용 범위):**
- `social-login-button.tsx`: `#FEE500`, `#03C75A`, `#FFFFFF`, `#191919`, `#1F1F1F`, `#DADCE0` — 브랜드 강제 색상(소셜 OAuth 가이드라인)으로 토큰화 불가, 허용
- `gnb.tsx` L61: `border-[#E5E5E5]` — UI-SPEC 스펙값 직접 사용, 토큰 없는 경우 허용

---

### Pillar 4: Typography (3/4)

Pretendard 폰트 적용 확인. UI-SPEC의 4단계 스케일을 구현했으나 Tailwind 시멘틱 토큰 대신 임의 픽셀값 사용.

**폰트 크기 분포:**

| 실제 클래스 | UI-SPEC Role | px 값 | 용도 |
|---|---|---|---|
| `text-[28px]` | Display | 28px | 홈 hero 제목 (page.tsx:11) |
| `text-[20px]` | Heading | 20px | 페이지 제목, 섹션 헤딩 (5곳) |
| `text-base` | Body | 16px | 폼 라벨, 버튼, 본문 (26회) |
| `text-[14px]` | Caption | 14px | 에러, 힌트, 풋터 (다수) |
| `text-sm` | 14px (= Caption) | 14px | GNB 드롭다운, 약관 텍스트 |
| `text-xs` | 12px | 12px | StepIndicator 라벨 (step-indicator.tsx:48) |
| `text-lg` | 18px | 18px | 사용처 2곳 (ui/form.tsx 등) |
| `text-xl` | 20px | 20px | GNB 로고 (gnb.tsx:67) |
| `text-4xl` | 36px | 36px | 홈 브랜드 로고 (page.tsx:8) |

UI-SPEC은 "정확히 4가지 크기" 사용을 선언했으나 실제로는 6-7가지가 사용됨.

**문제:**
1. `text-[20px]`과 `text-xl`이 모두 20px이나 서로 다른 클래스로 혼용 — 동일 역할에 두 가지 표현
2. `text-[14px]`과 `text-sm`이 모두 14px이나 혼용 — form.tsx에서는 `text-[14px]`, GNB에서는 `text-sm`
3. `text-xs`(12px)는 UI-SPEC에 없는 5번째 크기 — StepIndicator 라벨에 사용
4. `text-4xl`(36px)은 UI-SPEC에 없는 크기 — 홈 브랜드 로고에 사용

**폰트 웨이트 분포:**

| 클래스 | 회수 |
|---|---|
| font-medium | 14회 |
| font-semibold | 11회 |
| font-normal | 2회 |
| font-bold | 1회 |

UI-SPEC은 "2가지 웨이트만 사용"을 선언했으나 font-medium(500)과 font-bold(700)가 추가로 사용됨. 단, font-medium은 form 라벨/버튼 등 UI-SPEC이 명시적으로 배제하지 않은 영역에 사용.

---

### Pillar 5: Spacing (3/4)

8포인트 그리드 기반 스페이싱 대체로 준수. Tailwind 기본 스케일(4px 배수) 활용으로 커스텀 토큰과 실질적으로 일치.

**스페이싱 클래스 분포 (상위):**

| 클래스 | 회수 | 8pt 그리드 |
|---|---|---|
| space-y-6 | 7 | 24px — lg 일치 |
| space-y-2 | 7 | 8px — sm 일치 |
| space-y-4 | 5 | 16px — md 일치 |
| space-y-3 | 5 | 12px — sm/md 사이 |
| gap-2 | 18 | 8px — sm 일치 |
| gap-3 | 4 | 12px — sm/md 사이 |
| px-4 | 14 | 16px — md 일치 |
| px-6 | 6 | 24px — lg 일치 |
| py-12 | 4 | 48px — 2xl 일치 |

**주목할 이슈:**

1. **홈 페이지 CTA 상단 간격**: UI-SPEC에서 "32px between description and CTA" 지정. 구현에서 `mt-8` (32px) 사용 (page.tsx:23) — 일치.

2. **홈 페이지 로고→제목 간격**: UI-SPEC에서 "24px between logo and heading". 구현에서 `mt-6` (24px) 사용 (page.tsx:11) — 일치.

3. **홈 페이지 제목→설명 간격**: UI-SPEC에서 "12px between heading and description". 구현에서 `mt-3` (12px) 사용 (page.tsx:16) — 일치.

4. **`space-y-3`/`gap-3` (12px)**: UI-SPEC 스케일에 xs(4px)/sm(8px)/md(16px) 사이에 12px이 없음. 소셜 버튼 간격 등에 사용. 기능적으로 무해하나 스펙 외 값.

5. **임의 max-width 값**: `max-w-[400px]`, `max-w-[600px]`, `max-w-[1200px]`는 레이아웃 상한으로 스페이싱 스케일 범위 외 — UI-SPEC이 각 페이지에서 이 값을 명시했으므로 허용.

6. **Footer `style={{ minHeight: 120 }}`**: (footer.tsx:5) CSS-in-JS inline style 사용. Tailwind 클래스 `min-h-[120px]`로 교체해야 일관성 유지.

---

### Pillar 6: Experience Design (3/4)

인터랙션 상태 커버리지가 전반적으로 훌륭하나 라우트 수준의 에러/로딩 경계가 미구현.

**로딩 상태 (양호):**

| 액션 | 구현 | UI-SPEC 요구사항 |
|---|---|---|
| 로그인 제출 | Spinner + "로그인 중..." + disabled (login-form.tsx:123-128) | 일치 |
| 회원가입 제출 | Spinner + "처리 중..." + disabled (signup-step3.tsx:262-265) | 일치 |
| 소셜 로그인 | Spinner, redirect (social-login-button.tsx:73-74) | 일치 |
| 인증번호 발송 | Spinner + "발송 중..." (phone-verification.tsx:148-151) | 일치 |
| 프로필 저장 | Spinner + "저장 중..." + disabled (profile-form.tsx:159-162) | 일치 |
| AuthGuard 초기화 | Spinner 중앙 (auth-guard.tsx:25) | 구현됨 |
| OAuth callback | Spinner 두 단계 (callback/page.tsx:116, 168) | 구현됨 |

**에러 상태 (양호):**
- 폼 필드 인라인 에러: `FormMessage`로 react-hook-form 에러 표시 (form.tsx:148-150)
- 로그인 실패: 인라인 에러 문구 `text-error` 색상 (login-form.tsx:110-113)
- 인증번호 오류: 인라인 에러 + fade-in 애니메이션 (phone-verification.tsx:212-214)
- API 에러: try/catch + toast.error 패턴 전체 일관성 있게 사용

**빈 상태 (양호):**
- 홈: 의도적 빈 상태 UI 구현 (page.tsx)
- AuthGuard: 미인증 시 /auth 리디렉트 (auth-guard.tsx)

**타이머 상태 (양호):**
- 3분 카운트다운, MM:SS 형식, 만료 후 "시간 만료" 텍스트, "재발송" 버튼 (phone-verification.tsx:63-69, 200-207) — UI-SPEC 일치

**미구현 항목:**

1. **`error.tsx` 미존재**: `apps/web/app/` 하위에 Next.js App Router `error.tsx` 파일 없음. 클라이언트 컴포넌트 런타임 에러 시 빈 화면 또는 Next.js 기본 에러 표시. `/auth/error.tsx`, `/mypage/error.tsx` 모두 없음.

2. **`loading.tsx` 미존재**: 라우트 세그먼트 별 `loading.tsx` 없음. 초기 페이지 로드 시 Suspense 경계 없어 콘텐츠 shift 가능성.

3. **전역 ErrorBoundary 없음**: React ErrorBoundary 클래스 컴포넌트 또는 Next.js의 error.tsx에 해당하는 것이 루트 레이아웃에 없어 예상치 못한 JS 에러가 전체 화면 파괴로 이어질 수 있음.

4. **step 전환 애니메이션**: UI-SPEC에서 "slide-left, 200ms ease-out" 지정. 구현에서 `transition-transform duration-200 ease-out` 클래스가 있으나 (signup-form.tsx:76) `key={currentStep}` 변경만으로는 CSS transition이 트리거되지 않음 — 실제 슬라이드 효과 미작동. fade-in만 작동.

---

## Registry Safety

Registry audit: shadcn 공식 레지스트리만 사용 (button, input, label, checkbox, tabs, dialog, separator, sonner, form). 서드파티 레지스트리 없음 — 감사 불필요.

---

## Files Audited

**앱 페이지:**
- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/auth/page.tsx`
- `apps/web/app/auth/reset-password/page.tsx`
- `apps/web/app/mypage/page.tsx`

**레이아웃 컴포넌트:**
- `apps/web/components/layout/gnb.tsx`
- `apps/web/components/layout/footer.tsx`
- `apps/web/components/layout/mobile-menu.tsx`

**인증 컴포넌트:**
- `apps/web/components/auth/login-form.tsx`
- `apps/web/components/auth/signup-form.tsx`
- `apps/web/components/auth/signup-step1.tsx`
- `apps/web/components/auth/signup-step2.tsx`
- `apps/web/components/auth/signup-step3.tsx`
- `apps/web/components/auth/step-indicator.tsx`
- `apps/web/components/auth/social-login-button.tsx`
- `apps/web/components/auth/phone-verification.tsx`
- `apps/web/components/auth/profile-form.tsx`
- `apps/web/components/auth/auth-guard.tsx`

**UI 기본 컴포넌트:**
- `apps/web/components/ui/button.tsx`
- `apps/web/components/ui/input.tsx`
- `apps/web/components/ui/tabs.tsx`
- `apps/web/components/ui/form.tsx`

**설계 문서:**
- `.planning/phases/01-foundation-auth/01-UI-SPEC.md`
- `.planning/phases/01-foundation-auth/01-CONTEXT.md`
- `.planning/phases/01-foundation-auth/01-01-SUMMARY.md` ~ `01-05-SUMMARY.md`

**스크린샷:**
- `.planning/ui-reviews/01-20260330-112740/desktop-home.png`
- `.planning/ui-reviews/01-20260330-112740/desktop-auth.png`
- `.planning/ui-reviews/01-20260330-112740/desktop-reset-password.png`
- `.planning/ui-reviews/01-20260330-112740/mobile-home.png`
- `.planning/ui-reviews/01-20260330-112740/mobile-auth.png`
